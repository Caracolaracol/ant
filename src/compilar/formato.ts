// Lo que comparten la exportación a Word (`docx.ts`) y a PDF (`pdf.ts`): los dos estilos de
// libro, el tamaño de página y los pocos textos que se imprimen (portada, «FIN»).
//   · Manuscrito estándar: el formato que piden editoriales, agentes y concursos. Times 12, doble
//     espacio, márgenes de una pulgada, sangría de primera línea, encabezado «Apellido / Título /
//     página», portada con el conteo de palabras y cada capítulo en página nueva.
//   · Libro: para leer o imprimir. Página A5, letra con serifa, texto justificado, el primer
//     párrafo de cada capítulo y escena sin sangría y número de página al pie.

/** Estilo del libro exportado (se guarda en las opciones de compilación de cada carpeta). */
export type EstiloDelLibro = "manuscrito" | "libro";
/** Tamaño de página del manuscrito (se guarda en las opciones de compilación de cada carpeta). */
export type TamanoDePagina = "carta" | "a4";

export interface OpcionesDeExportacion {
  estilo: EstiloDelLibro;
  /** Tamaño de página del manuscrito (el estilo libro siempre usa A5). */
  tamanoDePagina: TamanoDePagina;
  /** Idioma de los textos que agrega la exportación y del corrector de Word. */
  idioma: "en" | "es";
}

/** Tamaños de página en puntos (1/72 de pulgada). */
export const TAMANOS_DE_PAGINA_EN_PUNTOS = {
  carta: { ancho: 612, alto: 792 },
  a4: { ancho: 595.28, alto: 841.89 },
  a5: { ancho: 419.53, alto: 595.28 },
} as const;

/** Tamaño de página que corresponde a las opciones: A5 para el estilo libro, el elegido para el manuscrito. */
export const tamanoDePaginaDelLibro = (opciones: OpcionesDeExportacion) =>
  opciones.estilo === "libro" ? TAMANOS_DE_PAGINA_EN_PUNTOS.a5 : TAMANOS_DE_PAGINA_EN_PUNTOS[opciones.tamanoDePagina];

/** Textos que agrega la exportación (portada y final), en el idioma del libro. */
export function textosQueAgregaLaExportacion(idioma: "en" | "es") {
  return idioma === "es"
    ? { antesDelAutor: "por", alFinal: "FIN", conteoDePalabras: (cantidad: number) => `aprox. ${cantidad.toLocaleString("es")} palabras` }
    : { antesDelAutor: "by", alFinal: "END", conteoDePalabras: (cantidad: number) => `about ${cantidad.toLocaleString("en-US")} words` };
}

/** Apellido del autor para el encabezado del manuscrito (la última palabra del nombre). */
export const apellidoDelAutor = (nombreDelAutor: string) => nombreDelAutor.trim().split(/\s+/).pop() ?? "";

/** Encabezado del manuscrito sin el número de página: «Apellido / Título / ». */
export const encabezadoDelManuscrito = (nombreDelAutor: string, tituloDelLibro: string) =>
  [apellidoDelAutor(nombreDelAutor), tituloDelLibro].filter(Boolean).join(" / ") + " / ";

/** Palabras redondeadas para la portada del manuscrito: a la centena en textos cortos, al millar en novelas. */
export function palabrasRedondeadasParaLaPortada(cantidadDePalabras: number): number {
  if (cantidadDePalabras < 1000) return Math.max(100, Math.round(cantidadDePalabras / 100) * 100);
  return cantidadDePalabras < 17500 ? Math.round(cantidadDePalabras / 100) * 100 : Math.round(cantidadDePalabras / 1000) * 1000;
}

/** Texto del conteo de la portada, por ejemplo «aprox. 82.000 palabras». */
export const textoDelConteoDePalabras = (cantidadDePalabras: number, textos: ReturnType<typeof textosQueAgregaLaExportacion>) =>
  textos.conteoDePalabras(palabrasRedondeadasParaLaPortada(cantidadDePalabras));
