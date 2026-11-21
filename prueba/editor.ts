// Página de prueba (no es parte de la app): el mismo editor de Ant, fuera de Tauri, para
// compararlo en distintos navegadores (Safari = WebKit, como Ant en macOS; Chrome = Chromium,
// como Obsidian; Zen = Firefox) con una nota larga. Muestra los cuadros por segundo y el cuadro
// más lento, y permite apagar extensiones para ver cuál pesa.
// Se abre con `pnpm dev` en http://localhost:1420/prueba/editor.html

import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, drawSelection, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { highlightSelectionMatches } from "@codemirror/search";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { temaDelEditor, resaltadoDelMarkdown } from "../src/editor/tema";
import "../src/App.css";

/** Nota larga de prueba: muchas secciones con títulos, párrafos largos, listas y código. */
function notaLarga(): string {
  const parrafo =
    "Las hormigas del género Camponotus construyen sus nidos en madera blanda y salen de noche a buscar " +
    "alimento. Siguen rastros de feromonas que dejan sus compañeras y pueden recorrer **distancias largas** " +
    "sin perderse, guiándose también por la luz polarizada y por _marcas del terreno_.";
  const partes: string[] = [];
  for (let i = 1; i <= 400; i++) {
    partes.push(`# Capítulo ${i}`, "", parrafo, "", `## Sección ${i}.1`, "", parrafo + " " + parrafo, "",
      "- primer punto de la lista", "- segundo punto con `código`", "", "```js", `const n = ${i};`, "```", "");
  }
  return partes.join("\n");
}

// Cada extensión opcional va en su propio compartimento, para poder apagarla sin recrear el editor.
const opciones = {
  coincidencias: { compartimento: new Compartment(), crearExtensiones: () => highlightSelectionMatches() },
  ajuste: { compartimento: new Compartment(), crearExtensiones: () => EditorView.lineWrapping },
  markdown: { compartimento: new Compartment(), crearExtensiones: () => [markdown({ base: markdownLanguage, codeLanguages: languages }), resaltadoDelMarkdown] },
  seleccion: { compartimento: new Compartment(), crearExtensiones: () => drawSelection() },
};

const vista = new EditorView({
  parent: document.getElementById("editor")!,
  state: EditorState.create({
    doc: notaLarga(),
    extensions: [
      history(), highlightActiveLine(), keymap.of([...defaultKeymap, ...historyKeymap]), temaDelEditor,
      ...Object.values(opciones).map((opcion) => opcion.compartimento.of(opcion.crearExtensiones())),
    ],
  }),
});

// Casillas: encienden o apagan cada extensión.
document.querySelectorAll<HTMLInputElement>("input[data-op]").forEach((casilla) => {
  casilla.addEventListener("change", () => {
    const opcion = opciones[casilla.dataset.op as keyof typeof opciones];
    vista.dispatch({ effects: opcion.compartimento.reconfigure(casilla.checked ? opcion.crearExtensiones() : []) });
  });
});

// Motor del navegador, para no confundir las ventanas al comparar.
const agenteDelNavegador = navigator.userAgent;
document.getElementById("motor")!.textContent =
  /Firefox/.test(agenteDelNavegador) ? "Firefox (Zen)" : /Chrome/.test(agenteDelNavegador) ? "Chromium" : /Safari/.test(agenteDelNavegador) ? "WebKit (Safari)" : "?";

// Medidor: cuenta cuadros por segundo y guarda el cuadro más lento del último segundo.
let cuadros = 0, peor = 0, anterior = performance.now(), inicio = anterior;
function medir(ahora: number) {
  cuadros++;
  peor = Math.max(peor, ahora - anterior);
  anterior = ahora;
  if (ahora - inicio >= 1000) {
    document.getElementById("fps")!.textContent = `${Math.round((cuadros * 1000) / (ahora - inicio))} fps`;
    document.getElementById("peor")!.textContent = `peor cuadro: ${Math.round(peor)} ms`;
    cuadros = 0; peor = 0; inicio = ahora;
  }
  requestAnimationFrame(medir);
}
requestAnimationFrame(medir);
