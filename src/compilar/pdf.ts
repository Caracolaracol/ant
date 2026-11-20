// Exportación a PDF, escrita a mano y sin librerías. Usa las fuentes Times (y Courier para el
// código) que todo lector de PDF trae incluidas, así no hace falta incrustar fuentes: el PDF
// queda liviano y se ve igual en cualquier sistema. Este archivo hace la maquetación completa:
// mide cada palabra con las métricas de `metricas.ts`, corta las líneas, justifica (estilo
// libro), reparte en páginas evitando dejar la primera línea de un párrafo sola al pie, y dibuja
// la portada, los títulos de capítulo, el encabezado del manuscrito o el número de página.
//
// Límite conocido: estas fuentes solo cubren la codificación WinAnsi (alfabeto latino, con
// acentos, ñ, ¿ ¡ « » “ ” — …). Otros caracteres se reemplazan por uno parecido o por «?».

import { ANCHOS } from "./metricas.ts";
import type { Bloque, Libro, Tramo } from "./modelo.ts";
import { encabezadoManuscrito, paginaDe, palabrasRedondeadasTexto, textosExportar, type OpcionesExportar } from "./formato.ts";
import { comprimir, unir } from "./zip.ts";

type Fuente = "normal" | "cursiva" | "negrita" | "negritaCursiva" | "mono";

/** Nombre de cada fuente en el PDF y su identificador en las páginas. */
const FUENTES: Record<Fuente, { nombre: string; id: string }> = {
  normal: { nombre: "Times-Roman", id: "F1" },
  cursiva: { nombre: "Times-Italic", id: "F2" },
  negrita: { nombre: "Times-Bold", id: "F3" },
  negritaCursiva: { nombre: "Times-BoldItalic", id: "F4" },
  mono: { nombre: "Courier", id: "F5" },
};

/** Caracteres de WinAnsi entre 128 y 159 (los que no coinciden con Unicode). */
const ESPECIALES: Record<string, number> = {
  "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133, "†": 134, "‡": 135, "ˆ": 136, "‰": 137, "Š": 138, "‹": 139,
  "Œ": 140, "Ž": 142, "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151, "˜": 152, "™": 153,
  "š": 154, "›": 155, "œ": 156, "ž": 158, "Ÿ": 159,
};

/** Reemplazos para caracteres que WinAnsi no tiene. */
const SUSTITUTOS: Record<string, string> = {
  "→": "->", "←": "<-", "⁂": "* * *", "≤": "<=", "≥": ">=", "≠": "!=", "−": "-", "‐": "-", "‑": "-",
  "′": "'", "″": '"', "\t": "    ", " ": " ", " ": " ", "​": "",
};

/** Convierte texto a códigos WinAnsi (un byte por carácter). */
function codigos(texto: string): number[] {
  const out: number[] = [];
  for (const ch of texto.normalize("NFC")) {
    const sus = SUSTITUTOS[ch];
    if (sus !== undefined) {
      for (const c of sus) out.push(c.charCodeAt(0));
      continue;
    }
    const cp = ch.codePointAt(0)!;
    if ((cp >= 32 && cp <= 126) || (cp >= 160 && cp <= 255)) out.push(cp);
    else out.push(ESPECIALES[ch] ?? 63); // 63 = «?»
  }
  return out;
}

/** Ancho en puntos de unos códigos en una fuente y tamaño. */
function medir(cods: number[], fuente: Fuente, tam: number): number {
  if (fuente === "mono") return (cods.length * 600 * tam) / 1000;
  const tabla = ANCHOS[fuente];
  let s = 0;
  for (const c of cods) s += tabla[c - 32] || 500;
  return (s * tam) / 1000;
}

/** Cadena de texto de PDF: `(…)` con paréntesis y barras escapados y los bytes altos en octal. */
function cadena(cods: number[]): string {
  let s = "(";
  for (const c of cods) {
    if (c === 40 || c === 41 || c === 92) s += "\\" + String.fromCharCode(c);
    else if (c < 32 || c > 126) s += "\\" + c.toString(8).padStart(3, "0");
    else s += String.fromCharCode(c);
  }
  return s + ")";
}

