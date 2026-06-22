// Fase 4 (Coordinación): deja la data lista para disponibilidad y salas.
//  - sala_principal por terapeuta (según su especialidad)
//  - disponibilidad_bloques (por día → ids de bloque) + excepciones (lactancia, salida)
//  - marca los bloques fijos sin atención (reunión de equipo) en bloques_horarios
// Idempotente.
const fs = require('fs');
const path = require('path').join(__dirname, 'data.json');
const d = JSON.parse(fs.readFileSync(path, 'utf8'));

// Bloques de la mañana (atención); los fijos se marcan aparte
const bloques = d.bloques_horarios || [];
bloques.forEach(b => {
  b.es_reunion_equipo = (b.hora_inicio === '08:00' || b.hora_inicio === '12:30');
});
const idsAtencion = bloques.filter(b => !b.es_reunion_equipo && b.periodo === 'Mañana').map(b => b.id_bloque);
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];

// Sala principal por especialidad (primera sala cuyo tipo calce)
const salaPara = (esp) => {
  const s = (d.salas || []).find(x => x.tipo_principal === esp) || (d.salas || []).find(x => x.tipo_principal === 'Multifunción');
  return s ? s.id_sala : null;
};

d.terapeutas.forEach((t, i) => {
  if (!t.sala_principal) t.sala_principal = salaPara(t.especialidad);
  if (!t.disponibilidad_bloques) {
    t.disponibilidad_bloques = {};
    DIAS.forEach(dia => { t.disponibilidad_bloques[dia] = idsAtencion.slice(); });
  }
  if (!t.excepciones) t.excepciones = [];
});

// Dos excepciones de ejemplo (lo que mencionó Trini: lactancia / salida 12:00)
const conLactancia = d.terapeutas[2];
if (conLactancia && !conLactancia.excepciones.length) {
  const ultimos = idsAtencion.slice(-2); // sale antes: no disponible en los 2 últimos bloques de mañana
  conLactancia.excepciones.push({ concepto: 'Hora de lactancia', detalle: 'Sale a las 12:00', bloques_indisponibles: ultimos, dias: DIAS });
  DIAS.forEach(dia => { conLactancia.disponibilidad_bloques[dia] = idsAtencion.filter(b => !ultimos.includes(b)); });
}

fs.writeFileSync(path, JSON.stringify(d, null, 2));
console.log(`Bloques fijos marcados: ${bloques.filter(b => b.es_reunion_equipo).length} · terapeutas con sala/disponibilidad: ${d.terapeutas.length} · excepciones de ejemplo: 1`);
