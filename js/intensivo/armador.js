// Módulo Armador de Horarios — Programa Intensivo
// Usa el motor en js/intensivo/scheduler.js (expuesto en window.Scheduler).
const Armador = {
  _cache: null,
  _resultado: null,
  _semilla: 1,
  _modo: '1sem',                // '1sem' | '6sem'
  _semanaActiva: 0,             // 0..5 (cuando _modo === '1sem')
  _terapeutaResaltado: null,    // sigla | null
  _bannerCerrado: false,
  _kidsSlotsPorSemana: null,    // Map<semIdx, Set<slotIdx>>

  KEY_BANNER: 'casanogal_armador_banner',
  KEY_TOUR: 'casanogal_armador_tour',

  // --- carga perezosa de los 4 JSON ---
  async _cargar() {
    if (this._cache) return this._cache;
    const [intensivo, catalogo, disponibilidad, salasCapacidad] = await Promise.all([
      fetch('data/intensivos/int40.json').then(r => r.json()),
      fetch('data/intensivos/catalogo.json').then(r => r.json()),
      fetch('data/intensivos/disponibilidad.json').then(r => r.json()),
      fetch('data/intensivos/salas_capacidad.json').then(r => r.json()),
    ]);
    this._cache = { intensivo, catalogo, disponibilidad, salasCapacidad };
    this._bannerCerrado = localStorage.getItem(this.KEY_BANNER) === '1';
    return this._cache;
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

    // Tour primera vez en este módulo
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
    const incompletos = [];
    let cumplidoT = 0, esperadoT = 0;
    intensivo.niños.forEach((n, ni) => {
      let cumplido = 0, esperado = 0;
      this._resultado.semanas?.forEach((sem) => {
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

  // Devuelve fecha "Lun 20 abr" para cada día visible de la semana activa
  _fechasSemana(semanaIdx) {
    const { intensivo, catalogo } = this._cache;
    const dias = catalogo.dias;
    const base = new Date(intensivo.fecha_inicio + 'T00:00:00');
    base.setDate(base.getDate() + semanaIdx * 7);
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const labels = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb' };
    return dias.map((d, i) => {
      const fecha = new Date(base);
      fecha.setDate(base.getDate() + i);
      return `${labels[d]} ${fecha.getDate()} ${meses[fecha.getMonth()]}`;
    });
  },

  // ===== Render HTML =====
  _html(data) {
    const { intensivo, catalogo } = data;
    const res = this._resultado;
    const agg = this._cumplimientoAgregado();

    return `
      ${this._heroHtml(intensivo, agg, res)}
      ${this._bannerCerrado ? '' : this._bannerHtml()}
      ${this._toolbarHtml(intensivo)}
      <div class="armador-layout">
        <div class="armador-grid-wrap">
          ${this._gridHtml(intensivo, catalogo)}
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
    // Resumen narrativo: una frase clara en lenguaje natural
    let titulo, subtitulo, badgeClass, badgeIcon, badgeText;
    const totalSes = res.semanas?.reduce((sum, s) => sum + s.sesionesPlanificadas, 0) || 0;

    if (!res.ok) {
      titulo = '⚠ El horario tiene conflictos sin resolver';
      subtitulo = `El sistema no pudo asignar todas las sesiones. Revisa el detalle a la derecha y prueba otra distribución.`;
      badgeClass = 'ko';
      badgeIcon = this._icons.alert;
      badgeText = `${res.conflictos?.length || 0} conflicto${res.conflictos?.length === 1 ? '' : 's'}`;
    } else if (agg.incompletos.length === 0) {
      titulo = '✓ Horario listo para enviar a las familias';
      subtitulo = `${intensivo.niños.length} niños · ${totalSes} sesiones distribuidas en ${intensivo.semanas} semanas · sin conflictos.`;
      badgeClass = 'ok';
      badgeIcon = this._icons.ok;
      badgeText = 'Completo · 100%';
    } else {
      titulo = `${agg.incompletos.length} niño${agg.incompletos.length === 1 ? '' : 's'} sin horario completo`;
      subtitulo = `Faltan sesiones por asignar a: ${agg.incompletos.map(i => i.niño).join(', ')}. Prueba regenerar o revisa la disponibilidad de los terapeutas.`;
      badgeClass = 'warn';
      badgeIcon = this._icons.warn;
      badgeText = `${agg.totalPct}% cumplido`;
    }

    return `
      <div class="armador-hero">
        <div class="armador-hero-info">
          <div class="armador-eyebrow">Cohorte ${UI.esc(intensivo.id)} · ${intensivo.fecha_inicio} → ${intensivo.fecha_fin}</div>
          <h2 class="armador-title">${titulo}</h2>
          <p class="armador-subtitle">${subtitulo}</p>
        </div>
        <div class="armador-hero-cta">
          <span class="armador-badge ${badgeClass}">${badgeIcon}${badgeText}</span>
          <button class="btn btn-primary" id="armadorRegenBtn" title="Generar otra distribución del horario">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Regenerar
          </button>
          <button class="btn btn-ghost" id="armadorExportBtn" title="Bajar el horario como CSV (se abre en Excel)">Exportar</button>
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
          Acá se arma automáticamente el horario semanal del programa intensivo. Cada fila es un niño y cada celda es una hora del día con el terapeuta asignado.
          Las siglas (KRA, NP, FV…) son los nombres cortos del equipo — el panel <b>Equipo</b> a la derecha tiene la lista completa.
          Click en cualquier sigla para resaltar a ese terapeuta en toda la grilla.
        </div>
        <button class="armador-banner-close" id="armadorBannerClose" aria-label="Cerrar">×</button>
      </div>
    `;
  },

  _toolbarHtml(intensivo) {
    const tabs = Array.from({ length: intensivo.semanas }, (_, i) => `
      <button class="armador-week-tab ${i === this._semanaActiva ? 'active' : ''}" data-sem="${i}">Semana ${i + 1}</button>
    `).join('');

    return `
      <div class="armador-toolbar">
        <div class="armador-toolbar-left">
          <div class="armador-mode-toggle" role="tablist" aria-label="Modo de visualización">
            <button class="armador-mode-btn ${this._modo === '1sem' ? 'active' : ''}" data-modo="1sem" role="tab">
              ${this._icons.layout1}<span>Ver 1 semana</span>
            </button>
            <button class="armador-mode-btn ${this._modo === '6sem' ? 'active' : ''}" data-modo="6sem" role="tab">
              ${this._icons.layout6}<span>Ver las 6 apiladas</span>
            </button>
          </div>
          ${this._modo === '1sem' ? `<div class="armador-week-tabs">${tabs}</div>` : ''}
        </div>
        ${this._terapeutaResaltado ? `
          <button class="armador-pill-clear" id="armadorClearResaltado" title="Quitar el resaltado del terapeuta">
            Resaltando <b>${this._terapeutaResaltado}</b> · quitar ×
          </button>
        ` : ''}
      </div>
    `;
  },

  // Grilla: si modo=1sem renderiza solo semanaActiva. Si 6sem, apila 6 sub-filas por niño
  _gridHtml(intensivo, catalogo) {
    const { franjas, dias, terapeutas } = catalogo;
    const F = franjas.length;
    const semanas = this._resultado.semanas || [];
    const semanasAMostrar = this._modo === '1sem'
      ? [{ sem: semanas[this._semanaActiva], si: this._semanaActiva }]
      : semanas.map((sem, si) => ({ sem, si }));

    // Si modo=1sem usar fechas reales. Si 6sem, mantener etiquetas genéricas
    const headers = this._modo === '1sem'
      ? this._fechasSemana(this._semanaActiva)
      : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const cornerColspan = this._modo === '6sem' ? 2 : 1;
    const cornerLabel = this._modo === '6sem' ? 'Niño · Semana' : 'Niño';

    let headerDias = `<tr><th class="armador-corner" colspan="${cornerColspan}">${cornerLabel}</th>`;
    headers.forEach((h) => {
      headerDias += `<th class="armador-day day-start" colspan="${F}">${UI.esc(h)}</th>`;
    });
    headerDias += '</tr>';

    let headerFranjas = `<tr><th colspan="${cornerColspan}"></th>`;
    dias.forEach(() => {
      franjas.forEach((f, fi) => {
        const ds = fi === 0 ? ' day-start' : '';
        headerFranjas += `<th class="armador-franja${ds}">${f}</th>`;
      });
    });
    headerFranjas += '</tr>';

    const diaLabelsCorto = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb' };

    const cuerpo = intensivo.niños.map((n, ni) => {
      const subRows = semanasAMostrar.map(({ sem, si }, idx) => {
        const kidsSet = this._kidsSlotsPorSemana?.get(si) || new Set();
        const cells = sem.grid[ni].map((sig, slotIdx) => {
          const franja = slotIdx % F;
          const dia = Math.floor(slotIdx / F);
          const dayStart = franja === 0 ? ' day-start' : '';
          if (!sig) return `<td class="armador-cell empty${dayStart}"></td>`;
          const t = terapeutas[sig];
          const disc = t?.disciplina;
          const esKids = sig === 'GP' && kidsSet.has(slotIdx);
          const token = esKids ? 'kids' : this._disciplinaToken(disc);
          const titulo = t ? `${sig} · ${t.nombre} · ${disc} · sala ${t.sala}\n${diaLabelsCorto[dias[dia]]} ${franjas[franja]}${esKids ? ' · sesión grupal KIDS' : ''}` : sig;
          const label = esKids ? 'KIDS' : sig;
          const resaltado = this._terapeutaResaltado === sig ? ' is-resaltado' : '';
          const atenuado = this._terapeutaResaltado && this._terapeutaResaltado !== sig ? ' is-atenuado' : '';
          return `<td class="armador-cell${dayStart}${resaltado}${atenuado}" data-sigla="${UI.esc(sig)}" style="background:var(--${token}-bg);color:var(--${token}-text)" title="${UI.esc(titulo)}">${UI.esc(label)}</td>`;
        }).join('');

        const ninoCell = idx === 0
          ? `<th class="armador-niño" rowspan="${semanasAMostrar.length}">${UI.esc(n.nombre)}</th>`
          : '';
        const semCell = this._modo === '6sem'
          ? `<th class="armador-sem">SEM ${si + 1}</th>`
          : '';
        const ultima = idx === semanasAMostrar.length - 1;
        return `<tr class="armador-subrow${ultima ? ' last-subrow' : ''}">${ninoCell}${semCell}${cells}</tr>`;
      }).join('');
      return subRows;
    }).join('');

    return `
      <div class="armador-grid-scroll">
        <table class="armador-grid">
          <thead>${headerDias}${headerFranjas}</thead>
          <tbody>${cuerpo}</tbody>
        </table>
      </div>
    `;
  },

  // Panel Equipo: agrupa terapeutas por disciplina, click resalta en grid
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
    const rows = intensivo.niños.map((n, ni) => {
      let cumplido = 0, esperado = 0, kids = 0;
      this._resultado.semanas?.forEach((sem) => {
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
      return `
        <div class="armador-cumpl-row">
          <div class="armador-cumpl-head">
            <span class="armador-cumpl-name">${UI.esc(n.nombre)}</span>
            <span class="armador-cumpl-pct ${cls}">${pct}%</span>
          </div>
          <div class="armador-cumpl-meta">${cumplido}/${esperado} individuales · ${kids} en KIDS</div>
          <div class="armador-cumpl-bar"><div class="armador-cumpl-fill ${cls}" style="width:${pct}%"></div></div>
        </div>
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
            <p>El motor no pudo asignar estas sesiones. Prueba otra distribución o revisa la disponibilidad de los terapeutas involucrados.</p>
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
    document.getElementById('armadorExportBtn')?.addEventListener('click', () => this._exportCSV());

    // Banner descartable
    document.getElementById('armadorBannerClose')?.addEventListener('click', () => {
      localStorage.setItem(this.KEY_BANNER, '1');
      this._bannerCerrado = true;
      document.getElementById('armadorBanner')?.remove();
    });

    // Toggle modo
    document.querySelectorAll('.armador-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._modo = btn.dataset.modo;
        this.render();
      });
    });
    // Tabs semana
    document.querySelectorAll('.armador-week-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this._semanaActiva = +btn.dataset.sem;
        this.render();
      });
    });

    // Click en celda o en pill del equipo → resalta terapeuta
    const resaltar = (sigla) => {
      this._terapeutaResaltado = this._terapeutaResaltado === sigla ? null : sigla;
      this.render();
    };
    document.querySelectorAll('.armador-cell[data-sigla]').forEach(td => {
      td.addEventListener('click', () => resaltar(td.dataset.sigla));
    });
    document.querySelectorAll('.armador-equipo-pill').forEach(btn => {
      btn.addEventListener('click', () => resaltar(btn.dataset.sigla));
    });
    document.getElementById('armadorClearResaltado')?.addEventListener('click', () => {
      this._terapeutaResaltado = null;
      this.render();
    });
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
        body: 'Arriba ves de un vistazo si el horario está <b>completo</b>, <b>incompleto</b>, o con <b>conflictos</b>. El texto explica qué pasa y qué hacer.',
      },
      {
        target: '.armador-mode-toggle',
        position: 'below',
        title: 'Ver 1 semana o las 6',
        body: 'Por defecto ves <b>una semana</b> con sus fechas reales (más fácil de leer). Si necesitas comparar todas, cambia a <b>6 apiladas</b>.',
      },
      {
        target: '.armador-side .armador-card:first-child',
        position: 'left',
        title: 'Panel Equipo',
        body: 'Acá ves todos los terapeutas con sus siglas y nombres. <b>Click en una sigla</b> (en la grilla o en el panel) para resaltar a ese terapeuta en todo el horario.',
      },
      {
        title: 'Listo',
        body: 'Ya conoces el armador. Cuando estés conforme con el horario, baja con <b>Exportar</b> para enviarlo o imprimirlo.<br><br>El sistema recuerda si ya viste este recorrido — no te aparecerá de nuevo.',
      },
    ];
    // Reusar el sistema de tour existente
    if (typeof Onboarding !== 'undefined') {
      Onboarding._run(steps, 0);
      localStorage.setItem(this.KEY_TOUR, '1');
    }
  },

  _exportCSV() {
    const { intensivo, catalogo } = this._cache;
    const semanas = this._resultado.semanas || [];
    if (!semanas.length) { UI.toast('Nada que exportar', 'error'); return; }
    const { dias, franjas } = catalogo;
    const diaLabels = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb' };
    let csv = 'Niño,Semana';
    dias.forEach((d) => franjas.forEach((f) => { csv += `,${diaLabels[d]} ${f}`; }));
    csv += '\n';
    intensivo.niños.forEach((n, ni) => {
      semanas.forEach((sem, si) => {
        csv += `"${n.nombre}",SEM ${si + 1}`;
        sem.grid[ni].forEach((s) => { csv += `,${s || ''}`; });
        csv += '\n';
      });
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${intensivo.id.replace(/\s+/g, '_')}_horario_6sem.csv`;
    a.click();
    URL.revokeObjectURL(url);
    UI.toast(`Exportado ${a.download}`, 'success');
  },

  // ===== Iconos SVG inline =====
  _icons: {
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    layout1: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
    layout6: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="17" width="18" height="4" rx="1"/></svg>',
  },
};
