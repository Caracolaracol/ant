// Pruebas automáticas de las imágenes en el texto de una nota: encontrarlas, resolver sus rutas y
// escribir el enlace de una imagen nueva. Se corren con `pnpm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  enlaceDeImagen,
  esArchivoDeImagen,
  imagenesDeLaLinea,
  rutaCompletaDeLaImagen,
  rutaRelativaDesde,
} from "../../src/editor/imagenesEnElTexto.ts";

test("encuentra las imágenes de Markdown y de Obsidian en una línea", () => {
  assert.deepEqual(imagenesDeLaLinea("Texto sin imágenes"), []);
  const [simple] = imagenesDeLaLinea("Mira ![el mapa](Images/mapa.png) aquí");
  assert.equal(simple.destino, "Images/mapa.png");
  assert.equal(simple.desde, 5);
  assert.equal(imagenesDeLaLinea("![](<Mi carpeta/foto 1.png>)")[0].destino, "Mi carpeta/foto 1.png");
  assert.equal(imagenesDeLaLinea("![](foto%201.png \"título\")")[0].destino, "foto 1.png");
  assert.equal(imagenesDeLaLinea("![](https://ejemplo.cl/a%20b.png)")[0].destino, "https://ejemplo.cl/a%20b.png", "las direcciones web quedan como están");
  const [deObsidian] = imagenesDeLaLinea("![[Pasted image 2026.png|300]]");
  assert.deepEqual([deObsidian.destino, deObsidian.esDeObsidian], ["Pasted image 2026.png", true]);
  assert.deepEqual(imagenesDeLaLinea("![[Otra nota]]"), [], "un enlace de Obsidian a una nota no es una imagen");
  assert.equal(imagenesDeLaLinea("![a](1.png) y ![b](2.png)").length, 2);
  assert.deepEqual(imagenesDeLaLinea("[un enlace](a.png)"), [], "sin ! es un enlace, no una imagen");
});

test("resuelve la ruta de una imagen desde la carpeta de la nota", () => {
  assert.equal(rutaCompletaDeLaImagen("Images/a.png", "/h/Novela"), "/h/Novela/Images/a.png");
  assert.equal(rutaCompletaDeLaImagen("./a.png", "/h/Novela/"), "/h/Novela/a.png");
  assert.equal(rutaCompletaDeLaImagen("../Fotos/a.png", "/h/Novela"), "/h/Fotos/a.png");
  assert.equal(rutaCompletaDeLaImagen("/otra/a.png", "/h/Novela"), "/otra/a.png");
  assert.equal(rutaCompletaDeLaImagen("Images/a.png", "C:\\h\\Novela"), "C:\\h\\Novela\\Images\\a.png");
});

test("enlaza una imagen que ya está en el hormiguero con su ruta relativa", () => {
  assert.equal(rutaRelativaDesde("/h/Novela", "/h/Novela/Images/a.png"), "Images/a.png");
  assert.equal(rutaRelativaDesde("/h/Novela/Libro", "/h/Fotos/a.png"), "../../Fotos/a.png");
  assert.equal(rutaRelativaDesde("/h/Novela", "/h/Novela/a.png"), "a.png");
});

test("escribe el enlace de Markdown de una imagen nueva", () => {
  assert.equal(enlaceDeImagen("Images/mapa-del-nido.png"), "![mapa-del-nido](Images/mapa-del-nido.png)");
  assert.equal(enlaceDeImagen("../Mis fotos/playa.jpg"), "![playa](<../Mis fotos/playa.jpg>)", "con espacios, entre < >");
  assert.ok(esArchivoDeImagen("/a/FOTO.JPG") && esArchivoDeImagen("https://x.cl/a.webp?v=2") && !esArchivoDeImagen("nota.md"));
});
