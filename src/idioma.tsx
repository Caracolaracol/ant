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
  diarioSinCarpeta: "Open a chamber to use the diary.",
  cambiadaFueraDeAnt: (nombre: string) => `“${nombre}” changed outside Ant and was not overwritten. Cmd+S keeps your version.`,

  // Barra lateral.
  fijados: "Pinned",
  abiertas: "Open",
  cerrarNota: "Close note",
  yaNoEsta: "No longer in the folder",
  carpetaVacia: "No notes in this chamber yet.",
  fijarArriba: "Pin to top",
  quitarFijado: "Unpin",
  cambiarIcono: "Change icon…",
  iconoPorDefecto: "Default icon",
  gruposIconos: { lugares: "Places", escritura: "Writing", libros: "Books", ideas: "Ideas", mundo: "World", vida: "Life", animales: "Animals", codigo: "Code" },

  // Hormiguero y cámaras.
  hormigueroPorDefecto: "Anthill",
  nombreDeLaCarpeta: "Name",
  dentroDe: "Inside",
  cambiar: "Change…",
  cavarHormiguero: "Dig the anthill",
  camaraNueva: "New chamber",
  camaraNuevaBoton: "New chamber…",
  camaraNuevaAyuda: "A chamber is a context inside your anthill: your personal notes, everything about one novel, your work and its projects.",
  ejemplosDeCamaras: ["Personal", "My novel", "Work"],
  ejemplos: "Examples",
  cavarCamara: "Dig the chamber",
  camarasQueYaExisten: "Or open one you already have",
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
  hormiguero: "Anthill",
  hormigueroAyuda: "The folder where all your notes live. Changing it doesn’t move or delete anything.",
  camaras: "Chambers",
  camarasAyuda: "Each chamber is a folder inside your anthill, for one context. The sidebar shows the open one; switch to another here.",
  sinCamaras: "No chambers yet.",
  abierta: "Open",
  abrir: "Open",
  activarDiario: "Turn on diary mode",
  diarioAyuda: (ejemplo: ReactNode, carpeta: ReactNode): ReactNode => (
    <>
      Shows a calendar at the top of the sidebar. Click a day to open its note, named after the
      date (for example {ejemplo}). If the {carpeta} folder or the note do not exist yet, they are
      created inside the open chamber; if the folder already exists, it is used as is. The{" "}
      {carpeta} folder is hidden from the sidebar tree: you reach daily notes through the calendar.
      Days that already have a note show a dot.
    </>
  ),
  diarioAviso: "Open a chamber first: the Daily folder goes there.",
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
  compilarSinCarpeta: "Open a chamber first: one of its folders is compiled as a book.",
  carpetaLibro: "Folder",
  capitulos: "Chapters",
  capitulosAyuda: "Each note is a chapter. Uncheck the ones you leave out and use the arrows to change the order.",
  sinNotas: "This folder has no notes.",
  subir: "Move up",
  bajar: "Move down",
  palabrasN: (cantidadDePalabras: number) => `${cantidadDePalabras.toLocaleString("en-US")} words`,
  capitulosN: (capitulosIncluidos: number, totalDeCapitulos: number) => `${capitulosIncluidos} of ${totalDeCapitulos} chapters`,
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
  bienvenidaSeguir: "Follow the tunnel",
  bienvenidaVolver: "Back to my notes",
  bienvenidaLema: "Write without distractions.",
  bienvenidaPresentacion: "A simple, quiet place for stories, novels and notes. Let’s dig your anthill: it takes a minute.",
  bienvenidaArchivosEtiqueta: "How it works",
  bienvenidaArchivosTitulo: "Your texts are files",
  bienvenidaArchivosTexto: "Every note is a Markdown file in a folder on your computer. No accounts, no cloud, nothing to import.",
  bienvenidaArchivosNota: "Open them with any other app and back them up however you like.",
  bienvenidaHormigueroEtiqueta: "Your anthill",
  bienvenidaHormigueroTitulo: "Where your notes live",
  bienvenidaHormigueroTexto: "Your anthill is one folder for all your notes. Create a new one, or use a folder you already have, like an Obsidian vault.",
  bienvenidaHormigueroElegido: "Your anthill is",
  bienvenidaUsarOtroHormiguero: "Use another folder",
  bienvenidaCamarasEtiqueta: "Last chamber",
  bienvenidaCamarasTitulo: "Dig your first chamber",
  bienvenidaCamarasTexto: "Inside the anthill, each chamber is a context of its own: your personal notes, everything about one novel, your work as a developer and its projects. The sidebar shows one chamber at a time.",
  bienvenidaCamarasNota: "Dig as many as you want: switch between them in Settings, and dig another one with File → New Chamber…",
  bienvenidaFaltaHormiguero: "First choose your anthill, one chamber back.",
  bienvenidaVolverAlHormiguero: "Back to the anthill",
  bienvenidaRecorrido: "Welcome pages",
  bienvenidaPagina: (numeroDePagina: number) => `Page ${numeroDePagina}`,
};

