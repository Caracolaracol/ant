// Pruebas automáticas de «Compilar y exportar»: del Markdown al libro, los textos de la portada,
// el ZIP y que el PDF y el Word salgan bien armados. Se corren con `pnpm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import {
  analizarNotaEnBloques,
  compilarLibro,
  contarPalabrasDeBloques,
  textoPlanoDe,
  tituloDesdeElNombreDelArchivo,
} from "../../src/compilar/modelo.ts";
import { apellidoDelAutor, encabezadoDelManuscrito, palabrasRedondeadasParaLaPortada } from "../../src/compilar/formato.ts";
import { calcularCrc32, crearZip } from "../../src/compilar/zip.ts";
import { crearPdf } from "../../src/compilar/pdf.ts";
import { crearDocx } from "../../src/compilar/docx.ts";
import { crearConfiguracionModoEscritor } from "../../src/editor/escritor.ts";
import { OPCIONES_DEL_MODO_ESCRITOR_POR_DEFECTO } from "../../src/ajustes.ts";

const textoDeUnCapitulo = `---
tags: [borrador]
---
# El hormiguero

Nadie *recordaba* quién había cavado el **túnel**.
Mira entró igual. %% revisar esto %%

***

Otra escena con [[Personajes/Mira|Mira]] y \`código\`.
![[mapa.png]]

> Una cita.`;

test("convierte Markdown en bloques: títulos, párrafos con estilo, escenas y citas", () => {
  const bloques = analizarNotaEnBloques(textoDeUnCapitulo);
  assert.deepEqual(bloques.map((bloque) => bloque.tipo), ["titulo", "parrafo", "parrafo", "escena", "parrafo", "parrafo"]);
  const primerParrafo = bloques[1];
  assert.ok(primerParrafo.tipo === "parrafo");
  assert.ok(primerParrafo.tramos.some((tramo) => tramo.enCursiva && tramo.texto === "recordaba"));
  assert.ok(primerParrafo.tramos.some((tramo) => tramo.enNegrita && tramo.texto === "túnel"));
  const textoDelLibro = bloques.map((bloque) => ("tramos" in bloque ? textoPlanoDe(bloque.tramos) : "")).join("\n");
  assert.ok(!textoDelLibro.includes("revisar esto"), "las notas %% %% no se exportan");
  assert.ok(!textoDelLibro.includes("borrador"), "el encabezado YAML no se exporta");
  assert.ok(!textoDelLibro.includes("mapa.png"), "las imágenes no se exportan");
  assert.ok(textoDelLibro.includes("Otra escena con Mira y código."), "los enlaces dejan solo su texto");
  const cita = bloques[5];
  assert.ok(cita.tipo === "parrafo" && cita.esCita);
});

test("cuenta palabras sin contar signos sueltos", () => {
  assert.equal(contarPalabrasDeBloques(analizarNotaEnBloques("Hola — mundo, ¿qué tal?")), 4);
});

test("arma el título de cada capítulo según el origen elegido", () => {
  assert.equal(tituloDesdeElNombreDelArchivo("01 - El viaje.md"), "El viaje");
  assert.equal(tituloDesdeElNombreDelArchivo("2026.md"), "2026");
  const notas = [{ nombreDelArchivo: "01 - Inicio.md", texto: textoDeUnCapitulo }];
  const opcionesBase = { titulo: "La colonia", nombreDelAutor: "Mira", configuracionTipografica: null };
  assert.equal(compilarLibro(notas, { ...opcionesBase, origenDelTitulo: "titulo" }).capitulos[0].titulo, "El hormiguero");
  assert.equal(compilarLibro(notas, { ...opcionesBase, origenDelTitulo: "archivo" }).capitulos[0].titulo, "Inicio");
  assert.equal(compilarLibro(notas, { ...opcionesBase, origenDelTitulo: "ninguno" }).capitulos[0].titulo, null);
});

test("corrige la tipografía del libro sin tocar el código", () => {
  const configuracion = crearConfiguracionModoEscritor(OPCIONES_DEL_MODO_ESCRITOR_POR_DEFECTO, "es");
  const libro = compilarLibro([{ nombreDelArchivo: "a.md", texto: 'Dijo "hola"... -- y `"no"`.' }], {
    titulo: "",
    nombreDelAutor: "",
    origenDelTitulo: "ninguno",
    configuracionTipografica: configuracion,
  });
  const parrafo = libro.capitulos[0].bloques[0];
  assert.ok(parrafo.tipo === "parrafo");
  assert.equal(textoPlanoDe(parrafo.tramos), 'Dijo «hola»… — y "no".');
});

test("textos de la portada del manuscrito", () => {
  assert.equal(apellidoDelAutor("Agustín Rojas"), "Rojas");
  assert.equal(encabezadoDelManuscrito("Agustín Rojas", "La colonia"), "Rojas / La colonia / ");
  assert.equal(encabezadoDelManuscrito("", "La colonia"), "La colonia / ");
  assert.equal(palabrasRedondeadasParaLaPortada(40), 100);
  assert.equal(palabrasRedondeadasParaLaPortada(12_345), 12_300);
  assert.equal(palabrasRedondeadasParaLaPortada(82_499), 82_000);
});

test("CRC-32 y ZIP: el contenido se recupera tal cual", async () => {
  assert.equal(calcularCrc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const zip = await crearZip([{ nombre: "hola.txt", contenido: "hola hormiga ".repeat(50) }]);
  const vista = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(vista.getUint32(0, true), 0x04034b50, "empieza con un encabezado local");
  const largoDelNombre = vista.getUint16(26, true);
  const largoComprimido = vista.getUint32(18, true);
  const inicioDelContenido = 30 + largoDelNombre;
  const contenido = inflateRawSync(zip.subarray(inicioDelContenido, inicioDelContenido + largoComprimido));
  assert.equal(contenido.toString(), "hola hormiga ".repeat(50));
});

test("el PDF y el Word salen bien armados, en los dos estilos", async () => {
  const libro = compilarLibro(
    [
      { nombreDelArchivo: "01 - Inicio.md", texto: textoDeUnCapitulo },
      { nombreDelArchivo: "02 - Final.md", texto: "Fin de la historia. ".repeat(300) },
    ],
    { titulo: "La colonia", nombreDelAutor: "Agustín Rojas", origenDelTitulo: "titulo", configuracionTipografica: null },
  );
  for (const estilo of ["manuscrito", "libro"] as const) {
    const opciones = { estilo, tamanoDePagina: "a4" as const, idioma: "es" as const };
    const pdf = Buffer.from(await crearPdf(libro, opciones)).toString("latin1");
    assert.ok(pdf.startsWith("%PDF-1.4"), estilo);
    assert.ok(pdf.trimEnd().endsWith("%%EOF"), estilo);
    const cantidadDePaginas = Number(/\/Count (\d+)/.exec(pdf)?.[1]);
    assert.ok(cantidadDePaginas >= 3, `${estilo}: portada y al menos dos capítulos (${cantidadDePaginas} páginas)`);
    const docx = Buffer.from(await crearDocx(libro, opciones));
    assert.equal(docx.readUInt32LE(0), 0x04034b50, `${estilo}: el .docx es un ZIP`);
    assert.ok(docx.includes("word/document.xml"), `${estilo}: el .docx tiene su documento`);
  }
});
