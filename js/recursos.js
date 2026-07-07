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
    const terapias = ses.length - reuniones;                  // terapias agendadas (todas)
    // Efectivas = solo las realizadas (si el niño faltó o se suspendió, NO cuenta como hora efectiva)
    const efectivas = ses.filter(s => s.tipo_actividad !== 'Reunión de equipo' && s.estado === 'Realizada').length;
    // Capacidad = jornada de atención 08:00–13:00, lunes a viernes (no las reuniones de las 8).
    const bloquesJornada = (State.data.bloques_horarios || [])
      .filter(b => !b.es_reunion_equipo && b.hora_inicio >= '08:00' && b.hora_inicio < '13:00');
    const capacidad = bloquesJornada.length * DIAS.length; // DIAS = lunes..viernes
    const usados = ses.length;
    return {
      reuniones, terapias, efectivas, usados, capacidad,
      pctUsado: capacidad ? Math.round(usados / capacidad * 100) : 0,
      // % del tiempo del terapeuta que fue terapia efectivamente realizada (horas reales)
      pctEfectivo: capacidad ? Math.round(efectivas / capacidad * 100) : 0,
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
    const OPC = ['Presente', 'Atrasado', 'Se fue antes', 'Faltó', 'Permiso', 'Día administrativo', 'Vacaciones', 'Cumpleaños'];
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
              <div class="ter-chip"><b>${m.efectivas}</b> terapias efectivas${m.terapias > m.efectivas ? ` <small style="color:var(--text-3)">de ${m.terapias} agendadas</small>` : ''}</div>
              <div class="ter-chip"><b>${m.reuniones}</b> reuniones</div>
              <div class="ter-chip"><b>${m.pctEfectivo}%</b> horas efectivas</div>
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

    // Estado de movimiento: 1) sesión tomada; 2) destino elegido (falta elegir sala).
    const movId = this._movDisp || null;
    const movSes = movId ? State.data.sesiones.find(s => s.id_sesion === movId) : null;
    const dest = movSes ? (this._movDest || null) : (this._movDest = null);
    // ¿Es válido mover movSes a este profesional+bloque? (libre, disponible, no es donde ya está)
    const okDestino = (idTer, b) => {
      if (!movSes || b.es_reunion_equipo) return false;
      const t = Data.terapeuta(idTer);
      const disp = t?.disponibilidad_bloques;
      if (disp && disp[diaNombre] && !disp[diaNombre].includes(b.id_bloque)) return false;
      if (ocup[idTer + '|' + b.id_bloque]) return false;
      if (movSes.id_terapeuta === idTer && movSes.id_bloque === b.id_bloque) return false;
      return true;
    };

    // Mapas de ocupación por niño y por sala (para las columnas de niños y de salas)
    const ocupNino = {}, ocupSala = {};
    sesDia.forEach(s => {
      if (s.id_nino) (ocupNino[s.id_nino + '|' + s.id_bloque] = ocupNino[s.id_nino + '|' + s.id_bloque] || []).push(s);
      if (s.id_sala) (ocupSala[s.id_sala + '|' + s.id_bloque] = ocupSala[s.id_sala + '|' + s.id_bloque] || []).push(s);
    });
    const ninos = (State.data.ninos || [])
      .filter(n => n.estado === 'Activo' && sesDia.some(s => s.id_nino === n.id_nino))
      .sort((a, b) => { const ai = UI.esIntensivo(a) ? 0 : 1, bi = UI.esIntensivo(b) ? 0 : 1; return ai - bi || a.nombre_completo.localeCompare(b.nombre_completo); });
    const salas = (State.data.salas || []);

    // Cabecera: una columna por bloque (horario), arriba (lo prefiere Trini)
    const headHoras = bloques.map(b => `<th class="disp-hora-h"><span class="disp-hora-ini">${b.hora_inicio}</span><span class="disp-hora-fin">${b.hora_fin}</span></th>`).join('');
    const nCols = bloques.length + 1;
    const rotulo = (abr, nom, bg, fg, sub) => `<td class="disp-ter"><span class="disp-abr" style="background:${bg};color:${fg}">${UI.esc(abr)}</span><span class="disp-ter-nom">${UI.esc(nom)}${sub ? `<small>${UI.esc(sub)}</small>` : ''}</span></td>`;

    // Banda PROFESIONALES (editable): una fila por profesional
    const filasProf = ters.map(t => {
      const c = ESPECIALIDAD_VAR[t.especialidad] || {};
      const celdas = bloques.map(b => {
        const esFranjaReu = b.hora_inicio === '08:00' || b.hora_inicio === '12:30';
        const disp = t.disponibilidad_bloques;
        // En las franjas de reunión las celdas vacías quedan libres (para agendar más reuniones), no bloqueadas
        if (!esFranjaReu && disp && disp[diaNombre] && !disp[diaNombre].includes(b.id_bloque)) return `<td class="disp-cell disp-nodisp" title="No disponible">—</td>`;
        const s = ocup[t.id_terapeuta + '|' + b.id_bloque];
        if (s && s.tipo_actividad === 'Reunión de equipo') {
          const nn = (Data.nino(s.id_nino)?.nombre_visible) || (s.nino_visible || '').replace('Reunión de equipo · ', '');
          return `<td class="disp-cell disp-fijo disp-reu disp-reu-ver" data-reu-id="${s.id_reunion || ''}" data-reu-nino="${s.id_nino || ''}" data-reu-bloque="${b.id_bloque}" title="Reunión · ${UI.esc(nn)} · clic para ver quiénes participan"><span class="disp-nino">Reunión</span><span class="disp-sala">${UI.esc(nn)}</span></td>`;
        }
        if (s) {
          const picked = movId === s.id_sesion;
          const sala = Data.sala(s.id_sala);
          const salaTxt = sala?.nombre || s.sala_nombre || '';
          return `<td class="disp-cell disp-ocupado disp-pick${picked ? ' disp-picked' : ''}" data-id="${s.id_sesion}" style="background:color-mix(in srgb, ${c.bg || 'var(--bg-soft)'} 55%, var(--bg))" title="${UI.esc(s.nino_visible)} · ${UI.esc(s.tipo_terapia)} · ${UI.esc(salaTxt)} · clic para mover"><span class="disp-nino">${UI.esc((s.nino_visible || '').split(' ')[0])}</span>${salaTxt && salaTxt !== '—' ? `<span class="disp-sala">${UI.esc(salaTxt)}</span>` : ''}</td>`;
        }
        const target = movSes && !dest && okDestino(t.id_terapeuta, b);
        return `<td class="disp-cell disp-libre disp-crear${target ? ' disp-target' : ''}" data-band="prof" data-ter="${t.id_terapeuta}" data-bloque="${b.id_bloque}" title="${target ? 'Mover aquí' : 'Libre · clic para crear sesión'}">${target ? '＋' : ''}</td>`;
      }).join('');
      return `<tr>${rotulo(t.abreviacion, this._nombreCorto(t.nombre_completo), c.bg || 'var(--cn-azul-bg)', c.text || 'var(--cn-azul-deep)')}${celdas}</tr>`;
    }).join('');

    // Banda NIÑOS (lectura): una fila por niño
    const filasNino = ninos.map(n => {
      const cn = UI.colorNino(n.id_nino);
      const celdas = bloques.map(b => {
        const lista = ocupNino[n.id_nino + '|' + b.id_bloque] || [];
        const reu = lista.find(s => s.tipo_actividad === 'Reunión de equipo');
        if (reu) return `<td class="disp-cell disp-fijo disp-reu disp-reu-ver" data-reu-id="${reu.id_reunion || ''}" data-reu-nino="${n.id_nino}" data-reu-bloque="${b.id_bloque}" title="Reunión de equipo · clic para ver quiénes participan">Reunión</td>`;
        const clin = lista.filter(s => s.tipo_actividad !== 'Reunión de equipo');
        if (clin.length === 1) {
          const s = clin[0];
          const picked = movId === s.id_sesion;
          return `<td class="disp-cell disp-ocupado disp-pick${picked ? ' disp-picked' : ''}" data-id="${s.id_sesion}" style="background:${cn.bg};color:${cn.text}" title="${UI.esc(s.tipo_terapia)} (${UI.esc(s.terapeuta_abr || '')}) · clic para mover">${UI.esc(s.terapeuta_abr || '·')}</td>`;
        }
        if (clin.length > 1) {
          const det = clin.map(s => `${s.tipo_terapia} (${s.terapeuta_abr || ''})`).join(' + ');
          // Cada terapia de la dupla es un chip arrastrable por separado (antes la celda combinada no se podía mover)
          const chips = clin.map(s => {
            const picked = movId === s.id_sesion;
            return `<span class="disp-chip disp-pick${picked ? ' disp-picked' : ''}" data-id="${s.id_sesion}" title="${UI.esc(s.tipo_terapia)} (${UI.esc(s.terapeuta_abr || '')}) · arrastra para mover">${UI.esc(s.terapeuta_abr || '·')}</span>`;
          }).join('');
          return `<td class="disp-cell disp-ocupado disp-multi" style="background:${cn.bg};color:${cn.text}" title="${UI.esc(det)}">${chips}</td>`;
        }
        return `<td class="disp-cell disp-libre disp-crear" data-band="nino" data-nino="${n.id_nino}" data-bloque="${b.id_bloque}" title="Sin sesión · clic para crear"></td>`;
      }).join('');
      return `<tr>${rotulo(UI.initials(n.nombre_completo), n.nombre_visible, cn.bg, cn.text, n.edad_anios ? n.edad_anios + ' años' : '')}${celdas}</tr>`;
    }).join('');

    // Banda SALAS (lectura): UNA FILA POR CUPO de la sala (TO=4 filas, TO2=2, KIDS=4, resto 1).
    const filasSala = salas.map(sa => {
      const cap = sa.capacidad_personas || 1;
      return Array.from({ length: cap }, (_, k) => {
        const celdas = bloques.map(b => {
          const lista = ocupSala[sa.id_sala + '|' + b.id_bloque] || [];
          const s = lista[k];
          if (s) {
            const picked = movId === s.id_sesion;
            const det = `${s.nino_visible} · ${s.tipo_terapia} (${s.terapeuta_abr || ''})`;
            return `<td class="disp-cell disp-ocupado disp-pick${picked ? ' disp-picked' : ''}" data-id="${s.id_sesion}" style="background:var(--bg-soft)" title="${UI.esc(det)} · clic para mover">${UI.esc((s.nino_visible || '').split(' ')[0])}</td>`;
          }
          return `<td class="disp-cell disp-libre disp-crear" data-band="sala" data-sala="${sa.id_sala}" data-bloque="${b.id_bloque}" title="Cupo libre · clic para crear sesión"></td>`;
        }).join('');
        const sub = cap > 1 ? `cupo ${k + 1}/${cap}` : '';
        const nom = k === 0 ? sa.nombre : sa.nombre;
        return `<tr>${rotulo(k === 0 ? (sa.nombre || '').slice(0, 4) : '', nom, 'var(--cn-azul-bg)', 'var(--cn-azul-deep)', sub)}${celdas}</tr>`;
      }).join('');
    }).join('');

    // Panel de salas a la DERECHA cuando ya se soltó la sesión en un destino (lo pidió Andy)
    let salaPanel = '';
    if (movSes && dest) {
      const tDest = Data.terapeuta(dest.idTer);
      const bDest = Data.bloque(dest.idBloque);
      const libres = this._salasLibres(movSes, dest, dia);
      salaPanel = `<aside class="disp-sala-panel">
        <div class="disp-sala-panel-head">Elige sala para <b>${UI.esc(movSes.nino_visible)}</b></div>
        <div class="disp-sala-panel-sub">${UI.esc(tDest?.nombre_visible || tDest?.nombre_completo || '')} · ${bDest?.hora_inicio || ''}–${bDest?.hora_fin || ''}</div>
        <div class="disp-sala-list">${libres.length
          ? libres.map(sl => `<button class="disp-sala-chip${sl.pref ? ' is-pref' : ''}${sl.actual ? ' is-actual' : ''}" data-sala="${sl.id}">${UI.esc(sl.nombre)}${sl.cupo ? ` <small>${sl.cupo} cupo${sl.cupo === 1 ? '' : 's'}</small>` : ''}${sl.actual ? ' · actual' : (sl.pref ? ' · pref' : '')}</button>`).join('')
          : '<button class="disp-sala-chip" data-sala="">No hay sala disponible · mover sin sala</button>'}</div>
        <button class="disp-mov-cancel" id="dispMovCancel">Cancelar</button>
      </aside>`;
    }

    const MES_AB = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const fSemana = (iso) => { const [, m, d] = iso.split('-'); return `${Number(d)} ${MES_AB[Number(m) - 1]}`; };
    const semanaLbl = fechas.length ? `Semana del ${fSemana(fechas[0])} al ${fSemana(fechas[fechas.length - 1])}` : '';

    document.getElementById('main').innerHTML = `
      <div class="section-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap"><div>
        <div class="section-title">Disponibilidad ${semanaLbl ? `<span class="disp-semana">${semanaLbl}</span>` : ''}</div>
        <div class="section-sub">Horarios arriba · filas en <b>Profesionales · Niños · Salas</b>. <b>Arrastra</b> una sesión a un bloque <b>verde</b>; al soltar eliges la sala (a la derecha). Clic en un espacio libre para crear una sesión.</div>
      </div>
        <button class="btn btn-secondary" id="dispAddReuBtn" style="flex-shrink:0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Armar reunión
        </button>
      </div>
      <div class="disp-dias">${diasBtns}</div>
      ${esFeriado ? '<div class="disp-feriado">Ese día es feriado · no hay atención.</div>' : ''}
      <div class="disp-legend"><span class="disp-leg disp-leg-libre">libre</span><span class="disp-leg disp-leg-ocupado">ocupado</span><span class="disp-leg disp-leg-nodisp">no disponible</span></div>
      <div class="disp-layout">
      <div class="table-wrap disp-wrap disp-wrap-bandas">
        <table class="disp-table disp-table-bandas${movSes ? ' is-moving' : ''}">
          <thead><tr><th class="disp-th-rowlabel">Horario →</th>${headHoras}</tr></thead>
          <tbody>
            <tr class="disp-sec disp-sec-prof"><td colspan="${nCols}">Profesionales · ${ters.length}</td></tr>
            ${filasProf}
            <tr class="disp-sec disp-sec-nino"><td colspan="${nCols}">Niños · ${ninos.length}</td></tr>
            ${filasNino || `<tr><td colspan="${nCols}" class="disp-ter">Sin niños con atención hoy.</td></tr>`}
            <tr class="disp-sec disp-sec-sala"><td colspan="${nCols}">Salas · ${salas.length}</td></tr>
            ${filasSala}
          </tbody>
        </table>
      </div>
      ${salaPanel}
      </div>
    `;
    document.querySelectorAll('.disp-dia-btn').forEach(b => b.addEventListener('click', () => { this._dispDiaIdx = Number(b.dataset.idx); this._movDisp = null; this._movDest = null; this.renderDisponibilidad(); }));
    document.getElementById('dispAddReuBtn')?.addEventListener('click', () => this._abrirFormReunion(dia, diaNombre));
    this._wireDispMove(dia, diaNombre);
  },

  // Modal SIMPLE de reunión: junta al equipo + el niño + la sala (nada más).
  _abrirFormReunion(dia, diaNombre, prefill = {}) {
    // Si vino de pinchar una celda, queda fijo ese bloque; si no, se puede elegir cualquiera.
    const bloquesAll = (State.data.bloques_horarios || []).filter(b => b.periodo !== 'Tarde').sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const bloques = prefill.id_bloque ? bloquesAll.filter(b => b.id_bloque === prefill.id_bloque) : bloquesAll;
    const ninos = (State.data.ninos || []).filter(n => n.estado === 'Activo').sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
    const ters = Data.terapeutasEfectivos().filter(t => t.estado === 'Activo').sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
    const salas = State.data.salas || [];
    const html = `
      <div class="pendiente-modal-overlay" id="reuDispOverlay">
        <div class="pendiente-modal" style="width:min(560px,94vw)">
          <div class="pendiente-modal-head">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--cn-azul)"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
            <div>
              <div class="pendiente-modal-title">Reunión de equipo</div>
              <div class="pendiente-modal-eyebrow">Junta al equipo · ${UI.esc(UI.fmtFecha(dia))}</div>
            </div>
            <button class="panel-close" id="reuDispClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="pendiente-modal-body" style="display:flex;flex-direction:column;gap:12px">
            <div class="field-row">
              <div class="field"><label class="field-label">Niño</label>
                <select class="field-select" id="reuNino">${ninos.map(n => `<option value="${n.id_nino}" ${prefill.id_nino === n.id_nino ? 'selected' : ''}>${UI.esc(n.nombre_completo)}</option>`).join('')}</select>
              </div>
              <div class="field"><label class="field-label">Bloque</label>
                <select class="field-select" id="reuBloque">${bloques.map(b => `<option value="${b.id_bloque}" ${prefill.id_bloque === b.id_bloque ? 'selected' : ''}>${b.hora_inicio}–${b.hora_fin}</option>`).join('')}</select>
              </div>
            </div>
            <div class="field"><label class="field-label">Sala</label>
              <select class="field-select" id="reuSala">
                <option value="">— sin sala —</option>
                ${salas.map(sa => `<option value="${sa.id_sala}" ${prefill.id_sala === sa.id_sala ? 'selected' : ''}>${UI.esc(sa.nombre)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label class="field-label">Equipo que participa</label>
              <div class="reu-ters">${ters.map(t => `<label class="reu-ter-chk"><input type="checkbox" value="${t.id_terapeuta}" ${prefill.id_terapeuta === t.id_terapeuta ? 'checked' : ''}><span>${UI.esc(t.nombre_completo)} <small>${UI.esc(t.especialidad)}</small></span></label>`).join('')}</div>
            </div>
          </div>
          <div class="pendiente-modal-foot">
            <button class="btn btn-ghost" id="reuDispCancel">Cancelar</button>
            <button class="btn btn-primary" id="reuDispSave">Crear reunión</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const cerrar = () => document.getElementById('reuDispOverlay')?.remove();
    document.getElementById('reuDispClose').addEventListener('click', cerrar);
    document.getElementById('reuDispCancel').addEventListener('click', cerrar);
    document.getElementById('reuDispOverlay').addEventListener('click', e => { if (e.target.id === 'reuDispOverlay') cerrar(); });
    document.getElementById('reuDispSave').addEventListener('click', () => {
      const idNino = document.getElementById('reuNino').value;
      const idBloque = document.getElementById('reuBloque').value;
      const idSala = document.getElementById('reuSala').value || null;
      const seleccion = [...document.querySelectorAll('.reu-ters input:checked')].map(i => i.value);
      if (!seleccion.length) { UI.toast('Marca al menos un integrante del equipo', 'error'); return; }
      const b0 = Data.bloque(idBloque);
      const ocupados = this._terapeutasOcupados(dia, idBloque, seleccion);
      if (ocupados.length) {
        this._alertaTope('Hay profesionales ocupados', `${ocupados.map(o => `<b>${UI.esc(o.nombre)}</b>`).join(', ')} ya ${ocupados.length === 1 ? 'tiene una sesión' : 'tienen sesión'} a las ${b0?.hora_inicio || ''}. Libera ese horario o quítalos de la reunión.`);
        return;
      }
      const nino = Data.nino(idNino);
      const b = Data.bloque(idBloque);
      const sa = idSala ? Data.sala(idSala) : null;
      let maxNum = State.data.sesiones.reduce((m, s) => { const n = parseInt(String(s.id_sesion).replace(/\D/g, ''), 10); return Number.isFinite(n) && n > m ? n : m; }, 0);
      seleccion.forEach(idTer => {
        const t = Data.terapeuta(idTer);
        State.data.sesiones.push({
          id_sesion: 'SES-' + String(++maxNum).padStart(4, '0'),
          fecha: dia, dia_semana: diaNombre, id_bloque: idBloque,
          hora_inicio: b?.hora_inicio, hora_fin: b?.hora_fin,
          id_nino: idNino, nino_visible: 'Reunión de equipo · ' + (nino?.nombre_visible || ''),
          id_terapeuta: idTer, terapeuta_abr: t?.abreviacion,
          id_terapeuta_secundario: null, id_nino_secundario: null,
          id_sala: idSala, sala_nombre: sa?.nombre || '—',
          tipo_terapia: 'Reunión de equipo', tipo_actividad: 'Reunión de equipo',
          es_dupla: false, estado: 'Agendada', id_programa: nino?.id_programa,
          notas_admin: null, conflicto_detectado: null,
          creado_por: State.currentUser?.id, fecha_creacion: HOY_ISO,
        });
      });
      UI.toast(`Reunión creada · equipo de ${seleccion.length} integrante${seleccion.length === 1 ? '' : 's'}`, 'success');
      cerrar();
      this.renderDisponibilidad();
    });
  },

  // Reunión GENERAL (en cualquier bloque): equipo terapéutico + administrativo (todos) + externos (máx 3).
  _abrirFormReunionGeneral(dia, diaNombre, prefill = {}) {
    const bloquesAll = (State.data.bloques_horarios || []).filter(b => b.periodo !== 'Tarde').sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const bloques = prefill.id_bloque ? bloquesAll.filter(b => b.id_bloque === prefill.id_bloque) : bloquesAll;
    const ters = Data.terapeutasEfectivos().filter(t => t.estado === 'Activo').sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
    const admin = State.data.equipo_centro || [];
    const salas = State.data.salas || [];
    const html = `
      <div class="pendiente-modal-overlay" id="reuGenOverlay">
        <div class="pendiente-modal" style="width:min(600px,94vw)">
          <div class="pendiente-modal-head">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--cn-azul)"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
            <div>
              <div class="pendiente-modal-title">Reunión general</div>
              <div class="pendiente-modal-eyebrow">Equipo + administración + externos · ${UI.esc(UI.fmtFecha(dia))}</div>
            </div>
            <button class="panel-close" id="reuGenClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="pendiente-modal-body" style="display:flex;flex-direction:column;gap:12px">
            <div class="field"><label class="field-label">Tema / nombre de la reunión</label>
              <input type="text" class="field-input" id="reuGenTema" maxlength="60" placeholder="Ej: Reunión administrativa mensual">
            </div>
            <div class="field-row">
              <div class="field"><label class="field-label">Bloque (cualquiera)</label>
                <select class="field-select" id="reuGenBloque">${bloques.map(b => `<option value="${b.id_bloque}" ${prefill.id_bloque === b.id_bloque ? 'selected' : ''}>${b.hora_inicio}–${b.hora_fin}</option>`).join('')}</select>
              </div>
              <div class="field"><label class="field-label">Sala</label>
                <select class="field-select" id="reuGenSala"><option value="">— sin sala —</option>${salas.map(sa => `<option value="${sa.id_sala}" ${prefill.id_sala === sa.id_sala ? 'selected' : ''}>${UI.esc(sa.nombre)}</option>`).join('')}</select>
              </div>
            </div>
            <div class="field">
              <label class="field-label">Equipo terapéutico</label>
              <div class="reu-ters">${ters.map(t => `<label class="reu-ter-chk"><input type="checkbox" data-ter value="${t.id_terapeuta}" ${prefill.id_terapeuta === t.id_terapeuta ? 'checked' : ''}><span>${UI.esc(t.nombre_completo)} <small>${UI.esc(t.especialidad)}</small></span></label>`).join('')}</div>
            </div>
            <div class="field">
              <label class="field-label">Equipo administrativo</label>
              <div class="reu-ters">${admin.map((p, i) => `<label class="reu-ter-chk"><input type="checkbox" data-admin value="${i}"><span>${UI.esc(p.nombre)} <small>${UI.esc(p.cargo || '')}</small></span></label>`).join('')}</div>
            </div>
            <div class="field">
              <label class="field-label">Personas externas <small style="font-weight:400;color:var(--text-3)">· máximo 3</small></label>
              <div class="reu-ext"><input type="text" class="field-input reu-ext-in" maxlength="50" placeholder="Nombre externo 1"><input type="text" class="field-input reu-ext-in" maxlength="50" placeholder="Nombre externo 2"><input type="text" class="field-input reu-ext-in" maxlength="50" placeholder="Nombre externo 3"></div>
            </div>
          </div>
          <div class="pendiente-modal-foot">
            <button class="btn btn-ghost" id="reuGenCancel">Cancelar</button>
            <button class="btn btn-primary" id="reuGenSave">Crear reunión</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const cerrar = () => document.getElementById('reuGenOverlay')?.remove();
    document.getElementById('reuGenClose').addEventListener('click', cerrar);
    document.getElementById('reuGenCancel').addEventListener('click', cerrar);
    document.getElementById('reuGenOverlay').addEventListener('click', e => { if (e.target.id === 'reuGenOverlay') cerrar(); });
    document.getElementById('reuGenSave').addEventListener('click', () => {
      const tema = document.getElementById('reuGenTema').value.trim() || 'Reunión general';
      const idBloque = document.getElementById('reuGenBloque').value;
      const idSala = document.getElementById('reuGenSala').value || null;
      const terSel = [...document.querySelectorAll('.reu-ters input[data-ter]:checked')].map(i => i.value);
      const adminSel = [...document.querySelectorAll('.reu-ters input[data-admin]:checked')].map(i => admin[Number(i.value)]);
      const externos = [...document.querySelectorAll('.reu-ext-in')].map(i => i.value.trim()).filter(Boolean);
      if (externos.length > 3) { UI.toast('Máximo 3 personas externas', 'error'); return; }
      if (!terSel.length) { UI.toast('Elige al menos un profesional (ancla la reunión en el horario)', 'error'); return; }
      const bSel = Data.bloque(idBloque);
      const ocupadosGen = this._terapeutasOcupados(dia, idBloque, terSel);
      if (ocupadosGen.length) {
        this._alertaTope('Hay profesionales ocupados', `${ocupadosGen.map(o => `<b>${UI.esc(o.nombre)}</b>`).join(', ')} ya ${ocupadosGen.length === 1 ? 'tiene una sesión' : 'tienen sesión'} a las ${bSel?.hora_inicio || ''}. Libera ese horario o quítalos de la reunión.`);
        return;
      }
      const extra = [
        ...adminSel.map(p => `${p.nombre}${p.cargo ? ' (' + p.cargo + ')' : ''}`),
        ...externos.map(n => `${n} (externo)`),
      ];
      const b = Data.bloque(idBloque);
      const sa = idSala ? Data.sala(idSala) : null;
      const idReunion = 'REU-' + (State.data.sesiones.reduce((m, s) => { const n = parseInt(String(s.id_reunion || '').replace(/\D/g, ''), 10); return Number.isFinite(n) && n > m ? n : m; }, 0) + 1);
      let maxNum = State.data.sesiones.reduce((m, s) => { const n = parseInt(String(s.id_sesion).replace(/\D/g, ''), 10); return Number.isFinite(n) && n > m ? n : m; }, 0);
      terSel.forEach(idTer => {
        const t = Data.terapeuta(idTer);
        State.data.sesiones.push({
          id_sesion: 'SES-' + String(++maxNum).padStart(4, '0'),
          id_reunion: idReunion,
          fecha: dia, dia_semana: diaNombre, id_bloque: idBloque,
          hora_inicio: b?.hora_inicio, hora_fin: b?.hora_fin,
          id_nino: null, nino_visible: tema,
          id_terapeuta: idTer, terapeuta_abr: t?.abreviacion,
          id_terapeuta_secundario: null, id_nino_secundario: null,
          id_sala: idSala, sala_nombre: sa?.nombre || '—',
          tipo_terapia: 'Reunión de equipo', tipo_actividad: 'Reunión de equipo',
          participantes_extra: extra,
          es_dupla: false, estado: 'Agendada', id_programa: null,
          notas_admin: null, conflicto_detectado: null,
          creado_por: State.currentUser?.id, fecha_creacion: HOY_ISO,
        });
      });
      UI.toast(`Reunión general creada · ${terSel.length} del equipo${extra.length ? ' + ' + extra.length + ' más' : ''}`, 'success');
      cerrar();
      this.renderDisponibilidad();
    });
  },

  // Al pinchar un bloque libre: elegir qué agendar; cada opción lleva a su formulario.
  _abrirChooserActividad(dia, diaNombre, ctx) {
    const b = Data.bloque(ctx.bloque);
    const ops = [
      { k: 'reunion', label: 'Reunión de equipo del niño', desc: 'El equipo que atiende a un niño' },
      { k: 'reunion_general', label: 'Reunión general', desc: 'Equipo terapéutico + administrativo + externos' },
      { k: 'Sesión', label: 'Sesión', desc: 'Terapia individual' },
      { k: 'Sesión de padres', label: 'Sesión de padres', desc: 'Psicología con los papás' },
      { k: 'Taller grupal', label: 'Taller grupal', desc: 'Actividad grupal' },
      { k: 'Supervisión neurología', label: 'Supervisión neurológica', desc: 'La doctora supervisa' },
    ];
    const html = `
      <div class="pendiente-modal-overlay" id="chooserOverlay">
        <div class="pendiente-modal" style="width:min(440px,94vw)">
          <div class="pendiente-modal-head">
            <div><div class="pendiente-modal-title">¿Qué quieres agendar?</div><div class="pendiente-modal-eyebrow">${b ? b.hora_inicio + '–' + b.hora_fin : ''} · ${UI.esc(UI.fmtFecha(dia))}</div></div>
            <button class="panel-close" id="chooserClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="pendiente-modal-body chooser-list">
            ${ops.map(o => `<button class="chooser-opt" data-k="${UI.esc(o.k)}"><span class="chooser-opt-t">${o.label}</span><span class="chooser-opt-d">${o.desc}</span></button>`).join('')}
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const cerrar = () => document.getElementById('chooserOverlay')?.remove();
    document.getElementById('chooserClose').addEventListener('click', cerrar);
    document.getElementById('chooserOverlay').addEventListener('click', e => { if (e.target.id === 'chooserOverlay') cerrar(); });
    document.querySelectorAll('.chooser-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.k;
        cerrar();
        if (k === 'reunion') {
          this._abrirFormReunion(dia, diaNombre, { id_bloque: ctx.bloque, id_terapeuta: ctx.ter || null, id_sala: ctx.sala || null, id_nino: ctx.nino || null });
        } else if (k === 'reunion_general') {
          this._abrirFormReunionGeneral(dia, diaNombre, { id_bloque: ctx.bloque, id_terapeuta: ctx.ter || null, id_sala: ctx.sala || null });
        } else {
          const t = ctx.ter ? Data.terapeuta(ctx.ter) : null;
          Modal.openCreate({ id_nino: ctx.nino || undefined, id_terapeuta: ctx.ter || undefined, tipo_terapia: t?.especialidad, id_sala: ctx.sala || undefined, id_bloque: ctx.bloque, dia: diaNombre, tipo_actividad: k });
        }
      });
    });
  },

  // Ver quiénes participan en una reunión ya agendada (por id de reunión, o por niño+bloque para las antiguas).
  _verReunion(reuId, idNino, idBloque, dia) {
    const sesiones = reuId
      ? State.data.sesiones.filter(s => s.id_reunion === reuId)
      : State.data.sesiones.filter(s => s.fecha === dia && s.id_bloque === idBloque && s.id_nino === idNino && s.tipo_actividad === 'Reunión de equipo');
    if (!sesiones.length) return;
    const nino = idNino ? Data.nino(idNino) : null;
    const titulo = nino?.nombre_visible || nino?.nombre_completo || sesiones[0].nino_visible || 'Reunión';
    const b = Data.bloque(sesiones[0].id_bloque);
    const salaNombre = sesiones.find(s => s.sala_nombre && s.sala_nombre !== '—')?.sala_nombre;
    const participantes = sesiones.map(s => Data.terapeuta(s.id_terapeuta)).filter(Boolean);
    const extra = sesiones[0].participantes_extra || [];
    const html = `
      <div class="pendiente-modal-overlay" id="verReuOverlay">
        <div class="pendiente-modal" style="width:min(480px,94vw)">
          <div class="pendiente-modal-head">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--cn-azul)"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
            <div>
              <div class="pendiente-modal-title">Reunión · ${UI.esc(titulo)}</div>
              <div class="pendiente-modal-eyebrow">${b ? b.hora_inicio + '–' + b.hora_fin : ''} · ${UI.esc(UI.fmtFecha(dia))}${salaNombre ? ' · ' + UI.esc(salaNombre) : ''}</div>
            </div>
            <button class="panel-close" id="verReuClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="pendiente-modal-body">
            <div class="ter-metrica-h">Equipo terapéutico (${participantes.length})</div>
            <div class="reu-part-list">
              ${participantes.map(t => { const c = ESPECIALIDAD_VAR[t.especialidad] || {}; return `<div class="reu-part"><span class="disp-abr" style="background:${c.bg || 'var(--cn-azul-bg)'};color:${c.text || 'var(--cn-azul-deep)'}">${UI.esc(t.abreviacion)}</span><span>${UI.esc(t.nombre_completo)}<small>${UI.esc(t.especialidad)}</small></span></div>`; }).join('')}
            </div>
            ${extra.length ? `<div class="ter-metrica-h" style="margin-top:14px">Administración y externos (${extra.length})</div>
            <div class="reu-part-list">${extra.map(e => `<div class="reu-part"><span class="disp-abr" style="background:var(--bg-soft);color:var(--text-2)">+</span><span>${UI.esc(e)}</span></div>`).join('')}</div>` : ''}
          </div>
          <div class="pendiente-modal-foot">
            <button class="btn btn-danger" id="verReuDel">Eliminar reunión</button>
            <button class="btn btn-primary" id="verReuClose2">Cerrar</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const cerrar = () => document.getElementById('verReuOverlay')?.remove();
    document.getElementById('verReuClose').addEventListener('click', cerrar);
    document.getElementById('verReuClose2').addEventListener('click', cerrar);
    document.getElementById('verReuOverlay').addEventListener('click', e => { if (e.target.id === 'verReuOverlay') cerrar(); });
    document.getElementById('verReuDel').addEventListener('click', () => {
      const ids = new Set(sesiones.map(s => s.id_sesion));
      State.data.sesiones = State.data.sesiones.filter(s => !ids.has(s.id_sesion));
      UI.toast('Reunión eliminada', 'success');
      cerrar();
      this.renderDisponibilidad();
    });
  },

  // Salas con CUPO en (fecha, bloque destino); respeta capacidad_personas (TO1=4, TO2=2…).
  _salasLibres(movSes, dest, dia) {
    const uso = {};
    State.data.sesiones
      .filter(s => s.fecha === dia && s.id_bloque === dest.idBloque && s.id_sesion !== movSes.id_sesion && s.id_sala)
      .forEach(s => { uso[s.id_sala] = (uso[s.id_sala] || 0) + 1; });
    const tDest = Data.terapeuta(dest.idTer);
    const pref = [tDest?.sala_principal, tDest?.sala_opcion_2, tDest?.sala_opcion_3].filter(Boolean);
    const rank = id => { const i = pref.indexOf(id); return i === -1 ? 99 : i; };
    return (State.data.salas || [])
      .filter(sa => (uso[sa.id_sala] || 0) < (sa.capacidad_personas || 1))
      .sort((a, b) => rank(a.id_sala) - rank(b.id_sala) || a.nombre.localeCompare(b.nombre))
      .map(sa => {
        const cap = sa.capacidad_personas || 1;
        const libres = cap - (uso[sa.id_sala] || 0);
        return { id: sa.id_sala, nombre: sa.nombre, pref: pref.includes(sa.id_sala), actual: sa.id_sala === movSes.id_sala, cupo: cap > 1 ? libres : 0 };
      });
  },

  // Mover una sesión ARRASTRÁNDOLA (eventos de puntero · confiable en tablas). Al soltar, eliges sala.
  _wireDispMove(dia, diaNombre) {
    const self = this;
    document.getElementById('dispMovCancel')?.addEventListener('click', () => { this._movDisp = null; this._movDest = null; this.renderDisponibilidad(); });

    // Ver participantes de una reunión ya agendada
    document.querySelectorAll('.disp-table-bandas .disp-reu-ver').forEach(cell => {
      cell.addEventListener('click', () => self._verReunion(cell.dataset.reuId, cell.dataset.reuNino, cell.dataset.reuBloque, dia));
    });

    // Crear sesión al hacer clic en un espacio LIBRE (de un terapeuta o de una sala) — pedido de Trini
    document.querySelectorAll('.disp-table-bandas .disp-crear').forEach(cell => {
      cell.addEventListener('click', () => {
        if (self._movDisp || cell.classList.contains('disp-target')) return; // si está moviendo, no crear
        const { ter, sala, nino, bloque } = cell.dataset;
        self._abrirChooserActividad(dia, diaNombre, { ter: ter || null, sala: sala || null, nino: nino || null, bloque });
      });
    });

    // Paso final: ya hay destino soltado → elegir sala y aplicar
    if (this._movDisp && this._movDest) {
      const movSes = State.data.sesiones.find(s => s.id_sesion === this._movDisp);
      document.querySelectorAll('.disp-sala-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const dest = this._movDest, t = Data.terapeuta(dest.idTer), b = Data.bloque(dest.idBloque);
          const idSala = chip.dataset.sala || null;
          if (movSes) {
            movSes.id_terapeuta = dest.idTer;
            if (t) movSes.terapeuta_abr = t.abreviacion;
            movSes.id_bloque = dest.idBloque;
            if (b) { movSes.hora_inicio = b.hora_inicio; movSes.hora_fin = b.hora_fin; }
            if (idSala) { const sa = Data.sala(idSala); movSes.id_sala = idSala; if (sa) movSes.sala_nombre = sa.nombre; }
            // Reasignar la terapia a otro niño (si se soltó en la fila de otro niño)
            if (dest.idNino && dest.idNino !== movSes.id_nino) {
              const n = Data.nino(dest.idNino);
              movSes.id_nino = dest.idNino;
              if (n) { movSes.nino_visible = n.nombre_visible; movSes.id_programa = n.id_programa; }
            }
            movSes.conflicto_detectado = null;
            UI.toast(`${movSes.nino_visible} → ${t ? UI.esc(t.nombre_visible) : ''} · ${b ? b.hora_inicio : ''}${idSala ? ' · ' + UI.esc(movSes.sala_nombre) : ''}`, 'success');
          }
          this._movDisp = null; this._movDest = null; this.renderDisponibilidad();
        });
      });
      return;
    }

    // Arrastre multibanda: soltar en Profesionales (cambia profesional), Niños (cambia horario del mismo niño) o Salas (cambia sala)
    let dragId = null, dragNino = null, ghost = null, over = null;
    const valid = (cell) => !!(cell && cell.classList.contains('disp-libre') && cell.dataset.band);
    const onMove = (e) => {
      if (ghost) { ghost.style.left = (e.clientX + 10) + 'px'; ghost.style.top = (e.clientY + 12) + 'px'; }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cell = el && el.closest ? el.closest('.disp-cell') : null;
      if (over && over !== cell) over.classList.remove('disp-over');
      if (valid(cell)) { cell.classList.add('disp-over'); over = cell; } else over = null;
    };
    const onUp = (e) => {
      window.removeEventListener('pointermove', onMove);
      if (ghost) { ghost.remove(); ghost = null; }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cell = el && el.closest ? el.closest('.disp-cell') : null;
      const id = dragId; dragId = null;
      document.querySelectorAll('.disp-cell.disp-target, .disp-cell.disp-over, .disp-cell.disp-dragging')
        .forEach(c => c.classList.remove('disp-target', 'disp-over', 'disp-dragging'));
      if (!cell || !cell.dataset.band) return;
      const sesion = State.data.sesiones.find(s => s.id_sesion === id);
      if (!sesion) return;
      const banda = cell.dataset.band;
      const idBloque = cell.dataset.bloque;
      let idTer = sesion.id_terapeuta, idSala = sesion.id_sala, idNino = sesion.id_nino;
      if (banda === 'prof') idTer = cell.dataset.ter;
      else if (banda === 'nino') idNino = cell.dataset.nino; // puede reasignar la terapia a OTRO niño
      else if (banda === 'sala') idSala = cell.dataset.sala;
      // Validación de topes (la sala se valida directo solo si el destino fue la banda Salas)
      const tope = self._topeMovimiento(sesion, idTer, idBloque, idSala, dia, banda === 'sala', idNino);
      if (tope) { self._alertaTope('No se puede mover', tope); return; }
      if (banda === 'sala') {
        self._aplicarMov(sesion, idTer, idBloque, idSala);
        self.renderDisponibilidad();
      } else {
        // prof / nino → elegir sala libre a la derecha y aplicar (idNino reasigna el niño si cambió)
        self._movDisp = id;
        self._movDest = { idTer, idBloque, idNino };
        self.renderDisponibilidad();
      }
    };
    document.querySelectorAll('.disp-table-bandas .disp-pick').forEach(cell => {
      cell.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        dragId = cell.dataset.id;
        const movSes = State.data.sesiones.find(s => s.id_sesion === dragId);
        dragNino = movSes?.id_nino || null;
        cell.classList.add('disp-dragging');
        // resaltar destinos válidos en las TRES bandas
        document.querySelectorAll('.disp-table-bandas .disp-libre[data-band]').forEach(c => {
          const band = c.dataset.band;
          if (band === 'prof' && c.dataset.ter === movSes?.id_terapeuta && c.dataset.bloque === movSes?.id_bloque) return;
          c.classList.add('disp-target');
        });
        ghost = document.createElement('div');
        ghost.className = 'disp-ghost';
        ghost.textContent = (cell.querySelector('.disp-nino')?.textContent) || cell.textContent || 'sesión';
        document.body.appendChild(ghost);
        onMove(e);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp, { once: true });
      });
    });
  },

  // Profesionales (de una lista) que YA tienen una sesión en (dia, idBloque). Devuelve [{idTer, nombre}].
  _terapeutasOcupados(dia, idBloque, idsTer) {
    const enBloque = State.data.sesiones.filter(s => s.fecha === dia && s.id_bloque === idBloque);
    return idsTer
      .filter(idTer => enBloque.some(s => s.id_terapeuta === idTer || s.id_terapeuta_secundario === idTer))
      .map(idTer => ({ idTer, nombre: Data.terapeuta(idTer)?.nombre_completo || idTer }));
  },

  // Devuelve el primer tope (texto) que impide mover la sesión a (idTer, idBloque, idSala, idNino), o null si está libre.
  _topeMovimiento(sesion, idTer, idBloque, idSala, dia, checkSala, idNino) {
    const b = Data.bloque(idBloque);
    const hora = b ? b.hora_inicio : '';
    const nino = idNino || sesion.id_nino;
    const otras = State.data.sesiones.filter(s => s.fecha === dia && s.id_bloque === idBloque && s.id_sesion !== sesion.id_sesion);
    // Solo validamos la dimensión que realmente cambia de "casillero" (profesional+hora / niño+hora).
    // Si la hora no cambia y solo se mueve el profesional o la sala, el niño no se está reubicando
    // en el tiempo → no debe dispararse "el niño ya tiene una sesión" por sus otras terapias del bloque.
    const mismoBloque = idBloque === sesion.id_bloque;
    const profCambia = !(idTer === sesion.id_terapeuta && mismoBloque);
    const ninoCambia = !(nino === sesion.id_nino && mismoBloque);
    if (profCambia && otras.some(s => s.id_terapeuta === idTer || s.id_terapeuta_secundario === idTer)) {
      const t = Data.terapeuta(idTer);
      return `El profesional ${UI.esc(t?.nombre_completo || idTer)} ya tiene una sesión a las ${hora}.`;
    }
    if (nino && ninoCambia && otras.some(s => s.id_nino === nino)) {
      const n = Data.nino(nino);
      return `${UI.esc(n?.nombre_visible || 'El niño')} ya tiene otra sesión a las ${hora}.`;
    }
    if (checkSala && idSala) {
      const sa = Data.sala(idSala);
      const usados = otras.filter(s => s.id_sala === idSala).length;
      if (usados >= (sa?.capacidad_personas || 1)) return `La sala ${UI.esc(sa?.nombre || idSala)} está ocupada/llena a las ${hora}.`;
    }
    return null;
  },

  // Aplica el movimiento directo (usado cuando se suelta en la banda Salas).
  _aplicarMov(sesion, idTer, idBloque, idSala) {
    const t = Data.terapeuta(idTer), b = Data.bloque(idBloque), sa = idSala ? Data.sala(idSala) : null;
    sesion.id_terapeuta = idTer;
    if (t) sesion.terapeuta_abr = t.abreviacion;
    sesion.id_bloque = idBloque;
    if (b) { sesion.hora_inicio = b.hora_inicio; sesion.hora_fin = b.hora_fin; }
    sesion.id_sala = idSala || null;
    sesion.sala_nombre = sa?.nombre || '—';
    sesion.conflicto_detectado = null;
    UI.toast(`${sesion.nino_visible} movido${sa ? ' a ' + UI.esc(sa.nombre) : ''} · ${b ? b.hora_inicio : ''}`, 'success');
  },

  // Modal de alerta de tope (profesional/sala/niño ocupado).
  _alertaTope(titulo, mensaje) {
    const html = `
      <div class="pendiente-modal-overlay" id="topeOverlay">
        <div class="pendiente-modal" style="width:min(420px,94vw)">
          <div class="pendiente-modal-head">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--alert)"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div><div class="pendiente-modal-title">${UI.esc(titulo)}</div></div>
          </div>
          <div class="pendiente-modal-body"><p>${mensaje}</p></div>
          <div class="pendiente-modal-foot"><button class="btn btn-primary" id="topeOk">Entendido</button></div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const cerrar = () => document.getElementById('topeOverlay')?.remove();
    document.getElementById('topeOk').addEventListener('click', cerrar);
    document.getElementById('topeOverlay').addEventListener('click', e => { if (e.target.id === 'topeOverlay') cerrar(); });
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
            <th></th><th>Nombre</th><th>Edad</th><th>Programa</th><th>Madre / apoderada</th><th>Teléfono</th><th>Encargado</th>
          </tr></thead>
          <tbody>
            ${filtered.map(n => {
              const c = UI.colorNino(n.id_nino);
              const tel = n.telefono_madre || n.telefono_apoderado;
              return `<tr style="cursor:pointer" data-id="${n.id_nino}">
                <td><span class="ficha-avatar" style="width:32px;height:32px;font-size:11px;background:${c.bg};color:${c.text};${UI.ringIntensivo(n)}">${UI.esc(UI.initials(n.nombre_completo))}</span></td>
                <td><div style="font-weight:600;color:var(--text)">${UI.esc(n.nombre_completo)}${UI.badgeIntensivo(n)}</div><div style="font-size:11px;color:var(--text-3)" class="mono">${UI.esc(n.rut)}</div></td>
                <td class="num">${n.edad_anios}</td>
                <td>${UI.esc(n.programa_nombre)}</td>
                <td>${UI.esc(n.madre || n.apoderado_principal)}</td>
                <td class="mono">${tel ? `<a href="https://wa.me/${String(tel).replace(/[^\d]/g,'')}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:var(--cn-azul-deep)">${UI.esc(tel)}</a>` : '—'}</td>
                <td>${UI.esc(n.encargado || '—')}</td>
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
