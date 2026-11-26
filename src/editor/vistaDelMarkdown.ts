// Vista del Markdown en el editor (Ajustes → Editor, por cámara, cada parte con su casilla): el
// texto se ve como queda y no con sus marcas. Las marcas de una línea aparecen en cuanto el cursor
// (o la selección) está en ella, para poder editarlas; en las demás no se ven:
//   · Títulos sin `#`.
//   · Negrita, itálica y tachado sin `**`, `*`, `_` ni `~~`.
//   · Código en línea sin las comillas invertidas, con un fondo.
//   · Enlaces que muestran solo su texto (sin `[`, `](dirección)`).
//   · Citas con una línea a la izquierda en vez del `>`.
//   · Viñetas `•` en vez de `-`, `*` o `+` en las listas.
//   · Casillas en las tareas (`- [ ]`, `- [x]`) que se marcan con un clic (eso sí cambia el texto).
//   · `---` como una línea a lo ancho.
// Todo sale del árbol de sintaxis del Markdown (así nada de esto pasa dentro de un bloque de
// código) y solo se revisan las líneas a la vista: no crece con el largo de la nota.

import type { Extension, Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { OpcionesDelEditor } from "../ajustes";

/** Las partes de la vista del Markdown que están activas. */
type OpcionesDeLaVista = Pick<
  OpcionesDelEditor,
  | "titulos_sin_almohadillas"
  | "enfasis_sin_marcas"
  | "codigo_en_linea_sin_marcas"
  | "enlaces_solo_texto"
  | "citas_con_linea"
  | "vinetas_en_listas"
  | "casillas_en_tareas"
  | "separadores_como_linea"
>;

/** Esconde un tramo de texto (una marca). */
const marcaEscondida = Decoration.replace({});
/** Fondo del código en línea. */
const codigoEnLinea = Decoration.mark({ class: "cm-codigo-en-linea" });
/** Línea a la izquierda de cada línea de una cita. */
const lineaDeCita = Decoration.line({ class: "cm-linea-de-cita" });

/** Viñeta `•` en lugar de la marca de una lista. */
class Vineta extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const vineta = document.createElement("span");
    vineta.className = "cm-vineta";
    vineta.textContent = "•";
    return vineta;
  }
}

/** Línea a lo ancho en lugar de `---`. */
class Separador extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const separador = document.createElement("span");
    separador.className = "cm-separador";
    return separador;
  }
}

/** Casilla de una tarea; un clic la marca o desmarca, cambiando `[ ]` ↔ `[x]` en el texto. */
class CasillaDeTarea extends WidgetType {
  constructor(readonly estaHecha: boolean, readonly posicionDeLaMarca: number) {
    super();
  }
  eq(otra: CasillaDeTarea) {
    return otra.estaHecha === this.estaHecha && otra.posicionDeLaMarca === this.posicionDeLaMarca;
  }
  toDOM(vista: EditorView) {
    const casilla = document.createElement("input");
    casilla.type = "checkbox";
    casilla.className = "cm-casilla-de-tarea";
    casilla.checked = this.estaHecha;
    // En el mousedown (antes de que el editor mueva el cursor a esa línea y muestre las marcas).
    casilla.addEventListener("mousedown", (evento) => {
      evento.preventDefault();
      vista.dispatch({ changes: { from: this.posicionDeLaMarca + 1, to: this.posicionDeLaMarca + 2, insert: this.estaHecha ? " " : "x" } });
    });
    return casilla;
  }
  ignoreEvent() {
    return true;
  }
}