/** Número con dos decimales como máximo, como los escribe un PDF. */
const num = (n: number) => String(Math.round(n * 100) / 100);

/** Fuente de un tramo según su estilo. */
const fuenteDe = (t: Tramo): Fuente =>
  t.codigo ? "mono" : t.negrita && t.cursiva ? "negritaCursiva" : t.negrita ? "negrita" : t.cursiva ? "cursiva" : "normal";

/** Un trozo de palabra con una misma fuente. */
interface Segmento {
  cods: number[];
  fuente: Fuente;
  ancho: number;
  tachado?: boolean;
}

/** Una palabra (puede mezclar estilos, como «*hola*,») y el ancho del espacio que la sigue. */
interface Palabra {
  segs: Segmento[];
  ancho: number;
  espacio: number;
}

interface Linea {
  palabras: Palabra[];
  /** Ancho natural de la línea (palabras y espacios normales). */
  ancho: number;
}

/** Parte unos tramos en palabras medidas. */
function palabras(tramos: Tramo[], tam: number, forzar?: Fuente): Palabra[] {
  const out: Palabra[] = [];
  let actual: Palabra | null = null;
  for (const t of tramos) {
    const fuente = forzar ?? fuenteDe(t);
    for (const pieza of t.texto.split(/(\s+)/)) {
      if (!pieza) continue;
      if (/^\s+$/.test(pieza)) {
        if (actual) {
          actual.espacio = medir([32], fuente, tam);
          out.push(actual);
          actual = null;
        }
        continue;
      }
      const cods = codigos(pieza);
      const seg = { cods, fuente, ancho: medir(cods, fuente, tam), tachado: t.tachado };
      actual ??= { segs: [], ancho: 0, espacio: 0 };
      actual.segs.push(seg);
      actual.ancho += seg.ancho;
    }
  }
  if (actual) out.push(actual);
  return out;
}

/** Corta las palabras en líneas que quepan en `disponible` (la primera, menos la sangría). */
function cortar(pals: Palabra[], disponible: number, sangria: number): Linea[] {
  const lineas: Linea[] = [];
  let actual: Palabra[] = [];
  let ancho = 0;
  for (const p of pals) {
    const disp = disponible - (lineas.length === 0 ? sangria : 0);
    const extra = actual.length ? actual[actual.length - 1].espacio + p.ancho : p.ancho;
    if (actual.length && ancho + extra > disp) {
      lineas.push({ palabras: actual, ancho });
      actual = [p];
      ancho = p.ancho;
    } else {
      actual.push(p);
      ancho += extra;
    }
  }
  if (actual.length) lineas.push({ palabras: actual, ancho });
  return lineas;
}

/** Medidas de la página y del texto para cada estilo (en puntos). */
function diseno(o: OpcionesExportar) {
  const pag = paginaDe(o);
  if (o.estilo === "manuscrito") {
    return {
      ...pag,
      margen: { sup: 72, inf: 72, izq: 72, der: 72 },
      tam: 12,
      interlinea: 24,
      sangria: 36,
      justificar: false,
      sangriaCita: 36,
      bajadaCapitulo: (pag.alto - 144) / 3,
      tamCapitulo: 12,
      despuesCapitulo: 24,
      escena: "#",
      primeroSinSangria: false,
    };
  }
  return {
    ...pag,
    margen: { sup: 56, inf: 60, izq: 51, der: 51 },
    tam: 10.5,
    interlinea: 14.5,
    sangria: 15,
    justificar: true,
    sangriaCita: 20,
    bajadaCapitulo: 85,
    tamCapitulo: 16,
    despuesCapitulo: 30,
    escena: "*   *   *",
    primeroSinSangria: true,
  };
}

type Alineacion = "izquierda" | "centro" | "derecha" | "justificado";

/** Lleva la cuenta de las páginas y de dónde va el texto mientras se maqueta. */
class Maquetador {
  paginas: string[][] = [];
  y = 0;
  private d: ReturnType<typeof diseno>;

