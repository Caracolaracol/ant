# Ant

Ant: app de escritorio para tomar notas, simple, rápida y centrada en el texto.

## Referencia

El punto de partida es **Left** (`/Applications/Left.app`, de Hundred Rabbits, código en
`Contents/Resources/app/`). De Left tomamos la idea, no el código:

- Una sola ventana con un área de texto a pantalla completa y una barra lateral de navegación
  (archivos abiertos y marcadores `#`/`##` del documento).
- Las notas son archivos de texto plano en disco, sin base de datos.
- Barra de estado con conteo de palabras, líneas y caracteres.
- Todo se maneja con atajos de teclado (nuevo, abrir, guardar, buscar, reemplazar, ir a línea,
  siguiente/anterior archivo o marcador, tamaño de letra, modo lectura).
- Temas de color definidos con pocas variables.

Left está hecho con Electron 7 y pesa ~150 MB; esta app debe ser bastante más liviana y rápida.

## Stack

- **Tauri 2**: la ventana de escritorio. Usa el WebView del sistema en vez de traer Chromium, así
  la app pesa unos MB y no ~150 MB como Left. El lado Rust (`src-tauri/`) se encarga del disco
  (abrir, guardar, vigilar la carpeta de notas), los menús y los atajos globales.
- **CodeMirror 6**: el editor de texto. Las notas se guardan como Markdown/texto plano, tal cual
  se escriben, sin conversiones. Partimos mostrando el Markdown a la vista (como Left) y más
  adelante se puede agregar una vista previa en vivo estilo Obsidian con decoraciones de
  CodeMirror.
- **React + TypeScript + Vite**: la interfaz que rodea al editor (barra de estado y, más
  adelante, navegación, ajustes, etc.). CodeMirror maneja su propio DOM: React no debe
  re-renderizar el texto en cada tecla; se habla con el editor por la ref `EditorHandle`.
  Tampoco guardar en el estado de React lo que cambia en cada movimiento (como la posición del
  cursor al seleccionar con el mouse): va en una ref, y solo se actualiza el estado cuando cambia
  algo visible. Lo que recorre la nota entera (conteo, títulos) va con `useMemo` sobre el texto.
- Gestor de paquetes: **pnpm**.

## Comandos

- `pnpm install` — instala las dependencias de la interfaz (las de Rust las baja Cargo solo).
- `pnpm tauri dev` — abre la app en desarrollo, con recarga en caliente de la interfaz.
- `pnpm build` — revisa los tipos y compila solo la interfaz (rápido para verificar cambios).
- `cd src-tauri && cargo check` — verifica que compile el lado Rust.
- `pnpm tauri build` — genera la app final (`.app` y `.dmg`) en `src-tauri/target/release/bundle/`.
- Publicar una versión: subir la versión en `package.json`, `src-tauri/tauri.conf.json` y
  `src-tauri/Cargo.toml`, mover lo de «Unreleased» a una sección nueva en `CHANGELOG.md`,
  y empujar la etiqueta `vX.Y.Z`. `.github/workflows/release.yml` compila en macOS (universal),
  Windows y Linux, crea la versión como borrador con esa sección del CHANGELOG como notas y la
  publica si compilaron los tres. La app no está firmada (en macOS, firma ad-hoc `-`).
- Anotar en `CHANGELOG.md` («Unreleased») cada cambio visible para quien usa la app, **siempre en
  inglés**: esa sección son las notas de la versión en GitHub.

## Estructura del proyecto

- `src/main.tsx` — punto de entrada; todas las ventanas cargan el mismo `index.html` y aquí se
  elige qué montar: `#ajustes` → `VentanaAjustes`, si no → `App`. Aplica colores e idioma
  antes de montar y cada vez que cambian los ajustes.
