// Idioma de la interfaz. Ant está en inglés por defecto y se puede pasar a español en
// Ajustes → General. Aquí están todos los textos que ve el usuario en los dos idiomas; los
// componentes los leen con `useTextos()`, y `main.tsx` cambia el idioma al instante cuando
// cambian los ajustes. Los menús nativos los traduce Rust (`src-tauri/src/menu.rs`).
//
// Para agregar un texto: sumarlo a `en` y TypeScript obliga a ponerlo también en `es`.

import { createContext, ReactNode, useContext } from "react";

export type Idioma = "en" | "es";

/** Idiomas que se ofrecen en Ajustes, cada uno con su nombre en su propio idioma. */
export const IDIOMAS: { id: Idioma; nombre: string }[] = [
  { id: "en", nombre: "English" },
  { id: "es", nombre: "Español" },
];

const en = {
  /** Código de idioma para fechas (`toLocaleDateString`). */
  locale: "en-US",

  // Ventana principal y barra de estado.
  sinTitulo: "Untitled",
  notaNueva: "Note.md",
  filtroNotas: "Notes",
  conteo: (palabras: number, lineas: number, caracteres: number) =>
    `${palabras} words · ${lineas} lines · ${caracteres} characters`,
  cerrarNotaTitulo: "Close note",
  cambiosSinGuardar: (nombre: string) => `“${nombre}” has unsaved changes. Close it anyway?`,
  descartarCambios: "Discard changes",
  cancelar: "Cancel",
  diarioSinCarpeta: "Open an anthill to use the diary.",
  cambiadaFueraDeAnt: (nombre: string) => `“${nombre}” changed outside Ant and was not overwritten. Cmd+S keeps your version.`,

  // Barra lateral.
  fijados: "Pinned",
  abiertas: "Open",
  cerrarNota: "Close note",
  yaNoEsta: "No longer in the folder",
  carpetaVacia: "No notes in this anthill yet.",
  fijarArriba: "Pin to top",
  quitarFijado: "Unpin",
  cambiarIcono: "Change icon…",
  iconoPorDefecto: "Default icon",
  gruposIconos: { lugares: "Places", escritura: "Writing", libros: "Books", ideas: "Ideas", mundo: "World", vida: "Life", animales: "Animals", codigo: "Code" },

  // Hormigueros.
  nuevoHormigueroBoton: "New anthill…",
  nuevoHormiguero: "New anthill",
  nuevoHormigueroAyuda: "An anthill is a folder for one project: a novel, a diary, your work notes. Create a new folder or use one you already have.",
  hormigueroPorDefecto: "Notes",
  hormigueroEjemplo: "My novel",
  nombreHormiguero: "Name",
  dentroDe: "Inside",
  cambiar: "Change…",
  cavarHormiguero: "Dig the anthill",
  o: "or",
  usarCarpeta: "Use a folder you already have…",
  bordeBarra: "Drag to resize · double-click to reset",

  // Calendario del modo diario.
  diasSemana: ["M", "T", "W", "T", "F", "S", "S"],
  mesAnterior: "Previous month",
  mesSiguiente: "Next month",
  irAHoy: "Go to today",

  // Ventana de Ajustes.
  ajustes: "Settings",
  areas: { general: "General", editor: "Editor", diario: "Diary", apariencia: "Appearance" },
  modoEscritor: "Writer mode",
  modoEscritorAyuda: "The editor adapts to writing prose: book typography, smart quotes and dashes as you type, and spell checking.",
  tipografia: "Typography as you type",
  tipografiaAyuda: "Backspace right after a change undoes it. Nothing changes inside code, and text you already wrote is never converted.",
  comillas: "Smart quotes",
  estiloComillas: { auto: "By language", curvas: "Curly “ ”", latinas: "Angle « »" } as Record<string, string>,
  rayas: "Dashes",
  puntos: "Ellipsis",
  angulares: "Angle quotes",
  flechas: "Arrows",
  pagina: "Page",
  letraLibro: "Book font",
  letraLibroAyuda: "Serif type, larger, in a narrower column.",
  corrector: "Spell checking",
  correctorAyuda: "Underlines misspelled words, using the system’s spell checker.",
  idioma: "Language",
  idiomaAyuda: "Language of the menus, the sidebar and these settings.",
  hormigueros: "Anthills",
  hormiguerosAyuda: "Each anthill is a folder with its notes. The sidebar shows the open one; switch to another here. Removing one from this list doesn’t delete its folder.",
  abierto: "Open",
  abrir: "Open",
  quitar: "Remove",
  quitarHormigueroAyuda: "Remove from the list (the folder stays on your disk)",
  activarDiario: "Turn on diary mode",
  diarioAyuda: (ejemplo: ReactNode, carpeta: ReactNode): ReactNode => (
    <>
      Shows a calendar at the top of the sidebar. Click a day to open its note, named after the
      date (for example {ejemplo}). If the {carpeta} folder or the note do not exist yet, they are
      created inside the open anthill; if the folder already exists, it is used as is. The{" "}
      {carpeta} folder is hidden from the sidebar tree: you reach daily notes through the calendar.
      Days that already have a note show a dot.
    </>
  ),
  diarioAviso: "Open an anthill first: the Daily folder goes there.",
  tema: "Theme",
  temaAyuda: "A starting point; then you can change each color below.",
  colores: "Colors",
  restablecerColores: "Reset colors",
  nombresTemas: { oscuro: "Dark", hormiga: "Ant", noche: "Night", papel: "Paper", sepia: "Sepia" } as Record<string, string>,
  nombresColores: {
    fondo: "Background",
    "fondo-bajo": "Bars background",
    texto: "Text",
    tenue: "Dim text",
    titulo: "Headings",
    acento: "Accent",
    codigo: "Code",
    seleccion: "Selection",
    coincidencia: "Matches",
  } as Record<string, string>,
  // Compilar y exportar.
  compilarTitulo: "Compile and Export",
  compilarSinCarpeta: "Open an anthill first: you compile one of its folders into a book.",
  carpetaLibro: "Folder",
  capitulos: "Chapters",
  capitulosAyuda: "Each note is a chapter. Uncheck the ones you leave out and use the arrows to change the order.",
  sinNotas: "This folder has no notes.",
  subir: "Move up",
  bajar: "Move down",
  palabrasN: (n: number) => `${n.toLocaleString("en-US")} words`,
  capitulosN: (n: number, total: number) => `${n} of ${total} chapters`,
  tituloLibro: "Title",
  autor: "Author",
  formato: "Format",
  formatos: { docx: "Word", pdf: "PDF" } as Record<string, string>,
  estiloLibro: "Style",
  estilos: { manuscrito: "Standard manuscript", libro: "Book" } as Record<string, string>,
  estilosAyuda: {
    manuscrito: "What publishers, agents and contests ask for: Times 12, double spaced, a header with your surname, the title and the page number, and a title page with the word count.",
    libro: "To read or print: A5 page, justified text, page numbers at the foot.",
  } as Record<string, string>,
  paginaLibro: "Page size",
  paginas: { carta: "US Letter", a4: "A4" } as Record<string, string>,
  tituloCapitulos: "Chapter titles",
  origenesTitulo: { titulo: "The note’s first heading", archivo: "The file name", ninguno: "None" } as Record<string, string>,
  corregirTipografia: "Fix typography (quotes, dashes, ellipses)",
  notasPropiasAyuda: "Text between %% and %% (notes to yourself) and the YAML header are never exported.",
  exportar: "Export…",
  exportando: "Exporting…",
  exportado: (nombre: string) => `Exported “${nombre}”.`,
  mostrarEnFinder: "Show in folder",
  cerrar: "Close",

  // Bienvenida.
  bvSeguir: "Follow the tunnel",
  bvVolver: "Back to my notes",
  bvLema: "Write without distractions.",
  bvPresentacion: "A simple, quiet place for stories, novels and notes. Let’s dig your first anthill: it takes a minute.",
  bvArchivosEtiqueta: "How it works",
  bvArchivosTitulo: "Your texts are files",
  bvArchivosTexto: "Every note is a Markdown file in a folder on your computer. No accounts, no cloud, nothing to import.",
  bvArchivosNota: "Open them with any other app and back them up however you like.",
  bvHormiguerosEtiqueta: "Anthills",
  bvHormiguerosTitulo: "One anthill per project",
  bvHormiguerosTexto: "An anthill is a folder where your notes live, chamber by chamber. Make as many as you want: one for your novel, another for your diary, another for work.",
  bvEjemplos: "Examples",
  bvEjemplosLista: ["My novel", "Diary", "Work"],
  bvHormiguerosNota: "Switch between them in Settings, and dig a new one anytime with File → New Anthill…",
  bvCavarEtiqueta: "Last chamber",
  bvCavarTitulo: "Dig your first anthill",
  bvCavarTexto: "Create a new folder for it, or use one you already have, like a folder of chapters or an Obsidian vault.",
  bvRecorrido: "Welcome pages",
  bvCamara: (n: number) => `Page ${n}`,
};

