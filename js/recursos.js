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
            <th></th><th>Nombre</th><th>Especialidad</th><th>Contrato</th><th class="num">Horas</th><th>Carga semana</th><th>Estado</th>
          </tr></thead>
          <tbody>
            ${filtered.map(t => {
              const c = ESPECIALIDAD_VAR[t.especialidad] || ESPECIALIDAD_VAR['Terapia Ocupacional'];
              const m = this._terapeutaMetricas(t);
              const alto = m.pctUsado > 80;
              return `<tr class="equipo-row" data-ter="${t.id_terapeuta}" style="cursor:pointer">
                <td><span class="equipo-avatar" style="background:${c.bg};color:${c.text};width:30px;height:30px;font-size:10px">${UI.esc(t.abreviacion)}</span></td>
                <td><div style="font-weight:600;color:var(--text)">${UI.esc(t.nombre_completo)}</div><div style="font-size:11px;color:var(--text-3)">${UI.esc(t.nombre_visible)}</div></td>
                <td><span class="badge" style="background:${c.bg};color:${c.text}">${UI.esc(t.especialidad)}</span></td>
                <td>${UI.esc(t.tipo_contrato)}</td>
                <td class="num">${t.horas_contrato}</td>
                <td>
                  <div class="carga-bar" title="${m.usados} de ${m.capacidad} bloques usados">
                    <div class="carga-fill ${alto?'is-alto':''}" style="width:${Math.min(100,m.pctUsado)}%"></div>
                  </div>
                  <div style="font-size:11px;margin-top:3px;color:${alto?'var(--alert)':'var(--text-3)'};font-weight:${alto?700:500}">${m.pctUsado}% usado${alto?' · sobre 80%':''}</div>
                </td>
                <td>
                  <span class="estado-prof estado-${Config._estadoSlug(t.estado)}">${UI.esc(t.estado || 'Activo')}</span>
                  ${t.estado_nota ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px">${UI.esc(t.estado_nota)}</div>` : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div id="terModalMount"></div>
    `;
    document.getElementById('recSearch').addEventListener('input', e => { State.searchQuery = e.target.value; this.renderEquipo(); });
    document.querySelectorAll('.equipo-row').forEach(r =>
      r.addEventListener('click', () => this._abrirTerapeuta(r.dataset.ter))
    );
  },

  // Carga semanal del terapeuta: bloques usados vs capacidad, y desglose terapias / reuniones.
  _terapeutaMetricas(t) {
    const fechas = fechasSemana();
    const ses = State.data.sesiones.filter(s =>
      (s.id_terapeuta === t.id_terapeuta || s.id_terapeuta_secundario === t.id_terapeuta) && fechas.includes(s.fecha));
    const reuniones = ses.filter(s => s.tipo_actividad === 'Reunión de equipo').length;
    const terapias = ses.length - reuniones;
    const bloques = (State.data.bloques_horarios || []).filter(b => !b.es_reunion_equipo);
    let capacidad = 0;
    const disp = t.disponibilidad_bloques;
    if (disp) DIAS.forEach(d => { capacidad += (disp[d] || []).filter(id => bloques.some(b => b.id_bloque === id)).length; });
    else capacidad = bloques.length * DIAS.length;
    const usados = ses.length;
    return {
      reuniones, terapias, usados, capacidad,
      pctUsado: capacidad ? Math.round(usados / capacidad * 100) : 0,
      pctEfectivo: usados ? Math.round(terapias / usados * 100) : 0,
    };
  },

  // Asistencia del terapeuta (registro manual, persiste en localStorage)
  _asistenciaKey() { return 'casanogal_asistencia_ter'; },
  _leerAsistencia() { try { return JSON.parse(localStorage.getItem(this._asistenciaKey()) || '{}'); } catch { return {}; } },
  _setAsistencia(idTer, fecha, valor) {
    const a = this._leerAsistencia();
    a[idTer + '|' + fecha] = valor;
    localStorage.setItem(this._asistenciaKey(), JSON.stringify(a));
  },

  _abrirTerapeuta(idTer) {
    const t = Data.terapeuta(idTer);
    if (!t) return;
    const c = ESPECIALIDAD_VAR[t.especialidad] || ESPECIALIDAD_VAR['Terapia Ocupacional'];
    const m = this._terapeutaMetricas(t);
    const alto = m.pctUsado > 80;
    const asist = this._leerAsistencia();
    const fechas = fechasSemana();
    const OPC = ['Presente', 'Atrasado', 'Se fue antes', 'Faltó'];
    const filasAsist = fechas.map((f, i) => {
      const val = asist[idTer + '|' + f] || 'Presente';
      return `<div class="asist-row">
        <span class="asist-dia">${DIAS_LABEL[i]} <small>${Number(f.split('-')[2])}</small></span>
        <select class="asist-sel" data-fecha="${f}">
          ${OPC.map(o => `<option ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </div>`;
    }).join('');

    const html = `
      <div class="pendiente-modal-overlay" id="terOverlay">
        <div class="pendiente-modal" style="width:min(560px,94vw)">
          <div class="pendiente-modal-head">
            <span class="equipo-avatar" style="background:${c.bg};color:${c.text};width:34px;height:34px;font-size:12px">${UI.esc(t.abreviacion)}</span>
            <div>
              <div class="pendiente-modal-title">${UI.esc(t.nombre_completo)}</div>
              <div class="pendiente-modal-eyebrow">${UI.esc(t.especialidad)} · ${UI.esc(t.tipo_contrato || '')}</div>
            </div>
            <button class="panel-close" id="terClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="pendiente-modal-body" style="padding:16px 22px">
            <div class="ter-metrica-h">Carga de la semana</div>
            <div class="carga-bar carga-bar-lg" title="${m.usados} de ${m.capacidad} bloques">
              <div class="carga-fill ${alto?'is-alto':''}" style="width:${Math.min(100,m.pctUsado)}%"></div>
            </div>
            <div class="ter-metrica-row">
              <span><b style="color:${alto?'var(--alert)':'var(--text)'}">${m.pctUsado}%</b> del tiempo usado${alto?' · <span style="color:var(--alert)">supera el 80% recomendado</span>':''}</span>
            </div>
            <div class="ter-split">
              <div class="ter-chip"><b>${m.terapias}</b> terapias efectivas</div>
              <div class="ter-chip"><b>${m.reuniones}</b> reuniones</div>
              <div class="ter-chip"><b>${m.pctEfectivo}%</b> es terapia efectiva</div>
            </div>

            <div class="ter-metrica-h" style="margin-top:18px">Asistencia de la semana</div>
            <div class="asist-grid">${filasAsist}</div>

            <div class="ter-nota">
              <b>Observaciones en su horario:</b> en el calendario las sesiones de observación y las de papás se marcan con un color distinto y su etiqueta de modalidad, para diferenciarlas de las terapias individuales.
            </div>
          </div>
          <div class="pendiente-modal-foot">
            <button class="btn btn-primary" id="terCloseFoot">Listo</button>
          </div>
        </div>
      </div>`;
    document.getElementById('terModalMount').innerHTML = html;
    const cerrar = () => { document.getElementById('terModalMount').innerHTML = ''; };
    document.getElementById('terClose').addEventListener('click', cerrar);
    document.getElementById('terCloseFoot').addEventListener('click', cerrar);
    document.getElementById('terOverlay').addEventListener('click', e => { if (e.target.id === 'terOverlay') cerrar(); });
    document.querySelectorAll('.asist-sel').forEach(sel =>
      sel.addEventListener('change', () => {
        this._setAsistencia(idTer, sel.dataset.fecha, sel.value);
        UI.toast('Asistencia registrada', 'success');
      })
    );
  },

  renderNinos() {
    State.fichaActiva = null;
    Fichas._renderLista();
    // Igualito a Fichas, pero el sidebar resalta "Niños"
  },

  // Vista general de disponibilidad: matriz terapeutas × horas de un día.
  // Es la "hoja de trabajo" de Trini: ver de un vistazo quién está libre a cada hora.
  // "Franco Villalba" -> "Franco V." para que la columna por terapeuta pese lo mismo que la de niños.
  _nombreCorto(nombre) {
    const p = (nombre || '').trim().split(/\s+/);
    if (p.length < 2) return p[0] || '';
    return `${p[0]} ${p[1][0]}.`;
  },

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

    // Sesión "tomada" para mover (click-para-mover, más confiable que arrastrar en tablas).
    const movId = this._movDisp || null;
    const movSes = movId ? State.data.sesiones.find(s => s.id_sesion === movId) : null;
    // ¿Es válido soltar movSes en este terapeuta+bloque? (reasignar)
    const okTer = (idTer, idBloque) => {
      if (!movSes) return false;
      const otras = State.data.sesiones.filter(s => s.fecha === dia && s.id_bloque === idBloque && s.id_sesion !== movSes.id_sesion);
      if (otras.some(s => s.id_terapeuta === idTer)) return false;
      if (movSes.id_sala && otras.some(s => s.id_sala === movSes.id_sala)) return false;
      return true;
    };
    // ¿Es válido mover movSes a otro bloque del MISMO niño? (cambiar horario, mismo terapeuta)
    const okNino = (idNino, idBloque) => {
      if (!movSes || movSes.id_nino !== idNino) return false;
      const otras = State.data.sesiones.filter(s => s.fecha === dia && s.id_bloque === idBloque && s.id_sesion !== movSes.id_sesion);
      if (otras.some(s => s.id_terapeuta === movSes.id_terapeuta)) return false;
      if (movSes.id_sala && otras.some(s => s.id_sala === movSes.id_sala)) return false;
      return true;
    };

    const filas = ters.map(t => {
      const c = ESPECIALIDAD_VAR[t.especialidad] || {};
      const celdas = bloques.map(b => {
        if (b.es_reunion_equipo) return `<td class="disp-cell disp-fijo" title="Bloque de reunión de equipo">reunión</td>`;
        const disp = t.disponibilidad_bloques;
        if (disp && disp[diaNombre] && !disp[diaNombre].includes(b.id_bloque)) return `<td class="disp-cell disp-nodisp" title="No disponible">—</td>`;
        const s = ocup[t.id_terapeuta + '|' + b.id_bloque];
        if (s) {
          const picked = movId === s.id_sesion;
          return `<td class="disp-cell disp-ocupado disp-pick${picked ? ' disp-picked' : ''}" data-id="${s.id_sesion}" style="background:${c.bg || 'var(--bg-soft)'};color:${c.text || 'var(--text)'}" title="${UI.esc(s.nino_visible)} · ${UI.esc(s.tipo_terapia)} · clic para mover">${UI.esc((s.nino_visible || '').split(' ')[0])}</td>`;
        }
        const target = okTer(t.id_terapeuta, b.id_bloque);
        return `<td class="disp-cell disp-libre${target ? ' disp-target' : ''}" data-ter="${t.id_terapeuta}" data-bloque="${b.id_bloque}" title="${target ? 'Mover aquí' : 'Libre'}">libre</td>`;
      }).join('');
      const nomCorto = this._nombreCorto(t.nombre_completo);
      return `<tr>
        <td class="disp-ter"><span class="disp-abr" style="background:${c.bg || 'var(--cn-azul-bg)'};color:${c.text || 'var(--cn-azul-deep)'}">${UI.esc(t.abreviacion)}</span><span class="disp-ter-nom">${UI.esc(nomCorto)}<small>${UI.esc(t.especialidad)}</small></span></td>
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
        if (clin.length === 1) {
          const s = clin[0];
          const picked = movId === s.id_sesion;
          return `<td class="disp-cell disp-ocupado disp-pick${picked ? ' disp-picked' : ''}" data-id="${s.id_sesion}" style="background:${cn.bg};color:${cn.text}" title="${UI.esc(s.tipo_terapia)} (${UI.esc(s.terapeuta_abr || '')}) · clic para mover de horario">${UI.esc(s.terapeuta_abr || '·')}</td>`;
        }
        if (clin.length > 1) {
          const detalle = clin.map(s => `${s.tipo_terapia} (${s.terapeuta_abr || ''})`).join(' + ');
          const abrs = clin.map(s => UI.esc(s.terapeuta_abr || '·')).join('+');
          return `<td class="disp-cell disp-ocupado" style="background:${cn.bg};color:${cn.text}" title="${UI.esc(detalle)}">${abrs}</td>`;
        }
        const target = okNino(n.id_nino, b.id_bloque);
        return `<td class="disp-cell disp-libre${target ? ' disp-target' : ''}" data-nino="${n.id_nino}" data-bloque="${b.id_bloque}" title="${target ? 'Mover aquí' : 'Sin sesión'}">libre</td>`;
      }).join('');
      return `<tr>
        <td class="disp-ter"><span class="disp-abr" style="background:${cn.bg};color:${cn.text}">${UI.esc(UI.initials(n.nombre_completo))}</span><span class="disp-ter-nom">${UI.esc(n.nombre_visible)}<small>${n.edad_anios ? UI.esc(n.edad_anios) + ' años' : ''}</small></span></td>
        ${celdas}
      </tr>`;
    }).join('');

    // Tabla de DISPONIBILIDAD DE SALAS (lo pidió Andy): salas × bloques, ocupación del día.
    const salas = (State.data.salas || []);
    const filasSala = salas.map(sa => {
      const celdas = bloques.map(b => {
        const enSala = sesDia.filter(s => s.id_sala === sa.id_sala && s.id_bloque === b.id_bloque);
        if (enSala.length) {
          const abrs = enSala.map(s => UI.esc(s.terapeuta_abr || (s.nino_visible || '').split(' ')[0])).join('+');
          const detalle = enSala.map(s => `${s.nino_visible} · ${s.tipo_terapia}`).join(' + ');
          return `<td class="disp-cell disp-ocupado" style="background:var(--bg-soft)" title="${UI.esc(detalle)}">${abrs}</td>`;
        }
        return `<td class="disp-cell disp-libre" title="Sala libre">libre</td>`;
      }).join('');
      return `<tr>
        <td class="disp-ter"><span class="disp-abr" style="background:var(--cn-azul-bg);color:var(--cn-azul-deep)">${UI.esc((sa.nombre || '').slice(0, 4))}</span><span class="disp-ter-nom">${UI.esc(sa.nombre)}<small>${UI.esc(sa.tipo_principal || '')}</small></span></td>
        ${celdas}
      </tr>`;
    }).join('');

    document.getElementById('main').innerHTML = `
      <div class="section-head"><div>
        <div class="section-title">Disponibilidad</div>
        <div class="section-sub">Horario del día por terapeuta, por niño y por sala · ${ters.length} terapeutas · ${ninos.length} niños · ${salas.length} salas. Clic en una sesión y luego en un bloque libre para moverla.</div>
      </div></div>
      <div class="disp-dias">${diasBtns}</div>
      ${esFeriado ? '<div class="disp-feriado">Ese día es feriado · no hay atención.</div>' : ''}
      ${movSes ? `<div class="disp-moving">Moviendo a <b>${UI.esc(movSes.nino_visible)}</b> · elige un bloque libre marcado en verde <button class="disp-mov-cancel" id="dispMovCancel">Cancelar</button></div>` : ''}
      <div class="disp-legend"><span class="disp-leg disp-leg-libre">libre</span><span class="disp-leg disp-leg-ocupado">ocupado</span><span class="disp-leg disp-leg-nodisp">no disponible</span></div>
      <div class="table-wrap disp-wrap disp-wrap-uni">
        <table class="disp-table disp-table-uni">
          <thead><tr><th class="disp-th-ter">Horario →</th>${bloques.map(b => `<th>${b.hora_inicio}</th>`).join('')}</tr></thead>
          <tbody>
            <tr class="disp-sec"><td colspan="${bloques.length + 1}">Profesionales · ${ters.length}</td></tr>
            ${filas}
            <tr class="disp-sec"><td colspan="${bloques.length + 1}">Niños · ${ninos.length}</td></tr>
            ${filasNino || `<tr><td class="disp-ter" colspan="${bloques.length + 1}">Sin atención de niños este día.</td></tr>`}
            <tr class="disp-sec"><td colspan="${bloques.length + 1}">Salas · ${salas.length}</td></tr>
            ${filasSala || `<tr><td class="disp-ter" colspan="${bloques.length + 1}">Sin salas configuradas.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
    document.querySelectorAll('.disp-dia-btn').forEach(b => b.addEventListener('click', () => { this._dispDiaIdx = Number(b.dataset.idx); this._movDisp = null; this.renderDisponibilidad(); }));
    this._wireDispMove();
  },

  // Click-para-mover: 1) clic en una sesión la "toma"; 2) clic en un bloque libre la mueve.
  _wireDispMove() {
    document.getElementById('dispMovCancel')?.addEventListener('click', () => { this._movDisp = null; this.renderDisponibilidad(); });

    document.querySelectorAll('.disp-table .disp-pick').forEach(cell => {
      cell.addEventListener('click', () => {
        this._movDisp = (this._movDisp === cell.dataset.id) ? null : cell.dataset.id;
        this.renderDisponibilidad();
      });
    });

    if (!this._movDisp) return;
    const movSes = State.data.sesiones.find(s => s.id_sesion === this._movDisp);
    if (!movSes) { this._movDisp = null; return; }

    document.querySelectorAll('.disp-table .disp-libre').forEach(cell => {
      cell.addEventListener('click', () => {
        const { ter: idTer, nino: idNino, bloque: idBloque } = cell.dataset;
        if (!idBloque) return;
        const otras = State.data.sesiones.filter(s => s.fecha === movSes.fecha && s.id_bloque === idBloque && s.id_sesion !== movSes.id_sesion);
        const b = Data.bloque(idBloque);
        if (idTer) {
          // Reasignar terapeuta (y horario)
          if (otras.some(s => s.id_terapeuta === idTer)) { UI.toast('⚠ Ese terapeuta ya tiene una sesión en ese bloque', 'alert'); return; }
          if (movSes.id_sala && otras.some(s => s.id_sala === movSes.id_sala)) { UI.toast('⚠ La sala ya está ocupada en ese bloque', 'alert'); return; }
          const t = Data.terapeuta(idTer);
          movSes.id_terapeuta = idTer;
          if (t) movSes.terapeuta_abr = t.abreviacion;
          movSes.id_bloque = idBloque;
          if (b) { movSes.hora_inicio = b.hora_inicio; movSes.hora_fin = b.hora_fin; }
          movSes.conflicto_detectado = null;
          UI.toast(`${movSes.nino_visible} movido a ${t ? UI.esc(t.nombre_visible) : ''} · ${b ? b.hora_inicio : ''}`, 'success');
        } else if (idNino) {
          // Cambiar horario del mismo niño (mismo terapeuta)
          if (movSes.id_nino !== idNino) { UI.toast('⚠ Solo puedes moverlo dentro del horario del mismo niño', 'alert'); return; }
          if (otras.some(s => s.id_terapeuta === movSes.id_terapeuta)) { UI.toast('⚠ El terapeuta ya tiene una sesión en ese bloque', 'alert'); return; }
          if (movSes.id_sala && otras.some(s => s.id_sala === movSes.id_sala)) { UI.toast('⚠ La sala ya está ocupada en ese bloque', 'alert'); return; }
          movSes.id_bloque = idBloque;
          if (b) { movSes.hora_inicio = b.hora_inicio; movSes.hora_fin = b.hora_fin; }
          movSes.conflicto_detectado = null;
          UI.toast(`${movSes.nino_visible} movido a ${b ? b.hora_inicio : ''}`, 'success');
        } else return;
        this._movDisp = null;
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
