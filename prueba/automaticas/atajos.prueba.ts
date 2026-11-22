// Pruebas automáticas de los atajos de teclado (`src/atajos.ts`): leer una tecla pulsada, mostrar
// un atajo, saber si está libre y guardar un cambio. Se corren con `pnpm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACCIONES_CON_ATAJO,
  atajoDeLaAccion,
  atajoDeLaTecla,
  atajosConElCambio,
  esElAtajo,
  motivoParaNoUsarElAtajo,
  textoDelAtajo,
} from "../../src/atajos.ts";

/** Una tecla pulsada de ejemplo. */
const tecla = (code: string, modificadores: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
  code,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...modificadores,
});

test("lee el atajo de una tecla pulsada, con ⌘ en macOS y Ctrl en los demás", () => {
  assert.equal(atajoDeLaTecla(tecla("KeyN", { metaKey: true, shiftKey: true }), true), "CmdOrCtrl+Shift+KeyN");
  assert.equal(atajoDeLaTecla(tecla("KeyN", { ctrlKey: true }), false), "CmdOrCtrl+KeyN");
  assert.equal(atajoDeLaTecla(tecla("KeyN", { ctrlKey: true }), true), null, "en macOS hace falta ⌘");
  assert.equal(atajoDeLaTecla(tecla("KeyN", { metaKey: true, ctrlKey: true, altKey: true }), true), "CmdOrCtrl+Ctrl+Alt+KeyN");
  assert.equal(atajoDeLaTecla(tecla("MetaLeft", { metaKey: true }), true), null, "solo un modificador todavía no es un atajo");
  assert.equal(atajoDeLaTecla(tecla("KeyN"), true), null, "una letra sola se escribe, no es un atajo");
});

test("reconoce los atajos por defecto", () => {
  assert.ok(esElAtajo(tecla("Backslash", { metaKey: true }), atajoDeLaAccion({}, "mostrar_panel"), true));
  assert.ok(esElAtajo(tecla("BracketRight", { metaKey: true, shiftKey: true }), atajoDeLaAccion({}, "nota_siguiente"), true));
  assert.ok(!esElAtajo(tecla("KeyN", { metaKey: true, shiftKey: true }), atajoDeLaAccion({}, "nota_nueva"), true));
  assert.equal(atajoDeLaAccion({ nota_nueva: "CmdOrCtrl+KeyT" }, "nota_nueva"), "CmdOrCtrl+KeyT");
});

test("muestra los atajos como se leen en cada sistema", () => {
  assert.equal(textoDelAtajo("CmdOrCtrl+Shift+KeyN", true), "⇧⌘N");
  assert.equal(textoDelAtajo("CmdOrCtrl+Ctrl+Alt+Digit1", true), "⌃⌥⌘1");
  assert.equal(textoDelAtajo("CmdOrCtrl+Comma", true), "⌘,");
  assert.equal(textoDelAtajo("CmdOrCtrl+Shift+BracketRight", false), "Ctrl+Shift+]");
});

test("no deja usar un atajo de otra acción, del editor o del sistema", () => {
  assert.deepEqual(motivoParaNoUsarElAtajo({}, "nota_nueva", "CmdOrCtrl+KeyO"), { tipo: "en_uso", id: "abrir_nota" });
  assert.deepEqual(motivoParaNoUsarElAtajo({}, "nota_nueva", "CmdOrCtrl+KeyF"), { tipo: "en_uso", id: "buscar" });
  assert.deepEqual(motivoParaNoUsarElAtajo({}, "nota_nueva", "CmdOrCtrl+KeyQ"), { tipo: "reservado" });
  assert.equal(motivoParaNoUsarElAtajo({}, "nota_nueva", "CmdOrCtrl+KeyN"), null, "su propio atajo sí");
  assert.equal(motivoParaNoUsarElAtajo({ abrir_nota: "CmdOrCtrl+KeyP" }, "nota_nueva", "CmdOrCtrl+KeyO"), null, "libre si la otra acción cambió el suyo");
});

test("guarda solo los atajos distintos del de por defecto", () => {
  assert.deepEqual(atajosConElCambio({}, "guardar", "CmdOrCtrl+KeyG"), { guardar: "CmdOrCtrl+KeyG" });
  assert.deepEqual(atajosConElCambio({ guardar: "CmdOrCtrl+KeyG" }, "guardar", "CmdOrCtrl+KeyS"), {}, "volver al de por defecto lo quita");
  assert.deepEqual(atajosConElCambio({ guardar: "CmdOrCtrl+KeyG", ajustes: "CmdOrCtrl+Period" }, "guardar", null), { ajustes: "CmdOrCtrl+Period" });
  assert.equal(new Set(ACCIONES_CON_ATAJO.map((accion) => accion.porDefecto)).size, ACCIONES_CON_ATAJO.length, "los de por defecto no se repiten");
});
