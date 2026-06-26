// Estado global de la app
const State = {
  data: null,
  session: null,                 // { tipo: 'admin' } | { tipo: 'terapeuta', id_terapeuta }
  role: 'coordinacion',          // coordinacion | terapeuta | padres
  currentUser: null,             // usuario activo según rol
  module: 'calendario',          // módulo activo
  weekStart: '2026-05-11',       // semana visible (lunes 11 may · SEM 4 del intensivo)
  filterPrograma: 'all',         // default: todos los programas. all | INT | CONT | EVAL | APR | AT
  filterFicha: 'all',
  filterDiagnostico: 'all',     // filtro por diagnóstico en Fichas clínicas
  filterNino: 'all',             // filtro por niño en la agenda (coordinación)
  fichaActiva: null,             // id_nino abierto en vista B
  searchQuery: '',
  selectedSesion: null,
  movingSesion: null,
};

const DEMO_USERS = {
  coordinacion: { id: 'USR-001', name: 'Trinidad Cervero', short: 'Trinidad', avatar: 'TC', role: 'Coordinacion' },
  terapeuta:    { id: 'USR-0004', name: 'Krasna Petrovic', short: 'Krasna',    avatar: 'KR', role: 'Terapeuta', id_terapeuta: 'TER-02' },
  padres:       { id: 'USR-0018', name: 'Carolina Pérez',  short: 'Carolina',  avatar: 'CP', role: 'Padre',     id_nino: 'NINO-0001' },
};

// Mapeo Especialidad -> clase CSS de sesión
const ESPECIALIDAD_CLASS = {
  'Terapia Ocupacional':  's-to',
  'Fonoaudiología':       's-fono',
  'Cognitivo':            's-cog',
  'Psicología':           's-psico',
  'Kinesiología':         's-kine',
  'RDI':                  's-rdi',
  'Habilidad Adaptativa':'s-kids',
};
const ESPECIALIDAD_VAR = {
  'Terapia Ocupacional':  { main: 'var(--to)', bg: 'var(--to-bg)', text: 'var(--to-text)' },
  'Fonoaudiología':       { main: 'var(--fono)', bg: 'var(--fono-bg)', text: 'var(--fono-text)' },
  'Cognitivo':            { main: 'var(--cog)', bg: 'var(--cog-bg)', text: 'var(--cog-text)' },
  'Psicología':           { main: 'var(--psico)', bg: 'var(--psico-bg)', text: 'var(--psico-text)' },
  'Kinesiología':         { main: 'var(--kine)', bg: 'var(--kine-bg)', text: 'var(--kine-text)' },
  'RDI':                  { main: 'var(--rdi)', bg: 'var(--rdi-bg)', text: 'var(--rdi-text)' },
  'Habilidad Adaptativa': { main: 'var(--kids)', bg: 'var(--kids-bg)', text: 'var(--kids-text)' },
};

// Modalidades de sesión (pedido de Trini): además de la individual, sesiones de papás,
// talleres grupales, coaching y la supervisión semanal de neurología.
const MODALIDADES = ['Sesión', 'Sesión de padres', 'Taller grupal', 'Coaching a padres', 'Supervisión neurología'];

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
const DIAS_LABEL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const DIAS_ABBR = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE'];
const HOY_ISO = '2026-05-20'; // miércoles 20 mayo 2026
const HOY_HORA = 10.5; // 10:30 — para la línea "ahora"

function fechaDeDia(dia) {
  // weekStart es lunes ISO, devuelve fecha ISO del día solicitado
  const idx = DIAS.indexOf(dia);
  const [y, m, d] = State.weekStart.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + idx));
  return dt.toISOString().slice(0, 10);
}
function fechasSemana() {
  return DIAS.map(d => fechaDeDia(d));
}
