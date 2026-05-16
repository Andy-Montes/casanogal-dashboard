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
    const map = { 'Realizada':'realizada', 'Agendada':'agendada', 'Cancelada':'cancelada', 'No Asistió':'no_asistio' };
    return map[estado] || 'agendada';
  },
};
