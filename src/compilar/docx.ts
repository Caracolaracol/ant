// Exportación a Word (.docx). Escribe a mano el XML de WordprocessingML (el formato de Word) y lo
// empaqueta con `zip.ts`, sin librerías. Usa los estilos con nombre de Word («Title»,
// «Heading 1», «Heading 2»…), así el libro se puede seguir editando cómodo: el panel de
// navegación de Word muestra los capítulos y cambiar un estilo cambia todo el libro.
//
// Medidas en «twips» (1/20 de punto) y tamaños de letra en medios puntos, como los pide Word.

import type { BloqueDelCapitulo, Libro, TramoDeTexto } from "./modelo.ts";
import {
  encabezadoDelManuscrito,
  tamanoDePaginaDelLibro,
  textoDelConteoDePalabras,
  textosQueAgregaLaExportacion,
  type OpcionesDeExportacion,
} from "./formato.ts";
import { crearZip } from "./zip.ts";

/** Medidas de cada estilo de libro, en las unidades de Word. */
interface MedidasDelEstilo {
  nombreDeLaFuente: string;
  /** Tamaño de letra en medios puntos. */
  tamanoDeLetra: number;
  /** Interlineado: 240 = sencillo, 480 = doble. */
  interlineado: number;
  sangriaDePrimeraLinea: number;
  justificarElTexto: boolean;
  margenes: { superior: number; inferior: number; izquierdo: number; derecho: number };
  /** Espacio antes del título de cada capítulo (para bajarlo en la página). */
  espacioAntesDelCapitulo: number;
  espacioDespuesDelCapitulo: number;
  tamanoDelTituloDeCapitulo: number;
  tamanoDelTituloDelLibro: number;
  marcaDeCambioDeEscena: string;
  /** El primer párrafo de cada capítulo o escena va sin sangría (costumbre de los libros impresos). */
  primerParrafoSinSangria: boolean;
}

/** Medidas del manuscrito estándar y del libro. */
function medidasDelEstilo(opciones: OpcionesDeExportacion): MedidasDelEstilo {
  if (opciones.estilo === "manuscrito") {
    return {
      nombreDeLaFuente: "Times New Roman",
      tamanoDeLetra: 24,
      interlineado: 480,
      sangriaDePrimeraLinea: 720,
      justificarElTexto: false,
      margenes: { superior: 1440, inferior: 1440, izquierdo: 1440, derecho: 1440 },
      espacioAntesDelCapitulo: 3600,
      espacioDespuesDelCapitulo: 480,
      tamanoDelTituloDeCapitulo: 24,
      tamanoDelTituloDelLibro: 24,
      marcaDeCambioDeEscena: "#",
      primerParrafoSinSangria: false,
    };
  }
  return {
    nombreDeLaFuente: "Georgia",
    tamanoDeLetra: 21,
    interlineado: 300,
    sangriaDePrimeraLinea: 340,
    justificarElTexto: true,
    margenes: { superior: 1134, inferior: 1134, izquierdo: 1020, derecho: 1020 },
    espacioAntesDelCapitulo: 1700,
    espacioDespuesDelCapitulo: 700,
    tamanoDelTituloDeCapitulo: 32,
    tamanoDelTituloDelLibro: 44,
    marcaDeCambioDeEscena: "*   *   *",
    primerParrafoSinSangria: true,
  };
}

/** Escapa el texto para XML y quita los caracteres de control que XML no admite. */
const escaparParaXml = (texto: string) =>
  texto
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Un tramo de texto como «run» de Word, con su cursiva, negrita, tachado o letra de código. */
function tramoComoRunDeWord(tramo: TramoDeTexto): string {
  const propiedadesDelRun =
    (tramo.esCodigo ? '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>' : "") +
    (tramo.enNegrita ? "<w:b/>" : "") +
    (tramo.enCursiva ? "<w:i/>" : "") +
    (tramo.estaTachado ? "<w:strike/>" : "");
  return `<w:r>${propiedadesDelRun ? `<w:rPr>${propiedadesDelRun}</w:rPr>` : ""}<w:t xml:space="preserve">${escaparParaXml(tramo.texto)}</w:t></w:r>`;
}

