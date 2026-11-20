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
import { reemplazo, type ConfigEscritor } from "../editor/escritor.ts";

/** Un trozo de texto con un mismo estilo. */
export interface Tramo {
  texto: string;
  cursiva?: boolean;
  negrita?: boolean;
  tachado?: boolean;
  codigo?: boolean;
}

/** Un bloque del texto de un capítulo. */
export type Bloque =
  | { tipo: "parrafo"; tramos: Tramo[]; cita?: boolean; sinSangria?: boolean }
  | { tipo: "titulo"; nivel: number; tramos: Tramo[] }
  | { tipo: "escena" }
  | { tipo: "codigo"; lineas: string[] };

export interface Capitulo {
  /** Título del capítulo, o `null` si no lleva. */
  titulo: string | null;
  bloques: Bloque[];
}

export interface Libro {
  titulo: string;
  autor: string;
  capitulos: Capitulo[];
  /** Palabras de todo el libro (sin contar títulos de capítulo). */
  palabras: number;
}

/** De dónde sale el título de cada capítulo. */
export type OrigenTitulo = "titulo" | "archivo" | "ninguno";

/** Una nota a compilar: su nombre de archivo y su texto. */
export interface NotaCompilar {
  nombre: string;
  texto: string;
}

/** Nodo del árbol de sintaxis (el tipo viene de @lezer/common, que no es dependencia directa). */
type Nodo = ReturnType<typeof markdownLanguage.parser.parse>["topNode"];

/** Marcas de sintaxis que no forman parte del texto. */
const MARCAS = new Set([
  "EmphasisMark", "StrikethroughMark", "CodeMark", "LinkMark", "QuoteMark", "HeaderMark", "ListMark",
  "LinkTitle", "LinkLabel", "HTMLTag", "Comment", "Image", "TaskMarker", "CodeInfo",
]);

/** Entidades HTML más comunes, por si el texto trae alguna. */
const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…", laquo: "«", raquo: "»" };

