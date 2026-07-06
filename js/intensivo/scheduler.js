// Motor de scheduling para programa intensivo. Sin DOM, sin globales.
// Genera 1 semana del horario. Las 6 semanas del intensivo se generan iterando.
//
// REESCRITO (jul-2026): solver GREEDY + REPARACIÓN LOCAL + MULTI-RESTART, determinista.
// El backtracking exhaustivo anterior no escalaba: con los datos reales el grid de
// cada niño queda EXACTAMENTE lleno (30 sesiones / 30 franjas útiles), por lo que la
// búsqueda explotaba (>90s sin converger). Este solver:
//   1. coloca por demanda-más-restringida-primero (terapeuta con menos holgura),
//   2. elige el slot factible menos conflictivo (forward-checking O(1) por balance),
//   3. repara con swaps locales lo que no calza,
//   4. reintenta con varias semillas (barato) y se queda con la MEJOR colocación.
// SIEMPRE termina en <5s (típico <1s).
//
// Inputs:
//   intensivo = { id, fecha_inicio, semanas, reglas?, niños: [{ nombre, kids_semanal, kids_grupo,
//                  asignaciones: [{disciplina, rol, sigla, sesiones}] }] }
//   catalogo  = { franjas: [...], dias: [...], terapeutas: { SIGLA: {nombre, disciplina, sala} } }
//   opts      = { semilla?, salasCapacidad?, disponibilidad?, reglas?, semana?, kidsTerapeuta?, restarts? }
//
// Output (idéntico al motor anterior, para no romper armador.js):
//   { ok, grid: [niñoIdx][slotIdx]=sigla|null, sesionesPlanificadas, conflictos,
//     kidsSlots: [{grupo, slot, niños:[ni]}],
//     reunionesEquipo: [{ni, niño, slot, tutores:[sigla]}],
//     reunionesPapas:  [{ni, niño, slots:[..], tutores:[sigla]}],
//     sesionesPapas:   [{ni, niño, sigla, slot}] }

