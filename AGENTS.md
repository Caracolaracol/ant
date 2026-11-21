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
  re-renderizar el texto en cada tecla; se habla con el editor por la ref `ControlDelEditor`.
  Tampoco guardar en el estado de React lo que cambia en cada movimiento (como la posición del
  cursor al seleccionar con el mouse): va en una ref, y solo se actualiza el estado cuando cambia
  algo visible. El editor tampoco copia el texto en cada tecla: solo avisa que cambió, y lo que
  recorre la nota entera (conteo, títulos) se recalcula tras una pausa
  (`PAUSA_ANTES_DE_CONTAR`), con `useMemo` sobre ese texto. Nada de lo que pasa en
  cada tecla debe crecer con el largo de la nota (una novela entera puede estar en una sola).
- En Rust, lo que toca el disco y puede tardar (leer notas, listar el hormiguero) va en comandos
  `async` con `en_segundo_plano` (`lib.rs`): los comandos sin `async` corren en el hilo principal
  y trabarían la ventana.
- Gestor de paquetes: **pnpm**.

## Comandos

- `pnpm install` — instala las dependencias de la interfaz (las de Rust las baja Cargo solo).
- `pnpm tauri dev` — abre la app en desarrollo, con recarga en caliente de la interfaz.
- `pnpm build` — revisa los tipos y compila solo la interfaz (rápido para verificar cambios).
- `cd src-tauri && cargo check` — verifica que compile el lado Rust.
- `pnpm test` — pruebas automáticas de la lógica de la interfaz (`prueba/automaticas/`, con
  `node --test`, sin dependencias). `cd src-tauri && cargo test` — las de Rust. Las dos corren en
  el workflow de publicación antes de compilar: si fallan, no se publica.
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
- `src/App.tsx` — ventana principal. Solo junta las piezas: barra lateral, editor, barra de
  estado y, encima, la bienvenida (sin hormiguero o sin cámara, o con el evento
  `abrir-bienvenida`), los Ajustes, «Cámara nueva» y «Compilar y exportar» (eventos que manda Rust desde el menú,
  `EVENTOS_DE_RUST` en `src/useEventoDeRust.ts`). La lógica vive en hooks:
  - `src/ajustes/useAjustesGuardados.ts` — los ajustes vigentes y `cambiarAjustes` (aplica y guarda).
  - `src/hormigueros/useCamarasDelHormiguero.ts` — las cámaras del hormiguero (para la bienvenida,
    Ajustes y saber si la abierta sigue existiendo); se releen al cambiar de hormiguero y al volver
    el foco a la ventana.
  - `src/hormigueros/useArbolDeLaCamara.ts` — árbol de la cámara abierta; se relee al cambiar de
    cámara y al volver el foco a la ventana.
  - `src/notasAbiertas/useNotasAbiertas.ts` — las notas abiertas (`NotaAbierta`, en
    `notaAbierta.ts`): una sola con archivo a la vez (`dejarComoUnicaNotaAbierta`), guardado
    automático (`guardarNotaEnDiscoAhora`, tras `PAUSA_ANTES_DE_GUARDAR`, al cambiar de nota, al
    perder el foco, al cerrar la ventana y al salir: Rust avisa con `antes-de-salir` y espera a
    `salir`), no pisar cambios hechos fuera de Ant (cada nota recuerda `textoQueHayEnDisco`; al
    volver el foco se recargan las que cambiaron) y el último texto conocido para contar
    (`ultimoTextoConocido`, al día tras `PAUSA_ANTES_DE_CONTAR`). Las notas con archivo tienen
    id fijo por ruta (`idDeNotaConArchivo`), así el editor las reconoce al volver a abrirlas.
  - `src/useAtajosDeTeclado.ts` — Cmd+N, Cmd+O, Cmd+S, Cmd+Shift+S, Cmd+Shift+] / [ y `Cmd+\`.
- `src/BarraDeEstado.tsx` — nombre de la nota visible y conteo de palabras, líneas y caracteres
  (o el último error); el conteo está en `src/conteoDelTexto.ts`.
- **Hormiguero y cámaras**: el hormiguero es una sola carpeta con todas las notas del usuario (lo
  que en Obsidian es la bóveda), en `Ajustes.hormiguero`. Sus carpetas de primer nivel son las
  **cámaras**: cada una un contexto (notas personales, una novela, el trabajo y sus proyectos). La
  barra lateral, los fijados, el diario (`Daily/`) y «Compilar y exportar» trabajan sobre la cámara
  abierta (`Ajustes.camara_abierta`, guardada por nombre, no por ruta). Se cambia de cámara (o de
  hormiguero) en Ajustes → General y se cava una cámara con File → New Chamber… o desde ahí. Las
  notas sueltas en la raíz del hormiguero no son de ninguna cámara (se abren con Cmd+O). Si la
  cámara abierta falta o ya no existe, la bienvenida se abre en su página de cámaras. Los ajustes
  de antes (`carpeta`, o `hormiguero_abierto` con la lista `hormigueros`) pasan a ser el hormiguero.
  Más adelante, algunas cámaras podrán protegerse con contraseña.
  - `src/hormigueros/hormigueros.ts` — crear carpetas (`crear_carpeta_nueva`), listar las cámaras
    (`listar_camaras`), elegir una carpeta, la ruta de una cámara y la carpeta de la cámara abierta.
  - `src/hormigueros/ElegirHormiguero.tsx` — formulario: crear la carpeta del hormiguero (nombre y
    dónde, «Hormiguero» en Documentos por defecto) o usar una que existe. Lo usa la bienvenida.
  - `src/hormigueros/ElegirCamara.tsx` — formulario para cavar una cámara (nombre con ejemplos que
    se tocan) y, en la bienvenida, abrir una que ya existe. Lo usan la bienvenida y
    `NuevaCamara.tsx` (ventanita «Cámara nueva»). Estilos en `Hormigueros.css`.
- `src/bienvenida/` — bienvenida (onboarding) con el diseño del sitio: cámaras unidas por un
  túnel que se recorre en horizontal (una por página: Ant, archivos, el hormiguero y la primera
  cámara), la hormiga y los hoyos abajo, y EN / ES arriba. Reusa del sitio
  `website/src/lib/cavar.ts` (bordes cavados) y `website/src/assets/tierra.svg`: si se cambian
  allá, revisar también la bienvenida. `prueba/bienvenida.html` la muestra fuera de Tauri.
- `src/barraLateral/` — la barra lateral, minimalista a propósito (cambiar de cámara va en
  Ajustes, no aquí) y sin líneas separadoras. De arriba abajo: el calendario si hay modo
  diario, los fijados, «Abiertas» (notas fuera de la cámara o nuevas ya con algo escrito) y la
  cámara abierta con su nombre y su árbol. Bajo la nota visible, sus títulos.
  - `BarraLateral.tsx` — junta las secciones y provee `ContextoDeLaBarraLateral`
    (`contextoDeLaBarraLateral.ts`): nota visible, carpetas desplegadas, qué está fijado, menú de
    clic derecho… que leen las filas con `useBarraLateral()`.
  - `FilasDelArbol.tsx` — `FilaDeNota` (con sus títulos si es la visible), las carpetas y
    `EntradasDelArbol` (recursivo, se salta lo fijado).
  - `Fijados.tsx` — grilla de iconos sin texto, al estilo de Zen/Arc, con el nombre en un globo
    (`src/GloboDeAyuda.tsx`); clic derecho → Cambiar icono… (`ElegirIconoDeFijado.tsx`). Una carpeta
    fijada se despliega bajo la grilla (sola, si contiene la nota visible). Se guardan en
    `Ajustes.fijados` (claves: ruta, o `ruta#título` para un capítulo, ver `clavesDeFijados.ts`)
    con su icono en `Ajustes.iconos_de_fijados`, y solo se muestran los de la cámara abierta.
  - `Calendario.tsx` — calendario del modo diario: un mes, semana desde el lunes, punto en los
    días con nota. Con el modo diario activo, `Daily/` no aparece en el árbol y la nota diaria
    abierta va bajo el calendario.
  - `useArrastreDelBorde.ts` — el ancho se cambia arrastrando el borde derecho (`.barra-tirador`,
    invisible, puntero `col-resize`); se guarda en `Ajustes.ancho_de_la_barra_lateral` al soltar.
  `prueba/barra.html` la muestra con fijados de ejemplo (y los Ajustes, `?ajustes`).
- `src/iconos.ts` — iconos que se pueden elegir para los fijados: una selección de Lucide
  (ISC) copiada aquí, por grupos; `src/Icono.tsx` los dibuja.
- `src/diario.ts` — fechas `AAAA-MM-DD`, título inicial de cada nota diaria, días con nota
  (desde el árbol) y llamada a `abrir_o_crear_nota_del_dia`. Las notas diarias van en `Daily/` de la cámara abierta.
- `src/idioma.tsx` — textos de la interfaz en inglés (por defecto) y español. Los componentes
  los leen con `useTextos()`; `main.tsx` provee `ContextoTextos` según `Ajustes.idioma`. Todo
  texto visible nuevo va aquí, en los dos idiomas (los comentarios del código siguen en español).
- `src/colores.ts` — variables de color que se pueden cambiar, temas listos (`TEMAS`) y
  `aplicarColores`, que `main.tsx` llama al abrir la app y al cambiar los ajustes.
- `src/MenuContextual.tsx` — menú de clic derecho propio (se cierra con clic fuera, scroll o Escape).
- `src/titulosDeLaNota.ts` — extrae los títulos `#`…`######` de una nota (ignorando bloques de
  código) y dice en qué título está el cursor.
- `src/arbolDeCarpetas.ts` — tipo `EntradaDelArbol` y llamada a `leer_arbol_de_carpeta`;
  utilidades de rutas y del árbol (`estaDentroDe`, `carpetasQueContienenA`, `buscarEntradaPorRuta`,
  `marcarComoTextoDeIzquierdaADerecha` para mostrar rutas cortadas
  por el principio).
- `src/ajustes.ts` — tipo `Ajustes` (igual al de Rust), leer, guardar y escuchar cambios.
- `src/ajustes/ModalAjustes.tsx` y `.css` — Ajustes como ventanita sobre la principal (no es
  otra ventana), en dos columnas: áreas a la izquierda (`AREAS`: General —idioma, hormiguero y
  cámaras—, Editor —modo escritor—, Diario, Apariencia) y el panel del área elegida a la
  derecha. Los cambios se guardan al instante; Escape, Cmd+W o clic fuera la cierran. El marco
  de las ventanitas (`.modal-fondo`, `.modal`) está en `App.css`.
  Para agregar un ajuste: campo en `Ajustes` (TS y Rust, con `#[serde(default)]`) y su control
  en el panel.
- `src/App.css` — variables de color del tema (`--fondo`, `--texto`, `--acento`, …) y la
  distribución. Para cambiar colores, tocar las variables, no los componentes. Los colores que
  elige el usuario (`Ajustes.colores_elegidos`) pisan estas variables; un tema nuevo va en `TEMAS`.
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
    formato, estilo y opciones; recuerda todo por carpeta en `Ajustes.opciones_de_compilacion_por_carpeta`.
  - `modelo.ts` — Markdown → libro (capítulos, párrafos con estilos, títulos, escenas) con el
    analizador de Lezer; cada línea es un párrafo, `%% %%` y YAML se omiten, tipografía opcional.
  - `docx.ts` — Word escrito a mano (WordprocessingML), con estilos de Word (Title, Heading 1…).
  - `pdf.ts` — PDF escrito a mano con las fuentes Times de PDF (sin incrustar): maquetación,
    justificado, huérfanas, encabezado o folio. `metricas.ts` tiene los anchos (AFM de Adobe).
  - `formato.ts` — estilos «manuscrito» y «libro», tamaños de página y textos de portada.
  - `zip.ts` — ZIP mínimo (CRC-32, `CompressionStream`) para el .docx.
  Para probar sin la app: `node --experimental-strip-types` puede importar estos módulos (usan
  `.ts` explícito), y `prueba/compilar.html` muestra el diálogo con datos de ejemplo.
- `src/archivosDeNotas.ts` — diálogos de abrir/guardar y llamadas a `leer_nota_del_disco`,
  `guardar_nota_en_el_disco`, `guardar_archivo_binario` y `mostrar_archivo_en_su_carpeta`.
- `src-tauri/src/lib.rs` — arma la app: plugin de diálogos, menú (cada ítem propio emite su
  evento a la ventana principal), comandos `leer_nota_del_disco`, `guardar_nota_en_el_disco`
  (guardado atómico con archivo temporal + renombrar), `guardar_archivo_binario` (bytes crudos en
  el cuerpo y la ruta en el encabezado `ruta`), `mostrar_archivo_en_su_carpeta` y `salir`. Los
  argumentos de los comandos van en snake_case en Rust y en camelCase desde la interfaz
  (`ruta_del_archivo` ↔ `rutaDelArchivo`), como los convierte Tauri. Al pedir salir (Cmd+Q, Dock) no sale
  enseguida: emite `antes-de-salir` para que la interfaz guarde, y sale cuando llama a `salir`
  (o a los 3 s).
- `src-tauri/src/menu.rs` — menú propio en inglés o español según `Ajustes.idioma` (Ant con
  «Welcome to Ant…» y «Settings…» Cmd+, · File con «New Chamber…» y «Compile and Export…»
  Cmd+Shift+E · Edit · Window); `EVENTOS` dice qué evento emite cada ítem y `cambiar_idioma`
  lo rehace al guardar otro idioma. No incluye «Cerrar ventana»: Cmd+W no cierra la ventana
  principal.
- `src-tauri/src/ajustes.rs` — ajustes en `ajustes.json` de la carpeta de configuración de la
  app, escritos con `escribir_atomico`; al guardar emite `ajustes-cambiados`. Si el archivo está
  dañado, guarda una copia (`ajustes-ilegibles.json`) antes de usar los valores por defecto. Los
  campos que cambiaron de nombre se siguen leyendo con su nombre anterior (`#[serde(alias)]`:
  `carpeta` y `hormiguero_abierto` → `hormiguero`, `iconos` → `iconos_de_fijados`, `autor` →
  `nombre_del_autor`, `compilaciones` → `opciones_de_compilacion_por_carpeta`…; la lista
  `hormigueros` de antes se ignora), con tests.
- `src-tauri/src/diario.rs` — `abrir_o_crear_nota_del_dia`: usa la carpeta `Daily` que ya exista (sin importar
  mayúsculas) o la crea, y crea `AAAA-MM-DD.md` si no existe
  (nunca pisa una nota) y devuelve la ruta. Solo acepta fechas `AAAA-MM-DD`. Tiene tests (`cargo test`).
- `src-tauri/src/carpeta.rs` — `leer_arbol_de_carpeta`: árbol de notas (.md, .markdown, .txt),
  sin ocultas, `node_modules` ni `target`, omitiendo carpetas sin notas (`EntradaDelArbol`, en
  camelCase hacia la interfaz). `listar_camaras`: las carpetas de primer nivel del hormiguero,
  aunque estén vacías. `crear_carpeta_nueva`: crea la carpeta del hormiguero o de una cámara
  (nunca usa una que ya existe; con tests).
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
- `prueba/automaticas/*.prueba.ts` — pruebas automáticas (`pnpm test`) de la lógica que no
  depende de la ventana: títulos y conteo de una nota, claves de fijados, notas abiertas,
  hormiguero y cámaras, árbol de carpetas, diario, colores, modo escritor y «Compilar y exportar» (del
  Markdown al libro, ZIP, PDF y Word). Al cambiar esa lógica, agregar o ajustar su prueba. Node
  las corre sin compilar (`--experimental-strip-types`), así que los módulos que prueban deben
  importar los tipos con `import type` / `type …` y los otros módulos de `src/` con su `.ts`
  explícito; la lógica que se quiera probar va en un `.ts`, no dentro de un componente `.tsx`
  (por eso existe `src/conteoDelTexto.ts`).
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
- Los booleanos se leen como pregunta (`estaAbierta`, `tieneArchivo`, `hayCamaras`) y las
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
