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
  `EVENTOS_DE_RUST` en `src/useEventoDeRust.ts`). Al entrar vuelve a abrir la última nota (`Ajustes.ultima_nota_abierta`, que se pone al día al
  cambiar de nota). La lógica vive en hooks:
  - `src/ajustes/useAjustesGuardados.ts` — los ajustes vigentes y `cambiarAjustes` (aplica y guarda).
  - `src/hormigueros/useCamarasDelHormiguero.ts` — las cámaras del hormiguero (para la bienvenida,
    Ajustes y saber si la abierta sigue existiendo); se releen al cambiar de hormiguero y al volver
    el foco a la ventana.
  - `src/hormigueros/useArbolDeLaCamara.ts` — árbol de la cámara abierta; se relee al cambiar de
    cámara y al volver el foco a la ventana.
  - `src/hormigueros/useDatosDeLaCamara.ts` — datos de la cámara abierta en `.ant/` (fijados,
    iconos, compilaciones): se leen al abrirla y al volver el foco, y se guardan al cambiar.
  - `src/notasAbiertas/useNotasAbiertas.ts` — las notas abiertas (`NotaAbierta`, en
    `notaAbierta.ts`): puede no haber ninguna (así arranca y así queda al cerrar la última; nunca
    se crea una de la nada, y en lugar del editor va `notasAbiertas/InvitacionANotaNueva.tsx`, con
    un botón que crea una nota en la raíz de la cámara), una sola con archivo a la vez
    (`dejarComoUnicaNotaAbierta`), guardado
    automático (`guardarNotaEnDiscoAhora`, tras `PAUSA_ANTES_DE_GUARDAR`, al cambiar de nota, al
    perder el foco, al cerrar la ventana y al salir: Rust avisa con `antes-de-salir` y espera a
    `salir`), no pisar cambios hechos fuera de Ant (cada nota recuerda `textoQueHayEnDisco`; al
    volver el foco se recargan las que cambiaron) y el último texto conocido para contar
    (`ultimoTextoConocido`, al día tras `PAUSA_ANTES_DE_CONTAR`). Las notas con archivo tienen
    id fijo por ruta (`idDeNotaConArchivo`), así el editor las reconoce al volver a abrirlas.
  - `src/useAtajosDeTeclado.ts` — los atajos de la ventana (nota nueva, abrir, guardar, guardar
    como, nota siguiente / anterior, panel), con las teclas de `src/atajos.ts`.
- `src/atajos.ts` — atajos de teclado: acciones con su atajo por defecto (`ACCIONES_CON_ATAJO`),
  los que el usuario cambió (`Ajustes.atajos_de_teclado`, solo los distintos), los reservados y
  los fijos del editor, leer una tecla pulsada, mostrarlos (`⇧⌘N` / `Ctrl+Shift+N`) y saber si uno
  está libre. Formato del menú de Tauri con la tecla física (`KeyboardEvent.code`):
  `CmdOrCtrl+Shift+KeyN`. Los del menú (ajustes, cámara nueva, compilar) los aplica Rust
  (`menu.rs`, con los mismos ids y valores por defecto: una prueba de Rust lo comprueba). Para
  agregar un atajo: la acción en `ACCIONES_CON_ATAJO`, su nombre en `accionesConAtajo`
  (`idioma.tsx`) y su efecto en `useAtajosDeTeclado` (o en el menú). Probado en
  `prueba/automaticas/atajos.prueba.ts`.
- `src/hormigueros/NuevaNotaOCarpeta.tsx` — ventanita «Nota nueva» o «Carpeta nueva»: pide el
  nombre y crea la nota vacía (`crear_nota_nueva`) o la carpeta (`crear_carpeta_nueva`), sin pisar
  nada. La nota de Cmd+N va junto a la nota visible si es de la cámara, o en la
  cámara; con clic derecho, donde se pidió.
- `src/BarraDeEstado.tsx` — nombre de la nota visible y conteo de palabras, líneas y caracteres
  (o el último error); el conteo está en `src/conteoDelTexto.ts`.
