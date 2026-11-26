// Pruebas automáticas de las opciones del editor de cada cámara (`src/ajustes.ts`): los presets,
// saber cuál coincide y leer lo guardado (también con la forma de antes, un modo). Se corren con
// `pnpm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { AJUSTES_POR_DEFECTO, PRESETS_DEL_EDITOR, opcionesDelEditorDeLaCamara, presetQueCoincide } from "../../src/ajustes.ts";

test("cada preset coincide consigo mismo, y mezclar opciones es «personalizada»", () => {
  assert.equal(presetQueCoincide(PRESETS_DEL_EDITOR.escritor), "escritor");
  assert.equal(presetQueCoincide(PRESETS_DEL_EDITOR.programador), "programador");
  assert.equal(presetQueCoincide(PRESETS_DEL_EDITOR.simple), "simple");
  assert.equal(presetQueCoincide({ ...PRESETS_DEL_EDITOR.escritor, estilo_de_comillas: "curvas" }), "escritor", "el estilo de comillas no cuenta");
  assert.equal(presetQueCoincide({ ...PRESETS_DEL_EDITOR.escritor, cerrar_bloques_de_codigo: true }), null, "escritor y programador a la vez");
});

test("lee las opciones del editor de una cámara, nuevas, de antes o generales", () => {
  const ajustes = AJUSTES_POR_DEFECTO;
  assert.deepEqual(opcionesDelEditorDeLaCamara({}, ajustes), { ...PRESETS_DEL_EDITOR.escritor }, "sin nada guardado, el modo escritor de los ajustes");
  assert.deepEqual(opcionesDelEditorDeLaCamara({}, { ...ajustes, modo_escritor: false }), PRESETS_DEL_EDITOR.simple);
  assert.deepEqual(opcionesDelEditorDeLaCamara({ editor: { modo: "programador" } }, ajustes), PRESETS_DEL_EDITOR.programador, "la forma de antes");
  const guardadas = opcionesDelEditorDeLaCamara({ opciones_del_editor: { flechas: true, cerrar_parentesis: true } }, ajustes);
  assert.ok(guardadas.flechas && guardadas.cerrar_parentesis && !guardadas.comillas_tipograficas, "lo que falta queda apagado");
});
