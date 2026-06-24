// Alinea el calendario al Excel de Trini (semana 1 = lunes 2026-04-20) y reconstruye
// las reuniones de equipo con el modelo correcto:
//   - UNA reunión por niño (en intensivo) por semana,
//   - el día en que coinciden sus 3 tutores (TO + Fono + Cognitivo/Psicología),
//   - en bloque fijo 08:00-08:35 (BLQ-01) o 12:30-13:00 (BLQ-08), sin atención,
//   - equipos paralelos: varias reuniones pueden caer en el mismo bloque.
// Idempotente: el shift de fechas solo se aplica si aún arranca el 2026-04-27.
const fs = require('fs');
const file = require('path').join(__dirname, 'data.json');
const d = JSON.parse(fs.readFileSync(file, 'utf8'));

const BASE_ACTUAL = '2026-04-27'; // lunes con el que arranca hoy la demo
const BASE_EXCEL = '2026-04-20';  // semana 1 del Excel SEMANA 6 - INT 40
const shiftISO = (iso, days) => {
  if (!iso || typeof iso !== 'string' || iso.length < 10) return iso;
  const [y, m, dd] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd + days)).toISOString().slice(0, 10);
};
const lunesDe = (iso) => {
  const [y, m, dd] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  const off = (dt.getUTCDay() + 6) % 7; // 0=lunes
  return shiftISO(iso, -off);
};
const DIA_IDX = { lunes: 0, martes: 1, 'miércoles': 2, miercoles: 2, jueves: 3, viernes: 4 };

// === PASO 0 · BLQ-08 (12:30) es bloque de atención, no de reunión ===
const blq08 = d.bloques_horarios.find(b => b.id_bloque === 'BLQ-08');
if (blq08) blq08.es_reunion_equipo = false;

// === PASO A · Shift de fechas operativas (-7) para que la semana 1 sea 2026-04-20 ===
const minFecha = d.sesiones.map(s => s.fecha).filter(Boolean).sort()[0];
let shifted = false;
if (minFecha === BASE_ACTUAL) {
  const SH = -7;
  d.sesiones.forEach(s => { s.fecha = shiftISO(s.fecha, SH); });
  d.ninos.forEach(n => {
    n.fecha_inicio_programa = shiftISO(n.fecha_inicio_programa, SH);
    n.fecha_termino_programa = shiftISO(n.fecha_termino_programa, SH);
  });
  (d.equipo_asignado || []).forEach(e => {
    e.fecha_inicio = shiftISO(e.fecha_inicio, SH);
    if (e.fecha_fin) e.fecha_fin = shiftISO(e.fecha_fin, SH);
  });
  if (d.meta.rango_demo) { d.meta.rango_demo.desde = shiftISO(d.meta.rango_demo.desde, SH); d.meta.rango_demo.hasta = shiftISO(d.meta.rango_demo.hasta, SH); }
  if (d.meta.fecha_referencia) d.meta.fecha_referencia = shiftISO(d.meta.fecha_referencia, SH);
  if (d.meta.fecha_inicio_periodo) d.meta.fecha_inicio_periodo = shiftISO(d.meta.fecha_inicio_periodo, SH);
  shifted = true;
}

// === PASO B · Recalcular término de los intensivos (6 semanas lun-vie desde el inicio) ===
let terminosFix = 0;
d.ninos.forEach(n => {
  if ((n.id_programa || '').includes('INT') && n.fecha_inicio_programa) {
    const nuevo = shiftISO(lunesDe(n.fecha_inicio_programa), 5 * 7 + 4); // viernes de SEM6
    if (n.fecha_termino_programa !== nuevo) { n.fecha_termino_programa = nuevo; terminosFix++; }
  }
});

// === PASO C · Feriado civil fijo (21 de mayo, Glorias Navales) ===
// Tras el shift -7, el hueco del feriado viejo cayó en el jueves 14-may (que SÍ tiene
// atención) y el 21-may quedó CON sesiones. Movemos las sesiones del 21 (jueves feriado)
// al 14 (jueves hábil, que estaba vacío): el 14 recupera atención y el 21 queda sin nadie.
d.meta.feriados = ['2026-05-21'];
let movidasFeriado = 0, choqueFeriado = 0;
const ocupado14 = new Set(d.sesiones.filter(s => s.fecha === '2026-05-14').map(s => s.id_terapeuta + '|' + s.id_bloque));
d.sesiones.forEach(s => {
  if (s.fecha !== '2026-05-21') return;
  const key = s.id_terapeuta + '|' + s.id_bloque;
  if (ocupado14.has(key)) { choqueFeriado++; return; } // ya hay algo ese jueves: dejar (raro)
  s.fecha = '2026-05-14';
  ocupado14.add(key);
  movidasFeriado++;
});

