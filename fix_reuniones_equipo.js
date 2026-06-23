// Reunión de equipo semanal en el calendario: martes 08:00-08:35 (bloque fijo),
// una por terapeuta activo, en cada semana del rango demo.
// (Trini: "la reunión de equipo siempre de 8 a 8:35, una vez a la semana, los martes").
// Idempotente: borra las reuniones previas antes de re-sembrar.
const fs = require('fs');
const path = require('path').join(__dirname, 'data.json');
const d = JSON.parse(fs.readFileSync(path, 'utf8'));

// Quitar reuniones sembradas antes
d.sesiones = d.sesiones.filter(s => s.tipo_actividad !== 'Reunión de equipo');

// Martes del rango demo
const desde = new Date('2026-04-27T00:00:00');
const hasta = new Date('2026-06-19T00:00:00');
const martes = [];
for (let dt = new Date(desde); dt <= hasta; dt.setDate(dt.getDate() + 1)) {
  if (dt.getDay() === 2) martes.push(dt.toISOString().slice(0, 10)); // 2 = martes
}

const activos = d.terapeutas.filter(t => t.estado === 'Activo');
let maxN = d.sesiones.reduce((m, s) => Math.max(m, parseInt((s.id_sesion || 'SES-0').split('-')[1], 10) || 0), 0);
const nextId = () => 'SES-' + String(++maxN).padStart(4, '0');

let n = 0;
martes.forEach(fecha => {
  activos.forEach(t => {
    d.sesiones.push({
      id_sesion: nextId(), fecha, dia_semana: 'martes', id_bloque: 'BLQ-01',
      hora_inicio: '08:00', hora_fin: '08:35',
      id_nino: null, nino_visible: 'Reunión de equipo',
      id_terapeuta: t.id_terapeuta, terapeuta_abr: t.abreviacion,
      id_terapeuta_secundario: null, id_nino_secundario: null,
      id_sala: null, sala_nombre: '—', tipo_terapia: 'Reunión',
      tipo_actividad: 'Reunión de equipo', es_dupla: false,
      estado: 'Agendada', id_programa: null,
      notas_admin: null, conflicto_detectado: null, creado_por: 'USR-001', fecha_creacion: '2026-04-20',
    });
    n++;
  });
});

fs.writeFileSync(path, JSON.stringify(d, null, 2));
console.log(`Reuniones de equipo sembradas: ${n} (${martes.length} martes × ${activos.length} terapeutas).`);
