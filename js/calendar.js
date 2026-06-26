// Módulo Calendario
const Calendar = {
  view: 'semana',     // 'semana' | 'dia' | 'mes'
  dayDate: null,      // ISO; null = HOY_ISO
  monthAnchor: null,  // ISO dentro del mes; null = mes de weekStart

  render() {
    const main = document.getElementById('main');
    const k = {
      ocup: Data.kpiOcupacion(),
      hoy: Data.kpiSesionesHoy(),
      salas: Data.kpiSalasActivas(),
      conf: Data.kpiConflictos(),
    };
    const vista = this._sesionesDeVista();
    const ninosSet = new Set(vista.map(s => s.id_nino));
    const terSet = new Set(vista.map(s => s.id_terapeuta));
    const salasSet = new Set(vista.map(s => s.id_sala));
    const conteo = Data.conteoPorPrograma();

    const eyebrow = State.role === 'coordinacion'
      ? 'Vista coordinación · Intensivo 40'
      : State.role === 'terapeuta'
      ? `Vista terapeuta · ${UI.esc(DEMO_USERS.terapeuta?.short || '—')}`
      : `Vista familia · ${UI.esc(Data.nino(DEMO_USERS.padres?.id_nino)?.nombre_visible || '—')}`;

    const tituloSeccion = this.view === 'dia' ? 'Agenda del día' : this.view === 'mes' ? 'Vista mensual' : 'Agenda semanal';
    const subSeccion = this.view === 'mes'
      ? `${vista.length} sesiones en el mes · click en un día para ver su agenda`
      : `${vista.length} sesiones${k.conf.count ? ` · <b style="color:var(--alert)">${k.conf.count} conflicto${k.conf.count===1?'':'s'}</b> detectado${k.conf.count===1?'':'s'}` : ''} · click en celda vacía para crear · drag para mover${State.role === 'coordinacion' ? ' · los cambios afectan <b>solo este día</b>; los permanentes se hacen en el Armador de Horario' : ''}`;

    main.innerHTML = `
      <section class="hero${State.role === 'terapeuta' ? ' hero-compact' : ''}">
        <div class="hero-brain">
          <svg viewBox="0 0 64 64" fill="none">
            <path d="M22 14C16 14 12 18 12 24C12 26 12.5 28 13.5 29.5C11 31 9 34 9 38C9 44 13 48 19 48C20 49.5 22 51 24 51C24 53 25 54 27 54C29 54 31 53 31 51V14C28 14 25 14 22 14Z" stroke="currentColor" stroke-width="2.5"/>
            <path d="M42 14C48 14 52 18 52 24C52 26 51.5 28 50.5 29.5C53 31 55 34 55 38C55 44 51 48 45 48C44 49.5 42 51 40 51C40 53 39 54 37 54C35 54 33 53 33 51V14C36 14 39 14 42 14Z" stroke="currentColor" stroke-width="2.5"/>
            <line x1="32" y1="14" x2="32" y2="51" stroke="currentColor" stroke-width="2.5"/>
            <path d="M18 24C20 22 23 22 25 24" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            <path d="M16 36C18 34 21 34 23 36" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            <path d="M39 24C41 22 44 22 46 24" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            <path d="M41 36C43 34 46 34 48 36" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="hero-inner">
          <div>
            <div class="hero-eyebrow">${UI.esc(eyebrow)}</div>
            <h1 class="hero-title">${this._heroTitulo()}</h1>
            <div class="hero-meta">
              <div class="hero-meta-item">
                <span class="hero-meta-label">Sesiones</span>
                <span class="hero-meta-value">${vista.length}</span>
              </div>
              <div class="hero-meta-divider"></div>
              <div class="hero-meta-item">
                <span class="hero-meta-label">Niños</span>
                <span class="hero-meta-value">${ninosSet.size}</span>
              </div>
              <div class="hero-meta-divider"></div>
              <div class="hero-meta-item">
                <span class="hero-meta-label">Terapeutas</span>
                <span class="hero-meta-value">${terSet.size}</span>
              </div>
              <div class="hero-meta-divider"></div>
              <div class="hero-meta-item">
                <span class="hero-meta-label">Salas</span>
                <span class="hero-meta-value">${salasSet.size}</span>
              </div>
            </div>
          </div>
          <div class="hero-week-nav">
            <button class="hero-week-btn" id="navPrev" aria-label="Anterior"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
            <span class="hero-week-label">${this._navLabel()}</span>
            <button class="hero-week-btn" id="navNext" aria-label="Siguiente"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>
          </div>
        </div>
      </section>

      ${State.role === 'coordinacion' ? this._kpiRow(k) : ''}

      <div class="section-head">
        <div>
          <div class="section-title">${tituloSeccion}</div>
          <div class="section-sub">${subSeccion}</div>
        </div>
        <div class="section-actions">
          <div class="view-switch">
            <button class="view-btn ${this.view==='semana'?'active':''}" data-view="semana" type="button">Semana</button>
            <button class="view-btn ${this.view==='dia'?'active':''}" data-view="dia" type="button">Día</button>
            <button class="view-btn ${this.view==='mes'?'active':''}" data-view="mes" type="button">Mes</button>
          </div>
          <button class="btn btn-secondary" id="todayBtn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="7" x2="12" y2="12"/><line x1="12" y1="12" x2="16" y2="14"/></svg>
            Hoy
          </button>
        </div>
      </div>

      <div class="cal-toolbar">
        <div class="fichas-chips">
          <button class="chip ${State.filterPrograma==='all'?'active':''}" data-prog="all">Todos <span class="chip-count">${conteo.all}</span></button>
          <button class="chip ${State.filterPrograma==='INT'?'active':''}" data-prog="INT">Intensivo <span class="chip-count">${conteo.INT}</span></button>
          <button class="chip ${State.filterPrograma==='CONT'?'active':''}" data-prog="CONT">Continuo <span class="chip-count">${conteo.CONT}</span></button>
          <button class="chip ${State.filterPrograma==='EVAL'?'active':''}" data-prog="EVAL">Evaluación <span class="chip-count">${conteo.EVAL}</span></button>
          <button class="chip ${State.filterPrograma==='APR'?'active':''}" data-prog="APR">Apraxia <span class="chip-count">${conteo.APR}</span></button>
          <button class="chip ${State.filterPrograma==='AT'?'active':''}" data-prog="AT">AT <span class="chip-count">${conteo.AT}</span></button>
        </div>
        ${State.role === 'coordinacion' ? `
          <div class="cal-filtro-nino">
            <label for="calFiltroNino">Niño</label>
            <select id="calFiltroNino">
              <option value="all">Todos los niños</option>
              ${Data.ninosVisibles().slice().sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo)).map(n => `<option value="${n.id_nino}" ${State.filterNino === n.id_nino ? 'selected' : ''}>${UI.esc(n.nombre_completo)}</option>`).join('')}
            </select>
          </div>` : ''}
        <div class="tip">Tip: arrastra una sesión para moverla · <kbd>click</kbd> para abrir</div>
      </div>

      ${State.role === 'terapeuta' && this.view !== 'mes'
        ? `<div class="ter-layout">
             <div class="calendar cal-ter-compact" id="calendar">${this._renderGrid()}</div>
             <aside class="ter-side">${this._panelTerapeuta()}</aside>
           </div>`
        : `<div class="calendar" id="calendar">${this._renderGrid()}</div>`}

      <div class="legend">
        <span class="legend-note">Cada <b>color</b> es un niño · el <b>punto</b> indica la terapia:</span>
        ${Object.entries(ESPECIALIDAD_VAR).map(([k,v]) => `
          <span class="legend-item"><span class="ses-disc-dot" style="background:${v.main}"></span>${UI.esc(k)}</span>
        `).join('')}
        <span class="legend-item"><span class="legend-swatch" style="background:var(--cn-mostaza)"></span>Intensivo (INT)</span>
        <span class="legend-item"><span class="legend-swatch" style="background:var(--alert)"></span>Conflicto</span>
      </div>
    `;

    this._wire();
  },

  // Sesiones según la vista activa (semana / día / mes), filtradas por rol
  _sesionesDeVista() {
    if (this.view === 'dia') {
      const f = this.dayDate || HOY_ISO;
      return Data.sesionesVisibles().filter(s => s.fecha === f);
    }
    if (this.view === 'mes') {
      const mes = (this.monthAnchor || State.weekStart).slice(0, 7);
      return Data.sesionesVisibles().filter(s => s.fecha.slice(0, 7) === mes);
    }
    return Data.sesionesSemana();
  },

  _heroTitulo() {
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    if (this.view === 'dia') {
      return `<span class="accent">${UI.esc(UI.fmtFecha(this.dayDate || HOY_ISO))}</span>`;
    }
    if (this.view === 'mes') {
      const a = this.monthAnchor || State.weekStart;
      const [y, m] = a.split('-').map(Number);
      return `<span class="accent">${MESES[m - 1]} ${y}</span>`;
    }
    return `Semana del <span class="accent">${UI.fmtRangoSemana()}</span>`;
  },

  _navLabel() {
    if (this.view === 'dia') return 'Día';
    if (this.view === 'mes') return 'Mes';
    return `Sem ${State.data.meta.semana_actual} de 6`;
  },

  // Panel lateral del terapeuta: para cada sesión suya, qué le toca al niño
  // ANTES y DESPUÉS (con otros profesionales) → traspasos. En gris lo que no es suyo.
  _panelTerapeuta() {
    const tid = DEMO_USERS.terapeuta?.id_terapeuta;
    const DIAS_LBL = { lunes: 'Lunes', martes: 'Martes', 'miércoles': 'Miércoles', jueves: 'Jueves', viernes: 'Viernes' };
    const bloquesOrd = (State.data.bloques_horarios || []).slice().sort((a, b) => a.orden - b.orden);
    const ordenDe = (idb) => { const b = bloquesOrd.find(x => x.id_bloque === idb); return b ? b.orden : 99; };
    const abrTer = (id) => { const t = Data.terapeuta(id); return t ? (t.nombre_visible || t.abreviacion) : '—'; };
    const fechas = (this.view === 'dia') ? [this.dayDate || HOY_ISO] : fechasSemana();

    const mias = this.view === 'dia'
      ? Data.sesionesVisibles().filter(s => s.fecha === (this.dayDate || HOY_ISO))
      : Data.sesionesSemana();
    const propias = mias.filter(s => s.id_nino && s.tipo_actividad !== 'Reunión de equipo');

    const reuniones = mias.filter(s => s.tipo_actividad === 'Reunión de equipo');

    const adj = (s) => {
      const todas = Data.sesionesDeNino(s.id_nino)
        .filter(x => x.fecha === s.fecha && x.tipo_actividad !== 'Reunión de equipo')
        .sort((a, b) => ordenDe(a.id_bloque) - ordenDe(b.id_bloque));
      const i = todas.findIndex(x => x.id_sesion === s.id_sesion);
      return { antes: i > 0 ? todas[i - 1] : null, despues: (i >= 0 && i < todas.length - 1) ? todas[i + 1] : null };
    };
    const lineaAdj = (x, tipo) => {
      if (!x) return `<div class="ter-adj ter-adj-none">${tipo === 'antes' ? 'Sin sesión previa' : 'Última del día'}</div>`;
      const mia = x.id_terapeuta === tid || x.id_terapeuta_secundario === tid;
      return `<div class="ter-adj${mia ? ' ter-adj-mia' : ''}">
        <span class="ter-adj-flecha">${tipo === 'antes' ? '↑' : '↓'}</span>
        <span class="mono">${x.hora_inicio}</span> ${UI.esc(x.tipo_terapia)} · ${UI.esc(abrTer(x.id_terapeuta))}${mia ? ' (tú)' : ''}
      </div>`;
    };

    let secciones = '';
    fechas.forEach(f => {
      const dia = propias.filter(s => s.fecha === f).sort((a, b) => ordenDe(a.id_bloque) - ordenDe(b.id_bloque));
      const reuDia = reuniones.filter(s => s.fecha === f);
      if (!dia.length && !reuDia.length) return;
      const [, , d] = f.split('-').map(Number);
      const diaNom = DIAS_LBL[Object.keys(DIAS_LBL)[(new Date(f + 'T00:00:00Z').getUTCDay() + 6) % 7]] || '';
      const cards = dia.map(s => {
        const c = ESPECIALIDAD_VAR[s.tipo_terapia] || ESPECIALIDAD_VAR['Terapia Ocupacional'];
        const nino = Data.nino(s.id_nino);
        const cn = UI.colorNino(s.id_nino);
        const { antes, despues } = adj(s);
        return `<div class="ter-card" style="border-left-color:${cn.bg}">
          <div class="ter-card-top">
            <span class="ter-card-hora mono">${s.hora_inicio}</span>
            <span class="ter-card-nino">${UI.esc((s.nino_visible || '').trim())}${UI.badgeIntensivo(nino)}</span>
          </div>
          <div class="ter-card-disc" style="color:${c.text}"><span class="ses-disc-dot" style="background:${UI.discColor(s.tipo_terapia)}"></span>${UI.esc(s.tipo_terapia)}${s.sala_nombre && s.sala_nombre !== '—' ? ` · ${UI.esc(s.sala_nombre)}` : ''}</div>
          <div class="ter-adj-wrap">${lineaAdj(antes, 'antes')}${lineaAdj(despues, 'despues')}</div>
        </div>`;
      }).join('');
      const reuCards = reuDia.map(s => `<div class="ter-card ter-card-reunion">
          <div class="ter-card-top"><span class="ter-card-hora mono">${s.hora_inicio}</span><span class="ter-card-nino">Reunión de equipo</span></div>
          <div class="ter-card-disc">${UI.esc((s.nino_visible || '').replace('Reunión de equipo · ', '')) || 'Todo el equipo'}</div>
        </div>`).join('');
      secciones += `<div class="ter-day"><div class="ter-day-head">${diaNom} ${d}</div>${cards}${reuCards}</div>`;
    });

    if (!secciones) secciones = '<div class="ter-empty">No tienes sesiones esta semana.</div>';
    return `
      <div class="ter-side-head">
        <div class="ter-side-title">Tu agenda y traspasos</div>
        <div class="ter-side-sub">Qué le toca a cada niño antes y después de tu sesión</div>
      </div>
      ${secciones}`;
  },

  // Fila de KPI superior. El admin ve el termómetro del centro;
  // el terapeuta ve sus propios indicadores, no las cards de coordinación.
  _kpiRow(k) {
    if (State.role === 'terapeuta') return this._kpiRowTerapeuta();
    return `<div class="kpi-row">
        <div class="kpi kpi-featured">
          <div class="kpi-label">Ocupación semanal</div>
          <div class="kpi-value">${k.ocup}<span class="kpi-unit">%</span></div>
          <div class="kpi-meta"><span class="delta up">↑ 4%</span><span>vs semana anterior</span></div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Sesiones hoy</div>
          <div class="kpi-value">${k.hoy.total}</div>
          <div class="kpi-meta">${k.hoy.manana} mañana · ${k.hoy.tarde} tarde</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Salas activas</div>
          <div class="kpi-value">${k.salas.activas}<span class="kpi-unit">/${k.salas.total}</span></div>
          <div class="kpi-meta">${k.salas.saturadas.length ? k.salas.saturadas.slice(0,3).join(' · ') + ' saturadas' : 'Distribución pareja'}</div>
        </div>
        <div class="kpi ${k.conf.count ? 'kpi-alert kpi-clickable' : ''}" id="kpiConflict" ${k.conf.count ? 'role="button" tabindex="0"' : ''}>
          <div class="kpi-label">${k.conf.count ? '<span class="alert-dot"></span>' : ''}Conflictos detectados</div>
          <div class="kpi-value">${k.conf.count}</div>
          <div class="kpi-meta">${k.conf.count ? 'Click para ver detalle' : 'Sin conflictos'}</div>
          ${k.conf.count ? `
            <div class="kpi-expand" id="kpiConflictExpand">
              ${k.conf.list.map(s => {
                const ter = Data.terapeuta(s.id_terapeuta);
                const ci = this._conflictoInfo(s);
                return `<div class="conflict-row" data-id="${s.id_sesion}">
                  <div class="conflict-row-head">
                    <b>${UI.esc(s.nino_visible)}</b> con <b>${UI.esc(ter?.nombre_visible || '—')}</b>
                  </div>
                  <div class="conflict-row-meta">
                    ${UI.esc(s.tipo_terapia)} · Sala ${UI.esc(s.sala_nombre)} · ${UI.esc(s.dia_semana)} ${UI.esc(s.hora_inicio)}<br>
                    <span class="conflict-reason">⚠ ${ci.motivo}</span>
                    ${ci.sug ? `<br><button class="conflict-mover" data-id="${UI.esc(s.id_sesion)}" data-fecha="${ci.sug.fecha}" data-bloque="${UI.esc(ci.sug.id_bloque)}" data-dia="${UI.esc(ci.sug.dia)}" style="margin-top:7px;background:#fff;color:var(--alert);border:none;border-radius:7px;padding:6px 11px;font-size:11.5px;font-weight:700;cursor:pointer">💡 Mover a ${UI.esc(ci.sug.label)} (bloque libre)</button>` : ''}
                  </div>
                  <button class="btn btn-secondary conflict-jump">Ir →</button>
                </div>`;
              }).join('')}
            </div>
          ` : ''}
        </div>
      </div>`;
  },

  _kpiRowTerapeuta() {
    const tid = DEMO_USERS.terapeuta?.id_terapeuta;
    const esMio = (s) => s.id_terapeuta === tid || s.id_terapeuta_secundario === tid;
    // Próxima sesión agendada de hoy en adelante
    const futuras = State.data.sesiones
      .filter(s => esMio(s) && s.estado === 'Agendada' && s.fecha >= HOY_ISO)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
    const prox = futuras[0];
    // Sesiones de la semana (sesionesVisibles ya viene filtrado por rol)
    const sem = Data.sesionesSemana().length;
    // Fichas con nota pendiente
    const notasPend = Main._notasFaltantes(tid).length;
    // Horas realizadas del mes
    const realizadasMes = State.data.sesiones.filter(s => esMio(s) && s.estado === 'Realizada' && s.fecha.startsWith('2026-05'));
    // 1 sesión = 1 hora terapéutica de 45 min: las horas equivalen a las sesiones
    const horasMes = realizadasMes.length;

    const proxVal = prox ? UI.esc(prox.nino_visible) : '—';
    const proxMeta = prox
      ? `${UI.esc(UI.fmtFecha(prox.fecha))} · ${UI.esc(prox.hora_inicio)} · Sala ${UI.esc(prox.sala_nombre || '—')}`
      : 'No tienes sesiones próximas';

    return `<div class="kpi-row">
        <div class="kpi kpi-featured">
          <div class="kpi-label">Próxima sesión</div>
          <div class="kpi-value" style="font-size:24px;line-height:1.2">${proxVal}</div>
          <div class="kpi-meta">${proxMeta}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Sesiones de tu semana</div>
          <div class="kpi-value">${sem}</div>
          <div class="kpi-meta">en tu agenda</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Fichas con nota pendiente</div>
          <div class="kpi-value">${notasPend}</div>
          <div class="kpi-meta">${notasPend > 0 ? 'sesiones sin nota clínica' : 'todo al día'}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Horas terapéuticas · mayo</div>
          <div class="kpi-value">${horasMes}</div>
          <div class="kpi-meta">1 sesión = 1 hora de 45 min</div>
        </div>
      </div>`;
  },

  _descConflictos(list) {
    if (!list.length) return '';
    const s = list[0];
    const ter = Data.terapeuta(s.id_terapeuta);
    return `${ter?.nombre_visible || '—'} · ${s.sala_nombre} · ${s.dia_semana}`;
  },

  // Detecta el tipo de choque (sala / profesional) y sugiere un bloque libre
  _conflictoInfo(s) {
    const otras = State.data.sesiones.filter(o =>
      o.fecha === s.fecha && o.id_bloque === s.id_bloque && o.id_sesion !== s.id_sesion);
    let motivo;
    if (otras.some(o => o.id_sala === s.id_sala)) {
      motivo = `Choque de <b>sala</b> · ${UI.esc(s.sala_nombre)} ya está ocupada en ese bloque`;
    } else if (otras.some(o => o.id_terapeuta === s.id_terapeuta)) {
      const t = Data.terapeuta(s.id_terapeuta);
      motivo = `Choque de <b>profesional</b> · ${UI.esc(t?.nombre_visible || '—')} ya tiene otra sesión en ese bloque`;
    } else {
      motivo = UI.esc(s.conflicto_detectado || 'Conflicto detectado');
    }
    // Sugerir un bloque libre de la semana (de hoy en adelante, sin choques)
    const fechas = fechasSemana();
    const feriados = (State.data.meta && State.data.meta.feriados) || [];
    const bloques = State.data.bloques_horarios.slice().sort((a, b) => a.orden - b.orden);
    let sug = null;
    for (let di = 0; di < fechas.length && !sug; di++) {
      const f = fechas[di];
      if (f < HOY_ISO || feriados.includes(f)) continue;
      for (const b of bloques) {
        if (f === s.fecha && b.id_bloque === s.id_bloque) continue;
        const choca = State.data.sesiones.some(o => o.fecha === f && o.id_bloque === b.id_bloque && o.id_sesion !== s.id_sesion &&
          (o.id_sala === s.id_sala || o.id_terapeuta === s.id_terapeuta || o.id_nino === s.id_nino));
        if (!choca) { sug = { fecha: f, id_bloque: b.id_bloque, dia: DIAS[di], label: `${DIAS_LABEL[di]} ${b.hora_inicio}` }; break; }
      }
    }
    return { motivo, sug };
  },

  // Re-evalúa los conflictos marcados: limpia los que ya no chocan con nada
  _revaluarConflictos() {
    State.data.sesiones.filter(s => s.conflicto_detectado).forEach(s => {
      const otras = State.data.sesiones.filter(o =>
        o.fecha === s.fecha && o.id_bloque === s.id_bloque && o.id_sesion !== s.id_sesion);
      const sigueChocando = otras.some(o => o.id_sala === s.id_sala || o.id_terapeuta === s.id_terapeuta);
      if (!sigueChocando) s.conflicto_detectado = null;
    });
  },

  _renderGrid() {
    if (this.view === 'dia') return this._renderGridDia();
    if (this.view === 'mes') return this._renderGridMes();
    return this._renderGridSemana();
  },

  _renderGridSemana() {
    const fechas = fechasSemana();
    const hoyIdx = fechas.indexOf(HOY_ISO);
    const feriados = (State.data.meta && State.data.meta.feriados) || [];
    const bloques = State.data.bloques_horarios.sort((a, b) => a.orden - b.orden);

    let html = '<div class="cal-grid">';
    // Header: corner + 5 días
    html += `<div class="cal-header-cell" style="border-left:none"></div>`;
    DIAS.forEach((d, i) => {
      const fecha = fechas[i];
      const dayNum = Number(fecha.slice(-2));
      const isToday = fecha === HOY_ISO;
      const isFeriado = feriados.includes(fecha);
      html += `<div class="cal-header-cell ${isToday?'today-col':''} ${isFeriado?'feriado-col':''}">
        <div class="cal-day-name">${DIAS_ABBR[i]}</div>
        ${isToday ? `<div class="today-badge">${dayNum}</div>` : `<div class="cal-day-date">${dayNum}</div>`}
        ${isFeriado ? '<div class="cal-feriado-tag">Feriado</div>' : ''}
      </div>`;
    });

    // Filas: bloques
    let prevPeriodo = null;
    bloques.forEach(b => {
      const cambioPeriodo = prevPeriodo !== null && prevPeriodo !== b.periodo;
      prevPeriodo = b.periodo;
      const divCls = cambioPeriodo ? ' cal-period-start' : '';
      html += `<div class="cal-time${divCls}">
        <span>${b.hora_inicio}</span>
      </div>`;
      DIAS.forEach((dia, i) => {
        const fecha = fechas[i];
        const sesiones = this._colapsarReuniones(Data.sesionesPorDiaYBloque(fecha, b.id_bloque)
          .filter(s => this._matchPrograma(s)));
        const isToday = i === hoyIdx;
        const cellCls = `cal-cell ${isToday?'today-col':''} ${sesiones.length===0?'empty':''}${divCls}${feriados.includes(fecha)?' cal-feriado':''}`;
        html += `<div class="${cellCls}" data-dia="${dia}" data-bloque="${b.id_bloque}" data-fecha="${fecha}">`;
        sesiones.forEach((s, idx) => {
          html += this._renderSesion(s, idx);
        });
        html += `</div>`;
      });
    });

    html += '</div>';

    // Línea ahora (solo si HOY está en la semana)
    if (hoyIdx >= 0) {
      const pos = this._posLineaAhora(bloques);
      if (pos !== null) {
        html += `<div class="now-line" style="top:${pos}px"></div>`;
      }
    }

    return html;
  },

  _renderGridDia() {
    const fecha = this.dayDate || HOY_ISO;
    const [y, m, d] = fecha.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const diaIdx = (dt.getUTCDay() + 6) % 7;
    const dia = DIAS[diaIdx] || 'lunes';
    const feriados = (State.data.meta && State.data.meta.feriados) || [];
    const esFeriado = feriados.includes(fecha);
    const isToday = fecha === HOY_ISO;
    const bloques = State.data.bloques_horarios.slice().sort((a, b) => a.orden - b.orden);

    let html = '<div class="cal-grid cal-grid-dia">';
    html += `<div class="cal-header-cell" style="border-left:none"></div>`;
    html += `<div class="cal-header-cell ${isToday ? 'today-col' : ''} ${esFeriado ? 'feriado-col' : ''}">
      <div class="cal-day-name">${DIAS_ABBR[diaIdx] || ''}</div>
      ${isToday ? `<div class="today-badge">${d}</div>` : `<div class="cal-day-date">${d}</div>`}
      ${esFeriado ? '<div class="cal-feriado-tag">Feriado</div>' : ''}
    </div>`;
    let prevPeriodo = null;
    bloques.forEach(b => {
      const cambioPeriodo = prevPeriodo !== null && prevPeriodo !== b.periodo;
      prevPeriodo = b.periodo;
      const divCls = cambioPeriodo ? ' cal-period-start' : '';
      html += `<div class="cal-time${divCls}">
        <span>${b.hora_inicio}</span>
      </div>`;
      const sesiones = this._colapsarReuniones(Data.sesionesPorDiaYBloque(fecha, b.id_bloque).filter(s => this._matchPrograma(s)));
      const cellCls = `cal-cell ${isToday ? 'today-col' : ''} ${sesiones.length === 0 ? 'empty' : ''}${divCls}${esFeriado ? ' cal-feriado' : ''}`;
      html += `<div class="${cellCls}" data-dia="${dia}" data-bloque="${b.id_bloque}" data-fecha="${fecha}">`;
      sesiones.forEach((s, idx) => { html += this._renderSesion(s, idx); });
      html += `</div>`;
    });
    html += '</div>';
    return html;
  },

  _renderGridMes() {
    const anchor = this.monthAnchor || State.weekStart;
    const [y, m] = anchor.split('-').map(Number);
    const feriados = (State.data.meta && State.data.meta.feriados) || [];
    const porFecha = {};
    Data.sesionesVisibles().filter(s => this._matchPrograma(s)).forEach(s => {
      (porFecha[s.fecha] = porFecha[s.fecha] || []).push(s);
    });
    const ultimo = new Date(Date.UTC(y, m, 0));
    const inicio = new Date(Date.UTC(y, m - 1, 1));
    inicio.setUTCDate(inicio.getUTCDate() - ((inicio.getUTCDay() + 6) % 7));

    let html = '<div class="cal-mes-grid">';
    DIAS_LABEL.forEach(d => { html += `<div class="cal-mes-head">${d}</div>`; });
    const cur = new Date(inicio);
    while (cur <= ultimo) {
      for (let i = 0; i < 5; i++) {
        const cd = new Date(cur);
        cd.setUTCDate(cur.getUTCDate() + i);
        const iso = cd.toISOString().slice(0, 10);
        const inMonth = cd.getUTCMonth() === m - 1;
        const ses = porFecha[iso] || [];
        const isToday = iso === HOY_ISO;
        const esFeriado = feriados.includes(iso);
        const esps = [...new Set(ses.map(s => s.tipo_terapia))].slice(0, 6);
        html += `<div class="cal-mes-cell${inMonth ? '' : ' fuera'}${isToday ? ' today-col' : ''}${esFeriado ? ' cal-feriado' : ''}" data-fecha="${iso}">
          <div class="cal-mes-num">${cd.getUTCDate()}</div>
          ${esFeriado ? '<div class="cal-feriado-tag">Feriado</div>'
            : ses.length ? `<div class="cal-mes-count">${ses.length} ses.</div>
                <div class="cal-mes-dots">${esps.map(e => `<span class="cal-mes-dot" style="background:${(ESPECIALIDAD_VAR[e] && ESPECIALIDAD_VAR[e].main) || 'var(--cn-azul)'}"></span>`).join('')}</div>`
            : (inMonth ? '<div class="cal-mes-empty">Sin sesiones</div>' : '')}
        </div>`;
      }
      cur.setUTCDate(cur.getUTCDate() + 7);
    }
    html += '</div>';
    return html;
  },

  _matchPrograma(s) {
    if (State.filterNino && State.filterNino !== 'all'
        && s.id_nino !== State.filterNino && s.id_nino_secundario !== State.filterNino) return false;
    if (s.tipo_actividad === 'Reunión de equipo') return true; // del centro, no de un programa
    if (State.filterPrograma === 'all') return true;
    return s.id_programa === 'PROG-' + State.filterPrograma;
  },

  // Colapsa las "Reunión de equipo" del mismo niño en UNA entrada (la reunión es una sola
  // aunque se guarde como una sesión por terapeuta). Junta las abreviaciones en _abrevs.
  // Las demás sesiones pasan sin tocar. Conserva el orden original.
  _colapsarReuniones(sesiones) {
    const grupos = new Map();
    const out = [];
    sesiones.forEach(s => {
      if (s.tipo_actividad !== 'Reunión de equipo') { out.push(s); return; }
      const k = s.id_nino || s.id_sesion;
      if (!grupos.has(k)) {
        const g = { ...s, _abrevs: [], _ids: [] };
        grupos.set(k, g);
        out.push(g);
      }
      const g = grupos.get(k);
      const abr = (Data.terapeuta(s.id_terapeuta) || {}).abreviacion || s.terapeuta_abr;
      if (abr && !g._abrevs.includes(abr)) g._abrevs.push(abr);
      g._ids.push(s.id_sesion);
    });
    return out;
  },

  _renderSesion(s, idx) {
    // Reunión de equipo: UNA tarjeta por niño (aunque participen varios terapeutas).
    // Las sesiones-reunión del mismo niño+bloque ya vienen colapsadas con _abrevs.
    if (s.tipo_actividad === 'Reunión de equipo') {
      const ninoReu = Data.nino(s.id_nino);
      const etiqueta = ninoReu ? `Reunión de equipo · ${UI.esc(ninoReu.nombre_visible)}`
                               : UI.esc(s.nino_visible || 'Reunión de equipo');
      const abrevs = (s._abrevs && s._abrevs.length) ? s._abrevs : (s.terapeuta_abr ? [s.terapeuta_abr] : []);
      const equipoStr = abrevs.length ? abrevs.map(a => UI.esc(a)).join(' · ') : 'Todo el equipo';
      return `<div class="session s-reunion-equipo" data-id="${s.id_sesion}" style="animation-delay:${idx * 30}ms" title="${etiqueta} · ${UI.esc(s.hora_inicio)} · ${equipoStr}">
        <div class="session-name">${etiqueta}</div>
        <div class="session-sub">${equipoStr}</div>
      </div>`;
    }
    const ter = Data.terapeuta(s.id_terapeuta);
    const nino = Data.nino(s.id_nino);
    const cn = UI.colorNino(s.id_nino);          // color identitario del niño
    const isConflict = !!s.conflicto_detectado;
    const isDupla = s.es_dupla;
    let extraCls = '';
    // Identidad por color del niño como ACENTO (barra lateral), no fondo saturado:
    // fondo en un tinte muy suave del color + texto oscuro legible. La dupla mantiene su gradiente.
    let extraStyle = isDupla ? '' : `background:color-mix(in srgb, ${cn.bg} 13%, var(--bg, #fff));border-left-color:${cn.bg};color:var(--text);`;
    let nombre = UI.esc(s.nino_visible);
    let sub = `${UI.esc(s.tipo_terapia)} · ${UI.esc(s.sala_nombre)}`;
    if (isConflict) extraCls += ' s-conflict';
    if (s.tipo_sesion_padre === 'observacion') { extraCls += ' s-observacion'; sub += ' · con papás'; }
    if (isDupla) {
      extraCls += ' s-dupla';
      const ninoSec = Data.nino(s.id_nino_secundario);
      const terSec = Data.terapeuta(s.id_terapeuta_secundario);
      const c1 = ESPECIALIDAD_VAR[s.tipo_terapia];
      const c2 = terSec ? ESPECIALIDAD_VAR[terSec.especialidad] : ESPECIALIDAD_VAR['Fonoaudiología'];
      extraStyle = `--c1-bg:${c1.bg};--c2-bg:${c2?.bg || 'var(--fono-bg)'};color:${c1.text};border-left-color:${c1.main};`;
      if (ninoSec) nombre = `${UI.esc(s.nino_visible)} + ${UI.esc(ninoSec.nombre_visible)}`;
    }
    const dot = `<span class="ses-disc-dot" style="background:${UI.discColor(s.tipo_terapia)}" title="${UI.esc(s.tipo_terapia)}"></span>`;
    return `<div class="session${extraCls}" draggable="true"
      data-id="${s.id_sesion}"
      style="animation-delay:${idx * 30}ms;${extraStyle}"
      title="${UI.esc(s.nino_visible)} · ${UI.esc(s.tipo_terapia)} · ${UI.esc(ter?.nombre_visible || '—')} · ${UI.esc(s.hora_inicio)}–${UI.esc(s.hora_fin)}">
      <div class="session-name"><span class="session-name-txt">${nombre}${UI.badgeIntensivo(nino)}</span><span class="ter mono">${dot}${UI.esc(ter?.abreviacion || '—')}</span></div>
      <div class="session-sub">${sub}</div>
    </div>`;
  },

  _posLineaAhora(bloques) {
    // Encontrar entre qué dos bloques cae la hora actual y devolver px desde top del grid
    // Aproximación: cada fila tiene altura igual; calculamos índice fraccional.
    // No se renderiza si fuera del rango.
    const horaDec = (h) => {
      const [hh, mm] = h.split(':').map(Number);
      return hh + mm / 60;
    };
    let idxFrac = -1;
    for (let i = 0; i < bloques.length; i++) {
      const ini = horaDec(bloques[i].hora_inicio);
      const fin = horaDec(bloques[i].hora_fin);
      if (HOY_HORA >= ini && HOY_HORA <= fin) {
        idxFrac = i + (HOY_HORA - ini) / (fin - ini);
        break;
      }
      if (HOY_HORA < ini && i > 0) {
        idxFrac = i;
        break;
      }
    }
    if (idxFrac < 0) return null;
    // Fila header (~50px) + rows: la altura real se mide después de render
    // Aproximamos: header 51 + cada row ~56px
    return 51 + idxFrac * 56;
  },

  _wire() {
    // KPI conflicto expandible
    const kpiConf = document.getElementById('kpiConflict');
    if (kpiConf?.classList.contains('kpi-clickable')) {
      kpiConf.addEventListener('click', (e) => {
        if (e.target.closest('.conflict-jump') || e.target.closest('.conflict-row')) return;
        kpiConf.classList.toggle('open');
      });
      document.querySelectorAll('.conflict-row').forEach(row => {
        row.addEventListener('click', () => {
          const id = row.dataset.id;
          const target = document.querySelector(`#calendar .session[data-id="${id}"]`);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('flash');
            setTimeout(() => target.classList.remove('flash'), 1800);
          }
        });
      });
      // Botón "Mover a ..." — resuelve el conflicto en un clic
      document.querySelectorAll('.conflict-mover').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const s = State.data.sesiones.find(x => x.id_sesion === btn.dataset.id);
          if (!s) return;
          const b = Data.bloque(btn.dataset.bloque);
          s.fecha = btn.dataset.fecha;
          s.dia_semana = btn.dataset.dia;
          s.id_bloque = btn.dataset.bloque;
          if (b) { s.hora_inicio = b.hora_inicio; s.hora_fin = b.hora_fin; }
          this._revaluarConflictos();
          UI.toast(`${s.nino_visible} movido · conflicto resuelto`, 'success');
          this.render();
        });
      });
    }

    // Botón hoy / nav semana
    document.getElementById('todayBtn')?.addEventListener('click', () => {
      if (this.view === 'dia') this.dayDate = HOY_ISO;
      else if (this.view === 'mes') this.monthAnchor = HOY_ISO;
      else State.weekStart = '2026-05-11';
      this.render();
    });
    document.getElementById('navPrev')?.addEventListener('click', () => this._nav(-1));
    document.getElementById('navNext')?.addEventListener('click', () => this._nav(1));
    document.querySelectorAll('.view-switch .view-btn').forEach(b => {
      b.addEventListener('click', () => { this.view = b.dataset.view; this.render(); });
    });
    document.querySelectorAll('.cal-mes-cell').forEach(c => {
      c.addEventListener('click', () => {
        this.view = 'dia';
        this.dayDate = c.dataset.fecha;
        this.render();
      });
    });

    // Chips de filtro
    document.querySelectorAll('.cal-toolbar [data-prog]').forEach(b => {
      b.addEventListener('click', () => {
        State.filterPrograma = b.dataset.prog;
        this.render();
      });
    });

    // Filtro por niño (coordinación)
    document.getElementById('calFiltroNino')?.addEventListener('change', (e) => {
      State.filterNino = e.target.value;
      this.render();
    });

    // Sesiones: click + drag
    document.querySelectorAll('#calendar .session').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const s = State.data.sesiones.find(x => x.id_sesion === el.dataset.id);
        if (!s) return;
        if (s.tipo_actividad === 'Reunión de equipo') {
          UI.toast('Reunión de equipo · martes 08:00 a 08:35 · todo el equipo', 'info');
          return;
        }
        Panel.open(s);
      });
      el.addEventListener('dragstart', (e) => {
        Calendar._dragId = el.dataset.id;
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        document.querySelectorAll('.drag-over, .drag-over-conflict').forEach(c => c.classList.remove('drag-over', 'drag-over-conflict'));
        Calendar._dragId = null;
      });
    });

    // Detecta conflicto REAL: misma sala o mismo terapeuta en el mismo (fecha, bloque)
    const detectarConflicto = (cell, sesion) => {
      if (!sesion) return null;
      const fecha = cell.dataset.fecha;
      const idBloque = cell.dataset.bloque;
      const b = Data.bloque(idBloque);
      if (b && b.es_reunion_equipo) return `El bloque ${b.hora_inicio} está reservado para reuniones de equipo`;
      if ((State.data.meta?.feriados || []).includes(fecha)) return 'Ese día es feriado';
      const otras = State.data.sesiones.filter(s => s.fecha === fecha && s.id_bloque === idBloque && s.id_sesion !== sesion.id_sesion);
      if (otras.some(s => s.id_sala === sesion.id_sala)) return 'Sala ' + sesion.sala_nombre + ' ya está usada en ese bloque';
      if (otras.some(s => s.id_terapeuta === sesion.id_terapeuta)) return 'El terapeuta ya tiene otra sesión en ese bloque';
      if (sesion.id_terapeuta_secundario && otras.some(s => s.id_terapeuta === sesion.id_terapeuta_secundario || s.id_terapeuta_secundario === sesion.id_terapeuta_secundario)) return 'Terapeuta secundario duplicado';
      return null;
    };

    // Celdas: drop + click vacío
    document.querySelectorAll('#calendar .cal-cell').forEach(cell => {
      cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        const id = Calendar._dragId;
        const sesion = id ? State.data.sesiones.find(s => s.id_sesion === id) : null;
        if (sesion && detectarConflicto(cell, sesion)) cell.classList.add('drag-over-conflict');
        else cell.classList.add('drag-over');
      });
      cell.addEventListener('dragleave', () => cell.classList.remove('drag-over', 'drag-over-conflict'));
      cell.addEventListener('drop', (e) => {
        e.preventDefault();
        cell.classList.remove('drag-over', 'drag-over-conflict');
        const id = Calendar._dragId;
        if (!id) return;
        const sesion = State.data.sesiones.find(s => s.id_sesion === id);
        if (!sesion) return;
        const conf = detectarConflicto(cell, sesion);
        if (conf) {
          UI.toast('⚠ ' + conf, 'alert');
          return;
        }
        sesion.fecha = cell.dataset.fecha;
        sesion.dia_semana = cell.dataset.dia;
        sesion.id_bloque = cell.dataset.bloque;
        const b = Data.bloque(sesion.id_bloque);
        if (b) { sesion.hora_inicio = b.hora_inicio; sesion.hora_fin = b.hora_fin; }
        UI.toast(`${sesion.nino_visible} movido a ${DIAS_ABBR[DIAS.indexOf(sesion.dia_semana)] || sesion.dia_semana} · ${sesion.hora_inicio}`, 'success');
        this.render();
      });
      cell.addEventListener('click', (e) => {
        if (e.target.closest('.session')) return;
        if (cell.querySelector('.session')) return;
        if (cell.classList.contains('cal-feriado')) return;
        const b = Data.bloque(cell.dataset.bloque);
        if (b && b.es_reunion_equipo) { UI.toast(`El bloque ${b.hora_inicio} está reservado para reuniones de equipo`, 'alert'); return; }
        Modal.openCreate({ dia: cell.dataset.dia, id_bloque: cell.dataset.bloque, fecha: cell.dataset.fecha });
      });
    });
  },

  _nav(dir) {
    if (this.view === 'dia') {
      const f = this.dayDate || HOY_ISO;
      const [y, m, d] = f.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      do { dt.setUTCDate(dt.getUTCDate() + dir); } while (((dt.getUTCDay() + 6) % 7) > 4);
      this.dayDate = dt.toISOString().slice(0, 10);
    } else if (this.view === 'mes') {
      const a = this.monthAnchor || State.weekStart;
      const [y, m] = a.split('-').map(Number);
      this.monthAnchor = new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10);
    } else {
      const [y, m, d] = State.weekStart.split('-').map(Number);
      State.weekStart = new Date(Date.UTC(y, m - 1, d + dir * 7)).toISOString().slice(0, 10);
    }
    this.render();
  },
};
