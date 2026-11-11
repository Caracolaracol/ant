// Componente React que monta CodeMirror 6 y lo expone al resto de la app.
// CodeMirror maneja su propio DOM, así que React solo crea el contenedor y la vista se
// administra con una ref: React no vuelve a dibujar el texto en cada tecla, lo que mantiene
// el editor rápido incluso con notas largas.

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, drawSelection, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { tema, resaltado } from "./tema";

/** Métodos que la app puede llamar sobre el editor desde fuera. */
export interface EditorHandle {
  /** Reemplaza todo el texto (al abrir o crear una nota) y reinicia el historial de deshacer. */
  setText(text: string): void;
  /** Devuelve el texto actual completo (para guardar). */
  getText(): string;
  /** Pone el foco en el editor. */
  focus(): void;
}

interface Props {
  /** Se llama cada vez que el usuario cambia el texto, con el texto nuevo. */
  onChange(text: string): void;
}

/** Arma la lista de extensiones de CodeMirror: historial, atajos, Markdown y tema. */
function extensiones(onChange: (text: string) => void) {
  return [
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
    // Avisa a la app solo cuando el documento cambió de verdad, no al mover el cursor.
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString());
    }),
  ];
}

export const Editor = forwardRef<EditorHandle, Props>(function Editor({ onChange }, ref) {
  const contenedor = useRef<HTMLDivElement>(null);
  const vista = useRef<EditorView | null>(null);
  // Guardamos el último onChange en una ref para que la vista, creada una sola vez, siempre
  // llame a la versión más reciente sin tener que recrearse.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Crea la vista de CodeMirror al montar el componente y la destruye al desmontarlo.
  useEffect(() => {
    const view = new EditorView({
      parent: contenedor.current!,
      state: EditorState.create({ extensions: extensiones((t) => onChangeRef.current(t)) }),
    });
    vista.current = view;
    view.focus();
    return () => view.destroy();
  }, []);

  useImperativeHandle(ref, () => ({
    // Se crea un estado nuevo (no una transacción) para que «deshacer» no vuelva a la nota anterior.
    setText(text) {
      const view = vista.current;
      if (!view) return;
      view.setState(EditorState.create({ doc: text, extensions: extensiones((t) => onChangeRef.current(t)) }));
    },
    getText: () => vista.current?.state.doc.toString() ?? "",
    focus: () => vista.current?.focus(),
  }));

  return <div className="editor" ref={contenedor} />;
});