  constructor(d: ReturnType<typeof diseno>) {
    this.d = d;
  }

  get anchoTexto() {
    return this.d.ancho - this.d.margen.izq - this.d.margen.der;
  }

  /** Empieza una página nueva, con el cursor arriba del todo. */
  nuevaPagina() {
    this.paginas.push([]);
    this.y = this.d.alto - this.d.margen.sup;
  }

  /** Indica si caben `alto` puntos más en la página actual. */
  cabe(alto: number) {
    return this.y - alto >= this.d.margen.inf - 0.01;
  }

  /** Baja el cursor (un espacio en blanco); si no cabe, no pasa a la página siguiente. */
  espacio(alto: number) {
    this.y = Math.max(this.y - alto, this.d.margen.inf);
  }

  /** Dibuja una línea con su alineación; `x0` y `disp` son el borde izquierdo y el ancho disponibles. */
  dibujarLinea(l: Linea, x0: number, disp: number, alin: Alineacion, tam: number, alto: number) {
    const ops = this.paginas[this.paginas.length - 1];
    const base = this.y - tam;
    let x = x0;
    let extra = 0;
    if (alin === "centro") x += (disp - l.ancho) / 2;
    else if (alin === "derecha") x += disp - l.ancho;
    else if (alin === "justificado" && l.palabras.length > 1) {
      extra = (disp - l.ancho) / (l.palabras.length - 1);
      // Si la línea quedaría demasiado estirada (palabras muy largas), mejor no justificarla.
      if (extra > tam * 1.2) extra = 0;
    }
    const tachados: string[] = [];
    ops.push("BT");
    let fuenteActual = "";
    l.palabras.forEach((p, i) => {
      for (const s of p.segs) {
        const f = `/${FUENTES[s.fuente].id} ${num(tam)} Tf`;
        if (f !== fuenteActual) {
          ops.push(f);
          fuenteActual = f;
        }
        ops.push(`1 0 0 1 ${num(x)} ${num(base)} Tm ${cadena(s.cods)} Tj`);
        if (s.tachado) tachados.push(`${num(x)} ${num(base + tam * 0.28)} m ${num(x + s.ancho)} ${num(base + tam * 0.28)} l S`);
        x += s.ancho;
      }
      if (i < l.palabras.length - 1) x += p.espacio + extra;
    });
    ops.push("ET");
    if (tachados.length) ops.push(`${num(tam / 20)} w`, ...tachados);
    this.y -= alto;
  }

  /**
   * Dibuja un párrafo. Evita que su primera línea quede sola al pie de una página y que su
   * última quede sola arriba de la siguiente, cuando se puede.
   */
  parrafo(tramos: Tramo[], o: { tam: number; alto: number; sangria?: number; izq?: number; der?: number; alin: Alineacion; fuente?: Fuente }) {
    const pals = palabras(tramos, o.tam, o.fuente);
    if (!pals.length) return;
    const izq = this.d.margen.izq + (o.izq ?? 0);
    const disp = this.anchoTexto - (o.izq ?? 0) - (o.der ?? 0);
    const sangria = o.sangria ?? 0;
    const lineas = cortar(pals, disp, sangria);
    if (!this.cabe(o.alto) || (lineas.length > 1 && !this.cabe(2 * o.alto))) this.nuevaPagina();
    lineas.forEach((l, i) => {
      const quedan = lineas.length - i;
      if (!this.cabe(o.alto) || (quedan === 2 && i >= 2 && !this.cabe(2 * o.alto))) this.nuevaPagina();
      const s = i === 0 ? sangria : 0;
      const ultima = i === lineas.length - 1;
      const alin = o.alin === "justificado" && ultima ? "izquierda" : o.alin;
      this.dibujarLinea(l, izq + s, disp - s, alin, o.tam, o.alto);
    });
  }
}

