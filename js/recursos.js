// Módulos Equipo, Niños, Salas + placeholder Config/Permisos
const Recursos = {
  renderEquipo() {
    const list = Data.terapeutasEfectivos();
    const q = State.searchQuery.toLowerCase();
    const filtered = list.filter(t => !q || t.nombre_completo.toLowerCase().includes(q) || t.abreviacion.toLowerCase().includes(q));

    document.getElementById('main').innerHTML = `
      <div class="section-head">
        <div>
          <div class="section-title">Equipo</div>
          <div class="section-sub"><b>${list.length} terapeutas</b> · sus horas, contratos y especialidades en un solo lugar</div>
        </div>
      </div>
      <div class="fichas-toolbar">
        <div class="fichas-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="recSearch" value="${UI.esc(State.searchQuery)}" placeholder="Buscar terapeuta…">
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th></th><th>Nombre</th><th>Especialidad</th><th>Contrato</th><th class="num">Horas</th><th>Email</th><th>Estado</th>
          </tr></thead>
          <tbody>
            ${filtered.map(t => {
              const c = ESPECIALIDAD_VAR[t.especialidad] || ESPECIALIDAD_VAR['Terapia Ocupacional'];
              return `<tr>
                <td><span class="equipo-avatar" style="background:${c.bg};color:${c.text};width:30px;height:30px;font-size:10px">${UI.esc(t.abreviacion)}</span></td>
                <td><div style="font-weight:600;color:var(--text)">${UI.esc(t.nombre_completo)}</div><div style="font-size:11px;color:var(--text-3)">${UI.esc(t.nombre_visible)}</div></td>
                <td><span class="badge" style="background:${c.bg};color:${c.text}">${UI.esc(t.especialidad)}</span></td>
                <td>${UI.esc(t.tipo_contrato)}</td>
                <td class="num">${t.horas_contrato}</td>
                <td class="mono" style="font-size:12px">${UI.esc(t.email)}</td>
                <td>
                  <span class="estado-prof estado-${Config._estadoSlug(t.estado)}">${UI.esc(t.estado || 'Activo')}</span>
                  ${t.estado_nota ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px">${UI.esc(t.estado_nota)}</div>` : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    document.getElementById('recSearch').addEventListener('input', e => { State.searchQuery = e.target.value; this.renderEquipo(); });
  },

  renderNinos() {
    State.fichaActiva = null;
    Fichas._renderLista();
    // Igualito a Fichas, pero el sidebar resalta "Niños"
  },

  // Vista general de disponibilidad: matriz terapeutas × horas de un día.
  // Es la "hoja de trabajo" de Trini: ver de un vistazo quién está libre a cada hora.
  renderDisponibilidad() {
    const bloques = (State.data.bloques_horarios || []).filter(b => b.periodo !== 'Tarde').sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const ters = Data.terapeutasEfectivos().filter(t => t.estado === 'Activo')
      .sort((a, b) => (a.especialidad || '').localeCompare(b.especialidad || '') || a.nombre_completo.localeCompare(b.nombre_completo));
    const fechas = fechasSemana();
    const idx = (this._dispDiaIdx != null) ? this._dispDiaIdx : Math.max(0, fechas.indexOf(HOY_ISO));
    const dia = fechas[idx] || fechas[0];
    const diaNombre = DIAS[idx];
    const esFeriado = (State.data.meta?.feriados || []).includes(dia);
    const sesDia = State.data.sesiones.filter(s => s.fecha === dia);
    const ocup = {};
    sesDia.forEach(s => {
      ocup[s.id_terapeuta + '|' + s.id_bloque] = s;
      if (s.id_terapeuta_secundario) ocup[s.id_terapeuta_secundario + '|' + s.id_bloque] = s;
    });

    const diasBtns = fechas.map((f, i) => `<button class="disp-dia-btn ${i === idx ? 'active' : ''}" data-idx="${i}">${DIAS_ABBR[i]} ${Number(f.split('-')[2])}</button>`).join('');

    const filas = ters.map(t => {
      const c = ESPECIALIDAD_VAR[t.especialidad] || {};
      const celdas = bloques.map(b => {
        const base = `data-ter="${t.id_terapeuta}" data-bloque="${b.id_bloque}" data-fecha="${dia}"`;
        if (b.es_reunion_equipo) return `<td class="disp-cell disp-fijo" title="Bloque de reunión de equipo">reunión</td>`;
        const disp = t.disponibilidad_bloques;
        if (disp && disp[diaNombre] && !disp[diaNombre].includes(b.id_bloque)) return `<td class="disp-cell disp-nodisp" ${base} title="No disponible">—</td>`;
        const s = ocup[t.id_terapeuta + '|' + b.id_bloque];
        if (s) return `<td class="disp-cell disp-ocupado" ${base} draggable="true" data-id="${s.id_sesion}" style="background:${c.bg || 'var(--bg-soft)'};color:${c.text || 'var(--text)'}" title="${UI.esc(s.nino_visible)} · ${UI.esc(s.tipo_terapia)} · arrastra para mover o reasignar">${UI.esc((s.nino_visible || '').split(' ')[0])}</td>`;
        return `<td class="disp-cell disp-libre" ${base} title="Libre · suelta aquí para mover">libre</td>`;
      }).join('');
      return `<tr>
        <td class="disp-ter"><span class="disp-abr" style="background:${c.bg || 'var(--cn-azul-bg)'};color:${c.text || 'var(--cn-azul-deep)'}">${UI.esc(t.abreviacion)}</span><span class="disp-ter-nom">${UI.esc(t.nombre_completo)}<small>${UI.esc(t.especialidad)}</small></span></td>
        ${celdas}
      </tr>`;
    }).join('');

    // Panel equivalente POR NIÑO (lo pidió Trini): ver el horario de cada niño el mismo día.
    const ocupNino = {};
    sesDia.forEach(s => { if (s.id_nino) (ocupNino[s.id_nino + '|' + s.id_bloque] = ocupNino[s.id_nino + '|' + s.id_bloque] || []).push(s); });
    const ninos = (State.data.ninos || [])
      .filter(n => n.estado === 'Activo' && sesDia.some(s => s.id_nino === n.id_nino))
      .sort((a, b) => { // intensivos primero, luego por nombre
        const ai = UI.esIntensivo(a) ? 0 : 1, bi = UI.esIntensivo(b) ? 0 : 1;
        return ai - bi || a.nombre_completo.localeCompare(b.nombre_completo);
      });
    const filasNino = ninos.map(n => {
      const cn = UI.colorNino(n.id_nino);
      const celdas = bloques.map(b => {
        const lista = ocupNino[n.id_nino + '|' + b.id_bloque] || [];
        const reu = lista.find(s => s.tipo_actividad === 'Reunión de equipo');
        if (reu) return `<td class="disp-cell disp-fijo" title="Reunión de equipo">reunión</td>`;
        const clin = lista.filter(s => s.tipo_actividad !== 'Reunión de equipo');
        if (clin.length) {
          const detalle = clin.map(s => `${s.tipo_terapia} (${s.terapeuta_abr || ''})`).join(' + ');
          const abrs = clin.map(s => UI.esc(s.terapeuta_abr || '·')).join('+');
          return `<td class="disp-cell disp-ocupado" style="background:${cn.bg};color:${cn.text}" title="${UI.esc(detalle)}">${abrs}</td>`;
        }
        return `<td class="disp-cell disp-libre" title="Sin sesión">libre</td>`;
      }).join('');
      return `<tr>
        <td class="disp-ter"><span class="disp-abr" style="background:${cn.bg};color:${cn.text}">${UI.esc(UI.initials(n.nombre_completo))}</span><span class="disp-ter-nom">${UI.esc(n.nombre_visible)}<small>${n.edad_anios ? UI.esc(n.edad_anios) + ' años' : ''}</small></span></td>
        ${celdas}
      </tr>`;
    }).join('');

    document.getElementById('main').innerHTML = `
      <div class="section-head"><div>
        <div class="section-title">Disponibilidad</div>
        <div class="section-sub">Horario del día por terapeuta y por niño, lado a lado · ${ters.length} terapeutas · ${ninos.length} niños con atención. Útil para cubrir una ausencia o armar una dupla.</div>
      </div></div>
      <div class="disp-dias">${diasBtns}</div>
      ${esFeriado ? '<div class="disp-feriado">Ese día es feriado · no hay atención.</div>' : ''}
      <div class="disp-legend"><span class="disp-leg disp-leg-libre">libre</span><span class="disp-leg disp-leg-ocupado">ocupado</span><span class="disp-leg disp-leg-nodisp">no disponible</span></div>
      <div class="disp-split">
        <div class="disp-col">
          <div class="disp-col-head">Por terapeuta</div>
          <div class="table-wrap disp-wrap">
            <table class="disp-table">
              <thead><tr><th class="disp-th-ter">Terapeuta</th>${bloques.map(b => `<th>${b.hora_inicio}</th>`).join('')}</tr></thead>
              <tbody>${filas}</tbody>
            </table>
          </div>
        </div>
        <div class="disp-col">
          <div class="disp-col-head">Por niño</div>
          <div class="table-wrap disp-wrap">
            <table class="disp-table">
              <thead><tr><th class="disp-th-ter">Niño</th>${bloques.map(b => `<th>${b.hora_inicio}</th>`).join('')}</tr></thead>
              <tbody>${filasNino || `<tr><td class="disp-ter" colspan="${bloques.length + 1}">Sin atención de niños este día.</td></tr>`}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    document.querySelectorAll('.disp-dia-btn').forEach(b => b.addEventListener('click', () => { this._dispDiaIdx = Number(b.dataset.idx); this.renderDisponibilidad(); }));
    this._wireDispDrag();
  },

  // Arrastrar y soltar en la planilla por terapeuta: mueve de bloque y/o reasigna terapeuta.
  _wireDispDrag() {
    let dragId = null;
    const validar = (cell, sesion) => {
      if (!sesion) return 'No hay sesión';
      const { fecha, bloque: idBloque, ter: idTer } = cell.dataset;
      if (!idTer || !idBloque) return 'Destino inválido';
      if (cell.classList.contains('disp-nodisp')) return 'Ese terapeuta no atiende en ese bloque';
      if (cell.classList.contains('disp-fijo')) return 'Bloque reservado para reuniones';
      const otras = State.data.sesiones.filter(s => s.fecha === fecha && s.id_bloque === idBloque && s.id_sesion !== sesion.id_sesion);
      if (otras.some(s => s.id_terapeuta === idTer)) return 'Ese terapeuta ya tiene una sesión en ese bloque';
      if (sesion.id_sala && otras.some(s => s.id_sala === sesion.id_sala)) return 'La sala ya está ocupada en ese bloque';
      return null;
    };
    document.querySelectorAll('.disp-table .disp-ocupado[draggable="true"]').forEach(cell => {
      cell.addEventListener('dragstart', e => { dragId = cell.dataset.id; cell.classList.add('disp-dragging'); e.dataTransfer.effectAllowed = 'move'; });
      cell.addEventListener('dragend', () => { cell.classList.remove('disp-dragging'); document.querySelectorAll('.disp-cell.disp-drop, .disp-cell.disp-drop-bad').forEach(c => c.classList.remove('disp-drop', 'disp-drop-bad')); dragId = null; });
    });
    document.querySelectorAll('.disp-table .disp-cell').forEach(cell => {
      if (!cell.dataset.ter) return; // solo celdas de la tabla por terapeuta
      cell.addEventListener('dragover', e => {
        if (!dragId) return;
        e.preventDefault();
        const sesion = State.data.sesiones.find(s => s.id_sesion === dragId);
        cell.classList.add(validar(cell, sesion) ? 'disp-drop-bad' : 'disp-drop');
      });
      cell.addEventListener('dragleave', () => cell.classList.remove('disp-drop', 'disp-drop-bad'));
      cell.addEventListener('drop', e => {
        if (!dragId) return;
        e.preventDefault();
        cell.classList.remove('disp-drop', 'disp-drop-bad');
        const sesion = State.data.sesiones.find(s => s.id_sesion === dragId);
        const err = validar(cell, sesion);
        if (err) { UI.toast('⚠ ' + err, 'alert'); return; }
        const t = Data.terapeuta(cell.dataset.ter);
        const b = Data.bloque(cell.dataset.bloque);
        sesion.id_terapeuta = cell.dataset.ter;
        if (t) sesion.terapeuta_abr = t.abreviacion;
        sesion.id_bloque = cell.dataset.bloque;
        if (b) { sesion.hora_inicio = b.hora_inicio; sesion.hora_fin = b.hora_fin; }
        sesion.conflicto_detectado = null;
        UI.toast(`${sesion.nino_visible} movido a ${t ? UI.esc(t.nombre_visible) : ''} · ${b ? b.hora_inicio : ''}`, 'success');
        this.renderDisponibilidad();
      });
    });
  },

  renderSalas() {
    const list = State.data.salas;
    const sesHoy = Data.sesionesVisibles().filter(s => s.fecha === HOY_ISO);
    document.getElementById('main').innerHTML = `
      <div class="section-head">
        <div>
          <div class="section-title">Salas</div>
          <div class="section-sub"><b>Ocupación en tiempo real</b> de las ${list.length} salas del centro · hoy ${UI.fmtFecha(HOY_ISO)}</div>
        </div>
      </div>
      <div class="fichas-grid">
        ${list.map(s => {
          const enUso = sesHoy.filter(x => x.id_sala === s.id_sala).length;
          const pct = Math.min(100, Math.round(enUso / 14 * 100));
          const c = UI.colorSala(s.tipo_principal);
          return `<div class="ficha-card sala-card" data-sala="${s.id_sala}" style="cursor:pointer;border-left:4px solid ${c.main}">
            <div class="ficha-card-head">
              <span class="ficha-avatar" style="background:${c.bg};color:${c.text}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              </span>
              <div style="flex:1">
                <div class="ficha-name">${UI.esc(s.nombre)}</div>
                <div class="ficha-prog" style="color:${c.main};font-weight:600">${UI.esc(s.tipo_principal)} · cap. ${s.capacidad_personas}</div>
              </div>
            </div>
            <div style="font-size:12px;color:var(--text-3);line-height:1.4">${UI.esc(s.equipamiento || '—')}</div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-3);margin-bottom:4px">
                <span>Ocupación hoy</span><span class="mono">${enUso}/14</span>
              </div>
              <div class="progress"><div class="progress-bar" style="width:${pct}%;background:${pct>80?'var(--alert)':pct>50?'var(--cn-mostaza)':'var(--success)'}"></div></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
    document.querySelectorAll('.sala-card').forEach(card => {
      card.addEventListener('click', () => this._abrirDetalleSala(card.dataset.sala));
    });
  },

  _abrirDetalleSala(idSala) {
    const sala = Data.sala(idSala);
    if (!sala) return;
    const c = UI.colorSala(sala.tipo_principal);
    // Semana actual: contar por día y por bloque
    const fechas = fechasSemana();
    const sesSemana = State.data.sesiones.filter(s => fechas.includes(s.fecha) && s.id_sala === idSala);
    const sesHoy = sesSemana.filter(s => s.fecha === HOY_ISO);
    const bloques = State.data.bloques_horarios.sort((a, b) => a.orden - b.orden);

    // Matriz [bloque][día] = sesión o null
    const matriz = bloques.map(b => DIAS.map((d, i) => sesSemana.find(s => s.fecha === fechas[i] && s.id_bloque === b.id_bloque)));

    // Día total semana
    const porDia = DIAS.map((d, i) => sesSemana.filter(s => s.fecha === fechas[i]).length);
    const totalSemana = sesSemana.length;
    const porPrograma = {};
    sesSemana.forEach(s => { porPrograma[s.id_programa] = (porPrograma[s.id_programa] || 0) + 1; });

    const html = `
      <div class="pendiente-modal-overlay" id="salaOverlay">
        <div class="pendiente-modal" style="width:min(880px,95vw)">
          <div class="pendiente-modal-head" style="background:${c.bg};border-bottom:1px solid ${c.main}">
            <span class="ficha-avatar" style="background:${c.main};color:white;width:40px;height:40px">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            </span>
            <div>
              <div class="pendiente-modal-title">${UI.esc(sala.nombre)}</div>
              <div class="pendiente-modal-eyebrow" style="color:${c.text}">${UI.esc(sala.tipo_principal)} · capacidad ${sala.capacidad_personas} personas</div>
            </div>
            <button class="panel-close" id="salaClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="pendiente-modal-body" style="padding:18px 22px;max-height:75vh;overflow-y:auto">
            <div class="reportes-summary" style="margin-bottom:18px">
              <div class="summary-card"><div class="summary-label">Sesiones hoy</div><div class="summary-value">${sesHoy.length}</div></div>
              <div class="summary-card"><div class="summary-label">Sesiones semana</div><div class="summary-value">${totalSemana}</div></div>
              <div class="summary-card"><div class="summary-label">Día más cargado</div><div class="summary-value" style="font-size:14px">${DIAS_LABEL[porDia.indexOf(Math.max(...porDia))]} · ${Math.max(...porDia)}</div></div>
              <div class="summary-card"><div class="summary-label">Programas</div><div class="summary-value" style="font-size:14px">${Object.entries(porPrograma).map(([k,v]) => `${k.replace('PROG-','')}:${v}`).join(' · ') || '—'}</div></div>
            </div>

            <h3 style="font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--text-2);margin:14px 0 10px">Ocupación de la semana</h3>
            <div class="sala-grid">
              <div class="sala-grid-head"></div>
              ${DIAS_ABBR.map((d, i) => `<div class="sala-grid-head">${d}<br><span class="mono" style="color:${fechas[i]===HOY_ISO?'var(--cn-azul)':'var(--text-3)'};font-size:11px">${fechas[i].slice(-2)}</span></div>`).join('')}
              ${bloques.map((b, bi) => `
                <div class="sala-grid-time mono">${b.hora_inicio}</div>
                ${matriz[bi].map((s, di) => {
                  if (!s) return `<div class="sala-grid-cell empty"></div>`;
                  const ter = Data.terapeuta(s.id_terapeuta);
                  const cs = ESPECIALIDAD_VAR[s.tipo_terapia] || ESPECIALIDAD_VAR['Terapia Ocupacional'];
                  return `<div class="sala-grid-cell" style="background:${cs.bg};color:${cs.text};border-left:2px solid ${cs.main}" title="${UI.esc(s.nino_visible)} · ${UI.esc(ter?.nombre_visible||'')} · ${UI.esc(s.tipo_terapia)}">
                    <div style="font-size:10px;font-weight:700;line-height:1.1">${UI.esc(s.nino_visible.slice(0, 10))}</div>
                    <div style="font-size:8.5px;opacity:0.8">${UI.esc(ter?.abreviacion || '')}</div>
                  </div>`;
                }).join('')}
              `).join('')}
            </div>

            <h3 style="font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--text-2);margin:22px 0 8px">Equipamiento</h3>
            <p style="font-size:13px;color:var(--text-2);line-height:1.6">${UI.esc(sala.equipamiento || 'Sin equipamiento registrado')}</p>
            ${sala.notas ? `<p style="font-size:12px;color:var(--text-3);margin-top:6px">${UI.esc(sala.notas)}</p>` : ''}
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    const close = () => document.getElementById('salaOverlay')?.remove();
    document.getElementById('salaClose').addEventListener('click', close);
    document.getElementById('salaOverlay').addEventListener('click', (e) => { if (e.target.id === 'salaOverlay') close(); });
  },

  renderNinosTable() {
    const list = Data.ninosVisibles();
    const q = State.searchQuery.toLowerCase();
    const filtered = list.filter(n => !q || n.nombre_completo.toLowerCase().includes(q));
    document.getElementById('main').innerHTML = `
      <div class="section-head">
        <div>
          <div class="section-title">Niños activos</div>
          <div class="section-sub"><b>${list.filter(n=>n.id_programa==='PROG-INT').length} en Intensivo</b>, <b>${list.filter(n=>n.id_programa==='PROG-CONT').length} en Seguimiento</b>, ${list.filter(n=>['PROG-EVAL','PROG-APR','PROG-AT'].includes(n.id_programa)).length} en evaluación o programas puntuales</div>
        </div>
      </div>
      <div class="fichas-toolbar">
        <div class="fichas-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="recSearch" value="${UI.esc(State.searchQuery)}" placeholder="Buscar niño…">
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th></th><th>Nombre</th><th>Edad</th><th>Programa</th><th>Apoderado</th><th>Inicio</th><th>Término</th>
          </tr></thead>
          <tbody>
            ${filtered.map(n => {
              const c = UI.colorNino(n.id_nino);
              return `<tr style="cursor:pointer" data-id="${n.id_nino}">
                <td><span class="ficha-avatar" style="width:32px;height:32px;font-size:11px;background:${c.bg};color:${c.text};${UI.ringIntensivo(n)}">${UI.esc(UI.initials(n.nombre_completo))}</span></td>
                <td><div style="font-weight:600;color:var(--text)">${UI.esc(n.nombre_completo)}${UI.badgeIntensivo(n)}</div><div style="font-size:11px;color:var(--text-3)" class="mono">${UI.esc(n.rut)}</div></td>
                <td class="num">${n.edad_anios}</td>
                <td>${UI.esc(n.programa_nombre)}</td>
                <td>${UI.esc(n.apoderado_principal)}</td>
                <td class="mono">${UI.fmtFechaCorta(n.fecha_inicio_programa)}</td>
                <td class="mono">${UI.fmtFechaCorta(n.fecha_termino_programa)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    document.getElementById('recSearch').addEventListener('input', e => { State.searchQuery = e.target.value; this.renderNinosTable(); });
    document.querySelectorAll('.data-table tr[data-id]').forEach(r => {
      r.addEventListener('click', () => { State.fichaActiva = r.dataset.id; State.module = 'fichas'; Main.activateNav('fichas'); Fichas.render(); });
    });
  },

  renderPlaceholder(label) {
    if (label === 'Configuración') return this.renderConfig();
    if (label === 'Permisos') return this.renderPermisos();
    document.getElementById('main').innerHTML = `
      <div class="section-head"><div><div class="section-title">${UI.esc(label)}</div></div></div>
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <div class="empty-state-title">Próximamente disponible</div>
        <div class="empty-state-sub">Este módulo está en construcción. Cuando esté listo aparecerá aquí con todas sus funciones.</div>
      </div>
    `;
  },

  renderConfig() {
    const stored = JSON.parse(localStorage.getItem('casanogal_config') || '{}');
    const cfg = {
      nombre_centro: stored.nombre_centro ?? 'Casa Nogal',
      direccion:     stored.direccion ?? 'Av. Las Condes 8765, Las Condes, Santiago',
      telefono:      stored.telefono ?? '+56 2 2345 6789',
      email:         stored.email ?? 'contacto@casanogal.cl',
      moneda:        stored.moneda ?? 'CLP',
      bloque_min:    stored.bloque_min ?? 35,
      capacidad_int: stored.capacidad_int ?? 40,
      notif_conflictos: stored.notif_conflictos ?? true,
      notif_boletas:    stored.notif_boletas ?? true,
      notif_padres:     stored.notif_padres ?? false,
      idioma:        stored.idioma ?? 'Español (Chile)',
      zona_horaria:  stored.zona_horaria ?? 'America/Santiago',
      backup_auto:   stored.backup_auto ?? true,
    };

    document.getElementById('main').innerHTML = `
      <div class="section-head">
        <div>
          <div class="section-title">Configuración</div>
          <div class="section-sub">Datos del centro, parámetros operativos y notificaciones</div>
        </div>
        <div class="section-actions">
          <button class="btn btn-secondary" id="cfgReset">Restablecer</button>
          <button class="btn btn-primary" id="cfgSave">Guardar cambios</button>
        </div>
      </div>

      <section class="ficha-section">
        <h2 class="ficha-section-title">Datos del centro</h2>
        <div class="info-grid">
          <div class="field"><label class="field-label">Nombre del centro</label><input class="field-input" id="cfg-nombre" value="${UI.esc(cfg.nombre_centro)}"></div>
          <div class="field"><label class="field-label">Email de contacto</label><input class="field-input" id="cfg-email" value="${UI.esc(cfg.email)}"></div>
          <div class="field" style="grid-column:1/-1"><label class="field-label">Dirección</label><input class="field-input" id="cfg-dir" value="${UI.esc(cfg.direccion)}"></div>
          <div class="field"><label class="field-label">Teléfono</label><input class="field-input" id="cfg-tel" value="${UI.esc(cfg.telefono)}"></div>
          <div class="field"><label class="field-label">Moneda</label>
            <select class="field-select" id="cfg-moneda">
              <option ${cfg.moneda==='CLP'?'selected':''}>CLP</option>
              <option ${cfg.moneda==='USD'?'selected':''}>USD</option>
              <option ${cfg.moneda==='UF'?'selected':''}>UF</option>
            </select>
          </div>
        </div>
      </section>

      <section class="ficha-section">
        <h2 class="ficha-section-title">Parámetros operativos</h2>
        <div class="info-grid">
          <div class="field"><label class="field-label">Duración bloque (minutos)</label><input type="number" class="field-input" id="cfg-bloq" value="${cfg.bloque_min}"></div>
          <div class="field"><label class="field-label">Capacidad Intensivo</label><input type="number" class="field-input" id="cfg-cap" value="${cfg.capacidad_int}"></div>
          <div class="field"><label class="field-label">Idioma</label>
            <select class="field-select" id="cfg-idi">
              <option>Español (Chile)</option>
              <option>Español (España)</option>
            </select>
          </div>
          <div class="field"><label class="field-label">Zona horaria</label>
            <select class="field-select" id="cfg-zh">
              <option>America/Santiago</option>
              <option>America/Lima</option>
            </select>
          </div>
        </div>
      </section>

      <section class="ficha-section">
        <h2 class="ficha-section-title">Notificaciones</h2>
        <div class="toggle-list">
          <label class="toggle-row">
            <div><div class="toggle-title">Avisar conflictos detectados</div><div class="toggle-sub">Cuando el sistema detecta dos sesiones que chocan, alerta a coordinación.</div></div>
            <input type="checkbox" id="cfg-n1" ${cfg.notif_conflictos ? 'checked' : ''} class="toggle-input">
            <span class="toggle-pill"></span>
          </label>
          <label class="toggle-row">
            <div><div class="toggle-title">Envío automático a padres</div><div class="toggle-sub">Mandar el horario semanal a los apoderados por correo (lunes 8am).</div></div>
            <input type="checkbox" id="cfg-n3" ${cfg.notif_padres ? 'checked' : ''} class="toggle-input">
            <span class="toggle-pill"></span>
          </label>
          <label class="toggle-row">
            <div><div class="toggle-title">Backup automático del maestro de datos</div><div class="toggle-sub">Respaldo semanal al Drive del centro.</div></div>
            <input type="checkbox" id="cfg-n4" ${cfg.backup_auto ? 'checked' : ''} class="toggle-input">
            <span class="toggle-pill"></span>
          </label>
        </div>
      </section>
    `;

    document.getElementById('cfgSave').addEventListener('click', () => {
      const data = {
        nombre_centro: document.getElementById('cfg-nombre').value,
        email: document.getElementById('cfg-email').value,
        direccion: document.getElementById('cfg-dir').value,
        telefono: document.getElementById('cfg-tel').value,
        moneda: document.getElementById('cfg-moneda').value,
        bloque_min: Number(document.getElementById('cfg-bloq').value),
        capacidad_int: Number(document.getElementById('cfg-cap').value),
        idioma: document.getElementById('cfg-idi').value,
        zona_horaria: document.getElementById('cfg-zh').value,
        notif_conflictos: document.getElementById('cfg-n1').checked,
        notif_padres:     document.getElementById('cfg-n3').checked,
        backup_auto:      document.getElementById('cfg-n4').checked,
      };
      localStorage.setItem('casanogal_config', JSON.stringify(data));
      UI.toast('Configuración guardada', 'success');
    });
    document.getElementById('cfgReset').addEventListener('click', () => {
      localStorage.removeItem('casanogal_config');
      UI.toast('Configuración restablecida', 'success');
      this.renderConfig();
    });
  },

  renderPermisos() {
    const ROLES = [
      { id: 'coordinacion', label: 'Coordinación · Super Admin', color: 'var(--cn-azul)' },
      { id: 'terapeuta',    label: 'Terapeuta',                    color: 'var(--to)' },
      { id: 'padres',       label: 'Padres / Apoderado',           color: 'var(--cn-mostaza)' },
    ];
    const PERMISOS = [
      { id: 'cal_ver',      label: 'Ver calendario completo',         desc: 'Ver toda la agenda de todos los niños y terapeutas.' },
      { id: 'cal_editar',   label: 'Crear y mover sesiones',          desc: 'Crear nuevas sesiones, mover por drag & drop, eliminar.' },
      { id: 'fichas_ver',   label: 'Ver fichas clínicas',             desc: 'Acceso a fichas con historial, notas, objetivos.' },
      { id: 'fichas_edit',  label: 'Editar fichas clínicas',          desc: 'Modificar datos del niño, agregar diagnósticos, alergias.' },
      { id: 'notas_edit',   label: 'Escribir notas clínicas',         desc: 'Agregar y editar notas de sesión, objetivos trabajados.' },
      { id: 'pagos_otros',  label: 'Ver pagos de otros profesionales',desc: 'Solo super admin. Cada terapeuta solo ve su propia liquidación.' },
      { id: 'agend_reu',    label: 'Agendar reuniones',               desc: 'Crear reuniones de equipo o con apoderados.' },
      { id: 'config_sys',   label: 'Modificar configuración',         desc: 'Cambiar datos del centro, notificaciones, parámetros.' },
    ];
    const MATRIZ = {
      coordinacion: ['cal_ver','cal_editar','fichas_ver','fichas_edit','notas_edit','pagos_otros','agend_reu','config_sys'],
      terapeuta:    ['cal_ver','cal_editar','fichas_ver','notas_edit','agend_reu'],
      padres:       [],
    };
    // Padres: solo "ver agenda del hijo" como permiso virtual
    document.getElementById('main').innerHTML = `
      <div class="perm-banner">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <div><b>Solo el super admin puede modificar permisos.</b> Esta facultad estará disponible en la versión final del sistema. Por ahora la matriz es de solo lectura.</div>
      </div>
      <div class="section-head">
        <div>
          <div class="section-title">Permisos por rol</div>
          <div class="section-sub">Matriz de accesos. Coordinación es Super Admin. Cada terapeuta solo ve lo que le corresponde.</div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Permiso</th>
              ${ROLES.map(r => `<th style="text-align:center"><span class="badge" style="background:${r.color};color:white">${UI.esc(r.label)}</span></th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${PERMISOS.map(p => `<tr>
              <td>
                <div style="font-weight:600;color:var(--text)">${UI.esc(p.label)}</div>
                <div style="font-size:11px;color:var(--text-3);margin-top:2px">${UI.esc(p.desc)}</div>
              </td>
              ${ROLES.map(r => {
                const tiene = MATRIZ[r.id].includes(p.id) || (r.id === 'padres' && p.id === 'cal_ver_propio');
                return `<td style="text-align:center">
                  ${tiene
                    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" style="display:inline-block"><polyline points="20 6 9 17 4 12"/></svg>`
                    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" stroke-width="2" style="display:inline-block"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`}
                </td>`;
              }).join('')}
            </tr>`).join('')}
            <tr style="background:var(--cn-mostaza-bg)">
              <td><b>Acceso adicional para Padres:</b><br><span style="font-size:11px;color:var(--text-2)">Ver solo la agenda y los datos del hijo asociado. Descargar PDF del horario semanal.</span></td>
              <td colspan="3" style="font-size:12px;color:var(--text-2)">Por seguridad, los padres no tienen acceso a notas clínicas internas ni a información de otros niños.</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },
};
