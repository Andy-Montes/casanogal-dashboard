// Cap de 15 niños activos por terapeuta.
// Si un terapeuta es único de su especialidad, no se aplica cap (estructural).
// Si excede, las relaciones con menos sesiones pasan a activa: false.

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const CAP = 15;

// Contar sesiones por (niño, terapeuta) para priorizar
const conteoNT = {};
data.sesiones.forEach(s => {
  [s.id_nino, s.id_nino_secundario].filter(Boolean).forEach(nid => {
    [s.id_terapeuta, s.id_terapeuta_secundario].filter(Boolean).forEach(tid => {
      conteoNT[`${nid}__${tid}`] = (conteoNT[`${nid}__${tid}`] || 0) + 1;
    });
  });
});

// Terapeutas únicos en su especialidad
const porEsp = {};
data.terapeutas.filter(t => t.estado === 'Activo' || !t.estado).forEach(t => {
  porEsp[t.especialidad] = (porEsp[t.especialidad] || 0) + 1;
});
const esUnico = (tid) => {
  const t = data.terapeutas.find(x => x.id_terapeuta === tid);
  return t && porEsp[t.especialidad] === 1;
};

// Agrupar relaciones activas por terapeuta
const porTer = {};
data.equipo_asignado.forEach((rel, idx) => {
  if (!rel.activa) return;
  if (!porTer[rel.id_terapeuta]) porTer[rel.id_terapeuta] = [];
  porTer[rel.id_terapeuta].push({
    idx,
    ...rel,
    sesiones: conteoNT[`${rel.id_nino}__${rel.id_terapeuta}`] || 0,
  });
});

let demovidos = 0;
let preservadosPorUnicidad = 0;

Object.entries(porTer).forEach(([tid, rels]) => {
  if (esUnico(tid)) {
    preservadosPorUnicidad += rels.length > CAP ? rels.length : 0;
    return; // no cap si es único de su especialidad
  }
  if (rels.length <= CAP) return;
  // ordenar por # sesiones desc; mantener top CAP, desactivar resto
  rels.sort((a, b) => b.sesiones - a.sesiones);
  rels.slice(CAP).forEach(rel => {
    data.equipo_asignado[rel.idx].activa = false;
    data.equipo_asignado[rel.idx].rol_terapeuta = 'Sustituto';
    data.equipo_asignado[rel.idx].notas = `Sustituto · ${rel.sesiones} sesiones · demovido por cap`;
    data.equipo_asignado[rel.idx].fecha_fin = new Date().toISOString().slice(0, 10);
    demovidos++;
  });
});

fs.writeFileSync('data.json', JSON.stringify(data, null, 2));

// Stats
const final = {};
data.equipo_asignado.filter(e => e.activa).forEach(e => {
  final[e.id_terapeuta] = (final[e.id_terapeuta] || 0) + 1;
});
console.log(`Demovidos a sustituto: ${demovidos}`);
console.log(`Preservados por unicidad de especialidad: ${preservadosPorUnicidad}`);
console.log('\nNiños activos por terapeuta (DESPUÉS):');
Object.entries(final).sort((a,b)=>b[1]-a[1]).forEach(([tid, n]) => {
  const t = data.terapeutas.find(x => x.id_terapeuta === tid);
  const marca = esUnico(tid) ? ' (único de especialidad)' : '';
  console.log(`  ${(t?.nombre_visible || tid).padEnd(18)} ${(t?.especialidad || '?').padEnd(22)} ${n} niños${marca}`);
});