- **Hormiguero y cámaras**: el hormiguero es una sola carpeta con todas las notas del usuario (lo
  que en Obsidian es la bóveda), en `Ajustes.hormiguero`. Sus carpetas de primer nivel son las
  **cámaras**: cada una un contexto (notas personales, una novela, el trabajo y sus proyectos). La
  barra lateral, los fijados, el diario (`Daily/`) y «Compilar y exportar» trabajan sobre la cámara
  abierta (`Ajustes.camara_abierta`, guardada por nombre, no por ruta). Se cambia de cámara con el
  selector de arriba de la barra lateral (o en Ajustes → General, donde también se cambia de
  hormiguero) y se cava una desde el selector, File → New Chamber… (Cmd+Shift+N) o desde
  ahí. Las notas sueltas en la raíz del hormiguero son la **Entrada** (`CAMARA_DE_ENTRADA = "."`,
  la primera de la lista): una cámara más que solo aparece mientras haya notas sueltas; su árbol
  son solo esas notas, sin diario, y lo de las subcarpetas es de las otras cámaras
  (`estaEnLaCamara`). Si la cámara abierta falta o ya no existe, la bienvenida se abre en su
  página de cámaras. Los ajustes
  de antes (`carpeta`, o `hormiguero_abierto` con la lista `hormigueros`) pasan a ser el hormiguero.
  - **Cámaras cifradas** (para guardar contraseñas, por ejemplo): protegen contra quien use el
    computador o entre a la nube. Rust (`src-tauri/src/camaras_cifradas.rs`) cifra cada archivo
    con el formato estándar age (`Banco.md` → `Banco.md.age`) con una llave X25519 propia de la
    cámara, guardada en `<cámara>/.ant-llave.age` y protegida con la contraseña (scrypt). Para el
    resto de la app nada cambia de nombre: `leer_archivo` / `escribir_archivo` resuelven el
    `.age` (las notas, la nota nueva, el diario y las imágenes pasan por ahí), así fijados, última
    nota y enlaces siguen sirviendo. La llave desbloqueada vive solo en memoria
    (`LlavesAbiertas`); bloqueada, leer o escribir da `camara-bloqueada`. Olvidar la contraseña es
    perder la cámara (sin recuperación, a pedido del usuario): la ventanita de cifrar
    (`src/hormigueros/CifrarCamara.tsx`) lo avisa en grande y pide marcar que se entiende.
    `useCifradoDeLaCamara.ts` sigue el estado y bloquea sola la cámara que se deja; al bloquear se
    cierran sus notas y el editor olvida su texto (`olvidarNotasDentroDe`). Bloqueada, la barra
    muestra solo el selector y en lugar del editor va `DesbloquearCamara.tsx`. Las imágenes
    cifradas se muestran desde la memoria (`leer_imagen_cifrada`, `blob:`). Los nombres siguen
    visibles en el disco. Lo que se agregue y lea o escriba archivos de una cámara tiene que pasar
    por `leer_archivo` / `escribir_archivo`.
  - **Carpeta `.ant/`** en la raíz del hormiguero (como `.obsidian/`): lo que es de las notas y no
    de este computador, para que viaje con el hormiguero. Un archivo por cámara,
    `.ant/camaras/<nombre>.json` (`.entrada.json` para la Entrada), con fijados, iconos y opciones
    de compilación, las opciones de su editor (`opciones_del_editor`), y rutas **relativas a la cámara con `/`** (`.` es la cámara). En la app se usan
    completas: `src/hormigueros/datosDeLaCamara.ts` convierte en los dos sentidos y pasa al archivo
    lo que cada cámara tenía en `ajustes.json` la primera vez que se abre (y lo quita de ahí). En
    `ajustes.json` queda solo lo de este computador. Rust: `src-tauri/src/datos_del_hormiguero.rs`
    (un archivo dañado se deja a un lado como `….ilegible.json`). Lo nuevo que sea de una cámara
    (por ejemplo, su contraseña) va ahí, no en los ajustes.
  - `src/hormigueros/hormigueros.ts` — crear carpetas (`crear_carpeta_nueva`), listar las cámaras
    (`listar_camaras`), elegir una carpeta, la «Entrada» (`esLaEntrada`, `nombreVisibleDeLaCamara`),
    la ruta de una cámara y la carpeta de la cámara abierta.
  - `src/hormigueros/ElegirHormiguero.tsx` — formulario: crear la carpeta del hormiguero (nombre y
    dónde, «Hormiguero» en Documentos por defecto) o usar una que existe. Lo usa la bienvenida.
  - `src/hormigueros/ElegirCamara.tsx` — formulario para cavar una cámara (nombre con ejemplos que
    se tocan) y, en la bienvenida, abrir una que ya existe. Lo usan la bienvenida y
    `NuevaCamara.tsx` (ventanita «Cámara nueva»). Estilos en `Hormigueros.css`.
