# Casa Nogal · Checklist de observaciones de Trini

> Estado al **2026-06-25**. Marco `[x]` lo desplegado, `[~]` lo parcial/maquetado, `[ ]` lo pendiente.
> Deploy: https://casanogal.vercel.app (recordar Ctrl+Shift+R para botar caché).

---

## 🩺 Ficha del paciente · Datos generales
- [x] Edad al lado de la fecha de nacimiento
- [x] Papá **y** mamá por separado (no solo un apoderado)
- [x] Estado civil de los padres
- [ ] Diagnóstico como lista desplegable + opción "Otro" (nombre libre) + permitir **varios** diagnósticos
- [ ] Filtrar pacientes por diagnóstico
- [ ] Descargar ficha completa de un paciente
- [ ] Descargar fichas de **todos** los pacientes

## 🗓️ Ficha del paciente · Horario de la semana
- [x] Mostrar la **sala** además de la sesión y el terapeuta

## 📖 Ficha del paciente · Historia de Vida
- [ ] Definir qué se ve dentro de cada intensivo: horario, terapeutas, objetivos trabajados, registro de atenciones, informes, reuniones y documentos subidos

## 📝 Sesiones
- [x] Renombrar estado "Cancelada" → "Suspendida"
- [ ] Descargar **todos** los registros de atención juntos (día / semana / intensivo) tipo Word: fecha, hora, terapeuta y registro
- [ ] Nuevos tipos de sesión: **papás solos** (psicología), **talleres grupales**, **coaching**
- [ ] Sesión de **neurología semanal** en los intensivos (supervisión de la dra)

## 🎯 Objetivos terapéuticos
- [ ] Reestructurar a **Objetivo 1 / 2 / 3 / 4** (no por área)
- [ ] Dentro de cada objetivo, 5 subcategorías CIF: Funciones Corporales, Estructuras Corporales, Actividades, Participación, Ambiente
- [ ] Banco de objetivos predefinido para elegir

## 🤝 Reuniones
- [ ] Mostrar cada reunión con el **registro de lo conversado** (queda guardado ahí mismo)

## ⚙️ Configuración
- [x] Bug: el modal de "modificar profesional" no cabía en pantalla → ahora con scroll

## 🧩 Armador de Horario
- [ ] Preferencia de inicio por niño (ej: "partir con TO")
- [ ] Duplas / grupos: dupla de terapeutas (2 ter · 1 niño), dupla de niños (1 ter · 2 niños), grupal (2 ter · 3 niños)
- [ ] Restricción: máximo 2 observaciones por sala de TO
- [ ] Restricción: máximo 4 niños en sala TO1 y 2 niños en TO2
- [ ] Poder ir agregando restricciones nuevas cuando se necesite
- [ ] Terapeuta: un día para intensivo y otro para seguimiento
- [ ] Qué pasa con los horarios pasados cuando termina un intensivo
- [ ] Poder armar otro horario mientras un intensivo está en curso
- [ ] "Intensivo 41" navegable: ver niños y horario de cada intensivo histórico

## 👩‍⚕️ Terapeutas
- [ ] Explicar/mostrar cómo quedan marcadas las observaciones en su horario
- [ ] Registrar asistencia del terapeuta: faltó / llegó tarde / se fue temprano
- [ ] % de tiempo en terapias efectivas vs reuniones (con tope, ej. no más de 80%)

## 🔔 Notificaciones (roadmap a maquetar)
- [ ] Sistema de notificaciones a terapeutas (o a quien se elija)
- [ ] Avisos automáticos: niño no asiste → avisar a su equipo; cambio de horario → avisar al terapeuta
- [ ] Tipo chat para mensajes al equipo (ej: "viene cansado, durmió mal")
- [ ] Recordatorio programado (ej: a los 2 meses de terminado el intensivo, reunirse con los papás)
- [ ] Mails predefinidos con formularios para evaluación, que al completarse queden en la ficha
- [ ] Formularios predefinidos

## 👪 Padres
- [ ] Links con cápsulas (videos) que tienen que ver

---

## Extra · hallazgos de auditoría (no los pidió Trini, mejoran la demo)

### Diseño (luki)
- [ ] Botones del modal sin estado `:active` (falta feedback al click)
- [ ] Radios hardcodeados en el Armador (8px/6px) → usar tokens
- [ ] Hero de la vista padres se ve plano (parece banner de alerta)
- [ ] Menores: `.cal-cell` sin `position:relative`, scrollbar 10px→6px, `nav-count` arranca en "—", `pulseSoft` anima con 0 pendientes

### Datos (nogalito)
- [x] SES-3601/3602: sala "Espejo" → "ESPEJO 2"
- [x] SES-0819: `tipo_actividad` coherente
- [ ] 5 niños con alta vencida pero estado Activo (decisión de Andy: dejar como ejemplo o marcar Egresado)
