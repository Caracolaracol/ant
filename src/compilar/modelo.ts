// Compilación de un libro: convierte las notas de una carpeta (Markdown) en un modelo simple de
// libro —capítulos, párrafos, títulos, cambios de escena— que después `docx.ts` y `pdf.ts`
// convierten en Word y PDF. Usa el mismo analizador de Markdown que el editor (Lezer, vía
// @codemirror/lang-markdown), así que no suma peso a la app.
//
// Pensado para prosa:
//   · Cada línea es un párrafo (como en Obsidian): no hace falta dejar una línea en blanco.
//   · `***`, `* * *`, `---` solo, `#` solo o `⁂` marcan un cambio de escena.
//   · Lo que está entre `%% … %%` (notas para uno mismo) no se exporta, ni el encabezado YAML.
//   · Los enlaces de Obsidian `[[Nota|texto]]` dejan solo el texto; las imágenes se omiten.
//   · Opcionalmente corrige la tipografía (comillas, rayas, puntos suspensivos) de todo el
//     texto con las mismas reglas del modo escritor, sin tocar los archivos.

import { markdownLanguage } from "@codemirror/lang-markdown";
import { reemplazoTipografico, type ConfiguracionModoEscritor } from "../editor/escritor.ts";

/** Un trozo de texto con un mismo estilo. */
export interface TramoDeTexto {
  texto: string;
  enCursiva?: boolean;
  enNegrita?: boolean;
  estaTachado?: boolean;
  esCodigo?: boolean;
}

/** Estilo de un tramo (todo menos el texto). */
type EstiloDeTramo = Omit<TramoDeTexto, "texto">;

/** Un bloque del texto de un capítulo. */
export type BloqueDelCapitulo =
  | { tipo: "parrafo"; tramos: TramoDeTexto[]; esCita?: boolean; sinSangria?: boolean }
  | { tipo: "titulo"; nivel: number; tramos: TramoDeTexto[] }
  | { tipo: "escena" }
  | { tipo: "codigo"; lineas: string[] };

export interface Capitulo {
  /** Título del capítulo, o `null` si no lleva. */
  titulo: string | null;
  bloques: BloqueDelCapitulo[];
}

export interface Libro {
  titulo: string;
  nombreDelAutor: string;
  capitulos: Capitulo[];
  /** Palabras de todo el libro (sin contar títulos de capítulo). */
  cantidadDePalabras: number;
}

/**
 * De dónde sale el título de cada capítulo: el primer título de la nota, el nombre del archivo o
 * ninguno. (Los valores se guardan en las opciones de compilación de cada carpeta.)
 */
export type OrigenDelTituloDeCadaCapitulo = "titulo" | "archivo" | "ninguno";

/** Una nota a compilar: su nombre de archivo y su texto. */
export interface NotaParaCompilar {
  nombreDelArchivo: string;
  texto: string;
}

/** Nodo del árbol de sintaxis (el tipo viene de @lezer/common, que no es dependencia directa). */
type NodoDelMarkdown = ReturnType<typeof markdownLanguage.parser.parse>["topNode"];

/** Marcas de sintaxis que no forman parte del texto. */
const MARCAS_DE_SINTAXIS_QUE_NO_SON_TEXTO = new Set([
  "EmphasisMark", "StrikethroughMark", "CodeMark", "LinkMark", "QuoteMark", "HeaderMark", "ListMark",
  "LinkTitle", "LinkLabel", "HTMLTag", "Comment", "Image", "TaskMarker", "CodeInfo",
]);

/** Entidades HTML más comunes, por si el texto trae alguna. */
const ENTIDADES_HTML: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…", laquo: "«", raquo: "»",
};

