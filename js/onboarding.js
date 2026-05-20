// Tour guiado paso a paso · primera vez que un usuario entra
const Onboarding = {
  KEY: 'casanogal_tour_done',

  shouldShow() {
    const session = State.session;
    if (!session) return false;
    const key = this.KEY + '_' + (session.tipo === 'admin' ? 'admin' : 'ter');
    return !localStorage.getItem(key);
  },

  _markDone() {
    const session = State.session;
    const key = this.KEY + '_' + (session?.tipo === 'admin' ? 'admin' : 'ter');
    localStorage.setItem(key, '1');
  },

  reset() {
    localStorage.removeItem(this.KEY + '_admin');
    localStorage.removeItem(this.KEY + '_ter');
  },

  open(force = false) {
    if (!force && !this.shouldShow()) return;
    const steps = State.session?.tipo === 'admin' ? this._stepsAdmin() : this._stepsTerapeuta();
    this._run(steps, 0);
  },

  _run(steps, idx) {
    document.getElementById('tourLayer')?.remove();
    document.getElementById('tourPop')?.remove();
    if (idx >= steps.length) {
      this._markDone();
      UI.toast('Listo. Puedes volver al recorrido desde "¿Qué es Casa Nogal?" en el sidebar.', 'success');
      return;
    }
    const step = steps[idx];

    // Acción previa al paso (cambiar de módulo, abrir panel, etc.)
    if (typeof step.before === 'function') {
      try { step.before(); } catch {}
    }

    // Esperar a que el target esté en el DOM
    setTimeout(() => this._paintStep(steps, idx, step), step.wait || 60);
  },

  _paintStep(steps, idx, step) {
    const target = step.target ? document.querySelector(step.target) : null;

    // Capa de fondo (solo oscurece). El popover va aparte, por encima de todo.
    const layer = document.createElement('div');
    layer.id = 'tourLayer';
    layer.className = 'tour-layer';
    layer.innerHTML = '<div class="tour-backdrop"></div>';
    document.body.appendChild(layer);

    // Highlight del target ANTES de medir, para que el scroll ya esté aplicado
    if (target) {
      target.classList.add('tour-highlight');
      target.scrollIntoView({ block: 'center' });
    }

    // Popover: elemento de nivel página, z-index sobre el highlight
    const pop = document.createElement('div');
    pop.id = 'tourPop';
    pop.className = 'tour-pop';
    pop.innerHTML = `
      <div class="tour-step-count">Paso ${idx + 1} de ${steps.length}</div>
      <div class="tour-title">${UI.esc(step.title)}</div>
      <div class="tour-body">${step.body}</div>
      <div class="tour-foot">
        <a href="#" class="tour-skip" id="tourSkip">Saltar recorrido</a>
        <div class="tour-nav">
          ${idx > 0 ? '<button class="btn btn-ghost btn-xs" id="tourBack">← Atrás</button>' : ''}
          <button class="btn btn-primary btn-xs" id="tourNext">${idx === steps.length - 1 ? 'Listo' : 'Siguiente →'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(pop);

    this._positionPop(target, step.position);

    const cerrar = () => {
      target?.classList.remove('tour-highlight');
      document.getElementById('tourLayer')?.remove();
      document.getElementById('tourPop')?.remove();
    };

    document.getElementById('tourNext').addEventListener('click', () => {
      target?.classList.remove('tour-highlight');
      this._run(steps, idx + 1);
    });
    document.getElementById('tourBack')?.addEventListener('click', () => {
      target?.classList.remove('tour-highlight');
      this._run(steps, idx - 1);
    });
    document.getElementById('tourSkip').addEventListener('click', (e) => {
      e.preventDefault();
      cerrar();
      this._markDone();
    });
  },

  _positionPop(target, pos) {
    const pop = document.getElementById('tourPop');
    if (!pop) return;
    if (!target) {
      // Centrado en pantalla
      pop.style.left = '50%';
      pop.style.top = '50%';
      pop.style.transform = 'translate(-50%, -50%)';
      return;
    }
    const rect = target.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const popW = 360, popH = pop.offsetHeight || 200;
    let left, top;
    const place = pos || 'auto';

    if (place === 'right' || (place === 'auto' && rect.right + popW + 20 < vw)) {
      left = rect.right + 16;
      top = rect.top + rect.height / 2 - popH / 2;
    } else if (place === 'left' || (place === 'auto' && rect.left - popW - 20 > 0)) {
      left = rect.left - popW - 16;
      top = rect.top + rect.height / 2 - popH / 2;
    } else if (place === 'below' || (place === 'auto' && rect.bottom + popH + 20 < vh)) {
      left = Math.max(20, rect.left + rect.width / 2 - popW / 2);
      top = rect.bottom + 14;
    } else {
      left = Math.max(20, rect.left + rect.width / 2 - popW / 2);
      top = Math.max(20, rect.top - popH - 14);
    }
    pop.style.left = Math.max(20, Math.min(left, vw - popW - 20)) + 'px';
    pop.style.top = Math.max(20, Math.min(top, vh - popH - 20)) + 'px';
    pop.style.transform = 'none';
  },

  // ====== Steps ======

  _stepsAdmin() {
    return [
      {
        title: 'Bienvenida a Casa Nogal',
        body: 'Te voy a mostrar el sistema en menos de 1 minuto. Lo que antes vivía en 7 hojas de cálculo ahora está acá, con conflictos detectados solos y vistas por rol. <b>Click en "Siguiente" para empezar.</b>',
      },
      {
        target: '.sidebar',
        position: 'right',
        title: 'Navegación principal',
        body: 'El menú lateral organiza el sistema en tres bloques: <b>Gestión operativa</b>, <b>Recursos</b> y <b>Sistema</b>. Te muestro las secciones clave en los próximos pasos.',
      },
      {
        target: '#roleSwitcher',
        position: 'below',
        title: 'Cambia de vista según el rol',
        body: 'Como super admin puedes <b>previsualizar</b> cómo se ve el sistema para un <b>Terapeuta</b> o cambiar a la vista de <b>Familia</b>. Cada rol ve únicamente lo que le corresponde.',
      },
      {
        target: '.kpi-row, .hero-meta, .hero',
        position: 'below',
        title: 'Termómetro del centro',
        body: 'Arriba del calendario tienes los <b>KPIs de la semana</b>: ocupación, sesiones hoy, salas activas y conflictos. Te muestro los dos más importantes en los próximos pasos.',
      },
      {
        target: '#kpiConflict',
        position: 'below',
        title: 'Revisar un conflicto',
        body: 'Cuando dos sesiones chocan en <b>sala</b> o en <b>terapeuta</b>, esta tarjeta se pone <b>roja</b>. Haz clic en ella para desplegar cada conflicto, y usa el botón <b>"Ir →"</b> para saltar a la sesión en el calendario y resolverla. El sistema los detecta solo, tú no tienes que buscarlos.',
        before: () => { Calendar.view = 'semana'; State.module = 'calendario'; Main.activateNav('calendario'); Calendar.render(); },
      },
      {
        target: '.session, .cal-grid',
        position: 'auto',
        title: 'Mover un niño es arrastrar',
        body: 'Para redistribuir a un niño, <b>arrastra su sesión</b> de una celda a otra del calendario. Al soltarla, el sistema revisa solo si el nuevo bloque genera un choque de sala o terapeuta y te avisa antes de confirmar. Así reorganizas la semana en segundos.',
        before: () => { Calendar.view = 'semana'; State.module = 'calendario'; Main.activateNav('calendario'); Calendar.render(); },
      },
      {
        target: '#newSessionBtn',
        position: 'below',
        title: 'Crear sesiones',
        body: 'Desde aquí abres el formulario de <b>nueva sesión</b>. También puedes hacer click directo en cualquier celda vacía del calendario para crear ahí mismo.',
      },
      {
        target: '[data-role="padres"]',
        position: 'below',
        title: 'Consola Familia',
        body: 'Cuando necesites enviar el horario semanal a una familia, entra a <b>Padres</b>. Eliges al niño, revisas qué información va a recibir, y mandas el PDF por mail con un click. Esta vista <b>no la ven los apoderados</b>: es solo para coordinación.',
      },
      {
        target: '[data-module="equipo"]',
        position: 'right',
        title: 'Equipo terapéutico',
        body: 'En <b>Equipo</b> ves a todos los profesionales del centro: su especialidad, tipo de contrato y la carga de niños que llevan. Es la vista para saber quién está disponible y quién está al tope de su capacidad.',
      },
      {
        target: '[data-module="config"]',
        position: 'right',
        title: 'Configuración',
        body: 'En <b>Configuración</b> manejas horarios del centro, profesionales (agregar/editar/eliminar), valores hora, notificaciones automáticas y la plantilla del mail a familias. Todo lo que cambies se aplica al instante.',
      },
      {
        title: 'Listo',
        body: 'Ya conoces el sistema. Si necesitas volver al recorrido, hay un link <b>"¿Qué es Casa Nogal?"</b> al final del menú lateral.<br><br>Cualquier consulta, escríbele al equipo de soporte.',
      },
    ];
  },

  _stepsTerapeuta() {
    const t = Data.terapeuta(State.session?.id_terapeuta);
    const primerNombre = (t?.nombre_completo || 'Profesional').split(' ')[0];
    return [
      {
        title: `Hola, ${primerNombre}`,
        body: 'Te muestro tu espacio de trabajo en menos de 30 segundos. <b>Click en "Siguiente"</b>.',
      },
      {
        target: '.sidebar',
        position: 'right',
        title: 'Tu menú',
        body: 'Tienes acceso a tu <b>Calendario</b>, las <b>Fichas</b> de los niños que atiendes, <b>Reportes</b> (tus horas y tu pago) y <b>Salas</b>. Las áreas administrativas no te aparecen.',
      },
      {
        target: '.cal-grid, .calendar, [data-module="calendario"]',
        position: 'auto',
        title: 'Tu calendario',
        body: 'Ves solo <b>tus sesiones de la semana</b>. Si necesitas moverlas, arrastra la sesión a otra celda. El sistema detecta solo si hay choques con salas o con otro terapeuta.',
        before: () => { State.module = 'calendario'; Main.activateNav('calendario'); Calendar.render(); }
      },
      {
        target: '[data-module="fichas"]',
        position: 'right',
        title: 'Fichas de tus niños',
        body: 'Click en <b>Fichas</b> para ver el historial completo, notas y objetivos de cada niño que atiendes. Solo aparecen los tuyos.',
      },
      {
        title: 'Listo',
        body: 'Ya conoces tu espacio. Para volver al recorrido, click en <b>"¿Qué es Casa Nogal?"</b> al pie del menú lateral.',
      },
    ];
  },
};