/** Decoraciones de la vista del Markdown para las líneas a la vista (salvo las del cursor). */
function decoracionesDeLaVista(vista: EditorView, opciones: OpcionesDeLaVista): DecorationSet {
  const { state: estado } = vista;
  const documento = estado.doc;
  const lineasConElCursor = new Set<number>();
  for (const rango of estado.selection.ranges) {
    for (let numeroDeLinea = documento.lineAt(rango.from).number; numeroDeLinea <= documento.lineAt(rango.to).number; numeroDeLinea++) {
      lineasConElCursor.add(numeroDeLinea);
    }
  }
  /** Si el tramo está en una línea donde está el cursor (ahí se ven las marcas). */
  const tocaElCursor = (desde: number, hasta: number) => {
    for (let numeroDeLinea = documento.lineAt(desde).number; numeroDeLinea <= documento.lineAt(hasta).number; numeroDeLinea++) {
      if (lineasConElCursor.has(numeroDeLinea)) return true;
    }
    return false;
  };
  /** Cuántos espacios siguen a `posicion` en su línea (para esconder la marca con su espacio). */
  const finDeLosEspacios = (posicion: number) => {
    const finDeLaLinea = documento.lineAt(posicion).to;
    let fin = posicion;
    while (fin < finDeLaLinea && documento.sliceString(fin, fin + 1) === " ") fin++;
    return fin;
  };

  const decoraciones: Range<Decoration>[] = [];
  for (const { from: desde, to: hasta } of vista.visibleRanges) {
    syntaxTree(estado).iterate({
      from: desde,
      to: hasta,
      enter(nodo) {
        const padre = nodo.node.parent?.name;
        switch (nodo.name) {
          case "HeaderMark": {
            // Solo los `#` del principio (no los de cierre ni el subrayado `===`).
            if (!opciones.titulos_sin_almohadillas || tocaElCursor(nodo.from, nodo.to)) return;
            const linea = documento.lineAt(nodo.from);
            const esAlPrincipio = documento.sliceString(linea.from, nodo.from).trim() === "";
            if (esAlPrincipio && /^#+$/.test(documento.sliceString(nodo.from, nodo.to))) {
              decoraciones.push(marcaEscondida.range(nodo.from, finDeLosEspacios(nodo.to)));
            }
            return;
          }
          case "EmphasisMark":
          case "StrikethroughMark":
            if (opciones.enfasis_sin_marcas && !tocaElCursor(nodo.from, nodo.to)) decoraciones.push(marcaEscondida.range(nodo.from, nodo.to));
            return;
          case "InlineCode": {
            if (!opciones.codigo_en_linea_sin_marcas || tocaElCursor(nodo.from, nodo.to)) return;
            const marcas = nodo.node.getChildren("CodeMark");
            if (marcas.length < 2) return;
            const [apertura, cierre] = [marcas[0], marcas[marcas.length - 1]];
            decoraciones.push(marcaEscondida.range(apertura.from, apertura.to));
            if (apertura.to < cierre.from) decoraciones.push(codigoEnLinea.range(apertura.to, cierre.from));
            decoraciones.push(marcaEscondida.range(cierre.from, cierre.to));
            return false;
          }
          case "Link": {
            // `[texto](dirección)`: queda solo el texto. Los `[[…]]` y las imágenes no son `Link`.
            if (!opciones.enlaces_solo_texto || tocaElCursor(nodo.from, nodo.to)) return;
            const marcas = nodo.node.getChildren("LinkMark");
            if (marcas.length < 2 || documento.sliceString(marcas[0].from, marcas[0].to) !== "[") return;
            const cierreDelTexto = marcas.find((marca) => documento.sliceString(marca.from, marca.to) === "]");
            // Solo enlaces con dirección: `[texto]` solo (o `[[nota]]` de Obsidian) queda como está.
            const tieneDireccion = marcas.some((marca) => documento.sliceString(marca.from, marca.to) === "(");
            if (!cierreDelTexto || !tieneDireccion) return;
            decoraciones.push(marcaEscondida.range(marcas[0].from, marcas[0].to));
            if (cierreDelTexto.from < nodo.to) decoraciones.push(marcaEscondida.range(cierreDelTexto.from, nodo.to));
            return false;
          }
          case "Blockquote": {
            if (!opciones.citas_con_linea) return;
            for (let numeroDeLinea = documento.lineAt(nodo.from).number; numeroDeLinea <= documento.lineAt(nodo.to).number; numeroDeLinea++) {
              decoraciones.push(lineaDeCita.range(documento.line(numeroDeLinea).from));
            }
            return;
          }
          case "QuoteMark":
            if (opciones.citas_con_linea && !tocaElCursor(nodo.from, nodo.to)) decoraciones.push(marcaEscondida.range(nodo.from, finDeLosEspacios(nodo.to)));
            return;
          case "ListMark": {
            // Solo en listas con viñetas (las numeradas conservan su número), y no en las tareas
            // (ahí va la casilla).
            const item = nodo.node.parent;
            const esDeTarea = Boolean(item?.getChild("Task"));
            if (!opciones.vinetas_en_listas || esDeTarea || item?.parent?.name !== "BulletList" || tocaElCursor(nodo.from, nodo.to)) return;
            decoraciones.push(Decoration.replace({ widget: new Vineta() }).range(nodo.from, nodo.to));
            return;
          }
          case "TaskMarker": {
            if (!opciones.casillas_en_tareas || padre !== "Task" || tocaElCursor(nodo.from, nodo.to)) return;
            const estaHecha = /x/i.test(documento.sliceString(nodo.from, nodo.to));
            // La casilla reemplaza también el `-` de la lista que la precede.
            const marcaDeLaLista = nodo.node.parent?.parent?.getChild("ListMark");
            const desdeDondeSeReemplaza = marcaDeLaLista && marcaDeLaLista.to <= nodo.from ? marcaDeLaLista.from : nodo.from;
            decoraciones.push(Decoration.replace({ widget: new CasillaDeTarea(estaHecha, nodo.from) }).range(desdeDondeSeReemplaza, nodo.to));
            return;
          }
          case "HorizontalRule":
            if (opciones.separadores_como_linea && !tocaElCursor(nodo.from, nodo.to)) {
              decoraciones.push(Decoration.replace({ widget: new Separador() }).range(nodo.from, nodo.to));
            }
            return;
        }
      },
    });
  }
  return Decoration.set(decoraciones, true);
}

/** Las opciones de la vista del Markdown (para saber si hay alguna activa). */
const PARTES_DE_LA_VISTA: (keyof OpcionesDeLaVista)[] = [
  "titulos_sin_almohadillas",
  "enfasis_sin_marcas",
  "codigo_en_linea_sin_marcas",
  "enlaces_solo_texto",
  "citas_con_linea",
  "vinetas_en_listas",
  "casillas_en_tareas",
  "separadores_como_linea",
];

/** Extensión de la vista del Markdown con las partes activas (ninguna: no agrega nada). */
export function extensionesDeLaVistaDelMarkdown(opciones: OpcionesDeLaVista): Extension {
  const hayAlgoActivo = PARTES_DE_LA_VISTA.some((parte) => opciones[parte]);
  if (!hayAlgoActivo) return [];
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(vista: EditorView) {
        this.decorations = decoracionesDeLaVista(vista, opciones);
      }
      update(actualizacion: ViewUpdate) {
        const cambioElArbol = syntaxTree(actualizacion.startState) !== syntaxTree(actualizacion.state);
        if (actualizacion.docChanged || actualizacion.viewportChanged || actualizacion.selectionSet || cambioElArbol) {
          this.decorations = decoracionesDeLaVista(actualizacion.view, opciones);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
