// Motor de scheduling para programa intensivo. Sin DOM, sin globales.
// Genera 1 semana del horario. Las 6 semanas del intensivo se generan iterando.
//
// Inputs:
//   intensivo = { id, fecha_inicio, semanas, reglas?, niños: [{ nombre, kids_semanal, kids_grupo,
//                  asignaciones: [{disciplina, rol, sigla, sesiones}] }] }
//   catalogo  = { franjas: [...], dias: [...], terapeutas: { SIGLA: {nombre, disciplina, sala} } }
//   opts      = { semilla?, salasCapacidad?, disponibilidad?, reglas? }
//
// Output:
//   { ok, grid: [niñoIdx][slotIdx]=sigla|null, sesionesPlanificadas, conflictos,
//     kidsSlots: [{grupo, slot, niños:[ni]}],
//     reunionesEquipo: [{ni, niño, slot, tutores:[sigla]}],
//     reunionesPapas:  [{ni, niño, slots:[..], tutores:[sigla]}],
//     sesionesPapas:   [{ni, niño, sigla, slot}] }
//
// Reglas (confirmadas con Trini, reunión 18-jun):
//   - TUTOR y COT son sesiones SEPARADAS (un niño puede tener 7 TO/semana).
//   - KIDS: nunca en la primera hora; en módulos centrales; grupos de 2-3 niños.
//   - 1 sesión de cada disciplina por día (ideal); si hay más sesiones que días,
//     los días con 2 de la misma disciplina quedan en módulos NO contiguos.
//   - Máx 5 sesiones por terapeuta por día.
//   - Bloques fijos (08:00-08:35 y 12:30-13:00): sin atención; reunión de equipo.
//   - Reunión de equipo: 1/semana por niño, con TO+FONO+COG, en bloque fijo.
//   - Reunión con papás: semana 2, doble bloque, con TO+FONO+COG (ideal).
//   - Psicólogo-papás (rol PAPAS): fuera del horario del niño.

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
  const TUTORES_REUNION = ['TO', 'FONO', 'COG']; // disciplinas presentes en reuniones con papás/equipo

  // PRNG simple (mulberry32) para shuffles determinísticos
  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    const a = arr.slice();
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
    let rnd = mulberry32(opts.semilla ?? 42);
    const reglas = { ...DEFAULTS, ...(intensivo.reglas || {}), ...(opts.reglas || {}) };
    const semana = opts.semana ?? 1; // 1-based, para la reunión de papás

    const salasCap = opts.salasCapacidad || {};
    const capDe = (sala) => (sala in salasCap ? salasCap[sala] : 1);
    const disponibilidad = opts.disponibilidad || {};
    const bloquesFijos = new Set(reglas.bloques_fijos || []);
    const esFijo = (slot) => bloquesFijos.has(slot % F);

    function disponibleEn(sigla, slot) {
      const disp = disponibilidad[sigla];
      if (!disp) return true;
      const dia = dias[Math.floor(slot / F)];
      const f = slot % F;
      return !!(disp[dia] && disp[dia][f]);
    }

    // Estado
    const gridNino = Array.from({ length: N }, () => new Array(totalSlots).fill(null));
    const ocupadoTer = {};
    Object.keys(catalogo.terapeutas).forEach((s) => { ocupadoTer[s] = new Uint8Array(totalSlots); });
    const ocupadoSala = {};
    const salasUsadas = new Set(Object.values(catalogo.terapeutas).map((t) => t.sala));
    salasUsadas.forEach((s) => { ocupadoSala[s] = new Uint8Array(totalSlots); });

    const conflictos = [];

    // === Fase 0: sesiones grupales KIDS, por subgrupo ===
    // Cada grupo (kids_grupo) comparte slot; sala KIDS capacidad 1 → un grupo por slot.
    // Solo en módulos permitidos (kids_modulos), nunca la primera hora, 1 por día por grupo.
    const KIDS_TER = opts.kidsTerapeuta || 'GP';
    const kidsModulos = (reglas.kids_modulos || []).filter((f) => !bloquesFijos.has(f));
    const kidsSlots = [];
    const grupos = {};
    intensivo.niños.forEach((n, ni) => {
      if ((n.kids_semanal || 0) > 0) {
        const g = n.kids_grupo || 1;
        (grupos[g] = grupos[g] || []).push(ni);
      }
    });
    const salaKids = catalogo.terapeutas[KIDS_TER]?.sala;
    function colocarKids() {
     kidsSlots.length = 0;
     if (ocupadoTer[KIDS_TER]) {
      Object.keys(grupos).forEach((g) => {
        const nis = grupos[g];
        const need = Math.max(...nis.map((ni) => intensivo.niños[ni].kids_semanal || 0));
        // Hora de entrada del grupo: si los niños la fijaron, su sesión grupal va en esa franja.
        const hes = nis.map((ni) => intensivo.niños[ni].hora_entrada).filter((h) => h != null && !bloquesFijos.has(h));
        const heGrupo = hes.length ? hes[0] : null;
        const franjasOk = kidsModulos.slice();
        if (heGrupo != null && !franjasOk.includes(heGrupo)) franjasOk.push(heGrupo);
        const candidatos = shuffle(
          Array.from({ length: totalSlots }, (_, k) => k).filter((k) => franjasOk.includes(k % F)),
          rnd
        );
        // Priorizar los slots de la franja de entrada (la primera KIDS del grupo cae ahí).
        if (heGrupo != null) candidatos.sort((a, b) => ((a % F === heGrupo) ? 0 : 1) - ((b % F === heGrupo) ? 0 : 1));
        const elegidosDia = new Set();
        let puestos = 0;
        for (const slot of candidatos) {
          if (puestos >= need) break;
          const dia = Math.floor(slot / F);
          if (elegidosDia.has(dia)) continue;            // 1 kids/día por grupo
          if (!disponibleEn(KIDS_TER, slot)) continue;   // GP disponible en la franja
          if (ocupadoTer[KIDS_TER][slot]) continue;      // GP libre
          if (nis.some((ni) => gridNino[ni][slot])) continue; // niños del grupo libres
          if (salaKids && ocupadoSala[salaKids][slot] >= capDe(salaKids)) continue;
          ocupadoTer[KIDS_TER][slot] = 1;
          if (salaKids) ocupadoSala[salaKids][slot]++;
          nis.forEach((ni) => { gridNino[ni][slot] = KIDS_TER; });
          kidsSlots.push({ grupo: Number(g), slot, niños: nis.slice() });
          elegidosDia.add(dia);
          puestos++;
        }
        if (puestos < need) {
          conflictos.push({ tipo: 'kids_insuficientes', mensaje: `Grupo KIDS ${g}: ${puestos}/${need} sesiones` });
        }
      });
     }
    }

    // === Fase 1: demandas individuales ===
    const demandas = [];
    intensivo.niños.forEach((n, ni) => {
      n.asignaciones.forEach((a) => {
        if (a.rol === 'PAPAS') return; // las sesiones con papás se agendan aparte
        const max = Math.max(1, Math.ceil(a.sesiones / D));
        for (let k = 0; k < a.sesiones; k++) {
          demandas.push({ ni, niño: n.nombre, sigla: a.sigla, disciplina: a.disciplina, rol: a.rol, maxPorDia: max });
        }
      });
    });

    // Heurística most-constrained-first
    const cargaTer = {}; demandas.forEach((d) => { cargaTer[d.sigla] = (cargaTer[d.sigla] || 0) + 1; });
    const cargaNino = {}; demandas.forEach((d) => { cargaNino[d.ni] = (cargaNino[d.ni] || 0) + 1; });
    demandas.sort((a, b) => (cargaTer[b.sigla] - cargaTer[a.sigla]) || (cargaNino[b.ni] - cargaNino[a.ni]));

    const porDia = new Map();        // `${ni}_${sigla}_${dia}` → count (cap maxPorDia)
    const porTerDia = new Map();     // `${sigla}_${dia}` → count (cap max_por_terapeuta_dia)
    const discDia = new Map();       // `${ni}_${disc}_${dia}` → [franjas usadas]
    let maxNivel = -1, demandaFallo = null; // demanda más profunda que no se pudo colocar
    // Random-restart: si una semilla no converge en LIMITE_PASOS, se reintenta con otra.
    const ABORT = {};
    const LIMITE_PASOS = 120_000;
    let pasos = 0;

    function intentar(i) {
      if (++pasos > LIMITE_PASOS) throw ABORT;
      if (i >= demandas.length) return true;
      if (i > maxNivel) { maxNivel = i; demandaFallo = demandas[i]; }
      const d = demandas[i];
      if (!ocupadoTer[d.sigla]) {
        conflictos.push({ tipo: 'sigla_desconocida', mensaje: `Terapeuta "${d.sigla}" no está en el catálogo (niño ${d.niño}, ${d.disciplina})`, niño: d.niño, sigla: d.sigla });
        return false;
      }
      const slots = shuffle(Array.from({ length: totalSlots }, (_, k) => k), rnd);
      const sala = catalogo.terapeutas[d.sigla]?.sala;
      const salaCap = capDe(sala);

      for (const slot of slots) {
        if (esFijo(slot)) continue;                       // sin atención en bloques fijos
        const dia = Math.floor(slot / F);
        const f = slot % F;
        if (!disponibleEn(d.sigla, slot)) continue;       // disponibilidad terapeuta
        if (ocupadoTer[d.sigla][slot]) continue;          // terapeuta libre
        if (gridNino[d.ni][slot]) continue;               // niño libre
        if (sala && ocupadoSala[sala][slot] >= salaCap) continue; // capacidad sala
        const keyNT = `${d.ni}_${d.sigla}_${dia}`;
        if ((porDia.get(keyNT) || 0) >= d.maxPorDia) continue;    // máx por día niño-terapeuta
        const keyTD = `${d.sigla}_${dia}`;
        if ((porTerDia.get(keyTD) || 0) >= reglas.max_por_terapeuta_dia) continue; // máx 5/terapeuta/día
        const keyDD = `${d.ni}_${d.disciplina}_${dia}`;
        const usadas = discDia.get(keyDD) || [];
        if (usadas.length >= reglas.max_por_disciplina_dia) continue;           // máx disciplina/día
        if (reglas.disciplina_no_consecutiva && usadas.some((ff) => Math.abs(ff - f) === 1)) continue; // no contiguas

        // Tomar
        gridNino[d.ni][slot] = d.sigla;
        ocupadoTer[d.sigla][slot] = 1;
        if (sala) ocupadoSala[sala][slot]++;
        porDia.set(keyNT, (porDia.get(keyNT) || 0) + 1);
        porTerDia.set(keyTD, (porTerDia.get(keyTD) || 0) + 1);
        usadas.push(f); discDia.set(keyDD, usadas);

        if (intentar(i + 1)) return true;

        // Backtrack
        gridNino[d.ni][slot] = null;
        ocupadoTer[d.sigla][slot] = 0;
        if (sala) ocupadoSala[sala][slot]--;
        porDia.set(keyNT, porDia.get(keyNT) - 1);
        porTerDia.set(keyTD, porTerDia.get(keyTD) - 1);
        const posBT = usadas.lastIndexOf(f);
        if (posBT >= 0) usadas.splice(posBT, 1);
      }

      return false; // no acumular: el backtracking retrocede aquí millones de veces
    }

    function resetEstado() {
      gridNino.forEach((row) => row.fill(null));
      Object.values(ocupadoTer).forEach((a) => a.fill(0));
      Object.values(ocupadoSala).forEach((a) => a.fill(0));
      conflictos.length = 0;
      porDia.clear(); porTerDia.clear(); discDia.clear();
      maxNivel = -1; demandaFallo = null; pasos = 0;
    }
    // Intenta resolver con varias semillas; con sábado sin disponibilidad el espacio
    // es ajustado y una semilla puede atascarse: el restart la salva.
    const semillaBase = opts.semilla ?? 42;
    let ok = false;
    for (let r = 0; r < 60 && !ok; r++) {
      resetEstado();
      rnd = mulberry32(semillaBase + r * 101);
      colocarKids();
      try { ok = intentar(0); } catch (e) { if (e !== ABORT) throw e; ok = false; }
    }
    if (!ok && demandaFallo) {
      const d = demandaFallo;
      conflictos.push({ tipo: 'sin_solucion', mensaje: `No hay slot disponible para ${d.niño} con ${d.sigla} (${d.disciplina}/${d.rol})`, niño: d.niño, sigla: d.sigla, disciplina: d.disciplina });
    }

    // === Reubicación lun-vie ===
    // Casa Nogal atiende solo lun-vie. El motor reparte en 6 días (más estable);
    // aquí movemos lo que quedó en sábado (último día) a huecos de lun-vie que
    // cumplan las mismas reglas. Con la holgura del horario, el sábado queda vacío.
    if (ok) {
      const ultimoDia = D - 1;
      const maxPorDiaDe = (ni, sigla) => {
        const n = intensivo.niños[ni];
        const a = (n.asignaciones || []).find((x) => x.sigla === sigla);
        return a ? Math.max(1, Math.ceil(a.sesiones / D)) : reglas.max_por_terapeuta_dia;
      };
      const slotsSemana = shuffle(
        Array.from({ length: totalSlots }, (_, k) => k).filter((k) => Math.floor(k / F) !== ultimoDia),
        rnd
      );
      for (let ni = 0; ni < N; ni++) {
        for (let f = 0; f < F; f++) {
          const slotSab = ultimoDia * F + f;
          const sigla = gridNino[ni][slotSab];
          if (!sigla) continue;
          // KIDS grupal se mueve aparte (afecta a varios niños): lo dejamos al motor
          if (kidsSlots.some((k) => k.slot === slotSab)) continue;
          const disc = catalogo.terapeutas[sigla]?.disciplina;
          const sala = catalogo.terapeutas[sigla]?.sala;
          const maxPD = maxPorDiaDe(ni, sigla);
          for (const dest of slotsSemana) {
            if (esFijo(dest)) continue;
            const dia = Math.floor(dest / F);
            const ff = dest % F;
            if (!disponibleEn(sigla, dest)) continue;
            if (ocupadoTer[sigla][dest]) continue;
            if (gridNino[ni][dest]) continue;
            if (sala && ocupadoSala[sala][dest] >= capDe(sala)) continue;
            const keyNT = `${ni}_${sigla}_${dia}`;
            if ((porDia.get(keyNT) || 0) >= maxPD) continue;
            const keyTD = `${sigla}_${dia}`;
            if ((porTerDia.get(keyTD) || 0) >= reglas.max_por_terapeuta_dia) continue;
            const keyDD = `${ni}_${disc}_${dia}`;
            const usadas = discDia.get(keyDD) || [];
            if (usadas.length >= reglas.max_por_disciplina_dia) continue;
            if (reglas.disciplina_no_consecutiva && usadas.some((x) => Math.abs(x - ff) === 1)) continue;
            // mover sab → dest
            gridNino[ni][slotSab] = null; ocupadoTer[sigla][slotSab] = 0;
            if (sala) ocupadoSala[sala][slotSab]--;
            gridNino[ni][dest] = sigla; ocupadoTer[sigla][dest] = 1;
            if (sala) ocupadoSala[sala][dest]++;
            porDia.set(keyNT, (porDia.get(keyNT) || 0) + 1);
            porTerDia.set(keyTD, (porTerDia.get(keyTD) || 0) + 1);
            usadas.push(ff); discDia.set(keyDD, usadas);
            break;
          }
        }
      }
    }

    // === Post-fases: reuniones y sesiones con papás (no compiten por el grid de atención) ===
    const reunionesEquipo = [];
    const reunionesPapas = [];
    const sesionesPapas = [];

    // Tutores TO/FONO/COG por niño (rol TUTOR)
    function tutoresDe(n) {
      const out = {};
      n.asignaciones.forEach((a) => {
        if (a.rol === 'TUTOR' && TUTORES_REUNION.includes(a.disciplina) && !out[a.disciplina]) out[a.disciplina] = a.sigla;
      });
      return out;
    }
    function franjaLibreParaTutores(siglas, franja, requeridos) {
      // busca un día donde todos los 'siglas' estén libres y disponibles en 'franja'
      const ordenDias = shuffle(Array.from({ length: D }, (_, d) => d), rnd);
      for (const dia of ordenDias) {
        const slot = dia * F + franja;
        const todos = siglas.every((s) => ocupadoTer[s] && !ocupadoTer[s][slot] && disponibleEn(s, slot));
        if (todos && siglas.length >= requeridos) return slot;
      }
      return -1;
    }

    if (ok) {
      intensivo.niños.forEach((n, ni) => {
        const tut = tutoresDe(n);
        const siglas = TUTORES_REUNION.map((d) => tut[d]).filter(Boolean);

        // Reunión de equipo: cualquier bloque fijo, día con los tutores libres
        // (preferir reunion_equipo_franja, si no, probar las demás franjas fijas)
        const franjasReunion = [reglas.reunion_equipo_franja, ...[...bloquesFijos].filter((f) => f !== reglas.reunion_equipo_franja)];
        let slotEq = -1;
        for (const fr of franjasReunion) { slotEq = franjaLibreParaTutores(siglas, fr, 2); if (slotEq >= 0) break; }
        if (slotEq >= 0) {
          siglas.forEach((s) => { ocupadoTer[s][slotEq] = 1; });
          reunionesEquipo.push({ ni, niño: n.nombre, slot: slotEq, tutores: siglas });
        } else {
          conflictos.push({ tipo: 'reunion_equipo', mensaje: `Sin bloque común para reunión de equipo de ${n.nombre}` });
        }

        // Reunión con papás: solo en la semana indicada, doble bloque contiguo (ideal)
        if (semana === reglas.reunion_papas_semana && siglas.length >= 2) {
          const nb = reglas.reunion_papas_bloques || 2;
          const ordenDias = shuffle(Array.from({ length: D }, (_, d) => d), rnd);
          let puesta = false;
          for (const dia of ordenDias) {
            // buscar inicio de bloque contiguo de nb módulos (no fijos) con tutores libres
            for (let f = 0; f + nb <= F && !puesta; f++) {
              const slotsBloque = [];
              let okBloque = true;
              for (let k = 0; k < nb; k++) {
                const fr = f + k;
                if (bloquesFijos.has(fr)) { okBloque = false; break; }
                const slot = dia * F + fr;
                if (!siglas.every((s) => !ocupadoTer[s][slot] && disponibleEn(s, slot))) { okBloque = false; break; }
                slotsBloque.push(slot);
              }
              if (okBloque) {
                slotsBloque.forEach((slot) => siglas.forEach((s) => { ocupadoTer[s][slot] = 1; }));
                reunionesPapas.push({ ni, niño: n.nombre, slots: slotsBloque, tutores: siglas });
                puesta = true;
              }
            }
            if (puesta) break;
          }
          if (!puesta) conflictos.push({ tipo: 'reunion_papas', mensaje: `Sem ${semana}: sin doble bloque para reunión con papás de ${n.nombre}`, nivel: 'ideal' });
        }

        // Psicólogo-papás (rol PAPAS): fuera del horario del niño
        n.asignaciones.filter((a) => a.rol === 'PAPAS').forEach((a) => {
          if (!ocupadoTer[a.sigla]) return;
          const candidatos = shuffle(Array.from({ length: totalSlots }, (_, k) => k), rnd);
          for (const slot of candidatos) {
            if (esFijo(slot)) continue;
            if (gridNino[ni][slot]) continue;          // fuera del horario del niño
            if (ocupadoTer[a.sigla][slot]) continue;   // psicóloga libre
            if (!disponibleEn(a.sigla, slot)) continue;
            ocupadoTer[a.sigla][slot] = 1;
            sesionesPapas.push({ ni, niño: n.nombre, sigla: a.sigla, slot });
            break;
          }
        });
      });
    }

    return { ok, grid: gridNino, sesionesPlanificadas: demandas.length, conflictos, kidsSlots, reunionesEquipo, reunionesPapas, sesionesPapas };
  }

  function generar(intensivo, catalogo, opts = {}) {
    const semanas = [];
    for (let s = 0; s < intensivo.semanas; s++) {
      const r = generarSemana(intensivo, catalogo, {
        semilla: (opts.semilla ?? 42) + s,
        semana: s + 1,
        salasCapacidad: opts.salasCapacidad,
        disponibilidad: opts.disponibilidad,
        reglas: opts.reglas,
      });
      semanas.push(r);
      if (!r.ok) return { ok: false, semanas, conflictos: r.conflictos, semanaFallo: s + 1 };
    }
    return { ok: true, semanas };
  }

  return { generar, generarSemana };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Scheduler;
} else if (typeof window !== 'undefined') {
  window.Scheduler = Scheduler;
}