/** Un párrafo con estilo y, si hace falta, salto de página antes. */
function parrafoDeWord(nombreDelEstilo: string, contenido: string, conSaltoDePaginaAntes = false, propiedadesExtra = ""): string {
  return `<w:p><w:pPr><w:pStyle w:val="${nombreDelEstilo}"/>${conSaltoDePaginaAntes ? "<w:pageBreakBefore/>" : ""}${propiedadesExtra}</w:pPr>${contenido}</w:p>`;
}

/** Los bloques de un capítulo como párrafos de Word. */
function bloquesComoParrafosDeWord(bloques: BloqueDelCapitulo[], medidas: MedidasDelEstilo, saltoDePaginaEnElPrimero: boolean): string {
  let parrafos = "";
  let llevaSaltoDePagina = saltoDePaginaEnElPrimero;
  // Tras un título o un cambio de escena, el párrafo siguiente puede ir sin sangría.
  let esElComienzoDeUnaSeccion = true;
  for (const bloque of bloques) {
    if (bloque.tipo === "parrafo") {
      const nombreDelEstilo = bloque.esCita
        ? "Cita"
        : bloque.sinSangria || (esElComienzoDeUnaSeccion && medidas.primerParrafoSinSangria)
          ? "SinSangria"
          : "Normal";
      parrafos += parrafoDeWord(nombreDelEstilo, bloque.tramos.map(tramoComoRunDeWord).join(""), llevaSaltoDePagina);
      esElComienzoDeUnaSeccion = false;
    } else if (bloque.tipo === "titulo") {
      parrafos += parrafoDeWord(bloque.nivel <= 2 ? "Heading2" : "Heading3", bloque.tramos.map(tramoComoRunDeWord).join(""), llevaSaltoDePagina);
      esElComienzoDeUnaSeccion = true;
    } else if (bloque.tipo === "escena") {
      parrafos += parrafoDeWord("Escena", tramoComoRunDeWord({ texto: medidas.marcaDeCambioDeEscena }), llevaSaltoDePagina);
      esElComienzoDeUnaSeccion = true;
    } else {
      for (const lineaDeCodigo of bloque.lineas) {
        parrafos += parrafoDeWord("Codigo", tramoComoRunDeWord({ texto: lineaDeCodigo || " " }), llevaSaltoDePagina);
      }
      esElComienzoDeUnaSeccion = false;
    }
    llevaSaltoDePagina = false;
  }
  return parrafos;
}

