// Exportación a PDF, escrita a mano y sin librerías. Usa las fuentes Times (y Courier para el
// código) que todo lector de PDF trae incluidas, así no hace falta incrustar fuentes: el PDF
// queda liviano y se ve igual en cualquier sistema. Este archivo hace la maquetación completa:
// mide cada palabra con las métricas de `metricas.ts`, corta las líneas, justifica (estilo
// libro), reparte en páginas evitando dejar la primera línea de un párrafo sola al pie, y dibuja
// la portada, los títulos de capítulo, el encabezado del manuscrito o el número de página.
//
// Límite conocido: estas fuentes solo cubren la codificación WinAnsi (alfabeto latino, con
// acentos, ñ, ¿ ¡ « » “ ” — …). Otros caracteres se reemplazan por uno parecido o por «?».

import { ANCHOS_DE_CARACTERES_POR_FUENTE } from "./metricas.ts";
import type { BloqueDelCapitulo, Libro, TramoDeTexto } from "./modelo.ts";
import {
  encabezadoDelManuscrito,
  tamanoDePaginaDelLibro,
  textoDelConteoDePalabras,
  textosQueAgregaLaExportacion,
  type OpcionesDeExportacion,
} from "./formato.ts";
import { comprimirBytes, unirBytes } from "./zip.ts";

type FuenteDelPdf = "normal" | "cursiva" | "negrita" | "negritaCursiva" | "mono";

/** Nombre de cada fuente en el PDF y su identificador en las páginas. */
const FUENTES_DEL_PDF: Record<FuenteDelPdf, { nombreEnElPdf: string; identificador: string }> = {
  normal: { nombreEnElPdf: "Times-Roman", identificador: "F1" },
  cursiva: { nombreEnElPdf: "Times-Italic", identificador: "F2" },
  negrita: { nombreEnElPdf: "Times-Bold", identificador: "F3" },
  negritaCursiva: { nombreEnElPdf: "Times-BoldItalic", identificador: "F4" },
  mono: { nombreEnElPdf: "Courier", identificador: "F5" },
};

/** Caracteres de WinAnsi entre 128 y 159 (los que no coinciden con Unicode). */
const CODIGOS_WINANSI_ESPECIALES: Record<string, number> = {
  "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133, "†": 134, "‡": 135, "ˆ": 136, "‰": 137, "Š": 138, "‹": 139,
  "Œ": 140, "Ž": 142, "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151, "˜": 152, "™": 153,
  "š": 154, "›": 155, "œ": 156, "ž": 158, "Ÿ": 159,
};

/** Reemplazos para caracteres que WinAnsi no tiene. */
const SUSTITUTOS_DE_CARACTERES_SIN_WINANSI: Record<string, string> = {
  "→": "->", "←": "<-", "⁂": "* * *", "≤": "<=", "≥": ">=", "≠": "!=", "−": "-", "‐": "-", "‑": "-",
  "′": "'", "″": '"', "\t": "    ", "\u2009": " ", "\u202f": " ", "\u200b": "",
};

/** Código WinAnsi del signo «?», para lo que no se puede representar. */
const CODIGO_DEL_SIGNO_DE_PREGUNTA = 63;

/** Convierte texto a códigos WinAnsi (un byte por carácter). */
function codigosWinAnsi(texto: string): number[] {
  const codigos: number[] = [];
  for (const caracter of texto.normalize("NFC")) {
    const sustituto = SUSTITUTOS_DE_CARACTERES_SIN_WINANSI[caracter];
    if (sustituto !== undefined) {
      for (const caracterDelSustituto of sustituto) codigos.push(caracterDelSustituto.charCodeAt(0));
      continue;
    }
    const puntoDeCodigo = caracter.codePointAt(0)!;
    if ((puntoDeCodigo >= 32 && puntoDeCodigo <= 126) || (puntoDeCodigo >= 160 && puntoDeCodigo <= 255)) codigos.push(puntoDeCodigo);
    else codigos.push(CODIGOS_WINANSI_ESPECIALES[caracter] ?? CODIGO_DEL_SIGNO_DE_PREGUNTA);
  }
  return codigos;
}