- `src/bienvenida/` — bienvenida (onboarding) con el diseño del sitio: cámaras unidas por un
  túnel que se recorre en horizontal (una por página: Ant, archivos, el hormiguero y la primera
  cámara), la hormiga y los hoyos abajo, y EN / ES arriba. Reusa del sitio
  `website/src/lib/cavar.ts` (bordes cavados) y `website/src/assets/tierra.svg`: si se cambian
  allá, revisar también la bienvenida. Por eso compilar la app necesita las dependencias del sitio
  (`website/tsconfig.json` extiende la de Astro); el workflow de publicación las instala. `prueba/bienvenida.html` la muestra fuera de Tauri.
- `src/barraLateral/` — la barra lateral (el «panel»), minimalista a propósito y sin líneas
  separadoras. De arriba abajo: el selector de cámaras (`SelectorDeCamara.tsx`, el nombre de la
  abierta; al tocarlo, la lista para cambiar y «Cámara nueva…», con `MenuContextual`), el
  calendario si hay modo diario, los fijados, «Abiertas» (notas fuera de la cámara o nuevas ya con
  algo escrito) y el árbol de la cámara. Bajo la nota visible, sus títulos. Clic derecho en una
  nota o carpeta: nota nueva y carpeta nueva (junto a ella o dentro), fijar y mostrar en su
  carpeta; en el espacio libre, crear en la cámara (en la Entrada no hay carpeta nueva).
  - `BarraLateral.tsx` — junta las secciones y provee `ContextoDeLaBarraLateral`
    (`contextoDeLaBarraLateral.ts`): nota visible, carpetas desplegadas, qué está fijado, menú de
    clic derecho… que leen las filas con `useBarraLateral()`.
  - `FilasDelArbol.tsx` — `FilaDeNota` (con sus títulos si es la visible), las carpetas y
    `EntradasDelArbol` (recursivo, se salta lo fijado).
  - `Fijados.tsx` — grilla de iconos sin texto, al estilo de Zen/Arc, con el nombre en un globo
    (`src/GloboDeAyuda.tsx`); clic derecho → Cambiar icono… (`ElegirIconoDeFijado.tsx`). Una carpeta
    fijada se despliega bajo la grilla (sola, si contiene la nota visible). Se guardan con su icono
    en los datos de la cámara (`.ant/`; claves: ruta, o `ruta#título` para un capítulo, ver
    `clavesDeFijados.ts`), y solo se muestran los de la cámara abierta.
  - `Calendario.tsx` — calendario del modo diario: un mes, semana desde el lunes, punto en los
    días con nota. Con el modo diario activo, `Daily/` no aparece en el árbol y la nota diaria
    abierta va bajo el calendario.
  - `useArrastreDelBorde.ts` — el ancho se cambia arrastrando el borde derecho (`.barra-tirador`,
    invisible, puntero `col-resize`); se guarda en `Ajustes.ancho_de_la_barra_lateral` al soltar.
  `prueba/barra.html` la muestra con fijados de ejemplo (y los Ajustes, `?ajustes`; con
  `&captura`, solo los Ajustes a todo su alto: de ahí sale la captura del sitio).
