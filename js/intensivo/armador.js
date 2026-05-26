// Módulo Armador de Horarios — Programa Intensivo
// Usa el motor en js/intensivo/scheduler.js (expuesto en window.Scheduler).
const Armador = {
  _cache: null,
  _semana: 0,   // 0..5
  _resultado: null,
  _semilla: 1,

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
  },

  // ===== Render HTML =====
  _html(data) {
    const { intensivo, catalogo } = data;
    const res = this._resultado;
    const sem = res.semanas?.[this._semana];

    const fechaIni = intensivo.fecha_inicio;
    const fechaFin = intensivo.fecha_fin;
    const headerEstado = res.ok
      ? `<span class="armador-badge ok">Horario generado · ${sem?.sesionesPlanificadas || 0} sesiones</span>`
      : `<span class="armador-badge ko">Conflictos sin resolver (${res.conflictos?.length || 0})</span>`;

    return `
      <div class="armador-hero">
        <div>
          <div class="armador-eyebrow">Programa Intensivo · Cohorte</div>
          <h2 class="armador-title">${UI.esc(intensivo.id)}</h2>
          <div class="armador-meta">
            ${fechaIni} → ${fechaFin} · <b>${intensivo.semanas} semanas</b> · <b>${intensivo.niños.length} niños</b> · ${Object.keys(catalogo.terapeutas).length} terapeutas disponibles
          </div>
        </div>
        <div class="armador-hero-cta">
          ${headerEstado}
          <button class="btn btn-primary" id="armadorRegenBtn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Regenerar horario
          </button>
          <button class="btn btn-ghost" id="armadorExportBtn" title="Exportar a CSV (pegable en Excel)">Exportar CSV</button>
        </div>
      </div>

      <div class="armador-toolbar">
        <div class="armador-week-tabs">
          ${Array.from({ length: intensivo.semanas }, (_, i) => `
            <button class="armador-week-tab ${i === this._semana ? 'active' : ''}" data-sem="${i}">Semana ${i + 1}</button>
          `).join('')}
        </div>
        <div class="armador-legend">${this._legend(catalogo)}</div>
      </div>

      <div class="armador-layout">
        <div class="armador-grid-wrap">
          ${sem ? this._gridHtml(intensivo, catalogo, sem) : `<div class="empty-state">Sin resultado para esta semana</div>`}
        </div>
        <aside class="armador-side">
          ${this._cumplimientoHtml(intensivo, catalogo, sem)}
          ${res.conflictos?.length ? this._conflictosHtml(res.conflictos) : ''}
        </aside>
      </div>
    `;
  },

  _legend(catalogo) {
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

  _gridHtml(intensivo, catalogo, sem) {
    const { franjas, dias, terapeutas } = catalogo;
    const F = franjas.length;
    const D = dias.length;
    const diaLabels = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb' };

    let headerDias = '<tr><th class="armador-corner">Niño</th>';
    dias.forEach((d) => {
      headerDias += `<th class="armador-day" colspan="${F}">${diaLabels[d] || d}</th>`;
    });
    headerDias += '</tr>';

    let headerFranjas = '<tr><th></th>';
    dias.forEach(() => {
      franjas.forEach((f) => {
        headerFranjas += `<th class="armador-franja">${f}</th>`;
      });
    });
    headerFranjas += '</tr>';

    const cuerpo = intensivo.niños.map((n, ni) => {
      const cells = sem.grid[ni].map((sig, slotIdx) => {
        if (!sig) return `<td class="armador-cell empty"></td>`;
        const t = terapeutas[sig];
        const disc = t?.disciplina;
        const token = sig === 'GP' && this._esKidsGrupal(sem, slotIdx, ni) ? 'kids' : this._disciplinaToken(disc);
        const title = t ? `${sig} · ${t.nombre} · ${disc} · sala ${t.sala}` : sig;
        const grupal = sig === 'GP' && this._esKidsGrupal(sem, slotIdx, ni) ? ' grupal' : '';
        return `<td class="armador-cell" style="background:var(--${token}-bg);color:var(--${token}-text);border-left:3px solid var(--${token})" title="${UI.esc(title)}${grupal}">${UI.esc(sig)}</td>`;
      }).join('');
      return `<tr><th class="armador-niño">${UI.esc(n.nombre)}</th>${cells}</tr>`;
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

  _esKidsGrupal(sem, slotIdx, niActual) {
    // Es grupal si en este slot hay 2+ niños con la misma sigla GP
    let count = 0;
    for (let i = 0; i < sem.grid.length; i++) {
      if (sem.grid[i][slotIdx] === 'GP') count++;
      if (count > 1) return true;
    }
    return false;
  },

  _cumplimientoHtml(intensivo, catalogo, sem) {
    if (!sem) return '';
    const rows = intensivo.niños.map((n, ni) => {
      const conteo = {};
      sem.grid[ni].forEach((sig) => { if (sig) conteo[sig] = (conteo[sig] || 0) + 1; });
      let cumplido = 0, esperado = 0;
      n.asignaciones.forEach((a) => {
        if (a.rol === 'PAPAS') return;
        let real = conteo[a.sigla] || 0;
        if (a.sigla === 'GP') real -= (n.kids_semanal || 0);
        cumplido += Math.min(real, a.sesiones);
        esperado += a.sesiones;
      });
      const kids = (n.kids_semanal || 0);
      const pct = esperado ? Math.round((cumplido / esperado) * 100) : 100;
      const cls = pct === 100 ? 'ok' : pct >= 80 ? 'warn' : 'ko';
      return `
        <div class="armador-cumpl-row">
          <div class="armador-cumpl-name">${UI.esc(n.nombre)}</div>
          <div class="armador-cumpl-meta">${cumplido}/${esperado} ind · ${kids} kids</div>
          <div class="armador-cumpl-bar"><div class="armador-cumpl-fill ${cls}" style="width:${pct}%"></div></div>
        </div>
      `;
    }).join('');
    return `
      <div class="armador-card">
        <div class="armador-card-head">Cumplimiento por niño</div>
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
        <div class="armador-card-head">⚠ Conflictos</div>
        <div class="armador-card-body">${html}</div>
      </div>
    `;
  },

  _wire() {
    document.getElementById('armadorRegenBtn')?.addEventListener('click', () => {
      this._semilla = Math.floor(Math.random() * 100000);
      this._generar();
      this.render();
      UI.toast(this._resultado.ok ? 'Horario regenerado' : 'Generado con conflictos', this._resultado.ok ? 'success' : 'warning');
    });
    document.getElementById('armadorExportBtn')?.addEventListener('click', () => this._exportCSV());
    document.querySelectorAll('.armador-week-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._semana = +btn.dataset.sem;
        this.render();
      });
    });
  },

  _exportCSV() {
    const { intensivo, catalogo } = this._cache;
    const sem = this._resultado.semanas[this._semana];
    if (!sem) { UI.toast('Nada que exportar', 'error'); return; }
    const { dias, franjas } = catalogo;
    const F = franjas.length;
    const diaLabels = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb' };
    let csv = 'Niño';
    dias.forEach((d) => franjas.forEach((f) => { csv += `,${diaLabels[d]} ${f}`; }));
    csv += '\n';
    intensivo.niños.forEach((n, ni) => {
      csv += `"${n.nombre}"`;
      sem.grid[ni].forEach((s) => { csv += `,${s || ''}`; });
      csv += '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${intensivo.id.replace(/\s+/g, '_')}_semana${this._semana + 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    UI.toast(`Exportado ${a.download}`, 'success');
  },
};
