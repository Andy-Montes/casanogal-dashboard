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
  _intensivoVista: '41',          // '40' ejemplo · '41' actual (real) · '42' próximo (en blanco, se arma)

  KEY_BANNER: 'casanogal_armador_banner',
  KEY_TOUR: 'casanogal_armador_tour',
  KEY_FUENTE: 'casanogal_armador_fuente',
  KEY_NINOS_EXTRA: 'casanogal_armador_ninos_extra',
  KEY_SALAS_CAP: 'casanogal_armador_salas_cap',     // overrides de cupo de sala
  KEY_RESTRICC: 'casanogal_armador_restricc',       // restricciones custom (texto)
  KEY_GRUPOS: 'casanogal_armador_grupos',           // grupos / duplas creados

  // Cupo de sala: base del JSON + lo que ajuste coordinación (persistido).
  _salasCapOverrides() {
    try { const o = JSON.parse(localStorage.getItem(this.KEY_SALAS_CAP) || '{}'); return (o && typeof o === 'object') ? o : {}; }
    catch { return {}; }
  },
  _salasCapEfectiva() {
    return { ...(this._cache?.salasCapacidad || {}), ...this._salasCapOverrides() };
  },
  _setSalaCap(sala, valor) {
    const o = this._salasCapOverrides();
    o[sala] = valor;
    localStorage.setItem(this.KEY_SALAS_CAP, JSON.stringify(o));
  },
  _restriccCustom() {
    try { const a = JSON.parse(localStorage.getItem(this.KEY_RESTRICC) || '[]'); return Array.isArray(a) ? a : []; }
    catch { return []; }
  },
  _setRestriccCustom(arr) { localStorage.setItem(this.KEY_RESTRICC, JSON.stringify(arr)); },
  // Grupos / duplas
  _gruposGuardados() { try { const a = JSON.parse(localStorage.getItem(this.KEY_GRUPOS) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } },
  _persistirGrupos(arr) { localStorage.setItem(this.KEY_GRUPOS, JSON.stringify(arr)); },
  _aplicarGrupoNuevo(g) { const arr = this._gruposGuardados(); arr.push(g); this._persistirGrupos(arr); this._generar(); this.render(); },
  _borrarGrupo(id) { this._persistirGrupos(this._gruposGuardados().filter(g => g.id !== id)); this._generar(); this.render(); },

  async _cargar() {
    if (this._cache40) { this._activarCacheSegunToggle(); return this._cache; }
    const [int40, catalogo, disp40, salasCapacidad, real, int41, dispReal] = await Promise.all([
      fetch('data/intensivos/int40.json').then(r => r.json()),
      fetch('data/intensivos/catalogo.json').then(r => r.json()),
      fetch('data/intensivos/disponibilidad.json').then(r => r.json()),
      fetch('data/intensivos/salas_capacidad.json').then(r => r.json()),
      fetch('data/intensivos/int40_real.json').then(r => r.json()).catch(() => null),
      fetch('data/intensivos/int41.json').then(r => r.json()),
      fetch('data/intensivos/_disp_real.json').then(r => r.json()),
    ]);
    // Intensivo 42 = PRÓXIMO ciclo, en blanco. Se arma agregando niños; recibe los niños extra guardados.
    const int42 = {
      id: 'Intensivo 42',
      fecha_inicio: this._sumarDias(int41.fecha_fin, 21),
      fecha_fin: this._sumarDias(int41.fecha_fin, 21 + (int41.semanas || 6) * 7 - 1),
      semanas: int41.semanas || 6,
      reglas: int41.reglas,
      niños: [],
    };
    try {
      const extras = JSON.parse(localStorage.getItem(this.KEY_NINOS_EXTRA) || '[]');
      if (Array.isArray(extras) && extras.length) {
        int42.niños = int42.niños.concat(extras.filter(e => (e.instancia || 'intensivo') === 'intensivo'));
      }
    } catch {}
    // Intensivo 40 = demo/ejemplo (disponibilidad sintética + horario real armado a mano).
    // Intensivo 41 = intensivo REAL de Trini (data del Excel) con disponibilidad REAL.
    // Intensivo 42 = próximo, en blanco, para armar el siguiente.
    this._cache40 = { intensivo: int40, catalogo, disponibilidad: disp40, salasCapacidad };
    this._cache41 = { intensivo: int41, catalogo, disponibilidad: dispReal, salasCapacidad };
    this._cache42 = { intensivo: int42, catalogo, disponibilidad: dispReal, salasCapacidad };
    this._realPorIntensivo = { '40': real, '41': null, '42': null };
    this._resultadoPorIntensivo = {};
    this._bannerCerrado = localStorage.getItem(this.KEY_BANNER) === '1';
    const fuenteGuardada = localStorage.getItem(this.KEY_FUENTE);
    if (fuenteGuardada === 'real' || fuenteGuardada === 'generado') this._fuente = fuenteGuardada;
    this._activarCacheSegunToggle();
    return this._cache;
  },

  // Suma días a una fecha ISO (YYYY-MM-DD) y devuelve ISO.
  _sumarDias(iso, dias) {
    const d = new Date((iso || HOY_ISO) + 'T00:00:00');
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  },

  // Apunta this._cache al intensivo activo ('40' | '41' | '42') y restaura su resultado/fuente.
  _activarCacheSegunToggle() {
    const v = this._intensivoVista || '41';
    this._cache = v === '40' ? this._cache40 : v === '42' ? this._cache42 : this._cache41;
    this._resultadoReal = this._realPorIntensivo[v] || null;
    // Solo el Intensivo 40 tiene horario armado a mano; el 41 y el 42 se ven generados por el motor.
    if (v !== '40') this._fuente = 'generado';
    this._resultado = this._resultadoPorIntensivo[v] || null;
  },

  _ninosExtraGuardados() {
    try {
      const e = JSON.parse(localStorage.getItem(this.KEY_NINOS_EXTRA) || '[]');
      return Array.isArray(e) ? e : [];
    } catch { return []; }
  },

  _persistirNinosExtra(arr) {
    localStorage.setItem(this.KEY_NINOS_EXTRA, JSON.stringify(arr));
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
    // Vista de Evaluación = flujo aparte (no la grilla del intensivo)
    if (this._intensivoVista === 'eval') {
      main.innerHTML = this._htmlEval(data);
      this._wireEval();
      return;
    }
    const tieneNinos = (data.intensivo.niños || []).length > 0;
    if (!this._resultado && tieneNinos) this._generar();
    // Si el intensivo activo no tiene niños, se muestra el estado "aún sin armar"; si tiene, se arma.
    if (!tieneNinos) {
      main.innerHTML = this._html41(data);
    } else {
      main.innerHTML = this._html(data);
    }
    this._wire();

    if (this._intensivoVista === '41' && !localStorage.getItem(this.KEY_TOUR)) {
      setTimeout(() => this._abrirTour(), 400);
    }
  },

  // Vista de un intensivo aún sin armar (el próximo ciclo en blanco) — cada intensivo es navegable.
  _html41(data) {
    const nom = data.intensivo.id || 'Intensivo';
    const rango = data.intensivo.fecha_inicio ? ` · ${data.intensivo.fecha_inicio} → ${data.intensivo.fecha_fin}` : '';
    return `
      ${this._toolbarHtml(data.intensivo)}
      <div class="armador-hero">
        <div class="armador-hero-info">
          <div class="armador-eyebrow">${UI.esc(nom)} · próximo ciclo${rango}</div>
          <h2 class="armador-title">${UI.esc(nom)} — aún sin armar</h2>
          <p class="armador-subtitle">Cada intensivo queda guardado por separado. Agrega a los niños que participan y el sistema arma su horario con la disponibilidad real de los terapeutas, sin tocar los intensivos anteriores.</p>
        </div>
        <div class="armador-hero-cta">
          <button class="btn btn-primary" id="armadorAddBtn">${this._icons.plus}Agregar primer niño</button>
        </div>
      </div>
      <div class="empty-state" style="margin-top:18px">
        <div class="empty-state-title">Horario en blanco</div>
        <div class="empty-state-sub">Todavía no hay niños en ${UI.esc(nom)}. Agrega niños para construir su horario; los intensivos anteriores quedan intactos.</div>
      </div>
    `;
  },

  _generar() {
    const { intensivo, catalogo, disponibilidad } = this._cache;
    this._resultado = Scheduler.generar(intensivo, catalogo, {
      semilla: this._semilla,
      disponibilidad,
      salasCapacidad: this._salasCapEfectiva(),
    });
    this._colocarGrupos(this._resultado, this._gruposGuardados());
    this._kidsSlotsPorSemana = this._computarKidsSlots(this._resultado);
    if (this._resultadoPorIntensivo) this._resultadoPorIntensivo[this._intensivoVista] = this._resultado;
  },

  // Coloca los grupos/duplas como post-proceso del resultado (igual que reuniones/papás), sin tocar el motor.
  _colocarGrupos(res, grupos) {
    const { intensivo, catalogo } = this._cache;
    const F = (catalogo.franjas || []).length || 8;
    const modulos = (intensivo.reglas?.kids_modulos) || [2, 3, 4];
    const idxDe = (nombre) => intensivo.niños.findIndex(n => n.nombre === nombre);
    (res.semanas || []).forEach(sem => {
      sem.grupos = [];
      if (!grupos.length) return;
      const slots = sem.grid[0]?.length || 0;
      const terOcupado = (sigla, slot) => !!sigla && sem.grid.some(row => row[slot] === sigla);
      const usado = new Set(); // ni|slot ya tomado por un grupo
      grupos.forEach(g => {
        const nis = (g.ninos || []).map(idxDe).filter(i => i >= 0);
        if (!nis.length) return;
        const sigla = (g.terapeutas || [])[0];
        const need = g.sesiones || 1;
        let puestos = 0; const dias = new Set();
        const candidatos = [];
        for (let slot = 0; slot < slots; slot++) { if (modulos.includes(slot % F)) candidatos.push(slot); }
        if (g.hora_entrada != null) candidatos.sort((a, b) => ((a % F === g.hora_entrada) ? 0 : 1) - ((b % F === g.hora_entrada) ? 0 : 1));
        for (const slot of candidatos) {
          if (puestos >= need) break;
          const dia = Math.floor(slot / F);
          if (dias.has(dia)) continue;
          if (nis.some(ni => sem.grid[ni]?.[slot] || usado.has(ni + '|' + slot))) continue; // niños libres
          if (terOcupado(sigla, slot)) continue; // terapeuta libre
          sem.grupos.push({ id: g.id, tipo: g.tipo, nis: nis.slice(), slot, terapeutas: g.terapeutas || [], sala: g.sala || '', nombres: g.ninos || [] });
          nis.forEach(ni => usado.add(ni + '|' + slot));
          dias.add(dia); puestos++;
        }
      });
    });
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
        if (!sem.grid[ni]) return;  // niño extra sin fila en horario real
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
          ${this._reglasHtml(intensivo)}
          ${this._fuente !== 'real' ? this._gruposHtml(catalogo) : ''}
          ${this._fuente !== 'real' ? this._restriccionesHtml() : ''}
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
    const esTrini = this._intensivoVista === '41'; // el Int 41 es el armador real de Trini

    if (esReal) {
      titulo = 'Horario real de Trini';
      subtitulo = `Este es el horario que Trini armó a mano en el Excel. ${intensivo.niños.length} niños · ${totalSes} sesiones por semana · base que se repite en las ${intensivo.semanas} semanas.`;
      badgeClass = 'ok'; badgeIcon = this._icons.check;
      badgeText = 'Fuente: Excel original';
    } else if (agg.incompletos.length === 0) {
      titulo = esTrini ? 'Intensivo 41 · el armador de Trini' : 'Horario propuesto con los datos reales';
      subtitulo = `${esTrini ? 'Armado con los equipos y la disponibilidad reales de Trini' : 'Distribución calculada con los equipos y la disponibilidad reales'}. ${intensivo.niños.length} niños · ${totalSes} sesiones · sin choques de terapeuta ni sala.`;
      badgeClass = 'ok'; badgeIcon = this._icons.ok;
      badgeText = esTrini ? 'Armador de Trini · completo' : 'Completo · 100%';
    } else {
      // Int 41 = armador de Trini. El empaque es muy ajustado (≈30 sesiones en 30 huecos): pocas
      // sesiones se terminan de ubicar a mano. Se expresa POR SEMANA (la base se repite las N semanas).
      const semanas = intensivo.semanas || 6;
      const faltanTotal = agg.incompletos.reduce((s, i) => s + (i.faltan || 0), 0);
      const porSem = Math.max(1, Math.round(faltanTotal / semanas)); // sesiones/semana por ubicar
      const nombres = agg.incompletos.map(i => i.niño).join(', ');
      titulo = esTrini ? 'Intensivo 41 · el armador de Trini' : 'Horario propuesto con los datos reales';
      subtitulo = `${esTrini ? 'Armado con los equipos y la disponibilidad reales de Trini' : 'Distribución calculada con los datos reales'}. ${intensivo.niños.length} niños · sin choques de terapeuta ni sala. ${porSem === 1 ? 'Queda 1 sesión' : `Quedan ${porSem} sesiones`} por semana que se termina${porSem === 1 ? '' : 'n'} de ubicar a mano (${nombres}) — lo normal al cerrar un intensivo; el empaque es muy ajustado (~30 sesiones en ~30 bloques).`;
      badgeClass = 'ok'; badgeIcon = this._icons.ok;
      badgeText = esTrini ? 'Armador de Trini' : `Propuesta · ${agg.totalPct}%`;
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
            <div class="armador-fuente-wrap">
              <div class="armador-fuente-toggle" role="tablist" aria-label="Fuente del horario">
                <button class="armador-fuente-btn ${esReal ? 'active' : ''}" data-fuente="real" role="tab" title="Lo que Trini armó a mano en Excel">
                  ${this._icons.user}<span>Real</span>
                </button>
                <button class="armador-fuente-btn ${!esReal ? 'active' : ''}" data-fuente="generado" role="tab" title="Propuesta del sistema con los mismos inputs">
                  ${this._icons.cpu}<span>Generado</span>
                </button>
              </div>
              <div class="armador-fuente-hint">${esReal ? 'Lo que armaste en Excel' : 'Propuesta del sistema'}</div>
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
          ${!esReal ? `
            <button class="btn btn-secondary" id="armadorAddBtn" title="Agregar un niño a la cohorte y regenerar el horario">
              ${this._icons.plus}Agregar niño
            </button>
            <button class="btn btn-secondary" id="armadorAddGrupoBtn" title="Crear una dupla o grupo (sesión compartida)">
              ${this._icons.plus}Crear grupo
            </button>
          ` : ''}
          <button class="btn btn-ghost btn-help" id="armadorTourBtn" title="Ver el recorrido guiado del armador">
            ${this._icons.help}
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
            <span class="armador-select-label">Intensivo:</span>
            <select id="armadorIntensivo">
              <option value="41" ${this._intensivoVista === '41' ? 'selected' : ''}>Intensivo 41 · actual (datos reales)</option>
              <option value="42" ${this._intensivoVista === '42' ? 'selected' : ''}>Intensivo 42 · próximo (armar nuevo)</option>
              <option value="40" ${this._intensivoVista === '40' ? 'selected' : ''}>Intensivo 40 · ejemplo anterior</option>
              <option value="eval" ${this._intensivoVista === 'eval' ? 'selected' : ''}>Evaluación · equipo evaluador</option>
            </select>
          </label>
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

  // Calendario 2D · una sola grilla con horas a la izquierda y días arriba.
  // Las semanas se apilan como secciones separadoras dentro de la misma grid.
  _calendarioHtml(intensivo, catalogo) {
    const { dias: diasCatalogo, franjas } = catalogo;
    const F = franjas.length;
    // Casa Nogal atiende solo lun-vie: el sábado nunca se muestra.
    const dias = diasCatalogo.filter(d => d !== 'sab');
    // Mapeo dia visible → índice en catálogo (para indexar grid del scheduler)
    const diaIdxOrig = dias.map(d => diasCatalogo.indexOf(d));
    const semanas = this._resultadoActivo().semanas || [];
    const semsAMostrar = this._filtroSemana === -1
      ? semanas.map((sem, si) => ({ sem, si }))
      : [{ sem: semanas[this._filtroSemana], si: this._filtroSemana }];
    const diaLabels = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb' };
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const inicialNino = (nombre) => nombre.charAt(0).toUpperCase() + (nombre.charAt(1)?.toLowerCase() || '');

    // Por cada semana: section header + fila de días + 8 rows de franjas
    const semanasHtml = semsAMostrar.map(({ sem, si }) => {
      const inicioSem = this._fechaSemana(si);
      const finSem = new Date(inicioSem);
      finSem.setDate(inicioSem.getDate() + dias.length - 1);
      const rangoFechas = `${inicioSem.getDate()} ${meses[inicioSem.getMonth()]} – ${finSem.getDate()} ${meses[finSem.getMonth()]}`;
      const kidsSet = this._kidsSlotsPorSemana?.get(si) || new Set();

      // Header de semana span across all columns + fila de días anclada a esta semana
      const semHeader = `
        <div class="cal-sem-row">
          <span class="cal-sem-num">SEM ${si + 1}</span>
          <span class="cal-sem-range">${rangoFechas}</span>
        </div>
        <div class="cal-corner"></div>
        ${dias.map((d, di) => {
          const fecha = new Date(inicioSem);
          fecha.setDate(inicioSem.getDate() + di);
          return `<div class="cal-day-head${di % 2 ? ' cal-col-alt' : ''}"><span class="cal-day-name">${diaLabels[d]}</span><span class="cal-day-num">${fecha.getDate()}</span></div>`;
        }).join('')}
      `;

      // Por cada franja: una row con celda de hora + N celdas de días
      const rows = franjas.map((franja, fi) => {
        const horaCorta = franja.split('-')[0];
        const horaHtml = `<div class="cal-time">${horaCorta}</div>`;

        const celdas = diaIdxOrig.map((diaOrig, di) => {
          const slotIdx = diaOrig * F + fi;
          const sesiones = this._sesionesEnSlot(intensivo, catalogo, sem, slotIdx, kidsSet, inicialNino);
          const contenido = sesiones.length ? this._renderCelda(sesiones) : '';
          return `<div class="cal-slot${di % 2 ? ' cal-col-alt' : ''}">${contenido}</div>`;
        }).join('');

        return horaHtml + celdas;
      }).join('');

      return semHeader + rows;
    }).join('');

    return `
      <div class="armador-cal-grid" style="--cal-col-count:${dias.length}">
        ${semanasHtml}
      </div>
    `;
  },

  // Devuelve las sesiones de UN slot (sem×día×franja), respetando filtroNino y KIDS grupal
  _sesionesEnSlot(intensivo, catalogo, sem, slotIdx, kidsSet, inicialNino) {
    const sesiones = [];
    const niñosAMostrar = this._filtroNino === -1
      ? intensivo.niños.map((n, ni) => ({ n, ni }))
      : [{ n: intensivo.niños[this._filtroNino], ni: this._filtroNino }];
    niñosAMostrar.forEach(({ n, ni }) => {
      if (!sem.grid[ni]) return;
      const sig = sem.grid[ni][slotIdx];
      if (!sig) return;
      const esKids = sig === 'GP' && kidsSet.has(slotIdx);
      if (esKids && this._filtroNino === -1 && ni !== 0) return; // 1 sola vez
      sesiones.push({
        sig,
        niño: n.nombre,
        niInicial: inicialNino(n.nombre),
        disc: catalogo.terapeutas[sig]?.disciplina,
        esKids,
        slotIdx,
        terapeutaNombre: catalogo.terapeutas[sig]?.nombre || sig,
        sala: catalogo.terapeutas[sig]?.sala || '',
      });
    });

    // Reuniones y sesión psicólogo-papás (las calcula el motor aparte del grid)
    const enFiltro = (ni) => this._filtroNino === -1 || ni === this._filtroNino;
    (sem.reunionesEquipo || []).forEach((r) => {
      if (r.slot !== slotIdx || !enFiltro(r.ni)) return;
      sesiones.push({ tipo: 'reunion-equipo', niño: intensivo.niños[r.ni].nombre, niInicial: inicialNino(intensivo.niños[r.ni].nombre), tutores: r.tutores });
    });
    (sem.reunionesPapas || []).forEach((r) => {
      if (!r.slots?.includes(slotIdx) || !enFiltro(r.ni)) return;
      sesiones.push({ tipo: 'reunion-papas', niño: intensivo.niños[r.ni].nombre, niInicial: inicialNino(intensivo.niños[r.ni].nombre), tutores: r.tutores });
    });
    (sem.sesionesPapas || []).forEach((sp) => {
      if (sp.slot !== slotIdx || !enFiltro(sp.ni)) return;
      sesiones.push({ tipo: 'sesion-papas', niño: intensivo.niños[sp.ni].nombre, niInicial: inicialNino(intensivo.niños[sp.ni].nombre), sig: sp.sigla, terapeutaNombre: catalogo.terapeutas[sp.sigla]?.nombre || sp.sigla });
    });
    // Grupos / duplas (colocados aparte, como las reuniones)
    (sem.grupos || []).forEach((gr) => {
      if (gr.slot !== slotIdx) return;
      if (this._filtroNino !== -1 && !gr.nis.includes(this._filtroNino)) return;
      const labels = { kids: 'KIDS', dupla_nino: 'Dupla', dupla_ter: 'Dupla T', grupal: 'Grupo' };
      sesiones.push({ tipo: 'grupo', niño: (gr.nombres || [])[0] || '', label: labels[gr.tipo] || 'Grupo', ninos: gr.nombres || [], terapeutas: gr.terapeutas || [], sala: gr.sala || '' });
    });
    return sesiones.sort((a, b) => a.niño.localeCompare(b.niño));
  },

  _renderCelda(sesiones) {
    // KIDS grupal: una sola etiqueta centrada
    if (sesiones.length === 1 && sesiones[0].esKids) {
      const titulo = `Sesión grupal KIDS · subgrupo con Gloria`;
      const resaltado = this._terapeutaResaltado === 'GP' ? ' is-resaltado' : '';
      const atenuado = this._terapeutaResaltado && this._terapeutaResaltado !== 'GP' ? ' is-atenuado' : '';
      return `<button class="cal-item cal-item-kids${resaltado}${atenuado}" data-sigla="GP" title="${UI.esc(titulo)}">KIDS</button>`;
    }
    const mostrarNino = this._filtroNino === -1;
    return sesiones.map(s => this._itemHtml(s, mostrarNino)).join('');
  },

  // Render de un item de celda según su tipo (sesión normal o reunión/papás)
  _itemHtml(s, mostrarNino) {
    const ini = mostrarNino ? `<span class="cal-item-nino">${UI.esc(s.niInicial)}</span>` : '';
    if (s.tipo === 'reunion-equipo') {
      const titulo = `Reunión de equipo · ${s.niño} · tutores ${(s.tutores || []).join(', ')}`;
      return `<div class="cal-item cal-item-reunion" title="${UI.esc(titulo)}">${ini}<span class="cal-item-sigla">Equipo</span></div>`;
    }
    if (s.tipo === 'reunion-papas') {
      const titulo = `Reunión con papás · ${s.niño} · tutores ${(s.tutores || []).join(', ')}`;
      return `<div class="cal-item cal-item-papas" title="${UI.esc(titulo)}">${ini}<span class="cal-item-sigla">Papás</span></div>`;
    }
    if (s.tipo === 'sesion-papas') {
      const titulo = `Sesión psicólogo–papás · ${s.niño} · ${s.terapeutaNombre}`;
      return `<div class="cal-item cal-item-psipapas" title="${UI.esc(titulo)}">${ini}<span class="cal-item-sigla">Psi·Papás</span></div>`;
    }
    if (s.tipo === 'grupo') {
      const titulo = `${s.label} · ${(s.ninos || []).join(', ')} · ${(s.terapeutas || []).join('+')}${s.sala ? ' · sala ' + s.sala : ''}`;
      return `<div class="cal-item cal-item-grupo" title="${UI.esc(titulo)}"><span class="cal-item-sigla">${UI.esc(s.label)}</span></div>`;
    }
    const token = this._disciplinaToken(s.disc);
    const resaltado = this._terapeutaResaltado === s.sig ? ' is-resaltado' : '';
    const atenuado = this._terapeutaResaltado && this._terapeutaResaltado !== s.sig ? ' is-atenuado' : '';
    const titulo = `${s.niño} · ${s.sig} (${s.terapeutaNombre}) · ${s.disc} · sala ${s.sala}`;
    return `
      <button class="cal-item${resaltado}${atenuado}" data-sigla="${UI.esc(s.sig)}" data-disc="${token}" title="${UI.esc(titulo)}">
        ${ini}
        <span class="cal-item-sigla">${UI.esc(s.sig)}</span>
      </button>
    `;
  },

  // Render agrupado: una "tarjeta" por slot horario con la hora una vez
  // y mini-lista de (inicial niño, sigla terapeuta). Mucho más compacto
  // cuando se ven los 6 niños juntos.
  _gruposPorSlotHtml(sesiones) {
    const porSlot = new Map();
    sesiones.forEach(s => {
      if (!porSlot.has(s.slotIdx)) porSlot.set(s.slotIdx, []);
      porSlot.get(s.slotIdx).push(s);
    });
    const slotsOrdenados = Array.from(porSlot.keys()).sort((a, b) => a - b);
    return slotsOrdenados.map(slotIdx => {
      const items = porSlot.get(slotIdx);
      const hora = items[0].hora;
      const esKidsSlot = items.every(s => s.esKids);
      if (esKidsSlot) {
        const token = 'kids';
        return `
          <div class="armador-cal-group is-kids" style="border-left-color:var(--${token})">
            <span class="armador-cal-group-time">${UI.esc(hora)}</span>
            <button class="armador-cal-group-item armador-cal-group-kids" data-sigla="GP" style="background:var(--${token}-bg);color:var(--${token}-text)" title="Sesión grupal KIDS · todos los niños del intensivo con Gloria">
              <span class="grp-kids-label">KIDS · todos</span>
            </button>
          </div>
        `;
      }
      const itemsHtml = items.map(s => {
        const token = this._disciplinaToken(s.disc);
        const resaltado = this._terapeutaResaltado === s.sig ? ' is-resaltado' : '';
        const atenuado = this._terapeutaResaltado && this._terapeutaResaltado !== s.sig ? ' is-atenuado' : '';
        const titulo = `${s.niño} · ${s.sig} (${s.terapeutaNombre}) · ${s.disc} · sala ${s.sala}\n${hora}`;
        return `
          <button class="armador-cal-group-item${resaltado}${atenuado}" data-sigla="${UI.esc(s.sig)}" style="background:var(--${token}-bg);color:var(--${token}-text);border-left-color:var(--${token})" title="${UI.esc(titulo)}">
            <span class="grp-nino">${UI.esc(s.niInicial)}</span>
            <span class="grp-sigla">${UI.esc(s.sig)}</span>
          </button>
        `;
      }).join('');
      return `
        <div class="armador-cal-group">
          <span class="armador-cal-group-time">${UI.esc(hora)}</span>
          <div class="armador-cal-group-items">${itemsHtml}</div>
        </div>
      `;
    }).join('');
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

  _reglasHtml(intensivo) {
    const r = intensivo.reglas || {};
    const esReal = this._fuente === 'real';
    const reglas = [
      `KIDS en módulos ${(r.kids_modulos || [2,3,4]).join('-')}, subgrupos de ${r.kids_por_grupo || 3}`,
      `Máx ${r.max_por_terapeuta_dia || 5} sesiones por terapeuta al día`,
      `1 sesión de cada disciplina al día${r.disciplina_no_consecutiva ? ' (las repetidas, no seguidas)' : ''}`,
      `Reunión de equipo por niño en bloque fijo (8:00 o 12:30)`,
      `Reunión con papás en la semana ${r.reunion_papas_semana || 2} (doble bloque)`,
      `Sesión psicólogo–papás fuera del horario del niño`,
    ];
    return `
      <div class="armador-card">
        <div class="armador-card-head">${this._icons.check}Reglas que aplica el sistema</div>
        <div class="armador-card-body">
          <ul class="armador-reglas">
            ${reglas.map(t => `<li>${UI.esc(t)}</li>`).join('')}
          </ul>
          <div class="armador-leyenda">
            <span class="armador-leg armador-leg-reunion">Equipo</span>
            <span class="armador-leg armador-leg-papas">Papás</span>
            <span class="armador-leg armador-leg-psipapas">Psi·Papás</span>
          </div>
          ${esReal ? '<div class="armador-reglas-nota">En el horario real (Excel) las reglas no se aplican; cambia a “Generado” para verlas en acción.</div>' : ''}
        </div>
      </div>
    `;
  },

  // Tarjeta lateral con los grupos / duplas creados (aquí se ve "con qué niño le toca a cada uno").
  _gruposHtml(catalogo) {
    const grupos = this._gruposGuardados();
    const TLABEL = { kids: 'Grupal KIDS', dupla_nino: 'Dupla de niños', dupla_ter: 'Dupla de terapeutas', grupal: 'Grupal' };
    return `
      <div class="armador-card">
        <div class="armador-card-head">${this._icons.plus}Grupos y duplas</div>
        <div class="armador-card-body">
          ${grupos.length ? `<ul class="armador-grupos">
            ${grupos.map(g => {
              const ters = (g.terapeutas || []).map(s => catalogo.terapeutas[s]?.nombre || s).join(' + ');
              return `<li class="armador-grupo">
                <div class="armador-grupo-top"><b>${UI.esc(TLABEL[g.tipo] || 'Grupo')}</b><button class="armador-grupo-del" data-gid="${g.id}" title="Eliminar">×</button></div>
                <div class="armador-grupo-nin">${UI.esc((g.ninos || []).join(' · '))}</div>
                <div class="armador-grupo-meta">${UI.esc(ters)}${g.sala ? ' · ' + UI.esc(g.sala) : ''} · ${g.sesiones || 1}/sem</div>
              </li>`;
            }).join('')}
          </ul>` : '<div class="armador-grupos-empty">Sin grupos aún. Usa "Crear grupo" para armar una dupla o grupal.</div>'}
        </div>
      </div>
    `;
  },

  _abrirFormGrupo() {
    const { intensivo, catalogo } = this._cache;
    const ninos = intensivo.niños;
    const ters = Object.entries(catalogo.terapeutas).map(([sigla, t]) => ({ sigla, nombre: t.nombre, disc: t.disciplina, sala: t.sala }));
    const salas = [...new Set(ters.map(t => t.sala).filter(Boolean))];
    const franjas = catalogo.franjas || [];
    const html = `
      <div class="pendiente-modal-overlay" id="grupoOverlay">
        <div class="pendiente-modal armador-form-modal">
          <div class="pendiente-modal-head">
            ${this._icons.plus}
            <div><div class="pendiente-modal-title">Crear grupo / dupla</div><div class="pendiente-modal-eyebrow">Define quiénes comparten la sesión</div></div>
            <button class="panel-close" id="grupoClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="pendiente-modal-body" style="display:flex;flex-direction:column;gap:12px;padding:14px">
            <div class="armador-form-field">
              <span>Tipo</span>
              <select id="grupoTipo">
                <option value="grupal">Grupal (varios niños · 1-2 terapeutas)</option>
                <option value="dupla_nino">Dupla de niños (2 niños · 1 terapeuta)</option>
                <option value="dupla_ter">Dupla de terapeutas (2 terapeutas · 1 niño)</option>
                <option value="kids">Grupal KIDS</option>
              </select>
            </div>
            <div class="armador-form-field">
              <span>Niños del grupo</span>
              <div class="grupo-chklist">${ninos.map(n => `<label class="reu-ter-chk"><input type="checkbox" data-nino value="${UI.esc(n.nombre)}"><span>${UI.esc(n.nombre)}</span></label>`).join('')}</div>
            </div>
            <div class="armador-form-field">
              <span>Terapeuta(s)</span>
              <div class="grupo-chklist">${ters.map(t => `<label class="reu-ter-chk"><input type="checkbox" data-ter value="${UI.esc(t.sigla)}"><span>${UI.esc(t.sigla)} <small>${UI.esc(t.nombre)} · ${UI.esc(t.disc)}</small></span></label>`).join('')}</div>
            </div>
            <div class="armador-form-grid">
              <div class="armador-form-field"><span>Sala</span><select id="grupoSala"><option value="">— automática —</option>${salas.map(s => `<option value="${UI.esc(s)}">${UI.esc(s)}</option>`).join('')}</select></div>
              <div class="armador-form-field"><span>Sesiones / semana</span><input type="number" id="grupoSes" min="1" max="10" value="3"></div>
              <div class="armador-form-field"><span>Hora (opcional)</span><select id="grupoHora"><option value="">— sin fijar —</option>${franjas.map((fr, i) => (i !== 0 && i !== franjas.length - 1) ? `<option value="${i}">${UI.esc(fr)}</option>` : '').join('')}</select></div>
            </div>
          </div>
          <div class="pendiente-modal-foot">
            <button class="btn btn-ghost" id="grupoCancel">Cancelar</button>
            <button class="btn btn-primary" id="grupoSave">Crear y regenerar</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const cerrar = () => document.getElementById('grupoOverlay')?.remove();
    document.getElementById('grupoClose').addEventListener('click', cerrar);
    document.getElementById('grupoCancel').addEventListener('click', cerrar);
    document.getElementById('grupoOverlay').addEventListener('click', e => { if (e.target.id === 'grupoOverlay') cerrar(); });
    document.getElementById('grupoSave').addEventListener('click', () => {
      const tipo = document.getElementById('grupoTipo').value;
      const ninosSel = [...document.querySelectorAll('#grupoOverlay input[data-nino]:checked')].map(i => i.value);
      const tersSel = [...document.querySelectorAll('#grupoOverlay input[data-ter]:checked')].map(i => i.value);
      const sala = document.getElementById('grupoSala').value || (tersSel[0] ? catalogo.terapeutas[tersSel[0]]?.sala : '') || '';
      const ses = parseInt(document.getElementById('grupoSes').value, 10) || 1;
      const heRaw = document.getElementById('grupoHora').value;
      // Validación según tipo
      const reqN = tipo === 'dupla_nino' ? 2 : tipo === 'dupla_ter' ? 1 : 2;
      const reqT = tipo === 'dupla_ter' ? 2 : 1;
      if (ninosSel.length < reqN) { UI.toast(`Elige al menos ${reqN} niño${reqN > 1 ? 's' : ''}`, 'error'); return; }
      if (tersSel.length < reqT) { UI.toast(`Elige ${reqT} terapeuta${reqT > 1 ? 's' : ''}`, 'error'); return; }
      const grupo = {
        id: 'GRP-' + (this._gruposGuardados().reduce((m, g) => Math.max(m, parseInt(String(g.id).replace(/\D/g, ''), 10) || 0), 0) + 1),
        tipo, ninos: ninosSel, terapeutas: tersSel, sala, sesiones: ses,
        hora_entrada: heRaw === '' ? null : Number(heRaw),
      };
      cerrar();
      this._aplicarGrupoNuevo(grupo);
      UI.toast('Grupo creado · horario regenerado', 'success');
    });
  },

  // Panel de restricciones editables (pedido de Trini). Los cupos de sala los usa el motor de verdad.
  _restriccionesHtml() {
    const cap = this._salasCapEfectiva();
    const salasTO = ['TO', 'TO 2']; // TO1 y TO2
    const otras = Object.keys(cap).filter(s => !salasTO.includes(s));
    const filaCap = (sala, etiqueta) => `
      <div class="armador-restr-row">
        <span class="armador-restr-sala">${UI.esc(etiqueta || sala)}</span>
        <div class="armador-restr-stepper">
          <input type="number" min="1" max="9" class="armador-restr-input" data-sala="${UI.esc(sala)}" value="${cap[sala] || 1}">
          <span class="armador-restr-unit">niños/bloque</span>
        </div>
      </div>`;
    const custom = this._restriccCustom();
    return `
      <div class="armador-card">
        <div class="armador-card-head">${this._icons.check}Restricciones de sala</div>
        <div class="armador-card-body">
          <div class="armador-restr-group-h">Salas de Terapia Ocupacional</div>
          ${filaCap('TO', 'Sala TO1')}
          ${filaCap('TO 2', 'Sala TO2')}
          <label class="armador-restr-obs">
            <span>Máx. observaciones por sala TO</span>
            <input type="number" min="1" max="6" class="armador-restr-obs-input" value="2">
          </label>
          <details class="armador-restr-otras">
            <summary>Otras salas</summary>
            ${otras.map(s => filaCap(s)).join('')}
          </details>
          <div class="armador-restr-group-h" style="margin-top:12px">Restricciones adicionales</div>
          <ul class="armador-restr-custom">
            ${custom.length ? custom.map((t, i) => `<li>${UI.esc(t)}<button class="armador-restr-del" data-i="${i}" title="Quitar">×</button></li>`).join('') : '<li class="armador-restr-empty">Agrega una regla propia cuando la necesites.</li>'}
          </ul>
          <div class="armador-restr-add">
            <input type="text" id="armadorRestrInput" placeholder="Ej: TO2 solo en la mañana">
            <button class="btn btn-ghost btn-sm" id="armadorRestrAdd">Agregar</button>
          </div>
          <button class="btn btn-primary btn-sm" id="armadorRestrAplicar" style="margin-top:10px;width:100%">Aplicar y regenerar</button>
        </div>
      </div>
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
        if (!sem.grid[ni]) return;  // niño extra sin fila en horario real
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
      const extra = n._extra ? ' is-extra' : '';
      const badgeExtra = n._extra ? `<span class="armador-cumpl-badge-extra" title="Agregado a mano · click en el ícono para quitar">nuevo</span>` : '';
      const btnDel = n._extra ? `<span class="armador-cumpl-del" data-ni-del="${ni}" title="Quitar este niño">${this._icons.trash}</span>` : '';
      // Marca de revisión: si alguna asignación tiene _revisar, mostrar ⓘ con tooltip
      const revisar = (n.asignaciones || []).filter(a => a._revisar);
      const badgeRev = revisar.length ? `<span class="armador-cumpl-badge-rev" title="${UI.esc(revisar.map(r => `• ${r.sigla}: ${r._revisar}`).join('\n'))}">⚑ revisar con Trini</span>` : '';
      return `
        <button class="armador-cumpl-row${activo}${extra}" data-ni="${ni}">
          <div class="armador-cumpl-head">
            <span class="armador-cumpl-name">${UI.esc(n.nombre)}${badgeExtra}</span>
            <span class="armador-cumpl-right">
              <span class="armador-cumpl-pct ${cls}">${pct}%</span>
              ${btnDel}
            </span>
          </div>
          <div class="armador-cumpl-meta">${cumplido}/${esperado} individuales · ${kids} en KIDS${n.instancia && n.instancia !== 'intensivo' ? ` · <b style="text-transform:capitalize">${UI.esc(n.instancia === 'continua' ? 'atención continua' : n.instancia)}</b>` : ''}${n.fecha_inicio ? ` · desde ${UI.esc(n.fecha_inicio)}` : ''}</div>
          <div class="armador-cumpl-bar"><div class="armador-cumpl-fill ${cls}" style="width:${pct}%"></div></div>
          ${badgeRev}
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
    document.getElementById('armadorAddBtn')?.addEventListener('click', () => this._abrirFormNino());
    document.getElementById('armadorAddGrupoBtn')?.addEventListener('click', () => this._abrirFormGrupo());
    document.querySelectorAll('.armador-grupo-del').forEach(b => b.addEventListener('click', () => this._borrarGrupo(b.dataset.gid)));
    document.getElementById('armadorTourBtn')?.addEventListener('click', () => this._abrirTour());

    // Restricciones de sala
    document.querySelectorAll('.armador-restr-input').forEach(inp =>
      inp.addEventListener('change', () => {
        const v = Math.max(1, parseInt(inp.value, 10) || 1);
        inp.value = v;
        this._setSalaCap(inp.dataset.sala, v);
      })
    );
    document.getElementById('armadorRestrAdd')?.addEventListener('click', () => {
      const inp = document.getElementById('armadorRestrInput');
      const txt = (inp?.value || '').trim();
      if (!txt) return;
      const arr = this._restriccCustom(); arr.push(txt); this._setRestriccCustom(arr);
      this.render();
    });
    document.querySelectorAll('.armador-restr-del').forEach(b =>
      b.addEventListener('click', () => {
        const arr = this._restriccCustom(); arr.splice(parseInt(b.dataset.i, 10), 1); this._setRestriccCustom(arr);
        this.render();
      })
    );
    document.getElementById('armadorRestrAplicar')?.addEventListener('click', () => {
      this._generar();
      this.render();
      UI.toast(this._resultado.ok ? 'Restricciones aplicadas · horario regenerado' : 'Aplicadas · quedaron conflictos por revisar', this._resultado.ok ? 'success' : 'warning');
    });

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

    document.getElementById('armadorIntensivo')?.addEventListener('change', (e) => {
      this._intensivoVista = e.target.value; // '40' | '41' | '42'
      this._filtroNino = -1; // los niños difieren entre intensivos; volver a "Todos"
      this._activarCacheSegunToggle();
      this.render();
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
    document.querySelectorAll('.cal-item[data-sigla]').forEach(btn => {
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
      row.addEventListener('click', (e) => {
        // Si el click fue en el botón eliminar, no togglar filtro
        if (e.target.closest('[data-ni-del]')) return;
        const ni = parseInt(row.dataset.ni, 10);
        this._filtroNino = (this._filtroNino === ni) ? -1 : ni;
        this.render();
      });
    });
    document.querySelectorAll('[data-ni-del]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ni = parseInt(btn.dataset.niDel, 10);
        this._quitarNinoExtra(ni);
      });
    });
  },

  // ===== Form Agregar Niño =====
  // Adapta el formulario de "Agregar niño" según la instancia elegida.
  _aplicarInstanciaForm(inst) {
    const esInt = inst === 'intensivo', esCont = inst === 'continua', esEval = inst === 'evaluacion';
    const ov = document.getElementById('armadorFormOverlay');
    if (!ov) return;
    // Campos que solo aplican al intensivo (KIDS, hora grupal, preferencia de inicio, hint grupal)
    ov.querySelectorAll('.arm-solo-intensivo').forEach(el => { el.style.display = esInt ? '' : 'none'; });
    // Fecha de término: continua y evaluación (el intensivo la fija la cohorte)
    const termWrap = document.getElementById('armadorFormTerminoWrap');
    if (termWrap) termWrap.style.display = esInt ? 'none' : '';
    const termInput = document.getElementById('armadorFormTermino');
    if (termInput && !termInput.value && !esInt) termInput.value = HOY_ISO.slice(0, 4) + '-12-20';
    // Bloques informativos
    const contInfo = document.getElementById('armadorFormContInfo');
    if (contInfo) contInfo.style.display = esCont ? '' : 'none';
    const evalInfo = document.getElementById('armadorFormEvalInfo');
    if (evalInfo) evalInfo.style.display = esEval ? '' : 'none';
    // Título y botón según instancia
    const titulo = ov.querySelector('.pendiente-modal-title');
    if (titulo) titulo.textContent = esInt ? 'Agregar niño al intensivo' : esCont ? 'Agregar niño a atención continua' : 'Agregar niño a evaluación';
    const eyebrow = ov.querySelector('.pendiente-modal-eyebrow');
    if (eyebrow) eyebrow.textContent = esInt ? 'Completa los datos y el sistema regenera el horario solo'
      : esEval ? 'Lunes y miércoles con la Dra. Lorena · se arma en la instancia de Evaluación'
      : 'Horario fijo hasta fin de año · se arma en la instancia de Atención continua';
    const save = document.getElementById('armadorFormSave');
    if (save) save.textContent = esInt ? 'Agregar y regenerar' : 'Registrar niño';
  },

  _abrirFormNino() {
    const { catalogo } = this._cache;
    // Agrupar terapeutas del catálogo por disciplina mapeada a las 5 secciones del form
    const SECCIONES = [
      { key: 'TO',   label: 'T.O.',   match: (d) => d === 'TO' },
      { key: 'FONO', label: 'Fono',   match: (d) => d === 'FONO' },
      { key: 'COG',  label: 'Cog',    match: (d) => d === 'ED COG' || d === 'COG' || d === 'F.EJEC' },
      { key: 'KINE', label: 'Kine',   match: (d) => d === 'KINE' },
      { key: 'PSI',  label: 'PSI',    match: (d) => d === 'PSIC' || d === 'PSI' || d === 'RDI' },
    ];
    const terapeutasDe = (matchFn) => Object.entries(catalogo.terapeutas)
      .filter(([_, t]) => matchFn(t.disciplina))
      .map(([sigla, t]) => ({ sigla, nombre: t.nombre }));

    const seccionHtml = (s) => {
      const ters = terapeutasDe(s.match);
      const opts = '<option value="">— sin asignar —</option>' +
        ters.map(t => `<option value="${UI.esc(t.sigla)}">${UI.esc(t.sigla)} · ${UI.esc(t.nombre)}</option>`).join('');
      return `
        <div class="armador-form-section">
          <div class="armador-form-section-title">${s.label}</div>
          <div class="armador-form-row">
            <label class="armador-form-rol">TUTOR</label>
            <select class="armador-form-sel" data-section="${s.key}" data-rol="TUTOR">${opts}</select>
            <input type="number" class="armador-form-ses" data-section="${s.key}" data-rol="TUTOR" min="0" max="10" placeholder="ses/sem" />
          </div>
          <div class="armador-form-row">
            <label class="armador-form-rol">CO-T</label>
            <select class="armador-form-sel" data-section="${s.key}" data-rol="COT">${opts}</select>
            <input type="number" class="armador-form-ses" data-section="${s.key}" data-rol="COT" min="0" max="10" placeholder="ses/sem" />
          </div>
          ${s.key === 'PSI' ? `
          <div class="armador-form-row armador-form-row-papas">
            <label class="armador-form-rol">PAPÁS</label>
            <select class="armador-form-sel" data-section="${s.key}" data-rol="PAPAS">${opts}</select>
            <input type="number" class="armador-form-ses" data-section="${s.key}" data-rol="PAPAS" min="0" max="4" placeholder="ses/sem" />
          </div>
          <div class="armador-form-papas-hint">La sesión con papás se agenda fuera del horario del niño.</div>
          ` : ''}
        </div>
      `;
    };

    const overlay = document.createElement('div');
    overlay.className = 'pendiente-modal-overlay';
    overlay.id = 'armadorFormOverlay';
    overlay.innerHTML = `
      <div class="pendiente-modal armador-form-modal">
        <div class="pendiente-modal-head">
          ${this._icons.plus}
          <div>
            <div class="pendiente-modal-title">Agregar niño al intensivo</div>
            <div class="pendiente-modal-eyebrow">Completa los datos y el sistema regenera el horario solo</div>
          </div>
          <button class="panel-close" id="armadorFormClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="pendiente-modal-body armador-form-body">
          <div class="armador-form-grid">
            <label class="armador-form-field">
              <span>Instancia</span>
              <select id="armadorFormInstancia">
                <option value="intensivo">Intensivo</option>
                <option value="continua">Atención continua</option>
                <option value="evaluacion">Evaluación</option>
              </select>
            </label>
            <label class="armador-form-field">
              <span>Fecha de inicio</span>
              <input type="date" id="armadorFormFechaInicio" value="${HOY_ISO}" />
            </label>
            <label class="armador-form-field" id="armadorFormTerminoWrap" style="display:none">
              <span>Fecha de término</span>
              <input type="date" id="armadorFormTermino" value="" />
            </label>
            <label class="armador-form-field">
              <span>Nombre del niño *</span>
              <input type="text" id="armadorFormNombre" maxlength="40" placeholder="Ej: TOMÁS" required />
            </label>
            <label class="armador-form-field">
              <span>Encargado del caso</span>
              <input type="text" id="armadorFormEncargado" maxlength="60" placeholder="Ej: Krasna Music" />
            </label>
            <label class="armador-form-field armador-form-kids arm-solo-intensivo">
              <span>Sesiones KIDS grupales / semana</span>
              <input type="number" id="armadorFormKids" min="0" max="10" value="5" />
            </label>
            <label class="armador-form-field arm-solo-intensivo">
              <span>Hora de entrada (sesión grupal)</span>
              <select id="armadorFormHoraEntrada">
                <option value="">— sin fijar —</option>
                ${(catalogo.franjas || []).map((fr, i) => (i !== 0 && i !== (catalogo.franjas.length - 1)) ? `<option value="${i}">${UI.esc(fr)}</option>` : '').join('')}
              </select>
            </label>
            <label class="armador-form-field arm-solo-intensivo">
              <span>Preferencia de inicio del día</span>
              <select id="armadorFormInicio">
                <option value="">— sin preferencia —</option>
                <option value="TO">Partir con Terapia Ocupacional</option>
                <option value="FONO">Partir con Fonoaudiología</option>
                <option value="COG">Partir con Cognitivo</option>
                <option value="PSI">Partir con Psicología</option>
                <option value="KINE">Partir con Kinesiología</option>
              </select>
            </label>
          </div>
          <div class="armador-form-hint armador-form-hint-soft arm-solo-intensivo">Los niños con la misma hora de entrada comparten su sesión grupal a esa hora. Las duplas y grupos se arman con el botón "Crear grupo".</div>
          <div class="armador-form-info arm-info-continua" id="armadorFormContInfo" style="display:none">
            <b>Atención continua:</b> pocas sesiones por semana, con horario fijo hasta la fecha de término (fin de año). Se registra como bloques ocupados para que el motor los respete al armar los próximos intensivos.
          </div>
          <div class="armador-form-info arm-info-eval" id="armadorFormEvalInfo" style="display:none">
            <b>Evaluación:</b> 2 sesiones por semana (lunes y miércoles), liderada por la <b>Dra. Lorena</b> (NEU). Estructura: reunión de ingreso (Dra. Lorena) → evaluación presencial (Dra. Lorena + psicología + cognitivo + fono) → devolución (Dra. Lorena). Completa abajo el equipo evaluador.
          </div>
          <div class="armador-form-disc-grid">
            ${SECCIONES.map(seccionHtml).join('')}
          </div>
          <div class="armador-form-hint">
            <b>Tip:</b> Solo completa el nº de sesiones donde el niño realmente tiene un terapeuta asignado. Los espacios en blanco se ignoran.
          </div>
        </div>
        <div class="pendiente-modal-foot">
          <button class="btn btn-ghost" id="armadorFormCancel">Cancelar</button>
          <button class="btn btn-primary" id="armadorFormSave">Agregar y regenerar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const cerrar = () => overlay.remove();
    document.getElementById('armadorFormClose').addEventListener('click', cerrar);
    document.getElementById('armadorFormCancel').addEventListener('click', cerrar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
    setTimeout(() => document.getElementById('armadorFormNombre')?.focus(), 80);

    // El formulario cambia según la instancia (intensivo / continua / evaluación)
    const instSel = document.getElementById('armadorFormInstancia');
    instSel?.addEventListener('change', () => this._aplicarInstanciaForm(instSel.value));
    this._aplicarInstanciaForm(instSel?.value || 'intensivo');

    document.getElementById('armadorFormSave').addEventListener('click', () => {
      const nombre = document.getElementById('armadorFormNombre').value.trim().toUpperCase();
      if (!nombre) {
        UI.toast('Falta el nombre del niño', 'error');
        document.getElementById('armadorFormNombre').focus();
        return;
      }
      const encargado = document.getElementById('armadorFormEncargado').value.trim();
      const instancia = document.getElementById('armadorFormInstancia')?.value || 'intensivo';
      const esInt = instancia === 'intensivo';
      // KIDS, hora grupal y preferencia solo aplican al intensivo
      const kids = esInt ? (parseInt(document.getElementById('armadorFormKids').value, 10) || 0) : 0;
      const heRaw = document.getElementById('armadorFormHoraEntrada').value;
      const horaEntrada = esInt && heRaw !== '' ? Number(heRaw) : null;
      const preferenciaInicio = esInt ? (document.getElementById('armadorFormInicio').value || null) : null;
      const fechaInicio = document.getElementById('armadorFormFechaInicio')?.value || HOY_ISO;
      const fechaTermino = esInt ? null : (document.getElementById('armadorFormTermino')?.value || null);
      const asignaciones = [];
      SECCIONES.forEach(s => {
        const roles = s.key === 'PSI' ? ['TUTOR', 'COT', 'PAPAS'] : ['TUTOR', 'COT'];
        roles.forEach(rol => {
          const sel = document.querySelector(`.armador-form-sel[data-section="${s.key}"][data-rol="${rol}"]`);
          const ses = document.querySelector(`.armador-form-ses[data-section="${s.key}"][data-rol="${rol}"]`);
          const sigla = sel?.value?.trim();
          const n = parseInt(ses?.value, 10);
          if (sigla && n > 0) {
            const disciplina = catalogo.terapeutas[sigla]?.disciplina || s.key;
            asignaciones.push({ disciplina, rol, sigla, sesiones: n });
          }
        });
      });
      if (!asignaciones.length && kids === 0) {
        UI.toast('Agrega al menos una asignación o sesiones KIDS', 'error');
        return;
      }
      const ninoNuevo = {
        nombre,
        encargado,
        instancia,        // intensivo | continua | evaluacion
        fecha_inicio: fechaInicio,
        fecha_termino: fechaTermino,  // fin de año para continua/evaluación; null en intensivo
        kids_semanal: kids,
        hora_entrada: horaEntrada,  // franja índice o null; agrupa la sesión grupal a esa hora
        preferencia_inicio: preferenciaInicio,  // disciplina con la que prefiere partir el día
        total_ses_semanal: asignaciones.reduce((s, a) => s + a.sesiones, 0) + kids,
        asignaciones,
        _extra: true,  // marcador para distinguir niños agregados a mano
      };
      cerrar();
      // El intensivo se regenera con el motor; continua/evaluación se registran en su propia instancia.
      if (esInt) this._aplicarNinoNuevo(ninoNuevo);
      else this._registrarNinoOtraInstancia(ninoNuevo);
    });
  },

  // Registra un niño de atención continua o evaluación sin tocar el grid del intensivo
  // (esas instancias se arman por separado; el motor por instancia queda para una fase dedicada).
  _registrarNinoOtraInstancia(nino) {
    // Evaluación tiene su propio flujo (datos básicos → fechas → mail → reuniones → formularios).
    if (nino.instancia === 'evaluacion') {
      const caso = this._nuevoCasoEval({ nombre: nino.nombre, apoderado: nino.encargado, fechaInicio: nino.fecha_inicio, semanas: 1 });
      const arr = this._evaluaciones(); arr.push(caso); this._persistirEvaluaciones(arr);
      this._intensivoVista = 'eval';
      this._activarCacheSegunToggle();
      this.render();
      UI.toast(`${nino.nombre} agregado a Evaluación`, 'success');
      return;
    }
    const KEY = 'casanogal_armador_otras_instancias';
    let arr = [];
    try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(a)) arr = a; } catch {}
    arr.push(nino);
    localStorage.setItem(KEY, JSON.stringify(arr));
    UI.toast(`${nino.nombre} registrado en Atención continua. Esa instancia se arma por separado (en construcción).`, 'success');
  },

  // ===================== MÓDULO DE EVALUACIÓN =====================
  // Flujo aparte del intensivo: equipo evaluador de 4, 2 sesiones/semana, mail con documentos,
  // reuniones online y formularios que al recibirse quedan registrados en el caso.
  KEY_EVAL: 'casanogal_armador_evaluaciones',
  _evaluaciones() {
    try { const a = JSON.parse(localStorage.getItem(this.KEY_EVAL) || 'null'); if (Array.isArray(a)) return a; } catch {}
    // En la instancia real se arranca vacío; en la demo, un caso de ejemplo para ver el flujo.
    if (typeof State !== 'undefined' && State.instanciaReal) { this._persistirEvaluaciones([]); return []; }
    const seed = [this._nuevoCasoEval({ nombre: 'Ejemplo · Martina', apoderado: 'Apoderado de Martina', email: '', semanas: 3, motivo: 'Evaluación de ingreso · sospecha TEA' })];
    this._persistirEvaluaciones(seed);
    return seed;
  },
  _persistirEvaluaciones(arr) { localStorage.setItem(this.KEY_EVAL, JSON.stringify(arr)); },

  // Equipo evaluador por defecto (4), tomado del catálogo real; todo editable después.
  _equipoEvalDefault() {
    const cat = this._cache?.catalogo || {};
    const ters = Object.entries(cat.terapeutas || {});
    const buscar = (re) => { const e = ters.find(([s, t]) => re.test(t.disciplina || '') || re.test(s)); return e ? { sigla: e[0], nombre: e[1].nombre } : { sigla: '', nombre: '' }; };
    return [
      { rol: 'Líder · Neurología', ...buscar(/NEU|Neuro|^LP$/i) },
      { rol: 'Evaluación Cognitiva', ...buscar(/Cognitiva|PSIC|^MM$/i) },
      { rol: 'Cognitivo', ...buscar(/ED COG|COG|EJEC/i) },
      { rol: 'Fonoaudiología', ...buscar(/FONO/i) },
    ];
  },
  _docsEvalDefault() {
    return ['Consentimiento informado', 'Ficha de anamnesis', 'Cuestionario para los padres', 'Autorización de uso de datos'].map(nombre => ({ nombre, enviado: false }));
  },
  _formsEvalDefault() {
    return ['Cuestionario para los padres', 'Escala de desarrollo', 'Historia clínica del niño'].map(nombre => ({ nombre, estado: 'pendiente', fecha: null }));
  },
  // Lunes de la semana de una fecha ISO
  _lunesDe(iso) {
    const d = new Date((iso || HOY_ISO) + 'T00:00:00');
    const dow = (d.getDay() + 6) % 7; // 0 = lunes
    d.setDate(d.getDate() - dow);
    return d.toISOString().slice(0, 10);
  },
  // Genera 2 sesiones/semana (lunes + miércoles) durante N semanas desde una fecha de inicio.
  _genSesionesEval(fechaInicio, semanas, hora) {
    const lun0 = this._lunesDe(fechaInicio);
    const n = Math.max(1, semanas || 1);
    const ses = [];
    for (let w = 0; w < n; w++) {
      const lun = this._sumarDias(lun0, w * 7);
      const mie = this._sumarDias(lun0, w * 7 + 2);
      ses.push({ fecha: lun, hora: hora || '09:00', tipo: w === 0 ? 'ingreso' : 'presencial', modalidad: w === 0 ? 'online' : 'presencial', link: '' });
      ses.push({ fecha: mie, hora: hora || '11:00', tipo: w === n - 1 ? 'devolucion' : 'presencial', modalidad: w === n - 1 ? 'online' : 'presencial', link: '' });
    }
    return ses;
  },
  _nuevoCasoEval(base) {
    base = base || {};
    return {
      id: 'EVAL-' + (this._evaluacionesRaw?.length || 0) + '-' + this._semilla + '-' + Math.floor(Math.random() * 100000),
      nombre: base.nombre || 'Nuevo niño',
      apoderado: base.apoderado || '',
      email: base.email || '',
      telefono: base.telefono || '',
      motivo: base.motivo || '',
      equipo: base.equipo || this._equipoEvalDefault(),
      sesiones: base.sesiones || this._genSesionesEval(base.fechaInicio || HOY_ISO, base.semanas || 2, '09:00'),
      documentos: base.documentos || this._docsEvalDefault(),
      formularios: base.formularios || this._formsEvalDefault(),
      estado: 'agendada',
      creada: HOY_ISO,
    };
  },

  // mailto con asunto + cuerpo prellenado (documentos + fechas de la evaluación)
  _mailEvalHref(caso) {
    const to = caso.email || '';
    const subject = `Casa Nogal · Proceso de evaluación de ${caso.nombre}`;
    const docs = (caso.documentos || []).map(d => `  • ${d.nombre}`).join('\n');
    const fechas = (caso.sesiones || []).map(s => `  • ${UI.fmtFechaCorta(s.fecha)} ${s.hora} — ${this._tipoEvalLabel(s.tipo)} (${s.modalidad === 'online' ? 'online' : 'presencial'})`).join('\n');
    const equipo = (caso.equipo || []).filter(e => e.nombre).map(e => `  • ${e.nombre} — ${e.rol}`).join('\n');
    const body =
`Estimada familia de ${caso.nombre}:

Les damos la bienvenida al proceso de evaluación en Casa Nogal. A continuación encontrarán la información para comenzar.

Documentos a completar y enviar antes de la primera sesión:
${docs || '  • (por definir)'}

Fechas agendadas:
${fechas || '  • (por agendar)'}

Equipo evaluador:
${equipo || '  • (por asignar)'}

Cualquier duda, quedamos atentos.

Equipo Casa Nogal`;
    return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  },
  _tipoEvalLabel(t) { return t === 'ingreso' ? 'Reunión de ingreso' : t === 'devolucion' ? 'Devolución' : 'Evaluación presencial'; },
  // Solo acepta http/https como link de reunión (evita esquemas peligrosos tipo javascript:)
  _linkSeguro(u) { return /^https?:\/\//i.test((u || '').trim()) ? u.trim() : ''; },

  _htmlEval(data) {
    const casos = this._evaluaciones();
    this._evaluacionesRaw = casos;
    const agenda = this._agendaEvalHtml(casos);
    const tarjetas = casos.length
      ? casos.map((c, i) => this._casoEvalHtml(c, i)).join('')
      : `<div class="empty-state"><div class="empty-state-title">Sin evaluaciones agendadas</div><div class="empty-state-sub">Crea la primera evaluación con el botón de arriba.</div></div>`;
    return `
      ${this._toolbarHtml(data.intensivo)}
      <div class="armador-hero">
        <div class="armador-hero-info">
          <div class="armador-eyebrow">Evaluación · flujo aparte del intensivo</div>
          <h2 class="armador-title">Evaluaciones</h2>
          <p class="armador-subtitle">Equipo evaluador de 4 · 2 evaluaciones por semana (lunes y miércoles). Cada evaluación tiene su flujo: crear al niño con sus datos, agendar las fechas, mandar el mail con los documentos, coordinar las reuniones online y recibir los formularios que quedan en su ficha.</p>
        </div>
        <div class="armador-hero-cta">
          <button class="btn btn-primary" id="evalAddBtn">${this._icons.plus}Nueva evaluación</button>
        </div>
      </div>
      ${agenda}
      <div class="eval-casos">${tarjetas}</div>
    `;
  },

  // Agenda multi-semana: las sesiones agrupadas por semana (puede ir varias semanas adelante).
  _agendaEvalHtml(casos) {
    const todas = [];
    casos.forEach(c => (c.sesiones || []).forEach(s => todas.push({ ...s, nombre: c.nombre })));
    if (!todas.length) return '';
    const porSemana = {};
    todas.forEach(s => { const lun = this._lunesDe(s.fecha); (porSemana[lun] = porSemana[lun] || []).push(s); });
    const semanas = Object.keys(porSemana).sort();
    const bloques = semanas.map(lun => {
      const items = porSemana[lun].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
      const fin = this._sumarDias(lun, 4);
      return `
        <div class="eval-agenda-sem">
          <div class="eval-agenda-sem-h">Semana del ${UI.fmtFechaCorta(lun)} al ${UI.fmtFechaCorta(fin)}</div>
          <div class="eval-agenda-items">
            ${items.map(s => `
              <div class="eval-agenda-item eval-t-${s.tipo}">
                <span class="eval-agenda-fecha">${UI.fmtFechaCorta(s.fecha)} · ${UI.esc(s.hora)}</span>
                <span class="eval-agenda-nino">${UI.esc(s.nombre)}</span>
                <span class="eval-agenda-tipo">${this._tipoEvalLabel(s.tipo)}${s.modalidad === 'online' ? ' · online' : ''}</span>
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');
    return `
      <div class="armador-card eval-agenda">
        <div class="armador-card-head">${this._icons.check}Agenda de evaluaciones</div>
        <div class="armador-card-body">${bloques}</div>
      </div>`;
  },

  _casoEvalHtml(c, i) {
    const equipo = (c.equipo || []).filter(e => e.nombre || e.sigla);
    const online = (c.sesiones || []).filter(s => s.modalidad === 'online');
    const docsEnviados = (c.documentos || []).filter(d => d.enviado).length;
    const formsRecibidos = (c.formularios || []).filter(f => f.estado === 'recibido').length;
    const paso = (n, titulo, hecho, cuerpo) => `
      <div class="eval-paso${hecho ? ' is-done' : ''}">
        <div class="eval-paso-n">${hecho ? this._icons.ok : n}</div>
        <div class="eval-paso-body">
          <div class="eval-paso-t">${titulo}</div>
          ${cuerpo}
        </div>
      </div>`;

    const datosCuerpo = `
      <div class="eval-datos">
        ${c.apoderado ? `<span><b>Apoderado:</b> ${UI.esc(c.apoderado)}</span>` : ''}
        ${c.email ? `<span><b>Correo:</b> ${UI.esc(c.email)}</span>` : ''}
        ${c.telefono ? `<span><b>Teléfono:</b> ${UI.esc(c.telefono)}</span>` : ''}
        ${c.motivo ? `<span><b>Motivo:</b> ${UI.esc(c.motivo)}</span>` : ''}
      </div>
      <div class="eval-equipo">${equipo.length ? equipo.map(e => `<span class="eval-equipo-chip">${UI.esc(e.nombre || e.sigla)} <small>${UI.esc(e.rol)}</small></span>`).join('') : '<i class="eval-muted">Equipo por asignar</i>'}</div>`;

    const docsCuerpo = `
      <ul class="eval-docs">
        ${(c.documentos || []).map((d, di) => `
          <li>
            <label class="eval-chk"><input type="checkbox" class="eval-doc-chk" data-ci="${i}" data-di="${di}" ${d.enviado ? 'checked' : ''}><span>${UI.esc(d.nombre)}</span></label>
          </li>`).join('') || '<li class="eval-muted">Sin documentos</li>'}
      </ul>
      <a class="btn btn-secondary btn-sm" href="${this._mailEvalHref(c)}">${this._icons.info}Generar mail con los documentos</a>`;

    const reunionesCuerpo = online.length ? `
      <ul class="eval-reuniones">
        ${online.map(s => {
          const gi = (c.sesiones || []).indexOf(s);
          return `<li class="eval-reunion">
            <span class="eval-reunion-fecha">${UI.fmtFechaCorta(s.fecha)} · ${UI.esc(s.hora)} · ${this._tipoEvalLabel(s.tipo)}</span>
            <input type="url" class="eval-link-in" data-ci="${i}" data-si="${gi}" value="${UI.esc(s.link || '')}" placeholder="Pega el link de Zoom/Meet…">
            ${this._linkSeguro(s.link) ? `<a class="btn btn-ghost btn-sm" href="${UI.esc(this._linkSeguro(s.link))}" target="_blank" rel="noopener">Unirse</a>` : ''}
          </li>`;
        }).join('')}
      </ul>` : '<div class="eval-muted">Sin reuniones online agendadas.</div>';

    const formsCuerpo = `
      <ul class="eval-forms">
        ${(c.formularios || []).map((f, fi) => `
          <li class="eval-form">
            <span class="eval-form-nom">${UI.esc(f.nombre)}</span>
            ${f.estado === 'recibido'
              ? `<span class="eval-form-badge is-ok">Recibido${f.fecha ? ' · ' + UI.fmtFechaCorta(f.fecha) : ''} · en la ficha</span>`
              : `<button class="btn btn-ghost btn-sm eval-form-recibir" data-ci="${i}" data-fi="${fi}">Marcar recibido</button>`}
          </li>`).join('') || '<li class="eval-muted">Sin formularios</li>'}
      </ul>`;

    return `
      <div class="armador-card eval-caso">
        <div class="eval-caso-head">
          <div>
            <div class="eval-caso-nom">${UI.esc(c.nombre)}</div>
            <div class="eval-caso-meta">${(c.sesiones || []).length} sesiones · ${docsEnviados}/${(c.documentos || []).length} documentos enviados · ${formsRecibidos}/${(c.formularios || []).length} formularios recibidos</div>
          </div>
          <div class="eval-caso-actions">
            <button class="btn btn-ghost btn-sm eval-edit" data-ci="${i}">Editar</button>
            <button class="btn btn-ghost btn-sm eval-del" data-ci="${i}" title="Quitar esta evaluación">${this._icons.trash}</button>
          </div>
        </div>
        <div class="eval-pasos">
          ${paso(1, 'Datos del niño y equipo', !!(c.apoderado || c.motivo), datosCuerpo)}
          ${paso(2, 'Enviar documentos', docsEnviados > 0, docsCuerpo)}
          ${paso(3, 'Reuniones online', online.some(s => s.link), reunionesCuerpo)}
          ${paso(4, 'Formularios en la ficha', formsRecibidos > 0, formsCuerpo)}
        </div>
      </div>`;
  },

  _wireEval() {
    // Selector de vista (compartido con la vista intensivo)
    document.getElementById('armadorIntensivo')?.addEventListener('change', (e) => {
      this._intensivoVista = e.target.value;
      this._filtroNino = -1;
      this._activarCacheSegunToggle();
      this.render();
    });
    document.getElementById('evalAddBtn')?.addEventListener('click', () => this._abrirFormEval());
    const casos = this._evaluaciones();
    const guardar = () => this._persistirEvaluaciones(casos);
    document.querySelectorAll('.eval-doc-chk').forEach(chk =>
      chk.addEventListener('change', () => {
        const c = casos[+chk.dataset.ci]; if (!c) return;
        c.documentos[+chk.dataset.di].enviado = chk.checked;
        guardar();
      })
    );
    document.querySelectorAll('.eval-link-in').forEach(inp =>
      inp.addEventListener('change', () => {
        const c = casos[+inp.dataset.ci]; if (!c) return;
        const val = inp.value.trim();
        if (val && !this._linkSeguro(val)) { UI.toast('El link debe empezar con http:// o https://', 'error'); return; }
        c.sesiones[+inp.dataset.si].link = val;
        guardar(); this.render();
      })
    );
    document.querySelectorAll('.eval-form-recibir').forEach(btn =>
      btn.addEventListener('click', () => {
        const c = casos[+btn.dataset.ci]; if (!c) return;
        const f = c.formularios[+btn.dataset.fi];
        f.estado = 'recibido'; f.fecha = HOY_ISO;
        guardar(); this.render();
        UI.toast(`"${f.nombre}" recibido y guardado en la ficha de ${c.nombre}`, 'success');
      })
    );
    document.querySelectorAll('.eval-edit').forEach(btn =>
      btn.addEventListener('click', () => this._abrirFormEval(+btn.dataset.ci))
    );
    document.querySelectorAll('.eval-del').forEach(btn =>
      btn.addEventListener('click', () => {
        const i = +btn.dataset.ci; const c = casos[i]; if (!c) return;
        if (!confirm(`¿Quitar la evaluación de ${c.nombre}?`)) return;
        casos.splice(i, 1); guardar(); this.render();
        UI.toast('Evaluación quitada', '');
      })
    );
  },

  _abrirFormEval(idx) {
    const casos = this._evaluaciones();
    const edit = typeof idx === 'number' && casos[idx];
    const c = edit ? casos[idx] : null;
    const cat = this._cache?.catalogo || {};
    const tersOpts = (selSigla) => '<option value="">— sin asignar —</option>' +
      Object.entries(cat.terapeutas || {}).map(([s, t]) => `<option value="${UI.esc(s)}" ${selSigla === s ? 'selected' : ''}>${UI.esc(s)} · ${UI.esc(t.nombre)}</option>`).join('');
    const equipo = c ? c.equipo : this._equipoEvalDefault();
    const inicio = c && c.sesiones?.length ? this._lunesDe(c.sesiones[0].fecha) : this._lunesDe(HOY_ISO);
    const nSem = c ? Math.max(1, Math.round((c.sesiones || []).length / 2)) : 2;
    const docsTxt = (c ? c.documentos.map(d => d.nombre) : this._docsEvalDefault().map(d => d.nombre)).join('\n');
    const formsTxt = (c ? c.formularios.map(f => f.nombre) : this._formsEvalDefault().map(f => f.nombre)).join('\n');

    const overlay = document.createElement('div');
    overlay.className = 'pendiente-modal-overlay';
    overlay.id = 'evalFormOverlay';
    overlay.innerHTML = `
      <div class="pendiente-modal armador-form-modal">
        <div class="pendiente-modal-head">
          ${this._icons.plus}
          <div>
            <div class="pendiente-modal-title">${edit ? 'Editar evaluación' : 'Nueva evaluación'}</div>
            <div class="pendiente-modal-eyebrow">Datos básicos, fechas (2/semana), equipo de 4, documentos y formularios</div>
          </div>
          <button class="panel-close" id="evalFormClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="pendiente-modal-body armador-form-body">
          <div class="armador-form-grid">
            <label class="armador-form-field"><span>Nombre del niño *</span><input type="text" id="evalNombre" maxlength="60" value="${c ? UI.esc(c.nombre) : ''}" placeholder="Ej: Martina"></label>
            <label class="armador-form-field"><span>Apoderado</span><input type="text" id="evalApoderado" maxlength="60" value="${c ? UI.esc(c.apoderado) : ''}" placeholder="Nombre del apoderado"></label>
            <label class="armador-form-field"><span>Correo del apoderado</span><input type="email" id="evalEmail" maxlength="80" value="${c ? UI.esc(c.email) : ''}" placeholder="correo@ejemplo.cl"></label>
            <label class="armador-form-field"><span>Teléfono</span><input type="text" id="evalTel" maxlength="30" value="${c ? UI.esc(c.telefono) : ''}" placeholder="+56 9 ..."></label>
            <label class="armador-form-field" style="grid-column:1/-1"><span>Motivo de consulta</span><input type="text" id="evalMotivo" maxlength="120" value="${c ? UI.esc(c.motivo) : ''}" placeholder="Ej: Evaluación de ingreso, sospecha TEA"></label>
            <label class="armador-form-field"><span>Inicio (lunes de la 1ª semana)</span><input type="date" id="evalInicio" value="${inicio}"></label>
            <label class="armador-form-field"><span>Nº de semanas</span><input type="number" id="evalSemanas" min="1" max="12" value="${nSem}"></label>
            <label class="armador-form-field"><span>Hora de las sesiones</span><input type="time" id="evalHora" value="${c && c.sesiones?.[0]?.hora ? UI.esc(c.sesiones[0].hora) : '09:00'}"></label>
          </div>
          <div class="armador-form-info arm-info-eval">
            <b>Equipo evaluador (4):</b> lunes y miércoles. Ajusta cada rol; los nombres salen del catálogo real.
          </div>
          <div class="eval-form-equipo">
            ${equipo.map((e, ei) => `
              <div class="eval-form-rol">
                <span class="eval-form-rol-lbl">${UI.esc(e.rol)}</span>
                <select class="eval-form-sel" data-ei="${ei}">${tersOpts(e.sigla)}</select>
              </div>`).join('')}
          </div>
          <div class="armador-form-grid">
            <label class="armador-form-field" style="grid-column:1/-1"><span>Documentos a enviar (uno por línea)</span><textarea id="evalDocs" rows="3" class="eval-form-ta">${UI.esc(docsTxt)}</textarea></label>
            <label class="armador-form-field" style="grid-column:1/-1"><span>Formularios que contestan los padres (uno por línea)</span><textarea id="evalForms" rows="3" class="eval-form-ta">${UI.esc(formsTxt)}</textarea></label>
          </div>
        </div>
        <div class="pendiente-modal-foot">
          <button class="btn btn-ghost" id="evalFormCancel">Cancelar</button>
          <button class="btn btn-primary" id="evalFormSave">${edit ? 'Guardar cambios' : 'Crear evaluación'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const cerrar = () => overlay.remove();
    document.getElementById('evalFormClose').addEventListener('click', cerrar);
    document.getElementById('evalFormCancel').addEventListener('click', cerrar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
    setTimeout(() => document.getElementById('evalNombre')?.focus(), 80);

    document.getElementById('evalFormSave').addEventListener('click', () => {
      const nombre = document.getElementById('evalNombre').value.trim();
      if (!nombre) { UI.toast('Falta el nombre del niño', 'error'); return; }
      const inicioV = document.getElementById('evalInicio').value || HOY_ISO;
      const semanas = Math.max(1, parseInt(document.getElementById('evalSemanas').value, 10) || 1);
      const hora = document.getElementById('evalHora').value || '09:00';
      const equipoNuevo = [...document.querySelectorAll('.eval-form-sel')].map((sel, ei) => {
        const sigla = sel.value.trim();
        const nombreTer = sigla ? (cat.terapeutas[sigla]?.nombre || sigla) : '';
        return { rol: equipo[ei].rol, sigla, nombre: nombreTer };
      });
      const parseLineas = (id) => (document.getElementById(id).value || '').split('\n').map(s => s.trim()).filter(Boolean);
      const docsNom = parseLineas('evalDocs');
      const formsNom = parseLineas('evalForms');

      if (edit) {
        // Conservar estado enviado/recibido y links cuando el nombre calza
        const prevDocs = c.documentos || []; const prevForms = c.formularios || []; const prevSes = c.sesiones || [];
        c.nombre = nombre;
        c.apoderado = document.getElementById('evalApoderado').value.trim();
        c.email = document.getElementById('evalEmail').value.trim();
        c.telefono = document.getElementById('evalTel').value.trim();
        c.motivo = document.getElementById('evalMotivo').value.trim();
        c.equipo = equipoNuevo;
        c.documentos = docsNom.map(nom => ({ nombre: nom, enviado: prevDocs.find(d => d.nombre === nom)?.enviado || false }));
        c.formularios = formsNom.map(nom => { const p = prevForms.find(f => f.nombre === nom); return { nombre: nom, estado: p?.estado || 'pendiente', fecha: p?.fecha || null }; });
        const nuevasSes = this._genSesionesEval(inicioV, semanas, hora);
        c.sesiones = nuevasSes.map(s => { const p = prevSes.find(x => x.fecha === s.fecha && x.hora === s.hora); return p ? { ...s, link: p.link || '' } : s; });
      } else {
        const caso = this._nuevoCasoEval({ nombre, apoderado: document.getElementById('evalApoderado').value.trim(), email: document.getElementById('evalEmail').value.trim(), fechaInicio: inicioV, semanas });
        caso.telefono = document.getElementById('evalTel').value.trim();
        caso.motivo = document.getElementById('evalMotivo').value.trim();
        caso.equipo = equipoNuevo;
        caso.sesiones = this._genSesionesEval(inicioV, semanas, hora);
        caso.documentos = docsNom.map(nom => ({ nombre: nom, enviado: false }));
        caso.formularios = formsNom.map(nom => ({ nombre: nom, estado: 'pendiente', fecha: null }));
        casos.push(caso);
      }
      this._persistirEvaluaciones(casos);
      cerrar();
      this.render();
      UI.toast(edit ? 'Evaluación actualizada' : `Evaluación de ${nombre} creada`, 'success');
    });
  },

  _aplicarNinoNuevo(nino) {
    const { intensivo } = this._cache;
    intensivo.niños.push(nino);
    const extras = this._ninosExtraGuardados();
    extras.push(nino);
    this._persistirNinosExtra(extras);
    this._generar();
    if (this._fuente === 'real') {
      this._fuente = 'generado'; // volver a generado porque el real no incluye este niño
      localStorage.setItem(this.KEY_FUENTE, 'generado');
    }
    this.render();
    const ok = this._resultado.ok;
    UI.toast(
      ok ? `Niño ${nino.nombre} agregado · horario regenerado sin conflictos` : `Niño ${nino.nombre} agregado · revisa los conflictos`,
      ok ? 'success' : 'warning'
    );
  },

  _quitarNinoExtra(ni) {
    const { intensivo } = this._cache;
    const nino = intensivo.niños[ni];
    if (!nino?._extra) return;
    if (!confirm(`¿Quitar a ${nino.nombre} del intensivo?`)) return;
    intensivo.niños.splice(ni, 1);
    const extras = this._ninosExtraGuardados().filter(n => n.nombre !== nino.nombre);
    this._persistirNinosExtra(extras);
    // Reset SIEMPRE el filtro, no solo si coincidía con el índice eliminado:
    // los índices superiores al eliminado se corrieron y el filtro queda desincronizado.
    this._filtroNino = -1;
    this._generar();
    this.render();
    UI.toast(`${nino.nombre} quitado del intensivo`, 'success');
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
    if (this._imprimiendo) return;  // bloquea doble-click
    this._imprimiendo = true;
    const btn = document.getElementById('armadorExportBtn');
    if (btn) btn.disabled = true;
    const ok = PDFArmador.render(ninoIdx, intensivo, semanas, catalogo);
    if (!ok) {
      UI.toast('No se pudo generar el PDF', 'error');
      this._imprimiendo = false;
      if (btn) btn.disabled = false;
      return;
    }
    document.body.classList.add('printing-padres');
    UI.toast('Preparando PDF del horario', 'success');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing-padres');
        PDFArmador.cleanup();
        this._imprimiendo = false;
        if (btn) btn.disabled = false;
      }, 800);
    }, 250);
  },

  // ===== Tour guiado detallado =====
  _abrirTour() {
    // Forzar modo Generado antes del tour (asegura que aparezcan TODOS los elementos)
    if (this._fuente !== 'generado') {
      this._fuente = 'generado';
      localStorage.setItem(this.KEY_FUENTE, 'generado');
      this.render();
    }
    // Limpiar filtros para que el tour parta desde el estado limpio
    const tuvoFiltro = this._filtroNino !== -1 || this._filtroSemana !== -1;
    if (tuvoFiltro) {
      this._filtroNino = -1;
      this._filtroSemana = -1;
      this._terapeutaResaltado = null;
      this.render();
    }

    const steps = [
      {
        title: 'Hola Trini',
        body: 'El Armador distribuye solo el horario del intensivo respetando que nadie esté en dos lados a la vez. Te muestro lo esencial en <b>8 pasos</b>, menos de 1 minuto.',
      },
      {
        target: '.armador-hero',
        position: 'below',
        title: 'Estado del horario',
        body: 'Arriba ves en una frase si el horario está <b>listo</b>, <b>incompleto</b>, o con <b>conflictos</b>. El badge a la derecha lo confirma con número.',
      },
      {
        target: '.armador-fuente-toggle',
        position: 'below',
        title: 'Real vs. Generado',
        body: '<b>Real</b> = lo que armaste en tu Excel. <b>Generado</b> = la propuesta del sistema con los mismos inputs. Sirven para comparar.',
        wait: 200,
      },
      {
        target: '#armadorFiltroNino',
        position: 'below',
        title: 'Filtros',
        body: 'Por defecto ves a los <b>6 niños juntos</b>. Filtra por niño o por semana para enfocarte en algo específico.',
      },
      {
        target: '.armador-calendar',
        position: 'auto',
        title: 'Leer el calendario',
        body: 'Cada fila es una <b>semana</b>, cada columna un <b>día</b>. Los bloques son sesiones, coloreados por disciplina (TO, FONO, COG, KINE, PSI, RDI, KIDS).<br><br>Cada bloque muestra hora, sigla del terapeuta e inicial del niño. <b>Click en un bloque resalta a ese terapeuta</b> en todo el calendario.',
      },
      {
        target: '.armador-side',
        position: 'left',
        title: 'Paneles laterales',
        body: 'A la derecha tienes <b>Equipo</b> (leyenda de siglas → nombre) y <b>Cumplimiento</b> (barra de progreso por niño + badges "revisar con Trini" para data dudosa).<br><br>Click en un niño del panel = filtra el calendario.',
      },
      {
        target: '#armadorExportBtn',
        position: 'below',
        title: 'Acciones',
        body: '<b>Regenerar</b> arma una distribución alternativa válida. <b>Agregar niño</b> abre formulario para meter uno nuevo. <b>Exportar PDF</b> genera el horario profesional por niño para mandarle a la familia.',
      },
      {
        title: 'Listo',
        body: 'Vuelves al recorrido cuando quieras con el botón <b>"Ver recorrido"</b> arriba a la derecha.',
      },
    ];

    if (typeof Onboarding !== 'undefined') {
      Onboarding._run(steps, 0, {
        onDone: () => {
          localStorage.setItem(this.KEY_TOUR, '1');
          UI.toast('Recorrido completo. Puedes volver a verlo con "Ver recorrido" arriba.', 'success');
        },
        onSkip: () => {
          localStorage.setItem(this.KEY_TOUR, '1');
        },
      });
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
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
    help: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  },
};
