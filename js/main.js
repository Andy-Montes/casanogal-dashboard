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
    // Restaurar terapeuta guardado en localStorage
    const storedTer = localStorage.getItem('casanogal_terapeuta_id');
    if (storedTer) {
      const t = State.data.terapeutas.find(x => x.id_terapeuta === storedTer);
      if (t) {
        DEMO_USERS.terapeuta = { id:'USR-TER-'+storedTer, name:t.nombre_completo, short:t.nombre_visible, avatar:t.abreviacion.slice(0,2), role:'Terapeuta', id_terapeuta:storedTer };
        const pill = document.querySelector('[data-role=terapeuta]');
        if (pill) pill.textContent = `Terapeuta · ${t.nombre_visible}`;
      }
    }
    this._wireHeader();
    this._wireSidebar();
    this._wirePanel();
    this._wireModal();
    this.refreshUserChip();
    this.refreshCounts();
    this.renderPendientes();
    this.activateNav('calendario');
    Calendar.render();
    // Onboarding al primer ingreso
    document.getElementById('sidebarHelpLink')?.addEventListener('click', () => Onboarding.open(true));
    Onboarding.open();
  },

  _wireHeader() {
    document.querySelectorAll('#roleSwitcher .role-pill').forEach(b => {
      b.addEventListener('click', () => {
        // Si es terapeuta y ya estaba activo, abrir selector
        if (b.dataset.role === 'terapeuta' && b.classList.contains('active')) {
          this._openTerapeutaSelector();
          return;
        }
        document.querySelectorAll('#roleSwitcher .role-pill').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        State.role = b.dataset.role;
        State.currentUser = DEMO_USERS[State.role];
        State.fichaActiva = null;
        State.searchQuery = '';
        // Cuando entra a terapeuta por primera vez, abrir selector
        if (b.dataset.role === 'terapeuta' && !localStorage.getItem('casanogal_terapeuta_id')) {
          this._openTerapeutaSelector();
        } else if (b.dataset.role === 'terapeuta') {
          const stored = localStorage.getItem('casanogal_terapeuta_id');
          if (stored) this._setTerapeutaActivo(stored, false);
        }
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
    this._injectRoleBanner();
  },

  _openTerapeutaSelector() {
    const lista = State.data.terapeutas.filter(t => t.estado === 'Activo').sort((a, b) => a.nombre_visible.localeCompare(b.nombre_visible));
    const html = `
      <div class="pendiente-modal-overlay" id="terOverlay">
        <div class="pendiente-modal" style="width:min(440px,92vw)">
          <div class="pendiente-modal-head">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--cn-azul)"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <div>
              <div class="pendiente-modal-title">Entrar como terapeuta</div>
              <div class="pendiente-modal-eyebrow">Selecciona tu nombre · ${lista.length} activos</div>
            </div>
            <button class="panel-close" id="terCloseBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="pendiente-modal-body" style="max-height:60vh;overflow-y:auto;padding:8px 12px">
            <div class="ter-selector-list">
              ${lista.map(t => {
                const c = ESPECIALIDAD_VAR[t.especialidad];
                return `<button class="ter-selector-row" data-tid="${t.id_terapeuta}">
                  <span class="equipo-avatar" style="background:${c?.bg || 'var(--cn-azul-bg)'};color:${c?.text || 'var(--cn-azul-deep)'}">${UI.esc(t.abreviacion)}</span>
                  <div style="flex:1;text-align:left">
                    <div style="font-weight:600">${UI.esc(t.nombre_completo)}</div>
                    <div style="font-size:11px;color:var(--text-3)">${UI.esc(t.especialidad)} · ${UI.esc(t.tipo_contrato)}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    const close = () => document.getElementById('terOverlay')?.remove();
    document.getElementById('terCloseBtn').addEventListener('click', close);
    document.getElementById('terOverlay').addEventListener('click', (e) => { if (e.target.id === 'terOverlay') close(); });
    document.querySelectorAll('.ter-selector-row').forEach(row => {
      row.addEventListener('click', () => {
        this._setTerapeutaActivo(row.dataset.tid, true);
        close();
      });
    });
  },

  _setTerapeutaActivo(tid, rerender) {
    const t = State.data.terapeutas.find(x => x.id_terapeuta === tid);
    if (!t) return;
    DEMO_USERS.terapeuta = {
      id: 'USR-TER-' + tid,
      name: t.nombre_completo,
      short: t.nombre_visible,
      avatar: t.abreviacion.slice(0, 2),
      role: 'Terapeuta',
      id_terapeuta: tid,
    };
    localStorage.setItem('casanogal_terapeuta_id', tid);
    if (State.role === 'terapeuta') {
      State.currentUser = DEMO_USERS.terapeuta;
      // Update pill label
      const pill = document.querySelector('[data-role=terapeuta]');
      if (pill) pill.textContent = `Terapeuta · ${t.nombre_visible}`;
      this.refreshUserChip();
      this.refreshCounts();
      this.renderPendientes();
      if (rerender) this._renderModule();
    }
  },

  _injectRoleBanner() {
    const main = document.getElementById('main');
    if (!main) return;
    let html = '';
    if (State.role === 'terapeuta') {
      const tid = DEMO_USERS.terapeuta.id_terapeuta;
      const t = Data.terapeuta(tid);
      const ninos = State.data.equipo_asignado.filter(e => e.id_terapeuta === tid && e.activa).length;
      const sesSem = Data.sesionesSemana().length;
      html = `
        <div class="role-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <div>
            <b>Estás viendo como Terapeuta · ${UI.esc(t?.nombre_completo || 'Krasna Petrovic')}.</b>
            Solo aparecen tus ${ninos} niños asignados y tus ${sesSem} sesiones de la semana. <a href="#" id="changeTerLink" style="color:var(--cn-azul);font-weight:600;text-decoration:underline">Cambiar de terapeuta</a> o cambia el rol arriba.
          </div>
        </div>`;
    } else if (State.role === 'padres') {
      const nino = Data.nino(DEMO_USERS.padres.id_nino);
      html = `
        <div class="role-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <div>
            <b>Vista familiar de ${UI.esc(nino?.nombre_completo || 'León Aravena')}.</b>
            Solo ves lo que es de tu hijo. Sin nombres de terapeutas ni notas clínicas internas.
          </div>
          <button class="btn btn-primary" id="downloadPDF" style="flex-shrink:0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Descargar PDF
          </button>
        </div>`;
    }
    if (html) {
      main.insertAdjacentHTML('afterbegin', html);
      document.getElementById('changeTerLink')?.addEventListener('click', (e) => { e.preventDefault(); this._openTerapeutaSelector(); });
      document.getElementById('downloadPDF')?.addEventListener('click', () => Main._downloadPDF());
    }
  },

  _downloadPDF() {
    document.body.classList.add('printing-padres');
    UI.toast('Preparando PDF…', 'success');
    setTimeout(() => { window.print(); document.body.classList.remove('printing-padres'); }, 200);
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
    const all = this._pendientesPorRol();
    const resueltos = JSON.parse(localStorage.getItem('casanogal_pend_resueltos') || '[]');
    const list = all.filter(p => !resueltos.includes(p.id));
    document.getElementById('pendientesCount').textContent = list.length;
    document.getElementById('pendientesList').innerHTML = list.map(p =>
      `<div class="pendiente-item" data-pid="${p.id}"><span class="dot ${p.t}"></span><span>${UI.esc(p.msg)}</span></div>`
    ).join('');
    document.querySelectorAll('.pendiente-item').forEach(el => {
      el.addEventListener('click', () => {
        const pid = el.dataset.pid;
        const p = all.find(x => x.id === pid);
        if (p) Main._openPendienteModal(p);
      });
    });
  },

  _openPendienteModal(p) {
    const html = `
      <div class="pendiente-modal-overlay" id="pmOverlay">
        <div class="pendiente-modal">
          <div class="pendiente-modal-head">
            <span class="dot ${p.t}"></span>
            <div>
              <div class="pendiente-modal-title">${UI.esc(p.msg)}</div>
              <div class="pendiente-modal-eyebrow">${p.t === 'alert' ? 'Urgente' : p.t === 'warn' ? 'Importante' : 'Informativo'}</div>
            </div>
            <button class="panel-close" id="pmClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="pendiente-modal-body">
            <p>${UI.esc(p.detail || p.msg)}</p>
            ${p.action ? `<p class="pendiente-action"><b>Sugerencia:</b> ${UI.esc(p.action)}</p>` : ''}
          </div>
          <div class="pendiente-modal-foot">
            <button class="btn btn-ghost" id="pmCancel">Cerrar</button>
            <button class="btn btn-primary" id="pmResolve">Marcar como resuelto</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    const close = () => document.getElementById('pmOverlay')?.remove();
    document.getElementById('pmClose').addEventListener('click', close);
    document.getElementById('pmCancel').addEventListener('click', close);
    document.getElementById('pmOverlay').addEventListener('click', (e) => { if (e.target.id === 'pmOverlay') close(); });
    document.getElementById('pmResolve').addEventListener('click', () => {
      const resueltos = JSON.parse(localStorage.getItem('casanogal_pend_resueltos') || '[]');
      resueltos.push(p.id);
      localStorage.setItem('casanogal_pend_resueltos', JSON.stringify(resueltos));
      UI.toast('Pendiente marcado como resuelto', 'success');
      close();
      Main.renderPendientes();
    });
  },

  _pendientesPorRol() {
    if (State.role === 'padres') {
      return [
        { id:'p-pago',    t:'warn',  msg:'Pago boleta mayo pendiente',           detail:'La boleta del mes de mayo aún no se ha pagado. El monto total es $245.000 CLP.', action:'Realizar transferencia o pago en línea antes del 30 de mayo.' },
        { id:'p-prox',    t:'ok',    msg:'Próxima sesión: vie 9:55',             detail:'Sesión de Fonoaudiología con la terapeuta a cargo. Duración 35 minutos.', action:'Llegar 5 minutos antes para coordinación.' },
        { id:'p-informe', t:'warn',  msg:'Revisar informe mensual',              detail:'El informe de avance del mes está disponible para descarga.', action:'Descargar desde la pestaña Documentos de la ficha.' },
        { id:'p-reu',     t:'ok',    msg:'Reunión equipo programada',            detail:'Reunión bimensual con el equipo terapéutico de León.', action:'Confirmar asistencia respondiendo al correo.' },
        { id:'p-conf',    t:'warn',  msg:'Confirmar asistencia próxima sem',     detail:'Necesitamos confirmar la asistencia para la próxima semana del intensivo.', action:'Responder confirmando los días.' },
      ];
    }
    if (State.role === 'terapeuta') {
      const conf = Data.kpiConflictos();
      return [
        { id:'t-conf',  t:'alert', msg:`${conf.count} conflicto${conf.count===1?'':'s'} en tu agenda`, detail:`Hay ${conf.count} sesiones que chocan con otra terapeuta o sala. Revisa el calendario.`, action:'Click en el KPI Conflictos detectados para ver el detalle.' },
        { id:'t-notas', t:'warn',  msg:'Faltan notas de 4 sesiones de ayer',     detail:'Cuatro sesiones del jueves 14 quedaron sin notas clínicas.', action:'Abrir cada sesión y escribir la nota en el panel.' },
        { id:'t-obj',   t:'warn',  msg:'Revisar objetivos de Belén O.',          detail:'Los objetivos terapéuticos de Belén deben revisarse este mes según el plan.', action:'Ir a Fichas clínicas → Belén → pestaña Objetivos.' },
        { id:'t-reu',   t:'ok',    msg:'Reunión equipo intensivo · jue 17:30',   detail:'Reunión de coordinación del programa Intensivo 40.', action:'Sala COG, llevar bitácora de la semana.' },
        { id:'t-horas', t:'ok',    msg:'Hoja de horas lista para revisar',       detail:'Tu reporte de horas trabajadas en mayo está calculado y disponible.', action:'Revisar en Reportes y boletas → Pago profesionales.' },
      ];
    }
    const conf = Data.kpiConflictos();
    return [
      { id:'c-conf',  t:'alert', msg:`${conf.count} conflicto${conf.count===1?'':'s'} a resolver hoy`, detail:`Detectamos ${conf.count} sesiones que chocan automáticamente. BUSCARV no las habría detectado.`, action:'Click en el KPI rojo del calendario para ver detalle y resolver.' },
      { id:'c-bol',   t:'warn',  msg:'5 boletas listas para emitir',           detail:'5 boletas con sesiones realizadas y monto calculado están listas.', action:'Ir a Reportes y boletas → emitir las boletas del mes.' },
      { id:'c-equi',  t:'warn',  msg:'3 fichas sin equipo asignado',           detail:'Hay 3 niños recientes que aún no tienen equipo terapéutico asignado.', action:'Ir a Fichas clínicas → pestaña Equipo y asignar terapeutas.' },
      { id:'c-cierre',t:'ok',    msg:'Cierre semanal intensivo · vie',         detail:'Hoy viernes corresponde el cierre semanal del Intensivo 40.', action:'Revisar resumen de la semana en el dashboard.' },
      { id:'c-eval',  t:'ok',    msg:'2 nuevas evaluaciones esta semana',      detail:'Se sumaron 2 niños al programa de evaluación inicial.', action:'Ir a Fichas → grupo Otros programas.' },
    ];
  },
};

window.addEventListener('DOMContentLoaded', () => Main.init());
