// Ayudas para código del editor (Ajustes → Editor, por cámara; el preset «Programador» las activa
// todas, pero cada una se activa por separado y se pueden sumar a las del escritor):
//   · Bloques de código cómodos: al escribir ``` (o ~~~, con o sin lenguaje: ```js) y pulsar
//     Enter, se cierra el bloque solo y el cursor queda adentro. Si el bloque ya estaba cerrado,
//     Enter es un Enter normal.
//   · Los bloques de código se ven con un fondo, para distinguirlos del texto (solo las líneas a
//     la vista: no crece con el largo de la nota).
//   · Paréntesis, corchetes y llaves se cierran solos (y las comillas, salvo que estén activas las
//     tipográficas del escritor, que ya las manejan al escribir prosa).
//   · Se marca el par del paréntesis que está junto al cursor.
// `Editor.tsx` lo monta en el mismo `Compartment` que las ayudas del escritor.

import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { bracketMatching, syntaxTree } from "@codemirror/language";
import { EditorSelection, EditorState, Prec, RangeSetBuilder, type Extension } from "@codemirror/state";
import type { OpcionesDelEditor } from "../ajustes";
import { Decoration, EditorView, ViewPlugin, keymap, type DecorationSet, type ViewUpdate } from "@codemirror/view";

/** Línea que abre (o cierra) un bloque de código: sangría, ``` o ~~~, y el lenguaje si lo hay. */
const FORMA_DE_LA_VALLA = /^(\s*)(`{3,}|~{3,})([\w+#.-]*)\s*$/;

/**
 * Si la valla de la línea `numeroDeLinea` abre un bloque que todavía no se cerró: el árbol de
 * sintaxis ve un bloque (`FencedCode`) que empieza en esa línea y no termina en otra valla igual.
 */
export function abreUnBloqueSinCerrar(estado: EditorState, numeroDeLinea: number, valla: string): boolean {
  const linea = estado.doc.line(numeroDeLinea);
  let nodo: ReturnType<ReturnType<typeof syntaxTree>["resolveInner"]> | null = syntaxTree(estado).resolveInner(linea.to, -1);
  while (nodo && nodo.name !== "FencedCode") nodo = nodo.parent;
  if (!nodo || estado.doc.lineAt(nodo.from).number !== numeroDeLinea) return false;
  const ultimaLinea = estado.doc.lineAt(nodo.to);
  const estaCerrado = ultimaLinea.number > numeroDeLinea && ultimaLinea.text.trim().startsWith(valla[0].repeat(valla.length));
  return !estaCerrado;
}

/** Enter al final de una valla que abre un bloque: agrega una línea vacía y la valla que lo cierra. */
function cerrarElBloqueDeCodigo(vista: EditorView): boolean {
  const { state: estado } = vista;
  const cursor = estado.selection.main;
  if (!cursor.empty) return false;
  const linea = estado.doc.lineAt(cursor.head);
  const partes = FORMA_DE_LA_VALLA.exec(linea.text);
  if (!partes || cursor.head !== linea.to) return false;
  const [, sangria, valla] = partes;
  if (!abreUnBloqueSinCerrar(estado, linea.number, valla)) return false;
  const textoQueSeAgrega = `\n${sangria}\n${sangria}${valla}`;
  vista.dispatch({
    changes: { from: linea.to, insert: textoQueSeAgrega },
    selection: EditorSelection.cursor(linea.to + 1 + sangria.length),
    scrollIntoView: true,
    userEvent: "input",
  });
  return true;
}

/** Fondo de las líneas de los bloques de código. */
const lineaDeCodigo = Decoration.line({ class: "cm-linea-de-codigo" });

/** Decoraciones de fondo para las líneas de bloques de código a la vista. */
function decoracionesDeLosBloques(vista: EditorView): DecorationSet {
  const constructor = new RangeSetBuilder<Decoration>();
  let ultimaLineaMarcada = 0;
  for (const { from: desde, to: hasta } of vista.visibleRanges) {
    syntaxTree(vista.state).iterate({
      from: desde,
      to: hasta,
      enter(nodo) {
        if (nodo.name !== "FencedCode") return;
        const primeraLinea = vista.state.doc.lineAt(Math.max(nodo.from, desde)).number;
        const ultimaLinea = vista.state.doc.lineAt(Math.min(nodo.to, hasta)).number;
        for (let numeroDeLinea = Math.max(primeraLinea, ultimaLineaMarcada + 1); numeroDeLinea <= ultimaLinea; numeroDeLinea++) {
          constructor.add(vista.state.doc.line(numeroDeLinea).from, vista.state.doc.line(numeroDeLinea).from, lineaDeCodigo);
          ultimaLineaMarcada = numeroDeLinea;
        }
        return false;
      },
    });
  }
  return constructor.finish();
}

/** Bloques de código con fondo: se recalculan al escribir o al desplazarse. */
const bloquesDeCodigoConFondo = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(vista: EditorView) {
      this.decorations = decoracionesDeLosBloques(vista);
    }
    update(actualizacion: ViewUpdate) {
      const cambioElArbol = syntaxTree(actualizacion.startState) !== syntaxTree(actualizacion.state);
      if (actualizacion.docChanged || actualizacion.viewportChanged || cambioElArbol) this.decorations = decoracionesDeLosBloques(actualizacion.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

/** Extensiones de las ayudas para código que estén activas en las opciones. */
export function extensionesDelModoProgramador(opciones: OpcionesDelEditor): Extension {
  const extensiones: Extension[] = [];
  if (opciones.cerrar_bloques_de_codigo) extensiones.push(Prec.high(keymap.of([{ key: "Enter", run: cerrarElBloqueDeCodigo }])));
  if (opciones.cerrar_parentesis) {
    // Con las comillas tipográficas activas, las comillas no se cierran solas (las convierte la tipografía).
    const queSeCierra = opciones.comillas_tipograficas ? ["(", "[", "{"] : ["(", "[", "{", "'", '"'];
    extensiones.push(closeBrackets(), keymap.of(closeBracketsKeymap), EditorState.languageData.of(() => [{ closeBrackets: { brackets: queSeCierra } }]));
  }
  if (opciones.marcar_el_par) extensiones.push(bracketMatching());
  if (opciones.fondo_en_bloques_de_codigo) extensiones.push(bloquesDeCodigoConFondo);
  return extensiones;
}
