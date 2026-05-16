// Módulo Calendario
const Calendar = {
  render() {
    const main = document.getElementById('main');
    const k = {
      ocup: Data.kpiOcupacion(),
      hoy: Data.kpiSesionesHoy(),
      salas: Data.kpiSalasActivas(),
      conf: Data.kpiConflictos(),
    };
    const semana = Data.sesionesSemana();
    const ninosSet = new Set(semana.map(s => s.id_nino));
    const terSet = new Set(semana.map(s => s.id_terapeuta));
    const salasSet = new Set(semana.map(s => s.id_sala));
    const conteo = Data.conteoPorPrograma();

    const eyebrow = State.role === 'coordinacion'
      ? 'Vista coordinación · Intensivo 40'
      : State.role === 'terapeuta'
      ? `Vista terapeuta · Krasna · TO`
      : `Vista padres · León A. · Intensivo s2`;

    main.innerHTML = `
      <section class="hero">
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
            <h1 class="hero-title">Semana del <span class="accent">${UI.fmtRangoSemana()}</span></h1>
            <div class="hero-meta">
              <div class="hero-meta-item">
                <span class="hero-meta-label">Sesiones</span>
                <span class="hero-meta-value">${semana.length}</span>
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
            <button class="hero-week-btn" id="weekPrev" aria-label="Semana anterior"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
            <span class="hero-week-label">Sem ${State.data.meta.semana_actual} de 6</span>
            <button class="hero-week-btn" id="weekNext" aria-label="Semana siguiente"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>
          </div>
        </div>
      </section>

      <div class="kpi-row">
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
                return `<div class="conflict-row" data-id="${s.id_sesion}">
                  <div class="conflict-row-head">
                    <b>${UI.esc(s.nino_visible)}</b> con <b>${UI.esc(ter?.nombre_visible || '—')}</b>
                  </div>
                  <div class="conflict-row-meta">
                    ${UI.esc(s.tipo_terapia)} · Sala ${UI.esc(s.sala_nombre)} · ${UI.esc(s.dia_semana)} ${UI.esc(s.hora_inicio)}<br>
                    <span class="conflict-reason">⚠ ${UI.esc(s.conflicto_detectado)}</span>
                  </div>
                  <button class="btn btn-secondary conflict-jump">Ir →</button>
                </div>`;
              }).join('')}
            </div>
          ` : ''}
        </div>
      </div>

      <div class="section-head">
        <div>
          <div class="section-title">Agenda semanal</div>
          <div class="section-sub">${semana.length} sesiones esta semana${k.conf.count ? ` · <b style="color:var(--alert)">${k.conf.count} conflicto${k.conf.count===1?'':'s'} detectado${k.conf.count===1?'':'s'}</b> automáticamente` : ''} · click en celda vacía para crear · drag para mover</div>
        </div>
        <div class="section-actions">
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
        <div class="tip">Tip: arrastra una sesión para moverla · <kbd>click</kbd> para abrir</div>
      </div>

      <div class="calendar" id="calendar">${this._renderGrid()}</div>

      <div class="legend">
        ${Object.entries(ESPECIALIDAD_VAR).map(([k,v]) => `
          <span class="legend-item"><span class="legend-swatch" style="background:${v.main}"></span>${UI.esc(k)}</span>
        `).join('')}
        <span class="legend-item"><span class="legend-swatch" style="background:var(--alert)"></span>Conflicto</span>
        <span class="legend-item"><span class="legend-swatch" style="background:linear-gradient(120deg,var(--to) 50%, var(--fono) 50%)"></span>Dupla intencional</span>
      </div>
    `;

    this._wire();
  },

  _descConflictos(list) {
    if (!list.length) return '';
    const s = list[0];
    const ter = Data.terapeuta(s.id_terapeuta);
    return `${ter?.nombre_visible || '—'} · ${s.sala_nombre} · ${s.dia_semana}`;
  },

  _renderGrid() {
    const fechas = fechasSemana();
    const hoyIdx = fechas.indexOf(HOY_ISO);
    const bloques = State.data.bloques_horarios.sort((a, b) => a.orden - b.orden);

    let html = '<div class="cal-grid">';
    // Header: corner + 5 días
    html += `<div class="cal-header-cell" style="border-left:none"></div>`;
    DIAS.forEach((d, i) => {
      const fecha = fechas[i];
      const dayNum = Number(fecha.slice(-2));
      const isToday = fecha === HOY_ISO;
      html += `<div class="cal-header-cell ${isToday?'today-col':''}">
        <div class="cal-day-name">${DIAS_ABBR[i]}</div>
        ${isToday ? `<div class="today-badge">${dayNum}</div>` : `<div class="cal-day-date">${dayNum}</div>`}
      </div>`;
    });

    // Filas: bloques
    bloques.forEach(b => {
      html += `<div class="cal-time">
        <span>${b.hora_inicio}</span>
        <span class="cal-time-period">${b.periodo === 'Mañana' ? 'AM' : 'PM'}</span>
      </div>`;
      DIAS.forEach((dia, i) => {
        const fecha = fechas[i];
        const sesiones = Data.sesionesPorDiaYBloque(fecha, b.id_bloque)
          .filter(s => this._matchPrograma(s));
        const isToday = i === hoyIdx;
        const cellCls = `cal-cell ${isToday?'today-col':''} ${sesiones.length===0?'empty':''}`;
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

  _matchPrograma(s) {
    if (State.filterPrograma === 'all') return true;
    return s.id_programa === 'PROG-' + State.filterPrograma;
  },

  _renderSesion(s, idx) {
    const ter = Data.terapeuta(s.id_terapeuta);
    const cls = ESPECIALIDAD_CLASS[s.tipo_terapia] || 's-to';
    const isConflict = !!s.conflicto_detectado;
    const isDupla = s.es_dupla;
    let extraCls = '';
    let extraStyle = '';
    let nombre = UI.esc(s.nino_visible);
    let sub = `${UI.esc(s.tipo_terapia)} · ${UI.esc(s.sala_nombre)}`;
    if (isConflict) extraCls += ' s-conflict';
    if (isDupla) {
      extraCls += ' s-dupla';
      const ninoSec = Data.nino(s.id_nino_secundario);
      const terSec = Data.terapeuta(s.id_terapeuta_secundario);
      // Bipartito: usa color de la especialidad principal y secundaria si la hay
      const c1 = ESPECIALIDAD_VAR[s.tipo_terapia];
      const c2 = terSec ? ESPECIALIDAD_VAR[terSec.especialidad] : ESPECIALIDAD_VAR['Fonoaudiología'];
      extraStyle = `--c1-bg:${c1.bg};--c2-bg:${c2?.bg || 'var(--fono-bg)'};color:${c1.text};border-left-color:${c1.main};`;
      if (ninoSec) nombre = `${UI.esc(s.nino_visible)} + ${UI.esc(ninoSec.nombre_visible)}`;
    }
    return `<div class="session ${cls}${extraCls}" draggable="true"
      data-id="${s.id_sesion}"
      style="animation-delay:${idx * 30}ms;${extraStyle}"
      title="${UI.esc(s.nino_visible)} · ${UI.esc(ter?.nombre_visible || '—')} · ${UI.esc(s.hora_inicio)}–${UI.esc(s.hora_fin)}">
      <div class="session-name">${nombre}<span class="ter mono">${UI.esc(ter?.abreviacion || '—')}</span></div>
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
    }

    // Botón hoy / nav semana
    document.getElementById('todayBtn')?.addEventListener('click', () => {
      State.weekStart = '2026-05-11';
      this.render();
    });
    document.getElementById('weekPrev')?.addEventListener('click', () => this._navWeek(-7));
    document.getElementById('weekNext')?.addEventListener('click', () => this._navWeek(7));

    // Chips de filtro
    document.querySelectorAll('.cal-toolbar [data-prog]').forEach(b => {
      b.addEventListener('click', () => {
        State.filterPrograma = b.dataset.prog;
        this.render();
      });
    });

    // Sesiones: click + drag
    document.querySelectorAll('#calendar .session').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const s = State.data.sesiones.find(x => x.id_sesion === el.dataset.id);
        if (s) Panel.open(s);
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

    // Helper: ¿hay otras sesiones en esa celda (según State, no DOM)?
    const cellOcupadaPorOtra = (cell, ownId) => {
      const fecha = cell.dataset.fecha;
      const idBloque = cell.dataset.bloque;
      return State.data.sesiones.some(s => s.fecha === fecha && s.id_bloque === idBloque && s.id_sesion !== ownId);
    };

    // Celdas: drop + click vacío
    document.querySelectorAll('#calendar .cal-cell').forEach(cell => {
      cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        const id = Calendar._dragId;
        if (cellOcupadaPorOtra(cell, id)) cell.classList.add('drag-over-conflict');
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
        if (cellOcupadaPorOtra(cell, id)) {
          UI.toast('⚠ Conflicto: el bloque ya está ocupado', 'alert');
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
        Modal.openCreate({ dia: cell.dataset.dia, id_bloque: cell.dataset.bloque, fecha: cell.dataset.fecha });
      });
    });
  },

  _navWeek(deltaDays) {
    const [y, m, d] = State.weekStart.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
    State.weekStart = dt.toISOString().slice(0, 10);
    this.render();
  },
};