/** Ancho en puntos de unos códigos en una fuente y tamaño. */
function anchoEnPuntos(codigos: number[], fuente: FuenteDelPdf, tamanoDeLetra: number): number {
  if (fuente === "mono") return (codigos.length * 600 * tamanoDeLetra) / 1000;
  const anchosDeLaFuente = ANCHOS_DE_CARACTERES_POR_FUENTE[fuente];
  let sumaDeAnchos = 0;
  for (const codigo of codigos) sumaDeAnchos += anchosDeLaFuente[codigo - 32] || 500;
  return (sumaDeAnchos * tamanoDeLetra) / 1000;
}

/** Cadena de texto de PDF: `(…)` con paréntesis y barras escapados y los bytes altos en octal. */
function cadenaDelPdf(codigos: number[]): string {
  let cadena = "(";
  for (const codigo of codigos) {
    if (codigo === 40 || codigo === 41 || codigo === 92) cadena += "\\" + String.fromCharCode(codigo);
    else if (codigo < 32 || codigo > 126) cadena += "\\" + codigo.toString(8).padStart(3, "0");
    else cadena += String.fromCharCode(codigo);
  }
  return cadena + ")";
}

/** Número con dos decimales como máximo, como los escribe un PDF. */
const numeroDelPdf = (numero: number) => String(Math.round(numero * 100) / 100);

/** Fuente de un tramo según su estilo. */
const fuenteDelTramo = (tramo: TramoDeTexto): FuenteDelPdf =>
  tramo.esCodigo
    ? "mono"
    : tramo.enNegrita && tramo.enCursiva
      ? "negritaCursiva"
      : tramo.enNegrita
        ? "negrita"
        : tramo.enCursiva
          ? "cursiva"
          : "normal";

/** Un trozo de palabra con una misma fuente. */
interface TrozoDePalabra {
  codigos: number[];
  fuente: FuenteDelPdf;
  ancho: number;
  estaTachado?: boolean;
}

/** Una palabra (puede mezclar estilos, como «*hola*,») y el ancho del espacio que la sigue. */
interface PalabraMedida {
  trozos: TrozoDePalabra[];
  ancho: number;
  anchoDelEspacioQueLaSigue: number;
}

interface LineaDeTexto {
  palabras: PalabraMedida[];
  /** Ancho natural de la línea (palabras y espacios normales). */
  ancho: number;
}

/** Parte unos tramos en palabras medidas. */
function palabrasMedidas(tramos: TramoDeTexto[], tamanoDeLetra: number, fuenteObligada?: FuenteDelPdf): PalabraMedida[] {
  const palabras: PalabraMedida[] = [];
  let palabraEnCurso: PalabraMedida | null = null;
  for (const tramo of tramos) {
    const fuente = fuenteObligada ?? fuenteDelTramo(tramo);
    for (const pieza of tramo.texto.split(/(\s+)/)) {
      if (!pieza) continue;
      if (/^\s+$/.test(pieza)) {
        if (palabraEnCurso) {
          palabraEnCurso.anchoDelEspacioQueLaSigue = anchoEnPuntos([32], fuente, tamanoDeLetra);
          palabras.push(palabraEnCurso);
          palabraEnCurso = null;
        }
        continue;
      }
      const codigos = codigosWinAnsi(pieza);
      const trozo = { codigos, fuente, ancho: anchoEnPuntos(codigos, fuente, tamanoDeLetra), estaTachado: tramo.estaTachado };
      palabraEnCurso ??= { trozos: [], ancho: 0, anchoDelEspacioQueLaSigue: 0 };
      palabraEnCurso.trozos.push(trozo);
      palabraEnCurso.ancho += trozo.ancho;
    }
  }
  if (palabraEnCurso) palabras.push(palabraEnCurso);
  return palabras;
}

