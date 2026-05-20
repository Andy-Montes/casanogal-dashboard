// fix_equipo_capado.js
// Capa el equipo terapéutico a 3-5 personas por niño (según programa) y
// reasigna TODAS sus sesiones a ese equipo fijo, para que el calendario,
// la ficha y el equipo_asignado sean coherentes.
//   Intensivo: 5 · Continuo: 4 · Evaluación/Apraxia/AT: 3
// Uso: node fix_equipo_capado.js   (reescribe data.json)

const fs = require('fs');
const RUTA = 'data.json';
const data = JSON.parse(fs.readFileSync(RUTA, 'utf8'));

const terapeutas = data.terapeutas;
const sesiones = data.sesiones;
const bloques = data.bloques_horarios;

// Terapeutas agrupados por especialidad
const porEsp = {};
terapeutas.forEach(t => { (porEsp[t.especialidad] = porEsp[t.especialidad] || []).push(t); });

const tamanoEquipo = (idPrograma) => idPrograma === 'PROG-INT' ? 5 : idPrograma === 'PROG-CONT' ? 4 : 3;
// Núcleo presente en todo equipo + especialidades extra que ROTAN entre niños,
// para que todos los terapeutas (incluidos RDI y Habilidad Adaptativa) reciban niños.
const CORE = ['Terapia Ocupacional', 'Fonoaudiología', 'Psicología'].filter(e => porEsp[e] && porEsp[e].length);
const EXTRA = ['Cognitivo', 'Kinesiología', 'RDI', 'Habilidad Adaptativa'].filter(e => porEsp[e] && porEsp[e].length);

// ---- 1. Equipo fijo por niño, balanceando carga entre terapeutas ----
const carga = {}; terapeutas.forEach(t => carga[t.id_terapeuta] = 0);
const menosCargado = (lista) => lista.slice().sort((a, b) => carga[a.id_terapeuta] - carga[b.id_terapeuta])[0];

let rot = 0;
const equipoDe = {};
data.ninos.forEach(n => {
  const N = tamanoEquipo(n.id_programa);
  const esps = CORE.slice(0, N);
  while (esps.length < N && EXTRA.length) {
    esps.push(EXTRA[rot % EXTRA.length]);
    rot++;
  }
  equipoDe[n.id_nino] = esps.map(e => {
    const t = menosCargado(porEsp[e]);
    carga[t.id_terapeuta]++;
    return t;
  });
});

// ---- 2. Reasignar sesiones al equipo ----
const terOcupado = (idTer, fecha, idBloque, exclude) => sesiones.some(o =>
  o !== exclude && o.fecha === fecha && o.id_bloque === idBloque &&
  (o.id_terapeuta === idTer || o.id_terapeuta_secundario === idTer));

const aplicar = (s, t) => { s.id_terapeuta = t.id_terapeuta; s.terapeuta_abr = t.abreviacion; s.tipo_terapia = t.especialidad; };

let reasignadas = 0;
const pendientes = [];
data.ninos.forEach(n => {
  const team = equipoDe[n.id_nino];
  if (!team.length) return;
  const ss = sesiones.filter(s => s.id_nino === n.id_nino && !s.es_dupla && !s.conflicto_detectado);
  let rr = 0;
  ss.forEach(s => {
    let elegido = null;
    for (let i = 0; i < team.length; i++) {
      const cand = team[(rr + i) % team.length];
      if (!terOcupado(cand.id_terapeuta, s.fecha, s.id_bloque, s)) {
        elegido = cand; rr = (rr + i + 1) % team.length; break;
      }
    }
    if (elegido) { aplicar(s, elegido); reasignadas++; }
    else pendientes.push({ s, team });
  });
});

// ---- 2b. Reubicar las sesiones sin cupo a otro bloque del mismo día ----
let relocadas = 0, sinResolver = 0;
pendientes.forEach(({ s, team }) => {
  let ok = false;
  for (const b of bloques) {
    if (b.id_bloque === s.id_bloque) continue;
    const ninoOcup = sesiones.some(o => o !== s && o.fecha === s.fecha && o.id_bloque === b.id_bloque &&
      (o.id_nino === s.id_nino || o.id_nino_secundario === s.id_nino));
    if (ninoOcup) continue;
    const salaOcup = sesiones.some(o => o !== s && o.fecha === s.fecha && o.id_bloque === b.id_bloque && o.id_sala === s.id_sala);
    if (salaOcup) continue;
    const libre = team.find(c => !terOcupado(c.id_terapeuta, s.fecha, b.id_bloque, s));
    if (libre) {
      s.id_bloque = b.id_bloque; s.hora_inicio = b.hora_inicio; s.hora_fin = b.hora_fin;
      aplicar(s, libre);
      relocadas++; ok = true; break;
    }
  }
  if (!ok) { aplicar(s, team[0]); sinResolver++; }
});
console.log(`Sesiones reasignadas: ${reasignadas + relocadas + sinResolver} · reubicadas: ${relocadas} · sin resolver: ${sinResolver}`);

// ---- 3. Reconstruir equipo_asignado desde el equipo fijo ----
const cuentaSes = {};
sesiones.forEach(s => { const k = s.id_nino + '::' + s.id_terapeuta; cuentaSes[k] = (cuentaSes[k] || 0) + 1; });
let eqNum = 0;
const nuevoEquipo = [];
data.ninos.forEach(n => {
  equipoDe[n.id_nino].forEach((t, idx) => {
    eqNum++;
    const ns = cuentaSes[n.id_nino + '::' + t.id_terapeuta] || 0;
    nuevoEquipo.push({
      id_asignacion: 'EQA-' + String(eqNum).padStart(4, '0'),
      id_nino: n.id_nino,
      id_terapeuta: t.id_terapeuta,
      terapeuta_visible: t.nombre_visible,
      area: t.especialidad,
      rol: idx === 0 ? 'Principal' : 'Apoyo',
      rol_terapeuta: idx === 0 ? 'Principal' : 'Apoyo',
      activa: true,
      fecha_inicio: '2026-05-04',
      fecha_fin: null,
      notas: `Equipo permanente · ${ns} sesion${ns === 1 ? '' : 'es'}`,
    });
  });
});
data.equipo_asignado = nuevoEquipo;
data.meta.counts.equipo_asignado = nuevoEquipo.length;

fs.writeFileSync(RUTA, JSON.stringify(data, null, 2) + '\n', 'utf8');
const tamanos = data.ninos.map(n => equipoDe[n.id_nino].length);
console.log(`Equipo por niño: min ${Math.min(...tamanos)} · max ${Math.max(...tamanos)} · ${nuevoEquipo.length} entradas`);
console.log('data.json reescrito.');
