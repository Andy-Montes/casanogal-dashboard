// Modal de bienvenida — sobrio, una sola pantalla, no tour invasivo
const Onboarding = {
  KEY: 'casanogal_onboarded',

  shouldShow() {
    return !localStorage.getItem(this.KEY);
  },

  open(force = false) {
    if (!force && !this.shouldShow()) return;
    const html = `
      <div class="pendiente-modal-overlay" id="onbOverlay">
        <div class="onb-card">
          <div class="onb-head">
            <svg viewBox="0 0 64 64" fill="none" class="onb-brain">
              <path d="M22 14C16 14 12 18 12 24C12 26 12.5 28 13.5 29.5C11 31 9 34 9 38C9 44 13 48 19 48C20 49.5 22 51 24 51C24 53 25 54 27 54C29 54 31 53 31 51V14C28 14 25 14 22 14Z" stroke="#E8A317" stroke-width="2.5"/>
              <path d="M42 14C48 14 52 18 52 24C52 26 51.5 28 50.5 29.5C53 31 55 34 55 38C55 44 51 48 45 48C44 49.5 42 51 40 51C40 53 39 54 37 54C35 54 33 53 33 51V14C36 14 39 14 42 14Z" stroke="#E8A317" stroke-width="2.5"/>
              <line x1="32" y1="14" x2="32" y2="51" stroke="#E8A317" stroke-width="2.5"/>
            </svg>
            <div>
              <div class="onb-eyebrow">Bienvenida · Casa Nogal · Sistema clínico</div>
              <div class="onb-title">Toda tu operación clínica en un solo lugar.</div>
              <div class="onb-sub">Antes lo armabas en 7 pestañas de Google Sheets. Ahora es un solo sistema, con conflictos detectados solos y vistas distintas según quién entra.</div>
            </div>
          </div>

          <div class="onb-grid">
            <div class="onb-block">
              <span class="onb-icon" style="background:var(--cn-azul-bg);color:var(--cn-azul)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </span>
              <div>
                <div class="onb-block-title">Calendario semanal</div>
                <div class="onb-block-sub">Agenda completa de todos los niños. Drag para mover sesiones. <b style="color:var(--alert)">Conflictos detectados automáticamente.</b></div>
              </div>
            </div>

            <div class="onb-block">
              <span class="onb-icon" style="background:var(--cn-mostaza-bg);color:var(--cn-mostaza-deep)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
              </span>
              <div>
                <div class="onb-block-title">3 vistas por rol</div>
                <div class="onb-block-sub">Coordinación ve todo. Cada terapeuta ve solo a sus niños. Los padres ven solo a su hijo. Con un click cambias de vista.</div>
              </div>
            </div>

            <div class="onb-block">
              <span class="onb-icon" style="background:var(--to-bg);color:var(--to-text)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l3-3 3 3 3-3 3 3z"/></svg>
              </span>
              <div>
                <div class="onb-block-title">Fichas clínicas</div>
                <div class="onb-block-sub">Historial completo de cada niño: sesiones, notas, objetivos, equipo, documentos. Todo en una ficha.</div>
              </div>
            </div>

            <div class="onb-block">
              <span class="onb-icon" style="background:var(--success-bg);color:var(--success)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </span>
              <div>
                <div class="onb-block-title">Boletas y pagos</div>
                <div class="onb-block-sub">Boletas del mes calculadas automáticas. Horas trabajadas por terapeuta para pagar honorarios.</div>
              </div>
            </div>
          </div>

          <div class="onb-foot">
            <a href="#" class="onb-skip" id="onbDontShow">No mostrar de nuevo</a>
            <button class="btn btn-primary onb-go" id="onbGo">Entendido, mostrar el dashboard →</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);

    const close = (markDone) => {
      document.getElementById('onbOverlay')?.remove();
      if (markDone) localStorage.setItem(this.KEY, '1');
    };
    document.getElementById('onbGo').addEventListener('click', () => close(true));
    document.getElementById('onbDontShow').addEventListener('click', (e) => { e.preventDefault(); close(true); });
    document.getElementById('onbOverlay').addEventListener('click', (e) => { if (e.target.id === 'onbOverlay') close(false); });
  },

  reset() {
    localStorage.removeItem(this.KEY);
  },
};
