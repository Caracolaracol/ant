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

import { EditorSelection, Prec, StateEffect, StateField, type EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { OpcionesEscritor } from "../ajustes";
import type { Idioma } from "../idioma";

/** Lo que el editor necesita saber del modo escritor, ya resuelto (por ejemplo, qué comillas usar). */
export interface ConfigEscritor {
  /** Comillas dobles de apertura y cierre, o `null` si no se reemplazan. */
  comillasDobles: [string, string] | null;
  /** Comillas simples (y apóstrofo) de apertura y cierre, o `null` si no se reemplazan. */
  comillasSimples: [string, string] | null;
  rayas: boolean;
  puntos: boolean;
  angulares: boolean;
  flechas: boolean;
  letraLibro: boolean;
  corrector: boolean;
  /** Idioma de la interfaz, para que el corrector sepa qué idioma esperar. */
  idioma: Idioma;
}

/**
 * Traduce las opciones guardadas en los ajustes a la configuración del editor. Con «auto», las
 * comillas siguen el idioma de la app: latinas « » en español (como recomienda la RAE) y curvas
 * “ ” en inglés.
 */
export function configEscritor(o: OpcionesEscritor, idioma: Idioma): ConfigEscritor {
  const estilo = o.estilo_comillas === "auto" ? (idioma === "es" ? "latinas" : "curvas") : o.estilo_comillas;
  return {
    comillasDobles: o.comillas ? (estilo === "latinas" ? ["«", "»"] : ["“", "”"]) : null,
    comillasSimples: o.comillas ? ["‘", "’"] : null,
    rayas: o.rayas,
    puntos: o.puntos,
    angulares: o.angulares,
    flechas: o.flechas,
    letraLibro: o.letra_libro,
    corrector: o.corrector,
    idioma,
  };
}

/** Un reemplazo hecho al escribir: el rango donde quedó y el texto tecleado originalmente. */
interface Reemplazo {
  desde: number;
  hasta: number;
  original: string;
}

/** Marca la transacción que hizo un reemplazo, para poder deshacerlo con Backspace. */
const marcarReemplazo = StateEffect.define<Reemplazo>();

/**
 * Último reemplazo, mientras siga siendo lo último que pasó. Cualquier otro cambio del texto o
 * movimiento del cursor lo olvida: Backspace solo deshace un reemplazo recién hecho.
 */
const ultimoReemplazo = StateField.define<Reemplazo | null>({
  create: () => null,
  update(valor, tr) {
    for (const e of tr.effects) if (e.is(marcarReemplazo)) return e.value;
    return tr.docChanged || tr.selection ? null : valor;
  },
});

/** Nodo del árbol del Markdown (el tipo viene de @lezer/common, que no es dependencia directa). */
type SyntaxNode = ReturnType<ReturnType<typeof syntaxTree>["resolveInner"]>;

/** Nodos del Markdown donde no se reemplaza nada (código, HTML, comentarios y direcciones). */
const NODOS_INTACTOS = /^(FencedCode|CodeBlock|InlineCode|CodeText|CodeInfo|CodeMark|HTMLBlock|HTMLTag|Comment|CommentBlock|URL|Autolink)$/;

/** Indica si `pos` está dentro de código, HTML o una URL, según el árbol del Markdown. */
function enCodigo(state: EditorState, pos: number): boolean {
  for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1); n; n = n.parent) {
    if (NODOS_INTACTOS.test(n.name)) return true;
  }
  return false;
}

/** Indica si `pos` está dentro del encabezado YAML (entre las dos líneas `---` del principio). */
function enEncabezado(state: EditorState, pos: number): boolean {
  const doc = state.doc;
  if (doc.line(1).text.trim() !== "---") return false;
  for (let i = 2; i <= doc.lines; i++) {
    const linea = doc.line(i);
    if (linea.text.trim() === "---") return pos <= linea.from;
  }
  return false;
}

