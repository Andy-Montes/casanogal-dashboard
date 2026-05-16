// PDF dedicado para padres · documento de acompañamiento
// Genera HTML aparte y lo inyecta en body. window.print() lo imprime con styles/print.css.
const PDFPadres = {

  render(idNino) {
    const nino = Data.nino(idNino);
    if (!nino) return false;

    // Limpiar render previo si existe
    document.getElementById('pdfDoc')?.remove();

    const doc = document.createElement('div');
    doc.id = 'pdfDoc';
    doc.className = 'pdf-doc';
    doc.innerHTML = this._html(nino);
    document.body.appendChild(doc);
    return true;
  },

  cleanup() {
    document.getElementById('pdfDoc')?.remove();
  },

  mailto(idNino) {
    const n = Data.nino(idNino);
    if (!n) return '';
    const email = n.email_apoderado || '';
    const primer = (n.nombre_completo || '').split(' ')[0];
    const mes = this._mesYAnio();
    const tpl = this._loadTemplate();

    const fechas = fechasSemana();
    const sesNino = Data.sesionesDeNino(idNino).filter(s => fechas.includes(s.fecha));
    const horarioTxt = fechas.map((f, i) => {
      const [, , d] = f.split('-').map(Number);
      const ses = sesNino.filter(s => s.fecha === f).sort((a,b)=>(a.hora_inicio||'').localeCompare(b.hora_inicio||''));
      const lineas = ses.length
        ? ses.map(s => `   ${s.hora_inicio || ''}  ${s.tipo_terapia || ''} (${s.sala_nombre || ''})`).join('\n')
        : '   Sin sesiones';
      return `${DIAS_ABBR[i]} ${d}:\n${lineas}`;
    }).join('\n\n');

    const subject = tpl.subject
      .replaceAll('{nombre}', n.nombre_completo)
      .replaceAll('{primer_nombre}', primer)
      .replaceAll('{mes}', mes);

    const body = tpl.body
      .replaceAll('{nombre}', n.nombre_completo)
      .replaceAll('{primer_nombre}', primer)
      .replaceAll('{mes}', mes)
      .replaceAll('{horario}', horarioTxt);

    return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  },

  _loadTemplate() {
    try {
      const cfg = JSON.parse(localStorage.getItem('casanogal_config') || '{}');
      if (cfg.mailTemplate) return cfg.mailTemplate;
    } catch {}
    return {
      subject: 'Acompañamiento de {primer_nombre} · {mes}',
      body: 'Hola,\n\nLes compartimos el horario semanal de {primer_nombre} para este período. El PDF con el detalle completo está adjunto a este mismo correo (descárgalo desde la consola y adjúntalo manualmente).\n\nHorario de esta semana:\n\n{horario}\n\nCualquier consulta o necesidad de reagendar, escríbennos directo.\n\nUn saludo,\nEquipo Casa Nogal',
    };
  },

  // ====== Construcción ======

  _html(n) {
    return `
      ${this._sidebar(n)}
      <main class="pdf-main">
        ${this._resumenMes(n)}
        ${this._horario(n)}
        ${this._equipo(n)}
        ${this._reuniones(n)}
        <p class="pdf-closing">Estamos aquí para acompañarlos a él y a ustedes. Siempre pueden escribirnos.</p>
      </main>
    `;
  },

  _sidebar(n) {
    const edad = n.edad_anios ? `${n.edad_anios} años` : '';
    const programa = n.programa_nombre || '';
    return `
      <aside class="pdf-side">
        <div class="pdf-brand">
          <svg viewBox="0 0 64 64" fill="none" class="pdf-logo" aria-hidden="true">
            <path d="M22 14C16 14 12 18 12 24C12 26 12.5 28 13.5 29.5C11 31 9 34 9 38C9 44 13 48 19 48C20 49.5 22 51 24 51C24 53 25 54 27 54C29 54 31 53 31 51V14C28 14 25 14 22 14Z" stroke="#FFFFFF" stroke-width="2.5"/>
            <path d="M42 14C48 14 52 18 52 24C52 26 51.5 28 50.5 29.5C53 31 55 34 55 38C55 44 51 48 45 48C44 49.5 42 51 40 51C40 53 39 54 37 54C35 54 33 53 33 51V14C36 14 39 14 42 14Z" stroke="#FFFFFF" stroke-width="2.5"/>
            <line x1="32" y1="14" x2="32" y2="51" stroke="#FFFFFF" stroke-width="2.5"/>
          </svg>
          <div class="pdf-brand-text">
            <div class="pdf-brand-name">casa<b>nogal</b></div>
            <div class="pdf-brand-tag">Centro de terapias</div>
          </div>
        </div>

        <div class="pdf-child">
          <div class="pdf-eyebrow">Acompañamiento de</div>
          <div class="pdf-child-name">${UI.esc(n.nombre_completo)}</div>
          <div class="pdf-child-meta">${[edad, programa].filter(Boolean).map(UI.esc).join(' · ')}</div>
        </div>

        <div class="pdf-block">
          <div class="pdf-block-label">Documento</div>
          <div class="pdf-block-value">${this._mesYAnio()}</div>
          <div class="pdf-block-sub">Semana del ${this._rangoSemana()}</div>
        </div>

        <div class="pdf-block">
          <div class="pdf-block-label">Estamos disponibles</div>
          <div class="pdf-contact-name">Trinidad Cervero</div>
          <div class="pdf-contact-role">Coordinación clínica</div>
          <div class="pdf-contact-line">contacto@casanogal.cl</div>
          <div class="pdf-contact-line">+56 9 7654 3210</div>
        </div>

        <div class="pdf-foot">Documento informativo<br>No reemplaza la comunicación directa con el equipo.</div>
      </aside>
    `;
  },

  _resumenMes(n) {
    const mesIso = HOY_ISO.slice(0, 7);
    const sesMes = Data.sesionesDeNino(n.id_nino).filter(s => s.fecha.startsWith(mesIso));
    const total = sesMes.length;
    const realizadas = sesMes.filter(s => s.estado === 'Realizada').length;
    const futuras = sesMes.filter(s => s.estado === 'Agendada' && s.fecha >= HOY_ISO).length;
    const primerNombre = (n.nombre_completo || '').split(' ')[0];

    return `
      <section class="pdf-section">
        <h2 class="pdf-h2">Este mes con ${UI.esc(primerNombre)}</h2>
        <div class="pdf-stats">
          <div class="pdf-stat">
            <div class="pdf-stat-num">${total}</div>
            <div class="pdf-stat-label">sesiones agendadas</div>
          </div>
          <div class="pdf-stat">
            <div class="pdf-stat-num">${realizadas}</div>
            <div class="pdf-stat-label">sesiones completadas</div>
          </div>
          <div class="pdf-stat">
            <div class="pdf-stat-num">${futuras}</div>
            <div class="pdf-stat-label">por venir</div>
          </div>
        </div>
        <p class="pdf-lead">Las próximas sesiones de ${UI.esc(primerNombre)} aparecen abajo en la grilla semanal. Si necesitan reagendar alguna, escríbennos.</p>
      </section>
    `;
  },

  _equipo(n) {
    const equipo = Data.equipoDeNino(n.id_nino);
    if (!equipo.length) return '';
    const primerNombre = (n.nombre_completo || '').split(' ')[0];

    const items = equipo.map(e => {
      const t = Data.terapeuta(e.id_terapeuta);
      if (!t) return '';
      return `
        <li class="pdf-team-item">
          <span class="pdf-team-name">${UI.esc(t.nombre_completo)}</span>
          <span class="pdf-team-role">${UI.esc(t.especialidad || '')}</span>
        </li>`;
    }).join('');

    return `
      <section class="pdf-section pdf-section-soft">
        <h2 class="pdf-h2 pdf-h2-soft">Equipo que acompaña a ${UI.esc(primerNombre)}</h2>
        <ul class="pdf-team-list">${items}</ul>
      </section>
    `;
  },

  _horario(n) {
    const fechas = fechasSemana();
    const sesNino = Data.sesionesDeNino(n.id_nino).filter(s => fechas.includes(s.fecha));
    const sesPorDia = fechas.map(f => sesNino.filter(s => s.fecha === f).sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || '')));

    const columnas = fechas.map((f, i) => {
      const [y, m, d] = f.split('-').map(Number);
      const ses = sesPorDia[i];
      const cuerpo = ses.length
        ? ses.map(s => this._sesionCard(s)).join('')
        : '<div class="pdf-empty">Sin sesiones</div>';
      return `
        <div class="pdf-day">
          <div class="pdf-day-head">
            <div class="pdf-day-name">${DIAS_ABBR[i]}</div>
            <div class="pdf-day-date">${d}</div>
          </div>
          <div class="pdf-day-body">${cuerpo}</div>
        </div>`;
    }).join('');

    return `
      <section class="pdf-section">
        <h2 class="pdf-h2">Sus sesiones esta semana</h2>
        <div class="pdf-week">${columnas}</div>
      </section>
    `;
  },

  _sesionCard(s) {
    const sala = Data.sala(s.id_sala);
    const esp = s.tipo_terapia || '';
    const estado = s.estado || '';
    const estadoClass = estado === 'Realizada' ? 'is-done'
                      : estado === 'Cancelada' ? 'is-cancel'
                      : estado === 'No Asistió' ? 'is-miss' : 'is-next';
    const rango = s.hora_inicio && s.hora_fin ? `${s.hora_inicio}–${s.hora_fin}` : (s.hora_inicio || '');
    return `
      <div class="pdf-ses ${estadoClass}">
        <div class="pdf-ses-time">${UI.esc(rango)}</div>
        <div class="pdf-ses-esp">${UI.esc(esp)}</div>
        <div class="pdf-ses-sala">${UI.esc(sala?.nombre || s.sala_nombre || '')}</div>
      </div>`;
  },

  _reuniones(n) {
    const reus = (() => {
      try {
        const all = JSON.parse(localStorage.getItem('casanogal_reuniones') || '{}');
        return all[n.id_nino] || [];
      } catch { return []; }
    })();
    const futuras = reus.filter(r => r.fecha >= HOY_ISO).sort((a, b) => a.fecha.localeCompare(b.fecha));

    const cuerpo = futuras.length
      ? futuras.slice(0, 3).map(r => `
          <div class="pdf-reu">
            <div class="pdf-reu-date">${UI.esc(UI.fmtFecha(r.fecha))} · ${UI.esc(r.hora || '')}</div>
            <div class="pdf-reu-body">
              <b>${UI.esc(r.tipo || 'Reunión')}</b> · ${UI.esc(r.modo || 'Presencial')}
              ${r.nota ? `<div class="pdf-reu-note">${UI.esc(r.nota)}</div>` : ''}
            </div>
          </div>`).join('')
      : '<p class="pdf-reu-empty">Por ahora no hay reuniones agendadas. Si quieren conversar con el equipo, escríbennos y la coordinamos.</p>';

    return `
      <section class="pdf-section">
        <h2 class="pdf-h2">Tus espacios para conversar</h2>
        ${cuerpo}
      </section>
    `;
  },

  // ====== Helpers ======

  _mesYAnio() {
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const [y, m] = HOY_ISO.split('-').map(Number);
    return `${meses[m - 1]} ${y}`;
  },

  _rangoSemana() {
    const fechas = fechasSemana();
    const [, , d1] = fechas[0].split('-').map(Number);
    const [, , d5] = fechas[4].split('-').map(Number);
    return `${d1} al ${d5}`;
  },
};
