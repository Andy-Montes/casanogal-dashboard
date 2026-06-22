// Carga y queries sobre data.json
const Data = {
  async load() {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error('No se pudo cargar data.json');
    State.data = await res.json();
    return State.data;
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
