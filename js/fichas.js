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
    const c = UI.colorNino(n.id_nino);
    return `<div class="ficha-card" data-id="${n.id_nino}">
      <div class="ficha-card-head">
        <span class="ficha-avatar" style="background:${c.bg};color:${c.text}">${UI.esc(UI.initials(n.nombre_completo))}</span>
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
    const sesionesVisibles = (State.role === 'terapeuta')
      ? sesiones.filter(s => s.id_terapeuta === DEMO_USERS.terapeuta.id_terapeuta || s.id_terapeuta_secundario === DEMO_USERS.terapeuta.id_terapeuta)
      : sesiones;
    const objetivos = Data.objetivosDeNino(id);
    const docs = Data.documentosDeNino(id);
    const cNino = UI.colorNino(n.id_nino);
    const semProg = n.semana_actual && prog?.duracion_semanas ? Math.round(100 * n.semana_actual / prog.duracion_semanas) : null;
    const isTer = State.role === 'terapeuta';

    // Stats rápidas
    const realizadas = sesiones.filter(s => s.estado === 'Realizada').length;
    const canceladas = sesiones.filter(s => s.estado === 'Cancelada').length;
    const noAsistio = sesiones.filter(s => s.estado === 'No Asistió').length;
    const agendadas = sesiones.filter(s => s.estado === 'Agendada' && s.fecha >= HOY_ISO).length;

    document.getElementById('main').innerHTML = `
      <button class="ficha-back" id="fichaBack">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Volver a fichas
      </button>

      <div class="ficha-detail-head">
        <span class="ficha-avatar-lg ficha-avatar" style="background:${cNino.bg};color:${cNino.text}">${UI.esc(UI.initials(n.nombre_completo))}</span>
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
            Exportar ficha
          </button>
          <button class="btn btn-primary" id="editFicha">Editar datos</button>
        </div>
      </div>

      <div class="ficha-quick-stats">
        <div class="quick-stat"><div class="quick-stat-v" style="color:var(--success)">${realizadas}</div><div class="quick-stat-l">Realizadas</div></div>
        <div class="quick-stat"><div class="quick-stat-v" style="color:var(--cn-azul-deep)">${agendadas}</div><div class="quick-stat-l">Agendadas (próx.)</div></div>
        <div class="quick-stat"><div class="quick-stat-v" style="color:var(--alert)">${noAsistio}</div><div class="quick-stat-l">No asistió</div></div>
        <div class="quick-stat"><div class="quick-stat-v" style="color:var(--text-3)">${canceladas}</div><div class="quick-stat-l">Canceladas</div></div>
      </div>

      <!-- Ficha unificada: una sola vista con secciones -->
      ${this._seccionDatos(n)}
      ${!isTer ? this._seccionEquipo(equipo) : ''}
      ${this._seccionHistorial(sesionesVisibles)}
      ${this._seccionObjetivos(objetivos)}
      ${!isTer ? this._seccionReuniones(n.id_nino) : ''}
      ${!isTer ? this._seccionBoletas(n.id_nino) : ''}
      ${!isTer ? this._seccionDocumentos(docs) : ''}
    `;

    document.getElementById('fichaBack').addEventListener('click', () => { State.fichaActiva = null; this.render(); });
    document.getElementById('exportFicha').addEventListener('click', () => UI.toast(`Ficha de ${n.nombre_completo.split(' ')[0]} enviada a tu correo como PDF`, 'success'));
    document.getElementById('editFicha').addEventListener('click', () => UI.toast('Próximamente', ''));
    // Click en el body de la fila abre el panel; el caret expande/colapsa la nota inline
    document.querySelectorAll('.timeline-item').forEach(item => {
      const head = item.querySelector('.timeline-head');
      const caret = item.querySelector('.timeline-caret');
      caret?.addEventListener('click', (e) => {
        e.stopPropagation();
        item.classList.toggle('open');
      });
      head?.addEventListener('click', (e) => {
        if (e.target.closest('.timeline-caret')) return;
        const sid = item.dataset.sesionId;
        const s = State.data.sesiones.find(x => x.id_sesion === sid);
        if (s) Panel.open(s);
      });
    });
    document.getElementById('addReuBtn')?.addEventListener('click', () => this._abrirModalReunion(n.id_nino));
    document.querySelectorAll('.reu-delete').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this._borrarReunion(n.id_nino, b.dataset.rid);
        this._renderDetalle(n.id_nino);
      });
    });
    document.querySelectorAll('.boleta-pagar-inline').forEach(b => {
      b.addEventListener('click', () => {
        Reportes.marcarPagada(b.dataset.bid);
        UI.toast('Boleta marcada como pagada', 'success');
        this._renderDetalle(n.id_nino);
      });
    });
    document.querySelectorAll('.boleta-revertir').forEach(b => {
      b.addEventListener('click', () => {
        Reportes.marcarNoPagada(b.dataset.bid);
        UI.toast('Boleta marcada como pendiente', 'success');
        this._renderDetalle(n.id_nino);
      });
    });
    document.querySelectorAll('.doc-download').forEach(b => {
      b.addEventListener('click', () => UI.toast('Descarga enviada al correo', 'success'));
    });
  },

  _seccionBoletas(idNino) {
    const boletas = Reportes.boletasDeNino(idNino);
    if (!boletas.length) {
      return `<section class="ficha-section">
        <h2 class="ficha-section-title">Boletas <span class="ficha-section-count">0</span></h2>
        <div class="empty-state"><div class="empty-state-title">Sin boletas registradas</div></div>
      </section>`;
    }
    const totalPagado = boletas.filter(b => b.pagada).reduce((a, b) => a + b.monto, 0);
    const totalPendiente = boletas.filter(b => !b.pagada).reduce((a, b) => a + b.monto, 0);
    return `<section class="ficha-section">
      <h2 class="ficha-section-title">
        Historial de boletas <span class="ficha-section-count">${boletas.length}</span>
        <span class="ficha-section-hint">${UI.fmtCLP(totalPagado)} cobrado · ${UI.fmtCLP(totalPendiente)} pendiente</span>
      </h2>
      <div class="boletas-list">
        ${boletas.map(b => `
          <div class="boleta-row ${b.pagada ? 'pagada' : 'pendiente'}">
            <div class="boleta-mes">${UI.esc(Reportes._mesLabel(b.mes))}</div>
            <div class="boleta-info">
              <div class="boleta-monto mono">${UI.fmtCLP(b.monto)}</div>
              <div class="boleta-detalle">${b.sesiones} sesiones · ${(b.minutos/60).toFixed(1)}h</div>
            </div>
            <div class="boleta-estado">
              ${b.pagada
                ? `<span class="estado-pill realizada">Pagada</span>`
                : `<span class="estado-pill no_asistio">Pendiente</span>`}
            </div>
            <div class="boleta-actions">
              ${b.pagada
                ? `<button class="btn btn-ghost boleta-revertir" data-bid="${b.id}" style="height:28px;padding:0 8px;font-size:11px">Revertir</button>`
                : `<button class="btn btn-primary boleta-pagar-inline" data-bid="${b.id}" style="height:28px;padding:0 10px;font-size:11px">Marcar pagada</button>`}
            </div>
          </div>
        `).join('')}
      </div>
    </section>`;
  },

  // ===== Secciones de la ficha unificada =====

  _seccionDatos(n) {
    return `<section class="ficha-section">
      <h2 class="ficha-section-title">Datos generales</h2>
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
    </section>`;
  },

  _seccionEquipo(equipo) {
    return `<section class="ficha-section">
      <h2 class="ficha-section-title">Equipo terapéutico <span class="ficha-section-count">${equipo.length}</span></h2>
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
    </section>`;
  },

  _seccionHistorial(sesiones) {
    const ordered = [...sesiones].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.hora_inicio || '').localeCompare(a.hora_inicio || ''));
    return `<section class="ficha-section">
      <h2 class="ficha-section-title">Historial de sesiones <span class="ficha-section-count">${ordered.length}</span> <span class="ficha-section-hint">últimas 30 mostradas</span></h2>
      ${ordered.length === 0 ? `<div class="empty-state"><div class="empty-state-title">Sin historial</div></div>` : `
        <div class="timeline">
          ${ordered.slice(0, 30).map(s => {
            const nota = Data.notaPorSesion(s.id_sesion);
            const ter = Data.terapeuta(s.id_terapeuta);
            return `<div class="timeline-item" data-sesion-id="${UI.esc(s.id_sesion)}">
              <div class="timeline-head">
                <span class="timeline-date mono">${UI.fmtFechaCorta(s.fecha)}</span>
                <div>
                  <div style="font-weight:600">${UI.esc(s.tipo_terapia)} · ${UI.esc(s.hora_inicio)}–${UI.esc(s.hora_fin)}</div>
                  <div style="font-size:11px;color:var(--text-3)">${UI.esc(ter?.nombre_visible || '—')} · Sala ${UI.esc(s.sala_nombre)}</div>
                </div>
                <span class="estado-pill ${UI.estadoClass(s.estado)}">${UI.esc(s.estado)}</span>
                <button class="timeline-caret" type="button" aria-label="Expandir notas" title="Ver/ocultar notas">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              </div>
              <div class="timeline-body">
                ${nota ? `
                  <p>${UI.esc(nota.notas_libres || 'Sin notas.')}</p>
                  ${nota.objetivos_trabajados?.length ? `<p style="margin-top:8px"><b>Objetivos trabajados:</b> ${nota.objetivos_trabajados.map(UI.esc).join(' · ')}</p>` : ''}
                  ${nota.avance_percibido != null ? `<p style="margin-top:6px"><b>Avance percibido:</b> <span class="mono">${nota.avance_percibido}/10</span></p>` : ''}
                ` : `<p class="empty" style="color:var(--text-3);font-style:italic">Sin notas registradas para esta sesión.</p>`}
              </div>
            </div>`;
          }).join('')}
        </div>
      `}
    </section>`;
  },

  _seccionObjetivos(objetivos) {
    if (!objetivos.length) {
      return `<section class="ficha-section">
        <h2 class="ficha-section-title">Objetivos terapéuticos</h2>
        <div class="empty-state"><div class="empty-state-title">Sin objetivos planteados</div></div>
      </section>`;
    }
    const grupos = {};
    objetivos.forEach(o => { (grupos[o.area] = grupos[o.area] || []).push(o); });
    return `<section class="ficha-section">
      <h2 class="ficha-section-title">Objetivos terapéuticos <span class="ficha-section-count">${objetivos.length}</span></h2>
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
    </section>`;
  },

  _seccionReuniones(idNino) {
    const reus = this._leerReuniones(idNino);
    const ordered = [...reus].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
    const futuras = ordered.filter(r => r.fecha >= HOY_ISO);
    const pasadas = ordered.filter(r => r.fecha < HOY_ISO);
    return `<section class="ficha-section">
      <h2 class="ficha-section-title">
        Reuniones <span class="ficha-section-count">${ordered.length}</span>
        <button class="btn btn-primary" id="addReuBtn" style="margin-left:auto;height:32px;padding:0 12px;font-size:12px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Agendar reunión
        </button>
      </h2>
      ${ordered.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-title">Sin reuniones agendadas</div>
          <div>Usa "Agendar reunión" para coordinar con el equipo o apoderados.</div>
        </div>
      ` : `
        ${futuras.length ? `<div class="reu-subtitle">Próximas</div>` : ''}
        <div class="reu-list">
          ${futuras.map(r => this._reuCard(r, true)).join('')}
        </div>
        ${pasadas.length ? `<div class="reu-subtitle" style="margin-top:18px">Pasadas</div>
        <div class="reu-list">
          ${pasadas.map(r => this._reuCard(r, false)).join('')}
        </div>` : ''}
      `}
    </section>`;
  },

  _reuCard(r, futura) {
    return `<div class="reu-card ${futura ? 'futura' : 'pasada'}">
      <div class="reu-date">
        <div class="reu-day mono">${r.fecha.split('-')[2]}</div>
        <div class="reu-month">${['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'][parseInt(r.fecha.split('-')[1])-1]}</div>
      </div>
      <div style="flex:1;min-width:0">
        <div class="reu-title">${UI.esc(r.tipo)} <span style="color:var(--text-3);font-weight:400;margin-left:6px;font-size:12px">${UI.esc(r.hora)}</span></div>
        <div class="reu-meta">Con ${UI.esc(r.con)}${r.modo ? ' · ' + UI.esc(r.modo) : ''}</div>
        ${r.nota ? `<div class="reu-nota">${UI.esc(r.nota)}</div>` : ''}
      </div>
      <button class="btn-icon reu-delete" data-rid="${r.id}" title="Eliminar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>`;
  },

  _leerReuniones(idNino) {
    const all = JSON.parse(localStorage.getItem('casanogal_reuniones') || '{}');
    return all[idNino] || [];
  },

  _guardarReuniones(idNino, list) {
    const all = JSON.parse(localStorage.getItem('casanogal_reuniones') || '{}');
    all[idNino] = list;
    localStorage.setItem('casanogal_reuniones', JSON.stringify(all));
  },

  _borrarReunion(idNino, rid) {
    const list = this._leerReuniones(idNino).filter(r => r.id !== rid);
    this._guardarReuniones(idNino, list);
    UI.toast('Reunión eliminada', 'success');
  },

  _abrirModalReunion(idNino) {
    const html = `
      <div class="pendiente-modal-overlay" id="reuOverlay">
        <div class="pendiente-modal" style="width:min(440px,92vw)">
          <div class="pendiente-modal-head">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--cn-azul)"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <div>
              <div class="pendiente-modal-title">Agendar reunión</div>
              <div class="pendiente-modal-eyebrow">Coordina con equipo o apoderados</div>
            </div>
            <button class="panel-close" id="reuClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="pendiente-modal-body" style="display:flex;flex-direction:column;gap:12px">
            <div class="field">
              <label class="field-label">Tipo</label>
              <select class="field-select" id="reuTipo">
                <option>Reunión con apoderados</option>
                <option>Reunión de equipo terapéutico</option>
                <option>Reunión clínica con médico externo</option>
                <option>Reunión de coordinación</option>
              </select>
            </div>
            <div class="field-row">
              <div class="field"><label class="field-label">Fecha</label><input type="date" class="field-input" id="reuFecha" value="${HOY_ISO}"></div>
              <div class="field"><label class="field-label">Hora</label><input type="time" class="field-input" id="reuHora" value="16:00"></div>
            </div>
            <div class="field">
              <label class="field-label">Con</label>
              <input type="text" class="field-input" id="reuCon" placeholder="Ej: Carolina Pérez · apoderada">
            </div>
            <div class="field">
              <label class="field-label">Modalidad</label>
              <select class="field-select" id="reuModo">
                <option>Presencial</option>
                <option>Videollamada (Meet)</option>
                <option>Híbrida</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">Tema / nota (opcional)</label>
              <input type="text" class="field-input" id="reuNota" placeholder="Ej: Revisar objetivos del mes y avances">
            </div>
          </div>
          <div class="pendiente-modal-foot">
            <button class="btn btn-ghost" id="reuCancel">Cancelar</button>
            <button class="btn btn-primary" id="reuSave">Agendar</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    const close = () => document.getElementById('reuOverlay')?.remove();
    document.getElementById('reuClose').addEventListener('click', close);
    document.getElementById('reuCancel').addEventListener('click', close);
    document.getElementById('reuOverlay').addEventListener('click', (e) => { if (e.target.id === 'reuOverlay') close(); });
    document.getElementById('reuSave').addEventListener('click', () => {
      const r = {
        id: 'RE-' + Date.now().toString(36),
        tipo: document.getElementById('reuTipo').value,
        fecha: document.getElementById('reuFecha').value,
        hora: document.getElementById('reuHora').value,
        con: document.getElementById('reuCon').value.trim() || 'Equipo',
        modo: document.getElementById('reuModo').value,
        nota: document.getElementById('reuNota').value.trim(),
      };
      const list = this._leerReuniones(idNino);
      list.push(r);
      this._guardarReuniones(idNino, list);
      UI.toast('Reunión agendada', 'success');
      close();
      this._renderDetalle(idNino);
    });
  },

  _seccionDocumentos(docs) {
    return `<section class="ficha-section">
      <h2 class="ficha-section-title">Documentos <span class="ficha-section-count">${docs.length}</span></h2>
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
            <button class="btn btn-ghost doc-download" type="button" aria-label="Descargar ${UI.esc(d.nombre_archivo)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </div>`).join('')}
        </div>
      `}
    </section>`;
  },

};