/** Hoja de estilos del documento. */
function hojaDeEstilos(medidas: MedidasDelEstilo, codigoDeIdioma: string): string {
  const fuente = medidas.nombreDeLaFuente;
  const fuenteDeWord = `<w:rFonts w:ascii="${fuente}" w:hAnsi="${fuente}" w:eastAsia="${fuente}" w:cs="${fuente}"/>`;
  const justificacion = medidas.justificarElTexto ? '<w:jc w:val="both"/>' : "";
  const estiloDeParrafo = (idDelEstilo: string, nombreVisible: string, propiedadesDelParrafo: string, propiedadesDelTexto = "", extra = "") =>
    `<w:style w:type="paragraph" w:styleId="${idDelEstilo}"><w:name w:val="${nombreVisible}"/><w:basedOn w:val="Normal"/>${extra}<w:qFormat/><w:pPr>${propiedadesDelParrafo}</w:pPr>${propiedadesDelTexto ? `<w:rPr>${propiedadesDelTexto}</w:rPr>` : ""}</w:style>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>${fuenteDeWord}<w:sz w:val="${medidas.tamanoDeLetra}"/><w:szCs w:val="${medidas.tamanoDeLetra}"/><w:lang w:val="${codigoDeIdioma}"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:widowControl/><w:spacing w:before="0" w:after="0" w:line="${medidas.interlineado}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:firstLine="${medidas.sangriaDePrimeraLinea}"/>${justificacion}</w:pPr></w:style>
${estiloDeParrafo("SinSangria", "No Indent", '<w:ind w:firstLine="0"/>')}
${estiloDeParrafo("Title", "Title", '<w:spacing w:after="240"/><w:ind w:firstLine="0"/><w:jc w:val="center"/>', `<w:sz w:val="${medidas.tamanoDelTituloDelLibro}"/><w:szCs w:val="${medidas.tamanoDelTituloDelLibro}"/>`)}
${estiloDeParrafo("Autor", "Author", '<w:ind w:firstLine="0"/><w:jc w:val="center"/>')}
${estiloDeParrafo("Heading1", "heading 1", `<w:keepNext/><w:pageBreakBefore/><w:spacing w:before="${medidas.espacioAntesDelCapitulo}" w:after="${medidas.espacioDespuesDelCapitulo}"/><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/>`, `<w:sz w:val="${medidas.tamanoDelTituloDeCapitulo}"/><w:szCs w:val="${medidas.tamanoDelTituloDeCapitulo}"/>`, '<w:next w:val="SinSangria"/>')}
${estiloDeParrafo("Heading2", "heading 2", `<w:keepNext/><w:spacing w:before="${medidas.interlineado}" w:after="120"/><w:ind w:firstLine="0"/><w:outlineLvl w:val="1"/>`, "<w:b/>", '<w:next w:val="SinSangria"/>')}
${estiloDeParrafo("Heading3", "heading 3", `<w:keepNext/><w:spacing w:before="240"/><w:ind w:firstLine="0"/><w:outlineLvl w:val="2"/>`, "<w:b/><w:i/>", '<w:next w:val="SinSangria"/>')}
${estiloDeParrafo("Escena", "Scene Break", '<w:keepNext/><w:ind w:firstLine="0"/><w:jc w:val="center"/>')}
${estiloDeParrafo("Cita", "Quote", '<w:ind w:left="720" w:right="720" w:firstLine="0"/>')}
${estiloDeParrafo("Codigo", "Code", '<w:spacing w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="left"/>', '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:sz w:val="20"/>')}
${estiloDeParrafo("Encabezado", "header", '<w:spacing w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/>')}
</w:styles>`;
}

/** Espacios de nombres XML de los documentos de Word. */
const ESPACIOS_DE_NOMBRES_DE_WORD =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** Número de página como campo de Word (se actualiza solo). */
const CAMPO_NUMERO_DE_PAGINA = '<w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple>';