/** Corta las palabras en líneas que quepan en `anchoDisponible` (la primera, menos la sangría). */
function cortarEnLineas(palabras: PalabraMedida[], anchoDisponible: number, sangriaDeLaPrimeraLinea: number): LineaDeTexto[] {
  const lineas: LineaDeTexto[] = [];
  let palabrasDeLaLinea: PalabraMedida[] = [];
  let anchoDeLaLinea = 0;
  for (const palabra of palabras) {
    const anchoParaEstaLinea = anchoDisponible - (lineas.length === 0 ? sangriaDeLaPrimeraLinea : 0);
    const anchoQueAgrega = palabrasDeLaLinea.length
      ? palabrasDeLaLinea[palabrasDeLaLinea.length - 1].anchoDelEspacioQueLaSigue + palabra.ancho
      : palabra.ancho;
    if (palabrasDeLaLinea.length && anchoDeLaLinea + anchoQueAgrega > anchoParaEstaLinea) {
      lineas.push({ palabras: palabrasDeLaLinea, ancho: anchoDeLaLinea });
      palabrasDeLaLinea = [palabra];
      anchoDeLaLinea = palabra.ancho;
    } else {
      palabrasDeLaLinea.push(palabra);
      anchoDeLaLinea += anchoQueAgrega;
    }
  }
  if (palabrasDeLaLinea.length) lineas.push({ palabras: palabrasDeLaLinea, ancho: anchoDeLaLinea });
  return lineas;
}

/** Medidas de la página y del texto para cada estilo (en puntos). */
function disenoDeLaPagina(opciones: OpcionesDeExportacion) {
  const tamanoDePagina = tamanoDePaginaDelLibro(opciones);
  if (opciones.estilo === "manuscrito") {
    return {
      ...tamanoDePagina,
      margenes: { superior: 72, inferior: 72, izquierdo: 72, derecho: 72 },
      tamanoDeLetra: 12,
      interlineado: 24,
      sangriaDePrimeraLinea: 36,
      justificarElTexto: false,
      sangriaDeLasCitas: 36,
      bajadaDelTituloDeCapitulo: (tamanoDePagina.alto - 144) / 3,
      tamanoDelTituloDeCapitulo: 12,
      espacioDespuesDelTituloDeCapitulo: 24,
      marcaDeCambioDeEscena: "#",
      primerParrafoSinSangria: false,
    };
  }
  return {
    ...tamanoDePagina,
    margenes: { superior: 56, inferior: 60, izquierdo: 51, derecho: 51 },
    tamanoDeLetra: 10.5,
    interlineado: 14.5,
    sangriaDePrimeraLinea: 15,
    justificarElTexto: true,
    sangriaDeLasCitas: 20,
    bajadaDelTituloDeCapitulo: 85,
    tamanoDelTituloDeCapitulo: 16,
    espacioDespuesDelTituloDeCapitulo: 30,
    marcaDeCambioDeEscena: "*   *   *",
    primerParrafoSinSangria: true,
  };
}

type DisenoDeLaPagina = ReturnType<typeof disenoDeLaPagina>;
type Alineacion = "izquierda" | "centro" | "derecha" | "justificado";

/** Opciones para dibujar un párrafo. */
interface OpcionesDeParrafo {
  tamanoDeLetra: number;
  altoDeLinea: number;
  sangriaDePrimeraLinea?: number;
  margenIzquierdoExtra?: number;
  margenDerechoExtra?: number;
  alineacion: Alineacion;
  fuenteObligada?: FuenteDelPdf;
}

/** Lleva la cuenta de las páginas y de dónde va el texto mientras se maqueta. */
class Maquetador {
  /** Operaciones de dibujo de cada página. */
  operacionesPorPagina: string[][] = [];
  /** Altura de la próxima línea, desde abajo de la página (así mide el PDF). */
  alturaDelCursor = 0;
  private diseno: DisenoDeLaPagina;

  constructor(diseno: DisenoDeLaPagina) {
    this.diseno = diseno;
  }

  get anchoDelTexto() {
    return this.diseno.ancho - this.diseno.margenes.izquierdo - this.diseno.margenes.derecho;
  }

  /** Empieza una página nueva, con el cursor arriba del todo. */
  empezarPaginaNueva() {
    this.operacionesPorPagina.push([]);
    this.alturaDelCursor = this.diseno.alto - this.diseno.margenes.superior;
  }

  /** Indica si caben `alto` puntos más en la página actual. */
  caben(alto: number) {
    return this.alturaDelCursor - alto >= this.diseno.margenes.inferior - 0.01;
  }

  /** Baja el cursor (un espacio en blanco); si no cabe, no pasa a la página siguiente. */
  dejarEspacio(alto: number) {
    this.alturaDelCursor = Math.max(this.alturaDelCursor - alto, this.diseno.margenes.inferior);
  }

