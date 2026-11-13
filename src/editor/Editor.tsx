// Componente React que monta CodeMirror 6 y lo expone al resto de la app.
// CodeMirror maneja su propio DOM, así que React solo crea el contenedor y la vista se
// administra con una ref: React no vuelve a dibujar el texto en cada tecla, lo que mantiene
// el editor rápido incluso con notas largas.
//
// Hay una sola vista para todas las notas abiertas: cada nota guarda su propio EditorState
// (texto, cursor e historial de deshacer) y al cambiar de nota se intercambia el estado.

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, keymap, drawSelection, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { tema, resaltado } from "./tema";

/** Métodos que la app puede llamar sobre el editor desde fuera. */
export interface EditorHandle {
  /** Muestra la nota `id`; si es la primera vez, la crea con `texto`. */
  mostrar(id: string, texto: string): void;
  /** Olvida el estado guardado de una nota cerrada. */
  olvidar(id: string): void;
  /** Devuelve el texto de una nota (la visible o una guardada en segundo plano). */
  getText(id: string): string;
  /** Mueve el cursor a la posición `pos` de la nota visible y la centra en pantalla. */
  irA(pos: number): void;
  /** Pone el foco en el editor. */
  focus(): void;
}

interface Props {
  /** Se llama cada vez que el usuario cambia el texto de la nota visible. */
  onChange(text: string): void;
  /** Se llama cuando el cursor se mueve, con su posición (para marcar el título actual). */
  onCursor(pos: number): void;
}

export const Editor = forwardRef<EditorHandle, Props>(function Editor({ onChange, onCursor }, ref) {
  const contenedor = useRef<HTMLDivElement>(null);
  const vista = useRef<EditorView | null>(null);
  // Nota visible y estados guardados de las demás notas abiertas.
  const actual = useRef<string | null>(null);
  const estados = useRef(new Map<string, EditorState>());
  // Últimos callbacks en refs: la vista se crea una sola vez y siempre llama a la versión vigente.
  const callbacks = useRef({ onChange, onCursor });
  callbacks.current = { onChange, onCursor };

  /** Extensiones de CodeMirror: historial, atajos, Markdown, tema y avisos a la app. */
  const extensiones = () => [
    history(),
    drawSelection(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    EditorView.lineWrapping,
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    // `codeLanguages` resalta los bloques de código según su lenguaje (se cargan bajo demanda).
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    tema,
    resaltado,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
      if (update.selectionSet || update.docChanged) callbacks.current.onCursor(update.state.selection.main.head);
    }),
  ];

  // Crea la vista de CodeMirror al montar el componente y la destruye al desmontarlo.
  useEffect(() => {
    const view = new EditorView({ parent: contenedor.current!, state: EditorState.create({ extensions: extensiones() }) });
    vista.current = view;
    return () => view.destroy();
  }, []);

  useImperativeHandle(ref, () => ({
    mostrar(id, texto) {
      const view = vista.current;
      if (!view) return;
      // Guarda el estado de la nota que se deja, para volver a ella con su cursor y su historial.
      if (actual.current) estados.current.set(actual.current, view.state);
      view.setState(estados.current.get(id) ?? EditorState.create({ doc: texto, extensions: extensiones() }));
      actual.current = id;
      callbacks.current.onCursor(view.state.selection.main.head);
      view.focus();
    },
    olvidar(id) {
      estados.current.delete(id);
      if (actual.current === id) actual.current = null;
    },
    getText(id) {
      if (id === actual.current) return vista.current?.state.doc.toString() ?? "";
      return estados.current.get(id)?.doc.toString() ?? "";
    },
    irA(pos) {
      const view = vista.current;
      if (!view) return;
      view.dispatch({
        selection: EditorSelection.cursor(pos),
        effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: 48 }),
      });
      view.focus();
    },
    focus: () => vista.current?.focus(),
  }));

  return <div className="editor" ref={contenedor} />;
});
