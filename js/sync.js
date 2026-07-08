// Casa Nogal · Sincronización con Google Sheets (Apps Script)
// Espeja el estado local (claves casanogal_*) contra una planilla compartida:
//  - pull(): al abrir, trae el estado guardado y lo carga en localStorage (antes de Data.load).
//  - init(): envuelve localStorage.setItem para mandar cada cambio a la planilla (lote diferido).
// Se activa SOLO si window.CASANOGAL_SYNC_URL tiene la URL del Web App. Si no, no hace nada.
const Sync = {
  get URL() { return (typeof window !== 'undefined' && window.CASANOGAL_SYNC_URL) || ''; },
  activo: false,
  _cola: {},
  _timer: null,
  // Claves que NO se comparten: la sesión (login por persona) y el flag de fuente (por dominio).
  _NO_SYNC: ['casanogal_session', 'casanogal_fuente_datos'],
  _debeSync(k) {
    return typeof k === 'string' && k.indexOf('casanogal_') === 0 && this._NO_SYNC.indexOf(k) < 0;
  },
  // Solo sincroniza la INSTANCIA REAL (la demo nunca toca la planilla compartida).
  _habilitado() {
    return !!this.URL && typeof Data !== 'undefined' && typeof Data.esInstanciaReal === 'function' && Data.esInstanciaReal();
  },

  // Trae el estado guardado y lo aplica a localStorage. Llamar ANTES de Data.load().
  async pull() {
    if (!this._habilitado()) return;
    try {
      const r = await fetch(this.URL, { method: 'GET' });
      const j = await r.json();
      if (j && j.ok && j.estado) {
        Object.keys(j.estado).forEach(k => {
          const v = j.estado[k];
          if (this._debeSync(k) && typeof v === 'string' && v !== '') {
            try { localStorage.setItem.__orig ? localStorage.setItem.__orig(k, v) : localStorage.setItem(k, v); } catch (e) {}
          }
        });
        this.activo = true;
      }
    } catch (e) {
      // Sin conexión: la app sigue con lo que haya en localStorage local.
      console.warn('Sync.pull sin conexión:', e.message);
    }
  },

  // Envuelve localStorage.setItem para espejar los cambios a la planilla.
  init() {
    if (!this._habilitado() || this._envuelto) return;
    this._envuelto = true;
    const orig = localStorage.setItem.bind(localStorage);
    orig.__orig = orig;
    const self = this;
    const wrapped = function (k, v) {
      orig(k, v);
      if (self._debeSync(k)) { self._cola[k] = v; self._flushSoon(); }
    };
    wrapped.__orig = orig;
    localStorage.setItem = wrapped;
  },

  _flushSoon() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._flush(), 900);
  },

  async _flush() {
    const claves = Object.keys(this._cola);
    if (!claves.length) return;
    const items = claves.map(clave => ({ clave, valor: this._cola[clave] }));
    this._cola = {};
    try {
      await fetch(this.URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // text/plain evita el preflight CORS
        body: JSON.stringify({ items }),
      });
    } catch (e) {
      // Reintenta en la próxima escritura (re-encola lo que no se pudo mandar).
      items.forEach(it => { if (this._cola[it.clave] === undefined) this._cola[it.clave] = it.valor; });
      this._flushSoon();
    }
  },
};
