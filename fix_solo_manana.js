// Casa Nogal atiende SOLO en jornada de mañana (08:00-13:00, lun-vie).
// (Trini, transcripción 18-jun: "esto es solo para las mañanas, de lunes a viernes").
// Elimina los bloques de tarde y las sesiones que cayeran en ellos. Idempotente.
const fs = require('fs');
const path = require('path').join(__dirname, 'data.json');
const d = JSON.parse(fs.readFileSync(path, 'utf8'));

const idsTarde = new Set(d.bloques_horarios.filter(b => b.periodo === 'Tarde').map(b => b.id_bloque));
const sesAntes = d.sesiones.length;
d.bloques_horarios = d.bloques_horarios.filter(b => b.periodo !== 'Tarde');
d.sesiones = d.sesiones.filter(s => !idsTarde.has(s.id_bloque));

if (d.meta && d.meta.counts) {
  // Recalcular conteos por estado
  const c = d.meta.counts;
  c.sesiones_realizadas = d.sesiones.filter(s => s.estado === 'Realizada').length;
  c.sesiones_canceladas = d.sesiones.filter(s => s.estado === 'Cancelada').length;
  c.sesiones_no_asistio = d.sesiones.filter(s => s.estado === 'No Asistió').length;
  c.sesiones_agendadas = d.sesiones.filter(s => s.estado === 'Agendada').length;
}

fs.writeFileSync(path, JSON.stringify(d, null, 2));
console.log(`Bloques de tarde eliminados: ${idsTarde.size} · sesiones eliminadas: ${sesAntes - d.sesiones.length} · quedan ${d.sesiones.length} sesiones (solo mañana).`);
