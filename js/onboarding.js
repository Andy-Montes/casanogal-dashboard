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
    const layer = document.createElement('div');
    layer.id = 'tourLayer';
    layer.className = 'tour-layer';
    layer.innerHTML = `
      <div class="tour-backdrop"></div>
      <div class="tour-pop" id="tourPop">
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
      </div>
    `;
    document.body.appendChild(layer);

    // Highlight del target
    if (target) {
      target.classList.add('tour-highlight');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Posicionar el popover
    this._positionPop(target, step.position);

    // Wire
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
      target?.classList.remove('tour-highlight');
      document.getElementById('tourLayer')?.remove();
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
        body: 'Desde el menú lateral entras a <b>Calendario</b>, <b>Fichas clínicas</b>, <b>Reportes y boletas</b>, <b>Equipo</b>, <b>Niños</b>, <b>Salas</b>, <b>Configuración</b> y <b>Permisos</b>. Cada sección está pensada para un momento del día.',
      },
      {
        target: '#roleSwitcher',
        position: 'below',
        title: 'Cambia de vista según quién necesita ver qué',
        body: 'Como super admin puedes previsualizar cómo se ve el sistema para un <b>Terapeuta</b> (solo sus niños) o entrar a la <b>Consola Familia</b> (Padres) para preparar lo que les llega a los apoderados.',
      },
      {
        target: '.kpi-row, .hero-meta, .hero',
        position: 'below',
        title: 'Termómetro del centro',
        body: 'Arriba del calendario tienes los <b>KPIs de la semana</b>: ocupación, sesiones hoy, salas activas y conflictos. Si algo se pone rojo, le clickeas y entras al detalle.',
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
