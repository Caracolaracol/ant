// Modo escritor del editor (Ajustes → Editor). Adapta CodeMirror a escribir prosa, al estilo del
// plugin Smart Typography de Obsidian pero pensado también para el español:
//   · Tipografía al escribir: comillas rectas → tipográficas (“ ” o « » según el idioma),
//     `--` → raya de diálogo `—`, `...` → `…`, `<<` `>>` → `«` `»`, `->` `<-` → `→` `←`.
//     Backspace justo después de un cambio lo deshace (vuelve lo que se tecleó). Nada se cambia
//     dentro de código, HTML, URLs ni del encabezado YAML.
//   · Letra de libro: con serifa, más grande y en una columna más angosta.
//   · Corrector ortográfico del sistema.
// El texto que ya existe nunca se convierte: solo cambia lo que se teclea con el modo activo.
// `Editor.tsx` monta estas extensiones en un `Compartment` para encenderlas y apagarlas en vivo.
// «Compilar y exportar» usa `reemplazoTipografico` para corregir la tipografía de un libro entero.

import { EditorSelection, Prec, StateEffect, StateField, type EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { OpcionesDelModoEscritor } from "../ajustes";
import type { Idioma } from "../idioma";

/** Lo que el editor necesita saber del modo escritor, ya resuelto (por ejemplo, qué comillas usar). */
export interface ConfiguracionModoEscritor {
  /** Comillas dobles de apertura y cierre, o `null` si no se reemplazan. */
  comillasDobles: [string, string] | null;
  /** Comillas simples (y apóstrofo) de apertura y cierre, o `null` si no se reemplazan. */
  comillasSimples: [string, string] | null;
  rayasDeDialogo: boolean;
  puntosSuspensivos: boolean;
  comillasAngulares: boolean;
  flechas: boolean;
  letraDeLibro: boolean;
  correctorOrtografico: boolean;
  /** Idioma de la interfaz, para que el corrector sepa qué idioma esperar. */
  idioma: Idioma;
}

/**
 * Traduce las opciones guardadas en los ajustes a la configuración del editor. Con «auto», las
 * comillas siguen el idioma de la app: latinas « » en español (como recomienda la RAE) y curvas
 * “ ” en inglés.
 */
export function crearConfiguracionModoEscritor(opciones: OpcionesDelModoEscritor, idioma: Idioma): ConfiguracionModoEscritor {
  const estiloDeComillas =
    opciones.estilo_de_comillas === "auto" ? (idioma === "es" ? "latinas" : "curvas") : opciones.estilo_de_comillas;
  return {
    comillasDobles: opciones.comillas_tipograficas ? (estiloDeComillas === "latinas" ? ["«", "»"] : ["“", "”"]) : null,
    comillasSimples: opciones.comillas_tipograficas ? ["‘", "’"] : null,
    rayasDeDialogo: opciones.rayas_de_dialogo,
    puntosSuspensivos: opciones.puntos_suspensivos,
    comillasAngulares: opciones.comillas_angulares,
    flechas: opciones.flechas,
    letraDeLibro: opciones.letra_de_libro,
    correctorOrtografico: opciones.corrector_ortografico,
    idioma,
  };
}

/** Un reemplazo hecho al escribir: el tramo donde quedó y el texto tecleado originalmente. */
interface ReemplazoHecho {
  desde: number;
  hasta: number;
  textoTecleado: string;
}

/** Marca la transacción que hizo un reemplazo, para poder deshacerlo con Backspace. */
const efectoDeReemplazoHecho = StateEffect.define<ReemplazoHecho>();

/**
 * Último reemplazo, mientras siga siendo lo último que pasó. Cualquier otro cambio del texto o
 * movimiento del cursor lo olvida: Backspace solo deshace un reemplazo recién hecho.
 */
const ultimoReemplazoHecho = StateField.define<ReemplazoHecho | null>({
  create: () => null,
  update(reemplazoAnterior, transaccion) {
    for (const efecto of transaccion.effects) if (efecto.is(efectoDeReemplazoHecho)) return efecto.value;
    return transaccion.docChanged || transaccion.selection ? null : reemplazoAnterior;
  },
});

/** Nodo del árbol del Markdown (el tipo viene de @lezer/common, que no es dependencia directa). */
type NodoDelMarkdown = ReturnType<ReturnType<typeof syntaxTree>["resolveInner"]>;

/** Nodos del Markdown donde no se reemplaza nada (código, HTML, comentarios y direcciones). */
const NODOS_QUE_NO_SE_TOCAN = /^(FencedCode|CodeBlock|InlineCode|CodeText|CodeInfo|CodeMark|HTMLBlock|HTMLTag|Comment|CommentBlock|URL|Autolink)$/;

/** Indica si `posicion` está dentro de código, HTML o una URL, según el árbol del Markdown. */
function estaDentroDeCodigo(estado: EditorState, posicion: number): boolean {
  for (let nodo: NodoDelMarkdown | null = syntaxTree(estado).resolveInner(posicion, -1); nodo; nodo = nodo.parent) {
    if (NODOS_QUE_NO_SE_TOCAN.test(nodo.name)) return true;
  }
  return false;
}

/** Indica si `posicion` está dentro del encabezado YAML (entre las dos líneas `---` del principio). */
function estaDentroDelEncabezadoYaml(estado: EditorState, posicion: number): boolean {
  const documento = estado.doc;
  if (documento.line(1).text.trim() !== "---") return false;
  for (let numeroDeLinea = 2; numeroDeLinea <= documento.lines; numeroDeLinea++) {
    const linea = documento.line(numeroDeLinea);
    if (linea.text.trim() === "---") return posicion <= linea.from;
  }
  return false;
}

/** Caracteres después de los cuales unas comillas abren (y no cierran). */
const CARACTERES_DESPUES_DE_LOS_CUALES_SE_ABRE = /[\s([{«“‘—–\-¡¿]$/;

/**
 * Decide si al teclear `caracterTecleado`, con `textoAntesDelCursor` (la línea hasta el cursor),
 * hay que reemplazar algo. Devuelve cuántos caracteres de antes se borran y qué se inserta en su
 * lugar (junto con lo tecleado), o `null` si se escribe tal cual. Se exporta para poder probarla
 * sola y para corregir la tipografía al compilar.
 */
export function reemplazoTipografico(
  textoAntesDelCursor: string,
  caracterTecleado: string,
  configuracion: ConfiguracionModoEscritor,
): { caracteresQueSeBorran: number; textoQueSeInserta: string } | null {
  const caracterAnterior = textoAntesDelCursor.slice(-1);
  const lasComillasAbren = textoAntesDelCursor === "" || CARACTERES_DESPUES_DE_LOS_CUALES_SE_ABRE.test(textoAntesDelCursor);
  const reemplazar = (caracteresQueSeBorran: number, textoQueSeInserta: string) => ({ caracteresQueSeBorran, textoQueSeInserta });

  if (caracterTecleado === '"' && configuracion.comillasDobles) return reemplazar(0, configuracion.comillasDobles[lasComillasAbren ? 0 : 1]);
  // La comilla simple de cierre también es el apóstrofo (it’s, l’amour).
  if (caracterTecleado === "'" && configuracion.comillasSimples) return reemplazar(0, configuracion.comillasSimples[lasComillasAbren ? 0 : 1]);

  if (caracterTecleado === "-") {
    if (configuracion.flechas && caracterAnterior === "<") return reemplazar(1, "←");
    if (configuracion.rayasDeDialogo) {
      // `---` solo en la línea (separador de Markdown o encabezado YAML) queda tal cual.
      if (textoAntesDelCursor.trim() === "—") return reemplazar(1, "---");
      // En las tablas de Markdown (`|---|`) los guiones son parte de la sintaxis.
      if (caracterAnterior === "-" && !textoAntesDelCursor.trimStart().startsWith("|")) return reemplazar(1, "—");
    }
  }

  if (caracterTecleado === "." && configuracion.puntosSuspensivos && textoAntesDelCursor.endsWith("..")) return reemplazar(2, "…");

  if (caracterTecleado === ">") {
    if (configuracion.flechas && caracterAnterior === "-") return reemplazar(1, "→");
    // `>>` al principio de la línea es una cita dentro de otra cita.
    if (configuracion.comillasAngulares && caracterAnterior === ">" && !/^\s*(>\s*)+$/.test(textoAntesDelCursor)) {
      return reemplazar(1, "»");
    }
  }
  if (caracterTecleado === "<" && configuracion.comillasAngulares && caracterAnterior === "<") return reemplazar(1, "«");

  return null;
}

/**
 * Atiende cada carácter tecleado: si corresponde un reemplazo, lo hace en una sola transacción
 * (así Cmd+Z lo deshace de una vez) y lo recuerda para que Backspace pueda revertirlo.
 */
function tipografiaAlEscribir(configuracion: ConfiguracionModoEscritor): Extension {
  return EditorView.inputHandler.of((vista, desdeLaPosicion, hastaLaPosicion, textoTecleado) => {
    if (textoTecleado.length !== 1 || desdeLaPosicion !== hastaLaPosicion || vista.composing) return false;
    const estado = vista.state;
    if (estaDentroDeCodigo(estado, desdeLaPosicion) || estaDentroDelEncabezadoYaml(estado, desdeLaPosicion)) return false;
    const linea = estado.doc.lineAt(desdeLaPosicion);
    const textoAntesDelCursor = estado.sliceDoc(linea.from, desdeLaPosicion);
    const reemplazo = reemplazoTipografico(textoAntesDelCursor, textoTecleado, configuracion);
    if (!reemplazo) return false;
    const inicioDelReemplazo = desdeLaPosicion - reemplazo.caracteresQueSeBorran;
    const finDelReemplazo = inicioDelReemplazo + reemplazo.textoQueSeInserta.length;
    const textoOriginal = textoAntesDelCursor.slice(textoAntesDelCursor.length - reemplazo.caracteresQueSeBorran) + textoTecleado;
    vista.dispatch({
      changes: { from: inicioDelReemplazo, to: hastaLaPosicion, insert: reemplazo.textoQueSeInserta },
      selection: EditorSelection.cursor(finDelReemplazo),
      effects: efectoDeReemplazoHecho.of({ desde: inicioDelReemplazo, hasta: finDelReemplazo, textoTecleado: textoOriginal }),
      userEvent: "input.type",
      scrollIntoView: true,
    });
    return true;
  });
}

/** Backspace justo después de un reemplazo devuelve lo que se tecleó (`«` vuelve a `"`). */
const deshacerReemplazoConBackspace = Prec.highest(
  keymap.of([
    {
      key: "Backspace",
      run(vista) {
        const reemplazo = vista.state.field(ultimoReemplazoHecho, false);
        const seleccion = vista.state.selection.main;
        if (!reemplazo || !seleccion.empty || seleccion.head !== reemplazo.hasta) return false;
        vista.dispatch({
          changes: { from: reemplazo.desde, to: reemplazo.hasta, insert: reemplazo.textoTecleado },
          selection: EditorSelection.cursor(reemplazo.desde + reemplazo.textoTecleado.length),
          userEvent: "delete.backward",
        });
        return true;
      },
    },
  ]),
);

/** Letra de libro: serifa del sistema, más grande y con una columna de lectura más angosta. */
const letraDeLibro = Prec.highest(
  EditorView.theme({
    ".cm-content": {
      fontFamily: 'ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
      fontSize: "1.2em",
      lineHeight: "1.75",
      maxWidth: "34em",
    },
  }),
);

/** Extensiones del modo escritor según su configuración, o ninguna si está apagado (`null`). */
export function extensionesDelModoEscritor(configuracion: ConfiguracionModoEscritor | null): Extension {
  if (!configuracion) return [];
  const extensiones: Extension[] = [ultimoReemplazoHecho, tipografiaAlEscribir(configuracion), deshacerReemplazoConBackspace];
  if (configuracion.letraDeLibro) extensiones.push(letraDeLibro);
  if (configuracion.correctorOrtografico) {
    extensiones.push(
      EditorView.contentAttributes.of({ spellcheck: "true", lang: configuracion.idioma, autocorrect: "off", autocapitalize: "off" }),
    );
  }
  return extensiones;
}
