// Pruebas automáticas de la lógica de las notas: títulos de una nota, conteo de la barra de
// estado, claves de los fijados y el modelo de las notas abiertas. Se corren con `pnpm test`
// (Node, sin dependencias: `node --experimental-strip-types --test`).

import { test } from "node:test";
import assert from "node:assert/strict";
import { extraerTitulosDeLaNota, indiceDelTituloEnLaPosicion } from "../../src/titulosDeLaNota.ts";
import { contarPalabrasLineasYCaracteres } from "../../src/conteoDelTexto.ts";
import { claveDeCapitulo, interpretarClaveDeFijado } from "../../src/barraLateral/clavesDeFijados.ts";
import { crearNotaEnBlanco, esNotaEnBlanco, esperaQueLaGuarden, idDeNotaConArchivo } from "../../src/notasAbiertas/notaAbierta.ts";

test("extrae los títulos con su nivel y posición, ignorando los bloques de código", () => {
  const textoDeLaNota = "# Uno\ntexto\n## Dos ##\n```\n# no es título\n```\n###### Seis";
  assert.deepEqual(extraerTitulosDeLaNota(textoDeLaNota), [
    { texto: "Uno", nivel: 1, posicion: 0 },
    { texto: "Dos", nivel: 2, posicion: 12 },
    { texto: "Seis", nivel: 6, posicion: textoDeLaNota.indexOf("###### Seis") },
  ]);
  assert.deepEqual(extraerTitulosDeLaNota("#sin espacio\n####### siete"), []);
});

test("dice en qué título está el cursor", () => {
  const titulos = extraerTitulosDeLaNota("intro\n# Uno\ntexto\n# Dos\nmás");
  assert.equal(indiceDelTituloEnLaPosicion(titulos, 0), -1);
  assert.equal(indiceDelTituloEnLaPosicion(titulos, 6), 0);
  assert.equal(indiceDelTituloEnLaPosicion(titulos, 15), 0);
  assert.equal(indiceDelTituloEnLaPosicion(titulos, 100), 1);
});

test("cuenta palabras, líneas y caracteres", () => {
  assert.deepEqual(contarPalabrasLineasYCaracteres(""), { cantidadDePalabras: 0, cantidadDeLineas: 1, cantidadDeCaracteres: 0 });
  assert.deepEqual(contarPalabrasLineasYCaracteres("  hola   mundo\n\nchau "), {
    cantidadDePalabras: 3,
    cantidadDeLineas: 3,
    cantidadDeCaracteres: 21,
  });
});

test("interpreta las claves de los fijados: carpetas, notas y capítulos", () => {
  assert.deepEqual(interpretarClaveDeFijado("/n/Libro I"), { clave: "/n/Libro I", ruta: "/n/Libro I", tituloDelCapitulo: null });
  const claveDelCapitulo = claveDeCapitulo("/n/02 - La lluvia.md", "La cueva #2");
  assert.deepEqual(interpretarClaveDeFijado(claveDelCapitulo), {
    clave: claveDelCapitulo,
    ruta: "/n/02 - La lluvia.md",
    tituloDelCapitulo: "La cueva #2",
  });
  // Un `#` en el nombre de una carpeta no la convierte en capítulo.
  assert.equal(interpretarClaveDeFijado("/n/Ideas #1").tituloDelCapitulo, null);
});

test("las notas abiertas: en blanco, con archivo y las que esperan guardarse", () => {
  const notaEnBlanco = crearNotaEnBlanco();
  assert.ok(esNotaEnBlanco(notaEnBlanco));
  assert.ok(!esperaQueLaGuarden(notaEnBlanco));
  assert.notEqual(crearNotaEnBlanco().id, notaEnBlanco.id);
  const notaNuevaConTexto = { ...notaEnBlanco, ultimoTextoConocido: "hola", tieneCambiosSinGuardar: true };
  assert.ok(!esNotaEnBlanco(notaNuevaConTexto));
  assert.ok(esperaQueLaGuarden(notaNuevaConTexto));
  // Una nota con archivo se guarda sola: nunca «espera que la guarden».
  assert.ok(!esperaQueLaGuarden({ ...notaNuevaConTexto, rutaDelArchivo: "/n/a.md" }));
  assert.equal(idDeNotaConArchivo("/n/a.md"), idDeNotaConArchivo("/n/a.md"));
});
