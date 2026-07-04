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
- [x] Mostrar cada reunión con el **registro de lo conversado** (acta, queda guardada ahí mismo)
- [x] Campo **link de la reunión** (Zoom/Meet) en el form + botón "Unirse a la reunión" en la tarjeta
- [ ] Integración directa con Zoom API para traer el resumen automático (por ahora se pega a mano en el acta) — a evaluar post-cierre

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

---

# 🆕 LOTE REUNIÓN TRINI · 2026-07-02 (1h41)

> Reunión de revisión de la demo completa. Andy prometió tener cambios "para mañana" (3-jul).
> Andy marcó estos como **los últimos cambios de la demo** antes de instalar en los sistemas de Casa Nogal.
> Fuente: `Downloads/why-oifr-mfa (2026-07-02 11_14 GMT-4) - Transcript.md`.

## 🩺 Ficha del paciente · Datos generales
- [x] Edad con **meses** (ej "5a 3m") — usa `_edadEn` contra HOY_ISO
- [x] Contacto separado: **mamá** (mail + teléfono) y **papá** (mail + teléfono), agrupados — modal Editar datos
- [x] Estado civil como **dropdown** — en modal Editar datos
- [x] Diagnóstico: **selección múltiple** + opción **"Otro"** (texto libre) — modal Editar datos (el filtro por diagnóstico ya existía)
- [x] Teléfono/email **clicables**: mail → correo; teléfono → WhatsApp (`_telLink`/`_mailLink`)
- [x] En listado de niños: columnas Madre/apoderada · Teléfono (clicable a WhatsApp) · Encargado (en vez de Inicio/Término)
- Persistencia: ediciones de niño en localStorage `casanogal_ninos_overrides` (Data.guardarNino), aplicadas en Data.load

## 📖 Ficha · Historia de Vida / por evento
- [x] Dentro de cada **intensivo / evaluación / seguimiento**: horario, terapeutas, objetivos, registro de atenciones, informes, reuniones, documentos (ya existía en `_seccionCiclos`)
- [x] Botón **EXPORTAR por evento** (a Word, adjuntable): en el evento en curso y en cada evento pasado del historial (`_exportarEvento`)

## 📝 Sesiones · Registro de atenciones
- [ ] Botón **DESCARGAR** registro de atenciones (para imprimir) + **FILTRO** por especialidad — Trini manda el formato/campos
- [x] Agregar tipos: **sesiones de papás** / **talleres grupales** / **coaching**: ya en `MODALIDADES` (state.js)
- [x] **Neurología semanal** (supervisión doctora): ya existe en `MODALIDADES` (state.js) y en el chooser del armador
- [~] Estado de sesión: agendada / realizada / no asistió / **suspendida** ya existen (panel.js); "asistido" vs "realizado" a confirmar con Trini si son distintos

## 🎯 Objetivos terapéuticos
- [~] Poder **escribir/editar** el objetivo en cada Objetivo 1-4 (lapicito) — se puede escribir objetivo propio por área en el banco; falta editar el enunciado del Objetivo N (rediseño sección)
- [x] **Banco de objetivos** ahora AGREGA de verdad (predefinido o propio) por área, persiste (`Data.agregarObjetivo`, localStorage `casanogal_objetivos_extra`), se elimina con ×

## 🗓️ Coordinación / Calendario
- [~] Botón **ELIMINAR sesión**: ya existe/funciona en el panel del calendario (admin). Falta el caso puntual en la vista Disponibilidad (misma zona del bug de arrastre)
- [x] Ordenar niños **alfabéticamente** en selectores (modal Nueva sesión + form Reunión; la banda de disponibilidad ordena intensivo-primero por diseño)
- [x] Alertas **descriptivas y propositivas** en Nueva sesión: dicen con quién choca el terapeuta / qué niño ocupa la sala + ofrecen los bloques libres del día (modal.js `_validate`). Las de reuniones en Disponibilidad ya nombraban a los ocupados
- [ ] **BUG**: el primer bloque / primera persona (Baltazar R) no se deja arrastrar
- [ ] Sesión de papás (psicología) que coincide con la del niño: sin horario paralelo (aparece en niño y/o papás)

## 🔗 Fuente de la verdad / propagación
- [ ] Coordinación = fuente de la verdad → cambios se reflejan **automáticos** en terapeuta/día/general; a **PADRES** preguntar "¿agregar este cambio al calendario de padres?" (Trini decide). A terapeutas sí o sí.

## 🏫 Salas / Disponibilidad
- [x] Indicador claro de **"qué semana estás viendo"** (badge "Semana del X al Y" en el título de Disponibilidad)
- [ ] Poder agregar **OBSERVACIÓN** a un niño agendado; que se refleje en horario del niño y del terapeuta (color/marca) — desde disponibilidad
- [ ] Colores de terapeutas **por área/especialidad** (no por niño) — Trini manda los colores (TO verde, FONO naranja, gris, etc.)

