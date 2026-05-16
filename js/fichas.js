// Módulo Fichas clínicas
const Fichas = {
  render() {
    if (State.fichaActiva) {
      this._renderDetalle(State.fichaActiva);
    } else {
      this._renderLista();
    }
  },

  _renderLista() {
    const ninos = Data.ninosVisibles();
    const q = State.searchQuery.toLowerCase();
    const filtered = ninos.filter(n => {
      if (State.filterFicha !== 'all' && n.id_programa !== 'PROG-' + State.filterFicha) return false;
      if (q && !n.nombre_completo.toLowerCase().includes(q)) return false;
      return true;
    });

    const conteo = { all: ninos.length };
    ['INT','CONT','EVAL','APR','AT'].forEach(k => conteo[k] = ninos.filter(n => n.id_programa === 'PROG-' + k).length);

    // Cuando hay búsqueda activa o filtro distinto a "all", se aplana en una sola grilla
    const useGroups = !q && State.filterFicha === 'all' && filtered.length > 0;
    const intensivos = filtered.filter(n => n.id_programa === 'PROG-INT');
    const continuos  = filtered.filter(n => n.id_programa === 'PROG-CONT');
    const otros      = filtered.filter(n => ['PROG-EVAL','PROG-APR','PROG-AT'].includes(n.id_programa));

    const renderGrupo = (titulo, eyebrow, items) => items.length === 0 ? '' : `
      <div class="group-section">
        <div class="group-section-head">
          <div>
            <div class="group-eyebrow">${UI.esc(eyebrow)}</div>
            <div class="group-title">${UI.esc(titulo)} <span class="group-count">· ${items.length} niño${items.length===1?'':'s'}</span></div>
          </div>
        </div>
        <div class="fichas-grid">
          ${items.map(n => this._card(n)).join('')}
        </div>
      </div>
    `;

    document.getElementById('main').innerHTML = `
      <div class="section-head">
        <div>
          <div class="section-title">Fichas clínicas</div>
          <div class="section-sub">Historial completo de cada niño · click en una ficha para abrir</div>
        </div>
      </div>

      <div class="fichas-toolbar">
        <div class="fichas-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="fichaSearch" placeholder="Buscar por nombre…" value="${UI.esc(State.searchQuery)}">
        </div>
        <div class="fichas-chips">
          <button class="chip ${State.filterFicha==='all'?'active':''}" data-f="all">Todos <span class="chip-count">${conteo.all}</span></button>
          <button class="chip ${State.filterFicha==='INT'?'active':''}" data-f="INT">Intensivo <span class="chip-count">${conteo.INT}</span></button>
          <button class="chip ${State.filterFicha==='CONT'?'active':''}" data-f="CONT">Continuo <span class="chip-count">${conteo.CONT}</span></button>
          <button class="chip ${State.filterFicha==='EVAL'?'active':''}" data-f="EVAL">Evaluación <span class="chip-count">${conteo.EVAL}</span></button>
          <button class="chip ${State.filterFicha==='APR'?'active':''}" data-f="APR">Apraxia <span class="chip-count">${conteo.APR}</span></button>
          <button class="chip ${State.filterFicha==='AT'?'active':''}" data-f="AT">AT <span class="chip-count">${conteo.AT}</span></button>
        </div>
      </div>

      ${filtered.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-title">Nada por acá con este filtro</div>
          <div>Prueba con <b>Todos</b> o limpia la búsqueda.</div>
        </div>
      ` : useGroups ? `
        ${renderGrupo('Intensivo 40', 'Programa intensivo · 6 semanas', intensivos)}
        ${renderGrupo('Seguimiento', 'Programa continuo · sesiones recurrentes', continuos)}
        ${renderGrupo('Otros programas', 'Evaluación, Apraxia y Atención Temprana', otros)}
      ` : `
        <div class="fichas-grid">
          ${filtered.map(n => this._card(n)).join('')}
        </div>
      `}
    `;

    document.getElementById('fichaSearch').addEventListener('input', (e) => {
      State.searchQuery = e.target.value;
      this._renderLista();
    });
    document.querySelectorAll('.fichas-toolbar [data-f]').forEach(b => {
      b.addEventListener('click', () => { State.filterFicha = b.dataset.f; this._renderLista(); });
    });
    document.querySelectorAll('.ficha-card').forEach(c => {
      c.addEventListener('click', () => { State.fichaActiva = c.dataset.id; this.render(); });
    });
  },

  _card(n) {
    const equipo = Data.equipoDeNino(n.id_nino);
    const sesiones = Data.sesionesDeNino(n.id_nino);
    const realizadas = sesiones.filter(s => s.estado === 'Realizada').length;
    const prox = sesiones
      .filter(s => s.estado === 'Agendada' && s.fecha >= HOY_ISO)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
    const avCls = UI.avatarClassByPrograma(n.id_programa);
    return `<div class="ficha-card" data-id="${n.id_nino}">
      <div class="ficha-card-head">
        <span class="ficha-avatar ${avCls}">${UI.initials(n.nombre_completo)}</span>
        <div style="flex:1;min-width:0">
          <div class="ficha-name">${UI.esc(n.nombre_completo)}</div>
          <div class="ficha-prog">${UI.esc(n.programa_nombre)}${n.semana_actual?` · Sem ${n.semana_actual}`:''} · ${n.edad_anios} años</div>
        </div>
      </div>
      <div class="ficha-diag">
        ${(n.diagnosticos||[]).slice(0,3).map(d => `<span class="badge">${UI.esc(d)}</span>`).join('')}
      </div>
      <div class="ficha-stats">
        <div class="ficha-stat"><div class="ficha-stat-v">${equipo.length}</div><div class="ficha-stat-l">Equipo</div></div>
        <div class="ficha-stat"><div class="ficha-stat-v">${realizadas}</div><div class="ficha-stat-l">Realizadas</div></div>
        <div class="ficha-stat"><div class="ficha-stat-v" style="font-size:11px">${prox ? UI.fmtFechaCorta(prox.fecha) : '—'}</div><div class="ficha-stat-l">Próxima</div></div>
      </div>
    </div>`;
  },

  _renderDetalle(id) {
    const n = Data.nino(id);
    if (!n) { State.fichaActiva = null; this._renderLista(); return; }
    const prog = Data.programa(n.id_programa);
    const equipo = Data.equipoDeNino(id);
    const sesiones = Data.sesionesDeNino(id);
    // Solo el terapeuta ve sus propias sesiones en el historial
    const sesionesVisibles = (State.role === 'terapeuta')
      ? sesiones.filter(s => s.id_terapeuta === DEMO_USERS.terapeuta.id_terapeuta || s.id_terapeuta_secundario === DEMO_USERS.terapeuta.id_terapeuta)
      : sesiones;
    const objetivos = Data.objetivosDeNino(id);
    const docs = Data.documentosDeNino(id);
    const avCls = UI.avatarClassByPrograma(n.id_programa);
    const semProg = n.semana_actual && prog?.duracion_semanas ? Math.round(100 * n.semana_actual / prog.duracion_semanas) : null;
    const isTer = State.role === 'terapeuta';
    const tabs = isTer
      ? ['general', 'historial', 'objetivos']
      : ['general', 'equipo', 'historial', 'objetivos', 'reuniones', 'documentos'];
    const tabLabels = { general: 'General', equipo: 'Equipo', historial: 'Historial', objetivos: 'Objetivos', reuniones: 'Reuniones', documentos: 'Documentos' };

    document.getElementById('main').innerHTML = `
      <button class="ficha-back" id="fichaBack">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Volver a fichas
      </button>

      <div class="ficha-detail-head">
        <span class="ficha-avatar-lg ficha-avatar ${avCls}">${UI.initials(n.nombre_completo)}</span>
        <div>
          <div class="ficha-detail-name">${UI.esc(n.nombre_completo)}</div>
          <div class="ficha-detail-meta">
            <span>${n.edad_anios} años</span>
            <span class="mono">RUT ${UI.esc(n.rut)}</span>
            <span>${UI.esc(prog?.nombre || '—')}</span>
            <span class="mono">${UI.fmtFechaCorta(n.fecha_inicio_programa)} → ${UI.fmtFechaCorta(n.fecha_termino_programa)}</span>
          </div>
          ${semProg !== null ? `
            <div class="progress"><div class="progress-bar" style="width:${semProg}%"></div></div>
            <div class="progress-label">Semana ${n.semana_actual} de ${prog.duracion_semanas} · ${semProg}%</div>
          ` : ''}
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" id="exportFicha">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar
          </button>
          <button class="btn btn-primary" id="editFicha">Editar datos</button>
        </div>
      </div>

      <div class="tabs">
        ${tabs.map((t,i) => `<button class="tab ${i===0?'active':''}" data-tab="${t}">${tabLabels[t]}</button>`).join('')}
      </div>

      <div id="tabsHost">
        ${this._tab_general(n)}
        ${!isTer ? this._tab_equipo(equipo) : ''}
        ${this._tab_historial(sesionesVisibles)}
        ${this._tab_objetivos(objetivos)}
        ${!isTer ? this._tab_reuniones() : ''}
        ${!isTer ? this._tab_documentos(docs) : ''}
      </div>
    `;

    document.getElementById('fichaBack').addEventListener('click', () => { State.fichaActiva = null; this.render(); });
    document.getElementById('exportFicha').addEventListener('click', () => UI.toast('Exportación enviada al correo', 'success'));
    document.getElementById('editFicha').addEventListener('click', () => UI.toast('Próximamente', ''));
    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelector(`.tab-panel[data-panel="${t.dataset.tab}"]`)?.classList.add('active');
      });
    });
    document.querySelectorAll('.timeline-head').forEach(h => {
      h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
    });
  },

  _tab_general(n) {
    return `<div class="tab-panel active" data-panel="general">
      <div class="info-grid">
        <div class="panel-field"><span class="panel-field-label">Fecha de nacimiento</span><span class="panel-field-value mono">${UI.fmtFechaCorta(n.fecha_nacimiento)}</span></div>
        <div class="panel-field"><span class="panel-field-label">Apoderado principal</span><span class="panel-field-value">${UI.esc(n.apoderado_principal)}</span></div>
        <div class="panel-field"><span class="panel-field-label">Teléfono</span><span class="panel-field-value mono">${UI.esc(n.telefono_apoderado || '—')}</span></div>
        <div class="panel-field"><span class="panel-field-label">Email</span><span class="panel-field-value">${UI.esc(n.email_apoderado || '—')}</span></div>
        <div class="panel-field"><span class="panel-field-label">Colegio</span><span class="panel-field-value">${UI.esc(n.colegio || '—')}</span></div>
        <div class="panel-field"><span class="panel-field-label">Médico externo</span><span class="panel-field-value">${UI.esc(n.medico_externo || '—')}</span></div>
        <div class="panel-field"><span class="panel-field-label">Alergias</span><span class="panel-field-value">${UI.esc(n.alergias || 'Sin alergias reportadas')}</span></div>
        <div class="panel-field"><span class="panel-field-label">Consideraciones</span><span class="panel-field-value">${UI.esc(n.consideraciones || '—')}</span></div>
        <div class="panel-field" style="grid-column:1/-1">
          <span class="panel-field-label">Diagnósticos</span>
          <div>${(n.diagnosticos||[]).map(d=>`<span class="badge" style="background:var(--cn-azul-bg);color:var(--cn-azul-deep);margin-right:4px">${UI.esc(d)}</span>`).join('')}</div>
        </div>
      </div>
    </div>`;
  },

  _tab_equipo(equipo) {
    return `<div class="tab-panel" data-panel="equipo">
      ${equipo.length === 0 ? `<div class="empty-state"><div class="empty-state-title">Sin equipo asignado</div></div>` : `
        <div class="equipo-list">
          ${equipo.map(e => {
            const t = Data.terapeuta(e.id_terapeuta);
            const c = ESPECIALIDAD_VAR[e.area] || ESPECIALIDAD_VAR['Terapia Ocupacional'];
            return `<div class="equipo-row">
              <span class="equipo-avatar" style="background:${c.bg};color:${c.text}">${UI.esc(t?.abreviacion || '—')}</span>
              <div>
                <div style="font-weight:600">${UI.esc(t?.nombre_completo || e.terapeuta_visible)}</div>
                <div style="font-size:12px;color:var(--text-3)">${UI.esc(e.area)} · ${UI.esc(e.rol)}</div>
              </div>
              <span class="badge" style="background:${c.bg};color:${c.text}">${UI.esc(e.rol)}</span>
            </div>`;
          }).join('')}
        </div>
      `}
    </div>`;
  },

  _tab_historial(sesiones) {
    const ordered = [...sesiones].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.hora_inicio || '').localeCompare(a.hora_inicio || ''));
    return `<div class="tab-panel" data-panel="historial">
      ${ordered.length === 0 ? `<div class="empty-state"><div class="empty-state-title">Sin historial</div></div>` : `
        <div class="timeline">
          ${ordered.slice(0, 80).map(s => {
            const nota = Data.notaPorSesion(s.id_sesion);
            const ter = Data.terapeuta(s.id_terapeuta);
            const c = ESPECIALIDAD_VAR[s.tipo_terapia] || ESPECIALIDAD_VAR['Terapia Ocupacional'];
            return `<div class="timeline-item">
              <div class="timeline-head">
                <span class="timeline-date mono">${UI.fmtFechaCorta(s.fecha)}</span>
                <div>
                  <div style="font-weight:600">${UI.esc(s.tipo_terapia)} · ${UI.esc(s.hora_inicio)}–${UI.esc(s.hora_fin)}</div>
                  <div style="font-size:11px;color:var(--text-3)">${UI.esc(ter?.nombre_visible || '—')} · Sala ${UI.esc(s.sala_nombre)}</div>
                </div>
                <span class="estado-pill ${UI.estadoClass(s.estado)}">${UI.esc(s.estado)}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-3)"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              <div class="timeline-body">
                ${nota ? `
                  <p>${UI.esc(nota.notas_libres || 'Sin notas.')}</p>
                  ${nota.objetivos_trabajados?.length ? `<p style="margin-top:8px"><b>Objetivos trabajados:</b> ${nota.objetivos_trabajados.map(UI.esc).join(' · ')}</p>` : ''}
                  ${nota.avance_percibido != null ? `<p style="margin-top:6px"><b>Avance percibido:</b> <span class="mono">${nota.avance_percibido}/10</span></p>` : ''}
                ` : `<p class="empty" style="color:var(--text-3);font-style:italic">Sin notas registradas.</p>`}
              </div>
            </div>`;
          }).join('')}
        </div>
      `}
    </div>`;
  },

  _tab_objetivos(objetivos) {
    if (!objetivos.length) {
      return `<div class="tab-panel" data-panel="objetivos"><div class="empty-state"><div class="empty-state-title">Sin objetivos planteados</div></div></div>`;
    }
    // Agrupar por area
    const grupos = {};
    objetivos.forEach(o => { (grupos[o.area] = grupos[o.area] || []).push(o); });
    return `<div class="tab-panel" data-panel="objetivos">
      ${Object.entries(grupos).map(([area, list]) => {
        const c = ESPECIALIDAD_VAR[area] || ESPECIALIDAD_VAR['Terapia Ocupacional'];
        return `<h3 style="font-size:13px;margin:18px 0 8px;color:${c?.text || 'var(--text-2)'};letter-spacing:0.04em;text-transform:uppercase">${UI.esc(area)} <span style="color:var(--text-3);font-weight:400">· ${list.length}</span></h3>
        <div class="objetivos-list">
          ${list.map(o => `<div class="objetivo-card" style="border-left-color:${c?.main || 'var(--cn-azul)'}">
            <div class="head">
              <span class="objetivo-area">${UI.esc(o.categoria)}</span>
              <span class="estado-pill ${o.estado==='Logrado'?'realizada':o.estado==='Pausa'?'cancelada':'agendada'}">${UI.esc(o.estado)}</span>
            </div>
            <div class="objetivo-desc">${UI.esc(o.descripcion)}</div>
            <div class="meta">${UI.fmtFechaCorta(o.fecha_planteamiento)} → ${UI.fmtFechaCorta(o.fecha_estimada_logro)}</div>
          </div>`).join('')}
        </div>`;
      }).join('')}
    </div>`;
  },

  _tab_reuniones() {
    return `<div class="tab-panel" data-panel="reuniones">
      <div class="empty-state">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
        <div class="empty-state-title">Reuniones</div>
        <div>Aquí aparecerán las reuniones de equipo y de apoderados, con resumen y acuerdos.</div>
      </div>
    </div>`;
  },

  _tab_documentos(docs) {
    return `<div class="tab-panel" data-panel="documentos">
      ${docs.length === 0 ? `<div class="empty-state"><div class="empty-state-title">Sin documentos</div></div>` : `
        <div class="docs-list">
          ${docs.map(d => `<div class="doc-row">
            <span class="doc-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </span>
            <div class="doc-info">
              <div class="doc-name">${UI.esc(d.nombre_archivo)}</div>
              <div class="doc-meta">${UI.esc(d.tipo)} · ${UI.fmtFechaCorta(d.fecha_documento)} · subido por ${UI.esc(d.subido_por)}</div>
            </div>
            <button class="btn btn-ghost" onclick="UI.toast('Descarga enviada al correo','success')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </div>`).join('')}
        </div>
      `}
    </div>`;
  },
};
