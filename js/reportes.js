// Módulo Reportes y boletas
const Reportes = {
  // Valor por defecto del bloque para CLP (35 min)
  VALOR_BLOQUE: 35000,

  render() {
    const sesiones = Data.sesionesVisibles().filter(s => s.estado === 'Realizada' && s.fecha.startsWith('2026-05'));
    // Agrupar por nino + terapeuta + tipo
    const grupos = {};
    sesiones.forEach(s => {
      const key = `${s.id_nino}::${s.id_terapeuta}::${s.tipo_terapia}`;
      grupos[key] = grupos[key] || { id_nino: s.id_nino, id_terapeuta: s.id_terapeuta, tipo_terapia: s.tipo_terapia, sesiones: 0, minutos: 0 };
      grupos[key].sesiones++;
      const b = Data.bloque(s.id_bloque);
      grupos[key].minutos += b?.duracion_minutos || 35;
    });
    const rows = Object.values(grupos).sort((a, b) => b.sesiones - a.sesiones);
    const totalSes = rows.reduce((a, b) => a + b.sesiones, 0);
    const totalMonto = rows.reduce((a, b) => a + this._monto(b), 0);
    const totalHoras = rows.reduce((a, b) => a + b.minutos / 60, 0);
    const ninosFact = new Set(rows.map(r => r.id_nino)).size;

    document.getElementById('main').innerHTML = `
      <div class="section-head">
        <div>
          <div class="section-title">Reportes y boletas</div>
          <div class="section-sub">Período: mayo 2026 · sesiones realizadas listas para facturar</div>
        </div>
        <div class="section-actions">
          <button class="btn btn-secondary" id="exportPDF">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Exportar PDF
          </button>
          <button class="btn btn-primary" id="exportXLS">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar Excel
          </button>
        </div>
      </div>

      <div class="reportes-summary">
        <div class="summary-card"><div class="summary-label">Sesiones realizadas</div><div class="summary-value">${totalSes}</div></div>
        <div class="summary-card"><div class="summary-label">Horas terapéuticas</div><div class="summary-value">${totalHoras.toFixed(1)}</div></div>
        <div class="summary-card"><div class="summary-label">Niños facturables</div><div class="summary-value">${ninosFact}</div></div>
        <div class="summary-card" style="background:var(--cn-mostaza-bg);border-color:var(--cn-mostaza)">
          <div class="summary-label" style="color:var(--cn-mostaza-deep)">Total a facturar</div>
          <div class="summary-value" style="color:var(--cn-mostaza-deep)">${UI.fmtCLP(totalMonto)}</div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Niño</th>
              <th>Terapeuta</th>
              <th>Tipo de terapia</th>
              <th class="num">Sesiones</th>
              <th class="num">Horas</th>
              <th class="num">Monto (CLP)</th>
            </tr>
          </thead>
          <tbody>
            ${rows.slice(0, 80).map(r => {
              const n = Data.nino(r.id_nino);
              const t = Data.terapeuta(r.id_terapeuta);
              const c = ESPECIALIDAD_VAR[r.tipo_terapia] || ESPECIALIDAD_VAR['Terapia Ocupacional'];
              return `<tr>
                <td>${UI.esc(n?.nombre_completo || '—')}</td>
                <td>${UI.esc(t?.nombre_visible || '—')} <span class="badge" style="background:${c.bg};color:${c.text};margin-left:4px">${UI.esc(t?.abreviacion||'')}</span></td>
                <td>${UI.esc(r.tipo_terapia)}</td>
                <td class="num">${r.sesiones}</td>
                <td class="num">${(r.minutos/60).toFixed(1)}</td>
                <td class="num">${UI.fmtCLP(this._monto(r))}</td>
              </tr>`;
            }).join('')}
            <tr class="total-row">
              <td colspan="3">Total general</td>
              <td class="num">${totalSes}</td>
              <td class="num">${totalHoras.toFixed(1)}</td>
              <td class="num">${UI.fmtCLP(totalMonto)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('exportPDF').addEventListener('click', () => UI.toast('Exportación PDF enviada al correo', 'success'));
    document.getElementById('exportXLS').addEventListener('click', () => UI.toast('Exportación Excel enviada al correo', 'success'));
  },

  _monto(r) {
    // 35.000 CLP por sesión estándar de 35 min, escalar por horas
    return Math.round((r.minutos / 35) * this.VALOR_BLOQUE);
  },
};
