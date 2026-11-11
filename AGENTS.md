# Note Taking App

App de escritorio para tomar notas: simple, rápida y centrada en el texto.

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
- Gestor de paquetes: **pnpm**.

## Comandos

- `pnpm install` — instala las dependencias de la interfaz (las de Rust las baja Cargo solo).
- `pnpm tauri dev` — abre la app en desarrollo, con recarga en caliente de la interfaz.
- `pnpm build` — revisa los tipos y compila solo la interfaz (rápido para verificar cambios).
- `cd src-tauri && cargo check` — verifica que compile el lado Rust.
- `pnpm tauri build` — genera la app final (`.app` y `.dmg`) en `src-tauri/target/release/bundle/`.

## Estructura del proyecto

- `src/main.tsx` — punto de entrada; monta React.
- `src/App.tsx` — ventana principal: editor, barra de estado (nombre, cambios sin guardar,
  conteo de palabras/líneas/caracteres), título de la ventana y atajos de archivo
  (Cmd+N, Cmd+O, Cmd+S, Cmd+Shift+S).
- `src/App.css` — variables de color del tema (`--fondo`, `--texto`, `--acento`, …) y la
  distribución. Para cambiar colores, tocar las variables, no los componentes.
- `src/editor/Editor.tsx` — monta CodeMirror 6 con historial, búsqueda (Cmd+F), Markdown y
  resaltado de bloques de código; expone `setText`, `getText` y `focus`.
- `src/editor/tema.ts` — tema de CodeMirror y colores del Markdown, leyendo las variables CSS.
- `src/notas.ts` — diálogos de abrir/guardar y llamadas a los comandos Rust.
- `src-tauri/src/lib.rs` — comandos `read_note` y `write_note` (guardado atómico con archivo
  temporal + renombrar) y registro del plugin de diálogos.
- `src-tauri/tauri.conf.json` — nombre, identificador y ventana de la app.
- `src-tauri/capabilities/default.json` — permisos de la interfaz (`core`, `dialog`). Al
  agregar un plugin, sumar aquí su permiso.

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
