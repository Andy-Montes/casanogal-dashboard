// Carga y queries sobre data.json
const Data = {
  // Interruptor de fuente de datos: demo (data.json) vs instancia real limpia (data-real.json).
  // Se activa con ?real=1 (sticky en localStorage) o si el dominio contiene "real"
  // (ej. casanogal-real.vercel.app). ?real=0 vuelve a la demo.
  KEY_FUENTE_DATOS: 'casanogal_fuente_datos',
  esInstanciaReal() {
    try {
      const p = new URLSearchParams(location.search);
      if (p.get('real') === '1') localStorage.setItem(this.KEY_FUENTE_DATOS, 'real');
      if (p.get('real') === '0') localStorage.setItem(this.KEY_FUENTE_DATOS, 'demo');
    } catch {}
    const flag = (() => { try { return localStorage.getItem(this.KEY_FUENTE_DATOS); } catch { return null; } })();
    if (flag === 'real') return true;
    if (flag === 'demo') return false;   // ?real=0 fuerza demo aun en dominios con "real"
    return /(^|[.-])real([.-]|$)/i.test(location.hostname || '');
  },
  async load() {
    const real = this.esInstanciaReal();
    const archivo = real ? 'data-real.json' : 'data.json';
    const res = await fetch(archivo);
    if (!res.ok) throw new Error('No se pudo cargar ' + archivo);
    State.data = await res.json();
    State.instanciaReal = real;
    this._aplicarOverridesNinos();
    return State.data;
  },

  // Ediciones de datos generales de un niño hechas desde la ficha (persisten en localStorage)
  KEY_NINOS: 'casanogal_ninos_overrides',
  _overridesNinos() {
    try { const o = JSON.parse(localStorage.getItem(this.KEY_NINOS) || '{}'); return (o && typeof o === 'object') ? o : {}; }
    catch { return {}; }
  },
  _aplicarOverridesNinos() {
    // Niños creados desde la ficha (nuevos ingresos) — se agregan primero
    const creados = this._ninosCreados();
    if (creados.length) {
      creados.forEach(nc => { if (!State.data.ninos.some(n => n.id_nino === nc.id_nino)) State.data.ninos.push(nc); });
    }
    const ov = this._overridesNinos();
    (State.data.ninos || []).forEach(n => { if (ov[n.id_nino]) Object.assign(n, ov[n.id_nino]); });
    // Objetivos agregados desde la ficha (banco o propios)
    const extra = this._objetivosExtra();
    if (extra.length) State.data.objetivos_terapeuticos.push(...extra);
    // Ediciones inline de objetivos base (enunciado/estado) — se aplican encima de la semilla
    const ovObj = this._objetivosOverride();
    (State.data.objetivos_terapeuticos || []).forEach(o => { if (ovObj[o.id_objetivo]) Object.assign(o, ovObj[o.id_objetivo]); });
  },

  // Niños creados a mano desde la ficha (nuevos ingresos)
  KEY_NINOS_NEW: 'casanogal_ninos_creados',
  _ninosCreados() {
    try { const a = JSON.parse(localStorage.getItem(this.KEY_NINOS_NEW) || '[]'); return Array.isArray(a) ? a : []; }
    catch { return []; }
  },
  crearNino(campos) {
    const id = 'NINO-NEW-' + Date.now();
    const nino = {
      id_nino: id, estado: 'Activo', diagnosticos: [], id_programa: 'PROG-EVAL', programa_nombre: 'Evaluación',
      nombre_visible: (campos.nombre_completo || '').split(' ').slice(0, 2).join(' '),
      fecha_creacion: HOY_ISO, _nuevo: true,
      ...campos,
    };
    const arr = this._ninosCreados(); arr.push(nino);
    localStorage.setItem(this.KEY_NINOS_NEW, JSON.stringify(arr));
    if (State.data?.ninos) State.data.ninos.push(nino);
    return nino;
  },

  // Objetivos terapéuticos agregados desde la ficha (persisten en localStorage)
  KEY_OBJ: 'casanogal_objetivos_extra',
  _objetivosExtra() {
    try { const a = JSON.parse(localStorage.getItem(this.KEY_OBJ) || '[]'); return Array.isArray(a) ? a : []; }
    catch { return []; }
  },
  agregarObjetivo(obj) {
    const arr = this._objetivosExtra();
    arr.push(obj);
    localStorage.setItem(this.KEY_OBJ, JSON.stringify(arr));
    if (State.data?.objetivos_terapeuticos) State.data.objetivos_terapeuticos.push(obj); // en memoria
  },
  eliminarObjetivo(id) {
    const arr = this._objetivosExtra().filter(o => o.id_objetivo !== id);
    localStorage.setItem(this.KEY_OBJ, JSON.stringify(arr));
    if (State.data?.objetivos_terapeuticos) {
      const i = State.data.objetivos_terapeuticos.findIndex(o => o.id_objetivo === id);
      if (i >= 0) State.data.objetivos_terapeuticos.splice(i, 1);
    }
  },
  // Ediciones inline del enunciado/estado de un objetivo (base o agregado)
  KEY_OBJ_OV: 'casanogal_objetivos_override',
  _objetivosOverride() {
    try { const o = JSON.parse(localStorage.getItem(this.KEY_OBJ_OV) || '{}'); return (o && typeof o === 'object') ? o : {}; }
    catch { return {}; }
  },
  editarObjetivo(id, campos) {
    // Si es un objetivo agregado desde la ficha, se edita en su propia lista
    const extra = this._objetivosExtra();
    const idx = extra.findIndex(o => o.id_objetivo === id);
    if (idx >= 0) {
      Object.assign(extra[idx], campos);
      localStorage.setItem(this.KEY_OBJ, JSON.stringify(extra));
    } else {
      // Objetivo base (semilla): se guarda un override por id
      const ov = this._objetivosOverride();
      ov[id] = { ...(ov[id] || {}), ...campos };
      localStorage.setItem(this.KEY_OBJ_OV, JSON.stringify(ov));
    }
    // Reflejar en memoria sin recargar
    if (State.data?.objetivos_terapeuticos) {
      const o = State.data.objetivos_terapeuticos.find(x => x.id_objetivo === id);
      if (o) Object.assign(o, campos);
    }
  },
  guardarNino(id, campos) {
    const ov = this._overridesNinos();
    ov[id] = { ...(ov[id] || {}), ...campos };
    localStorage.setItem(this.KEY_NINOS, JSON.stringify(ov));
    const n = this.nino(id);
    if (n) Object.assign(n, campos); // reflejar en memoria sin recargar
  },

  terapeuta(id) {
    const lista = this.terapeutasEfectivos();
    return lista.find(t => t.id_terapeuta === id);
  },
  // Devuelve terapeutas con overrides locales aplicados (Config en localStorage).
  // Si Config no está disponible aún, devuelve la base directa.
  terapeutasEfectivos() {
    if (typeof Config !== 'undefined' && Config.terapeutasEfectivos) {
      return Config.terapeutasEfectivos();
    }
    return State.data?.terapeutas || [];
  },
  nino(id) {
    if (!State.data) return undefined;
    return State.data.ninos.find(n => n.id_nino === id);
  },
  sala(id) {
    if (!State.data) return undefined;
    return State.data.salas.find(s => s.id_sala === id);
  },
  programa(id) {
    if (!State.data) return undefined;
    return State.data.programas.find(p => p.id_programa === id);
  },
  bloque(id) {
    if (!State.data) return undefined;
    return State.data.bloques_horarios.find(b => b.id_bloque === id);
  },
  bloqueByOrden(orden) {
    if (!State.data) return undefined;
    return State.data.bloques_horarios.find(b => b.orden === orden);
  },
  notaPorSesion(idSesion) {
    return State.data.sesion_notas.find(n => n.id_sesion === idSesion);
  },
  equipoDeNino(idNino) {
    return State.data.equipo_asignado.filter(e => e.id_nino === idNino && e.activa);
  },
  objetivosDeNino(idNino) {
    return State.data.objetivos_terapeuticos.filter(o => o.id_nino === idNino);
  },
  documentosDeNino(idNino) {
    return State.data.documentos_nino.filter(d => d.id_nino === idNino);
  },
  historialDeNino(idNino) {
    return (State.data.historial_intensivos || [])
      .filter(h => h.id_nino === idNino)
      .sort((a, b) => (b.fecha_inicio || '').localeCompare(a.fecha_inicio || ''));
  },
  sesionesDeNino(idNino) {
    return State.data.sesiones.filter(s => s.id_nino === idNino || s.id_nino_secundario === idNino);
  },

  // Filtro por rol activo
  sesionesVisibles() {
    let list = State.data.sesiones;
    if (State.role === 'terapeuta') {
      const tid = DEMO_USERS.terapeuta.id_terapeuta;
      list = list.filter(s => s.id_terapeuta === tid || s.id_terapeuta_secundario === tid);
    } else if (State.role === 'padres') {
      const nid = DEMO_USERS.padres.id_nino;
      list = list.filter(s => s.id_nino === nid || s.id_nino_secundario === nid);
    }
    return list;
  },

  ninosVisibles() {
    if (State.role === 'padres') {
      return State.data.ninos.filter(n => n.id_nino === DEMO_USERS.padres.id_nino);
    }
    if (State.role === 'terapeuta') {
      const tid = DEMO_USERS.terapeuta.id_terapeuta;
      // Union: niños con sesiones del terapeuta + niños en equipo_asignado.activa
      // Esto asegura coherencia entre lo que ve en Calendario y en Fichas.
      const ids = new Set();
      State.data.equipo_asignado
        .filter(e => e.id_terapeuta === tid && e.activa)
        .forEach(e => ids.add(e.id_nino));
      State.data.sesiones
        .filter(s => s.id_terapeuta === tid || s.id_terapeuta_secundario === tid)
        .forEach(s => {
          if (s.id_nino) ids.add(s.id_nino);
          if (s.id_nino_secundario) ids.add(s.id_nino_secundario);
        });
      return State.data.ninos.filter(n => ids.has(n.id_nino));
    }
    return State.data.ninos;
  },

  // Sesiones de la semana visible
  sesionesSemana() {
    const fechas = new Set(fechasSemana());
    return this.sesionesVisibles().filter(s => fechas.has(s.fecha));
  },

  sesionesPorDiaYBloque(fecha, idBloque) {
    return this.sesionesVisibles().filter(s => s.fecha === fecha && s.id_bloque === idBloque);
  },

  // Cálculos KPI
  kpiOcupacion() {
    const totalSlots = 5 * 14 * State.data.salas.length; // 5 días × 14 bloques × salas
    const usados = this.sesionesSemana().length;
    return Math.min(100, Math.round((usados / totalSlots) * 100));
  },
  kpiSesionesHoy() {
    const hoy = this.sesionesVisibles().filter(s => s.fecha === HOY_ISO);
    const manana = hoy.filter(s => parseInt(String(s.hora_inicio).split(':')[0], 10) < 13).length;
    const tarde = hoy.length - manana;
    return { total: hoy.length, manana, tarde };
  },
  kpiSalasActivas() {
    const sesHoy = this.sesionesVisibles().filter(s => s.fecha === HOY_ISO);
    const usadas = new Set(sesHoy.map(s => s.id_sala));
    const totalSalas = State.data.salas.length;
    // Detectar saturadas (>= 10 sesiones hoy en una sala)
    const conteo = {};
    sesHoy.forEach(s => conteo[s.id_sala] = (conteo[s.id_sala] || 0) + 1);
    const saturadas = Object.entries(conteo)
      .filter(([_, n]) => n >= 10)
      .map(([id]) => this.sala(id)?.nombre)
      .filter(Boolean);
    return { activas: usadas.size, total: totalSalas, saturadas };
  },
  kpiConflictos() {
    const list = this.sesionesSemana().filter(s => s.conflicto_detectado);
    return { count: list.length, list };
  },

  // Conteo programa para chips del calendario
  conteoPorPrograma() {
    const out = { all: 0, INT: 0, CONT: 0, EVAL: 0, APR: 0, AT: 0 };
    this.sesionesSemana().forEach(s => {
      out.all++;
      const key = s.id_programa?.replace('PROG-', '');
      if (key && out[key] !== undefined) out[key]++;
    });
    return out;
  },
};