  /** Dibuja una línea con su alineación; `bordeIzquierdo` y `anchoDisponible` delimitan dónde va. */
  dibujarLinea(
    linea: LineaDeTexto,
    bordeIzquierdo: number,
    anchoDisponible: number,
    alineacion: Alineacion,
    tamanoDeLetra: number,
    altoDeLinea: number,
  ) {
    const operaciones = this.operacionesPorPagina[this.operacionesPorPagina.length - 1];
    const lineaBase = this.alturaDelCursor - tamanoDeLetra;
    let posicionHorizontal = bordeIzquierdo;
    let espacioExtraEntrePalabras = 0;
    if (alineacion === "centro") posicionHorizontal += (anchoDisponible - linea.ancho) / 2;
    else if (alineacion === "derecha") posicionHorizontal += anchoDisponible - linea.ancho;
    else if (alineacion === "justificado" && linea.palabras.length > 1) {
      espacioExtraEntrePalabras = (anchoDisponible - linea.ancho) / (linea.palabras.length - 1);
      // Si la línea quedaría demasiado estirada (palabras muy largas), mejor no justificarla.
      if (espacioExtraEntrePalabras > tamanoDeLetra * 1.2) espacioExtraEntrePalabras = 0;
    }
    const lineasDeTachado: string[] = [];
    operaciones.push("BT");
    let fuenteEnUso = "";
    linea.palabras.forEach((palabra, posicionDeLaPalabra) => {
      for (const trozo of palabra.trozos) {
        const cambioDeFuente = `/${FUENTES_DEL_PDF[trozo.fuente].identificador} ${numeroDelPdf(tamanoDeLetra)} Tf`;
        if (cambioDeFuente !== fuenteEnUso) {
          operaciones.push(cambioDeFuente);
          fuenteEnUso = cambioDeFuente;
        }
        operaciones.push(`1 0 0 1 ${numeroDelPdf(posicionHorizontal)} ${numeroDelPdf(lineaBase)} Tm ${cadenaDelPdf(trozo.codigos)} Tj`);
        if (trozo.estaTachado) {
          const alturaDelTachado = numeroDelPdf(lineaBase + tamanoDeLetra * 0.28);
          lineasDeTachado.push(
            `${numeroDelPdf(posicionHorizontal)} ${alturaDelTachado} m ${numeroDelPdf(posicionHorizontal + trozo.ancho)} ${alturaDelTachado} l S`,
          );
        }
        posicionHorizontal += trozo.ancho;
      }
      if (posicionDeLaPalabra < linea.palabras.length - 1) {
        posicionHorizontal += palabra.anchoDelEspacioQueLaSigue + espacioExtraEntrePalabras;
      }
    });
    operaciones.push("ET");
    if (lineasDeTachado.length) operaciones.push(`${numeroDelPdf(tamanoDeLetra / 20)} w`, ...lineasDeTachado);
    this.alturaDelCursor -= altoDeLinea;
  }

  /**
   * Dibuja un párrafo. Evita que su primera línea quede sola al pie de una página y que su
   * última quede sola arriba de la siguiente, cuando se puede.
   */
  dibujarParrafo(tramos: TramoDeTexto[], opciones: OpcionesDeParrafo) {
    const palabras = palabrasMedidas(tramos, opciones.tamanoDeLetra, opciones.fuenteObligada);
    if (!palabras.length) return;
    const bordeIzquierdo = this.diseno.margenes.izquierdo + (opciones.margenIzquierdoExtra ?? 0);
    const anchoDisponible = this.anchoDelTexto - (opciones.margenIzquierdoExtra ?? 0) - (opciones.margenDerechoExtra ?? 0);
    const sangria = opciones.sangriaDePrimeraLinea ?? 0;
    const lineas = cortarEnLineas(palabras, anchoDisponible, sangria);
    const alto = opciones.altoDeLinea;
    if (!this.caben(alto) || (lineas.length > 1 && !this.caben(2 * alto))) this.empezarPaginaNueva();
    lineas.forEach((linea, posicionDeLaLinea) => {
      const lineasQueQuedan = lineas.length - posicionDeLaLinea;
      if (!this.caben(alto) || (lineasQueQuedan === 2 && posicionDeLaLinea >= 2 && !this.caben(2 * alto))) this.empezarPaginaNueva();
      const sangriaDeEstaLinea = posicionDeLaLinea === 0 ? sangria : 0;
      const esLaUltimaLinea = posicionDeLaLinea === lineas.length - 1;
      const alineacion = opciones.alineacion === "justificado" && esLaUltimaLinea ? "izquierda" : opciones.alineacion;
      this.dibujarLinea(linea, bordeIzquierdo + sangriaDeEstaLinea, anchoDisponible - sangriaDeEstaLinea, alineacion, opciones.tamanoDeLetra, alto);
    });
  }
}

