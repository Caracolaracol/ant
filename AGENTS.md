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

- `src/main.tsx` — punto de entrada: lee los ajustes y monta `App` (la app tiene una sola
  ventana; Ajustes, la bienvenida y los diálogos se abren dentro). Aplica colores e idioma
  antes de montar y cada vez que cambian los ajustes.
- `src/App.tsx` — ventana principal: lista de notas abiertas (`NotaResumen`: ruta, texto,
  cambios sin guardar), nota activa, hormiguero abierto (`Ajustes.carpeta`) y su árbol (se relee
  al cambiar de hormiguero, al guardar y al volver el foco a la ventana), barra de estado,
  título de la ventana y atajos (Cmd+N, Cmd+O, Cmd+S, Cmd+Shift+S, Cmd+Shift+] / [, `Cmd+\`).
  Una sola nota con archivo abierta a la vez (`dejarSola`): abrir otra guarda y cierra la
  anterior; solo quedan abiertas las notas nuevas con algo escrito. Guardado automático
  (`guardarYa`): tras `PAUSA_GUARDADO` sin escribir, al cambiar de nota, al perder el foco, al
  cerrar la ventana y al salir (Rust avisa con `antes-de-salir` y espera a `salir`, ver `lib.rs`).
  Cada nota recuerda `textoQueHayEnDisco`: antes de guardar se relee el archivo y, si cambió
  fuera de Ant, no se pisa (avisa; Cmd+S fuerza). Al volver el foco, las notas cuyo archivo
  cambió fuera se recargan (`recargarNotasCambiadasFueraDeAnt`). Las notas con archivo tienen
  id fijo por ruta (`idDeNotaConArchivo`), así el editor las reconoce al volver a abrirlas.
  Encima abre la bienvenida (sin hormigueros, o con el evento `abrir-bienvenida`), los Ajustes
  (`abrir-ajustes`), «Hormiguero nuevo» (`nuevo-hormiguero`) y «Compilar y exportar»
  (`abrir-compilar`): eventos que manda Rust desde el menú.
- **Hormigueros** (los «vaults»): cada uno es una carpeta del usuario; puede tener todos los que
  quiera (`Ajustes.hormigueros`) y la barra muestra el abierto (`Ajustes.carpeta`). Se cambia
  de uno a otro en Ajustes → General y se cava uno nuevo con File → New Anthill… o desde ahí. Los ajustes
  de antes (solo `carpeta`) se convierten solos en un hormiguero al leerlos (Rust).
  - `src/hormigueros/hormigueros.ts` — crear la carpeta (`crear_hormiguero`), elegir una que
    existe, y los cambios de ajustes para abrir o quitar uno (quitar no borra la carpeta).
  - `src/hormigueros/ElegirHormiguero.tsx` — formulario: crear una carpeta nueva (nombre y
    dónde, Documentos por defecto) o usar una que existe. Lo usan la bienvenida y
    `NuevoHormiguero.tsx` (ventanita «Hormiguero nuevo»). Estilos en `Hormigueros.css`.
- `src/bienvenida/` — bienvenida (onboarding) con el diseño del sitio: cámaras unidas por un
  túnel que se recorre en horizontal (una por página: Ant, archivos, hormigueros y cavar el
  primero), la hormiga y los hoyos abajo, y EN / ES arriba. Reusa del sitio
  `website/src/lib/cavar.ts` (bordes cavados) y `website/src/assets/tierra.svg`: si se cambian
  allá, revisar también la bienvenida. `prueba/bienvenida.html` la muestra fuera de Tauri.
- `src/BarraLateral.tsx` — barra lateral, minimalista a propósito (cambiar de hormiguero va en
  Ajustes, no aquí), de arriba abajo: el calendario si hay modo diario, los fijados, «Abiertas»
  (notas fuera del hormiguero o sin guardar) y el hormiguero abierto, con su nombre y su árbol
  (carpetas plegables, notas abiertas con botón para cerrar). Bajo la nota activa, sus títulos.
  Los fijados (clic derecho → Fijar arriba en una carpeta, nota o título) son una grilla de
  iconos sin texto, al estilo de Zen/Arc, con el nombre en un globo (`Globo.tsx`) al pasar el
  mouse; clic derecho → Cambiar icono… (`ElegirIcono.tsx`). Una carpeta fijada se despliega
  bajo la grilla (sola, si contiene la nota activa); lo fijado no se repite en el árbol. Se
  guardan en `Ajustes.fijados` (ver `src/fijados.ts`) con su icono en `Ajustes.iconos`, y solo
  se muestran los del hormiguero abierto. El ancho se cambia arrastrando el borde derecho
  (`.barra-tirador`, invisible, puntero `col-resize`); se guarda en `Ajustes.ancho_barra` al soltar.
  `prueba/barra.html` la muestra con fijados de ejemplo (y los Ajustes, `?ajustes`).
- `src/fijados.ts` — clave de cada fijado (ruta, o `ruta#título` para un capítulo) e icono por
  defecto de cada tipo.
- `src/iconos.ts` — iconos que se pueden elegir para los fijados: una selección de Lucide
  (ISC) copiada aquí, por grupos; `src/Icono.tsx` los dibuja.
- `src/Calendario.tsx` — calendario del modo diario (arriba de la barra lateral, si
  `Ajustes.diario`): un mes, semana desde el lunes, punto en los días con nota. Con el modo
  diario activo, `BarraLateral` esconde `Daily/` del árbol y muestra bajo el calendario la
  nota diaria abierta.
- `src/diario.ts` — fechas `AAAA-MM-DD`, título inicial de cada nota diaria, días con nota
  (desde el árbol) y llamada a `abrir_dia`. Las notas diarias van en `Daily/` del hormiguero abierto.
- `src/idioma.tsx` — textos de la interfaz en inglés (por defecto) y español. Los componentes
  los leen con `useTextos()`; `main.tsx` provee `ContextoTextos` según `Ajustes.idioma`. Todo
  texto visible nuevo va aquí, en los dos idiomas (los comentarios del código siguen en español).
- `src/colores.ts` — variables de color que se pueden cambiar, temas listos (`TEMAS`) y
  `aplicarColores`, que `main.tsx` llama al abrir la app y al cambiar los ajustes.
- `src/MenuContextual.tsx` — menú de clic derecho propio (se cierra con clic fuera, scroll o Escape).
- `src/marcadores.ts` — extrae los títulos `#`…`######` de una nota (ignorando bloques de código).
- `src/carpeta.ts` — tipo `Entrada` y llamada a `listar_carpeta`; utilidades de rutas
  (`estaDentro`, `carpetasPadre`, `ltr` para mostrar rutas cortadas por el principio).
- `src/ajustes.ts` — tipo `Ajustes` (igual al de Rust), leer, guardar y escuchar cambios.
- `src/ajustes/ModalAjustes.tsx` y `.css` — Ajustes como ventanita sobre la principal (no es
  otra ventana), en dos columnas: áreas a la izquierda (`AREAS`: General —idioma y
  hormigueros—, Editor —modo escritor—, Diario, Apariencia) y el panel del área elegida a la
  derecha. Los cambios se guardan al instante; Escape, Cmd+W o clic fuera la cierran. El marco
  de las ventanitas (`.modal-fondo`, `.modal`) está en `App.css`.
  Para agregar un ajuste: campo en `Ajustes` (TS y Rust, con `#[serde(default)]`) y su control
  en el panel.
- `src/App.css` — variables de color del tema (`--fondo`, `--texto`, `--acento`, …) y la
  distribución. Para cambiar colores, tocar las variables, no los componentes. Los colores que
  elige el usuario (`Ajustes.colores`) pisan estas variables; un tema nuevo va en `TEMAS`.
- `src/editor/Editor.tsx` — monta CodeMirror 6 con historial, búsqueda (Cmd+F), Markdown y
  resaltado de bloques de código. Una sola vista para todas las notas: cada nota guarda su
  `EditorState` (texto, cursor, historial) y se intercambia al cambiar de nota; se recuerdan
  hasta `LIMITE_DE_NOTAS_RECORDADAS` notas aunque estén cerradas. Expone (`ControlDelEditor`)
  `mostrarNota`, `olvidarNota`, `obtenerTextoDeNota`, `reemplazarTextoDesdeDisco` (cambio mínimo,
  fuera del historial y sin avisar como si se hubiera escrito), `llevarCursorA` y `enfocar`.
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
- `src-tauri/src/lib.rs` — arma la app: plugin de diálogos, menú (cada ítem propio emite su
  evento a la ventana principal), comandos `read_note`, `write_note` (guardado atómico con
  archivo temporal + renombrar), `guardar_binario` (bytes crudos en el cuerpo y la ruta en el
  encabezado `ruta`), `mostrar_en_carpeta` y `salir`. Al pedir salir (Cmd+Q, Dock) no sale
  enseguida: emite `antes-de-salir` para que la interfaz guarde, y sale cuando llama a `salir`
  (o a los 3 s).
- `src-tauri/src/menu.rs` — menú propio en inglés o español según `Ajustes.idioma` (Ant con
  «Welcome to Ant…» y «Settings…» Cmd+, · File con «New Anthill…» y «Compile and Export…»
  Cmd+Shift+E · Edit · Window); `EVENTOS` dice qué evento emite cada ítem y `cambiar_idioma`
  lo rehace al guardar otro idioma. No incluye «Cerrar ventana»: Cmd+W no cierra la ventana
  principal.
- `src-tauri/src/ajustes.rs` — ajustes en `ajustes.json` de la carpeta de configuración de la
  app, escritos con `escribir_atomico`; al guardar emite `ajustes-cambiados`. Si el archivo está
  dañado, guarda una copia (`ajustes-ilegibles.json`) antes de usar los valores por defecto. Al leer, la `carpeta` de versiones anteriores pasa
  a la lista de hormigueros (con test).
- `src-tauri/src/diario.rs` — `abrir_dia`: usa la carpeta `Daily` que ya exista (sin importar
  mayúsculas) o la crea, y crea `AAAA-MM-DD.md` si no existe
  (nunca pisa una nota) y devuelve la ruta. Solo acepta fechas `AAAA-MM-DD`. Tiene tests (`cargo test`).
- `src-tauri/src/carpeta.rs` — `listar_carpeta`: árbol de notas (.md, .markdown, .txt),
  sin ocultas, `node_modules` ni `target`, omitiendo carpetas sin notas. `crear_hormiguero`:
  crea la carpeta de un hormiguero nuevo (nunca usa una que ya existe; con test).
- `src-tauri/tauri.conf.json` — nombre, identificador y ventana principal. La barra de título
  nativa está oculta (`titleBarStyle: "Overlay"`, `hiddenTitle`): los botones de la ventana
  flotan sobre la franja `.arrastre`, que sirve para arrastrarla.
- `src-tauri/capabilities/default.json` — permisos de la ventana `main` (la única). Al
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

## Interfaz

- Simple y minimalista: la ventana principal es para escribir. Lo que no es escribir (cambiar
  de hormiguero, opciones, modos) va en Ajustes o en el menú, no como botones en la barra
  lateral, el editor o la barra de estado. No agregar barras de herramientas ni selectores.

## Nombres en el código

- Variables, constantes, funciones, componentes, tipos y archivos con nombres **descriptivos**,
  en español, aunque queden largos: que se entienda qué es o qué hace sin leer el código que lo
  usa. Mejor `guardarNotaEnDiscoAhora` que `guardarYa`, `textosDeLaInterfaz` que `tx`,
  `notaAbierta` que `n`, `evento` que `e`, `tieneCambiosSinGuardar` que `sucio`.
- Sin abreviaturas ni letras sueltas, tampoco en funciones flecha cortas
  (`(nota) => nota.ruta`, no `(n) => n.ruta`). Únicas excepciones: `i` / `j` como índice de un
  bucle de pocas líneas y `x` / `y` para coordenadas.
- Los booleanos se leen como pregunta (`estaAbierta`, `tieneArchivo`, `hayHormigueros`) y las
  funciones empiezan con un verbo (`abrirNotaDelDia`, `quitarHormigueroDeLaLista`).
- Al tocar código que todavía tiene nombres cortos, renombrarlos en ese momento.
- Lo que se guarda en disco (los campos de `ajustes.json`) no se renombra sin migrar los
  archivos existentes: en Rust, `#[serde(alias = "nombre_viejo")]` para seguir leyendo el nombre
  anterior.

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
