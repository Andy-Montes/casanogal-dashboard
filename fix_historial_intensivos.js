// Fase 3 (Historial): crea la "historia de vida" de un niño de ejemplo (León,
// NINO-0001): evaluación inicial + 2 intensivos cerrados + seguimiento, cada uno
// con horario, registros, objetivos e informe final. Edad se calcula en la UI
// desde fecha_nacimiento. Idempotente (reemplaza el historial de ese niño).
const fs = require('fs');
const path = require('path').join(__dirname, 'data.json');
const d = JSON.parse(fs.readFileSync(path, 'utf8'));
const ID = 'NINO-0001';

const nino = d.ninos.find(n => n.id_nino === ID);
if (nino) {
  if (nino.foto_url === undefined) nino.foto_url = '';        // fallback a iniciales
  nino.fecha_primera_evaluacion = '2024-03-12';
}

const hist = [
  {
    id_ciclo: 'CICLO-0001', id_nino: ID, tipo: 'Evaluación inicial',
    fecha_inicio: '2024-03-12', fecha_termino: '2024-03-26', estado: 'Completado',
    resumen: 'Evaluación integral de ingreso. Se confirma diagnóstico TEA y se define plan terapéutico.',
    informe: { tipo: 'Informe de evaluación', nombre_archivo: 'Evaluacion_Inicial_Leon.pdf', fecha: '2024-03-28' },
  },
  {
    id_ciclo: 'CICLO-0002', id_nino: ID, tipo: 'Intensivo', nombre: 'Intensivo I',
    fecha_inicio: '2024-05-06', fecha_termino: '2024-06-14', semanas: 6, estado: 'Completado',
    sesiones_realizadas: 178, sesiones_totales: 186,
    horario_resumen: ['TO 7/sem', 'Fono 6/sem', 'Cognitivo 7/sem', 'Kinesiología 2/sem', 'KIDS 5/sem'],
    objetivos: ['Tolerar el trabajo en mesa por 10 min', 'Aumentar contacto visual en juego', 'Iniciar peticiones con apoyo visual'],
    resumen: 'Buen enganche con el equipo. Avances en regulación y atención conjunta.',
    informe: { tipo: 'Informe final', nombre_archivo: 'Informe_Final_Intensivo_I_Leon.pdf', fecha: '2024-06-18' },
  },
  {
    id_ciclo: 'CICLO-0003', id_nino: ID, tipo: 'Seguimiento',
    fecha_inicio: '2024-07-01', fecha_termino: '2024-11-30', estado: 'Completado',
    sesiones_realizadas: 42, sesiones_totales: 48,
    resumen: 'Sesiones semanales de mantención. Se consolidan logros del intensivo.',
    informe: { tipo: 'Informe de seguimiento', nombre_archivo: 'Seguimiento_2024_Leon.pdf', fecha: '2024-12-05' },
  },
  {
    id_ciclo: 'CICLO-0004', id_nino: ID, tipo: 'Intensivo', nombre: 'Intensivo II',
    fecha_inicio: '2025-04-21', fecha_termino: '2025-05-30', semanas: 6, estado: 'Completado',
    sesiones_realizadas: 190, sesiones_totales: 198,
    horario_resumen: ['TO 7/sem', 'Fono 6/sem', 'Cognitivo 7/sem', 'Kinesiología 2/sem', 'Psicología 1/sem', 'KIDS 5/sem'],
    objetivos: ['Ampliar repertorio de juego simbólico', 'Frases de 2-3 palabras espontáneas', 'Mayor autonomía en rutinas'],
    resumen: 'Salto en lenguaje expresivo y juego. Se incorpora psicología para apoyo vincular.',
    informe: { tipo: 'Informe final', nombre_archivo: 'Informe_Final_Intensivo_II_Leon.pdf', fecha: '2025-06-03' },
  },
];

d.historial_intensivos = (d.historial_intensivos || []).filter(h => h.id_nino !== ID).concat(hist);
if (d.meta && d.meta.counts) d.meta.counts.historial_intensivos = d.historial_intensivos.length;
fs.writeFileSync(path, JSON.stringify(d, null, 2));
console.log(`Historial de ${nino?.nombre_completo || ID}: ${hist.length} hitos (evaluación, 2 intensivos, seguimiento).`);
