// Motor de scheduling para programa intensivo. Sin DOM, sin globales.
// Genera 1 semana del horario. Las 6 semanas del intensivo se generan iterando.
//
// Inputs:
//   intensivo = { id, fecha_inicio, semanas, niños: [{ nombre, asignaciones: [{disciplina, rol, sigla, sesiones}] }] }
//   catalogo  = { franjas: [...], dias: [...], terapeutas: { SIGLA: {nombre, disciplina, sala} } }
//   opts      = { semilla?: int }   // determinismo opcional
//
// Output:
//   { ok, semanas: [ { grid: { [niñoIdx]: [slotIdx]: sigla }, sesionesPlanificadas: int } ],
//     conflictos: [ { tipo, mensaje, ... } ] }

const Scheduler = (() => {
  const SOFT_MAX_PER_DAY_DEFAULT = (totalSes, dias) => Math.max(1, Math.ceil(totalSes / dias));

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
    const rnd = mulberry32(opts.semilla ?? 42);
    // Capacidades de sala; sala sin entrada → capacidad 1 por defecto
    const salasCap = opts.salasCapacidad || {};
    const capDe = (sala) => (sala in salasCap ? salasCap[sala] : 1);
    // Disponibilidad por terapeuta. Si no hay entrada → disponible siempre.
    const disponibilidad = opts.disponibilidad || {};
    function disponibleEn(sigla, slot) {
      const disp = disponibilidad[sigla];
      if (!disp) return true;
      const dia = dias[Math.floor(slot / F)];
      const f = slot % F;
      return !!(disp[dia] && disp[dia][f]);
    }

    // Estado
    // gridNino[ni][slot] = sigla | null
    const gridNino = Array.from({ length: N }, () => new Array(totalSlots).fill(null));
    // ocupadoTer[sigla] = Uint8Array(totalSlots) — 1 si ocupado
    const ocupadoTer = {};
    Object.keys(catalogo.terapeutas).forEach((s) => {
      ocupadoTer[s] = new Uint8Array(totalSlots);
    });
    // ocupadoSala[sala][slot] = count actual
    const ocupadoSala = {};
    const salasUsadas = new Set(Object.values(catalogo.terapeutas).map((t) => t.sala));
    salasUsadas.forEach((s) => { ocupadoSala[s] = new Uint8Array(totalSlots); });

    const conflictos = [];

    // === Fase 0: sesiones grupales KIDS ===
    // Cada niño con kids_semanal > 0 participa de N sesiones grupales con GP en sala KIDS.
    // Todos los niños del intensivo comparten el mismo slot. Solo cuenta 1 ocupación de GP y 1 de sala.
    const KIDS_TER = opts.kidsTerapeuta || "GP";
    const kidsCount = Math.max(...intensivo.niños.map((n) => n.kids_semanal || 0));
    const kidsSlotsElegidos = [];
    if (kidsCount > 0 && ocupadoTer[KIDS_TER]) {
      const candidatos = shuffle(Array.from({ length: totalSlots }, (_, k) => k), rnd);
      const salaKids = catalogo.terapeutas[KIDS_TER]?.sala;
      for (const slot of candidatos) {
        if (kidsSlotsElegidos.length >= kidsCount) break;
        if (!disponibleEn(KIDS_TER, slot)) continue;
        if (ocupadoTer[KIDS_TER][slot]) continue;
        // Limitar a 1 KIDS por día (no apilar todas en lunes)
        const dia = Math.floor(slot / F);
        if (kidsSlotsElegidos.some((s) => Math.floor(s / F) === dia)) continue;
        if (salaKids && ocupadoSala[salaKids] && ocupadoSala[salaKids][slot] >= capDe(salaKids)) continue;
        // Tomar para los 6 niños (que tengan kids_semanal > 0)
        ocupadoTer[KIDS_TER][slot] = 1;
        if (salaKids && ocupadoSala[salaKids]) ocupadoSala[salaKids][slot]++;
        intensivo.niños.forEach((n, ni) => {
          if ((n.kids_semanal || 0) > 0) {
            gridNino[ni][slot] = KIDS_TER;
          }
        });
        kidsSlotsElegidos.push(slot);
      }
      if (kidsSlotsElegidos.length < kidsCount) {
        conflictos.push({
          tipo: "kids_insuficientes",
          mensaje: `Solo se pudieron asignar ${kidsSlotsElegidos.length}/${kidsCount} sesiones KIDS grupales`,
        });
      }
    }

    // === Fase 1: demandas individuales ===
    // Cada demanda: { ni, sigla, disciplina, rol, maxPorDia }
    const demandas = [];
    intensivo.niños.forEach((n, ni) => {
      n.asignaciones.forEach((a) => {
        // Excluir asignaciones que no van al horario propiamente (PAPÁS)
        if (a.rol === "PAPAS") return;
        const max = SOFT_MAX_PER_DAY_DEFAULT(a.sesiones, D);
        for (let k = 0; k < a.sesiones; k++) {
          demandas.push({
            ni,
            niño: n.nombre,
            sigla: a.sigla,
            disciplina: a.disciplina,
            rol: a.rol,
            maxPorDia: max,
          });
        }
      });
    });

    // Heurística: most-constrained-first.
    // Ordenar por (carga del terapeuta DESC, niño con más sesiones DESC).
    const cargaTer = {};
    demandas.forEach((d) => { cargaTer[d.sigla] = (cargaTer[d.sigla] || 0) + 1; });
    const cargaNino = {};
    demandas.forEach((d) => { cargaNino[d.ni] = (cargaNino[d.ni] || 0) + 1; });

    demandas.sort((a, b) => {
      const dt = cargaTer[b.sigla] - cargaTer[a.sigla];
      if (dt) return dt;
      return cargaNino[b.ni] - cargaNino[a.ni];
    });

    // Contadores por día niño-terapeuta para enforcement de maxPorDia
    // key: `${ni}_${sigla}_${diaIdx}` → count
    const porDia = new Map();

    function intentar(i) {
      if (i >= demandas.length) return true;
      const d = demandas[i];

      // Verificar que la sigla exista en el catálogo
      if (!ocupadoTer[d.sigla]) {
        conflictos.push({
          tipo: "sigla_desconocida",
          mensaje: `Terapeuta "${d.sigla}" no está en el catálogo (niño ${d.niño}, ${d.disciplina})`,
          niño: d.niño,
          sigla: d.sigla,
        });
        return false;
      }

      // Generar lista de slots candidatos, shuffleados (determinismo via rnd)
      const slots = shuffle(Array.from({ length: totalSlots }, (_, k) => k), rnd);

      const sala = catalogo.terapeutas[d.sigla]?.sala;
      const salaCap = capDe(sala);

      for (const slot of slots) {
        const dia = Math.floor(slot / F);
        // C5: terapeuta disponible en esta franja-día
        if (!disponibleEn(d.sigla, slot)) continue;
        // C1: terapeuta libre
        if (ocupadoTer[d.sigla][slot]) continue;
        // C2: niño libre en este slot
        if (gridNino[d.ni][slot]) continue;
        // C4: capacidad de sala
        if (sala && ocupadoSala[sala] && ocupadoSala[sala][slot] >= salaCap) continue;
        // B1: máx por día niño-terapeuta
        const key = `${d.ni}_${d.sigla}_${dia}`;
        if ((porDia.get(key) || 0) >= d.maxPorDia) continue;

        // Tomar
        gridNino[d.ni][slot] = d.sigla;
        ocupadoTer[d.sigla][slot] = 1;
        if (sala && ocupadoSala[sala]) ocupadoSala[sala][slot]++;
        porDia.set(key, (porDia.get(key) || 0) + 1);

        if (intentar(i + 1)) return true;

        // Backtrack
        gridNino[d.ni][slot] = null;
        ocupadoTer[d.sigla][slot] = 0;
        if (sala && ocupadoSala[sala]) ocupadoSala[sala][slot]--;
        porDia.set(key, porDia.get(key) - 1);
      }

      // No se pudo colocar
      conflictos.push({
        tipo: "sin_solucion",
        mensaje: `No hay slot disponible para ${d.niño} con ${d.sigla} (${d.disciplina}/${d.rol})`,
        niño: d.niño,
        sigla: d.sigla,
        disciplina: d.disciplina,
      });
      return false;
    }

    const ok = intentar(0);

    return {
      ok,
      grid: gridNino,
      sesionesPlanificadas: demandas.length,
      conflictos,
    };
  }

  function generar(intensivo, catalogo, opts = {}) {
    const semanas = [];
    for (let s = 0; s < intensivo.semanas; s++) {
      const r = generarSemana(intensivo, catalogo, {
        semilla: (opts.semilla ?? 42) + s,
        salasCapacidad: opts.salasCapacidad,
        disponibilidad: opts.disponibilidad,
      });
      semanas.push(r);
      if (!r.ok) {
        return { ok: false, semanas, conflictos: r.conflictos, semanaFallo: s + 1 };
      }
    }
    return { ok: true, semanas };
  }

  return { generar, generarSemana };
})();

// Export para Node (test runner) y exposición global en browser
if (typeof module !== "undefined" && module.exports) {
  module.exports = Scheduler;
} else if (typeof window !== "undefined") {
  window.Scheduler = Scheduler;
}