## 👩‍⚕️ Terapeuta (vista)
- [x] Vista terapeuta ve **notificaciones** (bandeja) + **chat** (puede mandar); NO ve enviar-aviso/reglas/mails (solo coordinación). Calendario y ficha ya los tenía

## 🔔 Notificaciones
- [x] **Bandeja de avisos recibidos** con no-leídos destacados (banner rojo) + botón **"Ya la leí"** + badge de conteo (`casanogal_notif_inbox`); enviar aviso lo agrega a la bandeja
- [ ] Automáticas: niño no asiste → avisar equipo; cambio de horario → avisar terapeuta afectado; mensaje a los que faltaron/atrasaron
- [ ] Chat de equipo: **login con Google/Gmail** (probar con cuentas distintas; hoy es demo)

## 👪 Padres (vista)
- [x] **Ocultar ficha clínica** a padres (sacada del sidebar + redirect a comunicación si intenta entrar)
- [ ] Solo: calendario, cápsulas, órdenes médicas, informes (lo demás ya estaba)
- [ ] En calendario de papás salen: observaciones, talleres, coaching, psicología (con hijo / solo ellos) — coherencia con lo generado
- [x] Botón **"Agregar a calendario"**: link a Google Calendar por sesión + descarga `.ics` de toda la semana (sirve iPhone/Google) en la vista padres

## 📊 Reporte / Asistencia terapeutas
- [ ] **BUG**: tabla de equipo (planta 40) quedó angosta/corrida
- [x] Estados: presente (default), atrasado, se fue antes, faltó + **permiso, día administrativo, vacaciones, cumpleaños** (detalle de terapeuta)
- [x] **% terapia efectiva por HORAS del terapeuta**: solo las **realizadas** cuentan (faltó/suspendida no); chip muestra "efectivas de N agendadas" + reuniones aparte + "% horas efectivas" sobre capacidad (recursos.js `_terapeutaMetricas`)
- [x] Reporte **por terapeuta** (Carga por terapeuta en Reportes): terapias efectivas + reuniones, ordenado de más a menos cargado

## 🧩 Armador de Horario (lo más grande)
- [~] Armador para **TODO**: "Agregar niño" ahora tiene selector de instancia **intensivo / atención continua / evaluación** + se guarda y se muestra en la tarjeta. FALTA que el motor arme distinto por instancia (evaluación con estructura Dra Lorena) — rediseño profundo del scheduler
- [x] **Selector de fecha de inicio** en el form de agregar niño (para el próximo intensivo sin pisar el actual)
- [x] Crear niño nuevo desde **fichas** (botón "Crear niño": nombre, fecha nac, papás, instancia de ingreso) → abre su ficha para diagnosticar. Persiste en `casanogal_ninos_creados` (Data.crearNino)
- [x] **Selector de fecha de inicio** en el form de agregar niño (ver arriba); término por instancia queda para el motor
- [ ] Crear intensivo con **TODOS los niños de una** (hasta ~9) y recién generar (el motor los piensa juntos, no uno por uno)
- [ ] Intensivos correlativos archivados/consultables (40/41) + **RESUMEN del intensivo** (quiénes participaron, cumplimiento) + fecha
- [ ] Duplas/grupos **unificados dentro del armador** (ya hay creador; integrarlo mejor)
- [~] **Regla por día por terapeuta**: cada día → programa (evaluación/intensivo/continuo). ✅ UI hecha en **Config → Editar profesional** (`programa_por_dia`, selector Lun-Vie). Falta que el motor del Armador la aplique (necesita puente sigla↔terapeuta, va en el rediseño del Armador)
- [ ] Restricción **máx 2 observaciones por sala TO** (regla); poder agregar restricciones nuevas; regla break 10:00 (opcional)
- [ ] **Evaluación**: 2 sesiones/sem (lun+mié cambiables). Estructura: reunión ingreso (Lorena), evaluación presencial (Lorena+psicóloga+cognitivo+fono), devolución (Lorena). Todo se agenda en el horario y en la agenda de Lorena
- [ ] Al crear evaluación/niño: mandar **formularios predefinidos + horario por mail**; formularios se llenan en línea y quedan **linkeados en la ficha** (Trini manda formularios vacíos; Andy prueba con su Drive)
- [ ] Vaciar el armador de data simulada para probarlo limpio

## 🌐 Infra / cierre (fuera de demo)
- [ ] Login con Google (ley de protección de datos, registro de accesos)
- [ ] Comprar dominio (ej panel.casanogal.com)
- [ ] Responsive / PWA (icono en celular, papás y terapeutas; terapeuta registra desde el celular)
- [ ] Carga masiva de fichas al concretar