/** Dibuja los bloques de un capítulo. */
function dibujarBloquesDelCapitulo(maquetador: Maquetador, bloques: BloqueDelCapitulo[], diseno: DisenoDeLaPagina) {
  let esElComienzoDeUnaSeccion = true;
  const opcionesDelTextoNormal = { tamanoDeLetra: diseno.tamanoDeLetra, altoDeLinea: diseno.interlineado };
  for (const bloque of bloques) {
    if (bloque.tipo === "parrafo") {
      const vaSinSangria = bloque.sinSangria || bloque.esCita || (esElComienzoDeUnaSeccion && diseno.primerParrafoSinSangria);
      maquetador.dibujarParrafo(bloque.tramos, {
        ...opcionesDelTextoNormal,
        sangriaDePrimeraLinea: vaSinSangria ? 0 : diseno.sangriaDePrimeraLinea,
        margenIzquierdoExtra: bloque.esCita ? diseno.sangriaDeLasCitas : 0,
        margenDerechoExtra: bloque.esCita ? diseno.sangriaDeLasCitas : 0,
        alineacion: diseno.justificarElTexto ? "justificado" : "izquierda",
      });
      esElComienzoDeUnaSeccion = false;
    } else if (bloque.tipo === "titulo") {
      // Un título dentro del capítulo no queda solo al pie: necesita lugar para unas líneas más.
      if (!maquetador.caben(diseno.interlineado * 3)) maquetador.empezarPaginaNueva();
      else maquetador.dejarEspacio(diseno.interlineado * 0.5);
      const fuenteDelTitulo: FuenteDelPdf = bloque.nivel <= 2 ? "negrita" : "negritaCursiva";
      const tramosDelTitulo = bloque.tramos.map((tramo) => ({
        ...tramo,
        enNegrita: true,
        enCursiva: fuenteDelTitulo === "negritaCursiva" || tramo.enCursiva,
      }));
      maquetador.dibujarParrafo(tramosDelTitulo, { ...opcionesDelTextoNormal, alineacion: "izquierda" });
      esElComienzoDeUnaSeccion = true;
    } else if (bloque.tipo === "escena") {
      if (!maquetador.caben(diseno.interlineado * 3)) maquetador.empezarPaginaNueva();
      else if (diseno.justificarElTexto) maquetador.dejarEspacio(diseno.interlineado * 0.5);
      maquetador.dibujarParrafo([{ texto: diseno.marcaDeCambioDeEscena }], { ...opcionesDelTextoNormal, alineacion: "centro" });
      if (diseno.justificarElTexto) maquetador.dejarEspacio(diseno.interlineado * 0.5);
      esElComienzoDeUnaSeccion = true;
    } else {
      const tamanoDelCodigo = diseno.tamanoDeLetra - 2;
      for (const lineaDeCodigo of bloque.lineas) {
        maquetador.dibujarParrafo([{ texto: lineaDeCodigo || " ", esCodigo: true }], {
          tamanoDeLetra: tamanoDelCodigo,
          altoDeLinea: tamanoDelCodigo * 1.25,
          alineacion: "izquierda",
          fuenteObligada: "mono",
        });
      }
      esElComienzoDeUnaSeccion = false;
    }
  }
}

/** Texto para el diccionario de información del PDF: ASCII tal cual, o UTF-16 si tiene acentos. */
function textoDeInformacionDelPdf(texto: string): string {
  if (/^[\x20-\x7e]*$/.test(texto)) return "(" + texto.replace(/[()\\]/g, "\\$&") + ")";
  let hexadecimal = "<FEFF";
  for (let i = 0; i < texto.length; i++) hexadecimal += texto.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return hexadecimal + ">";
}

