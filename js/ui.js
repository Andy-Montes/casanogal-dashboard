// Helpers de UI: toast, formato, escape
const UI = {
  toast(msg, type = '') {
    const t = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    t.className = 'toast show ' + type;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  },

  fmtFecha(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return `${d} de ${meses[m - 1]} de ${y}`;
  },
  fmtFechaCorta(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  },
  fmtCLP(n) {
    return '$' + (n || 0).toLocaleString('es-CL');
  },
  fmtRangoSemana() {
    const [y, m, d] = State.weekStart.split('-').map(Number);
    const ini = new Date(Date.UTC(y, m - 1, d));
    const fin = new Date(Date.UTC(y, m - 1, d + 4));
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    if (ini.getUTCMonth() === fin.getUTCMonth()) {
      return `${ini.getUTCDate()} al ${fin.getUTCDate()} de ${meses[fin.getUTCMonth()]}`;
    }
    return `${ini.getUTCDate()} de ${meses[ini.getUTCMonth()]} al ${fin.getUTCDate()} de ${meses[fin.getUTCMonth()]}`;
  },
  initials(name) {
    if (!name) return '—';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  },
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  },
  avatarClassByPrograma(p) {
    const k = (p || '').replace('PROG-', '').toLowerCase();
    if (['int','cont','eval','apr','at'].includes(k)) return k;
    return 'int';
  },
  estadoClass(estado) {
    const map = { 'Realizada':'realizada', 'Agendada':'agendada', 'Suspendida':'cancelada', 'Cancelada':'cancelada', 'No Asistió':'no_asistio' };
    return map[estado] || 'agendada';
  },

  // Palette de 8 colores vibrantes para avatares de niños — derivado del id_nino
  _NINO_PALETTE: [
    { bg:'#1B6B8A', text:'#FFFFFF' }, // azul brand
    { bg:'#E8A317', text:'#0A1018' }, // mostaza
    { bg:'#4D8B2C', text:'#FFFFFF' }, // verde
    { bg:'#D4571C', text:'#FFFFFF' }, // naranja
    { bg:'#7A3E9C', text:'#FFFFFF' }, // lavanda
    { bg:'#0F857E', text:'#FFFFFF' }, // turquesa
    { bg:'#C58B0A', text:'#FFFFFF' }, // ocre
    { bg:'#2C5DA8', text:'#FFFFFF' }, // azul cog
  ],
  colorNino(idNino) {
    if (!idNino) return this._NINO_PALETTE[0];
    let h = 0;
    for (let i = 0; i < idNino.length; i++) h = (h * 31 + idNino.charCodeAt(i)) >>> 0;
    return this._NINO_PALETTE[h % this._NINO_PALETTE.length];
  },

  // Color de sala por tipo_principal
  colorSala(tipo) {
    const map = {
      'Terapia Ocupacional':  { bg: 'var(--to-bg)',    text: 'var(--to-text)',    main: 'var(--to)' },
      'Fonoaudiología':       { bg: 'var(--fono-bg)',  text: 'var(--fono-text)',  main: 'var(--fono)' },
      'Cognitivo':            { bg: 'var(--cog-bg)',   text: 'var(--cog-text)',   main: 'var(--cog)' },
      'Psicología':           { bg: 'var(--psico-bg)', text: 'var(--psico-text)', main: 'var(--psico)' },
      'Psicología/RDI':       { bg: 'var(--rdi-bg)',   text: 'var(--rdi-text)',   main: 'var(--rdi)' },
      'Kinesiología':         { bg: 'var(--kine-bg)',  text: 'var(--kine-text)',  main: 'var(--kine)' },
      'Habilidad Adaptativa': { bg: 'var(--kids-bg)',  text: 'var(--kids-text)',  main: 'var(--kids)' },
      'Multifunción':         { bg: 'var(--cn-mostaza-bg)', text: 'var(--cn-mostaza-deep)', main: 'var(--cn-mostaza)' },
    };
    return map[tipo] || { bg: 'var(--cn-azul-bg)', text: 'var(--cn-azul-deep)', main: 'var(--cn-azul)' };
  },

  // Color principal de una disciplina (para el punto de disciplina en las sesiones)
  discColor(tipoTerapia) {
    const v = (typeof ESPECIALIDAD_VAR !== 'undefined' && ESPECIALIDAD_VAR[tipoTerapia]) || null;
    return v ? v.main : 'var(--text-3)';
  },

  // Niño en programa Intensivo
  esIntensivo(n) { return !!(n && n.id_programa === 'PROG-INT'); },
  // Insignia "INT" junto al nombre (vacío si no es intensivo)
  badgeIntensivo(n) { return this.esIntensivo(n) ? '<span class="badge-int" title="En el programa Intensivo">INT</span>' : ''; },
  // Anillo mostaza alrededor del avatar del niño intensivo (string de box-shadow, '' si no)
  ringIntensivo(n) { return this.esIntensivo(n) ? 'box-shadow:0 0 0 2px var(--bg), 0 0 0 4px var(--cn-mostaza);' : ''; },

  // ---- Participación de los papás (misma regla que el portal de padres) ----
  _lunISOWk(iso) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); },
  // Nº de semana del programa (1-based) para una fecha, o null
  semanaDeNino(n, fechaISO) {
    if (!n || !n.fecha_inicio_programa || !fechaISO) return null;
    return Math.floor((new Date(this._lunISOWk(fechaISO)) - new Date(this._lunISOWk(n.fecha_inicio_programa))) / (7 * 86400000)) + 1;
  },
  // ¿Esta sesión es una observación donde el papá acompaña? (dato explícito, o la 1ª de TO/Fono/Cog
  // del niño esa semana, desde la semana 2, en intensivo). Misma regla que _paParticipacion.
  esObservacionPadres(s) {
    if (!s) return false;
    if (s.tipo_sesion_padre === 'observacion') return true;
    if (typeof Data === 'undefined') return false;
    const n = Data.nino(s.id_nino);
    if (!n || !this.esIntensivo(n)) return false;
    if (['Terapia Ocupacional', 'Fonoaudiología', 'Cognitivo'].indexOf(s.tipo_terapia) < 0) return false;
    const sem = this.semanaDeNino(n, s.fecha);
    if (sem == null || sem < 2) return false;
    const wk = this._lunISOWk(s.fecha);
    const grupo = Data.sesionesDeNino(n.id_nino)
      .filter(x => x.tipo_terapia === s.tipo_terapia && x.tipo_actividad !== 'Reunión de equipo' && this._lunISOWk(x.fecha) === wk)
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
    return grupo.length > 0 && grupo[0].id_sesion === s.id_sesion;
  },
  // ¿Sesión con los papás (sin el niño): sesión de padres, coaching, individual?
  esConPapas(s) { return !!s && (s.tipo_actividad === 'Sesión de padres' || s.tipo_actividad === 'Coaching a padres' || s.tipo_sesion_padre === 'individual_padre' || s.tipo_sesion_padre === 'vincular'); },
};
