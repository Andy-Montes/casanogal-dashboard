// Correcciones de la auditoría de datos (nogalito, 2026-06-22). Idempotente.
// 1. Recalcula meta.counts (sesiones, bloques, sub-estados) desueto tras los seeds.
// 2. BLQ-08 deja de ser bloque de reunión: es bloque de atención real (tiene sesiones clínicas).
// 3. Agrega BLQ-08 a la disponibilidad de cada terapeuta que ya trabaja hasta BLQ-07 (respeta excepciones).
// 4. Reubica sesiones en BLQ-08 de terapeutas que NO lo tienen disponible (excepción lactancia/salida).
// 5. Elimina reuniones de equipo que chocan con otra sesión del mismo terapeuta en BLQ-01.
// 6. Extiende fecha_termino_programa de niños Activos con alta vencida (demo: sin altas pasadas).
// 7. Normaliza el orden de campos de las sesiones (id_sesion primero).
const fs = require('fs');
const file = require('path').join(__dirname, 'data.json');
const d = JSON.parse(fs.readFileSync(file, 'utf8'));
const HOY = '2026-06-22';

// --- 2. BLQ-08 = bloque de atención ---
const blq08 = d.bloques_horarios.find(b => b.id_bloque === 'BLQ-08');
if (blq08) blq08.es_reunion_equipo = false;

// --- 3. BLQ-08 a disponibilidad de quien ya trabaja BLQ-07 ese día ---
d.terapeutas.forEach(t => {
  const disp = t.disponibilidad_bloques || {};
  Object.keys(disp).forEach(dia => {
    const blqs = disp[dia];
    if (Array.isArray(blqs) && blqs.includes('BLQ-07') && !blqs.includes('BLQ-08')) {
      blqs.push('BLQ-08');
    }
  });
});

// helper: ¿el terapeuta tiene este bloque disponible ese día?
const dispEn = (idTer, dia, idBloque) => {
  const t = d.terapeutas.find(x => x.id_terapeuta === idTer);
  return !!(t && t.disponibilidad_bloques && (t.disponibilidad_bloques[dia] || []).includes(idBloque));
};

// --- 4. Reubicar sesiones clínicas en BLQ-08 de terapeutas sin BLQ-08 disponible ---
let reubicadas = 0;
d.sesiones.forEach(s => {
  if (s.id_bloque !== 'BLQ-08' || !s.id_nino || s.tipo_actividad === 'Reunión de equipo') return;
  if (dispEn(s.id_terapeuta, s.dia_semana, 'BLQ-08')) return; // ya válido
  // buscar bloque disponible ese día sin otra sesión del mismo terapeuta esa fecha
  const t = d.terapeutas.find(x => x.id_terapeuta === s.id_terapeuta);
  const candidatos = (t && t.disponibilidad_bloques && t.disponibilidad_bloques[s.dia_semana]) || [];
  const ocupados = new Set(d.sesiones.filter(o => o !== s && o.id_terapeuta === s.id_terapeuta && o.fecha === s.fecha).map(o => o.id_bloque));
  const libre = candidatos.slice().reverse().find(b => !ocupados.has(b)); // el más tardío libre
  if (libre) {
    const blq = d.bloques_horarios.find(b => b.id_bloque === libre);
    s.id_bloque = libre;
    if (blq) { s.hora_inicio = blq.hora_inicio; s.hora_fin = blq.hora_fin; }
    reubicadas++;
  }
});

