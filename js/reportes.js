// Módulos Reportes (estadísticas) y Boletas (facturación y pagos)
const Reportes = {
  VALOR_BLOQUE: 35000,

  // Construye las "boletas" agrupando sesiones realizadas por niño + mes
  _construirBoletas() {
    const sesionesReal = State.data.sesiones.filter(s => s.estado === 'Realizada');
    const groups = {};
    sesionesReal.forEach(s => {
      const mes = s.fecha.slice(0, 7); // YYYY-MM
      const key = `${s.id_nino}::${mes}`;
      groups[key] = groups[key] || { id_nino: s.id_nino, mes, sesiones: 0, minutos: 0, items: [] };
      groups[key].sesiones++;
      const b = Data.bloque(s.id_bloque);
      groups[key].minutos += b?.duracion_minutos || 35;
      groups[key].items.push(s.id_sesion);
    });
    const pagadas = JSON.parse(localStorage.getItem('casanogal_boletas_pagadas') || '[]');
    return Object.keys(groups).map(k => {
      const g = groups[k];
      const monto = Math.round((g.minutos / 35) * this.VALOR_BLOQUE);
      return {
        id: 'BOL-' + g.id_nino + '-' + g.mes,
        ...g,
        monto,
        pagada: pagadas.includes('BOL-' + g.id_nino + '-' + g.mes),
      };
    });
  },

  marcarPagada(boletaId) {
    const pagadas = JSON.parse(localStorage.getItem('casanogal_boletas_pagadas') || '[]');
    if (!pagadas.includes(boletaId)) pagadas.push(boletaId);
    localStorage.setItem('casanogal_boletas_pagadas', JSON.stringify(pagadas));
  },

  marcarNoPagada(boletaId) {
    let pagadas = JSON.parse(localStorage.getItem('casanogal_boletas_pagadas') || '[]');
    pagadas = pagadas.filter(b => b !== boletaId);
    localStorage.setItem('casanogal_boletas_pagadas', JSON.stringify(pagadas));
  },

  // Boletas de un niño específico (para mostrar en su ficha)
  boletasDeNino(idNino) {
    return this._construirBoletas().filter(b => b.id_nino === idNino).sort((a, b) => b.mes.localeCompare(a.mes));
  },

  // Módulo Reportes: estadísticas de actividad del centro (solo coordinación)
  render() {
    const ses = State.data.sesiones;
    const cuenta = (e) => ses.filter(s => s.estado === e).length;
    const realizadas = cuenta('Realizada');
    const agendadas  = cuenta('Agendada');
    const canceladas = cuenta('Cancelada');
    const noAsistio  = cuenta('No Asistió');
    const cerradas = realizadas + canceladas + noAsistio;
    const asistencia = cerradas ? Math.round(realizadas / cerradas * 100) : 0;
    const ocup = Data.kpiOcupacion();
    const ninosActivos = State.data.ninos.filter(n => n.estado === 'Activo').length;

    const estados = [
      { label: 'Realizadas', n: realizadas, color: 'var(--success)' },
      { label: 'Agendadas',  n: agendadas,  color: 'var(--cn-azul)' },
      { label: 'No asistió', n: noAsistio,  color: 'var(--cn-mostaza)' },
      { label: 'Canceladas', n: canceladas, color: 'var(--alert)' },
    ];
    const totEstados = estados.reduce((a, e) => a + e.n, 0) || 1;

    const PROG_LABEL = { 'PROG-INT':'Intensivo', 'PROG-CONT':'Continuo', 'PROG-EVAL':'Evaluación', 'PROG-APR':'Apraxia', 'PROG-AT':'Atención temprana' };
    const prog = {};
    ses.forEach(s => { const p = s.id_programa || '—'; prog[p] = (prog[p] || 0) + 1; });
    const progRows = Object.entries(prog).sort((a, b) => b[1] - a[1]);
    const totProg = progRows.reduce((a, r) => a + r[1], 0) || 1;

    const esp = {};
    ses.forEach(s => { esp[s.tipo_terapia] = (esp[s.tipo_terapia] || 0) + 1; });
    const espRows = Object.entries(esp).sort((a, b) => b[1] - a[1]);
    const totEsp = espRows.reduce((a, r) => a + r[1], 0) || 1;

    const bar = (label, n, total, color) => {
      const pct = total ? Math.round(n / total * 100) : 0;
      return `<div style="display:grid;grid-template-columns:150px 1fr 52px;gap:12px;align-items:center;margin-bottom:9px">
        <div style="font-size:13px;color:var(--text-2)">${UI.esc(label)}</div>
        <div style="height:10px;background:var(--bg-soft);border-radius:999px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${color};border-radius:999px;transition:width .3s var(--ease)"></div></div>
        <div style="font-size:13px;font-weight:700;text-align:right;font-family:'JetBrains Mono',monospace">${n}</div>
      </div>`;
    };

    document.getElementById('main').innerHTML = `
      <div class="section-head">
        <div>
          <div class="section-title">Reportes del centro</div>
          <div class="section-sub">Resumen de actividad clínica · ${ses.length} sesiones registradas</div>
        </div>
      </div>
      <div class="reportes-summary">
        <div class="summary-card" style="background:var(--cn-azul-bg);border-color:var(--cn-azul)">
          <div class="summary-label" style="color:var(--cn-azul-deep)">Ocupación semanal</div>
          <div class="summary-value" style="color:var(--cn-azul-deep)">${ocup}%</div>
        </div>
        <div class="summary-card" style="background:var(--success-bg);border-color:var(--success)">
          <div class="summary-label" style="color:var(--success)">Asistencia</div>
          <div class="summary-value" style="color:var(--success)">${asistencia}%</div>
          <div style="font-size:11px;color:var(--success);margin-top:4px">${realizadas} de ${cerradas} sesiones cerradas</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Sesiones realizadas</div>
          <div class="summary-value">${realizadas}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Niños activos</div>
          <div class="summary-value">${ninosActivos}</div>
        </div>
      </div>
      <div class="ficha-section">
        <h2 class="ficha-section-title">Sesiones por estado</h2>
        ${estados.map(e => bar(e.label, e.n, totEstados, e.color)).join('')}
      </div>
      <div class="ficha-section">
        <h2 class="ficha-section-title">Sesiones por programa</h2>
        ${progRows.map(([p, n]) => bar(PROG_LABEL[p] || p, n, totProg, 'var(--cn-azul)')).join('')}
      </div>
      <div class="ficha-section">
        <h2 class="ficha-section-title">Sesiones por especialidad</h2>
        ${espRows.map(([e, n]) => bar(e, n, totEsp, (ESPECIALIDAD_VAR[e] && ESPECIALIDAD_VAR[e].main) || 'var(--cn-mostaza)')).join('')}
      </div>
    `;
  },

  // Módulo Boletas: facturación a familias + pago a profesionales.
  // El terapeuta ve solo su propia liquidación.
  renderBoletas() {
    if (State.role === 'terapeuta') {
      this._renderTerapeutaView();
      return;
    }
    this._seedBoletasPagadas();
    const todas = this._construirBoletas();
    // Filtramos al mes actual + meses recientes para no inundar
    const mesActual = HOY_ISO.slice(0, 7);
    const pendientes = todas.filter(b => !b.pagada).sort((a, b) => a.mes.localeCompare(b.mes));
    const pagadasMes = todas.filter(b => b.pagada && b.mes === mesActual);
    const pendientesMes = todas.filter(b => !b.pagada && b.mes === mesActual);

    // Totales
    const facturadoMes = pagadasMes.reduce((a, b) => a + b.monto, 0);
    const porFacturarMes = pendientesMes.reduce((a, b) => a + b.monto, 0);
    const horasMes = todas.filter(b => b.mes === mesActual).reduce((a, b) => a + b.minutos / 60, 0);

    // Estimación de "horas agendadas próximas" (no realizadas todavía)
    const sesionesProx = State.data.sesiones.filter(s => s.estado === 'Agendada' && s.fecha >= HOY_ISO && s.fecha.slice(0, 7) === mesActual);
    const horasProx = sesionesProx.reduce((a, s) => {
      const b = Data.bloque(s.id_bloque);
      return a + (b?.duracion_minutos || 35) / 60;
    }, 0);
    const proyectadoMes = facturadoMes + porFacturarMes + Math.round(horasProx * (this.VALOR_BLOQUE / (35 / 60)));

    document.getElementById('main').innerHTML = `
      <div class="section-head">
        <div>
          <div class="section-title">Boletas del mes</div>
          <div class="section-sub">Mayo 2026 · <b>${pendientes.length} pendientes de cobro</b>. Marca cada boleta como pagada al recibir el ingreso.</div>
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
        <div class="summary-card" style="background:var(--success-bg);border-color:var(--success)">
          <div class="summary-label" style="color:var(--success)">Total facturado · mayo</div>
          <div class="summary-value" style="color:var(--success)">${UI.fmtCLP(facturadoMes)}</div>
          <div style="font-size:11px;color:var(--success);margin-top:4px">${pagadasMes.length} boleta${pagadasMes.length===1?'':'s'} cobrada${pagadasMes.length===1?'':'s'}</div>
        </div>
        <div class="summary-card" style="background:var(--cn-mostaza-bg);border-color:var(--cn-mostaza)">
          <div class="summary-label" style="color:var(--cn-mostaza-deep)">Por facturar · pendientes</div>
          <div class="summary-value" style="color:var(--cn-mostaza-deep)">${UI.fmtCLP(porFacturarMes)}</div>
          <div style="font-size:11px;color:var(--cn-mostaza-deep);margin-top:4px">${pendientesMes.length} boleta${pendientesMes.length===1?'':'s'} sin cobrar</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Horas terapéuticas mes</div>
          <div class="summary-value">${horasMes.toFixed(1)}</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:4px">+ ${horasProx.toFixed(1)}h agendadas</div>
        </div>
        <div class="summary-card" style="background:var(--cn-azul-bg);border-color:var(--cn-azul)">
          <div class="summary-label" style="color:var(--cn-azul-deep)">Proyectado mes completo</div>
          <div class="summary-value" style="color:var(--cn-azul-deep)">${UI.fmtCLP(proyectadoMes)}</div>
          <div style="font-size:11px;color:var(--cn-azul-deep);margin-top:4px">si se realizan las agendadas</div>
        </div>
      </div>

      ${pendientes.length === 0 ? `
        <div class="empty-state" style="background:var(--success-bg);border:1px solid var(--success);border-radius:var(--r-lg);color:var(--success)">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div class="empty-state-title" style="color:var(--success)">Todas las boletas cobradas</div>
          <div>No hay boletas pendientes este mes. Buen trabajo.</div>
        </div>
      ` : `
        <div class="table-wrap" style="margin-bottom:24px">
          <table class="data-table">
            <thead>
              <tr>
                <th>Niño</th>
                <th>Mes</th>
                <th class="num">Sesiones</th>
                <th class="num">Horas</th>
                <th class="num">Monto (CLP)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${pendientes.map(b => {
                const n = Data.nino(b.id_nino);
                const c = UI.colorNino(b.id_nino);
                return `<tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px">
                      <span class="ficha-avatar" style="width:30px;height:30px;font-size:10px;background:${c.bg};color:${c.text}">${UI.esc(UI.initials(n?.nombre_completo || '—'))}</span>
                      <div>
                        <div style="font-weight:600;color:var(--text)">${UI.esc(n?.nombre_completo || '—')}</div>
                        <div style="font-size:11px;color:var(--text-3)">${UI.esc(n?.programa_nombre || '')}</div>
                      </div>
                    </div>
                  </td>
                  <td class="mono">${this._mesLabel(b.mes)}</td>
                  <td class="num">${b.sesiones}</td>
                  <td class="num">${(b.minutos/60).toFixed(1)}</td>
                  <td class="num"><b>${UI.fmtCLP(b.monto)}</b></td>
                  <td><button class="btn btn-primary boleta-pagar" data-bid="${b.id}" style="height:30px;padding:0 12px;font-size:12px">Marcar pagada</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}

      <div class="section-head" style="margin-top:24px">
        <div>
          <div class="section-title">Pago profesionales</div>
          <div class="section-sub">Mayo 2026 · horas trabajadas × valor hora. Honorarios y sueldo Planta.</div>
        </div>
      </div>

      ${this._renderPagos()}
    `;

    document.getElementById('exportPDF').addEventListener('click', () => UI.toast('Exportación PDF enviada al correo', 'success'));
    document.getElementById('exportXLS').addEventListener('click', () => UI.toast('Exportación Excel enviada al correo', 'success'));
    document.querySelectorAll('.boleta-pagar').forEach(btn => {
      btn.addEventListener('click', () => {
        this.marcarPagada(btn.dataset.bid);
        UI.toast('Boleta marcada como pagada', 'success');
        this.render();
      });
    });
  },

  // Pre-marca ~75% de las boletas anteriores al mes actual como pagadas, para arrancar la demo en estado realista
  _seedBoletasPagadas() {
    if (localStorage.getItem('casanogal_boletas_seeded')) return;
    const todas = this._construirBoletas();
    const mesActual = HOY_ISO.slice(0, 7);
    let r = 1337;
    const prng = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    const pagadas = [];
    todas.forEach(b => {
      if (b.mes < mesActual && prng() < 0.92) pagadas.push(b.id); // meses anteriores: 92% pagadas
      else if (b.mes === mesActual && prng() < 0.6) pagadas.push(b.id); // mes actual: 60% pagadas, resto pendientes
    });
    localStorage.setItem('casanogal_boletas_pagadas', JSON.stringify(pagadas));
    localStorage.setItem('casanogal_boletas_seeded', '1');
  },

  _renderTerapeutaView() {
    const tid = DEMO_USERS.terapeuta?.id_terapeuta;
    const t = Data.terapeuta(tid);
    if (!t) {
      document.getElementById('main').innerHTML = `<div class="empty-state"><div class="empty-state-title">No se encontró tu ficha de terapeuta</div><div>Tu sesión apunta a un profesional que ya no está en el sistema. Vuelve a entrar desde el botón Salir.</div></div>`;
      return;
    }
    const sesiones = State.data.sesiones.filter(s => s.id_terapeuta === tid && s.estado === 'Realizada' && s.fecha.startsWith('2026-05'));
    let minutos = 0;
    sesiones.forEach(s => { const b = Data.bloque(s.id_bloque); minutos += b?.duracion_minutos || 35; });
    const horas = minutos / 60;
    const monto = t.tipo_contrato === 'Planta' ? null : Math.round(horas * (t.valor_hora || 0));

    document.getElementById('main').innerHTML = `
      <div class="section-head">
        <div>
          <div class="section-title">Mi resumen de mayo</div>
          <div class="section-sub">${UI.esc(t?.nombre_completo || '—')} · ${UI.esc(t?.especialidad || '—')} · ${UI.esc(t?.tipo_contrato || '—')}</div>
        </div>
      </div>
      <div class="ficha-quick-stats">
        <div class="quick-stat"><div class="quick-stat-v" style="color:var(--success)">${sesiones.length}</div><div class="quick-stat-l">Sesiones realizadas</div></div>
        <div class="quick-stat"><div class="quick-stat-v" style="color:var(--cn-azul-deep)">${horas.toFixed(1)}</div><div class="quick-stat-l">Horas trabajadas</div></div>
        <div class="quick-stat"><div class="quick-stat-v" style="color:var(--text-3)">${t.tipo_contrato === 'Planta' ? '—' : UI.fmtCLP(t.valor_hora || 0)}</div><div class="quick-stat-l">Valor hora</div></div>
        <div class="quick-stat" style="background:var(--cn-mostaza-bg);border-color:var(--cn-mostaza)"><div class="quick-stat-v" style="color:var(--cn-mostaza-deep)">${t.tipo_contrato === 'Planta' ? 'Sueldo fijo' : UI.fmtCLP(monto)}</div><div class="quick-stat-l" style="color:var(--cn-mostaza-deep)">${t.tipo_contrato === 'Planta' ? 'Contrato' : 'Tu liquidación'}</div></div>
      </div>
      <div class="ficha-section">
        <h2 class="ficha-section-title">Sobre tus pagos</h2>
        <p style="font-size:13.5px;color:var(--text-2);line-height:1.6">
          Aquí solo aparece <b>tu información de pagos y horas trabajadas</b>. Las boletas de las familias y los pagos de otros profesionales son gestionados únicamente por Coordinación.
        </p>
        <p style="font-size:13.5px;color:var(--text-2);line-height:1.6;margin-top:8px">
          ${t.tipo_contrato === 'Planta'
            ? 'Tu contrato es <b>de Planta</b>: tu sueldo está fijado mensualmente independiente del número de sesiones. Estas horas son referenciales para informe interno.'
            : `Tu liquidación de mayo se calcula como <b>horas trabajadas × valor hora</b> (${UI.fmtCLP(t.valor_hora)}). Coordinación te confirmará la fecha de pago.`}
        </p>
      </div>
    `;
  },

  _mesLabel(mes) {
    const [y, m] = mes.split('-');
    const nombres = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return nombres[parseInt(m) - 1] + ' ' + y;
  },

  _renderPagos() {
    const sesiones = State.data.sesiones.filter(s => s.estado === 'Realizada' && s.fecha.startsWith('2026-05'));
    const porTer = {};
    sesiones.forEach(s => {
      porTer[s.id_terapeuta] = porTer[s.id_terapeuta] || { sesiones: 0, minutos: 0 };
      porTer[s.id_terapeuta].sesiones++;
      const b = Data.bloque(s.id_bloque);
      porTer[s.id_terapeuta].minutos += b?.duracion_minutos || 35;
    });

    const rows = Data.terapeutasEfectivos().filter(t => t.estado === 'Activo').map(t => {
      const stats = porTer[t.id_terapeuta] || { sesiones: 0, minutos: 0 };
      const horas = stats.minutos / 60;
      const esPlanta = t.tipo_contrato === 'Planta';
      const monto = esPlanta ? null : Math.round(horas * (t.valor_hora || 0));
      return { t, sesiones: stats.sesiones, horas, monto, esPlanta };
    }).sort((a, b) => b.horas - a.horas);

    const totalHoras = rows.reduce((a, r) => a + r.horas, 0);
    const totalHonorarios = rows.filter(r => !r.esPlanta).reduce((a, r) => a + (r.monto || 0), 0);
    const planta = rows.filter(r => r.esPlanta).length;
    const honor = rows.filter(r => !r.esPlanta).length;

    return `
      <div class="reportes-summary">
        <div class="summary-card"><div class="summary-label">Total horas mes</div><div class="summary-value">${totalHoras.toFixed(1)}</div></div>
        <div class="summary-card"><div class="summary-label">Profesionales Planta</div><div class="summary-value">${planta}</div></div>
        <div class="summary-card"><div class="summary-label">Profesionales Honorarios</div><div class="summary-value">${honor}</div></div>
        <div class="summary-card" style="background:var(--cn-azul-bg);border-color:var(--cn-azul)">
          <div class="summary-label" style="color:var(--cn-azul-deep)">Total honorarios a pagar</div>
          <div class="summary-value" style="color:var(--cn-azul-deep)">${UI.fmtCLP(totalHonorarios)}</div>
        </div>
      </div>
      <div class="table-wrap" style="margin-bottom:24px">
        <table class="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Profesional</th>
              <th>Especialidad</th>
              <th>Contrato</th>
              <th class="num">Sesiones</th>
              <th class="num">Horas</th>
              <th class="num">Valor hora</th>
              <th class="num">Monto (CLP)</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const c = ESPECIALIDAD_VAR[r.t.especialidad] || ESPECIALIDAD_VAR['Terapia Ocupacional'];
              return `<tr>
                <td><span class="equipo-avatar" style="background:${c.bg};color:${c.text};width:30px;height:30px;font-size:10px">${UI.esc(r.t.abreviacion)}</span></td>
                <td><div style="font-weight:600;color:var(--text)">${UI.esc(r.t.nombre_completo)}</div></td>
                <td><span class="badge" style="background:${c.bg};color:${c.text}">${UI.esc(r.t.especialidad)}</span></td>
                <td>${UI.esc(r.t.tipo_contrato)}</td>
                <td class="num">${r.sesiones}</td>
                <td class="num">${r.horas.toFixed(1)}</td>
                <td class="num">${r.esPlanta ? '—' : UI.fmtCLP(r.t.valor_hora)}</td>
                <td class="num">${r.esPlanta ? '<span style="color:var(--text-3)">Sueldo fijo</span>' : UI.fmtCLP(r.monto)}</td>
              </tr>`;
            }).join('')}
            <tr class="total-row">
              <td colspan="4">Total honorarios</td>
              <td class="num">${rows.reduce((a,r)=>a+r.sesiones,0)}</td>
              <td class="num">${totalHoras.toFixed(1)}</td>
              <td class="num">—</td>
              <td class="num">${UI.fmtCLP(totalHonorarios)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },
};
