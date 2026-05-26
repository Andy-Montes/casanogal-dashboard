// PDF del Armador Intensivo · por niño · adaptado de PDFPadres
// render(idx, intensivo, semanas, catalogo) → inserta HTML en body, luego window.print()
const PDFArmador = {
  render(ninoIdx, intensivo, semanas, catalogo) {
    const nino = intensivo.niños[ninoIdx];
    if (!nino) return false;
    document.getElementById('pdfDoc')?.remove();
    const doc = document.createElement('div');
    doc.id = 'pdfDoc';
    doc.className = 'pdf-doc pdf-doc-armador';
    doc.innerHTML = this._html(ninoIdx, nino, intensivo, semanas, catalogo);
    document.body.appendChild(doc);
    return true;
  },

  cleanup() {
    document.getElementById('pdfDoc')?.remove();
  },

  // ====== Construcción ======

  _html(ninoIdx, nino, intensivo, semanas, catalogo) {
    return `
      ${this._sidebar(nino, intensivo)}
      <main class="pdf-main">
        ${this._resumen(ninoIdx, nino, intensivo, semanas, catalogo)}
        ${this._calendario(ninoIdx, nino, intensivo, semanas, catalogo)}
        ${this._equipo(nino, catalogo)}
        <p class="pdf-closing">Estamos aquí para acompañarlos en este intensivo. Cualquier consulta, escríbennos.</p>
      </main>
    `;
  },

  _sidebar(nino, intensivo) {
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
            <div class="pdf-brand-tag">Programa Intensivo</div>
          </div>
        </div>

        <div class="pdf-child">
          <div class="pdf-eyebrow">Horario del intensivo de</div>
          <div class="pdf-child-name">${UI.esc(nino.nombre)}</div>
          <div class="pdf-child-meta">Cohorte ${UI.esc(intensivo.id)}</div>
        </div>

        <div class="pdf-block">
          <div class="pdf-block-label">Duración</div>
          <div class="pdf-block-value">${intensivo.semanas} semanas</div>
          <div class="pdf-block-sub">${this._fmt(intensivo.fecha_inicio)} → ${this._fmt(intensivo.fecha_fin)}</div>
        </div>

        ${nino.encargado ? `
          <div class="pdf-block">
            <div class="pdf-block-label">Encargado del caso</div>
            <div class="pdf-contact-name">${UI.esc(nino.encargado)}</div>
          </div>
        ` : ''}

        <div class="pdf-block">
          <div class="pdf-block-label">Estamos disponibles</div>
          <div class="pdf-contact-name">Trinidad Cervero</div>
          <div class="pdf-contact-role">Coordinación clínica</div>
          <div class="pdf-contact-line">contacto@casanogal.cl</div>
          <div class="pdf-contact-line">+56 9 7654 3210</div>
        </div>

        <div class="pdf-foot">Documento informativo<br>Las horas son referenciales y pueden ajustarse semana a semana.</div>
      </aside>
    `;
  },

  _resumen(ninoIdx, nino, intensivo, semanas, catalogo) {
    let totalInd = 0;
    semanas.forEach(sem => {
      sem.grid[ninoIdx].forEach(sig => { if (sig && sig !== 'GP') totalInd++; });
    });
    const totalKids = (nino.kids_semanal || 0) * intensivo.semanas;
    const totalTer = new Set();
    nino.asignaciones.forEach(a => totalTer.add(a.sigla));

    return `
      <section class="pdf-section">
        <h2 class="pdf-h2">Resumen del intensivo</h2>
        <div class="pdf-stats">
          <div class="pdf-stat">
            <div class="pdf-stat-num">${totalInd}</div>
            <div class="pdf-stat-label">sesiones individuales</div>
          </div>
          <div class="pdf-stat">
            <div class="pdf-stat-num">${totalKids}</div>
            <div class="pdf-stat-label">sesiones grupales KIDS</div>
          </div>
          <div class="pdf-stat">
            <div class="pdf-stat-num">${totalTer.size}</div>
            <div class="pdf-stat-label">terapeutas en el equipo</div>
          </div>
        </div>
        <p class="pdf-lead">Abajo está el calendario completo de las ${intensivo.semanas} semanas con cada sesión asignada. Pueden imprimirlo o guardarlo como referencia.</p>
      </section>
    `;
  },

  _calendario(ninoIdx, nino, intensivo, semanas, catalogo) {
    const { dias, franjas, terapeutas } = catalogo;
    const F = franjas.length;
    const diaLabels = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb' };
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const fechaIni = new Date(intensivo.fecha_inicio + 'T00:00:00');

    const semanasHtml = semanas.map((sem, si) => {
      const inicioSem = new Date(fechaIni);
      inicioSem.setDate(fechaIni.getDate() + si * 7);
      const diasHtml = dias.map((d, di) => {
        const fechaDia = new Date(inicioSem);
        fechaDia.setDate(inicioSem.getDate() + di);
        const sesiones = [];
        sem.grid[ninoIdx].forEach((sig, slotIdx) => {
          if (!sig) return;
          const dia = Math.floor(slotIdx / F);
          if (dia !== di) return;
          const franja = slotIdx % F;
          const t = terapeutas[sig];
          const disc = t?.disciplina;
          const esKids = sig === 'GP' && this._esKidsGrupal(sem, slotIdx);
          sesiones.push({ sig, hora: franjas[franja], terapeuta: t?.nombre || sig, disc, sala: t?.sala || '', esKids });
        });
        sesiones.sort((a, b) => a.hora.localeCompare(b.hora));
        const cuerpo = sesiones.length
          ? sesiones.map(s => this._sesCard(s)).join('')
          : '<div class="pdf-empty">Sin sesiones</div>';
        return `
          <div class="pdf-day pdf-day-armador">
            <div class="pdf-day-head">
              <div class="pdf-day-name">${diaLabels[d]}</div>
              <div class="pdf-day-date">${fechaDia.getDate()} ${meses[fechaDia.getMonth()]}</div>
            </div>
            <div class="pdf-day-body">${cuerpo}</div>
          </div>
        `;
      }).join('');
      return `
        <div class="pdf-sem-row">
          <div class="pdf-sem-label">SEM ${si + 1}</div>
          <div class="pdf-sem-days">${diasHtml}</div>
        </div>
      `;
    }).join('');

    return `
      <section class="pdf-section">
        <h2 class="pdf-h2">Calendario de las ${intensivo.semanas} semanas</h2>
        <div class="pdf-month">${semanasHtml}</div>
      </section>
    `;
  },

  _esKidsGrupal(sem, slotIdx) {
    let count = 0;
    for (let i = 0; i < sem.grid.length; i++) {
      if (sem.grid[i][slotIdx] === 'GP') count++;
      if (count > 1) return true;
    }
    return false;
  },

  _sesCard(s) {
    const token = this._token(s.disc, s.esKids);
    const etiqueta = s.esKids ? 'Sesión grupal KIDS' : s.disc;
    return `
      <div class="pdf-ses" style="border-left-color:var(--${token})">
        <div class="pdf-ses-time">${UI.esc(s.hora)}</div>
        <div class="pdf-ses-esp">${UI.esc(etiqueta)}</div>
        <div class="pdf-ses-sala">${UI.esc(s.terapeuta)}${s.sala ? ' · sala ' + UI.esc(s.sala) : ''}</div>
      </div>
    `;
  },

  _token(disc, esKids) {
    if (esKids) return 'kids';
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

  _equipo(nino, catalogo) {
    // Agrupar asignaciones por disciplina, mostrar nombre completo
    const grupos = {};
    nino.asignaciones.forEach(a => {
      if (a.rol === 'PAPAS') return;
      const t = catalogo.terapeutas[a.sigla];
      if (!t) return;
      const k = t.disciplina;
      if (!grupos[k]) grupos[k] = [];
      grupos[k].push({ sigla: a.sigla, nombre: t.nombre, sesiones: a.sesiones, rol: a.rol });
    });
    const items = Object.entries(grupos).map(([disc, lista]) => {
      const ter = lista.map(l => `
        <li class="pdf-team-item">
          <span class="pdf-team-name">${UI.esc(l.nombre)} <span style="color:#9CA3AF;font-weight:400">(${UI.esc(l.sigla)})</span></span>
          <span class="pdf-team-role">${l.sesiones} sesiones/sem · ${l.rol === 'TUTOR' ? 'tutor' : 'co-tutor'}</span>
        </li>
      `).join('');
      return `
        <div class="pdf-equipo-disc">
          <div class="pdf-equipo-disc-title">${UI.esc(disc)}</div>
          <ul class="pdf-team-list">${ter}</ul>
        </div>
      `;
    }).join('');

    return `
      <section class="pdf-section pdf-section-soft">
        <h2 class="pdf-h2 pdf-h2-soft">Equipo terapéutico de ${UI.esc(nino.nombre)}</h2>
        ${items}
      </section>
    `;
  },

  _fmt(iso) {
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${meses[m - 1]} ${y}`;
  },
};
