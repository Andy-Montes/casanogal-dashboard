// Fix equipo_asignado: solo terapeutas frecuentes quedan activos (Principal/Apoyo).
// Los sustitutos puntuales quedan en histórico con activa: false.
//
// Criterio por par (niño, especialidad):
//   - Top 1: Principal · activa: true
//   - Top 2: Apoyo · activa: true SI tiene >= 50% de sesiones del Top 1
//   - Resto: activa: false (sustitutos en histórico)

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

// Helper: especialidad de un terapeuta
const espDe = (tid) => data.terapeutas.find(t => t.id_terapeuta === tid)?.especialidad || 'Desconocida';

// 1. Contar sesiones por (niño, terapeuta)
const conteo = {};
data.sesiones.forEach(s => {
  const ninos = [s.id_nino, s.id_nino_secundario].filter(Boolean);
  const tes = [s.id_terapeuta, s.id_terapeuta_secundario].filter(Boolean);
  ninos.forEach(nid => {
    tes.forEach(tid => {
      const k = `${nid}__${tid}`;
      conteo[k] = (conteo[k] || 0) + 1;
    });
  });
});

// 2. Para cada niño, agrupar terapeutas por especialidad y decidir activos
const decisiones = new Map(); // key (nino__ter) -> { activa, rol, sesiones }

data.ninos.forEach(n => {
  const tersDelNino = Object.entries(conteo)
    .filter(([k]) => k.startsWith(n.id_nino + '__'))
    .map(([k, count]) => ({
      tid: k.split('__')[1],
      count,
      esp: espDe(k.split('__')[1]),
    }));

  // Agrupar por especialidad
  const porEsp = {};
  tersDelNino.forEach(t => {
    if (!porEsp[t.esp]) porEsp[t.esp] = [];
    porEsp[t.esp].push(t);
  });

  // Por especialidad: ordenar por count, decidir roles
  Object.values(porEsp).forEach(grupo => {
    grupo.sort((a, b) => b.count - a.count);
    const top1 = grupo[0];
    const top2 = grupo[1];
    decisiones.set(`${n.id_nino}__${top1.tid}`, { activa: true, rol: 'Principal', sesiones: top1.count });
    if (top2 && top2.count >= top1.count * 0.5) {
      decisiones.set(`${n.id_nino}__${top2.tid}`, { activa: true, rol: 'Apoyo', sesiones: top2.count });
    }
    // El resto queda como activa: false (sustitutos)
    grupo.slice(top2 && top2.count >= top1.count * 0.5 ? 2 : 1).forEach(sub => {
      decisiones.set(`${n.id_nino}__${sub.tid}`, { activa: false, rol: 'Sustituto', sesiones: sub.count });
    });
  });
});

// 3. Reconstruir equipo_asignado
const ahora = new Date().toISOString().slice(0, 10);
const nuevoEquipo = [];
let idx = 1;

decisiones.forEach((dec, k) => {
  const [nid, tid] = k.split('__');
  nuevoEquipo.push({
    id_asignacion: `EQA-${String(idx).padStart(4, '0')}`,
    id_nino: nid,
    id_terapeuta: tid,
    rol_terapeuta: dec.rol,
    activa: dec.activa,
    fecha_inicio: ahora,
    fecha_fin: dec.activa ? null : ahora,
    notas: dec.activa
      ? `Equipo permanente · ${dec.sesiones} sesiones`
      : `Sustituto puntual · ${dec.sesiones} sesiones`,
  });
  idx++;
});

data.equipo_asignado = nuevoEquipo;

fs.writeFileSync('data.json', JSON.stringify(data, null, 2));

// Stats
const totalRel = nuevoEquipo.length;
const activas = nuevoEquipo.filter(e => e.activa).length;
const inactivas = totalRel - activas;
const principales = nuevoEquipo.filter(e => e.activa && e.rol_terapeuta === 'Principal').length;
const apoyos = nuevoEquipo.filter(e => e.activa && e.rol_terapeuta === 'Apoyo').length;

console.log(`equipo_asignado regenerado:`);
console.log(`  Total relaciones: ${totalRel}`);
console.log(`  Activas: ${activas} (Principales: ${principales}, Apoyos: ${apoyos})`);
console.log(`  Inactivas (sustitutos): ${inactivas}`);

// Distribución por niño
const porNino = {};
nuevoEquipo.filter(e => e.activa).forEach(e => {
  porNino[e.id_nino] = (porNino[e.id_nino] || 0) + 1;
});
const counts = Object.values(porNino);
const promedio = (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1);
const max = Math.max(...counts);
const min = Math.min(...counts);
console.log(`\nEquipo permanente por niño:`);
console.log(`  Promedio: ${promedio} terapeutas`);
console.log(`  Min: ${min}, Max: ${max}`);

// Ejemplo León
const leonActivos = nuevoEquipo.filter(e => e.id_nino === 'NINO-0001' && e.activa);
console.log(`\nLeón (NINO-0001) ahora:`);
leonActivos.forEach(e => {
  const t = data.terapeutas.find(x => x.id_terapeuta === e.id_terapeuta);
  console.log(`  ${t.nombre_completo} (${t.especialidad}) · ${e.rol_terapeuta} · ${e.notas}`);
});
