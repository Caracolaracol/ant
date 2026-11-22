// Pruebas automáticas del modo programador (`src/editor/programador.ts`): saber si una valla de
// código (```) abre un bloque que todavía no se cerró, para cerrarlo solo al pulsar Enter. Se
// corren con `pnpm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { EditorState } from "@codemirror/state";
import { ensureSyntaxTree } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { abreUnBloqueSinCerrar } from "../../src/editor/programador.ts";

/** Estado del editor con Markdown y su árbol de sintaxis ya armado. */
function estadoCon(texto: string) {
  const estado = EditorState.create({ doc: texto, extensions: [markdown({ base: markdownLanguage })] });
  ensureSyntaxTree(estado, estado.doc.length, 5000);
  return estado;
}

test("una valla recién escrita abre un bloque sin cerrar", () => {
  assert.ok(abreUnBloqueSinCerrar(estadoCon("Texto\n\n```js"), 3, "```"));
  assert.ok(abreUnBloqueSinCerrar(estadoCon("```"), 1, "```"));
});

test("una valla de un bloque que ya se cerró no se vuelve a cerrar", () => {
  assert.ok(!abreUnBloqueSinCerrar(estadoCon("```js\nconst a = 1;\n```\n"), 1, "```"));
  assert.ok(!abreUnBloqueSinCerrar(estadoCon("```js\nconst a = 1;\n```\n"), 3, "```"), "la de cierre no abre nada");
});
