// Módulo Armador de Horarios — Programa Intensivo
// Usa el motor en js/intensivo/scheduler.js (expuesto en window.Scheduler).
const Armador = {
  _cache: null,
  _resultado: null,
  _semilla: 1,
  _kidsSlotsPorSemana: null,   // Map<semIdx, Set<slotIdx>> — pre-computado

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

  // Pre-computa qué slots tienen GP grupal (más de 1 niño con GP) para cada semana.
  // Reemplaza el O(n²) por celda del antes.
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

  // Devuelve el cumplimiento agregado del intensivo:
  // { incompletos: [{niño, pct, faltan}], totalPct }
  _cumplimientoAgregado() {
    const { intensivo } = this._cache;
    const incompletos = [];
    let cumplidoT = 0, esperadoT = 0;
    intensivo.niños.forEach((n, ni) => {
      // Sumar cumplido/esperado promediado entre semanas (cada semana debe respetar conteos)
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

  // ===== Render HTML =====
  _html(data) {
    const { intensivo, catalogo } = data;
    const res = this._resultado;
    const agg = this._cumplimientoAgregado();

    const fechaIni = intensivo.fecha_inicio;
    const fechaFin = intensivo.fecha_fin;

    const iconOk = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    const iconAlert = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    const iconWarn = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    const iconInfo = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

    let badge;
    if (!res.ok) {
      badge = `<span class="armador-badge ko">${iconAlert}Conflictos sin resolver · ${res.conflictos?.length || 0}</span>`;
    } else if (agg.incompletos.length === 0) {
      const totalSes = res.semanas.reduce((sum, s) => sum + s.sesionesPlanificadas, 0);
      badge = `<span class="armador-badge ok">${iconOk}Horario completo · ${totalSes} sesiones · ${intensivo.semanas} semanas</span>`;
    } else {
      badge = `<span class="armador-badge warn">${iconWarn}${agg.incompletos.length} niño${agg.incompletos.length === 1 ? '' : 's'} incompleto${agg.incompletos.length === 1 ? '' : 's'} · ${agg.totalPct}% cumplido</span>`;
    }

    return `
      <div class="armador-hero">
        <div class="armador-hero-info">
          <div class="armador-eyebrow">Programa Intensivo · Cohorte</div>
          <h2 class="armador-title">${UI.esc(intensivo.id)}</h2>
          <div class="armador-meta">
            ${fechaIni} → ${fechaFin} · <b>${intensivo.semanas} semanas</b> · <b>${intensivo.niños.length} niños</b> · ${Object.keys(catalogo.terapeutas).length} terapeutas disponibles
          </div>
        </div>
        <div class="armador-hero-cta">
          ${badge}
          <button class="btn btn-primary" id="armadorRegenBtn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Regenerar horario
          </button>
          <button class="btn btn-ghost" id="armadorExportBtn" title="Exportar a CSV (pegable en Excel)">Exportar CSV</button>
        </div>
      </div>

      <div class="armador-toolbar">
        <div class="armador-legend">${this._legend()}</div>
        <div class="armador-toolbar-hint">${iconInfo}Las 6 semanas están apiladas. Cada niño tiene 6 sub-filas SEM 1 a 6.</div>
      </div>

      <div class="armador-layout">
        <div class="armador-grid-wrap">
          ${this._gridHtml(intensivo, catalogo)}
        </div>
        <aside class="armador-side">
          ${this._cumplimientoHtml(intensivo, agg)}
          ${res.conflictos?.length ? this._conflictosHtml(res.conflictos) : ''}
        </aside>
      </div>
    `;
  },

  _legend() {
    const disciplinas = [
      ['TO', 'to'], ['FONO', 'fono'], ['COG', 'cog'], ['KINE', 'kine'],
      ['PSI', 'psico'], ['RDI', 'rdi'], ['KIDS (grupal)', 'kids'],
    ];
    return disciplinas.map(([label, key]) => `
      <span class="armador-legend-item"><span class="armador-legend-swatch" style="background:var(--${key}-bg);border-left:3px solid var(--${key})"></span>${label}</span>
    `).join('');
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

  // Grilla apilada: 1 niño = 6 sub-filas (SEM 1..6), todas visibles a la vez
  _gridHtml(intensivo, catalogo) {
    const { franjas, dias, terapeutas } = catalogo;
    const F = franjas.length;
    const D = dias.length;
    const diaLabels = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb' };
    const semanas = this._resultado.semanas || [];

    let headerDias = '<tr><th class="armador-corner" colspan="2">Niño · Semana</th>';
    dias.forEach((d) => {
      headerDias += `<th class="armador-day day-start" colspan="${F}">${diaLabels[d] || d}</th>`;
    });
    headerDias += '</tr>';

    let headerFranjas = '<tr><th colspan="2"></th>';
    dias.forEach(() => {
      franjas.forEach((f, fi) => {
        const ds = fi === 0 ? ' day-start' : '';
        headerFranjas += `<th class="armador-franja${ds}">${f}</th>`;
      });
    });
    headerFranjas += '</tr>';

    const cuerpo = intensivo.niños.map((n, ni) => {
      const subRows = semanas.map((sem, si) => {
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
          const titulo = t ? `${sig} · ${t.nombre} · ${disc} · sala ${t.sala}\n${diaLabels[dias[dia]]} ${franjas[franja]}${esKids ? ' · sesión grupal KIDS' : ''}` : sig;
          const label = esKids ? 'KIDS' : sig;
          return `<td class="armador-cell${dayStart}" style="background:var(--${token}-bg);color:var(--${token}-text)" title="${UI.esc(titulo)}">${UI.esc(label)}</td>`;
        }).join('');
        const ninoCell = si === 0
          ? `<th class="armador-niño" rowspan="${semanas.length}">${UI.esc(n.nombre)}</th>`
          : '';
        const ultimaDeNino = si === semanas.length - 1;
        return `<tr class="armador-subrow${ultimaDeNino ? ' last-subrow' : ''}">${ninoCell}<th class="armador-sem">SEM ${si + 1}</th>${cells}</tr>`;
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

  _cumplimientoHtml(intensivo, agg) {
    const rows = intensivo.niños.map((n, ni) => {
      // Per-niño promedio entre semanas
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
          <div class="armador-cumpl-meta">${cumplido}/${esperado} ind · ${kids} kids</div>
          <div class="armador-cumpl-bar"><div class="armador-cumpl-fill ${cls}" style="width:${pct}%"></div></div>
        </div>
      `;
    }).join('');
    const titulo = agg.incompletos.length
      ? `Cumplimiento · <span style="color:var(--alert)">${agg.incompletos.length} incompleto${agg.incompletos.length === 1 ? '' : 's'}</span>`
      : `Cumplimiento · <span style="color:var(--success)">todos al 100%</span>`;
    return `
      <div class="armador-card">
        <div class="armador-card-head">${titulo}</div>
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
        <div class="armador-card-head">⚠ Conflictos sin resolver</div>
        <div class="armador-card-body">
          ${html}
          <div class="armador-conflicto-cta">
            <p>El motor no pudo asignar estas sesiones con la distribución actual. Prueba otra combinación o revisa la disponibilidad de los terapeutas involucrados.</p>
            <button class="btn btn-secondary btn-sm" id="armadorRegenInlineBtn">Intentar otra distribución</button>
          </div>
        </div>
      </div>
    `;
  },

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
};
