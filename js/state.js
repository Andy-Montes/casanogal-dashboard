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
// Modalidades que son SOLO con los padres (sin el niño). No deben aparecer en el horario del niño;
// solo cuentan en la agenda del terapeuta y de los padres. (Pedido de Trini 2026-07-07.)
const MODALIDADES_SOLO_PADRES = ['Sesión de padres', 'Coaching a padres'];
function esSesionSoloPadres(s) { return !!s && MODALIDADES_SOLO_PADRES.includes(s.tipo_actividad); }

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
const DIAS_LABEL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const DIAS_ABBR = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE'];
// "Hoy": en la DEMO es fijo (20 may 2026, para que calcen las sesiones sintéticas);
// en la INSTANCIA REAL es la fecha/hora real. Misma detección que Data.esInstanciaReal,
// duplicada acá porque state.js carga antes que data.js.
const _CN_ES_REAL = (() => {
  try {
    const p = new URLSearchParams(location.search);
    if (p.get('real') === '1') localStorage.setItem('casanogal_fuente_datos', 'real');
    if (p.get('real') === '0') localStorage.setItem('casanogal_fuente_datos', 'demo');
    const f = localStorage.getItem('casanogal_fuente_datos');
    if (f === 'real') return true;
    if (f === 'demo') return false;
  } catch (e) {}
  return /(^|[.-])real([.-]|$)/i.test((typeof location !== 'undefined' && location.hostname) || '');
})();
// Fecha local (no UTC) para no correr el día en la madrugada de Chile.
const HOY_ISO = _CN_ES_REAL
  ? (() => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); })()
  : '2026-07-08'; // demo: miércoles 8 julio 2026 (data desplazada +49d para caer en la semana en curso)
const HOY_HORA = _CN_ES_REAL
  ? (() => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; })()
  : 10.5; // demo: 10:30 — para la línea "ahora"

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
