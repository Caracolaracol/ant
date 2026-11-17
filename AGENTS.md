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

## Estructura del proyecto

- `src/main.tsx` — punto de entrada; todas las ventanas cargan el mismo `index.html` y aquí se
  elige qué montar: `#ajustes` → `VentanaAjustes`, si no → `App`.
- `src/App.tsx` — ventana principal: lista de notas abiertas (`NotaResumen`: ruta, texto,
  cambios sin guardar), nota activa, carpeta de trabajo (de los ajustes), árbol de la carpeta
  (se relee al cambiar la carpeta, al guardar y al volver el foco a la ventana), barra de estado,
  título de la ventana y atajos (Cmd+N, Cmd+O, Cmd+S, Cmd+Shift+S, Cmd+Shift+] / [, `Cmd+\`).
- `src/BarraLateral.tsx` — barra lateral, de arriba abajo: «Fijados» (notas y carpetas fijadas
  con clic derecho → Fijar arriba, al estilo de Arc/Zen; lo fijado no se repite en el árbol),
  «Abiertas» (notas fuera de la carpeta o sin guardar) y el árbol de la carpeta de trabajo
  (carpetas plegables, notas abiertas con botón para cerrar). Bajo la nota activa, sus títulos.
  Los fijados se guardan en `Ajustes.fijados` y solo se muestran los que están dentro de la
  carpeta actual.
- `src/MenuContextual.tsx` — menú de clic derecho propio (se cierra con clic fuera, scroll o Escape).
- `src/marcadores.ts` — extrae los títulos `#`…`######` de una nota (ignorando bloques de código).
- `src/carpeta.ts` — tipo `Entrada` y llamadas a `listar_carpeta` y `abrir_ajustes`; utilidades
  de rutas (`estaDentro`, `carpetasPadre`).
- `src/ajustes.ts` — tipo `Ajustes` (igual al de Rust), leer, guardar y escuchar cambios.
- `src/ajustes/VentanaAjustes.tsx` y `.css` — ventana de Ajustes en dos columnas: áreas a la
  izquierda (`AREAS`) y el panel del área elegida a la derecha. Los cambios se guardan al instante.
  Para agregar un ajuste: campo en `Ajustes` (TS y Rust, con `#[serde(default)]`) y su control
  en el panel.
- `src/App.css` — variables de color del tema (`--fondo`, `--texto`, `--acento`, …) y la
  distribución. Para cambiar colores, tocar las variables, no los componentes.
- `src/editor/Editor.tsx` — monta CodeMirror 6 con historial, búsqueda (Cmd+F), Markdown y
  resaltado de bloques de código. Una sola vista para todas las notas: cada nota guarda su
  `EditorState` (texto, cursor, historial) y se intercambia al cambiar de nota. Expone
  `mostrar`, `olvidar`, `getText`, `irA` y `focus`.
- `src/editor/tema.ts` — tema de CodeMirror y colores del Markdown, leyendo las variables CSS.
- `src/notas.ts` — diálogos de abrir/guardar y llamadas a `read_note` / `write_note`.
- `src-tauri/src/lib.rs` — arma la app: plugin de diálogos, menú, comandos `read_note`,
  `write_note` (guardado atómico con archivo temporal + renombrar) y `abrir_ajustes`.
- `src-tauri/src/menu.rs` — menú propio en español (Ant con «Ajustes…» Cmd+, · Edición ·
  Ventana) y creación de la ventana de Ajustes (etiqueta `ajustes`). No incluye «Cerrar
  ventana»: Cmd+W no cierra la ventana principal.
- `src-tauri/src/ajustes.rs` — ajustes en `ajustes.json` de la carpeta de configuración de la
  app; al guardar emite `ajustes-cambiados` a todas las ventanas.
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

- `website/` — sitio en GitHub Pages (https://caracolaracol.github.io/ant/), hecho con Astro y
  npm (no pnpm; tiene su propio `package-lock.json`). Diseño horizontal con temática de
  hormiguero: cada `<section class="camara">` es una cámara del nido y todo se recorre de
  izquierda a derecha (la rueda vertical se traduce a horizontal en `layouts/Nido.astro`); no
  agregar scroll vertical a las páginas. Portada en `pages/index.astro` y documentación en
  `pages/documentacion.astro`: al cambiar algo de la app (atajos, ajustes, comandos),
  actualizar también la documentación. `npm run dev` / `npm run build` dentro de `website/`.
  Se publica solo con `.github/workflows/website.yml` al subir cambios a `main`.

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

## Git

- No agregar líneas `Co-Authored-By` de asistentes de IA en los commits ni en los PR.
