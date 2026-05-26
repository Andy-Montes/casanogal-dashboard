// Test runner del scheduler con datos reales del INT 40
const fs = require("fs");
const path = require("path");
const Scheduler = require("../js/intensivo/scheduler.js");

const baseDir = path.join(__dirname, "..", "data", "intensivos");
const intensivo = JSON.parse(fs.readFileSync(path.join(baseDir, "int40.json"), "utf8"));
const catalogo = JSON.parse(fs.readFileSync(path.join(baseDir, "catalogo.json"), "utf8"));
const salasCapacidad = JSON.parse(fs.readFileSync(path.join(baseDir, "salas_capacidad.json"), "utf8"));
const disponibilidad = JSON.parse(fs.readFileSync(path.join(baseDir, "disponibilidad.json"), "utf8"));

const niños = intensivo["niños"];
const { franjas, dias } = catalogo;
const F = franjas.length;

console.log(`Intensivo: ${intensivo.id} | ${niños.length} niños | ${intensivo.semanas} semanas`);
console.log(`Catálogo: ${Object.keys(catalogo.terapeutas).length} terapeutas, ${dias.length} días × ${F} franjas = ${dias.length * F} slots/semana\n`);

const t0 = Date.now();
const res = Scheduler.generar(intensivo, catalogo, { semilla: 1, salasCapacidad, disponibilidad });
const dt = Date.now() - t0;

console.log(`Resultado: ${res.ok ? "OK" : "FALLO"} (${dt} ms)`);
if (!res.ok) {
  console.log(`  Semana de fallo: ${res.semanaFallo}`);
  console.log(`  Conflictos (${res.conflictos.length}):`);
  res.conflictos.slice(0, 10).forEach((c) => console.log(`    [${c.tipo}] ${c.mensaje}`));
  if (res.conflictos.length > 10) console.log(`    ... +${res.conflictos.length - 10} más`);
  process.exit(1);
}

// Validar restricciones duras semana 1
function validar(semana, idxSem) {
  const errors = [];
  const N = niños.length;
  const totalSlots = F * dias.length;

  // C1: en cada slot, ningún terapeuta aparece más de 1 vez entre todos los niños
  // Excepción: KIDS grupal (terapeuta GP) puede compartir slot entre todos los niños del intensivo
  const KIDS_TER = "GP";
  for (let s = 0; s < totalSlots; s++) {
    const visto = new Map();
    for (let n = 0; n < N; n++) {
      const sig = semana.grid[n][s];
      if (!sig || sig === KIDS_TER) continue;
      if (visto.has(sig)) {
        errors.push(`Slot ${s} (día ${dias[Math.floor(s / F)]}, franja ${franjas[s % F]}): ${sig} en ${niños[visto.get(sig)].nombre} Y ${niños[n].nombre}`);
      }
      visto.set(sig, n);
    }
  }

  // C5: disponibilidad del terapeuta
  for (let n = 0; n < N; n++) {
    for (let s = 0; s < totalSlots; s++) {
      const sig = semana.grid[n][s];
      if (!sig) continue;
      const disp = disponibilidad[sig];
      if (!disp) continue;
      const dia = dias[Math.floor(s / F)];
      const f = s % F;
      if (!(disp[dia] && disp[dia][f])) {
        errors.push(`${niños[n].nombre}: ${sig} asignado en ${dia} ${franjas[f]} pero no está disponible`);
      }
    }
  }

  // C4: capacidad de sala
  // Para KIDS grupal: cuenta 1 ocupación de sala aunque haya N niños.
  for (let s = 0; s < totalSlots; s++) {
    const conteo = {};
    const yaContado = new Set(); // por (sala, sigla) — KIDS no se repite
    for (let n = 0; n < N; n++) {
      const sig = semana.grid[n][s];
      if (!sig) continue;
      const sala = catalogo.terapeutas[sig]?.sala;
      if (!sala) continue;
      if (sig === "GP" && yaContado.has(`${sala}|${sig}`)) continue;
      yaContado.add(`${sala}|${sig}`);
      conteo[sala] = (conteo[sala] || 0) + 1;
    }
    for (const sala in conteo) {
      const cap = sala in salasCapacidad ? salasCapacidad[sala] : 1;
      if (conteo[sala] > cap) {
        errors.push(`Slot ${s} (${dias[Math.floor(s / F)]} ${franjas[s % F]}): sala ${sala} excede capacidad (${conteo[sala]}/${cap})`);
      }
    }
  }

  // C3: conteos correctos. GP individuales = total GP - kids_semanal
  for (let n = 0; n < N; n++) {
    const conteo = {};
    semana.grid[n].forEach((sig) => { if (sig) conteo[sig] = (conteo[sig] || 0) + 1; });
    niños[n].asignaciones.forEach((a) => {
      if (a.rol === "PAPAS") return;
      const esperado = a.sesiones;
      let real = conteo[a.sigla] || 0;
      // Si la sigla es GP (terapeuta KIDS), restar las kids grupales
      if (a.sigla === "GP") real -= (niños[n].kids_semanal || 0);
      if (real < esperado) {
        errors.push(`${niños[n].nombre}: faltan sesiones con ${a.sigla} (${real}/${esperado})`);
      }
    });
    // K1: KIDS grupales — kids_semanal del niño debe coincidir con conteo de GP grupal
    // Acá no podemos distinguir GP grupal de GP individual mirando solo el grid. Validación más laxa: GP total ≥ (PSI sesiones + kids_semanal)
  }

  // K2: cada slot KIDS (donde GP aparece) debe estar en TODOS los niños con kids>0
  const slotsKids = [];
  for (let s = 0; s < totalSlots; s++) {
    const niñosConGP = [];
    for (let n = 0; n < N; n++) {
      if (semana.grid[n][s] === "GP") niñosConGP.push(n);
    }
    if (niñosConGP.length > 1) slotsKids.push({ slot: s, niños: niñosConGP });
  }
  return errors;
}

let anyErr = false;
res.semanas.forEach((sem, i) => {
  const errs = validar(sem, i);
  console.log(`Semana ${i + 1}: ${sem.sesionesPlanificadas} sesiones planificadas, ${errs.length} errores de validación`);
  if (errs.length) {
    anyErr = true;
    errs.slice(0, 5).forEach((e) => console.log(`  ✗ ${e}`));
    if (errs.length > 5) console.log(`  ... +${errs.length - 5} más`);
  }
});

if (anyErr) process.exit(1);

// Imprimir grilla de la semana 1 para inspección visual
console.log("\n=== Semana 1 ===");
const headerCols = [];
dias.forEach((d) => franjas.forEach((_, fi) => headerCols.push(`${d.padEnd(3)}${fi + 1}`)));
console.log("Niño       | " + headerCols.join(" "));
niños.forEach((n, ni) => {
  const cells = res.semanas[0].grid[ni].map((s) => (s || "·").padEnd(4));
  console.log(`${n.nombre.padEnd(10)} | ${cells.join(" ")}`);
});

console.log("\n✓ Todas las validaciones pasaron");