/** Una línea que, sola, marca un cambio de escena. */
const LINEA_DE_CAMBIO_DE_ESCENA = /^\s*((\*\s*){3,}|(-\s*){3,}|(_\s*){3,}|(#\s*)+|⁂|~{3,})\s*$/;

/** Quita lo que nunca se exporta: encabezado YAML, comentarios `%% %%`, imágenes y enlaces de Obsidian. */
function quitarLoQueNoSeExporta(textoDeLaNota: string): string {
  return textoDeLaNota
    .replace(/\r\n?/g, "\n")
    .replace(/^---\n[\s\S]*?\n---[ \t]*(\n|$)/, "")
    .replace(/%%[\s\S]*?%%/g, "")
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1");
}

/** Recorre el contenido en línea de `nodo` y devuelve sus tramos con estilo. */
function tramosConEstilo(nodo: NodoDelMarkdown, textoFuente: string, estiloHeredado: EstiloDeTramo = {}): TramoDeTexto[] {
  const tramos: TramoDeTexto[] = [];
  const agregarTexto = (texto: string, estilo = estiloHeredado) => {
    if (!texto) return;
    const ultimoTramo = tramos[tramos.length - 1];
    // Une tramos seguidos del mismo estilo, para no partir palabras sin necesidad.
    const tieneElMismoEstilo =
      ultimoTramo &&
      ultimoTramo.enCursiva === estilo.enCursiva &&
      ultimoTramo.enNegrita === estilo.enNegrita &&
      ultimoTramo.estaTachado === estilo.estaTachado &&
      ultimoTramo.esCodigo === estilo.esCodigo;
    if (tieneElMismoEstilo) ultimoTramo.texto += texto;
    else tramos.push({ texto, ...estilo });
  };
  let posicionLeida = nodo.from;
  for (let hijo = nodo.firstChild; hijo; hijo = hijo.nextSibling) {
    if (hijo.from > posicionLeida) agregarTexto(textoFuente.slice(posicionLeida, hijo.from));
    posicionLeida = hijo.to;
    const tipoDeNodo = hijo.name;
    // Una URL suelta en el texto se deja; la de un enlace `[texto](url)` no.
    if (tipoDeNodo === "URL") {
      if (nodo.name !== "Link") agregarTexto(textoFuente.slice(hijo.from, hijo.to));
    } else if (tipoDeNodo === "Autolink") {
      const direccion = hijo.getChild("URL");
      if (direccion) agregarTexto(textoFuente.slice(direccion.from, direccion.to));
    } else if (MARCAS_DE_SINTAXIS_QUE_NO_SON_TEXTO.has(tipoDeNodo)) {
      continue;
    } else if (tipoDeNodo === "Escape") {
      agregarTexto(textoFuente.slice(hijo.from + 1, hijo.to));
    } else if (tipoDeNodo === "HardBreak") {
      agregarTexto("\n");
    } else if (tipoDeNodo === "Entity") {
      const nombreDeLaEntidad = textoFuente.slice(hijo.from + 1, hijo.to - 1);
      const entidadNumerica = /^#x([0-9a-f]+)$/i.exec(nombreDeLaEntidad) ?? /^#(\d+)$/.exec(nombreDeLaEntidad);
      agregarTexto(
        entidadNumerica
          ? String.fromCodePoint(parseInt(entidadNumerica[1], entidadNumerica[0].startsWith("#x") ? 16 : 10))
          : (ENTIDADES_HTML[nombreDeLaEntidad] ?? textoFuente.slice(hijo.from, hijo.to)),
      );
    } else {
      const estiloDelHijo =
        tipoDeNodo === "Emphasis" ? { ...estiloHeredado, enCursiva: true } :
        tipoDeNodo === "StrongEmphasis" ? { ...estiloHeredado, enNegrita: true } :
        tipoDeNodo === "Strikethrough" ? { ...estiloHeredado, estaTachado: true } :
        tipoDeNodo === "InlineCode" ? { ...estiloHeredado, esCodigo: true } :
        estiloHeredado;
      for (const tramo of tramosConEstilo(hijo, textoFuente, estiloDelHijo)) agregarTexto(tramo.texto, tramo);
    }
  }
  if (nodo.to > posicionLeida) agregarTexto(textoFuente.slice(posicionLeida, nodo.to));
  return tramos;
}

/** Parte los tramos en líneas (cada salto de línea empieza un párrafo nuevo) y recorta los espacios de los bordes. */
function partirEnLineas(tramos: TramoDeTexto[]): TramoDeTexto[][] {
  const lineas: TramoDeTexto[][] = [[]];
  for (const tramo of tramos) {
    tramo.texto.split("\n").forEach((parteDelTramo, numeroDeParte) => {
      if (numeroDeParte > 0) lineas.push([]);
      if (parteDelTramo) lineas[lineas.length - 1].push({ ...tramo, texto: parteDelTramo });
    });
  }
  return lineas
    .map((linea) => {
      if (linea.length) {
        linea[0] = { ...linea[0], texto: linea[0].texto.trimStart() };
        linea[linea.length - 1] = { ...linea[linea.length - 1], texto: linea[linea.length - 1].texto.trimEnd() };
      }
      return linea.filter((tramo) => tramo.texto);
    })
    .filter((linea) => linea.length);
}

/** Texto plano de unos tramos. */
export const textoPlanoDe = (tramos: TramoDeTexto[]) => tramos.map((tramo) => tramo.texto).join("");

/** Convierte un bloque de Markdown (y sus hijos) en bloques del libro. */
function bloquesDelNodo(nodo: NodoDelMarkdown, textoFuente: string, estaEnUnaCita = false): BloqueDelCapitulo[] {
  const tipoDeNodo = nodo.name;
  const tituloDeMarkdown = /^(ATXHeading|SetextHeading)(\d)$/.exec(tipoDeNodo);
  if (tituloDeMarkdown) {
    const tramos = partirEnLineas(tramosConEstilo(nodo, textoFuente)).flat();
    // `#` o `# # #` solos son un cambio de escena, no un título vacío.
    if (!textoPlanoDe(tramos).replace(/[#\s]/g, "")) return [{ tipo: "escena" }];
    return [{ tipo: "titulo", nivel: Number(tituloDeMarkdown[2]), tramos }];
  }
  switch (tipoDeNodo) {
    case "Paragraph":
      return partirEnLineas(tramosConEstilo(nodo, textoFuente)).map((tramos): BloqueDelCapitulo =>
        LINEA_DE_CAMBIO_DE_ESCENA.test(textoPlanoDe(tramos)) ? { tipo: "escena" } : { tipo: "parrafo", tramos, esCita: estaEnUnaCita },
      );
    case "HorizontalRule":
      return [{ tipo: "escena" }];
    case "Blockquote": {
      const bloques: BloqueDelCapitulo[] = [];
      for (let hijo = nodo.firstChild; hijo; hijo = hijo.nextSibling) {
        if (hijo.name !== "QuoteMark") bloques.push(...bloquesDelNodo(hijo, textoFuente, true));
      }
      return bloques;
    }
    case "BulletList":
    case "OrderedList": {
      const bloques: BloqueDelCapitulo[] = [];
      let numeroDeItem = 0;
      for (let item = nodo.firstChild; item; item = item.nextSibling) {
        if (item.name !== "ListItem") continue;
        numeroDeItem++;
        const marcaDelItem = item.getChild("ListMark");
        const vineta =
          tipoDeNodo === "OrderedList"
            ? `${marcaDelItem ? textoFuente.slice(marcaDelItem.from, marcaDelItem.to) : `${numeroDeItem}.`} `
            : "• ";
        let esElPrimerBloqueDelItem = true;
        for (let hijo = item.firstChild; hijo; hijo = hijo.nextSibling) {
          if (hijo.name === "ListMark") continue;
          bloques.push(...conVinetaDeLista(bloquesDelNodo(hijo, textoFuente, estaEnUnaCita), esElPrimerBloqueDelItem ? vineta : ""));
          esElPrimerBloqueDelItem = false;
        }
      }
      return bloques;
    }
    case "Task":
      return partirEnLineas(tramosConEstilo(nodo, textoFuente)).map((tramos): BloqueDelCapitulo => ({ tipo: "parrafo", tramos, esCita: estaEnUnaCita }));
    case "FencedCode":
    case "CodeBlock": {
      const lineasDeCodigo: string[] = [];
      for (let hijo = nodo.firstChild; hijo; hijo = hijo.nextSibling) {
        if (hijo.name === "CodeText") lineasDeCodigo.push(...textoFuente.slice(hijo.from, hijo.to).split("\n"));
      }
      return lineasDeCodigo.length ? [{ tipo: "codigo", lineas: lineasDeCodigo }] : [];
    }
    case "Table":
      // Cada fila como un párrafo, con las celdas separadas; la fila de guiones se omite.
      return textoFuente
        .slice(nodo.from, nodo.to)
        .split("\n")
        .filter((fila) => fila.trim() && !/^\s*\|?[\s:|-]+\|?\s*$/.test(fila))
        .map((fila): BloqueDelCapitulo => ({
          tipo: "parrafo",
          sinSangria: true,
          tramos: [{ texto: fila.trim().replace(/^\||\|$/g, "").split("|").map((celda) => celda.trim()).join("  ·  ") }],
        }));
    case "HTMLBlock":
    case "CommentBlock":
    case "LinkReference":
    case "ProcessingInstructionBlock":
      return [];
    default:
      return partirEnLineas(tramosConEstilo(nodo, textoFuente)).map((tramos): BloqueDelCapitulo => ({ tipo: "parrafo", tramos, esCita: estaEnUnaCita }));
  }
}

/** Pone la viñeta de una lista delante del primer párrafo de un ítem (sin sangría). */
function conVinetaDeLista(bloques: BloqueDelCapitulo[], vineta: string): BloqueDelCapitulo[] {
  return bloques.map((bloque, posicion) =>
    bloque.tipo === "parrafo"
      ? { ...bloque, sinSangria: true, tramos: posicion === 0 && vineta ? [{ texto: vineta }, ...bloque.tramos] : bloque.tramos }
      : bloque,
  );
}

/** Convierte el texto de una nota en bloques. */
export function analizarNotaEnBloques(textoDeLaNota: string): BloqueDelCapitulo[] {
  const textoFuente = quitarLoQueNoSeExporta(textoDeLaNota);
  const arbolDelMarkdown = markdownLanguage.parser.parse(textoFuente);
  const bloques: BloqueDelCapitulo[] = [];
  for (let hijo = arbolDelMarkdown.topNode.firstChild; hijo; hijo = hijo.nextSibling) bloques.push(...bloquesDelNodo(hijo, textoFuente));
  return bloques;
}

/** Corrige la tipografía de unos tramos simulando que se teclean con el modo escritor (el código no se toca). */
function corregirTipografiaDeTramos(tramos: TramoDeTexto[], configuracion: ConfiguracionModoEscritor): TramoDeTexto[] {
  let lineaHastaAhora = "";
  return tramos.map((tramo) => {
    if (tramo.esCodigo) {
      lineaHastaAhora += tramo.texto;
      return tramo;
    }
    let textoCorregido = "";
    for (const caracter of tramo.texto) {
      const reemplazo = reemplazoTipografico(lineaHastaAhora, caracter, configuracion);
      // Si el reemplazo tendría que borrar texto de un tramo anterior (otro estilo), se omite.
      if (reemplazo && reemplazo.caracteresQueSeBorran <= textoCorregido.length) {
        textoCorregido = textoCorregido.slice(0, textoCorregido.length - reemplazo.caracteresQueSeBorran) + reemplazo.textoQueSeInserta;
        lineaHastaAhora = lineaHastaAhora.slice(0, lineaHastaAhora.length - reemplazo.caracteresQueSeBorran) + reemplazo.textoQueSeInserta;
      } else {
        textoCorregido += caracter;
        lineaHastaAhora += caracter;
      }
    }
    return { ...tramo, texto: textoCorregido };
  });
}

/** Corrige la tipografía de todos los párrafos y títulos de unos bloques. */
function corregirTipografiaDeBloques(bloques: BloqueDelCapitulo[], configuracion: ConfiguracionModoEscritor): BloqueDelCapitulo[] {
  return bloques.map((bloque) =>
    bloque.tipo === "parrafo" || bloque.tipo === "titulo" ? { ...bloque, tramos: corregirTipografiaDeTramos(bloque.tramos, configuracion) } : bloque,
  );
}

/** Nombre de archivo como título: sin extensión ni la numeración del principio («01 - El viaje» → «El viaje»). */
export function tituloDesdeElNombreDelArchivo(nombreDelArchivo: string): string {
  const nombreSinExtension = nombreDelArchivo.replace(/\.(md|markdown|txt)$/i, "");
  return nombreSinExtension.replace(/^\d+[\s._)-]*/, "").trim() || nombreSinExtension;
}

/** Cuenta las palabras de unos bloques (las rayas y signos sueltos no cuentan). */
export function contarPalabrasDeBloques(bloques: BloqueDelCapitulo[]): number {
  let cantidadDePalabras = 0;
  for (const bloque of bloques) {
    if (bloque.tipo !== "parrafo" && bloque.tipo !== "titulo") continue;
    for (const palabra of textoPlanoDe(bloque.tramos).split(/\s+/)) if (/[\p{L}\p{N}]/u.test(palabra)) cantidadDePalabras++;
  }
  return cantidadDePalabras;
}

/** Quita los cambios de escena del principio y del final, y los repetidos seguidos. */
function limpiarCambiosDeEscena(bloques: BloqueDelCapitulo[]): BloqueDelCapitulo[] {
  const bloquesLimpios: BloqueDelCapitulo[] = [];
  for (const bloque of bloques) {
    const sobraEsteCambioDeEscena =
      bloque.tipo === "escena" && (!bloquesLimpios.length || bloquesLimpios[bloquesLimpios.length - 1].tipo === "escena");
    if (!sobraEsteCambioDeEscena) bloquesLimpios.push(bloque);
  }
  while (bloquesLimpios.length && bloquesLimpios[bloquesLimpios.length - 1].tipo === "escena") bloquesLimpios.pop();
  return bloquesLimpios;
}

/**
 * Compila un libro con las notas en el orden dado. El título de cada capítulo sale del primer
 * título de la nota (si la nota empieza con uno), del nombre del archivo, o no lleva.
 * Con `configuracionTipografica`, corrige comillas, rayas y puntos suspensivos de todo el texto.
 */
export function compilarLibro(
  notas: NotaParaCompilar[],
  opciones: {
    titulo: string;
    nombreDelAutor: string;
    origenDelTitulo: OrigenDelTituloDeCadaCapitulo;
    configuracionTipografica: ConfiguracionModoEscritor | null;
  },
): Libro {
  const capitulos: Capitulo[] = notas.map((nota) => {
    let bloques = analizarNotaEnBloques(nota.texto);
    if (opciones.configuracionTipografica) bloques = corregirTipografiaDeBloques(bloques, opciones.configuracionTipografica);
    let tituloDelCapitulo: string | null = null;
    if (opciones.origenDelTitulo === "titulo") {
      const primerBloque = bloques[0];
      if (primerBloque?.tipo === "titulo") {
        tituloDelCapitulo = textoPlanoDe(primerBloque.tramos);
        bloques = bloques.slice(1);
      } else tituloDelCapitulo = tituloDesdeElNombreDelArchivo(nota.nombreDelArchivo);
    } else if (opciones.origenDelTitulo === "archivo") {
      tituloDelCapitulo = tituloDesdeElNombreDelArchivo(nota.nombreDelArchivo);
    }
    return { titulo: tituloDelCapitulo, bloques: limpiarCambiosDeEscena(bloques) };
  });
  const cantidadDePalabras = capitulos.reduce((total, capitulo) => total + contarPalabrasDeBloques(capitulo.bloques), 0);
  return { titulo: opciones.titulo, nombreDelAutor: opciones.nombreDelAutor, capitulos, cantidadDePalabras };
}