/** Genera el PDF del libro. */
export async function crearPdf(libro: Libro, opciones: OpcionesDeExportacion): Promise<Uint8Array> {
  const diseno = disenoDeLaPagina(opciones);
  const textosDeLaExportacion = textosQueAgregaLaExportacion(opciones.idioma);
  const maquetador = new Maquetador(diseno);
  const opcionesDelTextoNormal = { tamanoDeLetra: diseno.tamanoDeLetra, altoDeLinea: diseno.interlineado };

  // Portada.
  maquetador.empezarPaginaNueva();
  if (opciones.estilo === "manuscrito") {
    // Autor arriba a la izquierda y el conteo de palabras a la derecha, en la misma línea.
    const conteoDePalabras = textoDelConteoDePalabras(libro.cantidadDePalabras, textosDeLaExportacion);
    const alturaDeLaPrimeraLinea = maquetador.alturaDelCursor;
    if (libro.nombreDelAutor) {
      maquetador.dibujarParrafo([{ texto: libro.nombreDelAutor }], { ...opcionesDelTextoNormal, alineacion: "izquierda" });
    }
    maquetador.alturaDelCursor = alturaDeLaPrimeraLinea;
    maquetador.dibujarParrafo([{ texto: conteoDePalabras }], { ...opcionesDelTextoNormal, alineacion: "derecha" });
    maquetador.alturaDelCursor = diseno.alto / 2 + diseno.interlineado;
    maquetador.dibujarParrafo([{ texto: libro.titulo }], { ...opcionesDelTextoNormal, alineacion: "centro" });
    if (libro.nombreDelAutor) {
      maquetador.dibujarParrafo([{ texto: `${textosDeLaExportacion.antesDelAutor} ${libro.nombreDelAutor}` }], {
        ...opcionesDelTextoNormal,
        alineacion: "centro",
      });
    }
  } else {
    maquetador.dejarEspacio((diseno.alto - diseno.margenes.superior - diseno.margenes.inferior) / 3);
    maquetador.dibujarParrafo([{ texto: libro.titulo }], { tamanoDeLetra: 22, altoDeLinea: 28, alineacion: "centro" });
    maquetador.dejarEspacio(14);
    if (libro.nombreDelAutor) {
      maquetador.dibujarParrafo([{ texto: libro.nombreDelAutor }], { tamanoDeLetra: 13, altoDeLinea: 18, alineacion: "centro" });
    }
  }

  // Capítulos, cada uno en página nueva y con el título a un tercio de la página (manuscrito)
  // o un poco más abajo del margen (libro).
  for (const capitulo of libro.capitulos) {
    if (!capitulo.titulo && !capitulo.bloques.length) continue;
    maquetador.empezarPaginaNueva();
    if (capitulo.titulo) {
      maquetador.dejarEspacio(diseno.bajadaDelTituloDeCapitulo);
      maquetador.dibujarParrafo([{ texto: capitulo.titulo }], {
        tamanoDeLetra: diseno.tamanoDelTituloDeCapitulo,
        altoDeLinea: Math.max(diseno.interlineado, diseno.tamanoDelTituloDeCapitulo * 1.3),
        alineacion: "centro",
      });
      maquetador.dejarEspacio(diseno.espacioDespuesDelTituloDeCapitulo);
    }
    dibujarBloquesDelCapitulo(maquetador, capitulo.bloques, diseno);
  }
  if (opciones.estilo === "manuscrito") {
    if (!maquetador.caben(diseno.interlineado * 2)) maquetador.empezarPaginaNueva();
    else maquetador.dejarEspacio(diseno.interlineado);
    maquetador.dibujarParrafo([{ texto: textosDeLaExportacion.alFinal }], { ...opcionesDelTextoNormal, alineacion: "centro" });
  }

  // Encabezado (manuscrito) o número de página al pie (libro), en todas menos la portada.
  const encabezado = encabezadoDelManuscrito(libro.nombreDelAutor, libro.titulo);
  maquetador.operacionesPorPagina.forEach((operaciones, posicionDeLaPagina) => {
    if (posicionDeLaPagina === 0) return;
    const numeroDePagina = String(posicionDeLaPagina + 1);
    if (opciones.estilo === "manuscrito") {
      const codigos = codigosWinAnsi(encabezado + numeroDePagina);
      const posicionHorizontal = diseno.ancho - diseno.margenes.derecho - anchoEnPuntos(codigos, "normal", 12);
      operaciones.push(
        `BT /F1 12 Tf 1 0 0 1 ${numeroDelPdf(posicionHorizontal)} ${numeroDelPdf(diseno.alto - 36 - 12)} Tm ${cadenaDelPdf(codigos)} Tj ET`,
      );
    } else {
      const codigos = codigosWinAnsi(numeroDePagina);
      const posicionHorizontal = (diseno.ancho - anchoEnPuntos(codigos, "normal", 9)) / 2;
      operaciones.push(`BT /F1 9 Tf 1 0 0 1 ${numeroDelPdf(posicionHorizontal)} 32 Tm ${cadenaDelPdf(codigos)} Tj ET`);
    }
  });

  // Armado del archivo: catálogo (1), árbol de páginas (2), fuentes (3–7), información (8) y,
  // por cada página, su objeto y su contenido.
  const codificadorUtf8 = new TextEncoder();
  const fuentes = Object.values(FUENTES_DEL_PDF);
  const numeroDeObjetoDeLaPrimeraPagina = 3 + fuentes.length + 1;
  const objetos: (string | Uint8Array)[] = [];
  const codigoDeIdioma = opciones.idioma === "es" ? "es-ES" : "en-US";
  const paginas = maquetador.operacionesPorPagina;
  objetos.push(`<< /Type /Catalog /Pages 2 0 R /Lang (${codigoDeIdioma}) >>`);
  objetos.push(
    `<< /Type /Pages /Count ${paginas.length} /Kids [${paginas.map((_, posicion) => `${numeroDeObjetoDeLaPrimeraPagina + posicion * 2} 0 R`).join(" ")}] >>`,
  );
  for (const fuente of fuentes) {
    const codificacion = fuente.nombreEnElPdf === "Courier" ? "" : " /Encoding /WinAnsiEncoding";
    objetos.push(`<< /Type /Font /Subtype /Type1 /BaseFont /${fuente.nombreEnElPdf}${codificacion} >>`);
  }
  objetos.push(
    `<< /Title ${textoDeInformacionDelPdf(libro.titulo)} /Author ${textoDeInformacionDelPdf(libro.nombreDelAutor)} /Creator (Ant) /Producer (Ant) >>`,
  );
  const recursosDeLasPaginas = `<< /Font << ${fuentes.map((fuente, posicion) => `/${fuente.identificador} ${3 + posicion} 0 R`).join(" ")} >> >>`;
  for (let posicion = 0; posicion < paginas.length; posicion++) {
    const contenido = codificadorUtf8.encode(paginas[posicion].join("\n"));
    const contenidoComprimido = await comprimirBytes(contenido, "deflate");
    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${numeroDelPdf(diseno.ancho)} ${numeroDelPdf(diseno.alto)}] /Resources ${recursosDeLasPaginas} /Contents ${numeroDeObjetoDeLaPrimeraPagina + posicion * 2 + 1} 0 R >>`,
    );
    const bytesDelContenido = contenidoComprimido ?? contenido;
    objetos.push(
      unirBytes([
        codificadorUtf8.encode(`<< /Length ${bytesDelContenido.length}${contenidoComprimido ? " /Filter /FlateDecode" : ""} >>\nstream\n`),
        bytesDelContenido,
        codificadorUtf8.encode("\nendstream"),
      ]),
    );
  }

  const trozosDelArchivo: Uint8Array[] = [codificadorUtf8.encode("%PDF-1.4\n"), new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])];
  let posicionEnElArchivo = trozosDelArchivo[0].length + trozosDelArchivo[1].length;
  const posicionDeCadaObjeto: number[] = [];
  objetos.forEach((objeto, posicion) => {
    posicionDeCadaObjeto.push(posicionEnElArchivo);
    const cuerpo = typeof objeto === "string" ? codificadorUtf8.encode(objeto) : objeto;
    const objetoCompleto = unirBytes([codificadorUtf8.encode(`${posicion + 1} 0 obj\n`), cuerpo, codificadorUtf8.encode("\nendobj\n")]);
    trozosDelArchivo.push(objetoCompleto);
    posicionEnElArchivo += objetoCompleto.length;
  });
  const tablaDeReferencias =
    `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` +
    posicionDeCadaObjeto.map((posicion) => `${String(posicion).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info ${3 + fuentes.length} 0 R >>\nstartxref\n${posicionEnElArchivo}\n%%EOF\n`;
  trozosDelArchivo.push(codificadorUtf8.encode(tablaDeReferencias));
  return unirBytes(trozosDelArchivo);
}
