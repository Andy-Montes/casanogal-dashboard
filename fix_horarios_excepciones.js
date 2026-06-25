// Suaviza la agenda de terapeutas con excepción de salida temprana (ej. Pamela Tapia
// TER-03 "Sale a las 12:00"). ENFOQUE FLEXIBLE: los datos de Trini son ejemplos, no
// reglas duras confirmadas, así que NO se elimina nada ni se asume la excepción como ley.
//   - Sesiones de ATENCIÓN que caen después de la salida se REUBICAN a un hueco de su
//     jornada de mañana SOLO si hay espacio natural (sin topar al terapeuta).
//   - Lo que no entra se DEJA tal cual (flexibilidad: se definirá con disponibilidad real).
//   - Las reuniones de equipo NO se tocan.
// Idempotente. No cambia el total de sesiones (solo reubica).
const fs = require('fs');
const file = require('path').join(__dirname, 'data.json');
const d = JSON.parse(fs.readFileSync(file, 'utf8'));

const ordenDe = {}, bloqueObj = {};
d.bloques_horarios.forEach(b => { ordenDe[b.id_bloque] = b.orden; bloqueObj[b.id_bloque] = b; });
const esReunion = s => s.tipo_actividad === 'Reunión de equipo';

let reubicadas = 0, sinHueco = 0;

d.terapeutas.forEach(t => {
  const exc = (t.excepciones || []).filter(e => e.bloques_indisponibles && e.bloques_indisponibles.length);
  if (!exc.length) return;
  const prohibidos = new Set();
  exc.forEach(e => {
    e.bloques_indisponibles.forEach(b => prohibidos.add(b));
    if (/sale/i.test((e.detalle || '') + (e.concepto || ''))) {
      const maxOrd = Math.max(...e.bloques_indisponibles.map(b => ordenDe[b]));
      d.bloques_horarios.forEach(bb => { if (bb.orden > maxOrd) prohibidos.add(bb.id_bloque); });
    }
  });

  d.sesiones.forEach(s => {
    if (s.id_terapeuta !== t.id_terapeuta || !prohibidos.has(s.id_bloque)) return;
    if (esReunion(s)) return; // las reuniones no se tocan
    const disp = (t.disponibilidad_bloques && t.disponibilidad_bloques[s.dia_semana]) || [];
    const ocupTer = new Set(d.sesiones.filter(o => o !== s && o.id_terapeuta === t.id_terapeuta && o.fecha === s.fecha).map(o => o.id_bloque));
    const destino = disp
      .filter(b => !prohibidos.has(b) && !ocupTer.has(b))
      .sort((a, b) => ordenDe[a] - ordenDe[b])[0];
    if (destino) {
      const blq = bloqueObj[destino];
      s.id_bloque = destino;
      if (blq) { s.hora_inicio = blq.hora_inicio; s.hora_fin = blq.hora_fin; }
      reubicadas++;
    } else {
      sinHueco++; // se deja tal cual (flexible)
    }
  });
});

fs.writeFileSync(file, JSON.stringify(d, null, 2));
console.log('Agenda suavizada (enfoque flexible, sin eliminar):');
console.log(`  Atención reubicada a la mañana: ${reubicadas}`);
console.log(`  Atención que se dejó (sin hueco ese día): ${sinHueco}`);
console.log(`  Total sesiones (sin cambios): ${d.sesiones.length}`);

// Reporte de cuántas quedan después de la salida (para transparencia, no es error)
let quedan = 0;
d.terapeutas.forEach(t => {
  const exc = (t.excepciones || []).filter(e => e.bloques_indisponibles && e.bloques_indisponibles.length);
  if (!exc.length) return;
  const prohibidos = new Set();
  exc.forEach(e => {
    e.bloques_indisponibles.forEach(b => prohibidos.add(b));
    if (/sale/i.test((e.detalle || '') + (e.concepto || ''))) {
      const maxOrd = Math.max(...e.bloques_indisponibles.map(b => ordenDe[b]));
      d.bloques_horarios.forEach(bb => { if (bb.orden > maxOrd) prohibidos.add(bb.id_bloque); });
    }
  });
  quedan += d.sesiones.filter(s => s.id_terapeuta === t.id_terapeuta && prohibidos.has(s.id_bloque)).length;
});
console.log(`  Sesiones que aún quedan tras la salida (se definirán con la disponibilidad real): ${quedan}`);
