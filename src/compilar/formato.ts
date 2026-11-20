// Lo que comparten la exportación a Word (`docx.ts`) y a PDF (`pdf.ts`): los dos estilos de
// libro, el tamaño de página y los pocos textos que se imprimen (portada, «FIN»).
//   · Manuscrito estándar: el formato que piden editoriales, agentes y concursos. Times 12, doble
//     espacio, márgenes de una pulgada, sangría de primera línea, encabezado «Apellido / Título /
//     página», portada con el conteo de palabras y cada capítulo en página nueva.
//   · Libro: para leer o imprimir. Página A5, letra con serifa, texto justificado, el primer
//     párrafo de cada capítulo y escena sin sangría y número de página al pie.

export type EstiloLibro = "manuscrito" | "libro";
export type TamanoPagina = "carta" | "a4";

export interface OpcionesExportar {
  estilo: EstiloLibro;
  /** Tamaño de página del manuscrito (el estilo libro siempre usa A5). */
  pagina: TamanoPagina;
  /** Idioma de los textos que agrega la exportación y del corrector de Word. */
  idioma: "en" | "es";
}

/** Tamaños de página en puntos (1/72 de pulgada). */
export const PAGINAS = {
  carta: { ancho: 612, alto: 792 },
  a4: { ancho: 595.28, alto: 841.89 },
  a5: { ancho: 419.53, alto: 595.28 },
} as const;

/** Tamaño de página que corresponde a las opciones. */
export const paginaDe = (o: OpcionesExportar) => (o.estilo === "libro" ? PAGINAS.a5 : PAGINAS[o.pagina]);

/** Textos que agrega la exportación, en el idioma del libro. */
export function textosExportar(idioma: "en" | "es") {
  return idioma === "es"
    ? { por: "por", fin: "FIN", palabras: (n: number) => `aprox. ${n.toLocaleString("es")} palabras` }
    : { por: "by", fin: "END", palabras: (n: number) => `about ${n.toLocaleString("en-US")} words` };
}

/** Apellido del autor para el encabezado del manuscrito (la última palabra del nombre). */
export const apellido = (autor: string) => autor.trim().split(/\s+/).pop() ?? "";

/** Encabezado del manuscrito sin el número de página: «Apellido / Título / ». */
export const encabezadoManuscrito = (autor: string, titulo: string) =>
  [apellido(autor), titulo].filter(Boolean).join(" / ") + " / ";

/** Palabras redondeadas para la portada del manuscrito: a la centena en textos cortos, al millar en novelas. */
export function palabrasRedondeadas(n: number): number {
  if (n < 1000) return Math.max(100, Math.round(n / 100) * 100);
  return n < 17500 ? Math.round(n / 100) * 100 : Math.round(n / 1000) * 1000;
}

/** Texto del conteo de la portada, por ejemplo «aprox. 82.000 palabras». */
export const palabrasRedondeadasTexto = (n: number, tx: ReturnType<typeof textosExportar>) => tx.palabras(palabrasRedondeadas(n));