/** Una línea que, sola, marca un cambio de escena. */
const ESCENA = /^\s*((\*\s*){3,}|(-\s*){3,}|(_\s*){3,}|(#\s*)+|⁂|~{3,})\s*$/;

/** Quita lo que nunca se exporta: encabezado YAML, comentarios `%% %%`, imágenes y enlaces de Obsidian. */
function limpiar(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(/^---\n[\s\S]*?\n---[ \t]*(\n|$)/, "")
    .replace(/%%[\s\S]*?%%/g, "")
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1");
}

/** Recorre el contenido en línea de `nodo` y devuelve sus tramos con estilo. */
function enLinea(nodo: Nodo, src: string, estilo: Omit<Tramo, "texto"> = {}): Tramo[] {
  const tramos: Tramo[] = [];
  const agregar = (texto: string, e = estilo) => {
    if (!texto) return;
    const ultimo = tramos[tramos.length - 1];
    // Une tramos seguidos del mismo estilo, para no partir palabras sin necesidad.
    if (ultimo && ultimo.cursiva === e.cursiva && ultimo.negrita === e.negrita && ultimo.tachado === e.tachado && ultimo.codigo === e.codigo) {
      ultimo.texto += texto;
    } else tramos.push({ texto, ...e });
  };
  let pos = nodo.from;
  for (let h = nodo.firstChild; h; h = h.nextSibling) {
    if (h.from > pos) agregar(src.slice(pos, h.from));
    pos = h.to;
    const n = h.name;
    // Una URL suelta en el texto se deja; la de un enlace `[texto](url)` no.
    if (n === "URL") {
      if (nodo.name !== "Link") agregar(src.slice(h.from, h.to));
    } else if (n === "Autolink") {
      const url = h.getChild("URL");
      if (url) agregar(src.slice(url.from, url.to));
    } else if (MARCAS.has(n)) {
      continue;
    } else if (n === "Escape") {
      agregar(src.slice(h.from + 1, h.to));
    } else if (n === "HardBreak") {
      agregar("\n");
    } else if (n === "Entity") {
      const ent = src.slice(h.from + 1, h.to - 1);
      const num = /^#x([0-9a-f]+)$/i.exec(ent) ?? /^#(\d+)$/.exec(ent);
      agregar(num ? String.fromCodePoint(parseInt(num[1], num[0].startsWith("#x") ? 16 : 10)) : (ENTIDADES[ent] ?? src.slice(h.from, h.to)));
    } else {
      const sub =
        n === "Emphasis" ? { ...estilo, cursiva: true } :
        n === "StrongEmphasis" ? { ...estilo, negrita: true } :
        n === "Strikethrough" ? { ...estilo, tachado: true } :
        n === "InlineCode" ? { ...estilo, codigo: true } :
        estilo;
      for (const t of enLinea(h, src, sub)) agregar(t.texto, t);
    }
  }
  if (nodo.to > pos) agregar(src.slice(pos, nodo.to));
  return tramos;
}

/** Parte los tramos en líneas (cada salto de línea empieza un párrafo nuevo) y recorta los espacios de los bordes. */
function enLineas(tramos: Tramo[]): Tramo[][] {
  const lineas: Tramo[][] = [[]];
  for (const t of tramos) {
    t.texto.split("\n").forEach((parte, i) => {
      if (i > 0) lineas.push([]);
      if (parte) lineas[lineas.length - 1].push({ ...t, texto: parte });
    });
  }
  return lineas
    .map((l) => {
      if (l.length) {
        l[0] = { ...l[0], texto: l[0].texto.trimStart() };
        l[l.length - 1] = { ...l[l.length - 1], texto: l[l.length - 1].texto.trimEnd() };
      }
      return l.filter((t) => t.texto);
    })
    .filter((l) => l.length);
}

/** Texto plano de unos tramos. */
export const textoDe = (tramos: Tramo[]) => tramos.map((t) => t.texto).join("");

/** Convierte un bloque de Markdown (y sus hijos) en bloques del libro. */
function bloques(nodo: Nodo, src: string, cita = false): Bloque[] {
  const n = nodo.name;
  const titulo = /^(ATXHeading|SetextHeading)(\d)$/.exec(n);
  if (titulo) {
    const tramos = enLineas(enLinea(nodo, src)).flat();
    // `#` o `# # #` solos son un cambio de escena, no un título vacío.
    if (!textoDe(tramos).replace(/[#\s]/g, "")) return [{ tipo: "escena" }];
    return [{ tipo: "titulo", nivel: Number(titulo[2]), tramos }];
  }
  switch (n) {
    case "Paragraph":
      return enLineas(enLinea(nodo, src)).map((tramos): Bloque =>
        ESCENA.test(textoDe(tramos)) ? { tipo: "escena" } : { tipo: "parrafo", tramos, cita },
      );
    case "HorizontalRule":
      return [{ tipo: "escena" }];
    case "Blockquote": {
      const out: Bloque[] = [];
      for (let h = nodo.firstChild; h; h = h.nextSibling) if (h.name !== "QuoteMark") out.push(...bloques(h, src, true));
      return out;
    }
    case "BulletList":
    case "OrderedList": {
      const out: Bloque[] = [];
      let numero = 0;
      for (let item = nodo.firstChild; item; item = item.nextSibling) {
        if (item.name !== "ListItem") continue;
        numero++;
        const marca = item.getChild("ListMark");
        const vineta = n === "OrderedList" ? `${marca ? src.slice(marca.from, marca.to) : `${numero}.`} ` : "• ";
        let primero = true;
        for (let h = item.firstChild; h; h = h.nextSibling) {
          if (h.name === "ListMark") continue;
          out.push(...conVineta(bloques(h, src, cita), primero ? vineta : ""));
          primero = false;
        }
      }
      return out;
    }
    case "Task":
      return enLineas(enLinea(nodo, src)).map((tramos): Bloque => ({ tipo: "parrafo", tramos, cita }));
    case "FencedCode":
    case "CodeBlock": {
      const lineas: string[] = [];
      for (let h = nodo.firstChild; h; h = h.nextSibling) if (h.name === "CodeText") lineas.push(...src.slice(h.from, h.to).split("\n"));
      return lineas.length ? [{ tipo: "codigo", lineas }] : [];
    }
    case "Table":
      // Cada fila como un párrafo, con las celdas separadas; la fila de guiones se omite.
      return src
        .slice(nodo.from, nodo.to)
        .split("\n")
        .filter((l) => l.trim() && !/^\s*\|?[\s:|-]+\|?\s*$/.test(l))
        .map((l): Bloque => ({ tipo: "parrafo", sinSangria: true, tramos: [{ texto: l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()).join("  ·  ") }] }));
    case "HTMLBlock":
    case "CommentBlock":
    case "LinkReference":
    case "ProcessingInstructionBlock":
      return [];
    default: {
      const tramos = enLineas(enLinea(nodo, src));
      return tramos.map((t): Bloque => ({ tipo: "parrafo", tramos: t, cita }));
    }
  }
}

/** Pone la viñeta de una lista delante del primer párrafo de un ítem (sin sangría). */
function conVineta(bs: Bloque[], vineta: string): Bloque[] {
  return bs.map((b, i) =>
    b.tipo === "parrafo" ? { ...b, sinSangria: true, tramos: i === 0 && vineta ? [{ texto: vineta }, ...b.tramos] : b.tramos } : b,
  );
}

/** Convierte el texto de una nota en bloques. */
export function analizar(texto: string): Bloque[] {
  const src = limpiar(texto);
  const arbol = markdownLanguage.parser.parse(src);
  const out: Bloque[] = [];
  for (let h = arbol.topNode.firstChild; h; h = h.nextSibling) out.push(...bloques(h, src));
  return out;
}

/** Corrige la tipografía de unos tramos simulando que se teclean con el modo escritor (el código no se toca). */
function corregir(tramos: Tramo[], cfg: ConfigEscritor): Tramo[] {
  let linea = "";
  return tramos.map((t) => {
    if (t.codigo) {
      linea += t.texto;
      return t;
    }
    let out = "";
    for (const c of t.texto) {
      const r = reemplazo(linea, c, cfg);
      // Si el reemplazo tendría que borrar texto de un tramo anterior (otro estilo), se omite.
      if (r && r.borrar <= out.length) {
        out = out.slice(0, out.length - r.borrar) + r.insertar;
        linea = linea.slice(0, linea.length - r.borrar) + r.insertar;
      } else {
        out += c;
        linea += c;
      }
    }
    return { ...t, texto: out };
  });
}

/** Aplica `corregir` a todos los párrafos y títulos de unos bloques. */
function corregirBloques(bs: Bloque[], cfg: ConfigEscritor): Bloque[] {
  return bs.map((b) => (b.tipo === "parrafo" || b.tipo === "titulo" ? { ...b, tramos: corregir(b.tramos, cfg) } : b));
}

/** Nombre de archivo como título: sin extensión ni la numeración del principio («01 - El viaje» → «El viaje»). */
export function tituloDeArchivo(nombre: string): string {
  const sin = nombre.replace(/\.(md|markdown|txt)$/i, "");
  return sin.replace(/^\d+[\s._)-]*/, "").trim() || sin;
}

/** Cuenta las palabras de unos bloques (las rayas y signos sueltos no cuentan). */
export function contarPalabras(bs: Bloque[]): number {
  let n = 0;
  for (const b of bs) {
    if (b.tipo !== "parrafo" && b.tipo !== "titulo") continue;
    for (const p of textoDe(b.tramos).split(/\s+/)) if (/[\p{L}\p{N}]/u.test(p)) n++;
  }
  return n;
}

/** Quita los cambios de escena del principio y del final, y los repetidos seguidos. */
function ordenarEscenas(bs: Bloque[]): Bloque[] {
  const out: Bloque[] = [];
  for (const b of bs) {
    if (b.tipo === "escena" && (!out.length || out[out.length - 1].tipo === "escena")) continue;
    out.push(b);
  }
  while (out.length && out[out.length - 1].tipo === "escena") out.pop();
  return out;
}

/**
 * Compila un libro con las notas en el orden dado. El título de cada capítulo sale del primer
 * título de la nota (si la nota empieza con uno), del nombre del archivo, o no lleva.
 * Con `tipografia`, corrige comillas, rayas y puntos suspensivos de todo el texto.
 */
export function compilar(
  notas: NotaCompilar[],
  opciones: { titulo: string; autor: string; origenTitulo: OrigenTitulo; tipografia: ConfigEscritor | null },
): Libro {
  const capitulos: Capitulo[] = notas.map((nota) => {
    let bs = analizar(nota.texto);
    if (opciones.tipografia) bs = corregirBloques(bs, opciones.tipografia);
    let titulo: string | null = null;
    if (opciones.origenTitulo === "titulo") {
      const primero = bs[0];
      if (primero?.tipo === "titulo") {
        titulo = textoDe(primero.tramos);
        bs = bs.slice(1);
      } else titulo = tituloDeArchivo(nota.nombre);
    } else if (opciones.origenTitulo === "archivo") {
      titulo = tituloDeArchivo(nota.nombre);
    }
    return { titulo, bloques: ordenarEscenas(bs) };
  });
  const palabras = capitulos.reduce((s, c) => s + contarPalabras(c.bloques), 0);
  return { titulo: opciones.titulo, autor: opciones.autor, capitulos, palabras };
}