/** Dibuja los bloques de un capítulo. */
function dibujarBloques(m: Maquetador, bloques: Bloque[], d: ReturnType<typeof diseno>) {
  let inicio = true;
  for (const b of bloques) {
    if (b.tipo === "parrafo") {
      const sinSangria = b.sinSangria || b.cita || (inicio && d.primeroSinSangria);
      const alin: Alineacion = d.justificar ? "justificado" : "izquierda";
      m.parrafo(b.tramos, {
        tam: d.tam,
        alto: d.interlinea,
        sangria: sinSangria ? 0 : d.sangria,
        izq: b.cita ? d.sangriaCita : 0,
        der: b.cita ? d.sangriaCita : 0,
        alin,
      });
      inicio = false;
    } else if (b.tipo === "titulo") {
      // Un título dentro del capítulo no queda solo al pie: necesita lugar para unas líneas más.
      if (!m.cabe(d.interlinea * 3)) m.nuevaPagina();
      else m.espacio(d.interlinea * 0.5);
      const fuente: Fuente = b.nivel <= 2 ? "negrita" : "negritaCursiva";
      m.parrafo(b.tramos.map((t) => ({ ...t, negrita: true, cursiva: fuente === "negritaCursiva" || t.cursiva })), {
        tam: d.tam,
        alto: d.interlinea,
        alin: "izquierda",
      });
      inicio = true;
    } else if (b.tipo === "escena") {
      if (!m.cabe(d.interlinea * 3)) m.nuevaPagina();
      else if (d.justificar) m.espacio(d.interlinea * 0.5);
      m.parrafo([{ texto: d.escena }], { tam: d.tam, alto: d.interlinea, alin: "centro" });
      if (d.justificar) m.espacio(d.interlinea * 0.5);
      inicio = true;
    } else {
      const tam = d.tam - 2;
      for (const l of b.lineas) m.parrafo([{ texto: l || " ", codigo: true }], { tam, alto: tam * 1.25, alin: "izquierda", fuente: "mono" });
      inicio = false;
    }
  }
}

/** Texto para el diccionario de información del PDF: ASCII tal cual, o UTF-16 si tiene acentos. */
function textoInfo(t: string): string {
  if (/^[\x20-\x7e]*$/.test(t)) return "(" + t.replace(/[()\\]/g, "\\$&") + ")";
  let hex = "<FEFF";
  for (let i = 0; i < t.length; i++) hex += t.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return hex + ">";
}

