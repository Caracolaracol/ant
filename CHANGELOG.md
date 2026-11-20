# Changelog

Todos los cambios importantes de Ant quedan anotados aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones siguen
[Semantic Versioning](https://semver.org/lang/es/).

Para publicar una versión nueva: subir la versión en `package.json`,
`src-tauri/tauri.conf.json` y `src-tauri/Cargo.toml`, agregar su sección aquí y empujar la
etiqueta `vX.Y.Z`. El workflow `.github/workflows/release.yml` compila para macOS, Windows y
Linux y publica la versión con esta sección como notas.

## [Sin publicar]

## [0.2.0] - 2026-11-20

### Cambiado

- Ant está en inglés por defecto: menús, barra lateral, diálogos y Ajustes. El español se elige
  en Settings → General → Language.

### Agregado

- **Compilar y exportar** (File → Compile and Export…, Cmd+Shift+E): une las notas de una carpeta
  como capítulos de un libro y lo exporta a **Word** o **PDF**, sin programas externos. Se
  eligen qué notas van y en qué orden, título, autor, y el estilo: **manuscrito estándar** (Times
  12, doble espacio, encabezado «Apellido / Título / página», portada con conteo de palabras)
  o **libro** (A5, justificado, número de página al pie). El título de cada capítulo sale del
  primer `#` de la nota o del nombre del archivo; `***` marca un cambio de escena; lo que está
  entre `%% … %%` no se exporta; y se puede corregir la tipografía de todo el texto. Ant recuerda
  las opciones de cada carpeta.

- Ajustes divididos en áreas: **General** (idioma y carpeta de trabajo), **Editor**, **Diario**
  y **Apariencia** (Cmd+,).
- Modo escritor (Ajustes → Editor, activado por defecto): tipografía al escribir (comillas
  tipográficas “ ” o « » según el idioma, `--` → raya `—`, `...` → `…`, `<<` `>>` → `« »`,
  `->` `<-` → `→ ←`; Backspace justo después deshace el cambio y nada cambia dentro del código),
  letra de libro con serifa en una columna más angosta y corrector ortográfico. Cada parte se
  puede apagar por separado.
- La barra lateral se ensancha o achica arrastrando su borde derecho (el puntero cambia a ↔);
  el ancho se recuerda y doble clic en el borde vuelve al de siempre.
- Modo diario (Ajustes → Diario): muestra un calendario arriba de la barra lateral. Al hacer
  clic en un día se abre su nota, `Daily/AAAA-MM-DD.md` dentro de la carpeta de trabajo; si la
  nota o la carpeta `Daily` no existen, se crean; si ya hay una carpeta `Daily` (aunque esté
  escrita `daily`), se usa esa. Los días con nota llevan un punto. En este
  modo la carpeta `Daily` no aparece en el árbol: a las notas diarias se llega desde el
  calendario, y las abiertas se listan bajo él.
- Colores (Ajustes → Apariencia): temas listos (Dark/Oscuro, Ant/Hormiga, Night/Noche,
  Paper/Papel y Sepia) y cada
  color por separado. Los cambios se ven al instante en todas las ventanas.

## [0.1.0] - 2026-11-18

Primera versión pública.

### Agregado

- Editor de Markdown con CodeMirror 6: el texto se guarda tal cual se escribe, como archivos
  `.md` en disco, sin base de datos ni cuentas.
- Resaltado de Markdown y de los bloques de código.
- Buscar y reemplazar (Cmd+F), deshacer y rehacer con historial por nota.
- Barra lateral (`Cmd+\`) con:
  - «Fijados»: notas y carpetas fijadas arriba con clic derecho;
  - «Abiertas»: notas fuera de la carpeta o sin guardar;
  - el árbol de la carpeta de trabajo, con carpetas plegables;
  - los títulos de la nota activa, para saltar entre secciones.
- Varias notas abiertas a la vez; se pasa de una a otra con Cmd+Shift+] y Cmd+Shift+[.
- Barra de estado con palabras, líneas y caracteres.
- Ventana de Ajustes (Cmd+,) para elegir la carpeta de trabajo.
- Guardado atómico: la nota se escribe en un archivo temporal y se renombra, así nunca queda a
  medio guardar.
- Menú propio en español. Cmd+W no cierra la ventana principal, para no perder una nota sin
  guardar.
- Seleccionar arrastrando hasta el borde desplaza el texto en cada cuadro de pantalla, más
  rápido y sin saltos (parche a CodeMirror en `patches/`).
- Icono: cara de hormiga amarilla (`#e5ea15`) sobre fondo oscuro (`#1d1d20`).
- Descargas para macOS (universal: Apple Silicon e Intel), Windows y Linux.
- Sitio y documentación en inglés y español: https://caracolaracol.github.io/ant/
- Licencia MIT.

[Sin publicar]: https://github.com/Caracolaracol/ant/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Caracolaracol/ant/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Caracolaracol/ant/releases/tag/v0.1.0