- `src/iconos.ts` — iconos que se pueden elegir para los fijados: una selección de Lucide
  (ISC) copiada aquí, por grupos, más los de los menús (fuera de los grupos);
  `src/Icono.tsx` los dibuja.
- `src/diario.ts` — fechas `AAAA-MM-DD`, título inicial de cada nota diaria, días con nota
  (desde el árbol) y llamada a `abrir_o_crear_nota_del_dia`. Las notas diarias van en `Daily/` de la cámara abierta.
- `src/idioma.tsx` — textos de la interfaz en inglés (por defecto) y español. Los componentes
  los leen con `useTextos()`; `main.tsx` provee `ContextoTextos` según `Ajustes.idioma`. Todo
  texto visible nuevo va aquí, en los dos idiomas (los comentarios del código siguen en español).
- `src/colores.ts` — variables de color que se pueden cambiar, temas listos (`TEMAS`; el primero,
  «Ant», es el de por defecto y el de `App.css`) y
  `aplicarColores`, que `main.tsx` llama al abrir la app y al cambiar los ajustes.
- `src/MenuContextual.tsx` — menú de clic derecho propio, con diseño de Ant: opciones con icono o
  ✓, separadas en grupos, ↑ ↓ y Enter, sin salirse de la ventana; se cierra con clic fuera,
  scroll o Escape. También es la lista del selector de cámaras. `App` bloquea el menú del sistema
  salvo en el editor y los campos de texto (ahí trae cortar, copiar, pegar y el corrector).
- `src/titulosDeLaNota.ts` — extrae los títulos `#`…`######` de una nota (ignorando bloques de
  código) y dice en qué título está el cursor.
- `src/arbolDeCarpetas.ts` — tipo `EntradaDelArbol` y llamada a `leer_arbol_de_carpeta`;
  utilidades de rutas y del árbol (`estaDentroDe`, `carpetasQueContienenA`, `buscarEntradaPorRuta`,
  `marcarComoTextoDeIzquierdaADerecha` para mostrar rutas cortadas
  por el principio).
- `src/ajustes.ts` — tipo `Ajustes` (igual al de Rust), leer, guardar y escuchar cambios.
- `src/ajustes/ModalAjustes.tsx` y `.css` — Ajustes como ventanita sobre la principal (no es
  otra ventana), con una cabecera a todo el ancho (título y × para cerrar) y debajo dos columnas: áreas a la izquierda (`AREAS`: General —idioma, hormiguero y
  cámaras—, Editor —opciones de la cámara abierta, con presets escritor, programador y simple—, Diario, Apariencia, Atajos —`PanelAtajos.tsx`: clic en un atajo y
  pulsar las teclas nuevas—) y el panel del área elegida a la
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
  libro y corrector.
- `src/editor/vistaDelMarkdown.ts` — vista del Markdown: esconde las marcas (títulos `#`, `**`,
  `*`, `~~`, comillas invertidas, `[…](…)`, `>`) y dibuja viñetas, casillas de tareas (se marcan
  con un clic) y separadores; en la línea del cursor las marcas vuelven a verse. Sale del árbol de
  sintaxis y solo de las líneas a la vista. Cada parte es una opción del editor de la cámara. Va en un `Compartment` de `Editor.tsx` (prop `escritor`); nunca toca texto
  ya escrito ni código, HTML, URLs o el encabezado YAML.
