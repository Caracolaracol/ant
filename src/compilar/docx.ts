// Exportación a Word (.docx). Escribe a mano el XML de WordprocessingML (el formato de Word) y lo
// empaqueta con `zip.ts`, sin librerías. Usa los estilos con nombre de Word («Title»,
// «Heading 1», «Heading 2»…), así el libro se puede seguir editando cómodo: el panel de
// navegación de Word muestra los capítulos y cambiar un estilo cambia todo el libro.
//
// Medidas en «twips» (1/20 de punto) y tamaños de letra en medios puntos, como los pide Word.

import type { Bloque, Libro, Tramo } from "./modelo.ts";
import { encabezadoManuscrito, paginaDe, palabrasRedondeadasTexto, textosExportar, type OpcionesExportar } from "./formato.ts";
import { crearZip } from "./zip.ts";

/** Medidas de cada estilo. */
interface Medidas {
  fuente: string;
  /** Tamaño de letra en medios puntos. */
  tam: number;
  /** Interlineado: 240 = sencillo, 480 = doble. */
  interlinea: number;
  sangria: number;
  justificar: boolean;
  margenes: { sup: number; inf: number; izq: number; der: number };
  /** Espacio antes del título de cada capítulo (para bajarlo en la página). */
  antesCapitulo: number;
  despuesCapitulo: number;
  tamCapitulo: number;
  tamTitulo: number;
  escena: string;
  /** El primer párrafo de cada capítulo o escena va sin sangría (costumbre de los libros impresos). */
  primeroSinSangria: boolean;
}

/** Medidas del manuscrito estándar y del libro. */
function medidas(o: OpcionesExportar): Medidas {
  if (o.estilo === "manuscrito") {
    return {
      fuente: "Times New Roman",
      tam: 24,
      interlinea: 480,
      sangria: 720,
      justificar: false,
      margenes: { sup: 1440, inf: 1440, izq: 1440, der: 1440 },
      antesCapitulo: 3600,
      despuesCapitulo: 480,
      tamCapitulo: 24,
      tamTitulo: 24,
      escena: "#",
      primeroSinSangria: false,
    };
  }
  return {
    fuente: "Georgia",
    tam: 21,
    interlinea: 300,
    sangria: 340,
    justificar: true,
    margenes: { sup: 1134, inf: 1134, izq: 1020, der: 1020 },
    antesCapitulo: 1700,
    despuesCapitulo: 700,
    tamCapitulo: 32,
    tamTitulo: 44,
    escena: "*   *   *",
    primeroSinSangria: true,
  };
}

