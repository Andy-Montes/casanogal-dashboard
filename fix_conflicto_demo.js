// fix_conflicto_demo.js
// Mueve el conflicto intencional (SES-0681 / SES-0691, "Sala duplicada")
// a la semana visible de la demo, para que el KPI rojo de conflictos
// muestre algo al abrir el calendario.
// Uso: node fix_conflicto_demo.js   (reescribe data.json)

const fs = require('fs');
const RUTA = 'data.json';
const data = JSON.parse(fs.readFileSync(RUTA, 'utf8'));

// Miércoles 20 de mayo (HOY de la demo), bloque de media mañana
const FECHA = '2026-05-20';
const DIA = 'miércoles';

let movidas = 0;
['SES-0681', 'SES-0691'].forEach(id => {
  const s = data.sesiones.find(x => x.id_sesion === id);
  if (s) {
    s.fecha = FECHA;
    s.dia_semana = DIA;
    s.estado = 'Agendada'; // conflicto pendiente de resolver
    movidas++;
  }
});

fs.writeFileSync(RUTA, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Conflicto movido a ${FECHA}: ${movidas} sesiones (mismo bloque y sala = "Sala duplicada").`);
