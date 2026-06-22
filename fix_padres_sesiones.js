// Fase 2 (Padres): siembra el "horario del papá" para León (NINO-0001) en la
// semana visible (18-22 may), según la reunión con Trini:
//  - observación: el papá entra a observar una sesión del niño (sale en AMARILLO)
//  - vincular: sesión de psicología papá + hijo
//  - individual_padre: sesión a solas del papá con psicología
// Idempotente.
const fs = require('fs');
const path = require('path').join(__dirname, 'data.json');
const d = JSON.parse(fs.readFileSync(path, 'utf8'));
const ID = 'NINO-0001';

// Terapeuta de psicología para las sesiones con el papá
const psi = d.terapeutas.find(t => /psico/i.test(t.especialidad)) || d.terapeutas[0];

// 1) Marcar como observación 2 sesiones existentes del niño en la semana
const semana = d.sesiones
  .filter(s => s.id_nino === ID && s.fecha >= '2026-05-18' && s.fecha <= '2026-05-22')
  .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
const aObservar = [semana.find(s => s.dia_semana === 'martes'), semana.find(s => s.dia_semana === 'jueves')].filter(Boolean);
aObservar.forEach(s => { s.tipo_sesion_padre = 'observacion'; });

// 2) Crear sesiones del papá (vincular + individual) si no existen
let maxN = d.sesiones.reduce((m, s) => Math.max(m, parseInt((s.id_sesion || 'SES-0').split('-')[1], 10) || 0), 0);
const nextId = () => 'SES-' + String(++maxN).padStart(4, '0');
const base = {
  id_nino: ID, nino_visible: 'León A.', id_terapeuta: psi.id_terapeuta, terapeuta_abr: psi.abreviacion,
  id_terapeuta_secundario: null, id_nino_secundario: null, id_sala: 'SALA-09', sala_nombre: 'Espejo',
  tipo_terapia: 'Psicología', estado: 'Agendada', id_programa: 'PROG-INT',
  notas_admin: null, conflicto_detectado: null, creado_por: 'USR-001', fecha_creacion: '2026-05-15',
  semana_intensivo: 4, es_dupla: false,
};
const nuevas = [
  { ...base, id_sesion: nextId(), fecha: '2026-05-20', dia_semana: 'miércoles', id_bloque: 'BLQ-07', hora_inicio: '11:55', hora_fin: '12:30', tipo_actividad: 'Sesión vincular', tipo_sesion_padre: 'vincular' },
  { ...base, id_sesion: nextId(), fecha: '2026-05-22', dia_semana: 'viernes', id_bloque: 'BLQ-08', hora_inicio: '12:30', hora_fin: '13:00', tipo_actividad: 'Sesión de padres', tipo_sesion_padre: 'individual_padre' },
];
// evitar duplicar si ya se sembraron
const yaSembradas = new Set(d.sesiones.filter(s => s.id_nino === ID && s.tipo_sesion_padre && s.tipo_sesion_padre !== 'observacion').map(s => s.tipo_sesion_padre));
const aAgregar = nuevas.filter(s => !yaSembradas.has(s.tipo_sesion_padre));
d.sesiones.push(...aAgregar);

if (d.meta && d.meta.counts) d.meta.counts.sesiones_agendadas = (d.meta.counts.sesiones_agendadas || 0) + aAgregar.length;
fs.writeFileSync(path, JSON.stringify(d, null, 2));
console.log(`Observación marcadas: ${aObservar.length} · sesiones del papá agregadas: ${aAgregar.length} (psicóloga ${psi.nombre_completo})`);