/** Genera el .docx del libro. */
export async function crearDocx(libro: Libro, opciones: OpcionesDeExportacion): Promise<Uint8Array> {
  const medidas = medidasDelEstilo(opciones);
  const textosDeLaExportacion = textosQueAgregaLaExportacion(opciones.idioma);
  const tamanoDePagina = tamanoDePaginaDelLibro(opciones);
  const puntosATwips = (puntos: number) => Math.round(puntos * 20);
  const anchoDePagina = puntosATwips(tamanoDePagina.ancho);
  const altoDePagina = puntosATwips(tamanoDePagina.alto);
  const altoDelTexto = altoDePagina - medidas.margenes.superior - medidas.margenes.inferior;
  const anchoDelTexto = anchoDePagina - medidas.margenes.izquierdo - medidas.margenes.derecho;
  const codigoDeIdioma = opciones.idioma === "es" ? "es-ES" : "en-US";

  // Portada. Manuscrito: autor arriba a la izquierda y palabras a la derecha; título y autor al
  // centro de la página. Libro: título y autor a un tercio de la página.
  let portada = "";
  if (opciones.estilo === "manuscrito") {
    portada += parrafoDeWord(
      "SinSangria",
      tramoComoRunDeWord({ texto: libro.nombreDelAutor }) +
        "<w:r><w:tab/></w:r>" +
        tramoComoRunDeWord({ texto: textoDelConteoDePalabras(libro.cantidadDePalabras, textosDeLaExportacion) }),
      false,
      `<w:tabs><w:tab w:val="right" w:pos="${anchoDelTexto}"/></w:tabs>`,
    );
    portada += parrafoDeWord(
      "Title",
      tramoComoRunDeWord({ texto: libro.titulo }),
      false,
      `<w:spacing w:before="${Math.round(altoDelTexto / 2 - 2 * medidas.interlineado)}"/>`,
    );
  } else {
    portada += parrafoDeWord("Title", tramoComoRunDeWord({ texto: libro.titulo }), false, `<w:spacing w:before="${Math.round(altoDelTexto / 3)}"/>`);
  }
  if (libro.nombreDelAutor) {
    const lineaDelAutor = opciones.estilo === "manuscrito" ? `${textosDeLaExportacion.antesDelAutor} ${libro.nombreDelAutor}` : libro.nombreDelAutor;
    portada += parrafoDeWord("Autor", tramoComoRunDeWord({ texto: lineaDelAutor }));
  }

  // Capítulos: el título (estilo «Heading 1») empieza página nueva; sin título, el salto va en el primer párrafo.
  let capitulos = "";
  for (const capitulo of libro.capitulos) {
    if (!capitulo.titulo && !capitulo.bloques.length) continue;
    if (capitulo.titulo) capitulos += parrafoDeWord("Heading1", tramoComoRunDeWord({ texto: capitulo.titulo }));
    capitulos += bloquesComoParrafosDeWord(capitulo.bloques, medidas, !capitulo.titulo);
  }
  if (opciones.estilo === "manuscrito") {
    capitulos += parrafoDeWord("Escena", tramoComoRunDeWord({ texto: textosDeLaExportacion.alFinal }), false, `<w:spacing w:before="${medidas.interlineado}"/>`);
  }

  // Manuscrito: encabezado «Apellido / Título / página» arriba a la derecha.
  // Libro: número de página al pie, centrado. En los dos, la portada va sin ninguno (`titlePg`).
  const referenciaAlEncabezadoOPie =
    opciones.estilo === "manuscrito" ? '<w:headerReference w:type="default" r:id="rId3"/>' : '<w:footerReference w:type="default" r:id="rId4"/>';
  const propiedadesDeLaSeccion = `<w:sectPr>${referenciaAlEncabezadoOPie}<w:pgSz w:w="${anchoDePagina}" w:h="${altoDePagina}"/><w:pgMar w:top="${medidas.margenes.superior}" w:right="${medidas.margenes.derecho}" w:bottom="${medidas.margenes.inferior}" w:left="${medidas.margenes.izquierdo}" w:header="720" w:footer="567" w:gutter="0"/><w:titlePg/></w:sectPr>`;

  const documentoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${ESPACIOS_DE_NOMBRES_DE_WORD}><w:body>${portada}${capitulos}${propiedadesDeLaSeccion}</w:body></w:document>`;
  const encabezadoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${ESPACIOS_DE_NOMBRES_DE_WORD}>${parrafoDeWord("Encabezado", tramoComoRunDeWord({ texto: encabezadoDelManuscrito(libro.nombreDelAutor, libro.titulo) }) + CAMPO_NUMERO_DE_PAGINA, false, '<w:jc w:val="right"/>')}</w:hdr>`;
  const pieXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${ESPACIOS_DE_NOMBRES_DE_WORD}>${parrafoDeWord("Encabezado", CAMPO_NUMERO_DE_PAGINA, false, '<w:jc w:val="center"/>')}</w:ftr>`;
  const fechaDeCreacion = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  return crearZip([
    {
      nombre: "[Content_Types].xml",
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
    },
    {
      nombre: "_rels/.rels",
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
    },
    {
      nombre: "word/_rels/document.xml.rels",
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`,
    },
    { nombre: "word/document.xml", contenido: documentoXml },
    { nombre: "word/styles.xml", contenido: hojaDeEstilos(medidas, codigoDeIdioma) },
    {
      nombre: "word/settings.xml",
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`,
    },
    { nombre: "word/header1.xml", contenido: encabezadoXml },
    { nombre: "word/footer1.xml", contenido: pieXml },
    {
      nombre: "docProps/core.xml",
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escaparParaXml(libro.titulo)}</dc:title><dc:creator>${escaparParaXml(libro.nombreDelAutor)}</dc:creator><dc:language>${codigoDeIdioma}</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${fechaDeCreacion}</dcterms:created></cp:coreProperties>`,
    },
  ]);
}
