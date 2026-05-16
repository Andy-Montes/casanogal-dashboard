// Panel slide-in de detalle de sesión
const Panel = {
  open(sesion) {
    State.selectedSesion = sesion;
    const nino = Data.nino(sesion.id_nino);
    const ter = Data.terapeuta(sesion.id_terapeuta);
    const sala = Data.sala(sesion.id_sala);
    const c = ESPECIALIDAD_VAR[sesion.tipo_terapia] || ESPECIALIDAD_VAR['Terapia Ocupacional'];
    const nota = Data.notaPorSesion(sesion.id_sesion);
    const block = document.getElementById('panelColorBlock');
    block.textContent = ter?.abreviacion || '—';
    block.style.background = c.bg;
    block.style.color = c.text;

    let titulo = sesion.nino_visible;
    if (sesion.es_dupla && sesion.id_nino_secundario) {
      const ns = Data.nino(sesion.id_nino_secundario);
      if (ns) titulo = `${sesion.nino_visible} + ${ns.nombre_visible}`;
    }
    document.getElementById('panelTitle').textContent = titulo;
    document.getElementById('panelSubtitle').textContent = `${sesion.tipo_terapia}${sesion.es_dupla ? ' · Dupla' : ''}`;

    const showNotas = State.role !== 'padres';
    const esTerapeuta = State.role === 'terapeuta';
    const esAdmin = State.role === 'coordinacion';
    const editable = esTerapeuta;
    const storedNotas = JSON.parse(localStorage.getItem('casanogal_notas') || '{}');
    const notaRaw = storedNotas[sesion.id_sesion];
    // Backwards compat: si es string plano, asumir autor terapeuta legacy
    const notaEditada = typeof notaRaw === 'string'
      ? { texto: notaRaw, autor: 'terapeuta', autor_nombre: null }
      : notaRaw;
    const notaTexto = notaEditada?.texto || nota?.notas_libres || '';
    const notaAutor = notaEditada?.autor; // 'admin' | 'terapeuta' | undefined
    const notaAutorNombre = notaEditada?.autor_nombre;
    document.getElementById('panelBody').innerHTML = `
      ${sesion.conflicto_detectado ? `
        <div class="alert-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span><b>Conflicto detectado:</b> ${UI.esc(sesion.conflicto_detectado)}. Esta sesión choca con otra. Revisa el calendario antes de confirmar.</span>
        </div>
      ` : ''}

      <div class="panel-field">
        <span class="panel-field-label">Niño</span>
        <span class="panel-field-value">${UI.esc(nino?.nombre_completo || sesion.nino_visible)}</span>
      </div>

      ${State.role !== 'padres' ? `
      <div class="panel-field">
        <span class="panel-field-label">Terapeuta</span>
        <span class="panel-field-value">${UI.esc(ter?.nombre_completo || '—')} <span class="badge" style="background:${c.bg};color:${c.text}">${UI.esc(ter?.abreviacion || '—')}</span></span>
      </div>` : ''}

      <div class="panel-field">
        <span class="panel-field-label">Tipo de terapia</span>
        <span class="panel-field-value">${UI.esc(sesion.tipo_terapia)}</span>
      </div>

      <div class="panel-field">
        <span class="panel-field-label">Sala</span>
        <span class="panel-field-value">${UI.esc(sala?.nombre || sesion.sala_nombre)} <span style="font-weight:400;color:var(--text-3);font-size:12px">· ${UI.esc(sala?.tipo_principal || '')}</span></span>
      </div>

      <div class="panel-field">
        <span class="panel-field-label">Día y hora</span>
        <span class="panel-field-value mono">${UI.esc(UI.fmtFecha(sesion.fecha))} · ${UI.esc(sesion.hora_inicio)}–${UI.esc(sesion.hora_fin)}</span>
      </div>

      <div class="panel-field">
        <span class="panel-field-label">Estado</span>
        <span class="panel-field-value"><span class="estado-pill ${UI.estadoClass(sesion.estado)}">${UI.esc(sesion.estado)}</span></span>
      </div>

      ${showNotas ? `
        <div class="panel-section-title">
          Notas clínicas
          ${notaEditada ? `<span class="nota-badge ${notaAutor === 'admin' ? 'nota-badge-admin' : 'nota-badge-ter'}">${notaAutor === 'admin' ? `NOTA ADMINISTRATIVA${notaAutorNombre ? ' · ' + UI.esc(notaAutorNombre) : ''}` : 'EDITADA'}</span>` : ''}
        </div>
        ${editable ? `
          <div class="panel-notes-editor">
            <textarea id="notaTextarea" class="panel-notes-textarea" placeholder="${notaTexto ? '' : 'Anota lo que trabajaste con el niño en esta sesión…'}">${UI.esc(notaTexto)}</textarea>
            <div class="panel-notes-actions">
              <button class="btn btn-ghost" id="notaCancelBtn" type="button">Cancelar</button>
              <button class="btn btn-primary" id="notaSaveBtn" type="button">Guardar nota</button>
            </div>
            ${nota?.objetivos_trabajados?.length ? `
              <div style="margin-top:12px;font-size:12px;color:var(--text-3)"><b>Objetivos trabajados anteriormente:</b><br>
                ${nota.objetivos_trabajados.map(o => `<span class="objetivo-pill">${UI.esc(o)}</span>`).join('')}
              </div>
            ` : ''}
            ${nota?.avance_percibido != null ? `
              <div style="margin-top:8px;font-size:12px;color:var(--text-3)"><b>Avance percibido (último):</b> <span class="mono">${nota.avance_percibido}/10</span></div>
            ` : ''}
          </div>
        ` : `
          <div class="panel-notes">
            ${notaTexto
              ? `<p>${UI.esc(notaTexto)}</p>`
              : `<p class="empty">Aún sin nota. El terapeuta la registrará después de la sesión.</p>`}
            ${nota?.objetivos_trabajados?.length ? `
              <div style="margin-top:10px"><b>Objetivos trabajados:</b><br>
                ${nota.objetivos_trabajados.map(o => `<span class="objetivo-pill">${UI.esc(o)}</span>`).join('')}
              </div>
            ` : ''}
            ${nota?.avance_percibido != null ? `
              <div style="margin-top:10px;font-size:12px;color:var(--text-3)"><b>Avance percibido:</b> <span class="mono">${nota.avance_percibido}/10</span></div>
            ` : ''}
            ${esAdmin ? `
              <button class="btn btn-ghost panel-admin-note-btn" id="notaAdminBtn" type="button" style="margin-top:12px">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                ${notaTexto ? 'Editar nota administrativa' : 'Agregar nota administrativa'}
              </button>
              <div id="notaAdminEditor" style="display:none;margin-top:10px">
                <div class="nota-admin-hint">Las notas administrativas quedan marcadas y visibles para el terapeuta del niño.</div>
                <textarea id="notaAdminTextarea" class="panel-notes-textarea" placeholder="Nota administrativa de coordinación…">${UI.esc(notaAutor === 'admin' ? notaTexto : '')}</textarea>
                <div class="panel-notes-actions">
                  <button class="btn btn-ghost" id="notaAdminCancelBtn" type="button">Cancelar</button>
                  <button class="btn btn-accent" id="notaAdminSaveBtn" type="button">Guardar nota administrativa</button>
                </div>
              </div>
            ` : ''}
          </div>
        `}
      ` : ''}
    `;

    document.getElementById('panelOverlay').classList.add('open');
    document.getElementById('detailPanel').classList.add('open');

    // Wire de notas editables (terapeuta)
    document.getElementById('notaSaveBtn')?.addEventListener('click', () => {
      const txt = document.getElementById('notaTextarea').value.trim();
      const store = JSON.parse(localStorage.getItem('casanogal_notas') || '{}');
      if (txt) {
        store[sesion.id_sesion] = { texto: txt, autor: 'terapeuta', autor_nombre: DEMO_USERS.terapeuta?.name || null };
      } else {
        delete store[sesion.id_sesion];
      }
      localStorage.setItem('casanogal_notas', JSON.stringify(store));
      UI.toast(txt ? 'Nota guardada' : 'Nota eliminada', 'success');
      Main.renderPendientes();
    });
    document.getElementById('notaCancelBtn')?.addEventListener('click', () => {
      document.getElementById('notaTextarea').value = notaTexto;
    });

    // Wire de nota administrativa (admin)
    const adminBtn = document.getElementById('notaAdminBtn');
    const adminEditor = document.getElementById('notaAdminEditor');
    adminBtn?.addEventListener('click', () => {
      const visible = adminEditor.style.display !== 'none';
      adminEditor.style.display = visible ? 'none' : 'block';
      if (!visible) document.getElementById('notaAdminTextarea').focus();
    });
    document.getElementById('notaAdminCancelBtn')?.addEventListener('click', () => {
      adminEditor.style.display = 'none';
    });
    document.getElementById('notaAdminSaveBtn')?.addEventListener('click', () => {
      const txt = document.getElementById('notaAdminTextarea').value.trim();
      const store = JSON.parse(localStorage.getItem('casanogal_notas') || '{}');
      if (txt) {
        store[sesion.id_sesion] = { texto: txt, autor: 'admin', autor_nombre: DEMO_USERS.coordinacion?.name || 'Coordinación' };
      } else {
        delete store[sesion.id_sesion];
      }
      localStorage.setItem('casanogal_notas', JSON.stringify(store));
      UI.toast(txt ? 'Nota administrativa guardada' : 'Nota eliminada', 'success');
      Main.renderPendientes();
      Panel.open(sesion); // re-render para mostrar badge
    });
  },

  close() {
    document.getElementById('panelOverlay').classList.remove('open');
    document.getElementById('detailPanel').classList.remove('open');
    State.selectedSesion = null;
  },

  delete() {
    if (!State.selectedSesion) return;
    const id = State.selectedSesion.id_sesion;
    State.data.sesiones = State.data.sesiones.filter(s => s.id_sesion !== id);
    UI.toast('Sesión eliminada', 'alert');
    this.close();
    if (State.module === 'calendario') Calendar.render();
  },

  edit() {
    if (!State.selectedSesion) return;
    Modal.openEdit(State.selectedSesion);
    this.close();
  },

  initMove() {
    if (!State.selectedSesion) return;
    State.movingSesion = State.selectedSesion;
    UI.toast('Selecciona una celda vacía para mover', 'success');
    this.close();
  },
};
