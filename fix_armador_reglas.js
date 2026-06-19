// Fase 1 del armador: agrega a int40.json las reglas operacionales de la reunión.
// - kids_grupo por niño (subgrupos de 2-3 para las sesiones KIDS)
// - bloque "reglas" con los parámetros configurables del motor
// Idempotente: re-ejecutar no duplica.
const fs = require('fs');
const path = require('path').join(__dirname, 'data', 'intensivos', 'int40.json');
const int = JSON.parse(fs.readFileSync(path, 'utf8'));

// Subgrupos KIDS: 6 niños → 2 grupos de 3. Orden por aparición.
// La sala KIDS tiene capacidad 1, así que cada grupo usa su propio slot.
const POR_GRUPO = 3;
int.niños.forEach((n, i) => {
  n.kids_grupo = Math.floor(i / POR_GRUPO) + 1; // 1,1,1,2,2,2
});

// Reglas configurables del motor (defaults; editables desde la UI del armador).
// Índices de franja (0-based) sobre catalogo.franjas:
//   0 = 08:00-08:35  ·  7 = 12:30-13:00  → bloques fijos sin atención (reunión equipo)
//   módulos de atención = franjas 1..6. KIDS permitido en módulos centrales 2,3,4.
// (Confirmado en la transcripción 18-jun) TUTOR y COT son sesiones SEPARADAS:
// LEON tiene 7 TO/semana (KRA 4 + PT 3). La regla "1 de cada tipo por día" es
// el ideal; cuando hay más sesiones que días, los días con 2 de la misma
// disciplina deben quedar NO consecutivas (no en módulos pegados).
int.reglas = {
  kids_modulos: [2, 3, 4],          // franjas donde puede caer KIDS (nunca la primera hora)
  kids_por_grupo: POR_GRUPO,        // grupos de 2-3 niños comparten slot KIDS
  max_por_terapeuta_dia: 5,         // máx sesiones por terapeuta por día (+ reparto parejo)
  max_por_disciplina_dia: 2,        // tope duro de sesiones de una disciplina por niño/día
  disciplina_no_consecutiva: true,  // 2 de la misma disciplina el mismo día → módulos no contiguos
  bloques_fijos: [0, 7],            // franjas sin atención (08:00-08:35 y 12:30-13:00)
  reunion_equipo_franja: 0,         // bloque fijo de reunión de equipo (1/semana por niño)
  reunion_papas_semana: 2,          // semana que reserva bloque doble para reunión con papás
  reunion_papas_bloques: 2,         // duración en módulos de la reunión con papás
};

fs.writeFileSync(path, JSON.stringify(int, null, 2));
const resumen = int.niños.map(n => `${n.nombre}=G${n.kids_grupo}`).join(', ');
console.log('Reglas agregadas. Subgrupos KIDS:', resumen);
