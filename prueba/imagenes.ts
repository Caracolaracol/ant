// Página de prueba de las imágenes en el editor, fuera de Tauri (`pnpm dev`, luego
// http://localhost:1420/prueba/imagenes.html). Muestra una nota con una imagen en línea (data:),
// que se ve, y una relativa y una de Obsidian, que fuera de Tauri no se pueden leer y quedan con
// su nombre tenue. Sirve para revisar cómo se dibujan; leer archivos solo funciona en la app.
// Con `?escritor`, con el preset Escritor (tipografía y la vista del Markdown: sin `#`, `**`…,
// salvo en la línea del cursor, que queda en la primera).

import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { cambiarLugarDeLaNota, imagenesALaVista, lugarDeLaNotaEnElEditor } from "../src/editor/imagenes";
import { extensionesDeLaVistaDelMarkdown } from "../src/editor/vistaDelMarkdown";
import { resaltadoDelMarkdown, temaDelEditor } from "../src/editor/tema";
import { crearConfiguracionModoEscritor, extensionesDelModoEscritor } from "../src/editor/escritor";
import { PRESETS_DEL_EDITOR } from "../src/ajustes";
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
  "Sigue el texto de la nota, con **negrita**, *itálica*, ~~tachado~~, `código` y un [enlace](https://ejemplo.cl).",
  "",
  "> Una cita de la reina.",
  "",
  "- Primer punto",
  "- [ ] Tarea pendiente",
  "- [x] Tarea hecha",
  "",
  "---",
].join("\n");

const vista = new EditorView({
  parent: document.getElementById("editor")!,
  state: EditorState.create({
    doc: texto,
    // El cursor queda al principio: lo de abajo se ve sin marcas con el preset Escritor.
    selection: { anchor: 0 },
    extensions: [
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage }),
      temaDelEditor,
      resaltadoDelMarkdown,
      lugarDeLaNotaEnElEditor,
      imagenesALaVista,
      location.search.includes("escritor") ? extensionesDelModoEscritor(crearConfiguracionModoEscritor(PRESETS_DEL_EDITOR.escritor, "es")) : [],
      location.search.includes("escritor") ? extensionesDeLaVistaDelMarkdown(PRESETS_DEL_EDITOR.escritor) : [],
    ],
  }),
});
vista.dispatch({ effects: cambiarLugarDeLaNota.of({ rutaDeLaNota: "/Users/yo/Hormiguero/Novela/Mapa del nido.md", carpetaDelHormiguero: "/Users/yo/Hormiguero" }) });