/** Caracteres después de los cuales unas comillas abren (y no cierran). */
const ANTES_DE_ABRIR = /[\s([{«“‘—–\-¡¿]$/;

/**
 * Decide si al teclear `c`, con `antes` (el texto de la línea hasta el cursor), hay que
 * reemplazar algo. Devuelve cuántos caracteres de `antes` se borran y qué se inserta en su lugar
 * (junto con `c`), o `null` si `c` se escribe tal cual. Se exporta para poder probarla sola.
 */
export function reemplazo(antes: string, c: string, cfg: ConfigEscritor): { borrar: number; insertar: string } | null {
  const previo = antes.slice(-1);
  const abre = antes === "" || ANTES_DE_ABRIR.test(antes);

  if (c === '"' && cfg.comillasDobles) return { borrar: 0, insertar: cfg.comillasDobles[abre ? 0 : 1] };
  // La comilla simple de cierre también es el apóstrofo (it’s, l’amour).
  if (c === "'" && cfg.comillasSimples) return { borrar: 0, insertar: cfg.comillasSimples[abre ? 0 : 1] };

  if (c === "-") {
    if (cfg.flechas && previo === "<") return { borrar: 1, insertar: "←" };
    if (cfg.rayas) {
      // `---` solo en la línea (separador de Markdown o encabezado YAML) queda tal cual.
      if (antes.trim() === "—") return { borrar: 1, insertar: "---" };
      // En las tablas de Markdown (`|---|`) los guiones son parte de la sintaxis.
      if (previo === "-" && !antes.trimStart().startsWith("|")) return { borrar: 1, insertar: "—" };
    }
  }

  if (c === "." && cfg.puntos && antes.endsWith("..")) return { borrar: 2, insertar: "…" };

  if (c === ">") {
    if (cfg.flechas && previo === "-") return { borrar: 1, insertar: "→" };
    // `>>` al principio de la línea es una cita dentro de otra cita.
    if (cfg.angulares && previo === ">" && !/^\s*(>\s*)+$/.test(antes)) return { borrar: 1, insertar: "»" };
  }
  if (c === "<" && cfg.angulares && previo === "<") return { borrar: 1, insertar: "«" };

  return null;
}

/**
 * Atiende cada carácter tecleado: si corresponde un reemplazo, lo hace en una sola transacción
 * (así Cmd+Z lo deshace de una vez) y lo recuerda para que Backspace pueda revertirlo.
 */
function tipografia(cfg: ConfigEscritor): Extension {
  return EditorView.inputHandler.of((view, from, to, texto) => {
    if (texto.length !== 1 || from !== to || view.composing) return false;
    const state = view.state;
    if (enCodigo(state, from) || enEncabezado(state, from)) return false;
    const linea = state.doc.lineAt(from);
    const antes = state.sliceDoc(linea.from, from);
    const r = reemplazo(antes, texto, cfg);
    if (!r) return false;
    const desde = from - r.borrar;
    const original = antes.slice(antes.length - r.borrar) + texto;
    view.dispatch({
      changes: { from: desde, to, insert: r.insertar },
      selection: EditorSelection.cursor(desde + r.insertar.length),
      effects: marcarReemplazo.of({ desde, hasta: desde + r.insertar.length, original }),
      userEvent: "input.type",
      scrollIntoView: true,
    });
    return true;
  });
}

/** Backspace justo después de un reemplazo devuelve lo que se tecleó (`«` vuelve a `"`). */
const deshacerConBackspace = Prec.highest(
  keymap.of([
    {
      key: "Backspace",
      run(view) {
        const r = view.state.field(ultimoReemplazo, false);
        const sel = view.state.selection.main;
        if (!r || !sel.empty || sel.head !== r.hasta) return false;
        view.dispatch({
          changes: { from: r.desde, to: r.hasta, insert: r.original },
          selection: EditorSelection.cursor(r.desde + r.original.length),
          userEvent: "delete.backward",
        });
        return true;
      },
    },
  ]),
);

/** Letra de libro: serifa del sistema, más grande y con una columna de lectura más angosta. */
const letraLibro = Prec.highest(
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
export function extensionesEscritor(cfg: ConfigEscritor | null): Extension {
  if (!cfg) return [];
  const ext: Extension[] = [ultimoReemplazo, tipografia(cfg), deshacerConBackspace];
  if (cfg.letraLibro) ext.push(letraLibro);
  if (cfg.corrector) {
    ext.push(EditorView.contentAttributes.of({ spellcheck: "true", lang: cfg.idioma, autocorrect: "off", autocapitalize: "off" }));
  }
  return ext;
}
