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
      if (t) DEMO_USERS.terapeuta = { id:'USR-TER-'+storedTer, name:t.nombre_completo, short:t.nombre_visible, avatar:t.abreviacion.slice(0,2), role:'Terapeuta', id_terapeuta:storedTer };
    }
    // Restaurar padre guardado
    const storedPad = localStorage.getItem('casanogal_padre_nino');
    if (storedPad) {
      const n = State.data.ninos.find(x => x.id_nino === storedPad);
      if (n) DEMO_USERS.padres = { id:'USR-PAD-'+storedPad, name:n.apoderado_principal, short:n.apoderado_principal.split(' ')[0], avatar:UI.initials(n.apoderado_principal), role:'Padre', id_nino:storedPad };
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
        const newRole = b.dataset.role;
        // Reset COMPLETO de filtros al cambiar de rol
        State.fichaActiva = null;
        State.searchQuery = '';
        State.filterFicha = 'all';
        State.filterPrograma = newRole === 'coordinacion' ? 'INT' : 'all';
        // Si pasa a terapeuta o padres, exigir login simple
        if (newRole === 'terapeuta') {
          this._openTerapeutaSelector(b);
          return;
        }
        if (newRole === 'padres') {
          this._openPadresSelector(b);
          return;
        }
        document.querySelectorAll('#roleSwitcher .role-pill').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        State.role = newRole;
        State.currentUser = DEMO_USERS[newRole];
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
        // Limpiar el estado pegado al cambiar de módulo
        State.fichaActiva = null;
        State.searchQuery = '';
        State.filterFicha = 'all';
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
    // Padres: redirigir módulos no accesibles a Calendario
    if (State.role === 'padres' && ['reportes','equipo','ninos','salas','config','permisos'].includes(State.module)) {
      State.module = 'calendario';
      this.activateNav('calendario');
    }
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
    this._aplicarVisibilidadSidebar();
  },

  _aplicarVisibilidadSidebar() {
    const isPadre = State.role === 'padres';
    // En rol padres: solo calendario y fichas (su hijo) visibles
    document.querySelectorAll('.nav-item').forEach(item => {
      const mod = item.dataset.module;
      const ocultar = isPadre && ['reportes','equipo','ninos','salas','config','permisos'].includes(mod);
      item.style.display = ocultar ? 'none' : '';
    });
    document.querySelectorAll('.nav-section').forEach(sec => {
      const visibles = sec.querySelectorAll('.nav-item:not([style*="display: none"])').length;
      sec.style.display = visibles === 0 ? 'none' : '';
    });
  },

  _openTerapeutaSelector(pillEl) {
    const lista = State.data.terapeutas.filter(t => t.estado === 'Activo').sort((a, b) => a.nombre_visible.localeCompare(b.nombre_visible));
    this._renderLoginModal({
      titulo: 'Entrar como terapeuta',
      eyebrow: `Selecciona tu nombre · ${lista.length} activos`,
      iconColor: 'var(--cn-azul)',
      lista: lista.map(t => {
        const c = ESPECIALIDAD_VAR[t.especialidad];
        return {
          id: t.id_terapeuta,
          avatar: t.abreviacion,
          color: { bg: c?.bg || 'var(--cn-azul-bg)', text: c?.text || 'var(--cn-azul-deep)' },
          nombre: t.nombre_completo,
          sub: `${t.especialidad} · ${t.tipo_contrato}`,
        };
      }),
      onConfirm: (tid) => {
        this._setTerapeutaActivo(tid, false);
        this._aplicarRol('terapeuta', pillEl);
      },
      onCancel: () => {
        // Si cancela, vuelve a coordinación
        const coord = document.querySelector('[data-role=coordinacion]');
        if (coord) {
          document.querySelectorAll('#roleSwitcher .role-pill').forEach(x => x.classList.remove('active'));
          coord.classList.add('active');
        }
      },
    });
  },

  _openPadresSelector(pillEl) {
    const lista = State.data.ninos.filter(n => n.estado === 'Activo').sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
    this._renderLoginModal({
      titulo: 'Entrar como apoderado',
      eyebrow: `Selecciona el niño · ${lista.length} fichas`,
      iconColor: 'var(--cn-mostaza)',
      lista: lista.map(n => ({
        id: n.id_nino,
        avatar: UI.initials(n.nombre_completo),
        color: UI.colorNino(n.id_nino),
        nombre: n.nombre_completo,
        sub: `${n.programa_nombre} · apoderado: ${n.apoderado_principal}`,
      })),
      onConfirm: (nid) => {
        const n = Data.nino(nid);
        if (n) {
          DEMO_USERS.padres = {
            id: 'USR-PAD-' + nid,
            name: n.apoderado_principal,
            short: n.apoderado_principal.split(' ')[0],
            avatar: UI.initials(n.apoderado_principal),
            role: 'Padre',
            id_nino: nid,
          };
          localStorage.setItem('casanogal_padre_nino', nid);
        }
        this._aplicarRol('padres', pillEl);
      },
      onCancel: () => {
        const coord = document.querySelector('[data-role=coordinacion]');
        if (coord) {
          document.querySelectorAll('#roleSwitcher .role-pill').forEach(x => x.classList.remove('active'));
          coord.classList.add('active');
        }
      },
    });
  },

  _renderLoginModal({ titulo, eyebrow, iconColor, lista, onConfirm, onCancel }) {
    let selectedId = null;
    const html = `
      <div class="pendiente-modal-overlay" id="loginOverlay">
        <div class="pendiente-modal" style="width:min(460px,92vw)">
          <div class="pendiente-modal-head">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:${iconColor}"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <div>
              <div class="pendiente-modal-title">${UI.esc(titulo)}</div>
              <div class="pendiente-modal-eyebrow">${UI.esc(eyebrow)}</div>
            </div>
            <button class="panel-close" id="loginClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="pendiente-modal-body" style="max-height:50vh;overflow-y:auto;padding:8px 12px">
            <div class="ter-selector-list" id="loginList">
              ${lista.map(item => `
                <button class="ter-selector-row" data-id="${UI.esc(item.id)}">
                  <span class="equipo-avatar" style="background:${item.color.bg};color:${item.color.text}">${UI.esc(item.avatar)}</span>
                  <div style="flex:1;text-align:left">
                    <div style="font-weight:600">${UI.esc(item.nombre)}</div>
                    <div style="font-size:11px;color:var(--text-3)">${UI.esc(item.sub)}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              `).join('')}
            </div>
          </div>
          <div class="login-pwd-section" id="loginPwdSection" style="display:none">
            <div class="login-pwd-title">Entrando como <b id="loginPwdName">—</b></div>
            <input type="password" id="loginPwd" class="field-input" placeholder="Contraseña · usa 0000 para esta demo" maxlength="8" autocomplete="off">
            <div class="field-warn" id="loginPwdErr" style="display:none">Contraseña incorrecta</div>
          </div>
          <div class="pendiente-modal-foot" id="loginFoot" style="display:none">
            <button class="btn btn-ghost" id="loginBack">← Volver</button>
            <button class="btn btn-primary" id="loginConfirm">Entrar</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    const close = (didConfirm) => {
      document.getElementById('loginOverlay')?.remove();
      if (!didConfirm && onCancel) onCancel();
    };
    document.getElementById('loginClose').addEventListener('click', () => close(false));
    document.getElementById('loginOverlay').addEventListener('click', (e) => { if (e.target.id === 'loginOverlay') close(false); });
    document.querySelectorAll('#loginList .ter-selector-row').forEach(row => {
      row.addEventListener('click', () => {
        selectedId = row.dataset.id;
        const item = lista.find(x => x.id === selectedId);
        document.getElementById('loginList').style.display = 'none';
        document.getElementById('loginPwdSection').style.display = 'block';
        document.getElementById('loginFoot').style.display = 'flex';
        document.getElementById('loginPwdName').textContent = item.nombre;
        document.getElementById('loginPwd').focus();
      });
    });
    document.getElementById('loginBack').addEventListener('click', () => {
      document.getElementById('loginList').style.display = 'flex';
      document.getElementById('loginPwdSection').style.display = 'none';
      document.getElementById('loginFoot').style.display = 'none';
      document.getElementById('loginPwd').value = '';
      document.getElementById('loginPwdErr').style.display = 'none';
      selectedId = null;
    });
    const tryConfirm = () => {
      const pwd = document.getElementById('loginPwd').value;
      if (pwd !== '0000') {
        document.getElementById('loginPwdErr').style.display = 'flex';
        document.getElementById('loginPwd').value = '';
        document.getElementById('loginPwd').focus();
        return;
      }
      close(true);
      onConfirm(selectedId);
    };
    document.getElementById('loginConfirm').addEventListener('click', tryConfirm);
    document.getElementById('loginPwd').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryConfirm(); });
  },

  _aplicarRol(role, pillEl) {
    document.querySelectorAll('#roleSwitcher .role-pill').forEach(x => x.classList.remove('active'));
    if (pillEl) pillEl.classList.add('active');
    State.role = role;
    State.currentUser = DEMO_USERS[role];
    this.refreshUserChip();
    this.refreshCounts();
    this.renderPendientes();
    this._renderModule();
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
    // Forzar vista calendario antes de imprimir (PDF = horario semanal completo)
    if (State.module !== 'calendario') {
      State.module = 'calendario';
      this.activateNav('calendario');
      this._renderModule();
    }
    document.body.classList.add('printing-padres');
    UI.toast('Preparando PDF · horario semanal completo', 'success');
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove('printing-padres'), 600);
    }, 350);
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
      const n = Data.nino(DEMO_USERS.padres.id_nino) || {};
      return [
        { id:'p-pago',    t:'warn',  msg:'Pago boleta mayo pendiente',           detail:`La boleta del mes de mayo de ${UI.esc(n.nombre_completo || 'tu hijo')} está pendiente de pago.`, action:'El detalle del monto y los datos de transferencia los recibirás por correo desde coordinación.' },
        { id:'p-prox',    t:'ok',    msg:'Próxima sesión esta semana',           detail:'Hay sesiones agendadas en los próximos días.', action:'Revisa el calendario semanal arriba para ver día, hora y tipo de terapia.' },
        { id:'p-informe', t:'warn',  msg:'Informe mensual disponible',           detail:'El informe de avance del último mes está listo.', action:'Coordinación te lo envía por correo. También aparecerá en el botón Descargar PDF de esta vista.' },
        { id:'p-reu',     t:'ok',    msg:'Reunión con el equipo terapéutico',    detail:'Reunión bimensual programada para revisar avances y objetivos.', action:'Confirma la asistencia respondiendo al correo enviado por coordinación.' },
        { id:'p-conf',    t:'warn',  msg:'Confirmar asistencia próxima semana',  detail:'Necesitamos confirmar la asistencia para los días de la próxima semana.', action:'Responde al correo de coordinación indicando los días disponibles.' },
      ];
    }
    if (State.role === 'terapeuta') {
      const conf = Data.kpiConflictos();
      const tName = DEMO_USERS.terapeuta?.short || 'terapeuta';
      return [
        { id:'t-conf',  t:'alert', msg:`${conf.count} conflicto${conf.count===1?'':'s'} en tu agenda`, detail:`Hay ${conf.count} sesiones que chocan con otra terapeuta o sala en tu agenda de esta semana.`, action:'En el módulo Calendario, click en la tarjeta roja "Conflictos detectados" para ver el detalle.' },
        { id:'t-notas', t:'warn',  msg:'Faltan notas en sesiones recientes',     detail:'Algunas sesiones realizadas todavía no tienen notas clínicas registradas.', action:'Abre cualquier sesión del calendario y escribe la nota en el panel lateral.' },
        { id:'t-obj',   t:'warn',  msg:'Revisar objetivos del mes',              detail:'Los objetivos terapéuticos de tus niños asignados deben revisarse mensualmente.', action:'En Fichas clínicas abre la ficha de cada niño asignado y revisa la pestaña Objetivos.' },
        { id:'t-reu',   t:'ok',    msg:'Reunión de equipo programada',           detail:'Reunión de coordinación del programa Intensivo esta semana.', action:'Revisa el detalle en el correo del centro.' },
        { id:'t-horas', t:'ok',    msg:'Tu hoja de horas está lista',            detail:`Tus horas trabajadas en mayo están calculadas, ${UI.esc(tName)}.`, action:'En el módulo Reportes y boletas, abajo aparece tu fila con horas, valor y monto.' },
      ];
    }
    const conf = Data.kpiConflictos();
    return [
      { id:'c-conf',  t:'alert', msg:`${conf.count} conflicto${conf.count===1?'':'s'} a resolver hoy`, detail:`Detectamos ${conf.count} sesiones que chocan en sala o terapeuta.`, action:'En el módulo Calendario, click en la tarjeta roja "Conflictos detectados" para ver y resolver.' },
      { id:'c-bol',   t:'warn',  msg:'5 boletas listas para emitir',           detail:'Hay 5 boletas del mes con sesiones realizadas y monto calculado automáticamente.', action:'En el módulo Reportes y boletas se ve la tabla completa para emitir.' },
      { id:'c-equi',  t:'warn',  msg:'3 fichas con equipo incompleto',         detail:'Hay 3 niños que aún no tienen todo el equipo terapéutico asignado.', action:'En Fichas clínicas abre la ficha del niño y revisa la pestaña Equipo.' },
      { id:'c-cierre',t:'ok',    msg:'Cierre semanal del Intensivo · viernes', detail:'Hoy viernes corresponde el cierre semanal del programa Intensivo 40.', action:'Revisa la semana completa en el módulo Calendario.' },
      { id:'c-eval',  t:'ok',    msg:'2 nuevas evaluaciones esta semana',      detail:'Se sumaron 2 niños al programa de Evaluación inicial.', action:'En Fichas clínicas aparecen en el grupo "Otros programas".' },
    ];
  },
};

window.addEventListener('DOMContentLoaded', () => Main.init());
