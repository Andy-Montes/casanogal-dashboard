// Login screen · pantalla de entrada general
const Login = {

  KEY: 'casanogal_session',

  read() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || 'null'); }
    catch { return null; }
  },

  save(session) { localStorage.setItem(this.KEY, JSON.stringify(session)); },

  clear() { localStorage.removeItem(this.KEY); },

  // Devuelve true si hay sesión válida; si no, muestra login y devuelve false.
  ensure() {
    const s = this.read();
    if (s && (s.tipo === 'admin' || (s.tipo === 'terapeuta' && s.id_terapeuta) || (s.tipo === 'padres' && s.id_nino))) return s;
    this.show();
    return null;
  },

  show() {
    document.getElementById('loginScreen')?.remove();
    const screen = document.createElement('section');
    screen.id = 'loginScreen';
    screen.className = 'login-screen';
    screen.innerHTML = this._html();
    document.body.appendChild(screen);
    ['appHeader', 'appSidebar', 'main', 'detailPanel'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
    });
    this._wire();
  },

  hide() {
    document.getElementById('loginScreen')?.remove();
    ['appHeader', 'appSidebar', 'main', 'detailPanel'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
    });
  },

  logout() {
    this.clear();
    location.reload();
  },

  _html() {
    return `
      <div class="login-card">
        <div class="login-brand">
          <svg viewBox="0 0 64 64" fill="none" class="login-logo" aria-hidden="true">
            <path d="M22 14C16 14 12 18 12 24C12 26 12.5 28 13.5 29.5C11 31 9 34 9 38C9 44 13 48 19 48C20 49.5 22 51 24 51C24 53 25 54 27 54C29 54 31 53 31 51V14C28 14 25 14 22 14Z" stroke="#E8A317" stroke-width="2.5"/>
            <path d="M42 14C48 14 52 18 52 24C52 26 51.5 28 50.5 29.5C53 31 55 34 55 38C55 44 51 48 45 48C44 49.5 42 51 40 51C40 53 39 54 37 54C35 54 33 53 33 51V14C36 14 39 14 42 14Z" stroke="#E8A317" stroke-width="2.5"/>
            <line x1="32" y1="14" x2="32" y2="51" stroke="#E8A317" stroke-width="2.5"/>
          </svg>
          <div class="login-brand-text">
            <div class="login-brand-name">casa<b>nogal</b></div>
            <div class="login-brand-tag">Centro de terapias · Sistema clínico</div>
          </div>
        </div>

        <h1 class="login-title">Bienvenida a Casa Nogal</h1>
        <p class="login-sub">Elige cómo quieres entrar hoy.</p>

        <div class="login-choice" id="loginChoice">
          <button class="login-option" data-tipo="admin">
            <div class="login-option-icon" style="background:var(--cn-azul);color:#fff">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 4 6v6c0 5 3.4 9.5 8 11 4.6-1.5 8-6 8-11V6l-8-4z"/></svg>
            </div>
            <div class="login-option-body">
              <div class="login-option-title">Entrar como Super Admin</div>
              <div class="login-option-sub">Trinidad Cervero · Coordinación general · ve todo el sistema</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>

          <button class="login-option" data-tipo="terapeuta">
            <div class="login-option-icon" style="background:var(--cn-mostaza);color:#fff">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg>
            </div>
            <div class="login-option-body">
              <div class="login-option-title">Entrar como Terapeuta</div>
              <div class="login-option-sub">Acceso al horario, niños y notas que te corresponden</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>

          <button class="login-option" data-tipo="padres">
            <div class="login-option-icon" style="background:#7BCBC4;color:#073835">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-9-5-9 5z"/><polyline points="3 7 12 13 21 7"/></svg>
            </div>
            <div class="login-option-body">
              <div class="login-option-title">Entrar como apoderado</div>
              <div class="login-option-sub">Mira el horario de tu hijo y su equipo · acceso con tu correo</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <div class="login-form" id="loginForm" style="display:none">
          <div class="login-form-head">
            <button class="login-back" id="loginBack" aria-label="Volver">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
              Volver
            </button>
          </div>

          <div id="loginFormAdmin">
            <div class="login-field">
              <label>Nombre</label>
              <input type="text" id="loginAdminName" value="Trinidad Cervero" readonly>
            </div>
            <div class="login-field">
              <label>Contraseña</label>
              <input type="password" id="loginAdminPwd" placeholder="Usa: admin" autocomplete="off">
              <div class="login-hint">Demo: contraseña <code>admin</code></div>
            </div>
            <button class="login-submit" id="loginAdminSubmit">Entrar al sistema</button>
            <div class="login-error" id="loginAdminErr" style="display:none">Contraseña incorrecta</div>
          </div>

          <div id="loginFormTer" style="display:none">
            <div class="login-field">
              <label>¿Quién eres?</label>
              <select id="loginTerSelect"></select>
            </div>
            <div class="login-field">
              <label>Contraseña</label>
              <input type="password" id="loginTerPwd" placeholder="Usa: 0000" autocomplete="off" maxlength="8">
              <div class="login-hint">Demo: contraseña <code>0000</code></div>
            </div>
            <button class="login-submit" id="loginTerSubmit">Entrar al sistema</button>
            <div class="login-error" id="loginTerErr" style="display:none">Contraseña incorrecta</div>
          </div>

          <div id="loginFormPadres" style="display:none">
            <div class="login-field">
              <label>Correo</label>
              <input type="email" id="loginPadEmail" placeholder="tu correo registrado" autocomplete="off">
              <div class="login-hint">Demo: cualquier correo registrado de un apoderado</div>
            </div>
            <div class="login-field">
              <label>Contraseña</label>
              <input type="password" id="loginPadPwd" placeholder="Usa: 1234" autocomplete="off">
              <div class="login-hint">Demo: contraseña <code>1234</code></div>
            </div>
            <button class="login-submit" id="loginPadSubmit">Entrar</button>
            <div class="login-error" id="loginPadErr" style="display:none">Datos incorrectos</div>
          </div>
        </div>

        <div class="login-foot">Sistema clínico Casa Nogal · uso interno</div>
      </div>
    `;
  },

  _wire() {
    const choice = document.getElementById('loginChoice');
    const form = document.getElementById('loginForm');
    const back = document.getElementById('loginBack');
    const adminForm = document.getElementById('loginFormAdmin');
    const terForm = document.getElementById('loginFormTer');
    const padForm = document.getElementById('loginFormPadres');

    document.querySelectorAll('.login-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const tipo = btn.dataset.tipo;
        choice.style.display = 'none';
        form.style.display = 'block';
        adminForm.style.display = tipo === 'admin' ? 'block' : 'none';
        terForm.style.display = tipo === 'terapeuta' ? 'block' : 'none';
        padForm.style.display = tipo === 'padres' ? 'block' : 'none';
        if (tipo === 'admin') setTimeout(() => document.getElementById('loginAdminPwd').focus(), 50);
        else if (tipo === 'terapeuta') { this._fillTerSelect(); setTimeout(() => document.getElementById('loginTerSelect').focus(), 50); }
        else setTimeout(() => document.getElementById('loginPadEmail').focus(), 50);
      });
    });

    back.addEventListener('click', () => {
      choice.style.display = 'flex';
      form.style.display = 'none';
      ['loginAdminPwd', 'loginTerPwd', 'loginPadEmail', 'loginPadPwd'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      ['loginAdminErr', 'loginTerErr', 'loginPadErr'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    });

    document.getElementById('loginAdminSubmit').addEventListener('click', () => this._submitAdmin());
    document.getElementById('loginAdminPwd').addEventListener('keydown', e => { if (e.key === 'Enter') this._submitAdmin(); });
    document.getElementById('loginTerSubmit').addEventListener('click', () => this._submitTer());
    document.getElementById('loginTerPwd').addEventListener('keydown', e => { if (e.key === 'Enter') this._submitTer(); });
    document.getElementById('loginPadSubmit').addEventListener('click', () => this._submitPadres());
    document.getElementById('loginPadPwd').addEventListener('keydown', e => { if (e.key === 'Enter') this._submitPadres(); });
  },

  _submitPadres() {
    const email = (document.getElementById('loginPadEmail').value || '').trim().toLowerCase();
    const pwd = document.getElementById('loginPadPwd').value;
    const err = document.getElementById('loginPadErr');
    if (pwd !== '1234') { err.textContent = 'Contraseña incorrecta (demo: 1234)'; err.style.display = 'block'; return; }
    // Buscar al niño cuyo apoderado tenga ese correo; si no, el primer activo (demo)
    const ninos = (State.data?.ninos) || [];
    const match = ninos.find(n => (n.email_apoderado || '').toLowerCase() === email);
    const nino = match || ninos.find(n => n.estado === 'Activo');
    if (!nino) { err.textContent = 'No encontramos un niño asociado a ese correo'; err.style.display = 'block'; return; }
    this.save({ tipo: 'padres', id_nino: nino.id_nino });
    this.hide();
    Main.init();
  },

  _fillTerSelect() {
    const sel = document.getElementById('loginTerSelect');
    if (!State.data) {
      sel.innerHTML = '<option>Cargando…</option>';
      // Cargar data si aún no está
      Data.load().then(() => this._fillTerSelect());
      return;
    }
    const lista = Data.terapeutasEfectivos()
      .filter(t => t.estado === 'Activo')
      .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
    sel.innerHTML = '<option value="">— Selecciona tu nombre —</option>' +
      lista.map(t => `<option value="${t.id_terapeuta}">${UI.esc(t.nombre_completo)} · ${UI.esc(t.especialidad)}</option>`).join('');
  },

  _submitAdmin() {
    const pwd = document.getElementById('loginAdminPwd').value;
    if (pwd !== 'admin') {
      document.getElementById('loginAdminErr').style.display = 'block';
      return;
    }
    this.save({ tipo: 'admin' });
    this.hide();
    Main.init();
  },

  _submitTer() {
    const tid = document.getElementById('loginTerSelect').value;
    const pwd = document.getElementById('loginTerPwd').value;
    if (!tid) {
      document.getElementById('loginTerErr').textContent = 'Selecciona tu nombre del listado';
      document.getElementById('loginTerErr').style.display = 'block';
      return;
    }
    if (pwd !== '0000') {
      document.getElementById('loginTerErr').textContent = 'Contraseña incorrecta';
      document.getElementById('loginTerErr').style.display = 'block';
      return;
    }
    this.save({ tipo: 'terapeuta', id_terapeuta: tid });
    this.hide();
    Main.init();
  },
};