- `src/editor/programador.ts` — ayudas para código: al escribir ``` y Enter cierra el bloque de
  código solo (si no estaba cerrado, según el árbol de sintaxis; probado en
  `prueba/automaticas/programador.prueba.ts`), cierra paréntesis (y comillas si no están las
  tipográficas; `@codemirror/autocomplete`), marca el par y da fondo a los bloques de código a la
  vista. Cada una por separado.
- **Opciones del editor por cámara** (`OpcionesDelEditor` en `ajustes.ts`): tipografía y página del
  escritor más las ayudas de código, todas independientes y sumables; se guardan en los datos de la
  cámara (`opciones_del_editor`; sin ellas, las de `modo_escritor` de los ajustes; la forma de antes,
  `editor: { modo }`, se convierte con `opcionesDelEditorDeLaCamara`). Los presets
  (`PRESETS_DEL_EDITOR`: escritor, programador, simple) solo las marcan de una vez; `presetQueCoincide`
  dice cuál está elegido (probado en `prueba/automaticas/opcionesDelEditor.prueba.ts`). Ajustes →
  Editor muestra los presets arriba y todas las opciones abajo. `Editor.tsx` las monta en un
  `Compartment` (`extensionesDelModo`: las del escritor y las del programador que estén activas).
- `src/editor/tema.ts` — tema de CodeMirror y colores del Markdown, leyendo las variables CSS.
- **Imágenes en las notas**: se arrastran a la ventana o se pegan, y se ven debajo de su línea sin
  esconder el Markdown.
  - `src/editor/imagenesEnElTexto.ts` — encontrar imágenes en una línea (`![…](…)`, con `< >` o
    `%20`, y `![[…]]` de Obsidian), resolver su ruta desde la carpeta de la nota y escribir el
    enlace de una nueva (probado en `prueba/automaticas/imagenes.prueba.ts`).
  - `src/editor/imagenes.ts` — extensión de CodeMirror: un widget de bloque por imagen. Solo se
    revisan las líneas que cambian. El editor sabe dónde está la nota visible
    (`cambiarLugarDeLaNota`, prop `rutaDeLaNotaVisible`). Lee los archivos con el protocolo
    `asset:` de Tauri, permitiendo antes la carpeta de cada imagen.
  - `src/editor/useImagenesEnLaNota.ts` — lo arrastrado (Tauri `onDragDropEvent`, con rutas) y lo
    pegado: copia o guarda en `Images/` junto a la nota (una imagen que ya está en el hormiguero se
    enlaza donde está) e inserta el enlace con `insertarEnLineaPropia`. Soltar una nota la abre.
  - `src-tauri/src/imagenes.rs` — copiar, guardar lo pegado (bytes crudos, como
    `guardar_archivo_binario`), permitir carpetas al protocolo `asset:` y buscar por nombre las de
    Obsidian. Nunca pisa una imagen (`-2`, `-3`…). Requiere el feature `protocol-asset` de `tauri`
    y `assetProtocol.enable` en `tauri.conf.json` (con alcance vacío: se permite carpeta por carpeta).
  - «Compilar y exportar» todavía no incluye las imágenes en el Word o el PDF.
- `src/compilar/` — «Compilar y exportar» (menú File, Cmd+Shift+E; Rust emite
  `abrir-compilar` y `App` abre el diálogo). Sin dependencias ni programas externos:
  - `Compilar.tsx` y `.css` — el diálogo: carpeta, capítulos (incluir, ordenar), título, autor,
    formato, estilo y opciones; recuerda todo por carpeta en los datos de la cámara (`.ant/`).
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
  «Welcome to Ant…» y «Settings…» Cmd+, · File con «New Chamber…» Cmd+Shift+N y «Compile and Export…»
  Cmd+Shift+E · Edit · Window); `EVENTOS` dice qué evento emite cada ítem y `rehacer` lo vuelve a
  armar al guardar otro idioma u otros atajos (los suyos, de `Ajustes.atajos_de_teclado`). No
  incluye «Cerrar ventana»: Cmd+W no cierra la ventana principal.
- `src-tauri/src/ajustes.rs` — ajustes en `ajustes.json` de la carpeta de configuración de la
  app, escritos con `escribir_atomico`; al guardar emite `ajustes-cambiados`. Si el archivo está
  dañado, guarda una copia (`ajustes-ilegibles.json`) antes de usar los valores por defecto. Los
  campos que cambiaron de nombre se siguen leyendo con su nombre anterior (`#[serde(alias)]`:
  `carpeta` y `hormiguero_abierto` → `hormiguero`, `iconos` → `iconos_de_fijados`, `autor` →
  `nombre_del_autor`, `compilaciones` → `opciones_de_compilacion_por_carpeta`…; la lista
  `hormigueros` de antes se ignora), con tests. `fijados`, `iconos_de_fijados` y
  `opciones_de_compilacion_por_carpeta` quedan solo para pasarlos a `.ant/` de cada cámara.
