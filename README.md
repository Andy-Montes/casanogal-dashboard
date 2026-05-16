# Casa Nogal · Sistema clínico

Dashboard web standalone para el sistema clínico de Casa Nogal (centro chileno de neurodesarrollo infantil especializado en TEA). Prototipo demostrativo con data sintética.

## Cómo correr en local

```bash
python -m http.server 8765
# abrir http://localhost:8765
```

O simplemente abrir `index.html` directo en el navegador (sirve si el browser permite `fetch` de archivos locales; si no, usar el server).

## Stack

Vanilla HTML/CSS/JS · sin build · sin dependencias · solo Google Fonts (Manrope + JetBrains Mono). Lee `data.json` con un `fetch`.

## Módulos

- **Calendario**: hero, 4 KPIs, grid 14 bloques × 5 días, drag&drop, conflictos, duplas
- **Fichas clínicas**: lista + ficha individual con 6 tabs (general, equipo, historial, objetivos, reuniones, documentos)
- **Reportes y boletas**: tabla con conteos para facturación
- **Equipo / Niños / Salas**: tablas con búsqueda
- **Roles**: Coordinación / Terapeuta (Krasna) / Padres (Carolina)

## Deploy

Drag-and-drop a Netlify, o conectar este repo a Netlify/Vercel. Sin pasos de build.

## Estructura

```
casanogal/
├── index.html
├── data.json          # data sintética (~66k líneas)
├── styles/
│   ├── tokens.css
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   └── modules.css
└── js/
    ├── state.js
    ├── data.js
    ├── ui.js
    ├── calendar.js
    ├── panel.js
    ├── modal.js
    ├── fichas.js
    ├── reportes.js
    ├── recursos.js
    └── main.js
```
