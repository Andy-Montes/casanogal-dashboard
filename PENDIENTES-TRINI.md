# Casa Nogal · Checklist de observaciones de Trini

> Estado al **2026-06-25**. Marco `[x]` lo desplegado, `[~]` lo parcial/maquetado, `[ ]` lo pendiente.
> Deploy: https://casanogal.vercel.app (recordar Ctrl+Shift+R para botar caché).

---

## 🩺 Ficha del paciente · Datos generales
- [x] Edad al lado de la fecha de nacimiento
- [x] Papá **y** mamá por separado (no solo un apoderado)
- [x] Estado civil de los padres
- [~] Diagnóstico como lista desplegable + opción "Otro" (nombre libre) + permitir **varios** diagnósticos (el filtro ya soporta múltiples; falta el formulario de edición con "Otro")
- [x] Filtrar pacientes por diagnóstico
- [x] Descargar ficha completa de un paciente (botón Exportar → Word)
- [x] Descargar fichas de **todos** los pacientes (botón "Descargar todas")

## 🗓️ Ficha del paciente · Horario de la semana
- [x] Mostrar la **sala** además de la sesión y el terapeuta

## 📖 Ficha del paciente · Historia de Vida
- [x] Definir qué se ve dentro de cada intensivo: horario, terapeutas, objetivos trabajados, registro de atenciones, informes, reuniones y documentos subidos

## 📝 Sesiones
- [x] Renombrar estado "Cancelada" → "Suspendida"
- [x] Descargar **todos** los registros de atención juntos (día / semana / intensivo) tipo Word: fecha, hora, terapeuta y registro
- [x] Nuevos tipos de sesión: **papás solos** (psicología), **talleres grupales**, **coaching** (selector Modalidad en Nueva sesión + se ve en el panel)
- [x] Sesión de **neurología semanal** en los intensivos (supervisión de la dra) — disponible como modalidad

## 🎯 Objetivos terapéuticos
- [x] Reestructurar a **Objetivo 1 / 2 / 3 / 4** (no por área)
- [x] Dentro de cada objetivo, 5 subcategorías CIF: Funciones Corporales, Estructuras Corporales, Actividades, Participación, Ambiente
- [x] Banco de objetivos predefinido para elegir

## 🤝 Reuniones
- [x] Mostrar cada reunión con el **registro de lo conversado** (queda guardado ahí mismo)

## ⚙️ Configuración
- [x] Bug: el modal de "modificar profesional" no cabía en pantalla → ahora con scroll

## 🧩 Armador de Horario
- [x] Preferencia de inicio por niño (ej: "partir con TO") — campo en el formulario del niño
- [~] Duplas / grupos: dupla de terapeutas, dupla de niños, grupal — capturado como "Modalidad" en el formulario (falta soporte pleno en el motor de asignación)
- [~] Restricción: máximo 2 observaciones por sala de TO — campo en el panel (regla, no forzada en el solver)
- [x] Restricción: máximo 4 niños en sala TO1 y 2 niños en TO2 — cupos editables que usa el motor
- [x] Poder ir agregando restricciones nuevas cuando se necesite — restricciones en texto libre
- [ ] Terapeuta: un día para intensivo y otro para seguimiento
- [x] Poder armar otro horario mientras un intensivo está en curso / "Intensivo 41" navegable — selector de intensivo (40 actual / 41 en blanco), el 40 queda intacto
- [x] Qué pasa con los horarios pasados cuando termina un intensivo — quedan archivados; cada intensivo es navegable por separado

## 👩‍⚕️ Terapeutas
- [x] Explicar/mostrar cómo quedan marcadas las observaciones en su horario (nota en el detalle)
- [x] Registrar asistencia del terapeuta: faltó / llegó tarde / se fue temprano (detalle de terapeuta, por día)
- [x] % de tiempo en terapias efectivas vs reuniones (con tope, ej. no más de 80%) — columna "Carga semana" + detalle

## 🔔 Notificaciones (módulo maquetado)
- [x] Sistema de notificaciones a terapeutas (o a quien se elija)
- [x] Avisos automáticos: niño no asiste → avisar a su equipo; cambio de horario → avisar al terapeuta (reglas con toggle)
- [x] Tipo chat para mensajes al equipo (ej: "viene cansado, durmió mal")
- [x] Recordatorio programado (ej: a los 2 meses de terminado el intensivo, reunirse con los papás) — como regla
- [x] Mails predefinidos con formularios para evaluación, que al completarse queden en la ficha
- [x] Formularios predefinidos

## 👪 Padres
- [x] Links con cápsulas (videos) que tienen que ver

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
