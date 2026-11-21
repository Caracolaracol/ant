// Pruebas automáticas del modo escritor: qué reemplazo tipográfico se hace al teclear cada
// carácter. Se corren con `pnpm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { crearConfiguracionModoEscritor, reemplazoTipografico } from "../../src/editor/escritor.ts";
import { OPCIONES_DEL_MODO_ESCRITOR_POR_DEFECTO } from "../../src/ajustes.ts";

const configuracionEnEspanol = crearConfiguracionModoEscritor(OPCIONES_DEL_MODO_ESCRITOR_POR_DEFECTO, "es");
const configuracionEnIngles = crearConfiguracionModoEscritor(OPCIONES_DEL_MODO_ESCRITOR_POR_DEFECTO, "en");

/** Simula teclear `textoTecleado` letra por letra con el modo escritor y devuelve lo que queda. */
function teclear(textoTecleado: string, configuracion = configuracionEnEspanol): string {
  let lineaEscrita = "";
  for (const caracter of textoTecleado) {
    const reemplazo = reemplazoTipografico(lineaEscrita, caracter, configuracion);
    lineaEscrita = reemplazo
      ? lineaEscrita.slice(0, lineaEscrita.length - reemplazo.caracteresQueSeBorran) + reemplazo.textoQueSeInserta
      : lineaEscrita + caracter;
  }
  return lineaEscrita;
}

test("comillas según el idioma: latinas en español, curvas en inglés", () => {
  assert.equal(teclear('dijo "hola"'), "dijo «hola»");
  assert.equal(teclear('said "hi"', configuracionEnIngles), "said “hi”");
  assert.equal(teclear("it's"), "it’s");
  assert.equal(teclear("('sí')"), "(‘sí’)");
});

test("rayas, puntos suspensivos, comillas angulares y flechas", () => {
  assert.equal(teclear("--¿Hay alguien?"), "—¿Hay alguien?");
  assert.equal(teclear("y entonces..."), "y entonces…");
  assert.equal(teclear("<<hola>>"), "«hola»");
  assert.equal(teclear("a -> b <- c"), "a → b ← c");
});

test("respeta la sintaxis de Markdown: separadores, tablas y citas", () => {
  assert.equal(teclear("---"), "---");
  assert.equal(teclear("|---|---|"), "|---|---|");
  assert.equal(teclear(">> cita dentro de cita"), ">> cita dentro de cita");
});

test("cada opción apagada deja el texto tal cual", () => {
  const todoApagado = crearConfiguracionModoEscritor(
    {
      ...OPCIONES_DEL_MODO_ESCRITOR_POR_DEFECTO,
      comillas_tipograficas: false,
      rayas_de_dialogo: false,
      puntos_suspensivos: false,
      comillas_angulares: false,
      flechas: false,
    },
    "es",
  );
  const textoConTodo = '"hola" -- ... << >> -> <-';
  assert.equal(teclear(textoConTodo, todoApagado), textoConTodo);
});

test("el estilo de comillas elegido le gana al idioma", () => {
  const curvasEnEspanol = crearConfiguracionModoEscritor({ ...OPCIONES_DEL_MODO_ESCRITOR_POR_DEFECTO, estilo_de_comillas: "curvas" }, "es");
  assert.equal(teclear('"hola"', curvasEnEspanol), "“hola”");
});
