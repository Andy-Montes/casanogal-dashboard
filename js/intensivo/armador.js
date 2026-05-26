// Módulo Armador de Horarios — Programa Intensivo
// Vista calendario mensual (6 semanas × 6 días). Usa el motor en scheduler.js.
const Armador = {
  _cache: null,
  _resultado: null,
  _resultadoReal: null,         // horario real de Trini (sheet RESUMEN)
  _fuente: 'generado',          // 'generado' | 'real'
  _semilla: 1,
  _filtroNino: -1,              // -1 = todos los niños, 0..N = índice del niño
  _filtroSemana: -1,            // -1 = todas las semanas, 0..5 = una semana
  _terapeutaResaltado: null,
  _bannerCerrado: false,
  _kidsSlotsPorSemana: null,

  KEY_BANNER: 'casanogal_armador_banner',
  KEY_TOUR: 'casanogal_armador_tour',
  KEY_FUENTE: 'casanogal_armador_fuente',

  async _cargar() {
    if (this._cache) return this._cache;
    const [intensivo, catalogo, disponibilidad, salasCapacidad, real] = await Promise.all([
      fetch('data/intensivos/int40.json').then(r => r.json()),
      fetch('data/intensivos/catalogo.json').then(r => r.json()),
      fetch('data/intensivos/disponibilidad.json').then(r => r.json()),
      fetch('data/intensivos/salas_capacidad.json').then(r => r.json()),
      fetch('data/intensivos/int40_real.json').then(r => r.json()).catch(() => null),
    ]);
    this._cache = { intensivo, catalogo, disponibilidad, salasCapacidad };
    this._resultadoReal = real;
    this._bannerCerrado = localStorage.getItem(this.KEY_BANNER) === '1';
    const fuenteGuardada = localStorage.getItem(this.KEY_FUENTE);
    if (fuenteGuardada === 'real' || fuenteGuardada === 'generado') this._fuente = fuenteGuardada;
    return this._cache;
  },

  // Devuelve el resultado activo según _fuente
  _resultadoActivo() {
    return this._fuente === 'real' && this._resultadoReal
      ? this._resultadoReal
      : this._resultado;
  },

  async render() {
    const main = document.getElementById('main');
    main.innerHTML = `<div class="empty-state"><div class="empty-state-title">Cargando armador…</div></div>`;
    let data;
    try { data = await this._cargar(); }
    catch (e) {
      main.innerHTML = `<div class="empty-state"><div class="empty-state-title">No se pudo cargar la data del intensivo</div><div>${UI.esc(e.message)}</div></div>`;
      return;
    }
    if (!this._resultado) this._generar();
    main.innerHTML = this._html(data);
    this._wire();

    if (!localStorage.getItem(this.KEY_TOUR)) {
      setTimeout(() => this._abrirTour(), 400);
    }
  },

  _generar() {
    const { intensivo, catalogo, disponibilidad, salasCapacidad } = this._cache;
    this._resultado = Scheduler.generar(intensivo, catalogo, {
      semilla: this._semilla,
      disponibilidad,
      salasCapacidad,
    });
    this._kidsSlotsPorSemana = this._computarKidsSlots(this._resultado);
  },

  _computarKidsSlots(res) {
    const map = new Map();
    res.semanas?.forEach((sem, si) => {
      const set = new Set();
      const N = sem.grid.length;
      const slots = sem.grid[0]?.length || 0;
      for (let s = 0; s < slots; s++) {
        let count = 0;
        for (let n = 0; n < N; n++) {
          if (sem.grid[n][s] === 'GP') {
            count++;
            if (count > 1) { set.add(s); break; }
          }
        }
      }
      map.set(si, set);
    });
    return map;
  },

  _cumplimientoAgregado() {
    const { intensivo } = this._cache;
    const res = this._resultadoActivo();
    const incompletos = [];
    let cumplidoT = 0, esperadoT = 0;
    intensivo.niños.forEach((n, ni) => {
      let cumplido = 0, esperado = 0;
      res.semanas?.forEach((sem) => {
        const conteo = {};
        sem.grid[ni].forEach((sig) => { if (sig) conteo[sig] = (conteo[sig] || 0) + 1; });
        n.asignaciones.forEach((a) => {
          if (a.rol === 'PAPAS') return;
          let real = conteo[a.sigla] || 0;
          if (a.sigla === 'GP') real -= (n.kids_semanal || 0);
          cumplido += Math.min(real, a.sesiones);
          esperado += a.sesiones;
        });
      });
      cumplidoT += cumplido;
      esperadoT += esperado;
      const pct = esperado ? Math.round((cumplido / esperado) * 100) : 100;
      if (pct < 100) incompletos.push({ niño: n.nombre, pct, faltan: esperado - cumplido });
    });
    return {
      incompletos,
      totalPct: esperadoT ? Math.round((cumplidoT / esperadoT) * 100) : 100,
    };
  },

  _fechaSemana(si) {
    const { intensivo } = this._cache;
    const base = new Date(intensivo.fecha_inicio + 'T00:00:00');
    base.setDate(base.getDate() + si * 7);
    return base;
  },

  // ===== Render =====
  _html(data) {
    const { intensivo, catalogo } = data;
    const res = this._resultadoActivo();
    const agg = this._cumplimientoAgregado();
    // Re-computar kidsSlots para la fuente activa
    this._kidsSlotsPorSemana = this._computarKidsSlots(res);

    return `
      ${this._heroHtml(intensivo, agg, res)}
      ${this._bannerCerrado ? '' : this._bannerHtml()}
      ${this._toolbarHtml(intensivo)}
      <div class="armador-layout">
        <div class="armador-calendar-wrap">
          ${this._calendarioHtml(intensivo, catalogo)}
        </div>
        <aside class="armador-side">
          ${this._equipoHtml(catalogo)}
          ${this._cumplimientoHtml(intensivo, agg)}
          ${res.conflictos?.length ? this._conflictosHtml(res.conflictos) : ''}
        </aside>
      </div>
    `;
  },

  _heroHtml(intensivo, agg, res) {
    let titulo, subtitulo, badgeClass, badgeIcon, badgeText;
    const totalSes = res.semanas?.reduce((sum, s) => sum + s.sesionesPlanificadas, 0) || 0;
    const esReal = this._fuente === 'real';

    if (esReal) {
      titulo = 'Horario real de Trini';
      subtitulo = `Este es el horario que Trini armó a mano en el Excel. ${intensivo.niños.length} niños · ${totalSes} sesiones por semana · base que se repite en las ${intensivo.semanas} semanas.`;
      badgeClass = 'ok'; badgeIcon = this._icons.check;
      badgeText = 'Fuente: Excel original';
    } else if (!res.ok) {
      titulo = 'El horario tiene conflictos sin resolver';
      subtitulo = `El sistema no pudo asignar todas las sesiones. Revisa el detalle a la derecha y prueba otra distribución.`;
      badgeClass = 'ko'; badgeIcon = this._icons.alert;
      badgeText = `${res.conflictos?.length || 0} conflicto${res.conflictos?.length === 1 ? '' : 's'}`;
    } else if (agg.incompletos.length === 0) {
      titulo = 'Horario generado por el sistema';
      subtitulo = `Distribución calculada automáticamente con los inputs reales del INT 40. ${intensivo.niños.length} niños · ${totalSes} sesiones · sin choques de terapeuta ni sala.`;
      badgeClass = 'ok'; badgeIcon = this._icons.ok;
      badgeText = 'Completo · 100%';
    } else {
      titulo = `${agg.incompletos.length} niño${agg.incompletos.length === 1 ? '' : 's'} sin horario completo`;
      subtitulo = `Faltan sesiones por asignar a: ${agg.incompletos.map(i => i.niño).join(', ')}. Prueba regenerar o revisa la disponibilidad.`;
      badgeClass = 'warn'; badgeIcon = this._icons.warn;
      badgeText = `${agg.totalPct}% cumplido`;
    }

    const tieneReal = !!this._resultadoReal;

    return `
      <div class="armador-hero">
        <div class="armador-hero-info">
          <div class="armador-eyebrow">Cohorte ${UI.esc(intensivo.id)} · ${intensivo.fecha_inicio} → ${intensivo.fecha_fin}</div>
          <h2 class="armador-title">${titulo}</h2>
          <p class="armador-subtitle">${subtitulo}</p>
        </div>
        <div class="armador-hero-cta">
          ${tieneReal ? `
            <div class="armador-fuente-toggle" role="tablist" aria-label="Fuente del horario">
              <button class="armador-fuente-btn ${esReal ? 'active' : ''}" data-fuente="real" role="tab" title="Mostrar el horario que Trini armó a mano">
                ${this._icons.user}<span>Real</span>
              </button>
              <button class="armador-fuente-btn ${!esReal ? 'active' : ''}" data-fuente="generado" role="tab" title="Mostrar el horario generado por el motor">
                ${this._icons.cpu}<span>Generado</span>
              </button>
            </div>
          ` : ''}
          <span class="armador-badge ${badgeClass}">${badgeIcon}${badgeText}</span>
          ${!esReal ? `
            <button class="btn btn-primary" id="armadorRegenBtn" title="Generar otra distribución del horario">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              Regenerar
            </button>
          ` : ''}
          <button class="btn btn-ghost" id="armadorExportBtn" title="Bajar el horario como PDF por niño">
            ${this._icons.pdf}Exportar PDF
          </button>
        </div>
      </div>
    `;
  },

  _bannerHtml() {
    return `
      <div class="armador-banner" id="armadorBanner">
        <div class="armador-banner-icon">${this._icons.info}</div>
        <div class="armador-banner-body">
          <b>¿Qué es esta página?</b>
          Acá se arma automáticamente el horario semanal del programa intensivo. El calendario muestra las 6 semanas completas con todas las sesiones de los niños.
          Filtra por niño para ver solo el horario de uno. Click en cualquier sigla para resaltar al terapeuta en todo el calendario.
          Cuando estés conforme, exporta el PDF por niño y mándalo a la familia.
        </div>
        <button class="armador-banner-close" id="armadorBannerClose" aria-label="Cerrar">×</button>
      </div>
    `;
  },

  _toolbarHtml(intensivo) {
    const opcionesNino = `<option value="-1">Todos los niños</option>` +
      intensivo.niños.map((n, i) => `<option value="${i}" ${this._filtroNino === i ? 'selected' : ''}>${UI.esc(n.nombre)}</option>`).join('');
    const opcionesSem = `<option value="-1">Todas las 6 semanas</option>` +
      Array.from({ length: intensivo.semanas }, (_, i) => `<option value="${i}" ${this._filtroSemana === i ? 'selected' : ''}>Semana ${i + 1}</option>`).join('');

    return `
      <div class="armador-toolbar">
        <div class="armador-toolbar-left">
          <label class="armador-select">
            <span class="armador-select-label">Ver niño:</span>
            <select id="armadorFiltroNino">${opcionesNino}</select>
          </label>
          <label class="armador-select">
            <span class="armador-select-label">Ver:</span>
            <select id="armadorFiltroSem">${opcionesSem}</select>
          </label>
        </div>
        ${this._terapeutaResaltado ? `
          <button class="armador-pill-clear" id="armadorClearResaltado" title="Quitar el resaltado del terapeuta">
            Resaltando <b>${this._terapeutaResaltado}</b> · quitar ×
          </button>
        ` : ''}
      </div>
    `;
  },

  // Calendario mensual: filas = semanas, columnas = días
  _calendarioHtml(intensivo, catalogo) {
    const { dias, franjas } = catalogo;
    const F = franjas.length;
    const semanas = this._resultadoActivo().semanas || [];
    const semsAMostrar = this._filtroSemana === -1
      ? semanas.map((sem, si) => ({ sem, si }))
      : [{ sem: semanas[this._filtroSemana], si: this._filtroSemana }];
    const diaLabels = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb' };
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const inicialNino = (nombre) => nombre.charAt(0).toUpperCase() + (nombre.charAt(1)?.toLowerCase() || '');

    // Header con días (compartido para todas las filas)
    const headerDias = `
      <div class="armador-cal-header">
        <div class="armador-cal-header-sem"></div>
        ${dias.map(d => `<div class="armador-cal-header-dia">${diaLabels[d]}</div>`).join('')}
      </div>
    `;

    const filas = semsAMostrar.map(({ sem, si }) => {
      const inicioSem = this._fechaSemana(si);
      const kidsSet = this._kidsSlotsPorSemana?.get(si) || new Set();

      const celdas = dias.map((d, di) => {
        const fechaDia = new Date(inicioSem);
        fechaDia.setDate(inicioSem.getDate() + di);
        const labelFecha = `${fechaDia.getDate()} ${meses[fechaDia.getMonth()]}`;

        // Recolectar sesiones del día (filtradas por niño si aplica)
        const sesiones = [];
        const niñosAMostrar = this._filtroNino === -1
          ? intensivo.niños.map((n, ni) => ({ n, ni }))
          : [{ n: intensivo.niños[this._filtroNino], ni: this._filtroNino }];

        niñosAMostrar.forEach(({ n, ni }) => {
          sem.grid[ni].forEach((sig, slotIdx) => {
            if (!sig) return;
            const dia = Math.floor(slotIdx / F);
            if (dia !== di) return;
            const franja = slotIdx % F;
            const esKids = sig === 'GP' && kidsSet.has(slotIdx);
            // Si esKids y todos los niños están visibles, agregar UNA sola vez (no 6 veces)
            if (esKids && this._filtroNino === -1 && ni !== 0) return;
            sesiones.push({
              sig, hora: franjas[franja].split('-')[0],
              niño: n.nombre, niInicial: inicialNino(n.nombre),
              disc: catalogo.terapeutas[sig]?.disciplina,
              esKids,
              slotIdx,
              terapeutaNombre: catalogo.terapeutas[sig]?.nombre || sig,
              sala: catalogo.terapeutas[sig]?.sala || '',
            });
          });
        });
        sesiones.sort((a, b) => a.hora.localeCompare(b.hora));

        const bloques = sesiones.length
          ? sesiones.map(s => this._bloqueHtml(s)).join('')
          : `<div class="armador-cal-empty">Sin sesiones</div>`;

        return `
          <div class="armador-cal-day">
            <div class="armador-cal-day-head">
              <span class="armador-cal-day-name">${diaLabels[d]}</span>
              <span class="armador-cal-day-date">${labelFecha}</span>
            </div>
            <div class="armador-cal-day-body">${bloques}</div>
          </div>
        `;
      }).join('');

      return `
        <div class="armador-cal-week">
          <div class="armador-cal-sem-label">SEM ${si + 1}</div>
          ${celdas}
        </div>
      `;
    }).join('');

    return `
      <div class="armador-calendar">
        ${headerDias}
        ${filas}
      </div>
    `;
  },

  _bloqueHtml(s) {
    const token = this._disciplinaToken(s.esKids ? 'HAB AD' : s.disc);
    const titulo = s.esKids
      ? `Sesión grupal KIDS · ${s.hora}\nTodos los niños del intensivo`
      : `${s.sig} · ${s.terapeutaNombre}\n${s.disc} · sala ${s.sala}\n${s.hora} · ${s.niño}`;
    const resaltado = this._terapeutaResaltado === s.sig ? ' is-resaltado' : '';
    const atenuado = this._terapeutaResaltado && this._terapeutaResaltado !== s.sig ? ' is-atenuado' : '';
    const labelSig = s.esKids ? 'KIDS' : s.sig;
    const labelNino = (this._filtroNino === -1 && !s.esKids) ? `<span class="armador-cal-block-nino">${UI.esc(s.niInicial)}</span>` : '';
    return `
      <button class="armador-cal-block${resaltado}${atenuado}" data-sigla="${UI.esc(s.sig)}" style="background:var(--${token}-bg);color:var(--${token}-text);border-left-color:var(--${token})" title="${UI.esc(titulo)}">
        <span class="armador-cal-block-time">${UI.esc(s.hora)}</span>
        <span class="armador-cal-block-sigla">${UI.esc(labelSig)}</span>
        ${labelNino}
      </button>
    `;
  },

  _equipoHtml(catalogo) {
    const disciplinas = {};
    Object.entries(catalogo.terapeutas).forEach(([sigla, t]) => {
      const token = this._disciplinaToken(t.disciplina);
      const key = `${t.disciplina}__${token}`;
      if (!disciplinas[key]) disciplinas[key] = { nombre: t.disciplina, token, items: [] };
      disciplinas[key].items.push({ sigla, nombre: t.nombre, sala: t.sala });
    });
    const grupos = Object.values(disciplinas)
      .sort((a, b) => b.items.length - a.items.length)
      .map(g => `
        <div class="armador-equipo-grupo">
          <div class="armador-equipo-disc" style="color:var(--${g.token}-text);background:var(--${g.token}-bg)">
            ${UI.esc(g.nombre)} · ${g.items.length}
          </div>
          <div class="armador-equipo-items">
            ${g.items.map(item => `
              <button class="armador-equipo-pill${this._terapeutaResaltado === item.sigla ? ' active' : ''}" data-sigla="${UI.esc(item.sigla)}" title="${UI.esc(item.nombre)} · sala ${UI.esc(item.sala)}">
                <span class="armador-equipo-sigla">${UI.esc(item.sigla)}</span>
                <span class="armador-equipo-nombre">${UI.esc(item.nombre)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `).join('');

    return `
      <div class="armador-card">
        <div class="armador-card-head">${this._icons.team}Equipo · ${Object.keys(catalogo.terapeutas).length} terapeutas</div>
        <div class="armador-card-body armador-equipo-body">${grupos}</div>
      </div>
    `;
  },

  _cumplimientoHtml(intensivo, agg) {
    const res = this._resultadoActivo();
    const rows = intensivo.niños.map((n, ni) => {
      let cumplido = 0, esperado = 0, kids = 0;
      res.semanas?.forEach((sem) => {
        const conteo = {};
        sem.grid[ni].forEach((sig) => { if (sig) conteo[sig] = (conteo[sig] || 0) + 1; });
        n.asignaciones.forEach((a) => {
          if (a.rol === 'PAPAS') return;
          let real = conteo[a.sigla] || 0;
          if (a.sigla === 'GP') real -= (n.kids_semanal || 0);
          cumplido += Math.min(real, a.sesiones);
          esperado += a.sesiones;
        });
        kids += (n.kids_semanal || 0);
      });
      const pct = esperado ? Math.round((cumplido / esperado) * 100) : 100;
      const cls = pct === 100 ? 'ok' : pct >= 80 ? 'warn' : 'ko';
      const activo = this._filtroNino === ni ? ' is-active' : '';
      return `
        <button class="armador-cumpl-row${activo}" data-ni="${ni}">
          <div class="armador-cumpl-head">
            <span class="armador-cumpl-name">${UI.esc(n.nombre)}</span>
            <span class="armador-cumpl-pct ${cls}">${pct}%</span>
          </div>
          <div class="armador-cumpl-meta">${cumplido}/${esperado} individuales · ${kids} en KIDS</div>
          <div class="armador-cumpl-bar"><div class="armador-cumpl-fill ${cls}" style="width:${pct}%"></div></div>
        </button>
      `;
    }).join('');
    const titulo = agg.incompletos.length
      ? `Cumplimiento · <span style="color:var(--alert)">${agg.incompletos.length} incompleto${agg.incompletos.length === 1 ? '' : 's'}</span>`
      : `Cumplimiento · <span style="color:var(--success)">todos al 100%</span>`;
    return `
      <div class="armador-card">
        <div class="armador-card-head">${this._icons.check}${titulo}</div>
        <div class="armador-card-body">${rows}</div>
      </div>
    `;
  },

  _conflictosHtml(conflictos) {
    const groups = {};
    conflictos.forEach((c) => { (groups[c.tipo] = groups[c.tipo] || []).push(c); });
    const html = Object.entries(groups).map(([tipo, items]) => `
      <div class="armador-conflicto-grupo">
        <div class="armador-conflicto-tipo">${UI.esc(tipo)} · ${items.length}</div>
        <ul>${items.slice(0, 5).map(c => `<li>${UI.esc(c.mensaje)}</li>`).join('')}</ul>
        ${items.length > 5 ? `<div class="armador-conflicto-mas">+${items.length - 5} más</div>` : ''}
      </div>
    `).join('');
    return `
      <div class="armador-card alert">
        <div class="armador-card-head">${this._icons.alert}Conflictos sin resolver</div>
        <div class="armador-card-body">
          ${html}
          <div class="armador-conflicto-cta">
            <p>El motor no pudo asignar estas sesiones. Prueba otra distribución o revisa la disponibilidad.</p>
            <button class="btn btn-secondary btn-sm" id="armadorRegenInlineBtn">Intentar otra distribución</button>
          </div>
        </div>
      </div>
    `;
  },

  _disciplinaToken(disc) {
    if (!disc) return 'to';
    const d = disc.toUpperCase();
    if (d === 'TO') return 'to';
    if (d === 'FONO') return 'fono';
    if (d.startsWith('COG') || d === 'ED COG' || d === 'F.EJEC') return 'cog';
    if (d === 'KINE') return 'kine';
    if (d.startsWith('PSI')) return 'psico';
    if (d === 'RDI') return 'rdi';
    if (d === 'HAB AD') return 'kids';
    return 'to';
  },

  // ===== Interacción =====
  _wire() {
    const regenerar = () => {
      this._semilla = Math.floor(Math.random() * 100000);
      this._generar();
      this.render();
      UI.toast(this._resultado.ok ? 'Horario regenerado' : 'Generado con conflictos', this._resultado.ok ? 'success' : 'warning');
    };
    document.getElementById('armadorRegenBtn')?.addEventListener('click', regenerar);
    document.getElementById('armadorRegenInlineBtn')?.addEventListener('click', regenerar);

    document.getElementById('armadorExportBtn')?.addEventListener('click', () => this._exportPDF());

    // Toggle fuente real/generado
    document.querySelectorAll('.armador-fuente-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const f = btn.dataset.fuente;
        if (f === this._fuente) return;
        this._fuente = f;
        localStorage.setItem(this.KEY_FUENTE, f);
        this.render();
        UI.toast(f === 'real' ? 'Mostrando el horario real de Trini' : 'Mostrando el horario generado por el motor', 'success');
      });
    });

    document.getElementById('armadorBannerClose')?.addEventListener('click', () => {
      localStorage.setItem(this.KEY_BANNER, '1');
      this._bannerCerrado = true;
      document.getElementById('armadorBanner')?.remove();
    });

    document.getElementById('armadorFiltroNino')?.addEventListener('change', (e) => {
      this._filtroNino = parseInt(e.target.value, 10);
      this.render();
    });
    document.getElementById('armadorFiltroSem')?.addEventListener('change', (e) => {
      this._filtroSemana = parseInt(e.target.value, 10);
      this.render();
    });

    const resaltar = (sigla) => {
      this._terapeutaResaltado = this._terapeutaResaltado === sigla ? null : sigla;
      this.render();
    };
    document.querySelectorAll('.armador-cal-block[data-sigla]').forEach(btn => {
      btn.addEventListener('click', () => resaltar(btn.dataset.sigla));
    });
    document.querySelectorAll('.armador-equipo-pill').forEach(btn => {
      btn.addEventListener('click', () => resaltar(btn.dataset.sigla));
    });
    document.getElementById('armadorClearResaltado')?.addEventListener('click', () => {
      this._terapeutaResaltado = null;
      this.render();
    });

    // Click en fila de cumplimiento = filtrar por ese niño
    document.querySelectorAll('.armador-cumpl-row[data-ni]').forEach(row => {
      row.addEventListener('click', () => {
        const ni = parseInt(row.dataset.ni, 10);
        this._filtroNino = (this._filtroNino === ni) ? -1 : ni;
        this.render();
      });
    });
  },

  _exportPDF() {
    const { intensivo, catalogo } = this._cache;
    const semanas = this._resultadoActivo().semanas || [];
    if (!semanas.length) { UI.toast('Nada que exportar', 'error'); return; }

    // Si hay un niño filtrado → exportar directo
    if (this._filtroNino !== -1) {
      this._imprimirPDF(this._filtroNino, intensivo, semanas, catalogo);
      return;
    }
    // Si no, abrir selector
    this._abrirSelectorPDF(intensivo, semanas, catalogo);
  },

  _abrirSelectorPDF(intensivo, semanas, catalogo) {
    const overlay = document.createElement('div');
    overlay.className = 'pendiente-modal-overlay';
    overlay.id = 'armadorPdfOverlay';
    overlay.innerHTML = `
      <div class="pendiente-modal" style="width:min(420px,92vw)">
        <div class="pendiente-modal-head">
          ${this._icons.pdf}
          <div>
            <div class="pendiente-modal-title">Exportar PDF</div>
            <div class="pendiente-modal-eyebrow">Elige el niño cuyo horario quieres bajar</div>
          </div>
          <button class="panel-close" id="armadorPdfClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="pendiente-modal-body" style="max-height:50vh;overflow-y:auto;padding:8px 12px">
          <div class="ter-selector-list">
            ${intensivo.niños.map((n, i) => `
              <button class="ter-selector-row" data-ni="${i}">
                <span class="equipo-avatar" style="background:var(--cn-azul-bg);color:var(--cn-azul-deep)">${UI.esc(n.nombre.charAt(0))}</span>
                <div style="flex:1;text-align:left">
                  <div style="font-weight:600">${UI.esc(n.nombre)}</div>
                  <div style="font-size:11px;color:var(--text-3)">${n.encargado ? 'Encargado: ' + UI.esc(n.encargado) : 'Intensivo'}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const cerrar = () => overlay.remove();
    document.getElementById('armadorPdfClose').addEventListener('click', cerrar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
    overlay.querySelectorAll('.ter-selector-row').forEach(row => {
      row.addEventListener('click', () => {
        const ni = parseInt(row.dataset.ni, 10);
        cerrar();
        this._imprimirPDF(ni, intensivo, semanas, catalogo);
      });
    });
  },

  _imprimirPDF(ninoIdx, intensivo, semanas, catalogo) {
    const ok = PDFArmador.render(ninoIdx, intensivo, semanas, catalogo);
    if (!ok) { UI.toast('No se pudo generar el PDF', 'error'); return; }
    document.body.classList.add('printing-padres');
    UI.toast('Preparando PDF del horario', 'success');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing-padres');
        PDFArmador.cleanup();
      }, 800);
    }, 250);
  },

  // ===== Tour =====
  _abrirTour() {
    const steps = [
      {
        title: 'Armador de Horarios',
        body: 'Esta página arma el horario completo del programa intensivo en segundos. Antes lo hacías a mano en Excel — acá el sistema lo distribuye solo y te avisa si hay choques.<br><br>Te muestro lo principal en 4 pasos.',
      },
      {
        target: '.armador-hero',
        position: 'below',
        title: 'Estado del horario',
        body: 'Arriba ves de un vistazo si el horario está <b>completo</b>, <b>incompleto</b> o con <b>conflictos</b>. El texto explica qué pasa y qué hacer.',
      },
      {
        target: '#armadorFiltroNino',
        position: 'below',
        title: 'Filtrar por niño',
        body: 'Por defecto ves a <b>todos los niños</b> juntos en el calendario. Cambia el filtro para ver solo el horario de uno — queda mucho más limpio para revisar caso por caso.',
      },
      {
        target: '#armadorExportBtn',
        position: 'below',
        title: 'Exportar PDF',
        body: 'Cuando estés conforme, baja el <b>PDF por niño</b> con todo el horario de las 6 semanas y el equipo asignado. Está listo para mandar a la familia.',
      },
      {
        title: 'Listo',
        body: 'Ya conoces el armador. Si querés volver al recorrido, busca el link al pie del menú lateral.<br><br>El sistema recuerda si ya viste este tour — no aparece de nuevo.',
      },
    ];
    if (typeof Onboarding !== 'undefined') {
      Onboarding._run(steps, 0);
      localStorage.setItem(this.KEY_TOUR, '1');
    }
  },

  // ===== Iconos SVG =====
  _icons: {
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    pdf: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    cpu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="2" x2="9" y2="4"/><line x1="15" y1="2" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="22"/><line x1="15" y1="20" x2="15" y2="22"/><line x1="20" y1="9" x2="22" y2="9"/><line x1="20" y1="15" x2="22" y2="15"/><line x1="2" y1="9" x2="4" y2="9"/><line x1="2" y1="15" x2="4" y2="15"/></svg>',
  },
};
