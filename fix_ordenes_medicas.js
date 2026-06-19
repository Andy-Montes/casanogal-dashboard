// Siembra documentos "Orden Médica" (y un par de "Plan de Intervención")
// para la demo, de modo que la vista del apoderado muestre documentación real.
// Idempotente: no duplica si el niño ya tiene una orden médica.
const fs = require('fs');
const path = require('path').join(__dirname, 'data.json');
const d = JSON.parse(fs.readFileSync(path, 'utf8'));
const docs = d.documentos_nino;

let maxN = docs.reduce((m, x) => Math.max(m, parseInt((x.id_documento || 'DOC-0').split('-')[1], 10) || 0), 0);
const nextId = () => 'DOC-' + String(++maxN).padStart(4, '0');

// Niños que recibirán Orden Médica. NINO-0001 (León) es el apoderado demo por defecto.
const targets = ['NINO-0001', 'NINO-0002', 'NINO-0003', 'NINO-0005', 'NINO-0008'];
const descripciones = [
  'Derivación de neurología infantil para terapias integrales',
  'Indicación médica de fonoaudiología y terapia ocupacional',
  'Orden de tratamiento por neuropediatra',
  'Derivación para evaluación y terapias multidisciplinarias',
  'Indicación médica de continuidad terapéutica',
];

let added = 0;
targets.forEach((id, i) => {
  const n = d.ninos.find(x => x.id_nino === id);
  if (!n) return;
  if (docs.some(x => x.id_nino === id && x.tipo === 'Orden Médica')) return; // ya tiene
  const docPrevio = docs.find(x => x.id_nino === id);
  const visible = docPrevio ? docPrevio.nino_visible : (n.nombre_visible || n.nombre_completo);
  const baseNombre = (n.nombre_completo || visible || id).replace(/\s+/g, '_');
  docs.push({
    id_documento: nextId(),
    id_nino: id,
    nino_visible: visible,
    tipo: 'Orden Médica',
    nombre_archivo: `Orden_Medica_${baseNombre}.pdf`,
    descripcion: descripciones[i % descripciones.length],
    fecha_documento: '2026-03-10',
    subido_por: 'TC',
    fecha_subida: '2026-05-15',
  });
  added++;
});

if (d.meta && d.meta.counts) d.meta.counts.documentos_nino = docs.length;
fs.writeFileSync(path, JSON.stringify(d, null, 2));
console.log(`Órdenes médicas agregadas: ${added} · total documentos: ${docs.length}`);
