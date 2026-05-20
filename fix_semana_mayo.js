// fix_semana_mayo.js
// Mueve la "semana actual" de la demo a la del lunes 18 de mayo 2026:
//  #8  cierra estados de lun 18 / mar 19 / mié 20-mañana; jueves 21 = feriado
//  #2  redistribuye sesiones de la semana hacia bloques de tarde
//  #10 genera notas clínicas para las sesiones realizadas sin nota
// Uso: node fix_semana_mayo.js   (reescribe data.json)

const fs = require('fs');
const RUTA = 'data.json';
const data = JSON.parse(fs.readFileSync(RUTA, 'utf8'));

// PRNG determinista (LCG) para que el resultado sea reproducible
let _s = 20260518;
const rnd = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const ses = data.sesiones;
const bloques = data.bloques_horarios;
const esTarde = {}; bloques.forEach(b => esTarde[b.id_bloque] = b.periodo === 'Tarde');
const bloqueById = {}; bloques.forEach(b => bloqueById[b.id_bloque] = b);
const blqMananaPM = bloques.filter(b => b.periodo === 'Mañana');
const blqTarde = bloques.filter(b => b.periodo === 'Tarde');

// ---- #8a · jueves 21 = feriado: se quitan las sesiones de ese día ----
const antesFeriado = ses.length;
data.sesiones = ses.filter(s => s.fecha !== '2026-05-21');
const sesiones = data.sesiones;
console.log(`Feriado 21-may: ${antesFeriado - sesiones.length} sesiones removidas`);

// ---- #8b · cerrar estados según el nuevo "hoy" = miércoles 20 ----
let cerradas = 0;
sesiones.forEach(s => {
  if (s.fecha === '2026-05-18' || s.fecha === '2026-05-19') {
    const r = rnd();
    s.estado = r < 0.90 ? 'Realizada' : r < 0.96 ? 'Cancelada' : 'No Asistió';
    cerradas++;
  } else if (s.fecha === '2026-05-20') {
    // mié 20: la mañana ya ocurrió, la tarde sigue agendada
    s.estado = String(s.hora_inicio) < '10:30' ? 'Realizada' : 'Agendada';
    cerradas++;
  }
});
console.log(`Estados recalculados para la semana: ${cerradas} sesiones`);

// ---- #2 · redistribuir la semana hacia la tarde (~42%) ----
const diasSemana = ['2026-05-18', '2026-05-19', '2026-05-20', '2026-05-22'];
let movidas = 0;
diasSemana.forEach(fecha => {
  const dayS = sesiones.filter(s => s.fecha === fecha);
  let tarde = dayS.filter(s => esTarde[s.id_bloque]).length;
  const objetivo = Math.round(dayS.length * 0.42);
  const movibles = shuffle(dayS.filter(s => !esTarde[s.id_bloque] && !s.es_dupla && !s.conflicto_detectado));
  for (const s of movibles) {
    if (tarde >= objetivo) break;
    const libre = shuffle(blqTarde).find(b => {
      const ocup = sesiones.filter(o => o.fecha === fecha && o.id_bloque === b.id_bloque && o.id_sesion !== s.id_sesion);
      return !ocup.some(o =>
        o.id_terapeuta === s.id_terapeuta || o.id_sala === s.id_sala || o.id_nino === s.id_nino ||
        (o.id_terapeuta_secundario && o.id_terapeuta_secundario === s.id_terapeuta));
    });
    if (libre) {
      s.id_bloque = libre.id_bloque;
      s.hora_inicio = libre.hora_inicio;
      s.hora_fin = libre.hora_fin;
      tarde++;
      movidas++;
    }
  }
});
console.log(`Redistribución a la tarde: ${movidas} sesiones movidas`);

