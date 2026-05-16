// Fix completo basado en reporte de nogalito (2026-05-16)
// 1. Regenerar equipo_asignado desde sesiones (cubrir 408 pares faltantes)
// 2. Cambiar 15 cancelaciones/no asistió con fecha futura a Agendada
// 3. (UI alert para NINO-0007 va aparte en pendientes)

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const HOY = '2026-05-15';

// === 1. Regenerar equipo_asignado ===
const ahora = new Date().toISOString().slice(0, 10);
const existentes = new Map();
data.equipo_asignado.forEach(e => {
  const k = `${e.id_terapeuta}__${e.id_nino}`;
  existentes.set(k, e);
});

let agregados = 0;
let reactivados = 0;
const pares = new Set();
data.sesiones.forEach(s => {
  if (s.id_terapeuta && s.id_nino) pares.add(`${s.id_terapeuta}__${s.id_nino}`);
  if (s.id_terapeuta_secundario && s.id_nino) pares.add(`${s.id_terapeuta_secundario}__${s.id_nino}`);
  if (s.id_terapeuta && s.id_nino_secundario) pares.add(`${s.id_terapeuta}__${s.id_nino_secundario}`);
});

pares.forEach(k => {
  const [tid, nid] = k.split('__');
  if (existentes.has(k)) {
    const e = existentes.get(k);
    if (!e.activa) { e.activa = true; reactivados++; }
  } else {
    data.equipo_asignado.push({
      id_asignacion: `EQA-AUTO-${agregados + data.equipo_asignado.length + 1}`,
      id_nino: nid,
      id_terapeuta: tid,
      rol_terapeuta: 'Apoyo',
      activa: true,
      fecha_inicio: ahora,
      fecha_fin: null,
      notas: 'Generado automáticamente desde sesiones (nogalito fix)',
    });
    agregados++;
  }
});

console.log(`equipo_asignado: +${agregados} nuevos, ${reactivados} reactivados (total: ${data.equipo_asignado.length})`);

// === 2. Cancelaciones futuras → Agendada ===
let cancelacionesFix = 0;
data.sesiones.forEach(s => {
  if ((s.estado === 'Cancelada' || s.estado === 'No Asistió') && s.fecha > HOY) {
    s.estado = 'Agendada';
    cancelacionesFix++;
  }
});
console.log(`Cancelaciones futuras revertidas a Agendada: ${cancelacionesFix}`);

// === Guardar ===
fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
console.log('data.json actualizado');