// --- 5. Los martes a las 08:00 (BLQ-01) son reunión de equipo: ninguna atención clínica ahí.
//        Se preservan las reuniones y se mueven las sesiones clínicas/observación a un hueco. ---
const ordenBloques = d.bloques_horarios.slice().sort((a, b) => a.orden - b.orden).map(b => b.id_bloque);
let movidasMartes = 0, sinHueco = 0;
const choquesSinHueco = [];
d.sesiones.forEach(s => {
  if (s.tipo_actividad === 'Reunión de equipo') return;
  if (s.dia_semana !== 'martes' || s.id_bloque !== 'BLQ-01') return;
  const t = d.terapeutas.find(x => x.id_terapeuta === s.id_terapeuta);
  const disp = (t && t.disponibilidad_bloques && t.disponibilidad_bloques['martes']) || [];
  const ocupTer = new Set(d.sesiones.filter(o => o !== s && o.id_terapeuta === s.id_terapeuta && o.fecha === s.fecha).map(o => o.id_bloque));
  const ocupNino = new Set(d.sesiones.filter(o => o !== s && o.id_nino && o.id_nino === s.id_nino && o.fecha === s.fecha).map(o => o.id_bloque));
  const destino = ordenBloques.find(b => b !== 'BLQ-01' && disp.includes(b) && !ocupTer.has(b) && !ocupNino.has(b));
  if (destino) {
    const blq = d.bloques_horarios.find(b => b.id_bloque === destino);
    s.id_bloque = destino;
    if (blq) { s.hora_inicio = blq.hora_inicio; s.hora_fin = blq.hora_fin; }
    movidasMartes++;
  } else { sinHueco++; choquesSinHueco.push(s.id_terapeuta + '|' + s.fecha); }
});
// terapeutas con agenda llena ese martes: se les quita la reunión (no pueden asistir)
const reunAntes = d.sesiones.filter(s => s.tipo_actividad === 'Reunión de equipo').length;
const sinHuecoSet = new Set(choquesSinHueco);
d.sesiones = d.sesiones.filter(s => !(s.tipo_actividad === 'Reunión de equipo' && sinHuecoSet.has(s.id_terapeuta + '|' + s.fecha)));
const reunQuitadas = reunAntes - d.sesiones.filter(s => s.tipo_actividad === 'Reunión de equipo').length;

// --- 6. Altas vencidas en niños Activos ---
let altasExtendidas = 0;
d.ninos.forEach(n => {
  if (n.estado === 'Activo' && n.fecha_termino_programa && n.fecha_termino_programa < HOY) {
    const esEval = (n.id_programa || '').includes('EVAL');
    n.fecha_termino_programa = esEval ? '2026-06-26' : '2026-07-10';
    altasExtendidas++;
  }
});

// --- 7. Normalizar orden de campos de sesiones (id_sesion primero) ---
const ref = d.sesiones.find(s => Object.keys(s)[0] === 'id_sesion') || d.sesiones[0];
const refKeys = Object.keys(ref);
d.sesiones = d.sesiones.map(s => {
  const out = {};
  refKeys.forEach(k => { if (k in s) out[k] = s[k]; });
  Object.keys(s).forEach(k => { if (!(k in out)) out[k] = s[k]; }); // extras al final
  return out;
});

// --- 1. Recontar meta.counts ---
const c = d.meta.counts;
c.bloques_horarios = d.bloques_horarios.length;
c.sesiones = d.sesiones.length;
c.terapeutas = d.terapeutas.length;
c.ninos = d.ninos.length;
c.ninos_activos = d.ninos.filter(n => n.estado === 'Activo').length;
const porEstado = (e) => d.sesiones.filter(s => s.estado === e).length;
c.sesiones_realizadas = porEstado('Realizada');
c.sesiones_canceladas = porEstado('Cancelada');
c.sesiones_no_asistio = porEstado('No Asistió');
c.sesiones_agendadas = porEstado('Agendada');
if ('historial_intensivos' in c) c.historial_intensivos = (d.historial_intensivos || []).length;

fs.writeFileSync(file, JSON.stringify(d, null, 2));
console.log('Auditoría aplicada:');
console.log(`  BLQ-08 ahora es_reunion_equipo=${blq08.es_reunion_equipo}`);
console.log(`  Sesiones reubicadas desde BLQ-08 (excepción): ${reubicadas}`);
console.log(`  Sesiones clínicas movidas fuera de martes 08:00: ${movidasMartes} (sin hueco: ${sinHueco})`);
console.log(`  Reuniones quitadas a terapeutas con agenda llena: ${reunQuitadas}`);
console.log(`  Reuniones de equipo conservadas: ${d.sesiones.filter(s => s.tipo_actividad === 'Reunión de equipo').length}`);
console.log(`  Altas vencidas extendidas: ${altasExtendidas}`);
console.log(`  meta.counts: sesiones=${c.sesiones} bloques=${c.bloques_horarios} realizadas=${c.sesiones_realizadas} canceladas=${c.sesiones_canceladas} no_asistio=${c.sesiones_no_asistio} agendadas=${c.sesiones_agendadas}`);
const suma = c.sesiones_realizadas + c.sesiones_canceladas + c.sesiones_no_asistio + c.sesiones_agendadas;
console.log(`  suma sub-estados=${suma} vs total=${c.sesiones} (diff=${c.sesiones - suma})`);
