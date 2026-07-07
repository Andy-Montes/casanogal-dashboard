// Módulo Fichas clínicas
const Fichas = {
  render() {
    if (State.fichaActiva) {
      this._renderDetalle(State.fichaActiva);
    } else {
      this._renderLista();
    }
  },

  _renderLista() {
    const ninos = Data.ninosVisibles();
    const q = State.searchQuery.toLowerCase();
    const filtered = ninos.filter(n => {
      if (State.filterFicha !== 'all' && n.id_programa !== 'PROG-' + State.filterFicha) return false;
      if (State.filterDiagnostico !== 'all' && !(n.diagnosticos || []).includes(State.filterDiagnostico)) return false;
      if (q && !n.nombre_completo.toLowerCase().includes(q)) return false;
      return true;
    });
    // Catálogo de diagnósticos presentes (para el filtro desplegable)
    const diagnosticos = [...new Set(ninos.flatMap(n => n.diagnosticos || []))].sort((a, b) => a.localeCompare(b));

    const conteo = { all: ninos.length };
    ['INT','CONT','EVAL','APR','AT'].forEach(k => conteo[k] = ninos.filter(n => n.id_programa === 'PROG-' + k).length);

    // Cuando hay búsqueda activa o filtro distinto a "all", se aplana en una sola grilla
    const useGroups = !q && State.filterFicha === 'all' && filtered.length > 0;
    const intensivos = filtered.filter(n => n.id_programa === 'PROG-INT');
    const continuos  = filtered.filter(n => n.id_programa === 'PROG-CONT');
    const otros      = filtered.filter(n => ['PROG-EVAL','PROG-APR','PROG-AT'].includes(n.id_programa));

    const renderGrupo = (titulo, eyebrow, items) => items.length === 0 ? '' : `
      <div class="group-section">
        <div class="group-section-head">
          <div>
            <div class="group-eyebrow">${UI.esc(eyebrow)}</div>
            <div class="group-title">${UI.esc(titulo)} <span class="group-count">· ${items.length} niño${items.length===1?'':'s'}</span></div>
          </div>
        </div>
        <div class="fichas-grid">
          ${items.map(n => this._card(n)).join('')}
        </div>
      </div>
    `;

    document.getElementById('main').innerHTML = `
      <div class="section-head">
        <div>
          <div class="section-title">Fichas clínicas</div>
          <div class="section-sub">Historial completo de cada niño · click en una ficha para abrir</div>
        </div>
      </div>

      <div class="fichas-toolbar">
        <div class="fichas-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="fichaSearch" placeholder="Buscar por nombre…" value="${UI.esc(State.searchQuery)}">
        </div>
        <div class="fichas-chips">
          <button class="chip ${State.filterFicha==='all'?'active':''}" data-f="all">Todos <span class="chip-count">${conteo.all}</span></button>
          <button class="chip ${State.filterFicha==='INT'?'active':''}" data-f="INT">Intensivo <span class="chip-count">${conteo.INT}</span></button>
          <button class="chip ${State.filterFicha==='CONT'?'active':''}" data-f="CONT">Continuo <span class="chip-count">${conteo.CONT}</span></button>
          <button class="chip ${State.filterFicha==='EVAL'?'active':''}" data-f="EVAL">Evaluación <span class="chip-count">${conteo.EVAL}</span></button>
          <button class="chip ${State.filterFicha==='APR'?'active':''}" data-f="APR">Apraxia <span class="chip-count">${conteo.APR}</span></button>
          <button class="chip ${State.filterFicha==='AT'?'active':''}" data-f="AT">AT <span class="chip-count">${conteo.AT}</span></button>
        </div>
        <div class="fichas-diag">
          <label for="fichaDiag">Diagnóstico</label>
          <select id="fichaDiag">
            <option value="all">Todos</option>
            ${diagnosticos.map(d => `<option value="${UI.esc(d)}" ${State.filterDiagnostico===d?'selected':''}>${UI.esc(d)}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-secondary" id="dlTodasFichas" style="height:38px">Descargar todas</button>
        <button class="btn btn-primary" id="crearNinoBtn" style="height:38px">＋ Crear niño</button>
      </div>

      ${filtered.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-title">Nada por acá con este filtro</div>
          <div>Prueba con <b>Todos</b> o limpia la búsqueda.</div>
        </div>
      ` : useGroups ? `
        ${renderGrupo('Intensivo 40', 'Programa intensivo · 6 semanas', intensivos)}
        ${renderGrupo('Seguimiento', 'Programa continuo · sesiones recurrentes', continuos)}
        ${renderGrupo('Otros programas', 'Evaluación, Apraxia y Atención Temprana', otros)}
      ` : `
        <div class="fichas-grid">
          ${filtered.map(n => this._card(n)).join('')}
        </div>
      `}
    `;

    document.getElementById('fichaSearch').addEventListener('input', (e) => {
      State.searchQuery = e.target.value;
      this._renderLista();
    });
    document.querySelectorAll('.fichas-toolbar [data-f]').forEach(b => {
      b.addEventListener('click', () => { State.filterFicha = b.dataset.f; this._renderLista(); });
    });
    document.getElementById('fichaDiag')?.addEventListener('change', (e) => {
      State.filterDiagnostico = e.target.value; this._renderLista();
    });
    document.getElementById('dlTodasFichas')?.addEventListener('click', () => this._descargarTodasFichas());
    document.getElementById('crearNinoBtn')?.addEventListener('click', () => this._abrirCrearNino());
    document.querySelectorAll('.ficha-card').forEach(c => {
      c.addEventListener('click', () => { State.fichaActiva = c.dataset.id; this.render(); });
    });
  },

  _card(n) {
    const equipo = Data.equipoDeNino(n.id_nino);
    const sesiones = Data.sesionesDeNino(n.id_nino);
    const realizadas = sesiones.filter(s => s.estado === 'Realizada').length;
    const prox = sesiones
      .filter(s => s.estado === 'Agendada' && s.fecha >= HOY_ISO)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
    const c = UI.colorNino(n.id_nino);
    return `<div class="ficha-card" data-id="${n.id_nino}">
      <div class="ficha-card-head">
        <span class="ficha-avatar" style="background:${c.bg};color:${c.text};${UI.ringIntensivo(n)}">${UI.esc(UI.initials(n.nombre_completo))}</span>
        <div style="flex:1;min-width:0">
          <div class="ficha-name">${UI.esc(n.nombre_completo)}${UI.badgeIntensivo(n)}</div>
          <div class="ficha-prog">${UI.esc(n.programa_nombre)}${n.semana_actual?` · Sem ${n.semana_actual}`:''} · ${n.edad_anios} años</div>
        </div>
      </div>
      <div class="ficha-diag">
        ${(n.diagnosticos||[]).slice(0,3).map(d => `<span class="badge">${UI.esc(d)}</span>`).join('')}
      </div>
      <div class="ficha-stats">
        <div class="ficha-stat"><div class="ficha-stat-v">${equipo.length}</div><div class="ficha-stat-l">Equipo</div></div>
        <div class="ficha-stat"><div class="ficha-stat-v">${realizadas}</div><div class="ficha-stat-l">Realizadas</div></div>
        <div class="ficha-stat"><div class="ficha-stat-v" style="font-size:11px">${prox ? UI.fmtFechaCorta(prox.fecha) : '—'}</div><div class="ficha-stat-l">Próxima</div></div>
      </div>
    </div>`;
  },

  _renderDetalle(id) {
    const n = Data.nino(id);
    if (!n) { State.fichaActiva = null; this._renderLista(); return; }
    const prog = Data.programa(n.id_programa);
    const equipo = Data.equipoDeNino(id);
    const sesiones = Data.sesionesDeNino(id);
    const sesionesVisibles = (State.role === 'terapeuta')
      ? sesiones.filter(s => s.id_terapeuta === DEMO_USERS.terapeuta.id_terapeuta || s.id_terapeuta_secundario === DEMO_USERS.terapeuta.id_terapeuta)
      : sesiones;
    const objetivos = Data.objetivosDeNino(id);
    const docs = Data.documentosDeNino(id);
    const cNino = UI.colorNino(n.id_nino);
    const semProg = n.semana_actual && prog?.duracion_semanas ? Math.round(100 * n.semana_actual / prog.duracion_semanas) : null;
    const isTer = State.role === 'terapeuta';

    // Stats rápidas
    const realizadas = sesiones.filter(s => s.estado === 'Realizada').length;
    const canceladas = sesiones.filter(s => s.estado === 'Suspendida').length;
    const noAsistio = sesiones.filter(s => s.estado === 'No Asistió').length;
    const agendadas = sesiones.filter(s => s.estado === 'Agendada' && s.fecha >= HOY_ISO).length;

    document.getElementById('main').innerHTML = `
      <button class="ficha-back" id="fichaBack">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Volver a fichas
      </button>

      <div class="ficha-detail-head" style="border-color:${cNino.text}; box-shadow: inset 4px 0 0 ${cNino.text};">
        ${(() => { const ringExt = UI.esIntensivo(n) ? 'var(--cn-mostaza)' : cNino.text; return n.foto_url
          ? `<img class="ficha-avatar-lg ficha-avatar" src="${UI.esc(n.foto_url)}" alt="" style="box-shadow:0 0 0 3px ${cNino.bg}, 0 0 0 4px ${ringExt}">`
          : `<span class="ficha-avatar-lg ficha-avatar" style="background:${cNino.bg};color:${cNino.text};box-shadow:0 0 0 3px ${cNino.bg}, 0 0 0 4px ${ringExt}">${UI.esc(UI.initials(n.nombre_completo))}</span>`; })()}
        <div>
          <div class="ficha-detail-name">${UI.esc(n.nombre_completo)}${UI.badgeIntensivo(n)}</div>
          <div class="ficha-detail-meta">
            <span>${n.edad_anios} años</span>
            <span class="mono">RUT ${UI.esc(n.rut)}</span>
            <span>${UI.esc(prog?.nombre || '—')}</span>
            <span class="mono">${UI.fmtFechaCorta(n.fecha_inicio_programa)} → ${UI.fmtFechaCorta(n.fecha_termino_programa)}</span>
          </div>
          ${semProg !== null ? `
            <div class="progress"><div class="progress-bar" style="width:${semProg}%"></div></div>
            <div class="progress-label">Semana ${n.semana_actual} de ${prog.duracion_semanas} · ${semProg}%</div>
          ` : ''}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary" id="exportFicha" title="Ficha completa: identificación, antecedentes, situación familiar, estado actual, equipo, objetivos e intensivos anteriores">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Ficha completa
          </button>
          <button class="btn btn-secondary" id="exportRegistro" title="Hoja de vida: la ficha + toda la trayectoria de atenciones sesión por sesión con notas de cada profesional">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
            Hoja de vida
          </button>
          <button class="btn btn-secondary" id="exportEnCurso" title="Tratamiento en curso: solo el intensivo actual, lo realizado y las horas agendadas pendientes">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Tratamiento en curso
          </button>
          <button class="btn btn-primary" id="editFicha">Editar datos</button>
        </div>
      </div>

      <div class="ficha-quick-stats">
        <div class="quick-stat"><div class="quick-stat-v" style="color:var(--success)">${realizadas}</div><div class="quick-stat-l">Realizadas</div></div>
        <div class="quick-stat"><div class="quick-stat-v" style="color:var(--cn-azul-deep)">${agendadas}</div><div class="quick-stat-l">Agendadas (próx.)</div></div>
        <div class="quick-stat"><div class="quick-stat-v" style="color:var(--alert)">${noAsistio}</div><div class="quick-stat-l">No asistió</div></div>
        <div class="quick-stat"><div class="quick-stat-v" style="color:var(--text-3)">${canceladas}</div><div class="quick-stat-l">Suspendidas</div></div>
      </div>

      <!-- Ficha unificada: una sola vista con secciones -->
      ${this._seccionDatos(n)}
      ${this._seccionHorarioSemana(n)}
      ${this._seccionCiclos(n)}
      ${!isTer ? this._seccionEquipo(equipo) : ''}
      ${this._seccionHistorial(sesionesVisibles)}
      ${this._seccionObjetivos(objetivos)}
      ${!isTer ? this._seccionReuniones(n.id_nino) : ''}
      ${!isTer ? this._seccionDocumentos(docs) : ''}
    `;

    document.getElementById('fichaBack').addEventListener('click', () => { State.fichaActiva = null; this.render(); });
    document.getElementById('exportFicha').addEventListener('click', () => this._descargarFicha(n));
    document.getElementById('exportRegistro')?.addEventListener('click', () => this._exportarRegistroCompleto(n));
    document.getElementById('exportEnCurso')?.addEventListener('click', () => this._exportarEnCurso(n));
    document.querySelectorAll('.fhist-export').forEach(b =>
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); const hi = b.dataset.hidx; this._exportarEvento(n, hi === 'curso' ? 'curso' : Number(hi)); })
    );
    document.getElementById('editFicha').addEventListener('click', () => this._abrirEditarDatos(n));
    // Banco de objetivos: agregar uno predefinido a la ficha del niño (persiste)
    const agregarObjetivo = (descripcion, cif) => {
      if (!descripcion) return;
      Data.agregarObjetivo({
        id_objetivo: 'OBJ-EXT-' + Date.now(),
        id_nino: n.id_nino,
        nino_visible: n.nombre_visible,
        area: null, cif,
        descripcion,
        categoria: null,
        fecha_planteamiento: HOY_ISO,
        fecha_estimada_logro: null,
        estado: 'En curso',
        id_terapeuta_responsable: null,
        notas: null,
        _extra: true,
      });
      this.render();
      UI.toast(`Objetivo agregado en ${cif}`, 'success');
    };
    document.querySelectorAll('.banco-item').forEach(b =>
      b.addEventListener('click', () => agregarObjetivo(b.dataset.obj, b.dataset.cif))
    );
    document.querySelectorAll('.banco-propio-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const inp = document.querySelector(`.banco-propio-in[data-cif="${CSS.escape(btn.dataset.cif)}"]`);
        const v = (inp?.value || '').trim();
        if (!v) { UI.toast('Escribe el objetivo primero', 'error'); return; }
        agregarObjetivo(v, btn.dataset.cif);
      })
    );
    document.querySelectorAll('.obj-del').forEach(b =>
      b.addEventListener('click', (e) => { e.stopPropagation(); Data.eliminarObjetivo(b.dataset.id); this.render(); UI.toast('Objetivo eliminado', ''); })
    );
    // Click en el body de la fila abre el panel; el caret expande/colapsa la nota inline
    document.querySelectorAll('.timeline-item').forEach(item => {
      const head = item.querySelector('.timeline-head');
      const caret = item.querySelector('.timeline-caret');
      caret?.addEventListener('click', (e) => {
        e.stopPropagation();
        item.classList.toggle('open');
      });
      head?.addEventListener('click', (e) => {
        if (e.target.closest('.timeline-caret')) return;
        if (e.target.closest('.timeline-body')) return;
        const sid = item.dataset.sesionId;
        const s = State.data.sesiones.find(x => x.id_sesion === sid);
        if (s) Panel.open(s);
      });
    });
    // Registro de nota por sesión, dentro de la ficha del niño
    document.querySelectorAll('.timeline-nota-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const form = document.getElementById('notaForm-' + btn.dataset.sid);
        if (!form) return;
        const vis = form.style.display !== 'none';
        form.style.display = vis ? 'none' : 'block';
        if (!vis) form.querySelector('textarea')?.focus();
      });
    });
    document.querySelectorAll('.timeline-nota-cancel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const form = document.getElementById('notaForm-' + btn.dataset.sid);
        if (form) form.style.display = 'none';
      });
    });
    document.querySelectorAll('.timeline-nota-save').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sid = btn.dataset.sid;
        const input = document.getElementById('notaInput-' + sid);
        const txt = (input?.value || '').trim();
        const store = JSON.parse(localStorage.getItem('casanogal_notas') || '{}');
        if (txt) {
          store[sid] = { texto: txt, autor: State.role === 'coordinacion' ? 'admin' : 'terapeuta', autor_nombre: State.currentUser?.name || null };
        } else {
          delete store[sid];
        }
        localStorage.setItem('casanogal_notas', JSON.stringify(store));
        UI.toast(txt ? 'Nota guardada en la ficha' : 'Nota eliminada', 'success');
        Main.renderPendientes();
        this._renderDetalle(n.id_nino);
      });
    });
    [['verPasadas', 'histPasadas'], ['verFuturas', 'histFuturas']].forEach(([btnId, blkId]) => {
      const btn = document.getElementById(btnId);
      const blk = document.getElementById(blkId);
      if (!btn || !blk) return;
      btn.addEventListener('click', () => {
        const abierto = blk.style.display !== 'none';
        blk.style.display = abierto ? 'none' : 'block';
        btn.textContent = (abierto ? 'Revisar ' : 'Ocultar ') + btn.dataset.label;
      });
    });
    // Filtros del registro de atenciones (especialidad + período): ocultan/muestran items sin re-render.
    const fEsp = document.getElementById('filtroEsp');
    const fMes = document.getElementById('filtroMes');
    const fCount = document.getElementById('filtroCount');
    if (fEsp && fMes) {
      const aplicar = () => {
        const esp = fEsp.value, mes = fMes.value;
        let visibles = 0;
        document.querySelectorAll('#histPasadasList .timeline-item').forEach(it => {
          const ok = (!esp || it.dataset.esp === esp) && (!mes || it.dataset.mes === mes);
          it.style.display = ok ? '' : 'none';
          if (ok) visibles++;
        });
        if (fCount) fCount.textContent = `${visibles} sesion${visibles === 1 ? '' : 'es'}`;
      };
      fEsp.addEventListener('change', aplicar);
      fMes.addEventListener('change', aplicar);
      aplicar();
    }
    document.getElementById('addReuBtn')?.addEventListener('click', () => this._abrirModalReunion(n.id_nino));
    document.querySelectorAll('.reu-delete').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this._borrarReunion(n.id_nino, b.dataset.rid);
        this._renderDetalle(n.id_nino);
      });
    });
    document.querySelectorAll('.reu-acta-save').forEach(b => {
      b.addEventListener('click', () => {
        const ta = document.querySelector(`.reu-acta-input[data-rid="${b.dataset.rid}"]`);
        this._guardarActaReunion(n.id_nino, b.dataset.rid, ta ? ta.value.trim() : '');
        UI.toast('Registro de la reunión guardado', 'success');
        this._renderDetalle(n.id_nino);
      });
    });
    document.querySelectorAll('.boleta-pagar-inline').forEach(b => {
      b.addEventListener('click', () => {
        Reportes.marcarPagada(b.dataset.bid);
        UI.toast('Boleta marcada como pagada', 'success');
        this._renderDetalle(n.id_nino);
      });
    });
    document.querySelectorAll('.boleta-revertir').forEach(b => {
      b.addEventListener('click', () => {
        Reportes.marcarNoPagada(b.dataset.bid);
        UI.toast('Boleta marcada como pendiente', 'success');
        this._renderDetalle(n.id_nino);
      });
    });
    document.querySelectorAll('.doc-download').forEach(b => {
      b.addEventListener('click', () => UI.toast('Descarga enviada al correo', 'success'));
    });
  },

  _seccionBoletas(idNino) {
    const boletas = Reportes.boletasDeNino(idNino);
    if (!boletas.length) {
      return `<section class="ficha-section">
        <h2 class="ficha-section-title">Boletas <span class="ficha-section-count">0</span></h2>
        <div class="empty-state"><div class="empty-state-title">Sin boletas registradas</div></div>
      </section>`;
    }
    const totalPagado = boletas.filter(b => b.pagada).reduce((a, b) => a + b.monto, 0);
    const totalPendiente = boletas.filter(b => !b.pagada).reduce((a, b) => a + b.monto, 0);
    return `<section class="ficha-section">
      <h2 class="ficha-section-title">
        Historial de boletas <span class="ficha-section-count">${boletas.length}</span>
        <span class="ficha-section-hint">${UI.fmtCLP(totalPagado)} cobrado · ${UI.fmtCLP(totalPendiente)} pendiente</span>
      </h2>
      <div class="boletas-list">
        ${boletas.map(b => `
          <div class="boleta-row ${b.pagada ? 'pagada' : 'pendiente'}">
            <div class="boleta-mes">${UI.esc(Reportes._mesLabel(b.mes))}</div>
            <div class="boleta-info">
              <div class="boleta-monto mono">${UI.fmtCLP(b.monto)}</div>
              <div class="boleta-detalle">${b.sesiones} sesiones · ${(b.minutos/60).toFixed(1)}h</div>
            </div>
            <div class="boleta-estado">
              ${b.pagada
                ? `<span class="estado-pill realizada">Pagada</span>`
                : `<span class="estado-pill no_asistio">Pendiente</span>`}
            </div>
            <div class="boleta-actions">
              ${b.pagada
                ? `<button class="btn btn-ghost boleta-revertir" data-bid="${b.id}" style="height:28px;padding:0 8px;font-size:11px">Revertir</button>`
                : `<button class="btn btn-primary boleta-pagar-inline" data-bid="${b.id}" style="height:28px;padding:0 10px;font-size:11px">Marcar pagada</button>`}
            </div>
          </div>
        `).join('')}
      </div>
    </section>`;
  },

  // ===== Secciones de la ficha unificada =====

  _edadEn(nac, fecha) {
    if (!nac || !fecha) return '';
    const a = new Date(nac + 'T00:00:00'), b = new Date(fecha + 'T00:00:00');
    let años = b.getFullYear() - a.getFullYear();
    let meses = b.getMonth() - a.getMonth();
    if (b.getDate() < a.getDate()) meses--;
    if (meses < 0) { años--; meses += 12; }
    return `${años}a ${meses}m`;
  },

  _seccionHorarioSemana(n) {
    const fechas = fechasSemana();
    const ses = Data.sesionesDeNino(n.id_nino).filter(s => fechas.includes(s.fecha) && s.tipo_actividad !== 'Reunión de equipo' && !esSesionSoloPadres(s));
    if (!ses.length) return '';
    const primer = (n.nombre_completo || '').split(' ')[0];
    const porDia = fechas.map(f => ses.filter(s => s.fecha === f).sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || '')));
    const cols = fechas.map((f, i) => {
      const dnum = Number(f.split('-')[2]);
      const items = porDia[i];
      const cuerpo = items.length
        ? items.map(s => {
            const t = Data.terapeuta(s.id_terapeuta);
            const sala = Data.sala(s.id_sala);
            const c = ESPECIALIDAD_VAR[s.tipo_terapia] || {};
            const salaTxt = sala?.nombre || s.sala_nombre;
            return `<div class="hsem-item" style="border-left-color:${c.main || 'var(--cn-azul)'}"><span class="mono">${UI.esc(s.hora_inicio || '')}</span> ${UI.esc(s.tipo_terapia || '')}<small>${UI.esc(t?.abreviacion || '')}${salaTxt && salaTxt !== '—' ? ` · ${UI.esc(salaTxt)}` : ''}</small></div>`;
          }).join('')
        : '<div class="hsem-empty">—</div>';
      return `<div class="hsem-day"><div class="hsem-day-h">${DIAS_ABBR[i]} ${dnum}</div><div class="hsem-day-body">${cuerpo}</div></div>`;
    }).join('');
    return `<section class="ficha-section">
      <h2 class="ficha-section-title">Horario de la semana</h2>
      <div class="ficha-section-hint">Todas las sesiones de ${UI.esc(primer)} esta semana — para coordinar traspasos (con quién tiene antes y después).</div>
      <div class="hsem-grid">${cols}</div>
    </section>`;
  },

  _seccionCiclos(n) {
    const hist = Data.historialDeNino(n.id_nino);
    const prog = Data.programa(n.id_programa);
    const fmtMes = (f) => { const m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']; const [y, mm] = f.split('-').map(Number); return `${m[mm - 1]} ${y}`; };
    const ICON = {
      'Evaluación inicial': '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
      'Intensivo': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
      'Seguimiento': '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
    };
    const icono = (t) => `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">${ICON[t] || ICON['Intensivo']}</svg>`;

    // Hito en curso (programa vigente del niño) — muestra el set completo que Trini pidió ver dentro de cada intensivo
    const equipoActual = Data.equipoDeNino(n.id_nino).map(e => Data.terapeuta(e.id_terapeuta)).filter(Boolean);
    const objCurso = Data.objetivosDeNino(n.id_nino);
    const sesCurso = Data.sesionesDeNino(n.id_nino).filter(s => s.tipo_actividad !== 'Reunión de equipo');
    const realCurso = sesCurso.filter(s => s.estado === 'Realizada').length;
    const reuCurso = this._leerReuniones(n.id_nino).length;
    const docsCurso = Data.documentosDeNino(n.id_nino).length;
    const enCurso = `
      <details class="fhist-item fhist-curso" open>
        <summary class="fhist-head">
          <span class="fhist-dot fhist-dot-curso">${icono('Intensivo')}</span>
          <span class="fhist-main">
            <span class="fhist-title">${UI.esc(prog?.nombre || n.programa_nombre || 'Programa')} · en curso</span>
            <span class="fhist-meta">${n.fecha_inicio_programa ? fmtMes(n.fecha_inicio_programa) : ''} · semana ${n.semana_actual || '—'} de ${prog?.duracion_semanas || '—'} · ${this._edadEn(n.fecha_nacimiento, n.fecha_inicio_programa)}</span>
          </span>
          <span class="fhist-badge fhist-badge-curso">En curso</span>
          <svg class="fhist-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </summary>
        <div class="fhist-body">
          <div class="fhist-row"><span class="fhist-row-label">Equipo tratante</span><div class="fhist-chips">${equipoActual.map(t => `<span class="fhist-chip">${UI.esc(t.abreviacion)} · ${UI.esc(t.especialidad)}</span>`).join('') || '—'}</div></div>
          <div class="fhist-row"><span class="fhist-row-label">Registro de atenciones</span><span>${realCurso} de ${sesCurso.length} sesiones realizadas</span></div>
          <div class="fhist-row"><span class="fhist-row-label">Objetivos trabajados</span><span>${objCurso.length} objetivos en seguimiento</span></div>
          <div class="fhist-row"><span class="fhist-row-label">Reuniones</span><span>${reuCurso} registrada${reuCurso===1?'':'s'}</span></div>
          <div class="fhist-row"><span class="fhist-row-label">Documentos</span><span>${docsCurso} en la ficha</span></div>
          <button class="btn btn-secondary btn-sm fhist-export" data-hidx="curso" style="margin-top:10px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Exportar este intensivo</button>
        </div>
      </details>`;

    const items = hist.map((h, hi) => {
      const rango = h.fecha_termino ? `${fmtMes(h.fecha_inicio)} – ${fmtMes(h.fecha_termino)}` : fmtMes(h.fecha_inicio);
      const edad = this._edadEn(n.fecha_nacimiento, h.fecha_inicio);
      const sub = [rango, h.semanas ? `${h.semanas} semanas` : '', edad].filter(Boolean).join(' · ');
      const cuerpo = `
        <div class="fhist-body">
          ${h.resumen ? `<p class="fhist-resumen">${UI.esc(h.resumen)}</p>` : ''}
          ${h.horario_resumen ? `<div class="fhist-row"><span class="fhist-row-label">Horario</span><div class="fhist-chips">${h.horario_resumen.map(x => `<span class="fhist-chip">${UI.esc(x)}</span>`).join('')}</div></div>` : ''}
          ${h.sesiones_realizadas != null ? `<div class="fhist-row"><span class="fhist-row-label">Registros</span><span>${h.sesiones_realizadas} de ${h.sesiones_totales} sesiones realizadas</span></div>` : ''}
          ${h.objetivos ? `<div class="fhist-row"><span class="fhist-row-label">Objetivos</span><ul class="fhist-obj">${h.objetivos.map(o => `<li>${UI.esc(o)}</li>`).join('')}</ul></div>` : ''}
          ${h.informe ? `<button class="btn btn-secondary btn-sm doc-download fhist-doc"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> ${UI.esc(h.informe.tipo)}</button>` : ''}
          <button class="btn btn-secondary btn-sm fhist-export" data-hidx="${hi}" style="margin-top:8px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Exportar este ${UI.esc((h.tipo || 'evento').toLowerCase())}</button>
        </div>`;
      return `
        <details class="fhist-item">
          <summary class="fhist-head">
            <span class="fhist-dot">${icono(h.tipo)}</span>
            <span class="fhist-main">
              <span class="fhist-title">${UI.esc(h.nombre ? `${h.tipo} · ${h.nombre}` : h.tipo)}</span>
              <span class="fhist-meta">${UI.esc(sub)}</span>
            </span>
            <span class="fhist-badge">${UI.esc(h.estado || '')}</span>
            <svg class="fhist-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </summary>
          ${cuerpo}
        </details>`;
    }).join('');

    return `<section class="ficha-section">
      <h2 class="ficha-section-title">Historia de vida <span class="ficha-section-count">${hist.length}</span></h2>
      <div class="ficha-section-hint">Dentro de cada intensivo: horario, equipo tratante, objetivos trabajados, registro de atenciones, informes, reuniones y documentos.</div>
      ${hist.length === 0
        ? `<div class="empty-state"><div class="empty-state-title">Sin ciclos anteriores</div><div class="empty-state-sub">Cuando se cierre un intensivo, queda aquí su horario, registros, objetivos e informe.</div></div>`
        : `<div class="fhist-timeline">${enCurso}${items}</div>`}
    </section>`;
  },

  // Teléfono clicable → WhatsApp web; email clicable → correo
  _telLink(tel) {
    if (!tel) return '<span class="panel-field-value mono">—</span>';
    const num = String(tel).replace(/[^\d]/g, '');
    return `<a class="panel-field-value mono ficha-contacto" href="https://wa.me/${num}" target="_blank" rel="noopener" title="Abrir WhatsApp">${UI.esc(tel)}</a>`;
  },
  _mailLink(mail) {
    if (!mail) return '<span class="panel-field-value">—</span>';
    return `<a class="panel-field-value ficha-contacto" href="mailto:${UI.esc(mail)}" title="Enviar correo">${UI.esc(mail)}</a>`;
  },

  _seccionDatos(n) {
    const edad = this._edadEn(n.fecha_nacimiento, HOY_ISO) || (n.edad_anios ? `${n.edad_anios} años` : '');
    // La madre/apoderada usa telefono_apoderado/email_apoderado por compatibilidad con la data actual
    const madre = n.madre || n.apoderado_principal;
    const telMadre = n.telefono_madre || n.telefono_apoderado;
    const emailMadre = n.email_madre || n.email_apoderado;
    return `<section class="ficha-section">
      <h2 class="ficha-section-title">Datos generales</h2>
      <div class="info-grid">
        <div class="panel-field"><span class="panel-field-label">Fecha de nacimiento</span><span class="panel-field-value mono">${UI.fmtFechaCorta(n.fecha_nacimiento)}${edad ? ` · <span style="font-family:var(--font)">${UI.esc(edad)}</span>` : ''}</span></div>
        <div class="panel-field"><span class="panel-field-label">Estado civil de los padres</span><span class="panel-field-value">${UI.esc(n.estado_civil_padres) || '<span style="color:var(--text-3)">Por agregar</span>'}</span></div>
        <div class="panel-field"><span class="panel-field-label">Madre / apoderada</span><span class="panel-field-value">${UI.esc(madre) || '<span style="color:var(--text-3)">Por agregar</span>'}</span></div>
        <div class="panel-field"><span class="panel-field-label">Teléfono madre</span>${this._telLink(telMadre)}</div>
        <div class="panel-field"><span class="panel-field-label">Email madre</span>${this._mailLink(emailMadre)}</div>
        <div class="panel-field"><span class="panel-field-label">Padre / apoderado</span><span class="panel-field-value">${UI.esc(n.padre) || '<span style="color:var(--text-3)">Por agregar</span>'}</span></div>
        <div class="panel-field"><span class="panel-field-label">Teléfono padre</span>${this._telLink(n.telefono_padre)}</div>
        <div class="panel-field"><span class="panel-field-label">Email padre</span>${this._mailLink(n.email_padre)}</div>
        <div class="panel-field"><span class="panel-field-label">Colegio</span><span class="panel-field-value">${UI.esc(n.colegio || '—')}</span></div>
        <div class="panel-field"><span class="panel-field-label">Médico externo</span><span class="panel-field-value">${UI.esc(n.medico_externo || '—')}</span></div>
        <div class="panel-field"><span class="panel-field-label">Alergias</span><span class="panel-field-value">${UI.esc(n.alergias || 'Sin alergias reportadas')}</span></div>
        <div class="panel-field"><span class="panel-field-label">Consideraciones</span><span class="panel-field-value">${UI.esc(n.consideraciones || '—')}</span></div>
        <div class="panel-field" style="grid-column:1/-1">
          <span class="panel-field-label">Diagnósticos</span>
          <div>${(n.diagnosticos||[]).map(d=>`<span class="badge" style="background:var(--cn-azul-bg);color:var(--cn-azul-deep);margin-right:4px">${UI.esc(d)}</span>`).join('') || '<span style="color:var(--text-3)">Por agregar</span>'}</div>
        </div>
      </div>
    </section>`;
  },

  // Modal de edición de datos generales del niño (persiste vía Data.guardarNino)
  _DIAG_COMUNES: ['TEA Nivel 1', 'TEA Nivel 2', 'TEA Nivel 3', 'TDAH', 'TEL (Trastorno específico del lenguaje)', 'Discapacidad intelectual', 'Síndrome de Down', 'Trastorno del procesamiento sensorial'],
  _ESTADOS_CIVILES: ['Casados', 'Convivientes', 'Separados', 'Divorciados', 'Soltero/a', 'Viudo/a'],
  _abrirEditarDatos(n) {
    const madre = n.madre || n.apoderado_principal || '';
    const telMadre = n.telefono_madre || n.telefono_apoderado || '';
    const emailMadre = n.email_madre || n.email_apoderado || '';
    const diagsActuales = new Set(n.diagnosticos || []);
    const listaDiag = [...new Set([...this._DIAG_COMUNES, ...diagsActuales])];
    const f = (label, id, val, ph) => `<div class="cfg-field"><label>${label}</label><input id="${id}" value="${UI.esc(val || '')}" placeholder="${ph || ''}"></div>`;
    const html = `
      <div class="pendiente-modal-overlay" id="edDatosOverlay">
        <div class="pendiente-modal" style="width:min(560px,94vw)">
          <div class="pendiente-modal-head">
            <div><div class="pendiente-modal-title">Editar datos generales</div><div class="pendiente-modal-eyebrow">${UI.esc(n.nombre_completo)}</div></div>
            <button class="panel-close" id="edDatosClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="pendiente-modal-body" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px">
            <div class="cfg-field" style="grid-column:1/-1"><label>Estado civil de los padres</label>
              <select id="ed-estciv">
                <option value="">— sin especificar —</option>
                ${this._ESTADOS_CIVILES.map(e => `<option ${n.estado_civil_padres === e ? 'selected' : ''}>${e}</option>`).join('')}
              </select>
            </div>
            <div class="cfg-field" style="grid-column:1/-1"><div class="cfg-card-sub" style="font-weight:700;color:var(--text-2);letter-spacing:.04em;text-transform:uppercase;font-size:11px">Madre / apoderada</div></div>
            ${f('Nombre', 'ed-madre', madre, 'Nombre de la madre')}
            ${f('Teléfono', 'ed-tel-madre', telMadre, '+569…')}
            <div class="cfg-field" style="grid-column:1/-1"><label>Email madre</label><input id="ed-email-madre" value="${UI.esc(emailMadre)}" placeholder="correo@…"></div>
            <div class="cfg-field" style="grid-column:1/-1"><div class="cfg-card-sub" style="font-weight:700;color:var(--text-2);letter-spacing:.04em;text-transform:uppercase;font-size:11px">Padre / apoderado</div></div>
            ${f('Nombre', 'ed-padre', n.padre, 'Nombre del padre')}
            ${f('Teléfono', 'ed-tel-padre', n.telefono_padre, '+569…')}
            <div class="cfg-field" style="grid-column:1/-1"><label>Email padre</label><input id="ed-email-padre" value="${UI.esc(n.email_padre)}" placeholder="correo@…"></div>
            <div class="cfg-field" style="grid-column:1/-1"><label>Diagnósticos <small style="font-weight:400;color:var(--text-3)">· marca todos los que apliquen</small></label>
              <div class="ed-diag-list" id="ed-diag-list">
                ${listaDiag.map(d => `<label class="ed-diag-chk"><input type="checkbox" data-diag value="${UI.esc(d)}" ${diagsActuales.has(d) ? 'checked' : ''}><span>${UI.esc(d)}</span></label>`).join('')}
              </div>
              <div class="ed-diag-add"><input id="ed-diag-otro" placeholder="Otro diagnóstico…"><button class="btn btn-ghost btn-sm" id="ed-diag-add-btn" type="button">Agregar</button></div>
            </div>
            ${f('Colegio', 'ed-colegio', n.colegio, '')}
            ${f('Médico externo', 'ed-medico', n.medico_externo, '')}
            <div class="cfg-field" style="grid-column:1/-1"><label>Alergias</label><input id="ed-alergias" value="${UI.esc(n.alergias || '')}" placeholder="Sin alergias reportadas"></div>
            <div class="cfg-field" style="grid-column:1/-1"><label>Consideraciones</label><input id="ed-consid" value="${UI.esc(n.consideraciones || '')}"></div>
          </div>
          <div class="pendiente-modal-foot">
            <button class="btn btn-ghost" id="edDatosCancel">Cancelar</button>
            <button class="btn btn-primary" id="edDatosSave">Guardar cambios</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const overlay = document.getElementById('edDatosOverlay');
    const close = () => overlay?.remove();
    document.getElementById('edDatosClose').addEventListener('click', close);
    document.getElementById('edDatosCancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    // "Otro" diagnóstico → agrega un checkbox marcado a la lista
    document.getElementById('ed-diag-add-btn').addEventListener('click', () => {
      const inp = document.getElementById('ed-diag-otro');
      const v = inp.value.trim();
      if (!v) return;
      const yaEsta = [...overlay.querySelectorAll('input[data-diag]')].some(c => c.value.toLowerCase() === v.toLowerCase());
      if (!yaEsta) {
        document.getElementById('ed-diag-list').insertAdjacentHTML('beforeend',
          `<label class="ed-diag-chk"><input type="checkbox" data-diag value="${UI.esc(v)}" checked><span>${UI.esc(v)}</span></label>`);
      }
      inp.value = '';
    });
    document.getElementById('edDatosSave').addEventListener('click', () => {
      const val = id => (document.getElementById(id)?.value || '').trim();
      const diagnosticos = [...overlay.querySelectorAll('input[data-diag]:checked')].map(c => c.value);
      Data.guardarNino(n.id_nino, {
        estado_civil_padres: val('ed-estciv') || null,
        madre: val('ed-madre') || null,
        telefono_madre: val('ed-tel-madre') || null,
        email_madre: val('ed-email-madre') || null,
        padre: val('ed-padre') || null,
        telefono_padre: val('ed-tel-padre') || null,
        email_padre: val('ed-email-padre') || null,
        diagnosticos,
        colegio: val('ed-colegio') || null,
        medico_externo: val('ed-medico') || null,
        alergias: val('ed-alergias') || null,
        consideraciones: val('ed-consid') || null,
      });
      close();
      this.render();
      UI.toast('Datos actualizados', 'success');
    });
  },

  _seccionEquipo(equipo) {
    return `<section class="ficha-section">
      <h2 class="ficha-section-title">Equipo terapéutico <span class="ficha-section-count">${equipo.length}</span></h2>
      ${equipo.length === 0 ? `<div class="empty-state"><div class="empty-state-title">Sin equipo asignado</div></div>` : `
        <div class="equipo-list">
          ${equipo.map(e => {
            const t = Data.terapeuta(e.id_terapeuta);
            const c = ESPECIALIDAD_VAR[e.area] || ESPECIALIDAD_VAR['Terapia Ocupacional'];
            return `<div class="equipo-row">
              <span class="equipo-avatar" style="background:${c.bg};color:${c.text}">${UI.esc(t?.abreviacion || '—')}</span>
              <div>
                <div style="font-weight:600">${UI.esc(t?.nombre_completo || e.terapeuta_visible)}</div>
                <div style="font-size:12px;color:var(--text-3)">${UI.esc(e.area)} · ${UI.esc(e.rol)}</div>
              </div>
              <span class="badge" style="background:${c.bg};color:${c.text}">${UI.esc(e.rol)}</span>
            </div>`;
          }).join('')}
        </div>
      `}
    </section>`;
  },

  _seccionHistorial(sesiones) {
    // El terapeuta y coordinación registran aquí la nota de cada sesión.
    const puedeAnotar = State.role === 'terapeuta' || State.role === 'coordinacion';
    const stored = JSON.parse(localStorage.getItem('casanogal_notas') || '{}');
    const hoySes = sesiones
      .filter(s => s.fecha === HOY_ISO)
      .sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
    const futuras = sesiones
      .filter(s => s.estado === 'Agendada' && s.fecha > HOY_ISO)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
    const enHoy = new Set(hoySes.map(s => s.id_sesion));
    const enFut = new Set(futuras.map(s => s.id_sesion));
    // Pasadas: todo lo que no es de hoy ni futura agendada, más reciente primero
    const pasadas = sesiones
      .filter(s => !enHoy.has(s.id_sesion) && !enFut.has(s.id_sesion))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.hora_inicio || '').localeCompare(a.hora_inicio || ''));
    const sinNota = [...hoySes, ...pasadas].filter(s => s.estado === 'Realizada' && !Data.notaPorSesion(s.id_sesion) && !stored[s.id_sesion]).length;

    const proxRow = (s) => {
      const ter = Data.terapeuta(s.id_terapeuta);
      return `<div class="prox-row">
        <span class="timeline-date mono">${UI.fmtFechaCorta(s.fecha)}</span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px">${UI.esc(s.tipo_terapia)} · ${UI.esc(s.hora_inicio)}–${UI.esc(s.hora_fin)}</div>
          <div style="font-size:11px;color:var(--text-3)">${UI.esc(ter?.nombre_visible || '—')} · Sala ${UI.esc(s.sala_nombre)}</div>
        </div>
        <span class="estado-pill agendada">Agendada</span>
      </div>`;
    };

    const histItem = (s) => {
      const notaData = Data.notaPorSesion(s.id_sesion);
      const notaLocalRaw = stored[s.id_sesion];
      const notaLocal = typeof notaLocalRaw === 'string' ? { texto: notaLocalRaw } : notaLocalRaw;
      const notaTexto = (notaLocal && notaLocal.texto) || (notaData && notaData.notas_libres) || '';
      const hayNota = !!notaTexto;
      const ter = Data.terapeuta(s.id_terapeuta);
      const editable = puedeAnotar && s.estado === 'Realizada';
      const faltaNota = editable && !hayNota;
      return `<div class="timeline-item${faltaNota ? ' open nota-pendiente' : ''}" data-sesion-id="${UI.esc(s.id_sesion)}" data-esp="${UI.esc(s.tipo_terapia || '')}" data-mes="${UI.esc((s.fecha || '').slice(0, 7))}">
        <div class="timeline-head">
          <span class="timeline-date mono">${UI.fmtFechaCorta(s.fecha)}</span>
          <div>
            <div style="font-weight:600">${UI.esc(s.tipo_terapia)} · ${UI.esc(s.hora_inicio)}–${UI.esc(s.hora_fin)}</div>
            <div style="font-size:11px;color:var(--text-3)">${UI.esc(ter?.nombre_visible || '—')} · Sala ${UI.esc(s.sala_nombre)}</div>
          </div>
          ${faltaNota ? '<span class="badge" style="background:var(--alert);color:#fff">Sin nota</span>' : ''}
          <span class="estado-pill ${UI.estadoClass(s.estado)}">${UI.esc(s.estado)}</span>
          <button class="timeline-caret" type="button" aria-label="Expandir notas" title="Ver/ocultar notas">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
        <div class="timeline-body">
          ${hayNota ? `
            <p>${UI.esc(notaTexto)}</p>
            ${notaData?.objetivos_trabajados?.length ? `<p style="margin-top:8px"><b>Objetivos trabajados:</b> ${notaData.objetivos_trabajados.map(UI.esc).join(' · ')}</p>` : ''}
            ${notaData?.avance_percibido != null ? `<p style="margin-top:6px"><b>Avance percibido:</b> <span class="mono">${notaData.avance_percibido}/10</span></p>` : ''}
          ` : (editable ? '' : `<p class="empty" style="color:var(--text-3);font-style:italic">Sin nota registrada para esta sesión.</p>`)}
          ${editable && hayNota ? `
            <button class="btn btn-ghost timeline-nota-toggle" type="button" data-sid="${UI.esc(s.id_sesion)}" style="margin-top:8px;height:30px;padding:0 12px;font-size:12px">Editar nota</button>
            <div class="timeline-nota-form" id="notaForm-${UI.esc(s.id_sesion)}" style="display:none;margin-top:8px">
              <textarea class="panel-notes-textarea" id="notaInput-${UI.esc(s.id_sesion)}" placeholder="¿Qué se trabajó en esta sesión?">${UI.esc(notaTexto)}</textarea>
              <div class="panel-notes-actions">
                <button class="btn btn-ghost timeline-nota-cancel" type="button" data-sid="${UI.esc(s.id_sesion)}">Cancelar</button>
                <button class="btn btn-primary timeline-nota-save" type="button" data-sid="${UI.esc(s.id_sesion)}">Guardar nota</button>
              </div>
            </div>
          ` : ''}
          ${faltaNota ? `
            <div class="timeline-nota-form" id="notaForm-${UI.esc(s.id_sesion)}" style="margin-top:6px">
              <div style="font-size:12.5px;font-weight:700;color:var(--alert);margin-bottom:6px">✍ Registra acá lo que trabajaste en esta sesión</div>
              <textarea class="panel-notes-textarea" id="notaInput-${UI.esc(s.id_sesion)}" placeholder="Ej: trabajamos juego simbólico y turnos; respondió bien a la mediación con apoyo visual…"></textarea>
              <div class="panel-notes-actions">
                <button class="btn btn-primary timeline-nota-save" type="button" data-sid="${UI.esc(s.id_sesion)}">Guardar nota</button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>`;
    };

    const lblPasadas = `sesiones pasadas · ${pasadas.length}${sinNota > 0 ? ' · ' + sinNota + ' sin nota' : ''}`;
    const lblFuturas = `futuras agendadas · ${futuras.length}`;

    // Filtros del registro de atenciones (lo pidió Trini): por especialidad y por período.
    const espPasadas = [...new Set(pasadas.map(s => s.tipo_terapia).filter(Boolean))].sort();
    const mesesPasadas = [...new Set(pasadas.map(s => (s.fecha || '').slice(0, 7)).filter(Boolean))].sort().reverse();
    const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const mesLabel = (ym) => { const [y, m] = ym.split('-'); return `${MESES[Number(m)]} ${y}`; };
    const filtrosPasadas = (espPasadas.length > 1 || mesesPasadas.length > 1) ? `
      <div class="hist-filtros">
        <select id="filtroEsp" class="hist-filtro-sel" aria-label="Filtrar por especialidad">
          <option value="">Todas las especialidades</option>
          ${espPasadas.map(e => `<option value="${UI.esc(e)}">${UI.esc(e)}</option>`).join('')}
        </select>
        <select id="filtroMes" class="hist-filtro-sel" aria-label="Filtrar por período">
          <option value="">Todo el período</option>
          ${mesesPasadas.map(m => `<option value="${m}">${UI.esc(mesLabel(m))}</option>`).join('')}
        </select>
        <span class="hist-filtro-count" id="filtroCount"></span>
      </div>` : '';

    return `<section class="ficha-section">
      <h2 class="ficha-section-title">Sesiones${sinNota > 0 ? ` <span class="ficha-section-hint" style="color:var(--alert)">${sinNota} sin nota</span>` : ''}</h2>
      ${hoySes.length ? `
        <div class="hist-sub">Hoy</div>
        <div class="timeline">${hoySes.map(histItem).join('')}</div>
      ` : ''}
      ${futuras.length ? `
        <div class="hist-sub">Próximas sesiones</div>
        <div class="prox-block">${futuras.slice(0, 3).map(proxRow).join('')}</div>
      ` : (hoySes.length ? '' : `<div class="empty-state"><div class="empty-state-title">Sin sesiones próximas</div></div>`)}
      <div class="hist-actions">
        ${pasadas.length ? `<button class="btn btn-ghost" id="verPasadas" type="button" data-label="${lblPasadas}">Revisar ${lblPasadas}</button>` : ''}
        ${futuras.length > 3 ? `<button class="btn btn-ghost" id="verFuturas" type="button" data-label="${lblFuturas}">Revisar ${lblFuturas}</button>` : ''}
      </div>
      <div id="histPasadas" style="display:none">
        <div class="hist-sub">Sesiones pasadas · más reciente primero</div>
        ${filtrosPasadas}
        ${pasadas.length ? `<div class="timeline" id="histPasadasList">${pasadas.slice(0, 40).map(histItem).join('')}</div>` : `<div class="empty-state"><div class="empty-state-title">Sin sesiones pasadas</div></div>`}
      </div>
      <div id="histFuturas" style="display:none">
        <div class="hist-sub">Todas las sesiones agendadas</div>
        <div class="prox-block">${futuras.map(proxRow).join('')}</div>
      </div>
    </section>`;
  },

  // ----- Descargas en Word (pedido de Trini): ficha completa, hoja de vida, tratamiento en curso -----

  _docH2(t) { return `<h2 style="font-size:16px;color:#1B6B8A;border-bottom:2px solid #1B6B8A;padding-bottom:4px;margin-top:16px">${UI.esc(t)}</h2>`; },

  // Bloque de datos COMPLETOS del niño (identificación, estado actual, familia, antecedentes)
  _docDatosNino(n) {
    const esc = UI.esc;
    const v = (x) => (x != null && x !== '') ? esc(x) : '<span style="color:#94a3b8">Por registrar</span>';
    const fila = (k, val) => `<tr><td style="padding:5px 10px;border:1px solid #cbd5e1;background:#f1f5f9;font-weight:bold;width:210px">${k}</td><td style="padding:5px 10px;border:1px solid #cbd5e1">${val}</td></tr>`;
    const T = 'border-collapse:collapse;width:100%;font-size:13px;margin-bottom:6px';
    const edad = this._edadEn(n.fecha_nacimiento, HOY_ISO);
    const term = n.fecha_termino_programa;
    const enCurso = !term || term >= HOY_ISO;
    const status = (n.estado === 'Activo')
      ? (enCurso ? `<b style="color:#166534">En atención</b> · ${esc(n.programa_nombre || '')}${n.semana_actual ? ` (semana ${n.semana_actual})` : ''}` : `Activo · alta vencida (${esc(term)})`)
      : `<b>${esc(n.estado || '—')}</b>`;
    const madre = n.madre || n.apoderado_principal;
    return `
      ${this._docH2('Identificación')}
      <table style="${T}">
        ${fila('Nombre completo', v(n.nombre_completo))}
        ${fila('RUT', v(n.rut))}
        ${fila('Fecha de nacimiento', n.fecha_nacimiento ? `${esc(UI.fmtFechaCorta(n.fecha_nacimiento))} · ${esc(edad)}` : v(null))}
        ${fila('Diagnósticos', (n.diagnosticos && n.diagnosticos.length) ? esc(n.diagnosticos.join(', ')) : v(null))}
        ${fila('Colegio / jardín', v(n.colegio))}
        ${fila('Médico externo', v(n.medico_externo))}
        ${fila('Alergias', v(n.alergias))}
        ${fila('Consideraciones', v(n.consideraciones))}
        ${fila('Primera evaluación', v(n.fecha_primera_evaluacion))}
        ${fila('Ingreso a Casa Nogal', v(n.fecha_creacion))}
      </table>
      ${this._docH2('Estado actual')}
      <table style="${T}">
        ${fila('Situación', status)}
        ${fila('Programa', v(n.programa_nombre))}
        ${fila('Período del programa', (n.fecha_inicio_programa || term) ? `${esc(n.fecha_inicio_programa || '—')} → ${esc(term || '—')}` : v(null))}
        ${fila('Frecuencia', n.frecuencia_semanal ? `${n.frecuencia_semanal} sesiones por semana` : v(null))}
        ${fila('Jornada', v(n.horario_tipo))}
      </table>
      ${this._docH2('Situación familiar')}
      <table style="${T}">
        ${fila('Madre / apoderada', v(madre))}
        ${fila('Teléfono madre', v(n.telefono_madre || n.telefono_apoderado))}
        ${fila('Email madre', v(n.email_madre || n.email_apoderado))}
        ${fila('Padre / apoderado', v(n.padre))}
        ${fila('Teléfono padre', v(n.telefono_padre))}
        ${fila('Email padre', v(n.email_padre))}
        ${fila('Estado civil de los padres', v(n.estado_civil_padres))}
        ${fila('Dirección', v(n.direccion))}
      </table>`;
  },

  // Tabla de sesiones reutilizable. conNota=true agrega la columna de registro clínico.
  _docTablaSesiones(arr, conNota) {
    const esc = UI.esc;
    const DIA = { lunes: 'Lun', martes: 'Mar', 'miércoles': 'Mié', jueves: 'Jue', viernes: 'Vie', 'sábado': 'Sáb', domingo: 'Dom' };
    let stored = {};
    if (conNota) { try { stored = JSON.parse(localStorage.getItem('casanogal_notas') || '{}') || {}; } catch {} }
    const filas = arr.map(s => {
      const ter = Data.terapeuta(s.id_terapeuta);
      const modal = (s.tipo_actividad && s.tipo_actividad !== 'Sesión') ? ` <i>(${esc(s.tipo_actividad)})</i>` : '';
      let notaCell = '';
      if (conNota) {
        const base = Data.notaPorSesion(s.id_sesion);
        const locRaw = stored[s.id_sesion];
        const loc = typeof locRaw === 'string' ? { texto: locRaw } : locRaw;
        const texto = (loc && loc.texto) || (base && base.notas_libres) || '';
        const objs = (base && base.objetivos_trabajados) || [];
        const av = base ? base.avance_percibido : null;
        notaCell = `<td>${texto ? esc(texto) : '<span style="color:#999">— sin nota —</span>'}${objs.length ? `<br><i>Objetivos: ${objs.map(esc).join(' · ')}</i>` : ''}${av != null ? `<br><b>Avance: ${av}/10</b>` : ''}</td>`;
      }
      return `<tr>
        <td>${esc(UI.fmtFechaCorta(s.fecha))} ${esc(DIA[s.dia_semana] || '')}</td>
        <td>${esc(s.hora_inicio || '')}</td>
        <td>${esc(s.tipo_terapia || '')}${modal}</td>
        <td>${esc(ter?.nombre_completo || s.terapeuta_abr || '—')}</td>
        <td>${esc(s.sala_nombre || '—')}</td>
        <td>${esc(s.estado || '')}</td>
        ${notaCell}
      </tr>`;
    }).join('');
    return `<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;font-size:11.5px">
      <tr style="background:#EAF2F5"><th>Fecha</th><th>Hora</th><th>Terapia</th><th>Terapeuta</th><th>Sala</th><th>Estado</th>${conNota ? '<th>Registro / notas / avance</th>' : ''}</tr>
      ${filas}
    </table>`;
  },

  _docIntensivosPasados(n) {
    const esc = UI.esc;
    const hist = Data.historialDeNino(n.id_nino);
    if (!hist.length) return '<p style="font-size:13px">Sin intensivos anteriores registrados.</p>';
    return `<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;font-size:12px">
      <tr style="background:#EAF2F5"><th>Ciclo</th><th>Período</th><th>Estado</th><th>Resumen</th><th>Informe</th></tr>
      ${hist.map(h => `<tr><td>${esc(h.tipo || '')}</td><td>${esc(h.fecha_inicio || '')}${h.fecha_termino ? `–${esc(h.fecha_termino)}` : ''}</td><td>${esc(h.estado || '')}</td><td>${esc(h.resumen || '—')}</td><td>${h.informe ? esc(h.informe.nombre_archivo || h.informe.tipo || 'sí') : '—'}</td></tr>`).join('')}
    </table>`;
  },

  // EXPORT 1 · Ficha completa
  _fichaDocHtml(n) {
    const esc = UI.esc;
    const equipo = Data.equipoDeNino(n.id_nino).map(e => { const t = Data.terapeuta(e.id_terapeuta); return t ? `<li>${esc(t.nombre_completo)} · ${esc(e.area || t.especialidad || '')} · ${esc(e.rol || '')}</li>` : ''; }).filter(Boolean);
    const objetivos = Data.objetivosDeNino(n.id_nino);
    const objHtml = objetivos.length
      ? `<ul>${objetivos.map(o => `<li><b>${esc(o.area || '')}:</b> ${esc(o.descripcion || '')} <i>(${esc(o.estado || '')})</i>${o.fecha_estimada_logro ? ` · meta ${esc(o.fecha_estimada_logro)}` : ''}</li>`).join('')}</ul>`
      : '<p>Sin objetivos planteados.</p>';
    const ses = Data.sesionesDeNino(n.id_nino).filter(s => s.tipo_actividad !== 'Reunión de equipo');
    const real = ses.filter(s => s.estado === 'Realizada').length;
    return `
      ${this._docDatosNino(n)}
      ${this._docH2('Equipo tratante actual')}
      <ul style="font-size:13px">${equipo.join('') || '<li>—</li>'}</ul>
      ${this._docH2('Objetivos terapéuticos')}
      <div style="font-size:13px">${objHtml}</div>
      ${this._docH2('Intensivos y ciclos anteriores')}
      ${this._docIntensivosPasados(n)}
      ${this._docH2('Resumen de atenciones')}
      <p style="font-size:13px">${ses.length} atenciones registradas · ${real} realizadas en Casa Nogal.</p>`;
  },

  _descargarDoc(titulo, cuerpo, filename) {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${titulo}</title></head>
      <body style="font-family:Calibri,Arial,sans-serif">
        <h1 style="font-size:20px;color:#1B6B8A">Casa Nogal · ${titulo}</h1>
        ${cuerpo}
      </body></html>`;
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  },

  _descargarFicha(n) {
    this._descargarDoc(`Ficha clínica · ${n.nombre_completo}`, this._fichaDocHtml(n), `ficha-${n.nombre_completo.replace(/\s+/g, '-').toLowerCase()}.doc`);
    UI.toast(`Ficha de ${n.nombre_completo.split(' ')[0]} descargada`, 'success');
  },

  // Exporta a Word el detalle de UN evento (intensivo/evaluación/seguimiento) de la Historia de vida.
  _exportarEvento(n, hidx) {
    const esc = UI.esc;
    let titulo, cuerpo;
    if (hidx === 'curso') {
      const prog = Data.programa(n.id_programa);
      const equipo = Data.equipoDeNino(n.id_nino).map(e => Data.terapeuta(e.id_terapeuta)).filter(Boolean);
      const obj = Data.objetivosDeNino(n.id_nino);
      const ses = Data.sesionesDeNino(n.id_nino).filter(s => s.tipo_actividad !== 'Reunión de equipo');
      const real = ses.filter(s => s.estado === 'Realizada').length;
      const reus = this._leerReuniones(n.id_nino);
      titulo = `${prog?.nombre || n.programa_nombre || 'Programa'} en curso · ${n.nombre_completo}`;
      cuerpo = `
        <h1>${esc(titulo)}</h1>
        <p><b>Paciente:</b> ${esc(n.nombre_completo)} · ${esc(this._edadEn(n.fecha_nacimiento, HOY_ISO))}</p>
        <p><b>Inicio:</b> ${esc(n.fecha_inicio_programa || '—')} · <b>Semana:</b> ${esc(String(n.semana_actual || '—'))}</p>
        <h2>Equipo tratante</h2><ul>${equipo.map(t => `<li>${esc(t.nombre_completo)} · ${esc(t.especialidad)}</li>`).join('') || '<li>—</li>'}</ul>
        <h2>Registro de atenciones</h2><p>${real} de ${ses.length} sesiones realizadas.</p>
        <h2>Objetivos trabajados</h2><ul>${obj.map(o => `<li>${esc(o.descripcion)}${o.estado ? ` (${esc(o.estado)})` : ''}</li>`).join('') || '<li>—</li>'}</ul>
        <h2>Reuniones</h2><ul>${reus.map(r => `<li>${esc(r.fecha)} · ${esc(r.tipo)} · con ${esc(r.con)}${r.acta ? `<br><i>${esc(r.acta)}</i>` : ''}</li>`).join('') || '<li>—</li>'}</ul>`;
    } else {
      const h = Data.historialDeNino(n.id_nino)[hidx];
      if (!h) { UI.toast('No se encontró el evento', 'error'); return; }
      const rango = h.fecha_termino ? `${h.fecha_inicio} – ${h.fecha_termino}` : h.fecha_inicio;
      titulo = `${h.tipo}${h.nombre ? ` · ${h.nombre}` : ''} · ${n.nombre_completo}`;
      cuerpo = `
        <h1>${esc(titulo)}</h1>
        <p><b>Paciente:</b> ${esc(n.nombre_completo)}</p>
        <p><b>Período:</b> ${esc(rango)}${h.semanas ? ` · ${esc(String(h.semanas))} semanas` : ''}</p>
        ${h.resumen ? `<h2>Resumen</h2><p>${esc(h.resumen)}</p>` : ''}
        ${h.horario_resumen ? `<h2>Horario</h2><ul>${h.horario_resumen.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${h.sesiones_realizadas != null ? `<h2>Registro de atenciones</h2><p>${h.sesiones_realizadas} de ${h.sesiones_totales} sesiones realizadas.</p>` : ''}
        ${h.objetivos ? `<h2>Objetivos</h2><ul>${h.objetivos.map(o => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
        ${h.informe ? `<p><b>Informe:</b> ${esc(h.informe.tipo)}</p>` : ''}`;
    }
    this._descargarDoc(titulo, cuerpo, `${(titulo || 'evento').replace(/[^\wáéíóúñ]+/gi, '-').toLowerCase()}.doc`);
    UI.toast('Evento exportado', 'success');
  },

  // EXPORT 2 · HOJA DE VIDA: la ficha completa + toda la trayectoria de atenciones en Casa Nogal,
  // sesión por sesión (horario, terapeuta, estado, nota, objetivos trabajados y avance), agrupada
  // por semana, más reuniones con acta y documentos. (Pedido de Trini 2026-07-07.)
  _exportarRegistroCompleto(n) {
    const esc = UI.esc;
    const ses = Data.sesionesDeNino(n.id_nino)
      .filter(s => s.tipo_actividad !== 'Reunión de equipo')
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
    if (!ses.length) { UI.toast('Este niño no tiene atenciones registradas', 'warning'); return; }

    const lunesDe = (iso) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
    const baseLunes = lunesDe(n.fecha_inicio_programa || ses[0].fecha);
    const semanaDe = (iso) => Math.floor((lunesDe(iso) - baseLunes) / (7 * 86400000)) + 1;
    const porSemana = {};
    ses.forEach(s => { const w = semanaDe(s.fecha); (porSemana[w] = porSemana[w] || []).push(s); });
    const semanasHtml = Object.keys(porSemana).sort((a, b) => a - b).map(w => {
      const real = porSemana[w].filter(s => s.estado === 'Realizada').length;
      return `<h3 style="color:#1B6B8A;margin:14px 0 4px">Semana ${w} <span style="font-size:12px;font-weight:400;color:#666">(${real} de ${porSemana[w].length} realizadas)</span></h3>
        ${this._docTablaSesiones(porSemana[w], true)}`;
    }).join('');

    const reus = this._leerReuniones(n.id_nino).map(r => `<li>${esc(r.fecha || '')} · ${esc(r.tipo || '')} · con ${esc(r.con || '')}${r.acta ? `<br><i>${esc(r.acta)}</i>` : ''}</li>`);
    const docs = Data.documentosDeNino(n.id_nino).map(d => `<li>${esc(d.tipo || '')} · ${esc(d.nombre_archivo || '')}${d.fecha_documento ? ` · ${esc(d.fecha_documento)}` : ''}</li>`);
    const totalReal = ses.filter(s => s.estado === 'Realizada').length;

    const cuerpo = `
      ${this._docDatosNino(n)}
      ${this._docH2('Intensivos y ciclos anteriores')}
      ${this._docIntensivosPasados(n)}
      <h1 style="color:#1B6B8A;margin-top:22px;border-top:2px solid #1B6B8A;padding-top:10px">Trayectoria de atenciones en Casa Nogal</h1>
      <p style="font-size:13px">${ses.length} atenciones · ${totalReal} realizadas. Cada sesión con su terapeuta, estado y registro clínico.</p>
      ${semanasHtml}
      ${this._docH2('Reuniones')}<ul style="font-size:13px">${reus.join('') || '<li>—</li>'}</ul>
      ${this._docH2('Documentos')}<ul style="font-size:13px">${docs.join('') || '<li>—</li>'}</ul>`;
    this._descargarDoc(`Hoja de vida · ${n.nombre_completo}`, cuerpo, `hoja-de-vida-${n.nombre_completo.replace(/\s+/g, '-').toLowerCase()}.doc`);
    UI.toast(`Hoja de vida de ${n.nombre_completo.split(' ')[0]} descargada`, 'success');
  },

  // EXPORT 3 · TRATAMIENTO EN CURSO: solo el programa/intensivo actual — lo ya realizado (pasado)
  // y las horas agendadas pendientes. (Pedido de Trini 2026-07-07.)
  _exportarEnCurso(n) {
    const esc = UI.esc;
    const prog = Data.programa(n.id_programa);
    const ses = Data.sesionesDeNino(n.id_nino)
      .filter(s => s.tipo_actividad !== 'Reunión de equipo' && (!n.id_programa || !s.id_programa || s.id_programa === n.id_programa))
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
    if (!ses.length) { UI.toast('No hay sesiones del tratamiento en curso', 'warning'); return; }
    const pendientes = ses.filter(s => s.estado === 'Agendada' && (s.fecha || '') >= HOY_ISO);
    const pasadas = ses.filter(s => !(s.estado === 'Agendada' && (s.fecha || '') >= HOY_ISO));
    const real = pasadas.filter(s => s.estado === 'Realizada').length;

    const cuerpo = `
      <p><b>Paciente:</b> ${esc(n.nombre_completo)} · ${esc(this._edadEn(n.fecha_nacimiento, HOY_ISO))}</p>
      <p><b>Programa:</b> ${esc(prog?.nombre || n.programa_nombre || '—')}${n.fecha_inicio_programa ? ` · ${esc(n.fecha_inicio_programa)} → ${esc(n.fecha_termino_programa || '—')}` : ''}${n.semana_actual ? ` · semana ${n.semana_actual}` : ''}</p>
      <p><b>Resumen:</b> ${real} realizadas · ${pasadas.length - real} no realizadas/suspendidas · <b>${pendientes.length} agendadas pendientes</b>.</p>
      ${this._docH2(`Sesiones agendadas pendientes (${pendientes.length})`)}
      ${pendientes.length ? this._docTablaSesiones(pendientes, false) : '<p style="font-size:13px">No hay sesiones pendientes por venir.</p>'}
      ${this._docH2(`Sesiones ya realizadas / pasadas (${pasadas.length})`)}
      ${pasadas.length ? this._docTablaSesiones(pasadas, true) : '<p style="font-size:13px">Aún no hay sesiones pasadas.</p>'}`;
    this._descargarDoc(`Tratamiento en curso · ${n.nombre_completo}`, cuerpo, `tratamiento-en-curso-${n.nombre_completo.replace(/\s+/g, '-').toLowerCase()}.doc`);
    UI.toast(`Tratamiento en curso de ${n.nombre_completo.split(' ')[0]} descargado`, 'success');
  },

  // Crear un niño nuevo (ingreso) desde la ficha, antes de diagnosticar. Entra como Evaluación.
  _abrirCrearNino() {
    const PROGS = [
      { v: 'PROG-EVAL', l: 'Evaluación' },
      { v: 'PROG-INT', l: 'Intensivo' },
      { v: 'PROG-CONT', l: 'Atención continua' },
    ];
    const html = `
      <div class="pendiente-modal-overlay" id="crearNinoOverlay">
        <div class="pendiente-modal" style="width:min(560px,94vw)">
          <div class="pendiente-modal-head">
            <div><div class="pendiente-modal-title">Crear niño nuevo</div><div class="pendiente-modal-eyebrow">Nuevo ingreso · luego se completa el diagnóstico</div></div>
            <button class="panel-close" id="crearNinoClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="pendiente-modal-body" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px">
            <div class="cfg-field" style="grid-column:1/-1"><label>Nombre completo *</label><input id="cn-nom" placeholder="Ej: Tomás Rivera Soto"></div>
            <div class="cfg-field"><label>Fecha de nacimiento</label><input id="cn-fnac" type="date"></div>
            <div class="cfg-field"><label>Instancia de ingreso</label><select id="cn-prog">${PROGS.map(p => `<option value="${p.v}">${p.l}</option>`).join('')}</select></div>
            <div class="cfg-field"><label>Madre / apoderada</label><input id="cn-madre" placeholder="Nombre"></div>
            <div class="cfg-field"><label>Teléfono madre</label><input id="cn-tmadre" placeholder="+569…"></div>
            <div class="cfg-field"><label>Padre / apoderado</label><input id="cn-padre" placeholder="Nombre"></div>
            <div class="cfg-field"><label>Teléfono padre</label><input id="cn-tpadre" placeholder="+569…"></div>
            <div class="cfg-field" style="grid-column:1/-1"><label>Email de contacto</label><input id="cn-email" placeholder="correo@…"></div>
          </div>
          <div class="pendiente-modal-foot">
            <button class="btn btn-ghost" id="crearNinoCancel">Cancelar</button>
            <button class="btn btn-primary" id="crearNinoSave">Crear y abrir ficha</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const overlay = document.getElementById('crearNinoOverlay');
    const close = () => overlay?.remove();
    document.getElementById('crearNinoClose').addEventListener('click', close);
    document.getElementById('crearNinoCancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    setTimeout(() => document.getElementById('cn-nom')?.focus(), 60);
    document.getElementById('crearNinoSave').addEventListener('click', () => {
      const v = id => (document.getElementById(id)?.value || '').trim();
      const nombre = v('cn-nom');
      if (!nombre) { UI.toast('El nombre es obligatorio', 'error'); return; }
      const prog = document.getElementById('cn-prog').value;
      const nino = Data.crearNino({
        nombre_completo: nombre,
        fecha_nacimiento: v('cn-fnac') || null,
        id_programa: prog,
        programa_nombre: { 'PROG-EVAL': 'Evaluación', 'PROG-INT': 'Intensivo', 'PROG-CONT': 'Atención continua' }[prog],
        madre: v('cn-madre') || null,
        telefono_madre: v('cn-tmadre') || null,
        padre: v('cn-padre') || null,
        telefono_padre: v('cn-tpadre') || null,
        email_apoderado: v('cn-email') || null,
        apoderado_principal: v('cn-madre') || v('cn-padre') || null,
      });
      close();
      UI.toast(`${nombre.split(' ')[0]} creado`, 'success');
      State.fichaActiva = nino.id_nino;
      this.render();
    });
  },

  _descargarTodasFichas() {
    const ninos = Data.ninosVisibles();
    const cuerpo = ninos.map(n => this._fichaDocHtml(n)).join('<hr style="margin:24px 0;border:none;border-top:2px solid #cbd5e1">');
    this._descargarDoc('Fichas clínicas de todos los pacientes', cuerpo, 'fichas-todos-los-pacientes.doc');
    UI.toast(`${ninos.length} fichas descargadas`, 'success');
  },

  // Dominios CIF (Clasificación Internacional del Funcionamiento) — pedido de Trini.
  CIF_SUBCATS: ['Funciones Corporales', 'Estructuras Corporales', 'Actividades', 'Participación', 'Ambiente'],
  AREA_CIF: {
    'Cognitivo': 'Funciones Corporales',
    'Psicología': 'Funciones Corporales',
    'Kinesiología': 'Estructuras Corporales',
    'Terapia Ocupacional': 'Actividades',
    'Fonoaudiología': 'Actividades',
    'RDI': 'Participación',
    'Habilidad Adaptativa': 'Participación',
  },
  BANCO_OBJETIVOS: {
    'Funciones Corporales': ['Sostener atención conjunta con figura referente', 'Mejorar autorregulación emocional ante la frustración', 'Regular la respuesta sensorial ante estímulos del entorno'],
    'Estructuras Corporales': ['Mejorar el control postural del tronco', 'Fortalecer la musculatura proximal de cintura escapular'],
    'Actividades': ['Lograr autonomía en el vestido superior', 'Mejorar la coordinación motora fina en la pinza', 'Ampliar el repertorio de juego funcional'],
    'Participación': ['Iniciar interacción social con pares en juego', 'Participar en rutinas grupales del aula', 'Aumentar la intención comunicativa con gestos'],
    'Ambiente': ['Adecuar apoyos visuales en el hogar', 'Coordinar estrategias comunes con el colegio'],
  },

  _seccionObjetivos(objetivos) {
    const pillEstado = (e) => `<span class="estado-pill ${e==='Logrado'?'realizada':e==='Pausa'?'cancelada':'agendada'}">${UI.esc(e || '—')}</span>`;
    // Reparte los objetivos por dominio CIF y los agrupa en Objetivo 1..4 (uno por dominio en cada nivel).
    const porCif = {};
    this.CIF_SUBCATS.forEach(c => porCif[c] = []);
    objetivos.forEach(o => { const cif = o.cif || this.AREA_CIF[o.area] || 'Actividades'; porCif[cif].push(o); });
    const nObjetivos = Math.min(4, Math.max(1, ...this.CIF_SUBCATS.map(c => porCif[c].length)));

    const bloques = Array.from({ length: nObjetivos }, (_, k) => {
      const filas = this.CIF_SUBCATS.map(cif => {
        const o = porCif[cif][k];
        return `<div class="cif-row${o ? '' : ' is-empty'}">
          <span class="cif-label">${UI.esc(cif)}</span>
          ${o
            ? `<span class="cif-desc">${UI.esc(o.descripcion)}<small>${UI.esc(o.area || 'objetivo propio')}</small></span><span class="cif-end">${pillEstado(o.estado)}${o._extra ? `<button class="obj-del" data-id="${UI.esc(o.id_objetivo)}" title="Quitar objetivo">×</button>` : ''}</span>`
            : `<span class="cif-desc cif-vacio">— sin objetivo en esta área —</span>`}
        </div>`;
      }).join('');
      return `<div class="objetivo-bloque">
        <div class="objetivo-bloque-h">Objetivo ${k + 1}</div>
        <div class="cif-grid">${filas}</div>
      </div>`;
    }).join('');

    const banco = `<details class="banco-obj">
      <summary>Banco de objetivos · elegir uno predefinido o escribir el propio</summary>
      ${this.CIF_SUBCATS.map(cif => `
        <div class="banco-cif">
          <div class="banco-cif-h">${UI.esc(cif)}</div>
          ${(this.BANCO_OBJETIVOS[cif] || []).map(t => `<button class="banco-item" type="button" data-obj="${UI.esc(t)}" data-cif="${UI.esc(cif)}">${UI.esc(t)}</button>`).join('')}
          <div class="banco-propio">
            <input type="text" class="banco-propio-in" data-cif="${UI.esc(cif)}" placeholder="Escribir objetivo propio en ${UI.esc(cif)}…">
            <button class="btn btn-ghost btn-sm banco-propio-btn" type="button" data-cif="${UI.esc(cif)}">Agregar</button>
          </div>
        </div>`).join('')}
    </details>`;

    return `<section class="ficha-section">
      <h2 class="ficha-section-title">Objetivos terapéuticos <span class="ficha-section-count">${objetivos.length}</span></h2>
      <div class="ficha-section-hint">Organizados por objetivo y desglosados en los 5 dominios CIF.</div>
      ${objetivos.length ? bloques : '<div class="empty-state"><div class="empty-state-title">Sin objetivos planteados</div></div>'}
      ${banco}
    </section>`;
  },

  _seccionReuniones(idNino) {
    const reus = this._leerReuniones(idNino);
    const ordered = [...reus].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
    const futuras = ordered.filter(r => r.fecha >= HOY_ISO);
    const pasadas = ordered.filter(r => r.fecha < HOY_ISO);
    return `<section class="ficha-section">
      <h2 class="ficha-section-title">
        Reuniones <span class="ficha-section-count">${ordered.length}</span>
        <button class="btn btn-primary" id="addReuBtn" style="margin-left:auto;height:32px;padding:0 12px;font-size:12px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Agendar reunión
        </button>
      </h2>
      ${ordered.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-title">Sin reuniones agendadas</div>
          <div>Usa "Agendar reunión" para coordinar con el equipo o apoderados.</div>
        </div>
      ` : `
        ${futuras.length ? `<div class="reu-subtitle">Próximas</div>` : ''}
        <div class="reu-list">
          ${futuras.map(r => this._reuCard(r, true)).join('')}
        </div>
        ${pasadas.length ? `<div class="reu-subtitle" style="margin-top:18px">Pasadas</div>
        <div class="reu-list">
          ${pasadas.map(r => this._reuCard(r, false)).join('')}
        </div>` : ''}
      `}
    </section>`;
  },

  _reuCard(r, futura) {
    return `<div class="reu-card ${futura ? 'futura' : 'pasada'}">
      <div class="reu-date">
        <div class="reu-day mono">${r.fecha.split('-')[2]}</div>
        <div class="reu-month">${['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'][parseInt(r.fecha.split('-')[1])-1]}</div>
      </div>
      <div style="flex:1;min-width:0">
        <div class="reu-title">${UI.esc(r.tipo)} <span style="color:var(--text-3);font-weight:400;margin-left:6px;font-size:12px">${UI.esc(r.hora)}</span></div>
        <div class="reu-meta">Con ${UI.esc(r.con)}${r.modo ? ' · ' + UI.esc(r.modo) : ''}</div>
        ${r.nota ? `<div class="reu-nota">${UI.esc(r.nota)}</div>` : ''}
        ${r.link ? `<a class="reu-link" href="${UI.esc(r.link)}" target="_blank" rel="noopener"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14M4 6h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/></svg> Unirse a la reunión</a>` : ''}
        <details class="reu-acta"${r.acta ? ' open' : ''}>
          <summary>${r.acta ? 'Registro de la reunión' : 'Agregar registro de lo conversado'}</summary>
          <textarea class="reu-acta-input" data-rid="${r.id}" rows="3" placeholder="¿Qué se conversó? Acuerdos, próximos pasos, responsables…">${UI.esc(r.acta || '')}</textarea>
          <button class="btn btn-primary reu-acta-save" data-rid="${r.id}" style="height:30px;padding:0 12px;font-size:12px">Guardar registro</button>
        </details>
      </div>
      <button class="btn-icon reu-delete" data-rid="${r.id}" title="Eliminar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>`;
  },

  _leerReuniones(idNino) {
    const all = JSON.parse(localStorage.getItem('casanogal_reuniones') || '{}');
    return all[idNino] || [];
  },

  _guardarReuniones(idNino, list) {
    const all = JSON.parse(localStorage.getItem('casanogal_reuniones') || '{}');
    all[idNino] = list;
    localStorage.setItem('casanogal_reuniones', JSON.stringify(all));
  },

  _borrarReunion(idNino, rid) {
    const list = this._leerReuniones(idNino).filter(r => r.id !== rid);
    this._guardarReuniones(idNino, list);
    UI.toast('Reunión eliminada', 'success');
  },

  _guardarActaReunion(idNino, rid, acta) {
    const list = this._leerReuniones(idNino);
    const r = list.find(x => x.id === rid);
    if (r) { r.acta = acta; this._guardarReuniones(idNino, list); }
  },

  _abrirModalReunion(idNino) {
    const html = `
      <div class="pendiente-modal-overlay" id="reuOverlay">
        <div class="pendiente-modal" style="width:min(440px,92vw)">
          <div class="pendiente-modal-head">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--cn-azul)"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <div>
              <div class="pendiente-modal-title">Agendar reunión</div>
              <div class="pendiente-modal-eyebrow">Coordina con equipo o apoderados</div>
            </div>
            <button class="panel-close" id="reuClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="pendiente-modal-body" style="display:flex;flex-direction:column;gap:12px">
            <div class="field">
              <label class="field-label">Tipo</label>
              <select class="field-select" id="reuTipo">
                <option>Reunión con apoderados</option>
                <option>Reunión de equipo terapéutico</option>
                <option>Reunión clínica con médico externo</option>
                <option>Reunión de coordinación</option>
              </select>
            </div>
            <div class="field-row">
              <div class="field"><label class="field-label">Fecha</label><input type="date" class="field-input" id="reuFecha" value="${HOY_ISO}"></div>
              <div class="field"><label class="field-label">Hora</label><input type="time" class="field-input" id="reuHora" value="16:00"></div>
            </div>
            <div class="field">
              <label class="field-label">Con</label>
              <input type="text" class="field-input" id="reuCon" placeholder="Ej: Carolina Pérez · apoderada">
            </div>
            <div class="field">
              <label class="field-label">Modalidad</label>
              <select class="field-select" id="reuModo">
                <option>Presencial</option>
                <option>Videollamada (Meet)</option>
                <option>Híbrida</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">Link de la reunión (Zoom / Meet · opcional)</label>
              <input type="url" class="field-input" id="reuLink" placeholder="https://zoom.us/j/…">
            </div>
            <div class="field">
              <label class="field-label">Tema / nota (opcional)</label>
              <input type="text" class="field-input" id="reuNota" placeholder="Ej: Revisar objetivos del mes y avances">
            </div>
          </div>
          <div class="pendiente-modal-foot">
            <button class="btn btn-ghost" id="reuCancel">Cancelar</button>
            <button class="btn btn-primary" id="reuSave">Agendar</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    const close = () => document.getElementById('reuOverlay')?.remove();
    document.getElementById('reuClose').addEventListener('click', close);
    document.getElementById('reuCancel').addEventListener('click', close);
    document.getElementById('reuOverlay').addEventListener('click', (e) => { if (e.target.id === 'reuOverlay') close(); });
    document.getElementById('reuSave').addEventListener('click', () => {
      const r = {
        id: 'RE-' + Date.now().toString(36),
        tipo: document.getElementById('reuTipo').value,
        fecha: document.getElementById('reuFecha').value,
        hora: document.getElementById('reuHora').value,
        con: document.getElementById('reuCon').value.trim() || 'Equipo',
        modo: document.getElementById('reuModo').value,
        link: document.getElementById('reuLink').value.trim(),
        nota: document.getElementById('reuNota').value.trim(),
      };
      const list = this._leerReuniones(idNino);
      list.push(r);
      this._guardarReuniones(idNino, list);
      UI.toast('Reunión agendada', 'success');
      close();
      this._renderDetalle(idNino);
    });
  },

  _seccionDocumentos(docs) {
    return `<section class="ficha-section">
      <h2 class="ficha-section-title">Documentos <span class="ficha-section-count">${docs.length}</span></h2>
      ${docs.length === 0 ? `<div class="empty-state"><div class="empty-state-title">Sin documentos</div></div>` : `
        <div class="docs-list">
          ${docs.map(d => `<div class="doc-row">
            <span class="doc-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </span>
            <div class="doc-info">
              <div class="doc-name">${UI.esc(d.nombre_archivo)}</div>
              <div class="doc-meta">${UI.esc(d.tipo)} · ${UI.fmtFechaCorta(d.fecha_documento)} · subido por ${UI.esc(d.subido_por)}</div>
            </div>
            <button class="btn btn-ghost doc-download" type="button" aria-label="Descargar ${UI.esc(d.nombre_archivo)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </div>`).join('')}
        </div>
      `}
    </section>`;
  },

};