- `src/App.tsx` — ventana principal: lista de notas abiertas (`NotaResumen`: ruta, texto,
  cambios sin guardar), nota activa, carpeta de trabajo (de los ajustes), árbol de la carpeta
  (se relee al cambiar la carpeta, al guardar y al volver el foco a la ventana), barra de estado,
  título de la ventana y atajos (Cmd+N, Cmd+O, Cmd+S, Cmd+Shift+S, Cmd+Shift+] / [, `Cmd+\`).
- `src/BarraLateral.tsx` — barra lateral, de arriba abajo: «Fijados» (notas y carpetas fijadas
  con clic derecho → Fijar arriba, al estilo de Arc/Zen; lo fijado no se repite en el árbol),
  «Abiertas» (notas fuera de la carpeta o sin guardar) y el árbol de la carpeta de trabajo
  (carpetas plegables, notas abiertas con botón para cerrar). Bajo la nota activa, sus títulos.
  Los fijados se guardan en `Ajustes.fijados` y solo se muestran los que están dentro de la
  carpeta actual. El ancho se cambia arrastrando el borde derecho (`.barra-tirador`, invisible,
  puntero `col-resize`); se guarda en `Ajustes.ancho_barra` al soltar.
- `src/Calendario.tsx` — calendario del modo diario (arriba de la barra lateral, si
  `Ajustes.diario`): un mes, semana desde el lunes, punto en los días con nota. Con el modo
  diario activo, `BarraLateral` esconde `Daily/` del árbol y lista bajo el calendario las notas
  diarias abiertas.
- `src/diario.ts` — fechas `AAAA-MM-DD`, título inicial de cada nota diaria, días con nota
  (desde el árbol) y llamada a `abrir_dia`. Las notas diarias van en `Daily/` de la carpeta de trabajo.
- `src/idioma.tsx` — textos de la interfaz en inglés (por defecto) y español. Los componentes
  los leen con `useTextos()`; `main.tsx` provee `ContextoTextos` según `Ajustes.idioma`. Todo
  texto visible nuevo va aquí, en los dos idiomas (los comentarios del código siguen en español).
- `src/colores.ts` — variables de color que se pueden cambiar, temas listos (`TEMAS`) y
  `aplicarColores`, que `main.tsx` llama en cada ventana al abrirla y al cambiar los ajustes.
- `src/MenuContextual.tsx` — menú de clic derecho propio (se cierra con clic fuera, scroll o Escape).
- `src/marcadores.ts` — extrae los títulos `#`…`######` de una nota (ignorando bloques de código).
- `src/carpeta.ts` — tipo `Entrada` y llamadas a `listar_carpeta` y `abrir_ajustes`; utilidades
  de rutas (`estaDentro`, `carpetasPadre`).
- `src/ajustes.ts` — tipo `Ajustes` (igual al de Rust), leer, guardar y escuchar cambios.
- `src/ajustes/VentanaAjustes.tsx` y `.css` — ventana de Ajustes en dos columnas: áreas a la
  izquierda (`AREAS`: General —idioma y carpeta—, Editor —modo escritor—, Diario, Apariencia) y el panel del área elegida a la derecha. Los cambios se guardan al instante.
  Para agregar un ajuste: campo en `Ajustes` (TS y Rust, con `#[serde(default)]`) y su control
  en el panel.
- `src/App.css` — variables de color del tema (`--fondo`, `--texto`, `--acento`, …) y la
  distribución. Para cambiar colores, tocar las variables, no los componentes. Los colores que
  elige el usuario (`Ajustes.colores`) pisan estas variables; un tema nuevo va en `TEMAS`.
- `src/editor/Editor.tsx` — monta CodeMirror 6 con historial, búsqueda (Cmd+F), Markdown y
  resaltado de bloques de código. Una sola vista para todas las notas: cada nota guarda su
  `EditorState` (texto, cursor, historial) y se intercambia al cambiar de nota. Expone
  `mostrar`, `olvidar`, `getText`, `irA` y `focus`.
- `src/editor/escritor.ts` — modo escritor (Ajustes → Editor, activo por defecto): reemplazos
  tipográficos al teclear (`reemplazo`, probada aparte), Backspace que los deshace, letra de
  libro y corrector. Va en un `Compartment` de `Editor.tsx` (prop `escritor`); nunca toca texto
  ya escrito ni código, HTML, URLs o el encabezado YAML.
- `src/editor/tema.ts` — tema de CodeMirror y colores del Markdown, leyendo las variables CSS.
- `src/compilar/` — «Compilar y exportar» (menú File, Cmd+Shift+E; Rust emite
  `abrir-compilar` y `App` abre el diálogo). Sin dependencias ni programas externos:
  - `Compilar.tsx` y `.css` — el diálogo: carpeta, capítulos (incluir, ordenar), título, autor,
    formato, estilo y opciones; recuerda todo por carpeta en `Ajustes.compilaciones`.
  - `modelo.ts` — Markdown → libro (capítulos, párrafos con estilos, títulos, escenas) con el
    analizador de Lezer; cada línea es un párrafo, `%% %%` y YAML se omiten, tipografía opcional.
  - `docx.ts` — Word escrito a mano (WordprocessingML), con estilos de Word (Title, Heading 1…).
  - `pdf.ts` — PDF escrito a mano con las fuentes Times de PDF (sin incrustar): maquetación,
    justificado, huérfanas, encabezado o folio. `metricas.ts` tiene los anchos (AFM de Adobe).
  - `formato.ts` — estilos «manuscrito» y «libro», tamaños de página y textos de portada.
  - `zip.ts` — ZIP mínimo (CRC-32, `CompressionStream`) para el .docx.
  Para probar sin la app: `node --experimental-strip-types` puede importar estos módulos (usan
  `.ts` explícito), y `prueba/compilar.html` muestra el diálogo con datos de ejemplo.
- `src/notas.ts` — diálogos de abrir/guardar y llamadas a `read_note` / `write_note`.
- `src-tauri/src/lib.rs` — arma la app: plugin de diálogos, menú, comandos `read_note`,
  `write_note` (guardado atómico con archivo temporal + renombrar), `abrir_ajustes`,
  `guardar_binario` (bytes crudos en el cuerpo y la ruta en el encabezado `ruta`) y
  `mostrar_en_carpeta`.
- `src-tauri/src/menu.rs` — menú propio en inglés o español según `Ajustes.idioma` (Ant con
  «Settings…» Cmd+, · File con «Compile and Export…» Cmd+Shift+E · Edit · Window); `cambiar_idioma` lo rehace al guardar otro idioma y creación de la ventana de Ajustes (etiqueta `ajustes`). No incluye «Cerrar
  ventana»: Cmd+W no cierra la ventana principal.
- `src-tauri/src/ajustes.rs` — ajustes en `ajustes.json` de la carpeta de configuración de la
  app; al guardar emite `ajustes-cambiados` a todas las ventanas.
- `src-tauri/src/diario.rs` — `abrir_dia`: usa la carpeta `Daily` que ya exista (sin importar
  mayúsculas) o la crea, y crea `AAAA-MM-DD.md` si no existe
  (nunca pisa una nota) y devuelve la ruta. Solo acepta fechas `AAAA-MM-DD`. Tiene tests (`cargo test`).
- `src-tauri/src/carpeta.rs` — `listar_carpeta`: árbol de notas (.md, .markdown, .txt),
  sin ocultas, `node_modules` ni `target`, omitiendo carpetas sin notas.
- `src-tauri/tauri.conf.json` — nombre, identificador y ventana principal. La barra de título
  nativa está oculta (`titleBarStyle: "Overlay"`, `hiddenTitle`): los botones de la ventana
  flotan sobre la franja `.arrastre`, que sirve para arrastrarla.
- `src-tauri/capabilities/default.json` — permisos de las ventanas `main` y `ajustes`. Al
  agregar un plugin o una ventana, sumarlos aquí.

- `patches/` — parches de dependencias (`pnpm patch`, registrados en `pnpm-workspace.yaml`).
  `@codemirror/view`: al seleccionar arrastrando hasta el borde, CodeMirror desplaza a saltos
  cada 50 ms (`setInterval`, ~20 fps, se ve entrecortado); el parche lo hace en cada cuadro con
  `requestAnimationFrame`, y 2,5 veces más rápido (`VELOCIDAD_ARRASTRE`). Al actualizar `@codemirror/view` hay que rehacer el parche
  (`pnpm patch @codemirror/view@<versión>`, buscar `Parche de Ant` en `dist/index.js` y `.cjs`).
- `prueba/editor.html` — página de prueba fuera de Tauri (`pnpm dev`, luego
  `http://localhost:1420/prueba/editor.html`): el mismo editor con una nota larga, medidor de
  fps y casillas para apagar extensiones. Sirve para comparar motores (Safari/Chrome/Firefox).
- `prueba/compilar.html` — el diálogo «Compilar y exportar» con una carpeta de ejemplo (`?es` en
  español, `?libro` con opciones guardadas). Para revisar su diseño; exportar no funciona fuera de Tauri.

- `website/` — sitio en GitHub Pages (https://caracolaracol.github.io/ant/), hecho con Astro y
  npm (no pnpm; tiene su propio `package-lock.json`). `npm run dev` / `npm run build` dentro de
  `website/`. Se publica solo con `.github/workflows/website.yml` al subir cambios a `main`.
  - **Idiomas**: inglés por defecto (`/ant/`, `/ant/documentation/`) y español bajo `/ant/es/`,
    con selector EN / ES. Los textos de los dos idiomas van juntos en cada componente con
    `t('english', 'español')` (`lib/sitio.ts`); las páginas de `pages/` solo eligen el idioma.
  - **Mensaje**: Ant es un lugar simple, inteligente y sin distracciones para escribir: primero
    para escritores (cuentos, novelas), luego para cualquiera que tome notas y para
    desarrolladores. Left se puede mencionar como inspiración (con crédito a Hundred Rabbits), pero
    nunca como competencia ni en comparaciones.
  - **Portada** (`components/Portada.astro`): horizontal, temática de hormiguero. Cada
    `<section class="camara">` es una cámara unida por un túnel y se recorre de izquierda a
    derecha (la rueda vertical se traduce a horizontal en `layouts/Nido.astro`); no agregarle
    scroll vertical.
  - **Documentación** (`components/Documentacion.astro`): vertical, una sola cámara gigante
    (`.hueco.gigante`) pegada a los bordes de la ventana, con índice fijo y un tema tras otro.
    Al cambiar algo de la app (atajos, ajustes, comandos), actualizarla en los dos idiomas.
  - Los bordes de las cámaras y del túnel son imperfectos, como cavados: los dibuja
    `lib/cavar.ts` en SVG (con semilla fija por cámara); sin JavaScript quedan los bordes
    redondeados del CSS.
  - La tierra de fondo es `src/assets/tierra.svg`: granos y piedritas al azar (semilla fija) que
    genera `website/scripts/tierra.mjs`; para cambiarla, editar el script y correrlo con node.

- `marca/` — icono de la app (cara de hormiga plana en SVG, PNG de 1024 y script); ver `marca/README.md` para
  regenerar `src-tauri/icons/`. Sigue el sistema visual de Mantis (`~/Code/meeting-recorder`).

Mantener esta sección al día cuando se agreguen carpetas o módulos.

## Comentarios en el código

- Al inicio de cada archivo, un comentario que diga qué hace ese archivo y qué papel cumple en la app.
- Sobre cada función, componente y bloque no trivial, un comentario que explique qué hace y,
  cuando no sea obvio, por qué lo hace así.
- Escribe los comentarios en español.
- Cuando modifiques código, actualiza sus comentarios para que sigan describiendo lo que el
  código hace realmente.

## Licencia

- MIT (`LICENSE`), © 2026 Agustin Rojas. También declarada en `package.json`,
  `website/package.json` y `src-tauri/Cargo.toml`.

## Git

- No agregar líneas `Co-Authored-By` de asistentes de IA en los commits ni en los PR.
