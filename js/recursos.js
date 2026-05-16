// Módulos Equipo, Niños, Salas + placeholder Config/Permisos
const Recursos = {
  renderEquipo() {
    const list = State.data.terapeutas;
    const q = State.searchQuery.toLowerCase();
    const filtered = list.filter(t => !q || t.nombre_completo.toLowerCase().includes(q) || t.abreviacion.toLowerCase().includes(q));

    document.getElementById('main').innerHTML = `
      <div class="section-head">
        <div>
          <div class="section-title">Equipo</div>
          <div class="section-sub">${filtered.length} terapeutas · ${list.filter(t=>t.estado==='Activo').length} activos</div>
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
            <th></th><th>Nombre</th><th>Especialidad</th><th>Contrato</th><th class="num">Horas</th><th>Email</th><th>Estado</th>
          </tr></thead>
          <tbody>
            ${filtered.map(t => {
              const c = ESPECIALIDAD_VAR[t.especialidad] || ESPECIALIDAD_VAR['Terapia Ocupacional'];
              return `<tr>
                <td><span class="equipo-avatar" style="background:${c.bg};color:${c.text};width:30px;height:30px;font-size:10px">${UI.esc(t.abreviacion)}</span></td>
                <td><div style="font-weight:600;color:var(--text)">${UI.esc(t.nombre_completo)}</div><div style="font-size:11px;color:var(--text-3)">${UI.esc(t.nombre_visible)}</div></td>
                <td><span class="badge" style="background:${c.bg};color:${c.text}">${UI.esc(t.especialidad)}</span></td>
                <td>${UI.esc(t.tipo_contrato)}</td>
                <td class="num">${t.horas_contrato}</td>
                <td class="mono" style="font-size:12px">${UI.esc(t.email)}</td>
                <td><span class="estado-pill ${t.estado==='Activo'?'realizada':'cancelada'}">${UI.esc(t.estado)}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    document.getElementById('recSearch').addEventListener('input', e => { State.searchQuery = e.target.value; this.renderEquipo(); });
  },

  renderNinos() {
    State.fichaActiva = null;
    Fichas._renderLista();
    // Igualito a Fichas, pero el sidebar resalta "Niños"
  },

  renderSalas() {
    const list = State.data.salas;
    const sesHoy = Data.sesionesVisibles().filter(s => s.fecha === HOY_ISO);
    document.getElementById('main').innerHTML = `
      <div class="section-head">
        <div>
          <div class="section-title">Salas</div>
          <div class="section-sub">${list.length} salas · ocupación de hoy</div>
        </div>
      </div>
      <div class="fichas-grid">
        ${list.map(s => {
          const enUso = sesHoy.filter(x => x.id_sala === s.id_sala).length;
          const pct = Math.min(100, Math.round(enUso / 14 * 100));
          return `<div class="ficha-card" style="cursor:default">
            <div class="ficha-card-head">
              <span class="ficha-avatar int" style="background:var(--cn-azul-bg);color:var(--cn-azul-deep)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              </span>
              <div style="flex:1">
                <div class="ficha-name">${UI.esc(s.nombre)}</div>
                <div class="ficha-prog">${UI.esc(s.tipo_principal)} · cap. ${s.capacidad_personas}</div>
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
  },

  renderNinosTable() {
    const list = Data.ninosVisibles();
    const q = State.searchQuery.toLowerCase();
    const filtered = list.filter(n => !q || n.nombre_completo.toLowerCase().includes(q));
    document.getElementById('main').innerHTML = `
      <div class="section-head">
        <div>
          <div class="section-title">Niños</div>
          <div class="section-sub">${filtered.length} de ${list.length} · todos los programas</div>
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
              const av = UI.avatarClassByPrograma(n.id_programa);
              return `<tr style="cursor:pointer" data-id="${n.id_nino}">
                <td><span class="ficha-avatar ${av}" style="width:32px;height:32px;font-size:11px">${UI.initials(n.nombre_completo)}</span></td>
                <td><div style="font-weight:600;color:var(--text)">${UI.esc(n.nombre_completo)}</div><div style="font-size:11px;color:var(--text-3)" class="mono">${UI.esc(n.rut)}</div></td>
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
    document.getElementById('main').innerHTML = `
      <div class="section-head"><div><div class="section-title">${UI.esc(label)}</div></div></div>
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div class="empty-state-title">Próximamente</div>
        <div>Esta sección está en construcción.</div>
      </div>
    `;
  },
};