// ---- #10 · generar notas clínicas para realizadas sin nota (06-20 may) ----
const FRASES = [
  'Sesión fluida. Mantuvo la atención en la actividad principal y respondió bien a las consignas.',
  'Costó iniciar, pero tras la rutina de regulación se conectó con la actividad y terminó la tarea.',
  'Buena disposición. Trabajamos con apoyo visual y logró completar los pasos con mediación parcial.',
  'Avance sostenido respecto de la semana pasada. Se observa mayor tolerancia a la frustración.',
  'Sesión de ritmo más lento. Necesitó pausas sensoriales, pero cerró la actividad con apoyo.',
  'Muy participativo/a hoy. Anticipó la rutina y propuso ideas durante el juego dirigido.',
  'Trabajamos en turnos con material concreto. Esperó su momento y aceptó compartir.',
  'Día con más desregulación. Se acompañó con contención y se redujo la exigencia de la sesión.',
  'Logró generalizar lo trabajado a una situación nueva. Buen indicador de avance.',
  'Sesión enfocada en el objetivo del mes. Requiere repetir la consigna, pero la ejecuta.',
  'Buena conexión con la terapeuta. Aceptó el cambio de actividad sin resistencia.',
  'Se reforzó la comunicación funcional. Usó apoyo gestual para pedir y comentar.',
  'Toleró la actividad estructurada por períodos breves. Se cierra con refuerzo positivo.',
  'Sesión positiva. Se observa progreso en autonomía dentro de la rutina.',
];
const OBJ = {
  'Terapia Ocupacional': ['Integración sensorial en actividades de la vida diaria', 'Motricidad fina y prensión', 'Autonomía en rutinas de autocuidado', 'Equilibrio dinámico en superficies inestables'],
  'Fonoaudiología': ['Comunicación funcional con apoyo aumentativo', 'Comprensión de instrucciones de dos pasos', 'Ampliación de vocabulario expresivo', 'Producción de fonemas en palabras'],
  'Cognitivo': ['Atención sostenida en tareas estructuradas', 'Funciones ejecutivas: planificación y secuencia', 'Resolución de problemas con material concreto', 'Memoria de trabajo en juego dirigido'],
  'Psicología': ['Identificación y nominación de emociones básicas', 'Tolerancia a la espera y al "no"', 'Regulación emocional ante la frustración', 'Habilidades de interacción social con pares'],
  'Kinesiología': ['Fuerza muscular en tronco y extremidades', 'Coordinación motora gruesa', 'Equilibrio dinámico en superficies inestables', 'Patrones de marcha y desplazamiento'],
  'RDI': ['Referencia social y contacto visual', 'Pensamiento dinámico y flexibilidad', 'Co-regulación en la interacción', 'Anticipación y memoria episódica'],
  'Habilidad Adaptativa': ['Autonomía en rutinas de autocuidado', 'Conducta adaptativa en el entorno', 'Habilidades funcionales para la vida diaria', 'Seguimiento de rutinas con apoyo visual'],
};
const objDe = (tipo) => OBJ[tipo] || OBJ['Terapia Ocupacional'];

const conNota = new Set(data.sesion_notas.map(n => n.id_sesion));
let maxNota = 0;
data.sesion_notas.forEach(n => { const x = parseInt(String(n.id_nota).replace(/\D/g, ''), 10); if (x > maxNota) maxNota = x; });

const candidatas = sesiones.filter(s =>
  s.estado === 'Realizada' && s.fecha >= '2026-05-06' && s.fecha <= '2026-05-20' && !conNota.has(s.id_sesion));
let generadas = 0;
shuffle(candidatas).forEach((s, i) => {
  // se dejan ~7% sin nota, para un pendiente realista (no cero)
  if (i % 14 === 0) return;
  maxNota++;
  const objs = shuffle(objDe(s.tipo_terapia)).slice(0, 1 + Math.floor(rnd() * 2));
  data.sesion_notas.push({
    id_nota: 'NOTA-' + String(maxNota).padStart(4, '0'),
    id_sesion: s.id_sesion,
    asistio: true,
    motivo_no_asistencia: null,
    notas_libres: pick(FRASES),
    objetivos_trabajados: objs,
    avance_percibido: 5 + Math.floor(rnd() * 5),
    alerta_coordinacion: rnd() < 0.08,
    alerta_mensaje: null,
    id_terapeuta_autor: s.id_terapeuta,
    fecha_creacion: s.fecha,
  });
  generadas++;
});
console.log(`Notas clínicas generadas: ${generadas} (quedan ${candidatas.length - generadas} sin nota)`);

// ---- meta · recalcular totales, semana y feriados ----
const cuenta = (e) => sesiones.filter(s => s.estado === e).length;
data.meta.semana_actual = 3;
data.meta.fecha_referencia = '2026-05-20';
data.meta.feriados = ['2026-05-21'];
const t = data.meta.counts;
t.sesiones = sesiones.length;
t.sesion_notas = data.sesion_notas.length;
t.sesiones_realizadas = cuenta('Realizada');
t.sesiones_canceladas = cuenta('Cancelada');
t.sesiones_no_asistio = cuenta('No Asistió');
t.sesiones_agendadas = cuenta('Agendada');

fs.writeFileSync(RUTA, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('data.json reescrito. Totales:', JSON.stringify(t));
