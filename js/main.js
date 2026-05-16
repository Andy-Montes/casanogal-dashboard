// Orquestador
const Main = {
  async init() {
    try {
      await Data.load();
    } catch (e) {
      document.getElementById('main').innerHTML = `<div class="empty-state"><div class="empty-state-title">No se pudo cargar data.json</div><div>${UI.esc(e.message)}</div></div>`;
      return;
    }
    State.currentUser = DEMO_USERS.coordinacion;
    this._wireHeader();
    this._wireSidebar();
    this._wirePanel();
    this._wireModal();
    this.refreshUserChip();
    this.refreshCounts();
    this.renderPendientes();
    this.activateNav('calendario');
    Calendar.render();
  },

  _wireHeader() {
    document.querySelectorAll('#roleSwitcher .role-pill').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#roleSwitcher .role-pill').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        State.role = b.dataset.role;
        State.currentUser = DEMO_USERS[State.role];
        State.fichaActiva = null;
        State.searchQuery = '';
        this.refreshUserChip();
        this.refreshCounts();
        this.renderPendientes();
        this._renderModule();
      });
    });
    document.getElementById('searchInput').addEventListener('input', (e) => {
      State.searchQuery = e.target.value;
      if (State.module === 'fichas' || State.module === 'ninos' || State.module === 'equipo') {
        this._renderModule();
      }
    });
    document.getElementById('newSessionBtn').addEventListener('click', () => Modal.openCreate());
  },

  _wireSidebar() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const mod = item.dataset.module;
        State.module = mod;
        State.fichaActiva = null;
        this.activateNav(mod);
        this._renderModule();
      });
    });
  },

  _wirePanel() {
    document.getElementById('panelCloseBtn').addEventListener('click', () => Panel.close());
    document.getElementById('panelOverlay').addEventListener('click', () => Panel.close());
    document.getElementById('panelDeleteBtn').addEventListener('click', () => Panel.delete());
    document.getElementById('panelEditBtn').addEventListener('click', () => Panel.edit());
    document.getElementById('panelMoveBtn').addEventListener('click', () => Panel.initMove());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { Panel.close(); Modal.close(); }
    });
  },

  _wireModal() {
    document.getElementById('modalCancelBtn').addEventListener('click', () => Modal.close());
    document.getElementById('modalSaveBtn').addEventListener('click', () => Modal.save());
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'modalOverlay') Modal.close();
    });
  },

  activateNav(mod) {
    document.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('active', x.dataset.module === mod));
  },

  _renderModule() {
    switch (State.module) {
      case 'calendario': Calendar.render(); break;
      case 'fichas':     Fichas.render(); break;
      case 'reportes':   Reportes.render(); break;
      case 'equipo':     Recursos.renderEquipo(); break;
      case 'ninos':      Recursos.renderNinosTable(); break;
      case 'salas':      Recursos.renderSalas(); break;
      case 'config':     Recursos.renderPlaceholder('Configuración'); break;
      case 'permisos':   Recursos.renderPlaceholder('Permisos'); break;
      default:           Calendar.render();
    }
  },

  refreshUserChip() {
    const u = State.currentUser;
    document.getElementById('userName').textContent = u.short;
    document.getElementById('userAvatar').textContent = u.avatar;
  },

  refreshCounts() {
    document.getElementById('navCalCount').textContent = Data.sesionesSemana().length;
    document.getElementById('navFichasCount').textContent = Data.ninosVisibles().length;
    document.getElementById('navEquipoCount').textContent = State.data.terapeutas.length;
    document.getElementById('navNinosCount').textContent = Data.ninosVisibles().length;
    document.getElementById('navSalasCount').textContent = State.data.salas.length;
  },

  renderPendientes() {
    const list = this._pendientesPorRol();
    document.getElementById('pendientesCount').textContent = list.length;
    document.getElementById('pendientesList').innerHTML = list.map(p =>
      `<div class="pendiente-item"><span class="dot ${p.t}"></span><span>${UI.esc(p.msg)}</span></div>`
    ).join('');
  },

  _pendientesPorRol() {
    if (State.role === 'padres') {
      return [
        { t: 'warn', msg: 'Pago boleta mayo pendiente' },
        { t: 'ok',   msg: 'Próxima sesión: vie 9:55' },
        { t: 'warn', msg: 'Revisar informe mensual' },
        { t: 'ok',   msg: 'Reunión equipo programada' },
        { t: 'warn', msg: 'Confirmar asistencia próxima sem' },
      ];
    }
    if (State.role === 'terapeuta') {
      const conf = Data.kpiConflictos();
      return [
        { t: 'alert', msg: `${conf.count} conflicto${conf.count===1?'':'s'} en tu agenda` },
        { t: 'warn',  msg: 'Faltan notas de 4 sesiones de ayer' },
        { t: 'warn',  msg: 'Revisar objetivos de Belén O.' },
        { t: 'ok',    msg: 'Reunión equipo intensivo · jue 17:30' },
        { t: 'ok',    msg: 'Hoja de horas lista para revisar' },
      ];
    }
    const conf = Data.kpiConflictos();
    return [
      { t: 'alert', msg: `${conf.count} conflicto${conf.count===1?'':'s'} a resolver hoy` },
      { t: 'warn',  msg: '5 boletas listas para emitir' },
      { t: 'warn',  msg: '3 fichas sin equipo asignado' },
      { t: 'ok',    msg: 'Cierre semanal intensivo · vie' },
      { t: 'ok',    msg: '2 nuevas evaluaciones esta semana' },
    ];
  },
};

window.addEventListener('DOMContentLoaded', () => Main.init());