/** Escapa el texto para XML y quita los caracteres de control que XML no admite. */
const xml = (t: string) =>
  t
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Un tramo de texto como «run» de Word, con su cursiva, negrita, tachado o letra de código. */
function run(t: Tramo): string {
  const rpr =
    (t.codigo ? '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>' : "") +
    (t.negrita ? "<w:b/>" : "") +
    (t.cursiva ? "<w:i/>" : "") +
    (t.tachado ? "<w:strike/>" : "");
  return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}<w:t xml:space="preserve">${xml(t.texto)}</w:t></w:r>`;
}

/** Un párrafo con estilo y, si hace falta, salto de página antes. */
function parrafo(estilo: string, contenido: string, saltoAntes = false, extraPPr = ""): string {
  return `<w:p><w:pPr><w:pStyle w:val="${estilo}"/>${saltoAntes ? "<w:pageBreakBefore/>" : ""}${extraPPr}</w:pPr>${contenido}</w:p>`;
}

/** Los bloques de un capítulo como párrafos de Word. */
function cuerpo(bloques: Bloque[], m: Medidas, saltoEnElPrimero: boolean): string {
  let out = "";
  let salto = saltoEnElPrimero;
  // Tras un título o un cambio de escena, el párrafo siguiente puede ir sin sangría.
  let inicio = true;
  for (const b of bloques) {
    if (b.tipo === "parrafo") {
      const estilo = b.cita ? "Cita" : b.sinSangria || (inicio && m.primeroSinSangria) ? "SinSangria" : "Normal";
      out += parrafo(estilo, b.tramos.map(run).join(""), salto);
      inicio = false;
    } else if (b.tipo === "titulo") {
      out += parrafo(b.nivel <= 2 ? "Heading2" : "Heading3", b.tramos.map(run).join(""), salto);
      inicio = true;
    } else if (b.tipo === "escena") {
      out += parrafo("Escena", run({ texto: m.escena }), salto);
      inicio = true;
    } else {
      for (const l of b.lineas) out += parrafo("Codigo", run({ texto: l || " " }), salto);
      inicio = false;
    }
    salto = false;
  }
  return out;
}

/** Hoja de estilos del documento. */
function estilos(m: Medidas, idioma: string): string {
  const fuente = `<w:rFonts w:ascii="${m.fuente}" w:hAnsi="${m.fuente}" w:eastAsia="${m.fuente}" w:cs="${m.fuente}"/>`;
  const jc = m.justificar ? '<w:jc w:val="both"/>' : "";
  const estilo = (id: string, nombre: string, ppr: string, rpr = "", extra = "") =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${nombre}"/><w:basedOn w:val="Normal"/>${extra}<w:qFormat/><w:pPr>${ppr}</w:pPr>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}</w:style>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>${fuente}<w:sz w:val="${m.tam}"/><w:szCs w:val="${m.tam}"/><w:lang w:val="${idioma}"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:widowControl/><w:spacing w:before="0" w:after="0" w:line="${m.interlinea}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:firstLine="${m.sangria}"/>${jc}</w:pPr></w:style>
${estilo("SinSangria", "No Indent", '<w:ind w:firstLine="0"/>')}
${estilo("Title", "Title", '<w:spacing w:after="240"/><w:ind w:firstLine="0"/><w:jc w:val="center"/>', `<w:sz w:val="${m.tamTitulo}"/><w:szCs w:val="${m.tamTitulo}"/>`)}
${estilo("Autor", "Author", '<w:ind w:firstLine="0"/><w:jc w:val="center"/>')}
${estilo("Heading1", "heading 1", `<w:keepNext/><w:pageBreakBefore/><w:spacing w:before="${m.antesCapitulo}" w:after="${m.despuesCapitulo}"/><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/>`, `<w:sz w:val="${m.tamCapitulo}"/><w:szCs w:val="${m.tamCapitulo}"/>`, '<w:next w:val="SinSangria"/>')}
${estilo("Heading2", "heading 2", `<w:keepNext/><w:spacing w:before="${m.interlinea}" w:after="120"/><w:ind w:firstLine="0"/><w:outlineLvl w:val="1"/>`, "<w:b/>", '<w:next w:val="SinSangria"/>')}
${estilo("Heading3", "heading 3", `<w:keepNext/><w:spacing w:before="240"/><w:ind w:firstLine="0"/><w:outlineLvl w:val="2"/>`, "<w:b/><w:i/>", '<w:next w:val="SinSangria"/>')}
${estilo("Escena", "Scene Break", '<w:keepNext/><w:ind w:firstLine="0"/><w:jc w:val="center"/>')}
${estilo("Cita", "Quote", '<w:ind w:left="720" w:right="720" w:firstLine="0"/>')}
${estilo("Codigo", "Code", '<w:spacing w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="left"/>', '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:sz w:val="20"/>')}
${estilo("Encabezado", "header", '<w:spacing w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/>')}
</w:styles>`;
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** Número de página como campo de Word (se actualiza solo). */
const campoPagina = '<w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple>';