const Scheduler = (() => {
  const DEFAULTS = {
    kids_modulos: [2, 3, 4],
    max_por_terapeuta_dia: 5,
    max_por_disciplina_dia: 2,
    disciplina_no_consecutiva: true,
    bloques_fijos: [0, 7],
    reunion_equipo_franja: 0,
    reunion_papas_semana: 2,
    reunion_papas_bloques: 2,
  };
  const TUTORES_REUNION = ['TO', 'FONO', 'COG'];

  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffleInPlace(a, rnd) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function generarSemana(intensivo, catalogo, opts = {}) {
    const { franjas, dias } = catalogo;
    const F = franjas.length;
    const D = dias.length;
    const totalSlots = F * D;
    const N = intensivo.niños.length;
    const reglas = { ...DEFAULTS, ...(intensivo.reglas || {}), ...(opts.reglas || {}) };
    const semana = opts.semana ?? 1;
    const semillaBase = opts.semilla ?? 42;
    const RESTARTS = opts.restarts ?? 40;

    const salasCap = opts.salasCapacidad || {};
    const capDe = (sala) => (sala in salasCap ? salasCap[sala] : 1);
    const disponibilidad = opts.disponibilidad || {};
    const bloquesFijos = new Set(reglas.bloques_fijos || []);
    const esFijo = (slot) => bloquesFijos.has(slot % F);
    const diaDe = (slot) => Math.floor(slot / F);
    const franjaDe = (slot) => slot % F;
    const terapeutas = catalogo.terapeutas;

    function disponibleEn(sigla, slot) {
      const disp = disponibilidad[sigla];
      if (!disp) return true;
      const dia = dias[diaDe(slot)];
      const f = franjaDe(slot);
      return !!(disp[dia] && disp[dia][f]);
    }

    // Días con disponibilidad real (sábado suele venir vacío -> se excluye)
    const diasActivos = [];
    const hayDisp = Object.keys(disponibilidad).length > 0;
    for (let dia = 0; dia < D; dia++) {
      const nombre = dias[dia];
      if (!hayDisp) { if (nombre !== 'sab') diasActivos.push(dia); }
      else if (Object.keys(disponibilidad).some((s) => (disponibilidad[s][nombre] || []).some(Boolean))) diasActivos.push(dia);
    }
    if (diasActivos.length === 0) for (let d = 0; d < D; d++) diasActivos.push(d);

    const franjasUtiles = [];
    for (let f = 0; f < F; f++) if (!bloquesFijos.has(f)) franjasUtiles.push(f);

    const salasUsadas = new Set(Object.values(terapeutas).map((t) => t.sala));
    const KIDS_TER = opts.kidsTerapeuta || 'GP';
    const kidsModulos = (reglas.kids_modulos || []).filter((f) => !bloquesFijos.has(f));
    const salaKids = terapeutas[KIDS_TER] ? terapeutas[KIDS_TER].sala : null;

    // Grupos KIDS
    const grupos = {};
    intensivo.niños.forEach((n, ni) => {
      if ((n.kids_semanal || 0) > 0) { const g = n.kids_grupo || 1; (grupos[g] = grupos[g] || []).push(ni); }
    });

    // Demandas individuales (una unidad por sesión)
    const demandasBase = [];
    const conflictosSigla = [];
    intensivo.niños.forEach((n, ni) => {
      n.asignaciones.forEach((a) => {
        if (a.rol === 'PAPAS') return;
        if (!terapeutas[a.sigla]) {
          conflictosSigla.push({ tipo: 'sigla_desconocida', mensaje: `Terapeuta "${a.sigla}" no está en el catálogo (niño ${n.nombre}, ${a.disciplina})`, niño: n.nombre, sigla: a.sigla });
          return;
        }
        for (let k = 0; k < a.sesiones; k++) demandasBase.push({ ni, niño: n.nombre, sigla: a.sigla, disciplina: a.disciplina, rol: a.rol });
      });
    });
    const sesionesPlanificadas = demandasBase.length;

    // Holgura de terapeuta (disponibilidad útil) para most-constrained-first
    function holguraTer(sigla) {
      let av = 0;
      for (const dia of diasActivos) for (const f of franjasUtiles) if (disponibleEn(sigla, dia * F + f)) av++;
      return av || 1;
    }
    const needTer = {}; demandasBase.forEach((d) => { needTer[d.sigla] = (needTer[d.sigla] || 0) + 1; });
    const avTer = {}; Object.keys(needTer).forEach((s) => { avTer[s] = holguraTer(s); });
    const cargaNino = {}; demandasBase.forEach((d) => { cargaNino[d.ni] = (cargaNino[d.ni] || 0) + 1; });

    // ---------- una corrida (semilla) del grid: fases 0-2 ----------
    function solveOnce(seed, doEjection) {
      const rnd = mulberry32(seed);
      const gridNino = Array.from({ length: N }, () => new Array(totalSlots).fill(null));
      const ocupadoTer = {}; Object.keys(terapeutas).forEach((s) => { ocupadoTer[s] = new Uint8Array(totalSlots); });
      const ocupadoSala = {}; salasUsadas.forEach((s) => { ocupadoSala[s] = new Uint8Array(totalSlots); });
      const childDay = Array.from({ length: N }, () => new Uint8Array(D));
      const terDay = {}; Object.keys(terapeutas).forEach((s) => { terDay[s] = new Uint8Array(D); });
      const ntDay = new Map();
      const discDia = new Map();
      const kidsSlots = [];
      const conflictosKids = [];
      let softViol = 0;

      function chequear(ni, sigla, disc, slot, opt) {
        if (esFijo(slot)) return null;
        const dia = diaDe(slot), f = franjaDe(slot);
        if (!disponibleEn(sigla, slot)) return null;
        if (ocupadoTer[sigla][slot]) return null;
        if (gridNino[ni][slot]) return null;
        const sala = terapeutas[sigla].sala;
        if (sala && ocupadoSala[sala][slot] >= capDe(sala)) return null;
        if (terDay[sigla][dia] >= reglas.max_por_terapeuta_dia) return null;
        let penal = 0;
        const usadas = discDia.get(`${ni}_${disc}_${dia}`);
        if (usadas) {
          if (usadas.length >= reglas.max_por_disciplina_dia) {
            if (!opt || !opt.softDisc) return null;
            penal += 1000;
          }
          if (reglas.disciplina_no_consecutiva && usadas.some((ff) => Math.abs(ff - f) === 1)) {
            if (!opt || !opt.softConsec) return null;
            penal += 100;
          }
        }
        return { penal };
      }
      function ocupar(ni, sigla, disc, slot, penal) {
        const dia = diaDe(slot), f = franjaDe(slot);
        gridNino[ni][slot] = sigla;
        ocupadoTer[sigla][slot] = 1;
        const sala = terapeutas[sigla].sala;
        if (sala) ocupadoSala[sala][slot]++;
        childDay[ni][dia]++;
        terDay[sigla][dia]++;
        ntDay.set(`${ni}_${sigla}_${dia}`, (ntDay.get(`${ni}_${sigla}_${dia}`) || 0) + 1);
        const k = `${ni}_${disc}_${dia}`;
        const arr = discDia.get(k); if (arr) arr.push(f); else discDia.set(k, [f]);
        if (penal) softViol += penal;
      }
      function liberar(ni, sigla, disc, slot) {
        const dia = diaDe(slot), f = franjaDe(slot);
        gridNino[ni][slot] = null;
        ocupadoTer[sigla][slot] = 0;
        const sala = terapeutas[sigla].sala;
        if (sala) ocupadoSala[sala][slot]--;
        childDay[ni][dia]--;
        terDay[sigla][dia]--;
        ntDay.set(`${ni}_${sigla}_${dia}`, (ntDay.get(`${ni}_${sigla}_${dia}`) || 0) - 1);
        const arr = discDia.get(`${ni}_${disc}_${dia}`); if (arr) { const p = arr.lastIndexOf(f); if (p >= 0) arr.splice(p, 1); }
      }
      function costo(ni, sigla, slot, penal) {
        const dia = diaDe(slot), f = franjaDe(slot);
        return childDay[ni][dia] * 50 + terDay[sigla][dia] * 8 + Math.abs(f - (F / 2)) + penal;
      }
      function mejorSlot(ni, sigla, disc, relax) {
        let best = -1, bestC = Infinity, bestPen = 0;
        const diasOrd = shuffleInPlace(diasActivos.slice(), rnd);
        for (const dia of diasOrd) {
          for (const f of franjasUtiles) {
            const slot = dia * F + f;
            const r = chequear(ni, sigla, disc, slot, relax);
            if (!r) continue;
            const c = costo(ni, sigla, slot, r.penal);
            if (c < bestC) { bestC = c; best = slot; bestPen = r.penal; }
          }
        }
        return { slot: best, penal: bestPen };
      }

      // FASE 0: KIDS grupal (permite 2/día no contiguo si GP no tiene días suficientes)
      if (ocupadoTer[KIDS_TER]) {
        Object.keys(grupos).forEach((g) => {
          const nis = grupos[g];
          const need = Math.max(...nis.map((ni) => intensivo.niños[ni].kids_semanal || 0));
          let puestos = 0;
          const usado = [];
          for (let pasada = 0; pasada < 2 && puestos < need; pasada++) {
            const diasOrd = shuffleInPlace(diasActivos.slice(), rnd);
            for (const dia of diasOrd) {
              if (puestos >= need) break;
              const yaEste = usado.filter((x) => x.dia === dia);
              if (yaEste.length >= (pasada === 0 ? 1 : 2)) continue;
              const modsOrd = shuffleInPlace(kidsModulos.slice(), rnd);
              for (const f of modsOrd) {
                const slot = dia * F + f;
                if (!disponibleEn(KIDS_TER, slot) || ocupadoTer[KIDS_TER][slot]) continue;
                if (salaKids && ocupadoSala[salaKids][slot] >= capDe(salaKids)) continue;
                if (nis.some((ni) => gridNino[ni][slot])) continue;
                if (yaEste.some((x) => Math.abs(x.f - f) === 1)) continue;
                ocupadoTer[KIDS_TER][slot] = 1;
                if (salaKids) ocupadoSala[salaKids][slot]++;
                nis.forEach((ni) => { gridNino[ni][slot] = KIDS_TER; childDay[ni][dia]++; });
                terDay[KIDS_TER][dia]++;
                kidsSlots.push({ grupo: Number(g), slot, niños: nis.slice() });
                usado.push({ dia, f });
                puestos++;
                break;
              }
            }
          }
          if (puestos < need) conflictosKids.push({ tipo: 'kids_insuficientes', mensaje: `Grupo KIDS ${g}: ${puestos}/${need} sesiones` });
        });
      }

      // FASE 1: greedy most-constrained-first (con desempate aleatorio por semilla)
      const demandas = demandasBase.map((d) => ({ ...d, _r: rnd() }));
      demandas.forEach((d) => { d._tight = needTer[d.sigla] / avTer[d.sigla]; });
      demandas.sort((a, b) => (b._tight - a._tight) || (cargaNino[b.ni] - cargaNino[a.ni]) || (needTer[b.sigla] - needTer[a.sigla]) || (a._r - b._r));

      const pend = [];
      for (const d of demandas) {
        let r = mejorSlot(d.ni, d.sigla, d.disciplina, null);
        if (r.slot < 0) r = mejorSlot(d.ni, d.sigla, d.disciplina, { softConsec: true });
        if (r.slot < 0) r = mejorSlot(d.ni, d.sigla, d.disciplina, { softConsec: true, softDisc: true });
        if (r.slot >= 0) { ocupar(d.ni, d.sigla, d.disciplina, r.slot, r.penal); }
        else pend.push(d);
      }

      // FASE 2: reparación por CADENAS DE EYECCIÓN (relocación multi-paso guiada).
      // Para colocar a (ni,sigla) buscamos un slot factible salvo por UN ocupante
      // (la sesión del niño o la del terapeuta), lo desalojamos y lo re-colocamos
      // recursivamente en otro lado. Presupuesto de operaciones acota el tiempo.
      let opBudget = 0;
      const OP_MAX = 20000;

      // intenta ubicar la sesión (ni,sigla,disc) en cualquier slot; con eyección hasta prof
      function colocar(ni, sigla, disc, prof, relax) {
        if (opBudget++ > OP_MAX) return false;
        // 1) intento directo
        const r = mejorSlot(ni, sigla, disc, relax);
        if (r.slot >= 0) { ocupar(ni, sigla, disc, r.slot, r.penal); return true; }
        if (prof <= 0) return false;
        // 2) eyección: recorrer slots donde sólo hay un obstáculo movible
        const diasOrd = shuffleInPlace(diasActivos.slice(), rnd);
        for (const dia of diasOrd) {
          for (const f of franjasUtiles) {
            if (opBudget > OP_MAX) return false;
            const slot = dia * F + f;
            if (esFijo(slot) || !disponibleEn(sigla, slot)) continue;
            // reglas duras de terapeuta/día y disc deben cumplirse tras el desalojo
            if (terDay[sigla][dia] >= reglas.max_por_terapeuta_dia) continue;
            const usadas = discDia.get(`${ni}_${disc}_${dia}`);
            if (usadas && usadas.length >= reglas.max_por_disciplina_dia && !(relax && relax.softDisc)) continue;
            const sala = terapeutas[sigla].sala;
            const ninoOcup = gridNino[ni][slot];
            const terOcupOtro = ocupadoTer[sigla][slot];
            const esKids = ninoOcup === KIDS_TER || (terOcupOtro && kidsSlots.some((k) => k.slot === slot));
            if (esKids) continue;
            // sala llena por otro terapeuta (cap 1): tratable si ese otro es el propio terapeuta; si no, saltar
            if (sala && ocupadoSala[sala][slot] >= capDe(sala) && !terOcupOtro) continue;
            // Caso A: niño libre, terapeuta ocupado con otro niño -> desalojar esa sesión.
            // Colocamos d PRIMERO (ocupa el slot) para que la sesión desalojada no vuelva a él.
            if (!ninoOcup && terOcupOtro) {
              let nj = -1; for (let x = 0; x < N; x++) if (gridNino[x][slot] === sigla) { nj = x; break; }
              if (nj < 0) continue;
              const disc2 = terapeutas[sigla].disciplina;
              liberar(nj, sigla, disc2, slot);
              const chk = chequear(ni, sigla, disc, slot, relax);
              if (chk) {
                ocupar(ni, sigla, disc, slot, chk.penal);
                if (colocar(nj, sigla, disc2, prof - 1, null)) return true;
                liberar(ni, sigla, disc, slot); // deshacer d
              }
              ocupar(nj, sigla, disc2, slot); // restaurar desalojado
            }
            // Caso B: niño ocupado por otro terapeuta, nuestro terapeuta libre -> desalojar la del niño.
            else if (ninoOcup && ninoOcup !== sigla && !terOcupOtro) {
              const sig2 = ninoOcup, d2 = terapeutas[sig2].disciplina;
              liberar(ni, sig2, d2, slot);
              const chk = chequear(ni, sigla, disc, slot, relax);
              if (chk) {
                ocupar(ni, sigla, disc, slot, chk.penal);
                if (colocar(ni, sig2, d2, prof - 1, null)) return true;
                liberar(ni, sigla, disc, slot); // deshacer d
              }
              ocupar(ni, sig2, d2, slot); // restaurar desalojado
            }
          }
        }
        return false;
      }

      let restantes = pend;
      if (doEjection) {
        for (let ronda = 0; ronda < 2 && restantes.length; ronda++) {
          const aun = [];
          for (const d of restantes) {
            opBudget = 0;
            let done = colocar(d.ni, d.sigla, d.disciplina, 6, null);
            if (!done) { opBudget = 0; done = colocar(d.ni, d.sigla, d.disciplina, 6, { softConsec: true }); }
            if (!done) { opBudget = 0; done = colocar(d.ni, d.sigla, d.disciplina, 6, { softConsec: true, softDisc: true }); }
            if (!done) aun.push(d);
          }
          restantes = aun;
        }
      }

      const colocadas = sesionesPlanificadas - restantes.length;
      return { gridNino, ocupadoTer, ocupadoSala, childDay, terDay, discDia, kidsSlots, conflictosKids, noColocadas: restantes, colocadas, softViol };
    }

    // ---------- MULTI-RESTART en DOS ETAPAS (para acotar el tiempo) ----------
    // Etapa 1: greedy barato en muchas semillas -> ranking de las mejores bases.
    // Etapa 2: cadena de eyección (cara) sólo sobre las mejores K bases.
    const semDe = (r) => (semillaBase + r * 2654435761 % 1e9 + r);
    const scoreDe = (res) => res.colocadas * 100000 - res.softViol - res.conflictosKids.length * 1e6;
    const K = 6;
    const bases = [];
    let optimoSeed = null;
    for (let r = 0; r < RESTARTS; r++) {
      const res = solveOnce(semDe(r), false);
      bases.push({ seed: semDe(r), sc: scoreDe(res) });
      if (res.noColocadas.length === 0 && res.softViol === 0 && res.conflictosKids.length === 0) { optimoSeed = semDe(r); break; }
    }
    let best = null;
    const candidatas = optimoSeed != null
      ? [optimoSeed]
      : bases.sort((a, b) => b.sc - a.sc).slice(0, K).map((x) => x.seed);
    const t0 = Date.now();
    const LIMITE_MS = opts.limiteMs ?? 4000; // guarda de tiempo dura
    for (const seed of candidatas) {
      const res = solveOnce(seed, true);
      const score = scoreDe(res);
      if (!best || score > best.score) best = { ...res, score };
      if (res.noColocadas.length === 0 && res.softViol === 0 && res.conflictosKids.length === 0) break;
      if (Date.now() - t0 > LIMITE_MS) break;
    }

    const { gridNino, ocupadoTer, kidsSlots, noColocadas, conflictosKids } = best;
    const conflictos = [...conflictosSigla, ...conflictosKids];
    const rndPost = mulberry32(semillaBase + 7777);

    // FASE 3: reuniones y sesiones con papás
    const reunionesEquipo = [];
    const reunionesPapas = [];
    const sesionesPapas = [];

    function tutoresDe(n) {
      const out = {};
      n.asignaciones.forEach((a) => {
        if (a.rol === 'TUTOR' && TUTORES_REUNION.includes(a.disciplina) && !out[a.disciplina]) out[a.disciplina] = a.sigla;
      });
      return out;
    }
    function franjaLibreParaTutores(siglas, franja, requeridos) {
      const ordenDias = shuffleInPlace(diasActivos.slice(), rndPost);
      for (const dia of ordenDias) {
        const slot = dia * F + franja;
        if (siglas.every((s) => ocupadoTer[s] && !ocupadoTer[s][slot] && disponibleEn(s, slot)) && siglas.length >= requeridos) return slot;
      }
      return -1;
    }

    intensivo.niños.forEach((n, ni) => {
      const tut = tutoresDe(n);
      const siglas = TUTORES_REUNION.map((d) => tut[d]).filter(Boolean);

      const franjasReunion = [reglas.reunion_equipo_franja, ...[...bloquesFijos].filter((f) => f !== reglas.reunion_equipo_franja)];
      let slotEq = -1;
      for (const fr of franjasReunion) { slotEq = franjaLibreParaTutores(siglas, fr, 2); if (slotEq >= 0) break; }
      if (slotEq >= 0) {
        siglas.forEach((s) => { ocupadoTer[s][slotEq] = 1; });
        reunionesEquipo.push({ ni, niño: n.nombre, slot: slotEq, tutores: siglas });
      } else conflictos.push({ tipo: 'reunion_equipo', mensaje: `Sin bloque común para reunión de equipo de ${n.nombre}` });

      if (semana === reglas.reunion_papas_semana && siglas.length >= 2) {
        const nb = reglas.reunion_papas_bloques || 2;
        const ordenDias = shuffleInPlace(diasActivos.slice(), rndPost);
        let puesta = false;
        for (const dia of ordenDias) {
          for (let f = 0; f + nb <= F && !puesta; f++) {
            const slotsBloque = []; let okB = true;
            for (let k = 0; k < nb; k++) {
              const fr = f + k;
              if (bloquesFijos.has(fr)) { okB = false; break; }
              const slot = dia * F + fr;
              if (!siglas.every((s) => !ocupadoTer[s][slot] && disponibleEn(s, slot))) { okB = false; break; }
              slotsBloque.push(slot);
            }
            if (okB) {
              slotsBloque.forEach((slot) => siglas.forEach((s) => { ocupadoTer[s][slot] = 1; }));
              reunionesPapas.push({ ni, niño: n.nombre, slots: slotsBloque, tutores: siglas });
              puesta = true;
            }
          }
          if (puesta) break;
        }
        if (!puesta) conflictos.push({ tipo: 'reunion_papas', mensaje: `Sem ${semana}: sin doble bloque para reunión con papás de ${n.nombre}`, nivel: 'ideal' });
      }

      n.asignaciones.filter((a) => a.rol === 'PAPAS').forEach((a) => {
        if (!ocupadoTer[a.sigla]) return;
        const cand = shuffleInPlace(Array.from({ length: totalSlots }, (_, k) => k), rndPost);
        for (const slot of cand) {
          if (esFijo(slot) || gridNino[ni][slot] || ocupadoTer[a.sigla][slot] || !disponibleEn(a.sigla, slot)) continue;
          ocupadoTer[a.sigla][slot] = 1;
          sesionesPapas.push({ ni, niño: n.nombre, sigla: a.sigla, slot });
          break;
        }
      });
    });

    noColocadas.forEach((d) => {
      conflictos.push({ tipo: 'sin_solucion', mensaje: `No hay slot disponible para ${d.niño} con ${d.sigla} (${d.disciplina}/${d.rol})`, niño: d.niño, sigla: d.sigla, disciplina: d.disciplina });
    });

    const ok = noColocadas.length === 0 && conflictosKids.length === 0 && conflictosSigla.length === 0;

    return { ok, grid: gridNino, sesionesPlanificadas, conflictos, kidsSlots, reunionesEquipo, reunionesPapas, sesionesPapas };
  }

  function generar(intensivo, catalogo, opts = {}) {
    // El intensivo repite la MISMA base semanal (así lo arma Casa Nogal a mano);
    // lo único propio de una semana es la reunión con papás (una sola semana).
    // Por eso resolvemos el grid UNA vez (caro) y lo reutilizamos en las 6 semanas
    // (barato), en vez de re-resolver cada semana. Mismas keys de salida que antes.
    const reglas = { ...DEFAULTS, ...(intensivo.reglas || {}), ...(opts.reglas || {}) };
    const semanaPapas = reglas.reunion_papas_semana || 2;
    const base = generarSemana(intensivo, catalogo, {
      semilla: opts.semilla ?? 42,
      semana: semanaPapas, // resolvemos con la reunión de papás incluida
      salasCapacidad: opts.salasCapacidad,
      disponibilidad: opts.disponibilidad,
      reglas: opts.reglas,
      restarts: opts.restarts,
      limiteMs: opts.limiteMs,
    });
    const semanas = [];
    let semanaFallo = null;
    for (let s = 0; s < intensivo.semanas; s++) {
      const esPapas = (s + 1) === semanaPapas;
      // clon superficial reutilizando el mismo grid; sólo la semana de papás
      // conserva reunionesPapas (las demás no la tienen).
      const r = { ...base, reunionesPapas: esPapas ? base.reunionesPapas : [] };
      semanas.push(r);
      if (!r.ok && semanaFallo == null) semanaFallo = s + 1;
    }
    if (semanaFallo == null) return { ok: true, semanas };
    return { ok: false, semanas, conflictos: base.conflictos, semanaFallo };
  }

  return { generar, generarSemana };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Scheduler;
} else if (typeof window !== 'undefined') {
  window.Scheduler = Scheduler;
}