// === PASO C2 · Reconstruir reuniones de equipo (modelo por niño) ===
d.sesiones = d.sesiones.filter(s => s.tipo_actividad !== 'Reunión de equipo');

// índice de ocupación: terapeuta -> fecha -> Set(bloques)
const ocup = {};
const marcar = (idTer, fecha, blq) => { ((ocup[idTer] = ocup[idTer] || {})[fecha] = ocup[idTer][fecha] || new Set()).add(blq); };
const libre = (idTer, fecha, blq) => !(ocup[idTer] && ocup[idTer][fecha] && ocup[idTer][fecha].has(blq));
d.sesiones.forEach(s => { if (s.id_terapeuta) marcar(s.id_terapeuta, s.fecha, s.id_bloque); });

const feriados = new Set(d.meta.feriados || []);
const bloquesReunion = ['BLQ-01', 'BLQ-08'];
const horaDe = (blq) => d.bloques_horarios.find(b => b.id_bloque === blq);

// tutores núcleo de cada niño
const tutoresDe = (idNino) => {
  const eq = (d.equipo_asignado || []).filter(e => e.id_nino === idNino && e.activa !== false);
  const pick = (areas) => eq.find(e => areas.includes(e.area));
  const to = pick(['Terapia Ocupacional']);
  const fono = pick(['Fonoaudiología']);
  const cog = pick(['Cognitivo']) || pick(['Psicología']);
  return [to, fono, cog].filter(Boolean);
};

let maxN = d.sesiones.reduce((m, s) => Math.max(m, parseInt((s.id_sesion || 'SES-0').split('-')[1], 10) || 0), 0);
const nextId = () => 'SES-' + String(++maxN).padStart(4, '0');

const ninosInt = d.ninos.filter(n => n.estado === 'Activo' && (n.id_programa || '').includes('INT'));
// Contador de reuniones por slot (fecha+bloque) para REPARTIR parejo y no
// amontonar muchas en el mismo bloque/día (Trini: pueden ser paralelas, pero no todas juntas).
const reunPorSlot = {};
const TOPE_PARALELO = 2; // máx reuniones simultáneas preferido en un mismo bloque
let reunCreadas = 0, reunSinSlot = 0;
ninosInt.forEach(n => {
  const tutores = tutoresDe(n.id_nino);
  if (tutores.length < 2) return; // sin equipo suficiente
  const semanas = [...new Set(d.sesiones.filter(s => s.id_nino === n.id_nino && s.tipo_actividad !== 'Reunión de equipo').map(s => lunesDe(s.fecha)))].sort();
  semanas.forEach(lun => {
    // candidatos = todos los (día lun-vie × bloque 08:00/12:30) con los tutores libres y sin feriado
    const candidatos = [];
    for (let dia = 0; dia < 5; dia++) {
      const fecha = shiftISO(lun, dia);
      if (feriados.has(fecha)) continue;
      // la reunión debe caer DENTRO del programa del niño (no antes del inicio ni tras el término)
      if (n.fecha_inicio_programa && fecha < n.fecha_inicio_programa) continue;
      if (n.fecha_termino_programa && fecha > n.fecha_termino_programa) continue;
      for (const blq of bloquesReunion) {
        if (tutores.every(t => libre(t.id_terapeuta, fecha, blq))) {
          const key = fecha + '|' + blq;
          candidatos.push({ fecha, blq, dia, key, carga: reunPorSlot[key] || 0 });
        }
      }
    }
    if (!candidatos.length) { reunSinSlot++; return; }
    // elegir el slot MENOS cargado (reparte); desempate determinista por fecha y bloque
    candidatos.sort((a, b) => a.carga - b.carga || a.fecha.localeCompare(b.fecha) || a.blq.localeCompare(b.blq));
    const e = candidatos[0];
    reunPorSlot[e.key] = (reunPorSlot[e.key] || 0) + 1;
    const h = horaDe(e.blq);
    const diaNombre = Object.keys(DIA_IDX).find(k => DIA_IDX[k] === e.dia && k !== 'miercoles');
    tutores.forEach(t => {
      marcar(t.id_terapeuta, e.fecha, e.blq);
      d.sesiones.push({
        id_sesion: nextId(), fecha: e.fecha, semana_intensivo: null, dia_semana: diaNombre,
        id_bloque: e.blq, hora_inicio: h.hora_inicio, hora_fin: h.hora_fin,
        id_nino: n.id_nino, nino_visible: 'Reunión de equipo · ' + n.nombre_visible,
        id_terapeuta: t.id_terapeuta, terapeuta_abr: t.terapeuta_visible || '',
        id_terapeuta_secundario: null, id_nino_secundario: null,
        id_sala: null, sala_nombre: '—', tipo_terapia: 'Reunión de equipo',
        tipo_actividad: 'Reunión de equipo', es_dupla: false, estado: 'Agendada',
        id_programa: n.id_programa, notas_admin: null, conflicto_detectado: null,
        creado_por: 'USR-001', fecha_creacion: '2026-04-20',
      });
      reunCreadas++;
    });
  });
});
// Diagnóstico de reparto: máximo de reuniones (eventos) en un mismo slot
const maxPorSlot = Object.values(reunPorSlot).reduce((m, v) => Math.max(m, v), 0);
const slotsCargados = Object.entries(reunPorSlot).filter(([, v]) => v > TOPE_PARALELO).length;

