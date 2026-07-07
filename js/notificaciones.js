// Módulo Notificaciones (pedido de Trini) — avisos al equipo, chat interno,
// reglas automáticas y plantillas de mail/formularios. Maqueta funcional para la demo.
const Notificaciones = {
  _chatKey: 'casanogal_chat',
  _reglasKey: 'casanogal_reglas_notif',
  _inboxKey: 'casanogal_notif_inbox_v2', // v2: avisos con destinatario estructurado (dest) filtrable por terapeuta

  PLANTILLAS_MSG: [
    { t: 'Inasistencia', m: 'El niño no asistirá hoy. Avisado al equipo que lo atiende.' },
    { t: 'Cambio de horario', m: 'Hubo un cambio de horario en tu agenda de esta semana. Revísalo en el calendario.' },
    { t: 'Llega cansado', m: 'La mamá avisa que el niño durmió mal y viene cansado. Considerar al planificar la sesión.' },
    { t: 'Recordatorio reunión', m: 'Recordatorio: reunión con los papás para revisar avances.' },
  ],
  REGLAS: [
    { id: 'inasistencia', label: 'Si un niño no asiste, avisar a su equipo tratante', on: true },
    { id: 'cambio_horario', label: 'Si cambia un horario, avisar al terapeuta afectado', on: true },
    { id: 'post_intensivo', label: 'A los 2 meses de terminado un intensivo, recordar reunión con los papás', on: true },
    { id: 'alta_vencida', label: 'Si un niño tiene el alta vencida, avisar a coordinación', on: false },
  ],
  MAILS: [
    { t: 'Pauta de evaluación inicial', d: 'Set de formularios que completan los papás antes de la evaluación. Al enviarse, queda en la ficha.' },
    { t: 'Consentimiento informado', d: 'Documento de ingreso al centro.' },
    { t: 'Cuestionario de seguimiento', d: 'Formulario mensual de avances percibidos por la familia.' },
  ],

  _leerChat() {
    try { return JSON.parse(localStorage.getItem(this._chatKey) || 'null') || this._chatSeed(); }
    catch { return this._chatSeed(); }
  },
  _chatSeed() {
    return [
      { autor: 'Krasna (TO)', txt: 'Hoy León vino muy regulado, avanzamos en vestido superior.', hora: '09:40' },
      { autor: 'Coordinación', txt: 'Perfecto. Recuerden que el viernes hay reunión de equipo a las 8:00.', hora: '10:05' },
      { autor: 'Camila (Psico)', txt: 'La mamá de Mati avisó que llega 10 min tarde.', hora: '10:20' },
    ];
  },
  _guardarChat(list) { localStorage.setItem(this._chatKey, JSON.stringify(list)); },

  // Bandeja de avisos recibidos (con estado leída/no leída)
  _leerInbox() {
    try { const a = JSON.parse(localStorage.getItem(this._inboxKey) || 'null'); if (Array.isArray(a)) return a; } catch {}
    return this._inboxSeed();
  },
  _inboxSeed() {
    // Avisos con destinatario estructurado (dest): 'todos' | 'ter:<id>' | 'nino:<id>'.
    // Se dirigen a terapeutas reales para que el terapeuta logueado vea avisos de inmediato.
    const ters = (State.data?.terapeutas || []).filter(t => t.estado === 'Activo');
    const t0 = ters[0], t1 = ters[1];
    const seed = [
      { id: 'N1', dest: 'todos', para: 'Todo el equipo', txt: 'Viernes 8:00 reunión de equipo. Confirmen asistencia.', hora: 'ayer', leida: false },
    ];
    if (t0) seed.push({ id: 'N2', dest: 'ter:' + t0.id_terapeuta, para: t0.nombre_completo, txt: 'León viene atrasado hoy, llega 10:15. Ajusta el inicio de su sesión.', hora: '09:30', leida: false });
    if (t1) seed.push({ id: 'N3', dest: 'ter:' + t1.id_terapeuta, para: t1.nombre_completo, txt: 'Cambio de horario: la sesión de Mati de mañana pasó a las 11:00.', hora: 'ayer', leida: false });
    return seed;
  },
  _guardarInbox(list) { localStorage.setItem(this._inboxKey, JSON.stringify(list)); },

  // Avisos que le corresponden a un terapeuta: los dirigidos a él, a todo el equipo,
  // o al equipo de un niño que atiende. Los avisos legacy sin dest quedan visibles.
  _avisosParaTerapeuta(tid) {
    if (!tid) return [];
    const misNinos = new Set((State.data?.equipo_asignado || [])
      .filter(e => e.id_terapeuta === tid && e.activa)
      .map(e => e.id_nino));
    return this._leerInbox().filter(n => {
      const d = n.dest || 'todos';
      if (d === 'todos') return true;
      if (d.startsWith('ter:')) return d.slice(4) === tid;
      if (d.startsWith('nino:')) return misNinos.has(d.slice(5));
      return true;
    });
  },

  // Inbox según el rol/usuario activo: el terapeuta ve solo lo suyo; coordinación ve todo.
  _inboxActivo() {
    if (State.role === 'terapeuta' && DEMO_USERS.terapeuta?.id_terapeuta) {
      return this._avisosParaTerapeuta(DEMO_USERS.terapeuta.id_terapeuta);
    }
    return this._leerInbox();
  },
  noLeidas() { return this._inboxActivo().filter(n => !n.leida).length; },

  _leerReglas() {
    try { const r = JSON.parse(localStorage.getItem(this._reglasKey) || 'null'); if (r) return r; } catch {}
    const base = {}; this.REGLAS.forEach(x => base[x.id] = x.on); return base;
  },
  _guardarReglas(r) { localStorage.setItem(this._reglasKey, JSON.stringify(r)); },

  render() {
    const ters = Data.terapeutasEfectivos().filter(t => t.estado === 'Activo');
    const ninos = (State.data.ninos || []).filter(n => n.estado === 'Activo');
    const reglas = this._leerReglas();
    const chat = this._leerChat();
    const esCoord = State.role === 'coordinacion'; // el terapeuta solo ve avisos y usa el chat; no crea notificaciones ni reglas
    const inbox = this._inboxActivo();             // terapeuta: solo sus avisos; coordinación: todos
    const noLeidas = inbox.filter(n => !n.leida).length;

    document.getElementById('main').innerHTML = `
      <div class="section-head"><div>
        <div class="section-title">Notificaciones ${noLeidas ? `<span class="notif-badge">${noLeidas}</span>` : ''}</div>
        <div class="section-sub">Avisa al equipo, define reglas automáticas y administra plantillas. Coordinación decide a quién le llega cada mensaje.</div>
      </div></div>

      <section class="ficha-section notif-inbox">
        <h2 class="ficha-section-title">${esCoord ? 'Avisos enviados' : 'Tus avisos'} ${noLeidas ? `<span class="ficha-section-count" style="background:var(--alert);color:#fff">${noLeidas} sin leer</span>` : ''}</h2>
        <div class="ficha-section-hint">${esCoord ? 'Todos los avisos que has mandado al equipo. Los sin leer quedan destacados.' : 'Coordinación te avisa acá (inasistencias, cambios de horario, recordatorios). Los sin leer quedan destacados hasta que marcas "ya la leí".'}</div>
        <div class="notif-inbox-list">
          ${inbox.length ? inbox.map(n => `
            <div class="notif-item${n.leida ? ' leida' : ''}">
              <div class="notif-item-body">
                <div class="notif-item-txt">${UI.esc(n.txt)}</div>
                <div class="notif-item-meta">Para: ${UI.esc(n.para)} · <span class="mono">${UI.esc(n.hora)}</span></div>
              </div>
              ${n.leida ? '<span class="notif-item-ok">Leído</span>' : `<button class="btn btn-ghost btn-sm notif-leer" data-id="${UI.esc(n.id)}" type="button">Ya la leí</button>`}
            </div>`).join('') : '<div class="empty-state"><div class="empty-state-title">Sin avisos</div></div>'}
        </div>
      </section>

      <div class="notif-grid">
        ${esCoord ? `
        <section class="ficha-section">
          <h2 class="ficha-section-title">Enviar un aviso</h2>
          <div class="field">
            <label class="field-label">Para</label>
            <select class="field-select" id="notifDest">
              <option value="todos">Todo el equipo</option>
              <optgroup label="Equipo de un niño">
                ${ninos.map(n => `<option value="nino:${n.id_nino}">Equipo de ${UI.esc(n.nombre_visible || n.nombre_completo)}</option>`).join('')}
              </optgroup>
              <optgroup label="Un terapeuta">
                ${ters.map(t => `<option value="ter:${t.id_terapeuta}">${UI.esc(t.nombre_completo)}</option>`).join('')}
              </optgroup>
            </select>
          </div>
          <div class="field">
            <label class="field-label">Plantillas rápidas</label>
            <div class="notif-tpls">
              ${this.PLANTILLAS_MSG.map((p, i) => `<button class="notif-tpl" type="button" data-tpl="${i}">${UI.esc(p.t)}</button>`).join('')}
            </div>
          </div>
          <div class="field">
            <label class="field-label">Mensaje</label>
            <textarea class="field-input" id="notifMsg" rows="3" placeholder="Escribe el aviso…"></textarea>
          </div>
          <button class="btn btn-primary" id="notifSend">Enviar aviso</button>
        </section>

        <section class="ficha-section">
          <h2 class="ficha-section-title">Avisos automáticos</h2>
          <div class="ficha-section-hint">Reglas que disparan un mensaje solo cuando ocurre el evento.</div>
          <div class="notif-reglas">
            ${this.REGLAS.map(r => `
              <label class="notif-regla">
                <input type="checkbox" data-regla="${r.id}" ${reglas[r.id] ? 'checked' : ''}>
                <span>${UI.esc(r.label)}</span>
              </label>`).join('')}
          </div>
        </section>
        ` : ''}

        <section class="ficha-section">
          <h2 class="ficha-section-title">Chat del equipo</h2>
          <div class="ficha-section-hint">Mensajería interna del centro · no la ven los padres.</div>
          <div class="chat-feed" id="chatFeed">
            ${chat.map(m => this._msgHtml(m)).join('')}
          </div>
          <div class="chat-input">
            <input type="text" id="chatTxt" class="field-input" placeholder="Mensaje al equipo…">
            <button class="btn btn-primary" id="chatSend">Enviar</button>
          </div>
        </section>

        ${esCoord ? `
        <section class="ficha-section">
          <h2 class="ficha-section-title">Mails y formularios predefinidos</h2>
          <div class="ficha-section-hint">Al enviarse un formulario y completarse, queda automáticamente archivado en la ficha del niño.</div>
          <div class="notif-mails">
            ${this.MAILS.map((m, i) => `
              <div class="notif-mail">
                <div>
                  <div class="notif-mail-t">${UI.esc(m.t)}</div>
                  <div class="notif-mail-d">${UI.esc(m.d)}</div>
                </div>
                <button class="btn btn-secondary notif-mail-send" data-mail="${i}">Enviar</button>
              </div>`).join('')}
          </div>
        </section>
        ` : ''}
      </div>
    `;

    // Plantillas → rellenan el textarea
    document.querySelectorAll('.notif-tpl').forEach(b =>
      b.addEventListener('click', () => { document.getElementById('notifMsg').value = this.PLANTILLAS_MSG[b.dataset.tpl].m; })
    );
    // Enviar aviso (solo coordinación)
    document.getElementById('notifSend')?.addEventListener('click', () => {
      const msg = document.getElementById('notifMsg').value.trim();
      if (!msg) { UI.toast('Escribe un mensaje primero', 'warn'); return; }
      const sel = document.getElementById('notifDest');
      const dest = sel.value;                                  // 'todos' | 'nino:<id>' | 'ter:<id>'
      const para = sel.options[sel.selectedIndex].text;        // texto legible
      const inbox = this._leerInbox();
      inbox.unshift({ id: 'N' + Date.now(), dest, para, txt: msg, hora: this._horaAhora(), leida: false });
      this._guardarInbox(inbox);
      UI.toast(`Aviso enviado a ${para}`, 'success');
      this.render();
    });
    // Marcar un aviso como leído
    document.querySelectorAll('.notif-leer').forEach(b =>
      b.addEventListener('click', () => {
        const inbox = this._leerInbox().map(n => n.id === b.dataset.id ? { ...n, leida: true } : n);
        this._guardarInbox(inbox);
        this.render();
      })
    );
    // Reglas
    document.querySelectorAll('[data-regla]').forEach(c =>
      c.addEventListener('change', () => {
        const r = this._leerReglas(); r[c.dataset.regla] = c.checked; this._guardarReglas(r);
        UI.toast(c.checked ? 'Regla activada' : 'Regla desactivada', 'success');
      })
    );
    // Chat
    const enviarChat = () => {
      const t = document.getElementById('chatTxt');
      const txt = t.value.trim();
      if (!txt) return;
      const list = this._leerChat();
      list.push({ autor: this._autorActual(), txt, hora: HOY_HORA ? this._horaAhora() : '' });
      this._guardarChat(list);
      document.getElementById('chatFeed').insertAdjacentHTML('beforeend', this._msgHtml(list[list.length - 1]));
      t.value = '';
      document.getElementById('chatFeed').scrollTop = 1e9;
    };
    document.getElementById('chatSend').addEventListener('click', enviarChat);
    document.getElementById('chatTxt').addEventListener('keydown', e => { if (e.key === 'Enter') enviarChat(); });
    // Mails
    document.querySelectorAll('.notif-mail-send').forEach(b =>
      b.addEventListener('click', () => UI.toast(`"${this.MAILS[b.dataset.mail].t}" enviado · quedará en la ficha al completarse`, 'success'))
    );
  },

  _horaAhora() {
    const h = Math.floor(HOY_HORA), m = Math.round((HOY_HORA - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  },

  // Abreviación corta de la especialidad para mostrar junto al nombre en el chat.
  _discAbrev(esp) {
    if (!esp) return '';
    const map = {
      'Terapia Ocupacional': 'TO', 'Fonoaudiología': 'Fono', 'Kinesiología': 'Kine',
      'Psicología': 'Psico', 'Cognitivo': 'Cog', 'Educación Cognitiva': 'Cog',
      'RDI': 'RDI', 'Neurología': 'Neuro',
    };
    return map[esp] || esp.split(' ')[0];
  },

  // Nombre con que firma el usuario activo en el chat (evita que el terapeuta aparezca como Coordinación).
  _autorActual() {
    if (State.role === 'terapeuta' && DEMO_USERS.terapeuta?.id_terapeuta) {
      const t = Data.terapeuta(DEMO_USERS.terapeuta.id_terapeuta);
      if (t) {
        const disc = this._discAbrev(t.especialidad);
        return `${t.nombre_visible || t.nombre_completo}${disc ? ` (${disc})` : ''}`;
      }
      return DEMO_USERS.terapeuta.short || 'Terapeuta';
    }
    if (State.role === 'padres') return 'Apoderado';
    return 'Coordinación';
  },

  _msgHtml(m) {
    const mine = m.autor === this._autorActual();
    return `<div class="chat-msg ${mine ? 'is-mine' : ''}">
      <div class="chat-msg-head">${UI.esc(m.autor)}${m.hora ? ` · <span class="mono">${UI.esc(m.hora)}</span>` : ''}</div>
      <div class="chat-msg-body">${UI.esc(m.txt)}</div>
    </div>`;
  },
};
