// Feedback Trini 2026-06-24: el bloque de las 8:00 (BLQ-01) es SOLO reunión de equipo;
// no se atienden niños ahí. Saca las sesiones clínicas de niños de BLQ-01 y las reubica
// al bloque libre más temprano del mismo terapeuta ese día (sin topar al terapeuta).
// Co-terapia (niño con 2 terapeutas en un bloque) es válida, así que solo se evita el
// tope del mismo terapeuta; entre candidatos se prefiere el bloque donde el niño tampoco
// tenga ya sesión (para no inflar co-terapias nuevas).
// Idempotente: si BLQ-01 ya no tiene sesiones clínicas, no hace nada.
const fs = require('fs');
const file = require('path').join(__dirname, 'data.json');
const d = JSON.parse(fs.readFileSync(file, 'utf8'));

const ordenDe = {};
d.bloques_horarios.forEach(b => { ordenDe[b.id_bloque] = b.orden; });
const bloqueObj = id => d.bloques_horarios.find(b => b.id_bloque === id);

// BLQ-08 (12:30-13:00) es bloque de atención (no reunión). Habilitarlo en la
// disponibilidad de cada terapeuta/día que ya trabaja hasta BLQ-07: extiende la
// jornada de mañana y da capacidad real para reubicar. Resuelve además la
// incoherencia de que nadie tuviera BLQ-08 disponible.
const blq08 = bloqueObj('BLQ-08');
if (blq08) blq08.es_reunion_equipo = false;
let dispBLQ08 = 0;
d.terapeutas.forEach(t => {
  const disp = t.disponibilidad_bloques || {};
  Object.keys(disp).forEach(dia => {
    const arr = disp[dia];
    if (Array.isArray(arr) && arr.includes('BLQ-07') && !arr.includes('BLQ-08')) { arr.push('BLQ-08'); dispBLQ08++; }
  });
});

// Bloques de atención candidatos = todos menos BLQ-01, ordenados por hora.
const candidatosBase = d.bloques_horarios
  .filter(b => b.id_bloque !== 'BLQ-01')
  .sort((a, b) => a.orden - b.orden)
  .map(b => b.id_bloque);

const esReunion = s => s.tipo_actividad === 'Reunión de equipo';
const clinicas01 = d.sesiones.filter(s => s.id_bloque === 'BLQ-01' && s.id_nino && !esReunion(s));

let movidas = 0, sinHueco = 0;
const huerfanas = [];

clinicas01.forEach(s => {
  const t = d.terapeutas.find(x => x.id_terapeuta === s.id_terapeuta);
  const disp = (t && t.disponibilidad_bloques && t.disponibilidad_bloques[s.dia_semana]) || [];
  // bloques que respetan disponibilidad si existe; si no hay disponibilidad cargada, usar todos
  const candidatos = disp.length
    ? candidatosBase.filter(b => disp.includes(b))
    : candidatosBase.slice();

  // ocupación del terapeuta y del niño ese día (excluyendo esta sesión)
  const ocupTer = new Set(d.sesiones.filter(o => o !== s && o.id_terapeuta === s.id_terapeuta && o.fecha === s.fecha).map(o => o.id_bloque));
  const ocupNino = new Set(d.sesiones.filter(o => o !== s && o.id_nino === s.id_nino && o.fecha === s.fecha).map(o => o.id_bloque));

  const libresTer = candidatos.filter(b => !ocupTer.has(b));
  // preferir donde el niño tampoco esté; si no, cualquiera libre para el terapeuta
  const destino = libresTer.find(b => !ocupNino.has(b)) || libresTer[0];

  if (destino) {
    const blq = bloqueObj(destino);
    s.id_bloque = destino;
    if (blq) { s.hora_inicio = blq.hora_inicio; s.hora_fin = blq.hora_fin; }
    movidas++;
  } else {
    sinHueco++;
    huerfanas.push(`${s.id_sesion} ${s.fecha} ${s.dia_semana} ${s.id_nino}/${s.id_terapeuta}`);
  }
});

// Las que no caben en ningún bloque (terapeuta con el día completo) se eliminan:
// son sobrecarga irreal en la data demo y mantenerlas dejaría niños a las 8:00.
const idsHuerfanos = new Set(d.sesiones.filter(s => s.id_bloque === 'BLQ-01' && s.id_nino && !esReunion(s)).map(s => s.id_sesion));
const eliminadas = idsHuerfanos.size;
if (eliminadas) d.sesiones = d.sesiones.filter(s => !idsHuerfanos.has(s.id_sesion));

// Recontar meta.counts (cambia el total si se eliminó alguna)
const c = d.meta.counts;
c.sesiones = d.sesiones.length;
const porEstado = e => d.sesiones.filter(s => s.estado === e).length;
c.sesiones_realizadas = porEstado('Realizada');
c.sesiones_canceladas = porEstado('Cancelada');
c.sesiones_no_asistio = porEstado('No Asistió');
c.sesiones_agendadas = porEstado('Agendada');

fs.writeFileSync(file, JSON.stringify(d, null, 2));
console.log('Bloque 8:00 (BLQ-01) limpiado de niños:');
console.log(`  BLQ-08 habilitado en disponibilidad (terapeuta·día): ${dispBLQ08}`);
console.log(`  Sesiones clínicas que estaban en BLQ-01: ${clinicas01.length}`);
console.log(`  Reubicadas: ${movidas}`);
console.log(`  Sin hueco (quedan en BLQ-01): ${sinHueco}`);
if (huerfanas.length) huerfanas.slice(0, 20).forEach(h => console.log('     ⚠', h));
console.log(`  Eliminadas por terapeuta con día completo: ${eliminadas}`);
const restantes = d.sesiones.filter(s => s.id_bloque === 'BLQ-01' && s.id_nino && !esReunion(s)).length;
console.log(`  Verificación · niños en sesión en BLQ-01 ahora: ${restantes}`);
console.log(`  Total sesiones ahora: ${c.sesiones}`);
console.log(`  Reuniones de equipo en BLQ-01 (se conservan): ${d.sesiones.filter(s => s.id_bloque === 'BLQ-01' && esReunion(s)).length}`);