export type TextosDeLaInterfaz = typeof en;

const es: TextosDeLaInterfaz = {
  locale: "es",

  sinTitulo: "Sin título",
  notaNueva: "Nota.md",
  filtroNotas: "Notas",
  conteo: (palabras, lineas, caracteres) => `${palabras} palabras · ${lineas} líneas · ${caracteres} caracteres`,
  cerrarNotaTitulo: "Cerrar nota",
  cambiosSinGuardar: (nombre) => `«${nombre}» tiene cambios sin guardar. ¿Cerrarla igual?`,
  descartarCambios: "Descartar cambios",
  cancelar: "Cancelar",
  diarioSinCarpeta: "Abre una cámara para usar el diario.",
  cambiadaFueraDeAnt: (nombre) => `«${nombre}» cambió fuera de Ant y no se sobrescribió. Cmd+S se queda con tu versión.`,

  fijados: "Fijados",
  abiertas: "Abiertas",
  cerrarNota: "Cerrar nota",
  yaNoEsta: "Ya no está en la carpeta",
  carpetaVacia: "Todavía no hay notas en esta cámara.",
  fijarArriba: "Fijar arriba",
  quitarFijado: "Quitar de fijados",
  cambiarIcono: "Cambiar icono…",
  iconoPorDefecto: "Icono por defecto",
  gruposIconos: { lugares: "Lugares", escritura: "Escritura", libros: "Libros", ideas: "Ideas", mundo: "Mundo", vida: "Vida", animales: "Animales", codigo: "Código" },

  hormigueroPorDefecto: "Hormiguero",
  nombreDeLaCarpeta: "Nombre",
  dentroDe: "Dentro de",
  cambiar: "Cambiar…",
  cavarHormiguero: "Cavar el hormiguero",
  camaraNueva: "Cámara nueva",
  camaraNuevaBoton: "Cámara nueva…",
  camaraNuevaAyuda: "Una cámara es un contexto dentro de tu hormiguero: tus notas personales, todo lo de una novela, el trabajo y sus proyectos.",
  ejemplosDeCamaras: ["Personal", "Mi novela", "Trabajo"],
  ejemplos: "Ejemplos",
  cavarCamara: "Cavar la cámara",
  camarasQueYaExisten: "O abre una que ya tienes",
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
  hormiguero: "Hormiguero",
  hormigueroAyuda: "La carpeta donde viven todas tus notas. Cambiarla no mueve ni borra nada.",
  camaras: "Cámaras",
  camarasAyuda: "Cada cámara es una carpeta dentro de tu hormiguero, para un contexto. La barra lateral muestra la abierta; se cambia aquí.",
  sinCamaras: "Todavía no hay cámaras.",
  abierta: "Abierta",
  abrir: "Abrir",
  activarDiario: "Activar el modo diario",
  diarioAyuda: (ejemplo, carpeta) => (
    <>
      Muestra un calendario arriba de la barra lateral. Al hacer clic en un día se abre su nota, con
      la fecha como nombre (por ejemplo {ejemplo}). Si la carpeta {carpeta} o la nota aún no existen,
      se crean dentro de la cámara abierta; si la carpeta ya existe, se usa esa. La carpeta{" "}
      {carpeta} no aparece en el árbol de la barra lateral: a las notas diarias se llega desde el
      calendario. Los días que ya tienen nota llevan un punto.
    </>
  ),
  diarioAviso: "Abre primero una cámara: ahí va la carpeta Daily.",
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
  compilarSinCarpeta: "Abre primero una cámara: se compila una de sus carpetas como libro.",
  carpetaLibro: "Carpeta",
  capitulos: "Capítulos",
  capitulosAyuda: "Cada nota es un capítulo. Desmarca las que quedan fuera y usa las flechas para cambiar el orden.",
  sinNotas: "Esta carpeta no tiene notas.",
  subir: "Subir",
  bajar: "Bajar",
  palabrasN: (cantidadDePalabras) => `${cantidadDePalabras.toLocaleString("es")} palabras`,
  capitulosN: (capitulosIncluidos, totalDeCapitulos) => `${capitulosIncluidos} de ${totalDeCapitulos} capítulos`,
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

  bienvenidaSeguir: "Sigue el túnel",
  bienvenidaVolver: "Volver a mis notas",
  bienvenidaLema: "Escribe sin distracciones.",
  bienvenidaPresentacion: "Un lugar simple y silencioso para cuentos, novelas y notas. Cavemos tu hormiguero: toma un minuto.",
  bienvenidaArchivosEtiqueta: "Cómo funciona",
  bienvenidaArchivosTitulo: "Tus textos son archivos",
  bienvenidaArchivosTexto: "Cada nota es un archivo Markdown en una carpeta de tu computador. Sin cuentas, sin nube, nada que importar.",
  bienvenidaArchivosNota: "Ábrelos con cualquier otra app y respáldalos como quieras.",
  bienvenidaHormigueroEtiqueta: "Tu hormiguero",
  bienvenidaHormigueroTitulo: "Donde viven tus notas",
  bienvenidaHormigueroTexto: "Tu hormiguero es una sola carpeta para todas tus notas. Crea una nueva o usa una que ya tengas, como una bóveda de Obsidian.",
  bienvenidaHormigueroElegido: "Tu hormiguero es",
  bienvenidaUsarOtroHormiguero: "Usar otra carpeta",
  bienvenidaCamarasEtiqueta: "Última cámara",
  bienvenidaCamarasTitulo: "Cava tu primera cámara",
  bienvenidaCamarasTexto: "Dentro del hormiguero, cada cámara es un contexto propio: tus notas personales, todo lo de una novela, tu trabajo de desarrollador y sus proyectos. La barra lateral muestra una cámara a la vez.",
  bienvenidaCamarasNota: "Cava todas las que quieras: pasa de una a otra en Ajustes y cava otra con Archivo → Cámara nueva…",
  bienvenidaFaltaHormiguero: "Primero elige tu hormiguero, una cámara atrás.",
  bienvenidaVolverAlHormiguero: "Volver al hormiguero",
  bienvenidaRecorrido: "Páginas de bienvenida",
  bienvenidaPagina: (numeroDePagina) => `Página ${numeroDePagina}`,
};

/** Textos del idioma pedido; cualquier valor desconocido (o vacío) cae en inglés. */
export const textosDelIdioma = (idioma: string | null | undefined): TextosDeLaInterfaz => (idioma === "es" ? es : en);

/** Idioma efectivo de un valor guardado en los ajustes. */
export const idiomaValido = (idioma: string | null | undefined): Idioma => (idioma === "es" ? "es" : "en");

/** Contexto con los textos del idioma actual; lo provee `main.tsx` alrededor de cada ventana. */
export const ContextoDeTextos = createContext<TextosDeLaInterfaz>(en);

/** Textos del idioma actual, para usar dentro de los componentes. */
export const useTextos = () => useContext(ContextoDeTextos);