export type Textos = typeof en;

const es: Textos = {
  locale: "es",

  sinTitulo: "Sin título",
  notaNueva: "Nota.md",
  filtroNotas: "Notas",
  conteo: (palabras, lineas, caracteres) => `${palabras} palabras · ${lineas} líneas · ${caracteres} caracteres`,
  cerrarNotaTitulo: "Cerrar nota",
  cambiosSinGuardar: (nombre) => `«${nombre}» tiene cambios sin guardar. ¿Cerrarla igual?`,
  descartarCambios: "Descartar cambios",
  cancelar: "Cancelar",
  diarioSinCarpeta: "Abre un hormiguero para usar el diario.",
  cambiadaFueraDeAnt: (nombre) => `«${nombre}» cambió fuera de Ant y no se sobrescribió. Cmd+S se queda con tu versión.`,

  fijados: "Fijados",
  abiertas: "Abiertas",
  cerrarNota: "Cerrar nota",
  yaNoEsta: "Ya no está en el hormiguero",
  carpetaVacia: "Todavía no hay notas en este hormiguero.",
  fijarArriba: "Fijar arriba",
  quitarFijado: "Quitar de fijados",
  cambiarIcono: "Cambiar icono…",
  iconoPorDefecto: "Icono por defecto",
  gruposIconos: { lugares: "Lugares", escritura: "Escritura", libros: "Libros", ideas: "Ideas", mundo: "Mundo", vida: "Vida", animales: "Animales", codigo: "Código" },

  nuevoHormigueroBoton: "Hormiguero nuevo…",
  nuevoHormiguero: "Hormiguero nuevo",
  nuevoHormigueroAyuda: "Un hormiguero es una carpeta para un proyecto: una novela, un diario, tus notas del trabajo. Crea una carpeta nueva o usa una que ya tengas.",
  hormigueroPorDefecto: "Notas",
  hormigueroEjemplo: "Mi novela",
  nombreHormiguero: "Nombre",
  dentroDe: "Dentro de",
  cambiar: "Cambiar…",
  cavarHormiguero: "Cavar el hormiguero",
  o: "o",
  usarCarpeta: "Usar una carpeta que ya tengo…",
  bordeBarra: "Arrastra para cambiar el ancho · doble clic para restablecerlo",

  diasSemana: ["L", "M", "M", "J", "V", "S", "D"],
  mesAnterior: "Mes anterior",
  mesSiguiente: "Mes siguiente",
  irAHoy: "Ir a hoy",

  ajustes: "Ajustes",
  areas: { general: "General", editor: "Editor", diario: "Diario", apariencia: "Apariencia" },
  modoEscritor: "Modo escritor",
  modoEscritorAyuda: "El editor se adapta a escribir prosa: tipografía de libro, comillas y rayas al escribir, y corrector ortográfico.",
  tipografia: "Tipografía al escribir",
  tipografiaAyuda: "Backspace justo después de un cambio lo deshace. Nada cambia dentro del código y el texto ya escrito nunca se convierte.",
  comillas: "Comillas tipográficas",
  estiloComillas: { auto: "Según el idioma", curvas: "Curvas “ ”", latinas: "Latinas « »" },
  rayas: "Raya de diálogo",
  puntos: "Puntos suspensivos",
  angulares: "Comillas latinas",
  flechas: "Flechas",
  pagina: "Página",
  letraLibro: "Letra de libro",
  letraLibroAyuda: "Letra con serifa, más grande y en una columna más angosta.",
  corrector: "Corrector ortográfico",
  correctorAyuda: "Subraya las palabras mal escritas, con el corrector del sistema.",
  idioma: "Idioma",
  idiomaAyuda: "Idioma de los menús, la barra lateral y estos ajustes.",
  hormigueros: "Hormigueros",
  hormiguerosAyuda: "Cada hormiguero es una carpeta con sus notas. La barra lateral muestra el abierto; se cambia aquí. Quitar uno de esta lista no borra su carpeta.",
  abierto: "Abierto",
  abrir: "Abrir",
  quitar: "Quitar",
  quitarHormigueroAyuda: "Quitar de la lista (la carpeta queda en tu disco)",
  activarDiario: "Activar el modo diario",
  diarioAyuda: (ejemplo, carpeta) => (
    <>
      Muestra un calendario arriba de la barra lateral. Al hacer clic en un día se abre su nota, con
      la fecha como nombre (por ejemplo {ejemplo}). Si la carpeta {carpeta} o la nota aún no existen,
      se crean dentro del hormiguero abierto; si la carpeta ya existe, se usa esa. La carpeta{" "}
      {carpeta} no aparece en el árbol de la barra lateral: a las notas diarias se llega desde el
      calendario. Los días que ya tienen nota llevan un punto.
    </>
  ),
  diarioAviso: "Abre primero un hormiguero: ahí va la carpeta Daily.",
  tema: "Tema",
  temaAyuda: "Un punto de partida; después puedes cambiar cada color abajo.",
  colores: "Colores",
  restablecerColores: "Restablecer colores",
  nombresTemas: { oscuro: "Oscuro", hormiga: "Hormiga", noche: "Noche", papel: "Papel", sepia: "Sepia" },
  nombresColores: {
    fondo: "Fondo",
    "fondo-bajo": "Fondo de barras",
    texto: "Texto",
    tenue: "Texto tenue",
    titulo: "Títulos",
    acento: "Acento",
    codigo: "Código",
    seleccion: "Selección",
    coincidencia: "Coincidencias",
  },
  compilarTitulo: "Compilar y exportar",
  compilarSinCarpeta: "Abre primero un hormiguero: se compila una de sus carpetas como libro.",
  carpetaLibro: "Carpeta",
  capitulos: "Capítulos",
  capitulosAyuda: "Cada nota es un capítulo. Desmarca las que quedan fuera y usa las flechas para cambiar el orden.",
  sinNotas: "Esta carpeta no tiene notas.",
  subir: "Subir",
  bajar: "Bajar",
  palabrasN: (n) => `${n.toLocaleString("es")} palabras`,
  capitulosN: (n, total) => `${n} de ${total} capítulos`,
  tituloLibro: "Título",
  autor: "Autor",
  formato: "Formato",
  formatos: { docx: "Word", pdf: "PDF" },
  estiloLibro: "Estilo",
  estilos: { manuscrito: "Manuscrito estándar", libro: "Libro" },
  estilosAyuda: {
    manuscrito: "El que piden editoriales, agentes y concursos: Times 12, doble espacio, encabezado con tu apellido, el título y la página, y portada con el conteo de palabras.",
    libro: "Para leer o imprimir: página A5, texto justificado y número de página al pie.",
  },
  paginaLibro: "Tamaño de página",
  paginas: { carta: "Carta", a4: "A4" },
  tituloCapitulos: "Títulos de capítulo",
  origenesTitulo: { titulo: "El primer título de la nota", archivo: "El nombre del archivo", ninguno: "Ninguno" },
  corregirTipografia: "Corregir la tipografía (comillas, rayas, puntos suspensivos)",
  notasPropiasAyuda: "El texto entre %% y %% (notas para ti) y el encabezado YAML nunca se exportan.",
  exportar: "Exportar…",
  exportando: "Exportando…",
  exportado: (nombre) => `Se exportó «${nombre}».`,
  mostrarEnFinder: "Mostrar en la carpeta",
  cerrar: "Cerrar",

  bvSeguir: "Sigue el túnel",
  bvVolver: "Volver a mis notas",
  bvLema: "Escribe sin distracciones.",
  bvPresentacion: "Un lugar simple y silencioso para cuentos, novelas y notas. Cavemos tu primer hormiguero: toma un minuto.",
  bvArchivosEtiqueta: "Cómo funciona",
  bvArchivosTitulo: "Tus textos son archivos",
  bvArchivosTexto: "Cada nota es un archivo Markdown en una carpeta de tu computador. Sin cuentas, sin nube, nada que importar.",
  bvArchivosNota: "Ábrelos con cualquier otra app y respáldalos como quieras.",
  bvHormiguerosEtiqueta: "Hormigueros",
  bvHormiguerosTitulo: "Un hormiguero por proyecto",
  bvHormiguerosTexto: "Un hormiguero es una carpeta donde viven tus notas, cámara por cámara. Crea todos los que quieras: uno para tu novela, otro para tu diario, otro para el trabajo.",
  bvEjemplos: "Ejemplos",
  bvEjemplosLista: ["Mi novela", "Diario", "Trabajo"],
  bvHormiguerosNota: "Pasa de uno a otro en Ajustes, y cava uno nuevo cuando quieras con Archivo → Hormiguero nuevo…",
  bvCavarEtiqueta: "Última cámara",
  bvCavarTitulo: "Cava tu primer hormiguero",
  bvCavarTexto: "Crea una carpeta nueva para él, o usa una que ya tengas, como una carpeta de capítulos o una bóveda de Obsidian.",
  bvRecorrido: "Páginas de bienvenida",
  bvCamara: (n) => `Página ${n}`,
};

/** Textos del idioma pedido; cualquier valor desconocido (o vacío) cae en inglés. */
export const textosDe = (idioma: string | null | undefined): Textos => (idioma === "es" ? es : en);

/** Idioma efectivo de un valor guardado en los ajustes. */
export const idiomaDe = (idioma: string | null | undefined): Idioma => (idioma === "es" ? "es" : "en");

/** Contexto con los textos del idioma actual; lo provee `main.tsx` alrededor de cada ventana. */
export const ContextoTextos = createContext<Textos>(en);

/** Textos del idioma actual, para usar dentro de los componentes. */
export const useTextos = () => useContext(ContextoTextos);
