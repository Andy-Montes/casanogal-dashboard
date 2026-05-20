// fix_conflicto_demo.js
// Mueve el conflicto intencional (SES-0681 / SES-0691, "Sala duplicada")
// a la semana visible de la demo, quita las notas que quedaron incoherentes
// (la sesión pasa a Agendada) y recalcula meta.counts.
// Uso: node fix_conflicto_demo.js   (reescribe data.json)

const fs = require('fs');
const RUTA = 'data.json';
const data = JSON.parse(fs.readFileSync(RUTA, 'utf8'));

const FECHA = '2026-05-20'; // miércoles 20 may (HOY de la demo)
const DIA = 'miércoles';
const IDS = ['SES-0681', 'SES-0691'];

let movidas = 0;
IDS.forEach(id => {
  const s = data.sesiones.find(x => x.id_sesion === id);
  if (s) {
    s.fecha = FECHA;
    s.dia_semana = DIA;
    s.estado = 'Agendada'; // conflicto pendiente de resolver
    movidas++;
  }
});

// Las notas de esas sesiones quedan incoherentes (sesión ahora Agendada): se quitan
const notasAntes = data.sesion_notas.length;
data.sesion_notas = data.sesion_notas.filter(n => !IDS.includes(n.id_sesion));

// Recalcular meta.counts contra los arrays reales
const cuenta = (e) => data.sesiones.filter(s => s.estado === e).length;
const t = data.meta.counts;
t.sesiones = data.sesiones.length;
t.sesion_notas = data.sesion_notas.length;
t.sesiones_realizadas = cuenta('Realizada');
t.sesiones_canceladas = cuenta('Cancelada');
t.sesiones_no_asistio = cuenta('No Asistió');
t.sesiones_agendadas = cuenta('Agendada');
t.equipo_asignado = data.equipo_asignado.length;

fs.writeFileSync(RUTA, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Conflicto a ${FECHA}: ${movidas} sesiones · notas quitadas: ${notasAntes - data.sesion_notas.length}`);
console.log('meta.counts:', JSON.stringify(t));
