// Configuración del sistema · solo super admin
const Config = {

  KEY: 'casanogal_config',
  KEY_TER: 'casanogal_terapeutas_overrides',

  _defaultConfig() {
    return {
      horario: {
        dias_habiles: ['lunes','martes','miércoles','jueves','viernes'],
        manana_inicio: '08:00',
        manana_fin: '13:00',
        bloque_min: 35,
      },
      notif: {
        recordatorio_padres_24h: true,
        alerta_conflictos: true,
      },
      mailTemplate: {
        subject: 'Acompañamiento de {primer_nombre} · {mes}',
        body: 'Hola,\n\nAquí tienen el horario de esta semana para {primer_nombre}. El PDF con el detalle completo está adjunto a este mismo correo (descárgalo desde la consola y adjúntalo manualmente).\n\nHorario de esta semana:\n\n{horario}\n\nCualquier consulta o necesidad de reagendar, pueden escribirnos directo.\n\nUn abrazo,\nEquipo Casa Nogal',
      },
    };
  },

  read() {
    try {
      const stored = JSON.parse(localStorage.getItem(this.KEY) || '{}');
      return { ...this._defaultConfig(), ...stored, horario: { ...this._defaultConfig().horario, ...(stored.horario||{}) }, notif: { ...this._defaultConfig().notif, ...(stored.notif||{}) }, mailTemplate: { ...this._defaultConfig().mailTemplate, ...(stored.mailTemplate||{}) } };
    } catch { return this._defaultConfig(); }
  },

  save(cfg) { localStorage.setItem(this.KEY, JSON.stringify(cfg)); },

  // Terapeutas: lee data.json y aplica overrides locales (creados/editados/eliminados)
  terapeutasEfectivos() {
    const base = State.data.terapeutas.slice();
    const ov = this._readOverrides();
    let list = base.filter(t => !ov.eliminados.includes(t.id_terapeuta));
    list = list.map(t => ({ ...t, ...(ov.editados[t.id_terapeuta] || {}) }));
    list = list.concat(ov.creados);
    return list;
  },

  _estadoSlug(estado) {
    if (!estado || estado === 'Activo') return 'activo';
    if (estado === 'Vacaciones') return 'vacaciones';
    if (estado === 'Licencia médica') return 'licencia';
    if (estado === 'Permiso') return 'permiso';
    return 'inactivo';
  },

  _readOverrides() {
    try {
      const o = JSON.parse(localStorage.getItem(this.KEY_TER) || '{}');
      return { creados: o.creados || [], editados: o.editados || {}, eliminados: o.eliminados || [] };
    } catch { return { creados: [], editados: {}, eliminados: [] }; }
  },
  _saveOverrides(o) { localStorage.setItem(this.KEY_TER, JSON.stringify(o)); },

  // ====== Render ======

  render() {
    if (State.session?.tipo !== 'admin') {
      document.getElementById('main').innerHTML = `
        <div class="section-head"><div><div class="section-title">Configuración</div><div class="section-sub">Solo el super admin tiene acceso a esta sección.</div></div></div>
      `;
      return;
    }
    const cfg = this.read();
    const ters = this.terapeutasEfectivos();
    document.getElementById('main').innerHTML = `
      <div class="section-head">
        <div>
          <div class="section-eyebrow">Solo super admin</div>
          <div class="section-title">Configuración del sistema</div>
          <div class="section-sub">Lo que cambies aquí afecta a todo el centro. Los cambios se guardan automáticamente.</div>
        </div>
      </div>

      <div class="cfg-tabs">
        <button class="cfg-tab active" data-tab="horarios">Horarios y días</button>
        <button class="cfg-tab" data-tab="profesionales">Profesionales (${ters.length})</button>
        <button class="cfg-tab" data-tab="notif">Notificaciones</button>
        <button class="cfg-tab" data-tab="mail">Plantilla de mail</button>
      </div>

      <div id="cfgPanel"></div>
    `;

    this._renderTab('horarios');
    document.querySelectorAll('.cfg-tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.cfg-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        this._renderTab(t.dataset.tab);
      });
    });
  },

  _renderTab(tab) {
    const panel = document.getElementById('cfgPanel');
    if (!panel) return;
    if (tab === 'horarios')      panel.innerHTML = this._tabHorarios();
    else if (tab === 'profesionales') panel.innerHTML = this._tabProfesionales();
    else if (tab === 'notif')    panel.innerHTML = this._tabNotif();
    else if (tab === 'mail')     panel.innerHTML = this._tabMail();
    this._wireTab(tab);
  },

  // ---- Horarios ----
  _tabHorarios() {
    const cfg = this.read();
    const DIAS = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
    return `
      <div class="cfg-card">
        <div class="cfg-card-title">Días hábiles del centro</div>
        <div class="cfg-card-sub">Marca los días en que se agendan sesiones.</div>
        <div class="cfg-dias">
          ${DIAS.map(d => `
            <label class="cfg-dia">
              <input type="checkbox" data-dia="${d}" ${cfg.horario.dias_habiles.includes(d) ? 'checked':''}>
              <span>${d.charAt(0).toUpperCase() + d.slice(1)}</span>
            </label>`).join('')}
        </div>
      </div>

      <div class="cfg-card">
        <div class="cfg-card-title">Jornada de mañana</div>
        <div class="cfg-card-sub">Casa Nogal atiende solo en jornada de mañana. Define el inicio, el fin y la duración estándar de cada bloque.</div>
        <div class="cfg-grid-2">
          <div class="cfg-field"><label>Inicio jornada</label><input type="time" id="cfg-h-mi" value="${cfg.horario.manana_inicio}"></div>
          <div class="cfg-field"><label>Fin jornada</label><input type="time" id="cfg-h-mf" value="${cfg.horario.manana_fin}"></div>
          <div class="cfg-field"><label>Duración de bloque (min)</label><input type="number" id="cfg-h-bl" value="${cfg.horario.bloque_min}" min="15" max="120"></div>
        </div>
        <div class="cfg-actions"><button class="btn btn-primary" id="cfg-h-save">Guardar horarios</button></div>
      </div>
    `;
  },

  // ---- Profesionales ----
  _tabProfesionales() {
    const ters = this.terapeutasEfectivos().sort((a,b) => a.nombre_completo.localeCompare(b.nombre_completo));
    return `
      <div class="cfg-card">
        <div class="cfg-card-title">Profesionales del centro</div>
        <div class="cfg-card-sub">Agrega, edita o elimina terapeutas. Los cambios se guardan localmente para la demo.</div>
        <div class="cfg-actions">
          <button class="btn btn-primary" id="cfg-ter-new">+ Agregar profesional</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Nombre</th><th>Especialidad</th><th>Días y horario disponible</th><th>Email</th><th>Estado</th><th></th>
            </tr></thead>
            <tbody>
              ${ters.map(t => {
                const c = ESPECIALIDAD_VAR[t.especialidad] || ESPECIALIDAD_VAR['Terapia Ocupacional'];
                return `<tr>
                  <td><div style="font-weight:600">${UI.esc(t.nombre_completo)}</div><div style="font-size:11px;color:var(--text-3)">${UI.esc(t.abreviacion || '')}</div></td>
                  <td><span class="badge" style="background:${c.bg};color:${c.text}">${UI.esc(t.especialidad)}</span></td>
                  <td>${this._resumenDispHtml(t)}</td>
                  <td class="mono" style="font-size:12px">${UI.esc(t.email || '—')}</td>
                  <td>
                    <span class="estado-prof estado-${this._estadoSlug(t.estado)}">${UI.esc(t.estado || 'Activo')}</span>
                    ${t.estado_nota ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px">${UI.esc(t.estado_nota)}</div>` : ''}
                  </td>
                  <td style="white-space:nowrap">
                    <button class="btn btn-ghost btn-xs cfg-ter-edit" data-id="${t.id_terapeuta}">Editar</button>
                    <button class="btn btn-ghost btn-xs cfg-ter-del" data-id="${t.id_terapeuta}" style="color:#C36B5E">Eliminar</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ---- Notificaciones ----
  _tabNotif() {
    const cfg = this.read();
    return `
      <div class="cfg-card">
        <div class="cfg-card-title">Notificaciones automáticas</div>
        <div class="cfg-card-sub">Configura qué envía el sistema sin intervención manual.</div>
        <div class="toggle-list">
          <label class="toggle-row">
            <div><div class="toggle-title">Recordatorio a padres 24h antes</div><div class="toggle-sub">Mail automático un día antes de cada sesión con el horario y la sala.</div></div>
            <input type="checkbox" class="toggle-input" id="cfg-n-pad" ${cfg.notif.recordatorio_padres_24h?'checked':''}>
            <span class="toggle-pill"></span>
          </label>
          <label class="toggle-row">
            <div><div class="toggle-title">Alerta de conflictos a coordinación</div><div class="toggle-sub">Aviso inmediato si el sistema detecta dos sesiones que chocan.</div></div>
            <input type="checkbox" class="toggle-input" id="cfg-n-con" ${cfg.notif.alerta_conflictos?'checked':''}>
            <span class="toggle-pill"></span>
          </label>
        </div>
        <div class="cfg-actions"><button class="btn btn-primary" id="cfg-n-save">Guardar notificaciones</button></div>
      </div>
    `;
  },

  // ---- Mail template ----
  _tabMail() {
    const cfg = this.read();
    return `
      <div class="cfg-card">
        <div class="cfg-card-title">Plantilla del mail a familias</div>
        <div class="cfg-card-sub">Texto que aparece prellenado cuando envías el PDF semanal por mail desde la consola. Variables: <code>{primer_nombre}</code>, <code>{nombre}</code>, <code>{mes}</code>, <code>{horario}</code>.</div>
        <div class="cfg-field"><label>Asunto</label><input type="text" id="cfg-m-sub" value="${UI.esc(cfg.mailTemplate.subject)}"></div>
        <div class="cfg-field"><label>Cuerpo del mensaje</label><textarea id="cfg-m-body" rows="12">${UI.esc(cfg.mailTemplate.body)}</textarea></div>
        <div class="cfg-actions">
          <button class="btn btn-ghost" id="cfg-m-reset">Restaurar plantilla</button>
          <button class="btn btn-primary" id="cfg-m-save">Guardar plantilla</button>
        </div>
      </div>
    `;
  },

  // ====== Wire ======

  _wireTab(tab) {
    const cfg = this.read();
    if (tab === 'horarios') {
      document.querySelectorAll('[data-dia]').forEach(chk => {
        chk.addEventListener('change', () => {
          const d = chk.dataset.dia;
          const cur = this.read();
          const set = new Set(cur.horario.dias_habiles);
          chk.checked ? set.add(d) : set.delete(d);
          cur.horario.dias_habiles = Array.from(set);
          this.save(cur);
          UI.toast('Días hábiles actualizados', 'success');
        });
      });
      document.getElementById('cfg-h-save')?.addEventListener('click', () => {
        const cur = this.read();
        cur.horario.manana_inicio = document.getElementById('cfg-h-mi').value;
        cur.horario.manana_fin = document.getElementById('cfg-h-mf').value;
        cur.horario.bloque_min = Number(document.getElementById('cfg-h-bl').value) || 35;
        this.save(cur);
        UI.toast('Horarios guardados', 'success');
      });
    }
    if (tab === 'profesionales') {
      document.getElementById('cfg-ter-new')?.addEventListener('click', () => this._abrirModalTer(null));
      document.querySelectorAll('.cfg-ter-edit').forEach(b => b.addEventListener('click', () => this._abrirModalTer(b.dataset.id)));
      document.querySelectorAll('.cfg-ter-del').forEach(b => b.addEventListener('click', () => this._eliminarTer(b.dataset.id)));
    }
    if (tab === 'notif') {
      document.getElementById('cfg-n-save')?.addEventListener('click', () => {
        const cur = this.read();
        cur.notif.recordatorio_padres_24h = document.getElementById('cfg-n-pad').checked;
        cur.notif.alerta_conflictos = document.getElementById('cfg-n-con').checked;
        this.save(cur);
        UI.toast('Notificaciones guardadas', 'success');
      });
    }
    if (tab === 'mail') {
      document.getElementById('cfg-m-save')?.addEventListener('click', () => {
        const cur = this.read();
        cur.mailTemplate.subject = document.getElementById('cfg-m-sub').value;
        cur.mailTemplate.body = document.getElementById('cfg-m-body').value;
        this.save(cur);
        UI.toast('Plantilla guardada · se usará al enviar mail desde la consola', 'success');
      });
      document.getElementById('cfg-m-reset')?.addEventListener('click', () => {
        const def = this._defaultConfig();
        const cur = this.read();
        cur.mailTemplate = def.mailTemplate;
        this.save(cur);
        this._renderTab('mail');
        UI.toast('Plantilla restaurada', 'success');
      });
    }
  },

  // Resumen compacto de la disponibilidad de un profesional (para la tabla)
  _resumenDispHtml(t) {
    const dias = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
    const lbl = { lunes: 'Lun', martes: 'Mar', 'miércoles': 'Mié', jueves: 'Jue', viernes: 'Vie' };
    const db = t.disponibilidad_bloques || {};
    const activos = dias.filter(d => (db[d] || []).length);
    if (!activos.length) return '<span style="color:var(--text-3);font-size:12px">Sin definir</span>';
    const todos = [].concat(...activos.map(d => db[d]));
    const bloqs = (State.data.bloques_horarios || []).filter(b => todos.includes(b.id_bloque));
    const ini = bloqs.map(b => b.hora_inicio).sort()[0];
    const fin = bloqs.map(b => b.hora_fin).sort().slice(-1)[0];
    const chips = activos.map(d => `<span class="cfg-dia-chip">${lbl[d]}</span>`).join('');
    return `<div class="cfg-disp-resumen">${chips}</div><div class="mono" style="font-size:11px;color:var(--text-3);margin-top:3px">${ini}–${fin}</div>`;
  },

  _dispGridHtml(t) {
    const dias = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
    const diasLbl = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
    const bloques = (State.data.bloques_horarios || []).filter(b => b.periodo === 'Mañana' && !b.es_reunion_equipo);
    const db = t.disponibilidad_bloques || {};
    const exc = (t.excepciones || []).map(e => UI.esc(e.concepto + (e.detalle ? ` (${e.detalle})` : ''))).join(' · ');
    return `
      <div class="cfg-field" style="grid-column:1/-1">
        <label>Días y horarios disponibles · marca cada bloque que el profesional atiende</label>
        <div class="cfg-card-sub" style="margin:-2px 0 6px">Esto alimenta la vista de Disponibilidad en Recursos.</div>
        <table class="cfg-disp">
          <thead><tr><th></th>${diasLbl.map(d => `<th>${d}</th>`).join('')}</tr></thead>
          <tbody>
            ${bloques.map(b => `<tr>
              <td class="cfg-disp-h mono">${b.hora_inicio}</td>
              ${dias.map(dia => {
                const on = (t.disponibilidad_bloques[dia] || []).includes(b.id_bloque);
                return `<td><input type="checkbox" class="cfg-disp-chk" data-dia="${dia}" data-bloque="${b.id_bloque}" ${on ? 'checked' : ''}></td>`;
              }).join('')}
            </tr>`).join('')}
          </tbody>
        </table>
        ${exc ? `<div class="cfg-disp-exc">Excepción: ${exc}</div>` : ''}
      </div>`;
  },

  _abrirModalTer(id) {
    const editing = !!id;
    const ters = this.terapeutasEfectivos();
    const t = editing ? ters.find(x => x.id_terapeuta === id) : null;
    const ESPS = ['Terapia Ocupacional','Fonoaudiología','Cognitivo','Psicología','Kinesiología','RDI','Habilidad Adaptativa'];
    const html = `
      <div class="pendiente-modal-overlay" id="cfgTerOverlay">
        <div class="pendiente-modal" style="width:min(540px,94vw)">
          <div class="pendiente-modal-head">
            <div>
              <div class="pendiente-modal-title">${editing ? 'Editar profesional' : 'Agregar nuevo profesional'}</div>
              <div class="pendiente-modal-eyebrow">${editing ? UI.esc(t.nombre_completo) : 'Nuevo registro'}</div>
            </div>
            <button class="panel-close" id="cfgTerClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="pendiente-modal-body" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px">
            <div class="cfg-field" style="grid-column:1/-1"><label>Nombre completo</label><input id="ter-nom" value="${UI.esc(t?.nombre_completo || '')}"></div>
            <div class="cfg-field"><label>Abreviación</label><input id="ter-abr" maxlength="4" value="${UI.esc(t?.abreviacion || '')}"></div>
            <div class="cfg-field"><label>Especialidad</label>
              <select id="ter-esp">${ESPS.map(e => `<option ${t?.especialidad===e?'selected':''}>${e}</option>`).join('')}</select>
            </div>
            <div class="cfg-field"><label>Email</label><input id="ter-em" value="${UI.esc(t?.email || '')}"></div>
            <div class="cfg-field"><label>Teléfono</label><input id="ter-tel" value="${UI.esc(t?.telefono || '')}"></div>
            <div class="cfg-field"><label>Estado actual</label>
              <select id="ter-est">
                ${['Activo','Vacaciones','Licencia médica','Permiso','Inactivo'].map(e => `<option ${(t?.estado || 'Activo') === e ? 'selected' : ''}>${e}</option>`).join('')}
              </select>
            </div>
            <div class="cfg-field" style="grid-column:1/-1"><label>Nota de estado (opcional)</label>
              <input id="ter-est-nota" placeholder="Ej: regresa el 15 de junio · licencia hasta 30/05" value="${UI.esc(t?.estado_nota || '')}">
            </div>
            ${(() => {
              const salas = State.data.salas || [];
              const opts = (sel, conVacio) => `${conVacio ? '<option value="">— sin asignar —</option>' : ''}${salas.map(s => `<option value="${s.id_sala}" ${sel === s.id_sala ? 'selected' : ''}>${UI.esc(s.nombre)}</option>`).join('')}`;
              return `
              <div class="cfg-field" style="grid-column:1/-1"><label>Salas del profesional <small style="font-weight:400;color:var(--text-3)">· la opción 2 y 3 se usan cuando la principal está ocupada</small></label></div>
              <div class="cfg-field"><label>Sala principal</label><select id="ter-sala1">${opts(t?.sala_principal, true)}</select></div>
              <div class="cfg-field"><label>Sala opción 2</label><select id="ter-sala2">${opts(t?.sala_opcion_2, true)}</select></div>
              <div class="cfg-field"><label>Sala opción 3</label><select id="ter-sala3">${opts(t?.sala_opcion_3, true)}</select></div>`;
            })()}
            ${this._dispGridHtml(t || { disponibilidad_bloques: {} })}
          </div>
          <div class="pendiente-modal-foot">
            <button class="btn btn-ghost" id="cfgTerCancel">Cancelar</button>
            <button class="btn btn-primary" id="cfgTerSave">${editing ? 'Guardar cambios' : 'Crear profesional'}</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    const close = () => document.getElementById('cfgTerOverlay')?.remove();
    document.getElementById('cfgTerClose').addEventListener('click', close);
    document.getElementById('cfgTerCancel').addEventListener('click', close);
    document.getElementById('cfgTerOverlay').addEventListener('click', (e) => { if (e.target.id === 'cfgTerOverlay') close(); });
    // Disponibilidad por bloque y día: se edita en un estado local y se vuelca al guardar
    const dispLocal = JSON.parse(JSON.stringify((t && t.disponibilidad_bloques) || {}));
    document.querySelectorAll('#cfgTerOverlay .cfg-disp-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        const set = new Set(dispLocal[chk.dataset.dia] || []);
        if (chk.checked) set.add(chk.dataset.bloque); else set.delete(chk.dataset.bloque);
        dispLocal[chk.dataset.dia] = [...set];
      });
    });
    document.getElementById('cfgTerSave').addEventListener('click', () => {
      const data = {
        id_terapeuta: id || 'TER-NEW-' + Date.now(),
        nombre_completo: document.getElementById('ter-nom').value.trim(),
        nombre_visible: document.getElementById('ter-nom').value.trim().split(' ')[0],
        abreviacion: document.getElementById('ter-abr').value.trim().toUpperCase().slice(0,3),
        especialidad: document.getElementById('ter-esp').value,
        email: document.getElementById('ter-em').value.trim(),
        telefono: document.getElementById('ter-tel').value.trim(),
        estado: document.getElementById('ter-est').value,
        estado_nota: document.getElementById('ter-est-nota').value.trim() || null,
        sala_principal: document.getElementById('ter-sala1').value || t?.sala_principal || null,
        sala_opcion_2: document.getElementById('ter-sala2').value || null,
        sala_opcion_3: document.getElementById('ter-sala3').value || null,
        disponibilidad_bloques: dispLocal,
        dias_disponibles: Object.keys(dispLocal).filter(d => (dispLocal[d] || []).length),
      };
      if (!data.nombre_completo) { UI.toast('El nombre es obligatorio', 'error'); return; }
      // Reflejar la disponibilidad en memoria para que la vista Disponibilidad (Recursos) la use sin recargar
      const trBase = State.data.terapeutas.find(x => x.id_terapeuta === id);
      if (trBase) { trBase.disponibilidad_bloques = dispLocal; trBase.dias_disponibles = data.dias_disponibles; }

      const ov = this._readOverrides();
      const esBase = State.data.terapeutas.find(x => x.id_terapeuta === id);
      if (id && esBase) {
        ov.editados[id] = data;
      } else if (id) {
        // editado uno creado
        const idx = ov.creados.findIndex(x => x.id_terapeuta === id);
        if (idx >= 0) ov.creados[idx] = data;
      } else {
        ov.creados.push(data);
      }
      this._saveOverrides(ov);
      close();
      UI.toast(editing ? 'Profesional actualizado' : 'Profesional agregado', 'success');
      this._renderTab('profesionales');
    });
  },

  _eliminarTer(id) {
    const t = this.terapeutasEfectivos().find(x => x.id_terapeuta === id);
    if (!t) return;
    if (!confirm(`¿Eliminar a ${t.nombre_completo}? Esta acción se puede revertir restableciendo la configuración.`)) return;
    const ov = this._readOverrides();
    const esBase = State.data.terapeutas.find(x => x.id_terapeuta === id);
    if (esBase) {
      if (!ov.eliminados.includes(id)) ov.eliminados.push(id);
      delete ov.editados[id];
    } else {
      ov.creados = ov.creados.filter(x => x.id_terapeuta !== id);
    }
    this._saveOverrides(ov);
    UI.toast('Profesional eliminado', 'success');
    this._renderTab('profesionales');
  },
};