/** Genera el .docx del libro. */
export async function crearDocx(libro: Libro, o: OpcionesExportar): Promise<Uint8Array> {
  const m = medidas(o);
  const tx = textosExportar(o.idioma);
  const pag = paginaDe(o);
  const twips = (pt: number) => Math.round(pt * 20);
  const ancho = twips(pag.ancho);
  const alto = twips(pag.alto);
  const altoTexto = alto - m.margenes.sup - m.margenes.inf;
  const anchoTexto = ancho - m.margenes.izq - m.margenes.der;
  const idioma = o.idioma === "es" ? "es-ES" : "en-US";

  // Portada. Manuscrito: autor arriba a la izquierda y palabras a la derecha; título y autor al
  // centro de la página. Libro: título y autor a un tercio de la página.
  let portada = "";
  if (o.estilo === "manuscrito") {
    portada += parrafo(
      "SinSangria",
      run({ texto: libro.autor }) + "<w:r><w:tab/></w:r>" + run({ texto: palabrasRedondeadasTexto(libro.palabras, tx) }),
      false,
      `<w:tabs><w:tab w:val="right" w:pos="${anchoTexto}"/></w:tabs>`,
    );
    portada += parrafo("Title", run({ texto: libro.titulo }), false, `<w:spacing w:before="${Math.round(altoTexto / 2 - 2 * m.interlinea)}"/>`);
  } else {
    portada += parrafo("Title", run({ texto: libro.titulo }), false, `<w:spacing w:before="${Math.round(altoTexto / 3)}"/>`);
  }
  if (libro.autor) portada += parrafo("Autor", run({ texto: o.estilo === "manuscrito" ? `${tx.por} ${libro.autor}` : libro.autor }));

  // Capítulos: el título (estilo «Heading 1») empieza página nueva; sin título, el salto va en el primer párrafo.
  let capitulos = "";
  for (const c of libro.capitulos) {
    if (!c.titulo && !c.bloques.length) continue;
    if (c.titulo) capitulos += parrafo("Heading1", run({ texto: c.titulo }));
    capitulos += cuerpo(c.bloques, m, !c.titulo);
  }
  if (o.estilo === "manuscrito") capitulos += parrafo("Escena", run({ texto: tx.fin }), false, `<w:spacing w:before="${m.interlinea}"/>`);

  // Manuscrito: encabezado «Apellido / Título / página» arriba a la derecha.
  // Libro: número de página al pie, centrado. En los dos, la portada va sin ninguno (`titlePg`).
  const referencia = o.estilo === "manuscrito" ? '<w:headerReference w:type="default" r:id="rId3"/>' : '<w:footerReference w:type="default" r:id="rId4"/>';
  const seccion = `<w:sectPr>${referencia}<w:pgSz w:w="${ancho}" w:h="${alto}"/><w:pgMar w:top="${m.margenes.sup}" w:right="${m.margenes.der}" w:bottom="${m.margenes.inf}" w:left="${m.margenes.izq}" w:header="720" w:footer="567" w:gutter="0"/><w:titlePg/></w:sectPr>`;

  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${portada}${capitulos}${seccion}</w:body></w:document>`;
  const encabezado = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${NS}>${parrafo("Encabezado", run({ texto: encabezadoManuscrito(libro.autor, libro.titulo) }) + campoPagina, false, '<w:jc w:val="right"/>')}</w:hdr>`;
  const pie = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${NS}>${parrafo("Encabezado", campoPagina, false, '<w:jc w:val="center"/>')}</w:ftr>`;
  const ahora = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  return crearZip([
    {
      nombre: "[Content_Types].xml",
      datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
    },
    {
      nombre: "_rels/.rels",
      datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
    },
    {
      nombre: "word/_rels/document.xml.rels",
      datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`,
    },
    { nombre: "word/document.xml", datos: documento },
    { nombre: "word/styles.xml", datos: estilos(m, idioma) },
    {
      nombre: "word/settings.xml",
      datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`,
    },
    { nombre: "word/header1.xml", datos: encabezado },
    { nombre: "word/footer1.xml", datos: pie },
    {
      nombre: "docProps/core.xml",
      datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(libro.titulo)}</dc:title><dc:creator>${xml(libro.autor)}</dc:creator><dc:language>${idioma}</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${ahora}</dcterms:created></cp:coreProperties>`,
    },
  ]);
}
