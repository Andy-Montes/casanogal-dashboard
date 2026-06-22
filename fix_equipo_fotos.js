// Fase 2 (Padres): equipo visible para la familia.
//  - foto_url (vacío → avatar de iniciales) + descripcion_breve a cada terapeuta
//  - "equipo de contacto" del centro (secretaria, encargada, coordinadora) que
//    Trini pidió que SIEMPRE aparezca en la vista de padres.
// Idempotente.
const fs = require('fs');
const path = require('path').join(__dirname, 'data.json');
const d = JSON.parse(fs.readFileSync(path, 'utf8'));

// Descripción breve por especialidad (genérica, editable luego)
const DESC = {
  'Terapia Ocupacional': 'Trabaja autonomía, juego y regulación sensorial.',
  'Fonoaudiología': 'Apoya comunicación, lenguaje y alimentación.',
  'Cognitivo': 'Estimula atención, funciones ejecutivas y aprendizaje.',
  'Kinesiología': 'Desarrolla motricidad, postura y movimiento.',
  'Psicología': 'Acompaña lo emocional y el vínculo familiar.',
  'RDI': 'Guía el desarrollo relacional con la familia.',
  'Habilidad Adaptativa': 'Trabaja habilidades para la vida diaria (KIDS).',
};
d.terapeutas.forEach(t => {
  if (t.foto_url === undefined) t.foto_url = '';
  if (!t.descripcion_breve) t.descripcion_breve = DESC[t.especialidad] || 'Parte del equipo terapéutico.';
});

// Equipo de contacto del centro (no terapeutas). Trini: "la secretaria, la
// Lorena, la Anita que es la encargada, y yo".
const contacto = [
  { id: 'STAFF-COORD', nombre: 'Trinidad Cervero', cargo: 'Coordinadora clínica', descripcion_breve: 'Coordina el equipo y el plan de cada niño.' },
  { id: 'STAFF-ENC',   nombre: 'Anita',            cargo: 'Encargada',            descripcion_breve: 'Tu contacto del día a día en el centro.' },
  { id: 'STAFF-SEC',   nombre: 'Lorena',           cargo: 'Secretaria',           descripcion_breve: 'Agenda, horarios y trámites.' },
];
d.equipo_centro = contacto.map(c => ({ ...c, foto_url: '' }));

fs.writeFileSync(path, JSON.stringify(d, null, 2));
console.log(`Terapeutas con descripción: ${d.terapeutas.length} · equipo de contacto: ${d.equipo_centro.length}`);
