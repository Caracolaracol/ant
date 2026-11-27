// Apariencia del editor: colores y tipografía de CodeMirror y el resaltado del Markdown.
// Los colores salen de variables CSS definidas en `App.css` (como los temas de Left), así un
// cambio de tema solo toca esas variables y no este archivo.

import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/** Estilos de la vista: fondo, texto, cursor, selección y márgenes de lectura. */
export const temaDelEditor = EditorView.theme(
  {
    "&": { height: "100%", color: "var(--texto)", backgroundColor: "var(--fondo)" },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": { fontFamily: "var(--fuente)", lineHeight: "1.7", overflow: "auto" },
    // Columna centrada: el ancho elegido en Ajustes prevalece sobre el de la tipografía.
    ".cm-content": {
      maxWidth: "min(100%, var(--ancho-del-texto, 72ch))",
      margin: "0 auto", padding: "24px 24px 48px", caretColor: "var(--acento)",
    },
    ".cm-cursor": { borderLeftColor: "var(--acento)", borderLeftWidth: "2px" },
    ".cm-activeLine": { backgroundColor: "transparent" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "var(--seleccion) !important",
    },
    ".cm-selectionMatch": { backgroundColor: "var(--coincidencia)" },
    // Panel de búsqueda (Cmd+F) con los colores de la app.
    ".cm-panels": { backgroundColor: "var(--fondo-bajo)", color: "var(--texto)" },
    ".cm-panels input, .cm-panels button": { fontFamily: "inherit", color: "inherit" },
    // Imágenes de la nota (`imagenes.ts`), debajo de su línea: a lo ancho de la columna como
    // máximo, sin pasar de media pantalla de alto. Si no se encuentra, su nombre tenue.
    ".cm-imagen": { padding: "6px 0 10px" },
    ".cm-imagen img": { display: "block", maxWidth: "100%", maxHeight: "60vh", borderRadius: "6px" },
    ".cm-imagen.no-encontrada": { color: "var(--tenue)", fontSize: "0.85em" },
    // Líneas de los bloques de código en el modo programador (`programador.ts`).
    ".cm-linea-de-codigo": { backgroundColor: "var(--fondo-bajo)" },
    // Vista del Markdown (`vistaDelMarkdown.ts`): código en línea, citas, viñetas, tareas y separadores.
    ".cm-codigo-en-linea": { backgroundColor: "var(--fondo-bajo)", borderRadius: "4px", padding: "1px 4px" },
    ".cm-linea-de-cita": { borderLeft: "3px solid var(--seleccion)", paddingLeft: "12px !important" },
    ".cm-vineta": { color: "var(--acento)" },
    ".cm-casilla-de-tarea": { margin: "0 6px 0 0", verticalAlign: "-2px", accentColor: "var(--acento)", cursor: "pointer" },
    ".cm-separador": { display: "inline-block", width: "100%", verticalAlign: "middle", borderTop: "1px solid var(--seleccion)" },
  },
  { dark: true },
);

/** Colores del Markdown: títulos, énfasis, enlaces, código y citas. */
export const resaltadoDelMarkdown = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.heading1, fontSize: "1.5em", fontWeight: "700", color: "var(--titulo)" },
    { tag: tags.heading2, fontSize: "1.25em", fontWeight: "700", color: "var(--titulo)" },
    { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], fontWeight: "700", color: "var(--titulo)" },
    // La negrita también un poco más clara, para que se note aunque la letra tenga poco contraste de grosor.
    { tag: tags.strong, fontWeight: "700", color: "var(--titulo)" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strikethrough, textDecoration: "line-through" },
    { tag: [tags.link, tags.url], color: "var(--acento)" },
    // El código va siempre en letra de ancho fijo, también con la letra de libro del modo escritor.
    { tag: tags.monospace, color: "var(--codigo)", fontFamily: "var(--fuente)" },
    { tag: tags.quote, color: "var(--tenue)", fontStyle: "italic" },
    // Los símbolos de marcado (#, *, >, -) van atenuados para que el texto destaque.
    { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: "var(--tenue)" },
  ]),
);