// === PASO D · meta: contadores + navegación de demo (campos stale detectados por nogalito) ===
d.meta.fecha_inicio_periodo = '2026-04-20';
d.meta.fecha_referencia = '2026-05-11';
d.meta.semana_actual = 4; // la semana visible 11-may es la SEM 4 del intensivo
d.meta.generado_en = '2026-06-23T00:00:00';
const c = d.meta.counts;
c.bloques_horarios = d.bloques_horarios.length;
c.sesiones = d.sesiones.length;
c.ninos = d.ninos.length;
c.ninos_activos = d.ninos.filter(n => n.estado === 'Activo').length;
const porEstado = (e) => d.sesiones.filter(s => s.estado === e).length;
c.sesiones_realizadas = porEstado('Realizada');
c.sesiones_canceladas = porEstado('Cancelada');
c.sesiones_no_asistio = porEstado('No Asistió');
c.sesiones_agendadas = porEstado('Agendada');

fs.writeFileSync(file, JSON.stringify(d, null, 2));
const fechas = [...new Set(d.sesiones.map(s => s.fecha))].sort();
console.log('Calendario alineado al Excel:');
console.log(`  Shift -7 aplicado: ${shifted} (rango ahora ${fechas[0]} a ${fechas[fechas.length - 1]})`);
console.log(`  Feriado: ${JSON.stringify(d.meta.feriados)} · sesiones movidas del 21→14 may: ${movidasFeriado} (choques omitidos: ${choqueFeriado})`);
console.log(`  Sesiones el 14-may (debe tener atención): ${d.sesiones.filter(s => s.fecha === '2026-05-14').length} · el 21-may (feriado, debe ser 0): ${d.sesiones.filter(s => s.fecha === '2026-05-21').length}`);
console.log(`  Términos de intensivo recalculados: ${terminosFix} (ej. León: ${d.ninos.find(n => n.id_nino === 'NINO-0001').fecha_inicio_programa} → ${d.ninos.find(n => n.id_nino === 'NINO-0001').fecha_termino_programa})`);
console.log(`  Reuniones de equipo creadas: ${reunCreadas} registros · máximo por slot (día+bloque): ${maxPorSlot} eventos · slots sobre tope (${TOPE_PARALELO}): ${slotsCargados}`);
console.log(`  Reuniones por día: ${JSON.stringify((() => { const x = {}; d.sesiones.filter(s => s.tipo_actividad === 'Reunión de equipo').forEach(s => x[s.dia_semana] = (x[s.dia_semana] || 0) + 1); return x; })())}`);
console.log(`  meta.counts.sesiones=${c.sesiones} (sub-estados suman ${c.sesiones_realizadas + c.sesiones_canceladas + c.sesiones_no_asistio + c.sesiones_agendadas}) · BLQ-08 reunion=${blq08.es_reunion_equipo}`);
