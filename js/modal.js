// Modal de creación / edición de sesión
const Modal = {
  _editing: null,

  openCreate(prefill = {}) {
    if (State.role === 'padres') {
      UI.toast('Esta vista no permite crear sesiones', 'warning');
      return;
    }
    this._editing = null;
    document.getElementById('modalTitle').textContent = 'Nueva sesión';
    document.getElementById('modalSub').textContent = 'Completa los datos. La validación de conflictos es automática.';
    document.getElementById('modalSaveBtn').textContent = 'Crear sesión';
    this._renderBody(prefill);
    this._open();
  },

  openEdit(sesion) {
    this._editing = sesion;
    document.getElementById('modalTitle').textContent = 'Editar sesión';
    document.getElementById('modalSub').textContent = `${sesion.nino_visible} · ${sesion.dia_semana} ${sesion.hora_inicio}`;
    document.getElementById('modalSaveBtn').textContent = 'Guardar cambios';
    this._renderBody({
      id_nino: sesion.id_nino,
      tipo_terapia: sesion.tipo_terapia,
      tipo_actividad: sesion.tipo_actividad,
      id_terapeuta: sesion.id_terapeuta,
      id_sala: sesion.id_sala,
      dia: sesion.dia_semana,
      id_bloque: sesion.id_bloque,
      notas_admin: sesion.notas_admin || '',
    });
    this._open();
  },

  _renderBody(pre) {
    const ninos = Data.ninosVisibles().slice().sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'));
    const tipos = Object.keys(ESPECIALIDAD_VAR);
    const salas = State.data.salas;
    const bloques = State.data.bloques_horarios.sort((a, b) => a.orden - b.orden);
    const tipoSel = pre.tipo_terapia || tipos[0];
    const terapeutasFiltrados = Data.terapeutasEfectivos().filter(t => t.especialidad === tipoSel && t.estado === 'Activo');

    document.getElementById('modalBody').innerHTML = `
      <div class="field">
        <label class="field-label">Niño</label>
        <select class="field-select" id="f_nino">
          ${ninos.map(n => `<option value="${n.id_nino}" ${pre.id_nino===n.id_nino?'selected':''}>${UI.esc(n.nombre_completo)} · ${UI.esc(n.programa_nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label class="field-label">Modalidad</label>
        <select class="field-select" id="f_modalidad">
          ${MODALIDADES.filter(m => m !== 'Reunión de equipo' || pre.permitirReunion).map(m => `<option value="${m}" ${(pre.tipo_actividad||'Sesión')===m?'selected':''}>${UI.esc(m)}</option>`).join('')}
        </select>
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field-label">Tipo de terapia</label>
          <select class="field-select" id="f_tipo">
            ${tipos.map(t => `<option value="${t}" ${tipoSel===t?'selected':''}>${UI.esc(t)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label">Terapeuta</label>
          <select class="field-select" id="f_ter">
            ${terapeutasFiltrados.map(t => `<option value="${t.id_terapeuta}" ${pre.id_terapeuta===t.id_terapeuta?'selected':''}>${UI.esc(t.nombre_visible)} (${UI.esc(t.abreviacion)})</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field-label">Día</label>
          <select class="field-select" id="f_dia">
            ${DIAS.map((d, i) => `<option value="${d}" ${pre.dia===d?'selected':''}>${DIAS_LABEL[i]}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label">Bloque horario</label>
          <select class="field-select" id="f_bloque">
            ${bloques.map(b => `<option value="${b.id_bloque}" ${pre.id_bloque===b.id_bloque?'selected':''}>${b.hora_inicio}–${b.hora_fin} (${b.periodo})</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field">
        <label class="field-label">Sala</label>
        <select class="field-select" id="f_sala">
          ${salas.map(s => `<option value="${s.id_sala}" ${pre.id_sala===s.id_sala?'selected':''}>${UI.esc(s.nombre)} · ${UI.esc(s.tipo_principal)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label class="field-label">Notas administrativas (opcional)</label>
        <input type="text" class="field-input" id="f_notas" value="${UI.esc(pre.notas_admin || '')}" placeholder="Ej: dupla intencional, alergia, etc.">
      </div>
      <div id="f_warns"></div>
    `;

    // Preselecciona la sala predefinida del terapeuta elegido
    const aplicarSalaDeTer = () => {
      const t = Data.terapeuta(document.getElementById('f_ter').value);
      if (t && t.sala_principal) document.getElementById('f_sala').value = t.sala_principal;
    };
    // Cuando cambia tipo, regenerar terapeutas y aplicar su sala
    document.getElementById('f_tipo').addEventListener('change', () => {
      const t = document.getElementById('f_tipo').value;
      const list = Data.terapeutasEfectivos().filter(x => x.especialidad === t && x.estado === 'Activo');
      document.getElementById('f_ter').innerHTML = list.map(x => `<option value="${x.id_terapeuta}">${UI.esc(x.nombre_visible)} (${UI.esc(x.abreviacion)})</option>`).join('');
      aplicarSalaDeTer();
      this._validate();
    });
    document.getElementById('f_ter').addEventListener('change', aplicarSalaDeTer);
    ['f_nino','f_ter','f_dia','f_bloque','f_sala'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => this._validate());
    });
    this._validate();
  },

  _readForm() {
    return {
      id_nino: document.getElementById('f_nino').value,
      tipo_terapia: document.getElementById('f_tipo').value,
      tipo_actividad: document.getElementById('f_modalidad')?.value || 'Sesión',
      id_terapeuta: document.getElementById('f_ter').value,
      dia_semana: document.getElementById('f_dia').value,
      id_bloque: document.getElementById('f_bloque').value,
      id_sala: document.getElementById('f_sala').value,
      notas_admin: document.getElementById('f_notas').value,
    };
  },

  _validate() {
    const f = this._readForm();
    const warns = [];
    const fecha = fechaDeDia(f.dia_semana);
    const editingId = this._editing?.id_sesion;
    // Conflicto: mismo terapeuta o sala en mismo fecha+bloque
    const otras = State.data.sesiones.filter(s => s.fecha === fecha && s.id_bloque === f.id_bloque && s.id_sesion !== editingId);
    if (otras.some(s => s.id_terapeuta === f.id_terapeuta)) {
      warns.push({ t: 'alert', msg: 'El terapeuta ya tiene otra sesión en ese bloque.' });
    }
    if (otras.some(s => s.id_sala === f.id_sala)) {
      warns.push({ t: 'alert', msg: 'La sala ya está ocupada en ese bloque.' });
    }
    // Compatibilidad sala
    const sala = Data.sala(f.id_sala);
    if (sala && sala.tipo_principal !== f.tipo_terapia && sala.tipo_principal !== 'Multiuso') {
      warns.push({ t: 'mostaza', msg: `La sala ${sala.nombre} está optimizada para ${sala.tipo_principal}.` });
    }
    const w = document.getElementById('f_warns');
    w.innerHTML = warns.map(x => `
      <div class="field-warn ${x.t==='mostaza'?'mostaza':''}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        ${UI.esc(x.msg)}
      </div>
    `).join('');
  },

  _open() {
    document.getElementById('modalOverlay').classList.add('open');
  },
  close() {
    document.getElementById('modalOverlay').classList.remove('open');
  },

  save() {
    const f = this._readForm();
    // Si es reunión de equipo: sin sala y tipo de terapia = Reunión
    const esReunion = f.tipo_actividad === 'Reunión de equipo';
    if (esReunion) { f.tipo_terapia = 'Reunión de equipo'; f.id_sala = null; }
    const nino = Data.nino(f.id_nino);
    const ter = Data.terapeuta(f.id_terapeuta);
    const sala = Data.sala(f.id_sala);
    const bloque = Data.bloque(f.id_bloque);
    const fecha = fechaDeDia(f.dia_semana);

    // Detectar conflicto
    const editingId = this._editing?.id_sesion;
    const otras = State.data.sesiones.filter(s => s.fecha === fecha && s.id_bloque === f.id_bloque && s.id_sesion !== editingId);
    let conflicto = null;
    if (otras.some(s => s.id_terapeuta === f.id_terapeuta)) conflicto = 'Terapeuta duplicado';
    else if (otras.some(s => s.id_sala === f.id_sala)) conflicto = 'Sala duplicada';

    if (this._editing) {
      Object.assign(this._editing, {
        id_nino: f.id_nino,
        nino_visible: nino?.nombre_visible,
        tipo_terapia: f.tipo_terapia,
        tipo_actividad: f.tipo_actividad,
        id_terapeuta: f.id_terapeuta,
        terapeuta_abr: ter?.abreviacion,
        id_sala: f.id_sala,
        sala_nombre: sala?.nombre || (esReunion ? '—' : null),
        id_bloque: f.id_bloque,
        hora_inicio: bloque?.hora_inicio,
        hora_fin: bloque?.hora_fin,
        dia_semana: f.dia_semana,
        fecha,
        notas_admin: f.notas_admin,
        conflicto_detectado: conflicto,
      });
      UI.toast(conflicto ? `Sesión guardada · ⚠ ${conflicto}` : 'Sesión actualizada', conflicto ? 'alert' : 'success');
    } else {
      // ID a partir del máximo numérico existente, no del largo del array:
      // eliminar y recrear sesiones haría colisionar IDs si se usara length+1.
      const maxNum = State.data.sesiones.reduce((m, s) => {
        const n = parseInt(String(s.id_sesion).replace(/\D/g, ''), 10);
        return Number.isFinite(n) && n > m ? n : m;
      }, 0);
      const newId = 'SES-' + String(maxNum + 1).padStart(4, '0');
      State.data.sesiones.push({
        id_sesion: newId,
        fecha,
        semana_intensivo: State.data.meta.semana_actual,
        dia_semana: f.dia_semana,
        id_bloque: f.id_bloque,
        hora_inicio: bloque?.hora_inicio,
        hora_fin: bloque?.hora_fin,
        id_nino: f.id_nino,
        nino_visible: nino?.nombre_visible,
        id_terapeuta: f.id_terapeuta,
        terapeuta_abr: ter?.abreviacion,
        id_terapeuta_secundario: null,
        id_nino_secundario: null,
        id_sala: f.id_sala,
        sala_nombre: sala?.nombre || (esReunion ? '—' : null),
        tipo_terapia: f.tipo_terapia,
        tipo_actividad: f.tipo_actividad,
        es_dupla: false,
        estado: 'Agendada',
        id_programa: nino?.id_programa,
        notas_admin: f.notas_admin,
        conflicto_detectado: conflicto,
        creado_por: State.currentUser?.id,
        fecha_creacion: HOY_ISO,
      });
      UI.toast(conflicto ? `Sesión creada · ⚠ ${conflicto}` : 'Sesión creada · validada sin conflictos', conflicto ? 'alert' : 'success');
    }
    this.close();
    if (State.module === 'calendario') Calendar.render();
    else if (State.module === 'disponibilidad') Recursos.renderDisponibilidad();
  },
};
