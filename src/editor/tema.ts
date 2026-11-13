// Apariencia del editor: colores y tipografía de CodeMirror y el resaltado del Markdown.
// Los colores salen de variables CSS definidas en `App.css` (como los temas de Left), así un
// cambio de tema solo toca esas variables y no este archivo.

import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/** Estilos de la vista: fondo, texto, cursor, selección y márgenes de lectura. */
export const tema = EditorView.theme(
  {
    "&": { height: "100%", color: "var(--texto)", backgroundColor: "var(--fondo)" },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": { fontFamily: "var(--fuente)", lineHeight: "1.7", overflow: "auto" },
    // Columna de texto centrada y de ancho limitado, cómoda para leer y escribir.
    ".cm-content": { maxWidth: "72ch", margin: "0 auto", padding: "24px 24px 48px", caretColor: "var(--acento)" },
    ".cm-cursor": { borderLeftColor: "var(--acento)", borderLeftWidth: "2px" },
    ".cm-activeLine": { backgroundColor: "transparent" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "var(--seleccion) !important",
    },
    ".cm-selectionMatch": { backgroundColor: "var(--coincidencia)" },
    // Panel de búsqueda (Cmd+F) con los colores de la app.
    ".cm-panels": { backgroundColor: "var(--fondo-bajo)", color: "var(--texto)" },
    ".cm-panels input, .cm-panels button": { fontFamily: "inherit", color: "inherit" },
  },
  { dark: true },
);

/** Colores del Markdown: títulos, énfasis, enlaces, código y citas. */
export const resaltado = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.heading1, fontSize: "1.5em", fontWeight: "700", color: "var(--titulo)" },
    { tag: tags.heading2, fontSize: "1.25em", fontWeight: "700", color: "var(--titulo)" },
    { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], fontWeight: "700", color: "var(--titulo)" },
    { tag: tags.strong, fontWeight: "700" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strikethrough, textDecoration: "line-through" },
    { tag: [tags.link, tags.url], color: "var(--acento)" },
    { tag: tags.monospace, color: "var(--codigo)" },
    { tag: tags.quote, color: "var(--tenue)", fontStyle: "italic" },
    // Los símbolos de marcado (#, *, >, -) van atenuados para que el texto destaque.
    { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: "var(--tenue)" },
  ]),
);
