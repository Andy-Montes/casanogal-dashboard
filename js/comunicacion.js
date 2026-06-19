// Comunicación con familias.
// - Rol coordinación: consola para preparar/enviar lo que recibe la familia.
// - Rol apoderado (padres): pantalla propia del papá con el horario del niño.
const Comunicacion = {

  render() {
    if (State.role === 'padres') return this._renderPadre();
    return this._renderCoordinacion();
  },

  // ======================================================================
  // VISTA DEL APODERADO · lo que ve el papá al entrar "como apoderado"
  // ======================================================================
  _renderPadre() {
    const main = document.getElementById('main');
    if (!main) return;
    const n = Data.nino(DEMO_USERS.padres.id_nino);
    if (!n) {
      main.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">No encontramos la ficha del niño</div>
          <div class="empty-state-sub">Cambia de apoderado desde el selector de rol.</div>
        </div>`;
      return;
    }
    main.innerHTML = `
      <div id="paRoot" class="pa-root">
        ${this._paHeader(n)}
        ${this._paResumen(n)}
        ${this._paHorario(n)}
        ${this._paEquipo(n)}
        ${this._paDocs(n)}
        <p class="pa-closing">Estamos aquí para acompañarlos a ${UI.esc((n.nombre_completo || '').split(' ')[0])} y a ustedes. Cualquier duda, escríbennos.</p>
      </div>`;
    this._paWire();
  },

  _paHeader(n) {
    const primer = (n.nombre_completo || '').split(' ')[0];
    return `
      <div class="pa-hero">
        <div>
          <div class="pa-hero-eyebrow">Hola, ${UI.esc((n.apoderado_principal || '').split(' ')[0] || 'familia')}</div>
          <h1 class="pa-hero-title">El acompañamiento de ${UI.esc(primer)}</h1>
          <div class="pa-hero-sub">${UI.esc(n.programa_nombre || '')}${n.semana_actual ? ` · semana ${n.semana_actual}` : ''}</div>
        </div>
        <button class="btn btn-secondary" id="paDescargar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Descargar resumen PDF
        </button>
      </div>`;
  },

  _paResumen(n) {
    const mesIso = HOY_ISO.slice(0, 7);
    const sesMes = Data.sesionesDeNino(n.id_nino).filter(s => s.fecha.startsWith(mesIso));
    const total = sesMes.length;
    const realizadas = sesMes.filter(s => s.estado === 'Realizada').length;
    const futuras = sesMes.filter(s => s.estado === 'Agendada' && s.fecha >= HOY_ISO).length;
    return `
      <div class="pa-stats">
        <div class="pa-stat"><b>${total}</b><span>sesiones este mes</span></div>
        <div class="pa-stat"><b>${realizadas}</b><span>completadas</span></div>
        <div class="pa-stat"><b>${futuras}</b><span>por venir</span></div>
      </div>`;
  },

  _paHorario(n) {
    const fechas = fechasSemana();
    const sesNino = Data.sesionesDeNino(n.id_nino).filter(s => fechas.includes(s.fecha));
    const porDia = fechas.map(f => sesNino.filter(s => s.fecha === f).sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || '')));
    const cols = fechas.map((f, i) => {
      const [, , d] = f.split('-').map(Number);
      const ses = porDia[i];
      const esHoy = f === HOY_ISO;
      const cuerpo = ses.length
        ? ses.map(s => this._paSesionCard(s)).join('')
        : '<div class="pa-day-empty">Sin sesiones</div>';
      return `
        <div class="pa-day${esHoy ? ' is-today' : ''}">
          <div class="pa-day-head"><span class="pa-day-name">${DIAS_ABBR[i]}</span><span class="pa-day-date">${d}</span></div>
          <div class="pa-day-body">${cuerpo}</div>
        </div>`;
    }).join('');
    return `
      <section id="paHorarioWrap" class="pa-card">
        <div class="pa-card-head">
          <div>
            <div class="pa-card-eyebrow">Horario</div>
            <h2 class="pa-card-title">Sus sesiones esta semana</h2>
          </div>
          <div class="pa-week-nav">
            <button class="pa-week-btn" data-pa-week="-7" aria-label="Semana anterior">‹</button>
            <span class="pa-week-label">${this._paRangoSemana()}</span>
            <button class="pa-week-btn" data-pa-week="7" aria-label="Semana siguiente">›</button>
          </div>
        </div>
        <div class="pa-week">${cols}</div>
      </section>`;
  },

  _paSesionCard(s) {
    const sala = Data.sala(s.id_sala);
    const estado = s.estado || '';
    const cls = estado === 'Realizada' ? 'is-done'
              : estado === 'Cancelada' ? 'is-cancel'
              : estado === 'No Asistió' ? 'is-miss' : 'is-next';
    const rango = s.hora_inicio && s.hora_fin ? `${s.hora_inicio}–${s.hora_fin}` : (s.hora_inicio || '');
    return `
      <div class="pa-ses ${cls}">
        <div class="pa-ses-time mono">${UI.esc(rango)}</div>
        <div class="pa-ses-esp">${UI.esc(s.tipo_terapia || '')}</div>
        <div class="pa-ses-sala">${UI.esc(sala?.nombre || s.sala_nombre || '')}</div>
      </div>`;
  },

  _paEquipo(n) {
    const equipo = Data.equipoDeNino(n.id_nino);
    if (!equipo.length) return '';
    const items = equipo.map(e => {
      const t = Data.terapeuta(e.id_terapeuta);
      if (!t) return '';
      const c = ESPECIALIDAD_VAR[t.especialidad] || {};
      return `
        <li class="pa-team-item">
          <span class="pa-team-dot" style="background:${c.main || 'var(--cn-azul)'}"></span>
          <span class="pa-team-name">${UI.esc(t.nombre_completo)}</span>
          <span class="pa-team-role">${UI.esc(t.especialidad || '')}</span>
        </li>`;
    }).join('');
    return `
      <section class="pa-card">
        <div class="pa-card-head"><div><div class="pa-card-eyebrow">Equipo</div><h2 class="pa-card-title">Quiénes acompañan a ${UI.esc((n.nombre_completo || '').split(' ')[0])}</h2></div></div>
        <ul class="pa-team-list">${items}</ul>
      </section>`;
  },

  _paDocs(n) {
    const docs = Data.documentosDeNino(n.id_nino)
      .slice()
      .sort((a, b) => (b.fecha_documento || '').localeCompare(a.fecha_documento || ''));
    const cuerpo = docs.length
      ? docs.map(d => {
          const ico = this._paDocIcon(d.tipo);
          return `
            <li class="pa-doc" data-pa-doc="${UI.esc(d.id_documento)}">
              <span class="pa-doc-ico pa-doc-ico-${this._paDocKind(d.tipo)}">${ico}</span>
              <span class="pa-doc-main">
                <span class="pa-doc-tipo">${UI.esc(d.tipo || 'Documento')}</span>
                <span class="pa-doc-desc">${UI.esc(d.descripcion || d.nombre_archivo || '')}</span>
              </span>
              <span class="pa-doc-fecha mono">${UI.esc(UI.fmtFecha(d.fecha_documento) || '')}</span>
              <span class="pa-doc-dl" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </span>
            </li>`;
        }).join('')
      : `<li class="pa-doc-empty">Aún no hay documentos cargados. Cuando coordinación suba órdenes médicas, informes o evaluaciones, aparecerán acá.</li>`;
    return `
      <section class="pa-card">
        <div class="pa-card-head"><div><div class="pa-card-eyebrow">Documentación</div><h2 class="pa-card-title">Órdenes médicas y documentos</h2></div></div>
        <ul class="pa-doc-list">${cuerpo}</ul>
      </section>`;
  },

  _paDocKind(tipo) {
    const t = (tipo || '').toLowerCase();
    if (t.includes('orden')) return 'orden';
    if (t.includes('informe')) return 'informe';
    if (t.includes('evaluaci')) return 'eval';
    if (t.includes('consentimiento')) return 'consent';
    return 'otro';
  },

  _paDocIcon(tipo) {
    const k = this._paDocKind(tipo);
    if (k === 'orden') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg>';
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  },

  _paRangoSemana() {
    const fechas = fechasSemana();
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const [, m1, d1] = fechas[0].split('-').map(Number);
    const [, m5, d5] = fechas[4].split('-').map(Number);
    return m1 === m5 ? `${d1}–${d5} ${meses[m1 - 1]}` : `${d1} ${meses[m1 - 1]} – ${d5} ${meses[m5 - 1]}`;
  },

  _shiftISO(iso, days) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  },

  _paWire() {
    const root = document.getElementById('paRoot');
    if (!root) return;
    root.addEventListener('click', (e) => {
      const wk = e.target.closest('[data-pa-week]');
      if (wk) {
        State.weekStart = this._shiftISO(State.weekStart, parseInt(wk.dataset.paWeek, 10));
        const wrap = document.getElementById('paHorarioWrap');
        if (wrap) wrap.outerHTML = this._paHorario(Data.nino(DEMO_USERS.padres.id_nino));
        return;
      }
      if (e.target.closest('#paDescargar')) { Main._downloadPDF(); return; }
      const doc = e.target.closest('[data-pa-doc]');
      if (doc) { UI.toast('En la versión final el documento se descarga aquí', 'success'); }
    });
  },

  // ======================================================================
  // CONSOLA DE COORDINACIÓN · preparar/enviar lo que recibe la familia
  // ======================================================================
  _renderCoordinacion() {
    const main = document.getElementById('main');
    if (!main) return;
    const id = DEMO_USERS.padres.id_nino;
    const n = Data.nino(id);
    if (!n) {
      main.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-3);opacity:0.5;margin-bottom:12px"><circle cx="9" cy="7" r="4"/><path d="M3 21v-1a6 6 0 0 1 12 0v1"/><path d="M19 14v6"/><path d="M16 17h6"/></svg>
          <div class="empty-state-title">No hay niños activos registrados</div>
          <div class="empty-state-sub">Agrega un niño desde Fichas clínicas para poder comunicarte con su familia.</div>
        </div>`;
      return;
    }

    main.innerHTML = `
      <div class="section-head">
        <div>
          <div class="section-eyebrow">Consola familia</div>
          <div class="section-title">Comunicación con la familia de ${UI.esc(n.nombre_completo)}</div>
          <div class="section-sub">Revisa qué información se le envía, descarga el PDF o envíalo por mail. Esta vista no la ven los padres.</div>
        </div>
        <div class="cf-selector">
          <label>Niño</label>
          <select id="cfNinoSelect"></select>
        </div>
      </div>

      <div id="cfContent"></div>
    `;

    this._fillSelector(id);
    this._renderContent(id);

    document.getElementById('cfNinoSelect').addEventListener('change', (e) => {
      const newId = e.target.value;
      const newN = Data.nino(newId);
      if (newN) {
        DEMO_USERS.padres = {
          id: 'USR-PAD-' + newId,
          name: newN.apoderado_principal,
          short: newN.apoderado_principal.split(' ')[0],
          avatar: UI.initials(newN.apoderado_principal),
          role: 'Padre',
          id_nino: newId,
        };
        Main.refreshUserChip();
        Main._injectRoleBanner();
        this._renderContent(newId);
      }
    });
  },

  _fillSelector(idActual) {
    const sel = document.getElementById('cfNinoSelect');
    const lista = State.data.ninos
      .filter(n => n.estado === 'Activo')
      .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
    sel.innerHTML = lista.map(n => `<option value="${n.id_nino}" ${n.id_nino === idActual ? 'selected' : ''}>${UI.esc(n.nombre_completo)} · ${UI.esc(n.programa_nombre)}</option>`).join('');
  },

  _renderContent(id) {
    const cont = document.getElementById('cfContent');
    if (!cont) return;
    const n = Data.nino(id);
    if (!n) { cont.innerHTML = ''; return; }

    cont.innerHTML = `
      ${this._contactoBlock(n)}
      ${this._previewBlock(n)}
      ${this._actionsBar(n)}
    `;

    this._wireActions(id);
  },

  _contactoBlock(n) {
    const diag = (n.diagnosticos || []).map(UI.esc).join(', ') || '—';
    return `
      <div class="cf-card cf-contacto">
        <div class="cf-card-head">
          <div class="cf-card-title">Datos de contacto familiar</div>
          <div class="cf-card-sub">Información que usa coordinación para enviar comunicaciones. No se muestra en el PDF.</div>
        </div>
        <div class="cf-grid">
          <div class="cf-field">
            <div class="cf-label">Apoderado</div>
            <div class="cf-value">${UI.esc(n.apoderado_principal || '—')}</div>
          </div>
          <div class="cf-field">
            <div class="cf-label">Email</div>
            <div class="cf-value cf-mail"><a href="mailto:${UI.esc(n.email_apoderado || '')}">${UI.esc(n.email_apoderado || '—')}</a></div>
          </div>
          <div class="cf-field">
            <div class="cf-label">Teléfono</div>
            <div class="cf-value mono">${UI.esc(n.telefono_apoderado || '—')}</div>
          </div>
          <div class="cf-field">
            <div class="cf-label">Programa</div>
            <div class="cf-value">${UI.esc(n.programa_nombre || '—')} · semana ${n.semana_actual || '—'}</div>
          </div>
          <div class="cf-field cf-field-wide">
            <div class="cf-label">Diagnósticos</div>
            <div class="cf-value">${diag}</div>
          </div>
          <div class="cf-field cf-field-wide">
            <div class="cf-label">Consideraciones</div>
            <div class="cf-value">${UI.esc(n.consideraciones || 'Sin consideraciones especiales registradas')}</div>
          </div>
        </div>
      </div>
    `;
  },

  _previewBlock(n) {
    return `
      <div class="cf-card">
        <div class="cf-card-head">
          <div class="cf-card-title">Vista previa de lo que recibirá la familia</div>
          <div class="cf-card-sub">Este es el contenido del PDF / mail que se enviará a ${UI.esc(n.apoderado_principal || 'la familia')}.</div>
        </div>
        <div class="cf-preview">
          ${this._previewResumen(n)}
          ${this._previewHorario(n)}
          ${this._previewEquipo(n)}
        </div>
      </div>
    `;
  },

  _previewResumen(n) {
    const mesIso = HOY_ISO.slice(0, 7);
    const sesMes = Data.sesionesDeNino(n.id_nino).filter(s => s.fecha.startsWith(mesIso));
    const total = sesMes.length;
    const realizadas = sesMes.filter(s => s.estado === 'Realizada').length;
    const futuras = sesMes.filter(s => s.estado === 'Agendada' && s.fecha >= HOY_ISO).length;
    return `
      <div class="cf-prev-section">
        <div class="cf-prev-h">Este mes con ${UI.esc((n.nombre_completo || '').split(' ')[0])}</div>
        <div class="cf-prev-stats">
          <div class="cf-prev-stat"><b>${total}</b><span>agendadas</span></div>
          <div class="cf-prev-stat"><b>${realizadas}</b><span>completadas</span></div>
          <div class="cf-prev-stat"><b>${futuras}</b><span>por venir</span></div>
        </div>
      </div>
    `;
  },

  _previewEquipo(n) {
    const equipo = Data.equipoDeNino(n.id_nino);
    if (!equipo.length) return '';
    const items = equipo.map(e => {
      const t = Data.terapeuta(e.id_terapeuta);
      if (!t) return '';
      return `<li><span>${UI.esc(t.nombre_completo)}</span><em>${UI.esc(t.especialidad)}</em></li>`;
    }).join('');
    return `
      <div class="cf-prev-section">
        <div class="cf-prev-h cf-prev-h-soft">Equipo que acompaña a ${UI.esc((n.nombre_completo || '').split(' ')[0])}</div>
        <ul class="cf-prev-equipo-list">${items}</ul>
      </div>
    `;
  },

  _previewHorario(n) {
    const fechas = fechasSemana();
    const sesNino = Data.sesionesDeNino(n.id_nino).filter(s => fechas.includes(s.fecha));
    const porDia = fechas.map(f => sesNino.filter(s => s.fecha === f).sort((a,b)=>(a.hora_inicio||'').localeCompare(b.hora_inicio||'')));
    const cols = fechas.map((f, i) => {
      const [, , d] = f.split('-').map(Number);
      const ses = porDia[i];
      const cuerpo = ses.length
        ? ses.map(s => `<div class="cf-prev-ses"><span class="mono">${UI.esc(s.hora_inicio || '')}</span> ${UI.esc(s.tipo_terapia || '')}<small>${UI.esc(s.sala_nombre || '')}</small></div>`).join('')
        : '<div class="cf-prev-empty">—</div>';
      return `<div class="cf-prev-day"><div class="cf-prev-day-head">${DIAS_ABBR[i]} ${d}</div><div class="cf-prev-day-body">${cuerpo}</div></div>`;
    }).join('');
    return `
      <div class="cf-prev-section">
        <div class="cf-prev-h">Sesiones de esta semana</div>
        <div class="cf-prev-week">${cols}</div>
      </div>
    `;
  },

  _actionsBar(n) {
    const email = n.email_apoderado || 'sin-email';
    return `
      <div class="cf-actions">
        <button class="btn btn-secondary" id="cfPreview">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
          Vista previa PDF
        </button>
        <button class="btn btn-secondary" id="cfDownload">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Descargar PDF
        </button>
        <button class="btn btn-primary" id="cfMail">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>
          Enviar por mail a ${UI.esc(email)}
        </button>
        <a href="#" class="cf-sim" id="cfSim">o simular envío</a>
      </div>
    `;
  },

  _wireActions(id) {
    document.getElementById('cfPreview')?.addEventListener('click', () => this._abrirPDF(id, 'preview'));
    document.getElementById('cfDownload')?.addEventListener('click', () => this._abrirPDF(id, 'download'));
    document.getElementById('cfMail')?.addEventListener('click', () => this._enviarMail(id));
    document.getElementById('cfSim')?.addEventListener('click', (e) => { e.preventDefault(); this._simularEnvio(id); });
  },

  _abrirPDF(id, modo) {
    const ok = PDFPadres.render(id);
    if (!ok) { UI.toast('No se pudo generar el PDF', 'error'); return; }
    document.body.classList.add('printing-padres');
    UI.toast(modo === 'download' ? 'Guarda como PDF desde el diálogo de impresión' : 'Abriendo vista previa', 'success');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing-padres');
        PDFPadres.cleanup();
      }, 800);
    }, 250);
  },

  _enviarMail(id) {
    const n = Data.nino(id);
    if (!n) return;
    const email = n.email_apoderado;
    if (!email) { UI.toast('Esta familia no tiene email registrado', 'error'); return; }
    const btn = document.getElementById('cfMail');
    if (btn) {
      btn.disabled = true;
      const original = btn.innerHTML;
      btn.innerHTML = '<svg class="cf-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Abriendo correo…';
      setTimeout(() => { btn.disabled = false; btn.innerHTML = original; }, 1800);
    }
    const link = PDFPadres.mailto(id);
    window.location.href = link;
    UI.toast(`Abriendo tu cliente de correo · ${email}`, 'success');
  },

  _simularEnvio(id) {
    const n = Data.nino(id);
    if (!n) return;
    UI.toast(`Envío simulado a ${n.email_apoderado || n.apoderado_principal}`, 'success');
  },
};
