// Página de prueba de las imágenes en el editor, fuera de Tauri (`pnpm dev`, luego
// http://localhost:1420/prueba/imagenes.html). Muestra una nota con una imagen en línea (data:),
// que se ve, y una relativa y una de Obsidian, que fuera de Tauri no se pueden leer y quedan con
// su nombre tenue. Sirve para revisar cómo se dibujan; leer archivos solo funciona en la app.
// Con `?escritor`, con el modo escritor (los `#` de los títulos no se ven, salvo con el cursor).

import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { cambiarLugarDeLaNota, extensionesDeImagenes } from "../src/editor/imagenes";
import { resaltadoDelMarkdown, temaDelEditor } from "../src/editor/tema";
import { crearConfiguracionModoEscritor, extensionesDelModoEscritor } from "../src/editor/escritor";
import { AJUSTES_POR_DEFECTO } from "../src/ajustes";
import "../src/App.css";

/** Un dibujo de ejemplo como imagen en línea: un hormiguero con tres cámaras. */
const dibujo =
  "data:image/svg+xml," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="260"><rect width="640" height="260" fill="#3b2a1e"/>` +
    `<path d="M40 40 H600" stroke="#e5ea15" stroke-width="6"/><ellipse cx="160" cy="150" rx="90" ry="50" fill="#1d1d20"/>` +
    `<ellipse cx="340" cy="190" rx="80" ry="40" fill="#1d1d20"/><ellipse cx="500" cy="130" rx="70" ry="45" fill="#1d1d20"/></svg>`);

const texto = [
  "# Mapa del nido",
  "",
  "## Las cámaras",
  "",
  "Así se ven las cámaras desde arriba:",
  "",
  `![mapa](${dibujo})`,
  "",
  "Una imagen junto a la nota (fuera de Tauri no se puede leer):",
  "",
  "![foto](Images/foto-de-la-reina.png)",
  "",
  "Y una de Obsidian: ![[Pasted image 20240101.png]]",
  "",
  "Sigue el texto de la nota.",
].join("\n");

const vista = new EditorView({
  parent: document.getElementById("editor")!,
  state: EditorState.create({
    doc: texto,
    // El cursor queda al final: los títulos de arriba se ven sin sus `#` en el modo escritor.
    selection: { anchor: texto.length },
    extensions: [
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage }),
      temaDelEditor,
      resaltadoDelMarkdown,
      extensionesDeImagenes,
      location.search.includes("escritor") ? extensionesDelModoEscritor(crearConfiguracionModoEscritor(AJUSTES_POR_DEFECTO.opciones_del_modo_escritor, "es")) : [],
    ],
  }),
});
vista.dispatch({ effects: cambiarLugarDeLaNota.of({ rutaDeLaNota: "/Users/yo/Hormiguero/Novela/Mapa del nido.md", carpetaDelHormiguero: "/Users/yo/Hormiguero" }) });
