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
    // El terapeuta (y coordinación) puede registrar la nota DESDE el calendario al pinchar
    // la sesión; se guarda en la ficha del niño (mismo store casanogal_notas que lee la ficha).
    const editable = (esTerapeuta || esAdmin) && sesion.estado === 'Realizada';
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
        <span class="panel-field-label">Terapeuta ${esAdmin ? '<button class="panel-reasignar-link" id="panelReasignarBtn" type="button">Reasignar</button>' : ''}</span>
        <span class="panel-field-value">${UI.esc(ter?.nombre_completo || '—')} <span class="badge" style="background:${c.bg};color:${c.text}">${UI.esc(ter?.abreviacion || '—')}</span></span>
      </div>
      ${esAdmin ? '<div id="panelReasignar" class="panel-reasignar"></div>' : ''}` : ''}

      <div class="panel-field">
        <span class="panel-field-label">Tipo de terapia</span>
        <span class="panel-field-value">${UI.esc(sesion.tipo_terapia)}</span>
      </div>

      <div class="panel-field">
        <span class="panel-field-label">Sala ${esAdmin ? '<button class="panel-reasignar-link" id="panelReasignarSalaBtn" type="button">Cambiar</button>' : ''}</span>
        <span class="panel-field-value">${UI.esc(sala?.nombre || sesion.sala_nombre)} <span style="font-weight:400;color:var(--text-3);font-size:12px">· ${UI.esc(sala?.tipo_principal || '')}</span></span>
      </div>
      ${esAdmin ? '<div id="panelReasignarSala" class="panel-reasignar"></div>' : ''}

      <div class="panel-field">
        <span class="panel-field-label">Día y hora</span>
        <span class="panel-field-value mono">${UI.esc(UI.fmtFecha(sesion.fecha))} · ${UI.esc(sesion.hora_inicio)}–${UI.esc(sesion.hora_fin)}</span>
      </div>

      <div class="panel-field">
        <span class="panel-field-label">Estado</span>
        <span class="panel-field-value"><span class="estado-pill ${UI.estadoClass(sesion.estado)}">${UI.esc(sesion.estado)}</span></span>
      </div>

      ${(esTerapeuta || esAdmin) ? `
        <div class="panel-estado-acciones">
          <span class="panel-field-label">Marcar asistencia</span>
          <div class="estado-btns">
            ${['Realizada', 'No Asistió', 'Cancelada', 'Agendada'].map(e =>
              `<button class="estado-btn ${sesion.estado === e ? 'is-activo' : ''}" data-estado="${e}" type="button">${e}</button>`
            ).join('')}
          </div>
        </div>
      ` : ''}

      ${showNotas ? `
        <div class="panel-section-title">
          Notas clínicas
          ${notaEditada ? `<span class="nota-badge ${notaAutor === 'admin' ? 'nota-badge-admin' : 'nota-badge-ter'}">${notaAutor === 'admin' ? `NOTA ADMINISTRATIVA${notaAutorNombre ? ' · ' + UI.esc(notaAutorNombre) : ''}` : 'EDITADA'}</span>` : ''}
        </div>
        ${editable ? `
          <div class="panel-notes-editor">
            <div class="nota-where-hint">
              Esta nota queda guardada en la ficha de <b>${UI.esc(nino?.nombre_completo || sesion.nino_visible)}</b>, en la sección Historial. Coordinación y el equipo asignado pueden verla.
            </div>
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
            ${(esTerapeuta || esAdmin) ? `
              <button class="btn btn-primary panel-ir-ficha" type="button" style="margin-top:14px;width:100%">
                ${notaTexto ? '✎ Ver o editar la nota en la ficha' : '✍ Registrar la nota en la ficha del niño'}
              </button>
            ` : ''}
          </div>
        `}
      ` : ''}
    `;

    document.getElementById('panelOverlay').classList.add('open');
    document.getElementById('detailPanel').classList.add('open');

    // Permisos: padres no debería ver acciones de modificar; terapeuta puede editar/mover pero no eliminar.
    const footer = document.querySelector('.panel-footer');
    if (footer) {
      if (esTerapeuta) {
        footer.style.display = '';
        document.getElementById('panelDeleteBtn').style.display = 'none';
        document.getElementById('panelEditBtn').style.display = '';
        document.getElementById('panelMoveBtn').style.display = '';
      } else if (esAdmin) {
        footer.style.display = '';
        document.getElementById('panelDeleteBtn').style.display = '';
        document.getElementById('panelEditBtn').style.display = '';
        document.getElementById('panelMoveBtn').style.display = '';
      } else {
        footer.style.display = 'none';
      }
    }

    // Ir a la ficha del niño a registrar/editar la nota de esta sesión
    document.querySelector('.panel-ir-ficha')?.addEventListener('click', () => {
      Panel.close();
      State.module = 'fichas';
      State.fichaActiva = sesion.id_nino;
      Main.activateNav('fichas');
      Main._renderModule();
    });

    // Registrar la nota clínica desde el calendario → se guarda en la ficha del niño.
    document.getElementById('notaSaveBtn')?.addEventListener('click', () => {
      const txt = (document.getElementById('notaTextarea')?.value || '').trim();
      const store = JSON.parse(localStorage.getItem('casanogal_notas') || '{}');
      if (txt) store[sesion.id_sesion] = { texto: txt, autor: esAdmin ? 'admin' : 'terapeuta', autor_nombre: State.currentUser?.name || null };
      else delete store[sesion.id_sesion];
      localStorage.setItem('casanogal_notas', JSON.stringify(store));
      UI.toast(txt ? 'Nota guardada en la ficha del niño' : 'Nota eliminada', 'success');
      if (typeof Main?.renderPendientes === 'function') Main.renderPendientes();
      Panel.open(sesion);
      if (State.module === 'calendario') Calendar.render();
    });
    document.getElementById('notaCancelBtn')?.addEventListener('click', () => Panel.open(sesion));

    // Reasignar terapeuta (coordinación): cuando uno falta, ver quién está libre a esa hora
    document.getElementById('panelReasignarBtn')?.addEventListener('click', () => Panel._renderReasignar(sesion));
    // Cambiar sala: ver qué salas están libres en ese bloque
    document.getElementById('panelReasignarSalaBtn')?.addEventListener('click', () => Panel._renderReasignarSala(sesion));

    // Cambiar estado de la sesión (realizada / no asistió / cancelada / agendada)
    document.querySelectorAll('.estado-btn').forEach(b =>
      b.addEventListener('click', () => Panel._cambiarEstado(sesion, b.dataset.estado))
    );
  },

  _cambiarEstado(sesion, estado) {
    if (!sesion) return;
    sesion.estado = estado;
    UI.toast(`Sesión marcada como “${estado}”`, 'success');
    Panel.open(sesion); // refresca el panel
    if (State.module === 'calendario') Calendar.render();
    else if (State.module === 'fichas') Fichas.render();
  },

  // Terapeutas activos y libres en fecha+bloque de la sesión.
  // NO se limita a la misma especialidad (Trini reasigna a cualquiera libre, incluso para duplas).
  // Se ordenan: misma especialidad primero, luego el resto.
  _disponiblesPara(sesion) {
    const ocupados = new Set((Data.sesionesPorDiaYBloque(sesion.fecha, sesion.id_bloque) || []).map(s => s.id_terapeuta));
    return Data.terapeutasEfectivos().filter(t => {
      if (t.estado !== 'Activo') return false;
      if (t.id_terapeuta === sesion.id_terapeuta) return false;
      if (ocupados.has(t.id_terapeuta)) return false;
      const disp = t.disponibilidad_bloques;
      if (disp && disp[sesion.dia_semana] && !disp[sesion.dia_semana].includes(sesion.id_bloque)) return false;
      return true;
    }).sort((a, b) => {
      const am = a.especialidad === sesion.tipo_terapia ? 0 : 1;
      const bm = b.especialidad === sesion.tipo_terapia ? 0 : 1;
      return am - bm || a.nombre_completo.localeCompare(b.nombre_completo);
    });
  },

  _renderReasignar(sesion) {
    const cont = document.getElementById('panelReasignar');
    if (!cont) return;
    if (cont.innerHTML) { cont.innerHTML = ''; return; } // toggle cerrar
    const disp = this._disponiblesPara(sesion);
    cont.innerHTML = `
      <div class="panel-reasignar-head">Disponibles el ${UI.esc(sesion.dia_semana)} ${UI.esc(sesion.hora_inicio)} · ${UI.esc(sesion.tipo_terapia)}</div>
      ${disp.length
        ? disp.map(t => {
            const sala = Data.sala(t.sala_principal);
            const otraEsp = t.especialidad !== sesion.tipo_terapia;
            return `<button class="reasignar-item" data-ter="${t.id_terapeuta}" type="button">
              <span class="reasignar-abr">${UI.esc(t.abreviacion)}</span>
              <span class="reasignar-nombre">${UI.esc(t.nombre_completo)}<small class="reasignar-esp${otraEsp ? ' reasignar-esp-otra' : ''}">${UI.esc(t.especialidad)}</small></span>
              ${sala ? `<span class="reasignar-sala">${UI.esc(sala.nombre)}</span>` : ''}
            </button>`;
          }).join('')
        : '<div class="reasignar-vacio">No hay ningún terapeuta libre a esta hora.</div>'}
    `;
    cont.querySelectorAll('.reasignar-item').forEach(b =>
      b.addEventListener('click', () => this._aplicarReasignar(sesion, b.dataset.ter))
    );
  },

  // Salas libres en la fecha+bloque de la sesión (excluye la sala actual y las ocupadas).
  _renderReasignarSala(sesion) {
    const cont = document.getElementById('panelReasignarSala');
    if (!cont) return;
    if (cont.innerHTML) { cont.innerHTML = ''; return; } // toggle cerrar
    const ocupadas = new Set((Data.sesionesPorDiaYBloque(sesion.fecha, sesion.id_bloque) || [])
      .filter(s => s.id_sesion !== sesion.id_sesion).map(s => s.id_sala));
    // Salas preferidas del terapeuta (principal / opción 2 / opción 3): se ofrecen primero.
    const ter = Data.terapeuta(sesion.id_terapeuta);
    const preferidas = [ter?.sala_principal, ter?.sala_opcion_2, ter?.sala_opcion_3].filter(Boolean);
    const rank = id => { const i = preferidas.indexOf(id); return i === -1 ? 99 : i; };
    const libres = (State.data.salas || [])
      .filter(sa => sa.id_sala !== sesion.id_sala && !ocupadas.has(sa.id_sala))
      .sort((a, b) => rank(a.id_sala) - rank(b.id_sala) || a.nombre.localeCompare(b.nombre));
    cont.innerHTML = `
      <div class="panel-reasignar-head">Salas libres el ${UI.esc(sesion.dia_semana)} ${UI.esc(sesion.hora_inicio)}</div>
      ${libres.length
        ? libres.map(sa => {
            const c = UI.colorSala(sa.tipo_principal);
            const pref = preferidas.includes(sa.id_sala);
            return `<button class="reasignar-item" data-sala="${sa.id_sala}" type="button">
              <span class="reasignar-abr" style="background:${c.bg};color:${c.text}">sala</span>
              <span class="reasignar-nombre">${UI.esc(sa.nombre)}<small class="reasignar-esp"${pref ? ' style="color:var(--cn-mostaza-deep,#9A6B00);font-weight:600"' : ''}>${UI.esc(sa.tipo_principal)}${pref ? ' · preferida' : ''}</small></span>
            </button>`;
          }).join('')
        : '<div class="reasignar-vacio">No hay salas libres a esta hora.</div>'}
    `;
    cont.querySelectorAll('.reasignar-item').forEach(b =>
      b.addEventListener('click', () => this._aplicarReasignarSala(sesion, b.dataset.sala))
    );
  },

  _aplicarReasignarSala(sesion, idSala) {
    const sa = Data.sala(idSala);
    if (!sa) return;
    sesion.id_sala = idSala;
    sesion.sala_nombre = sa.nombre;
    UI.toast(`Sala cambiada a ${sa.nombre}`, 'success');
    this.close();
    if (State.module === 'calendario') Calendar.render();
  },

  _aplicarReasignar(sesion, idTer) {
    const t = Data.terapeuta(idTer);
    if (!t) return;
    sesion.id_terapeuta = idTer;
    sesion.terapeuta_abr = t.abreviacion;
    sesion.conflicto_detectado = null;
    UI.toast(`Sesión reasignada a ${t.nombre_completo}`, 'success');
    this.close();
    if (State.module === 'calendario') Calendar.render();
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
    UI.toast('Sesión eliminada', 'success');
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