/** Genera el PDF del libro. */
export async function crearPdf(libro: Libro, o: OpcionesExportar): Promise<Uint8Array> {
  const d = diseno(o);
  const tx = textosExportar(o.idioma);
  const m = new Maquetador(d);

  // Portada.
  m.nuevaPagina();
  if (o.estilo === "manuscrito") {
    // Autor arriba a la izquierda y el conteo de palabras a la derecha, en la misma línea.
    const conteo = palabrasRedondeadasTexto(libro.palabras, tx);
    const yLinea = m.y;
    if (libro.autor) m.parrafo([{ texto: libro.autor }], { tam: d.tam, alto: d.interlinea, alin: "izquierda" });
    m.y = yLinea;
    m.parrafo([{ texto: conteo }], { tam: d.tam, alto: d.interlinea, alin: "derecha" });
    m.y = d.alto / 2 + d.interlinea;
    m.parrafo([{ texto: libro.titulo }], { tam: d.tam, alto: d.interlinea, alin: "centro" });
    if (libro.autor) m.parrafo([{ texto: `${tx.por} ${libro.autor}` }], { tam: d.tam, alto: d.interlinea, alin: "centro" });
  } else {
    m.espacio((d.alto - d.margen.sup - d.margen.inf) / 3);
    m.parrafo([{ texto: libro.titulo }], { tam: 22, alto: 28, alin: "centro" });
    m.espacio(14);
    if (libro.autor) m.parrafo([{ texto: libro.autor }], { tam: 13, alto: 18, alin: "centro" });
  }

  // Capítulos, cada uno en página nueva y con el título a un tercio de la página (manuscrito)
  // o un poco más abajo del margen (libro).
  for (const c of libro.capitulos) {
    if (!c.titulo && !c.bloques.length) continue;
    m.nuevaPagina();
    if (c.titulo) {
      m.espacio(d.bajadaCapitulo);
      m.parrafo([{ texto: c.titulo }], { tam: d.tamCapitulo, alto: Math.max(d.interlinea, d.tamCapitulo * 1.3), alin: "centro" });
      m.espacio(d.despuesCapitulo);
    }
    dibujarBloques(m, c.bloques, d);
  }
  if (o.estilo === "manuscrito") {
    if (!m.cabe(d.interlinea * 2)) m.nuevaPagina();
    else m.espacio(d.interlinea);
    m.parrafo([{ texto: tx.fin }], { tam: d.tam, alto: d.interlinea, alin: "centro" });
  }

  // Encabezado (manuscrito) o número de página al pie (libro), en todas menos la portada.
  const encabezado = encabezadoManuscrito(libro.autor, libro.titulo);
  m.paginas.forEach((ops, i) => {
    if (i === 0) return;
    const numero = String(i + 1);
    if (o.estilo === "manuscrito") {
      const cods = codigos(encabezado + numero);
      const x = d.ancho - d.margen.der - medir(cods, "normal", 12);
      ops.push(`BT /F1 12 Tf 1 0 0 1 ${num(x)} ${num(d.alto - 36 - 12)} Tm ${cadena(cods)} Tj ET`);
    } else {
      const cods = codigos(numero);
      const x = (d.ancho - medir(cods, "normal", 9)) / 2;
      ops.push(`BT /F1 9 Tf 1 0 0 1 ${num(x)} 32 Tm ${cadena(cods)} Tj ET`);
    }
  });

  // Armado del archivo: catálogo (1), árbol de páginas (2), fuentes (3–7), información (8) y,
  // por cada página, su objeto y su contenido.
  const cod = new TextEncoder();
  const fuentes = Object.values(FUENTES);
  const primeraPagina = 3 + fuentes.length + 1;
  const objetos: (string | Uint8Array)[] = [];
  const idioma = o.idioma === "es" ? "es-ES" : "en-US";
  objetos.push(`<< /Type /Catalog /Pages 2 0 R /Lang (${idioma}) >>`);
  objetos.push(`<< /Type /Pages /Count ${m.paginas.length} /Kids [${m.paginas.map((_, i) => `${primeraPagina + i * 2} 0 R`).join(" ")}] >>`);
  for (const f of fuentes) objetos.push(`<< /Type /Font /Subtype /Type1 /BaseFont /${f.nombre}${f.nombre === "Courier" ? "" : " /Encoding /WinAnsiEncoding"} >>`);
  objetos.push(`<< /Title ${textoInfo(libro.titulo)} /Author ${textoInfo(libro.autor)} /Creator (Ant) /Producer (Ant) >>`);
  const recursos = `<< /Font << ${fuentes.map((f, i) => `/${f.id} ${3 + i} 0 R`).join(" ")} >> >>`;
  for (let i = 0; i < m.paginas.length; i++) {
    const contenido = cod.encode(m.paginas[i].join("\n"));
    const comprimido = await comprimir(contenido, "deflate");
    objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(d.ancho)} ${num(d.alto)}] /Resources ${recursos} /Contents ${primeraPagina + i * 2 + 1} 0 R >>`);
    const datos = comprimido ?? contenido;
    objetos.push(
      unir([
        cod.encode(`<< /Length ${datos.length}${comprimido ? " /Filter /FlateDecode" : ""} >>\nstream\n`),
        datos,
        cod.encode("\nendstream"),
      ]),
    );
  }

  const trozos: Uint8Array[] = [cod.encode("%PDF-1.4\n"), new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])];
  let pos = trozos[0].length + trozos[1].length;
  const desplazamientos: number[] = [];
  objetos.forEach((obj, i) => {
    desplazamientos.push(pos);
    const cuerpo = typeof obj === "string" ? cod.encode(obj) : obj;
    const t = unir([cod.encode(`${i + 1} 0 obj\n`), cuerpo, cod.encode("\nendobj\n")]);
    trozos.push(t);
    pos += t.length;
  });
  const xref =
    `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` +
    desplazamientos.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info ${3 + fuentes.length} 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  trozos.push(cod.encode(xref));
  return unir(trozos);
}