- `src-tauri/src/diario.rs` — `abrir_o_crear_nota_del_dia`: usa la carpeta `Daily` que ya exista (sin importar
  mayúsculas) o la crea, y crea `AAAA-MM-DD.md` si no existe
  (nunca pisa una nota) y devuelve la ruta. Solo acepta fechas `AAAA-MM-DD`. Tiene tests (`cargo test`).
- `src-tauri/src/datos_del_hormiguero.rs` — `leer_datos_de_la_camara` y
  `guardar_datos_de_la_camara`: el archivo de cada cámara en `.ant/camaras/` del hormiguero (ver
  «Carpeta `.ant/`» arriba), con tests.
- `src-tauri/src/carpeta.rs` — `leer_arbol_de_carpeta`: árbol de notas (.md, .markdown, .txt),
  sin ocultas, `node_modules` ni `target`, omitiendo carpetas sin notas salvo las del todo vacías
  (una recién creada tiene que verse) (`EntradaDelArbol`, en
  camelCase hacia la interfaz), o solo las notas sueltas (`solo_notas_sueltas`, la «Entrada»).
  `listar_camaras`: las carpetas de primer nivel del hormiguero, aunque estén vacías, y antes
  «.» si hay notas sueltas en la raíz. `crear_carpeta_nueva`: crea la carpeta del hormiguero o de
  una cámara (nunca usa una que ya existe). `crear_nota_nueva`: crea una nota vacía sin pisar
  otra (`create_new`). Con tests.
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
- `prueba/imagenes.html` — el editor con una nota con imágenes: una en línea (se ve) y dos que fuera
  de Tauri no se pueden leer (quedan con su nombre tenue).

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
  - La cámara «El hormiguero» de la portada muestra una captura del hormiguero y las cámaras de Ajustes → General
    (`src/assets/ajustes-camaras-en.png` y `-es.png`, a 2x). Si cambian esos Ajustes, volver a
    sacarla con Chrome sin ventana: `--headless=new --force-device-scale-factor=2
    --window-size=540,595 --default-background-color=00000000 --screenshot=…` sobre
    `http://localhost:1420/prueba/barra.html?ajustes&captura` (y `&es`), con `pnpm dev` corriendo.
  - La tierra de fondo es `src/assets/tierra.svg`: granos y piedritas al azar (semilla fija) que
    genera `website/scripts/tierra.mjs`; para cambiarla, editar el script y correrlo con node.

- `marca/` — icono de la app (cara de hormiga plana en SVG, PNG de 1024 y script); ver `marca/README.md` para
  regenerar `src-tauri/icons/`. Sigue el sistema visual de Mantis (`~/Code/meeting-recorder`).

Mantener esta sección al día cuando se agreguen carpetas o módulos.

## Interfaz

- Simple y minimalista: la ventana principal es para escribir. Lo que no es escribir (cambiar
  de hormiguero, opciones, modos) va en Ajustes o en el menú, no como botones en la barra
  lateral, el editor o la barra de estado. No agregar barras de herramientas.
- Excepción pedida a propósito: el selector de cámaras arriba de la barra lateral. Los botones
  que se probaron en la franja de arriba se quitaron a pedido: crear notas y carpetas va con
  Cmd+N y el clic derecho. No sumar botones sin pedirlo.

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
