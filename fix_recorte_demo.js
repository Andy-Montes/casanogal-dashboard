// fix_recorte_demo.js
// Recorta la data sintética a la ventana del Intensivo 40 + 1 semana de
// margen a cada lado (27 abr – 19 jun 2026 = 8 semanas), para una demo
// liviana y coherente. Conserva niños, terapeutas, equipo y objetivos.
// Uso: node fix_recorte_demo.js   (reescribe data.json)

const fs = require('fs');
const RUTA = 'data.json';
const data = JSON.parse(fs.readFileSync(RUTA, 'utf8'));

const DESDE = '2026-04-27';
const HASTA = '2026-06-19';

const sesAntes = data.sesiones.length;
data.sesiones = data.sesiones.filter(s => s.fecha >= DESDE && s.fecha <= HASTA);

const idsVivas = new Set(data.sesiones.map(s => s.id_sesion));
const notasAntes = data.sesion_notas.length;
data.sesion_notas = data.sesion_notas.filter(n => idsVivas.has(n.id_sesion));

// Recalcular meta
const cuenta = (e) => data.sesiones.filter(s => s.estado === e).length;
const t = data.meta.counts;
t.sesiones = data.sesiones.length;
t.sesion_notas = data.sesion_notas.length;
t.sesiones_realizadas = cuenta('Realizada');
t.sesiones_canceladas = cuenta('Cancelada');
t.sesiones_no_asistio = cuenta('No Asistió');
t.sesiones_agendadas = cuenta('Agendada');
data.meta.rango_demo = { desde: DESDE, hasta: HASTA };

fs.writeFileSync(RUTA, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Recorte ${DESDE} a ${HASTA}`);
console.log(`Sesiones: ${sesAntes} -> ${data.sesiones.length} | notas: ${notasAntes} -> ${data.sesion_notas.length}`);
console.log('Totales:', JSON.stringify(t));
