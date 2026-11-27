// Componente React que monta CodeMirror 6 y lo expone al resto de la app.
// CodeMirror maneja su propio DOM, así que React solo crea el contenedor y la vista se
// administra con una ref: React no vuelve a dibujar el texto en cada tecla, lo que mantiene
// el editor rápido incluso con notas largas.
//
// Hay una sola vista para todas las notas: cada nota guarda su propio EditorState (texto, cursor
// e historial de deshacer) y al cambiar de nota se intercambia el estado. Los estados se guardan
// en memoria aunque la nota se cierre (hasta `LIMITE_DE_NOTAS_RECORDADAS`), así al volver a
// abrirla siguen ahí el cursor y el deshacer. Si el archivo cambió fuera de Ant, el texto se pone
// al día sin perder el historial (`reemplazarTextoDesdeDisco`).
// En cada tecla solo se avisa *que* cambió el texto (`alCambiarTexto`), sin copiarlo: con una
// novela entera en una nota, copiar todo el texto en cada tecla haría lento escribir. Quien
// necesita el texto lo pide con `obtenerTextoDeNota`.
// Las opciones del editor de la cámara (ayudas del escritor, `escritor.ts`, y del programador,
// `programador.ts`, que se pueden sumar) van en un `Compartment`: se cambian en vivo, y cada nota
// guardada se pone al día al volver a mostrarse.
// Las imágenes de la nota se ven debajo de su línea (`imagenes.ts`); para resolver sus rutas el
// editor sabe dónde está la nota visible (`rutaDeLaNotaVisible`). Las imágenes pegadas se pasan a
// la app (`alPegarImagenes`), que las guarda; las arrastradas llegan por Tauri a la app, que las
// inserta con `insertarEnLineaPropia`.

import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from "react";
import { Annotation, Compartment, EditorSelection, EditorState, Transaction } from "@codemirror/state";
import { EditorView, keymap, drawSelection, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { temaDelEditor, resaltadoDelMarkdown } from "./tema";
import { ConfiguracionModoEscritor, extensionesDelModoEscritor } from "./escritor";
import { extensionesDelModoProgramador } from "./programador";
import type { OpcionesDelEditor } from "../ajustes";
import { cambiarLugarDeLaNota, imagenesALaVista, lugarDeLaNotaEnElEditor, LugarDeLaNota } from "./imagenes";
import { extensionesDeLaVistaDelMarkdown } from "./vistaDelMarkdown";

/** Opciones del editor de la cámara, ya resueltas para montarlas (las del escritor, con sus comillas según el idioma). */
export interface ConfiguracionDelEditorResuelta {
  opciones: OpcionesDelEditor;
  escritor: ConfiguracionModoEscritor;
}

/**
 * Extensiones de CodeMirror de las opciones del editor: las del escritor, la vista del Markdown,
 * las imágenes y las del programador que estén activas.
 */
const extensionesDelModo = (configuracion: ConfiguracionDelEditorResuelta) => [
  extensionesDelModoEscritor(configuracion.escritor),
  extensionesDeLaVistaDelMarkdown(configuracion.opciones),
  configuracion.opciones.mostrar_imagenes ? imagenesALaVista : [],
  extensionesDelModoProgramador(configuracion.opciones),
];

/** Cuántas notas recuerda el editor (cursor e historial) después de cerrarlas. */
const LIMITE_DE_NOTAS_RECORDADAS = 30;

/**
 * Marca los cambios que vienen del disco (el archivo cambió fuera de Ant): no avisan a la app
 * como si el usuario hubiera escrito, así no se vuelven a guardar.
 */
const cambioQueVieneDelDisco = Annotation.define<boolean>();

/** Métodos que la app puede llamar sobre el editor desde fuera. */
export interface ControlDelEditor {
  /**
   * Muestra la nota `idNota`. Si el editor ya la recordaba, vuelve con su cursor y su historial;
   * si no, la crea con `textoInicial`. (Para poner al día una nota recordada con lo que hay en su
   * archivo, `reemplazarTextoDesdeDisco`.)
   */
  mostrarNota(idNota: string, textoInicial: string): void;
  /** Indica si el editor recuerda el estado de una nota (aunque esté cerrada). */
  recuerdaLaNota(idNota: string): boolean;
  /** Olvida para siempre el estado de una nota (una nota en blanco que se descarta). */
  olvidarNota(idNota: string): void;
  /**
   * Olvida el estado (texto, historial) de todas las notas de archivos dentro de `carpeta`, también
   * la visible: al bloquear una cámara cifrada, su texto no queda en memoria.
   */
  olvidarNotasDentroDe(carpeta: string): void;
  /** Devuelve el texto de una nota (la visible o una recordada en segundo plano). */
  obtenerTextoDeNota(idNota: string): string | undefined;
  /** Pone al día el texto de una nota con lo que hay en su archivo, sin perder cursor ni historial. */
  reemplazarTextoDesdeDisco(idNota: string, textoDelDisco: string): void;
  /** Mueve el cursor a `posicion` en la nota visible y la muestra arriba de la pantalla. */
  llevarCursorA(posicion: number): void;
  /** Pone el foco en el editor. */
  enfocar(): void;
  /**
   * Agrega `texto` (por ejemplo, el enlace de una imagen) en una línea propia, debajo de la línea
   * del cursor o de la que está en `coordenadasEnLaVentana` (donde se soltó algo arrastrado).
   */
  insertarEnLineaPropia(texto: string, coordenadasEnLaVentana?: { x: number; y: number }): void;
}

interface Props {
  /** Se llama cada vez que el usuario cambia el texto de la nota visible (sin el texto, ver arriba). */
  alCambiarTexto(): void;
  /** Se llama cuando el cursor se mueve, con su posición (para marcar el título actual). */
  alMoverCursor(posicion: number): void;
  /** Opciones del editor de la cámara abierta (escritor y programador, sumables). */
  configuracionDelEditor: ConfiguracionDelEditorResuelta;
  /** Ancho local del texto: `null` lo deja a la tipografía y `0` usa todo el espacio. */
  anchoDelTexto: number | null;
  /** Archivo de la nota visible (o `null`) y el hormiguero, para encontrar sus imágenes. */
  rutaDeLaNotaVisible: string | null;
  carpetaDelHormiguero: string | null;
  /** Se llama al pegar imágenes (por ejemplo, una captura de pantalla), con sus archivos. */
  alPegarImagenes(archivos: File[]): void;
  /** Sin ninguna nota abierta, el editor se esconde (la vista sigue creada, lista para la próxima). */
  estaOculto: boolean;
}

/**
 * Cambio mínimo para pasar de `textoAnterior` a `textoNuevo`: solo el tramo del medio que es
 * distinto (lo que coincide al principio y al final se deja), así el cursor y el historial que
 * están fuera de ese tramo no se mueven.
 */
function cambioMinimoEntreTextos(textoAnterior: string, textoNuevo: string) {
  let inicioComun = 0;
  const largoMinimo = Math.min(textoAnterior.length, textoNuevo.length);
  while (inicioComun < largoMinimo && textoAnterior[inicioComun] === textoNuevo[inicioComun]) inicioComun++;
  let finComun = 0;
  while (
    finComun < largoMinimo - inicioComun &&
    textoAnterior[textoAnterior.length - 1 - finComun] === textoNuevo[textoNuevo.length - 1 - finComun]
  ) finComun++;
  return {
    from: inicioComun,
    to: textoAnterior.length - finComun,
    insert: textoNuevo.slice(inicioComun, textoNuevo.length - finComun),
  };
}

/** Transacción que pone `textoNuevo` en un estado, marcada como cambio del disco y fuera del historial de deshacer. */
const transaccionDesdeDisco = (estado: EditorState, textoNuevo: string) => ({
  changes: cambioMinimoEntreTextos(estado.doc.toString(), textoNuevo),
  annotations: [cambioQueVieneDelDisco.of(true), Transaction.addToHistory.of(false)],
});

export const Editor = forwardRef<ControlDelEditor, Props>(function Editor(
  { alCambiarTexto, alMoverCursor, configuracionDelEditor, anchoDelTexto, rutaDeLaNotaVisible, carpetaDelHormiguero, alPegarImagenes, estaOculto },
  referenciaDelControl,
) {
  const contenedorDelEditor = useRef<HTMLDivElement>(null);
  const vistaDelEditor = useRef<EditorView | null>(null);
  // Nota visible y estados recordados de las demás (el orden del Map es el de uso: la última
  // usada va al final, así se olvidan primero las más viejas).
  const idNotaVisible = useRef<string | null>(null);
  const estadosRecordadosPorNota = useRef(new Map<string, EditorState>());
  // Últimos callbacks en refs: la vista se crea una sola vez y siempre llama a la versión vigente.
  const callbacksVigentes = useRef({ alCambiarTexto, alMoverCursor, alPegarImagenes });
  callbacksVigentes.current = { alCambiarTexto, alMoverCursor, alPegarImagenes };
  // Dónde está la nota visible, para pasárselo a cada nota que se muestra.
  const lugarDeLaNotaVigente = useRef<LugarDeLaNota>({ rutaDeLaNota: rutaDeLaNotaVisible, carpetaDelHormiguero });
  lugarDeLaNotaVigente.current = { rutaDeLaNota: rutaDeLaNotaVisible, carpetaDelHormiguero };
  // Modo del editor: su compartimento (uno por editor) y la configuración vigente, comparada como
  // texto para no reconfigurar si los ajustes cambiaron en otra cosa (fijados, ancho…).
  const compartimentoDelModo = useRef(new Compartment()).current;
  const configuracionDelEditorVigente = useRef(configuracionDelEditor);
  const configuracionDelEditorComoTexto = JSON.stringify(configuracionDelEditor);

  /** Extensiones de CodeMirror: historial, atajos, Markdown, tema y avisos a la app. */
  const crearExtensiones = () => [
    history(),
    drawSelection(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    EditorView.lineWrapping,
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    // `codeLanguages` resalta los bloques de código según su lenguaje (se cargan bajo demanda).
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    temaDelEditor,
    resaltadoDelMarkdown,
    compartimentoDelModo.of(extensionesDelModo(configuracionDelEditorVigente.current)),
    lugarDeLaNotaEnElEditor,
    // Pegar imágenes (una captura, una imagen copiada): la app las guarda junto a la nota y agrega su enlace.
    EditorView.domEventHandlers({
      paste(evento) {
        const imagenesPegadas = [...(evento.clipboardData?.files ?? [])].filter((archivo) => archivo.type.startsWith("image/"));
        if (!imagenesPegadas.length) return false;
        evento.preventDefault();
        callbacksVigentes.current.alPegarImagenes(imagenesPegadas);
        return true;
      },
    }),
    EditorView.updateListener.of((actualizacion) => {
      const vieneDelDisco = actualizacion.transactions.some((transaccion) => transaccion.annotation(cambioQueVieneDelDisco));
      if (actualizacion.docChanged && !vieneDelDisco) callbacksVigentes.current.alCambiarTexto();
      if (actualizacion.selectionSet || actualizacion.docChanged) callbacksVigentes.current.alMoverCursor(actualizacion.state.selection.main.head);
    }),
  ];

  /** Recuerda el estado de una nota, como la más reciente, y olvida las más viejas si sobran. */
  function recordarEstado(idNota: string, estado: EditorState) {
    const estados = estadosRecordadosPorNota.current;
    estados.delete(idNota);
    estados.set(idNota, estado);
    for (const idMasViejo of estados.keys()) {
      if (estados.size <= LIMITE_DE_NOTAS_RECORDADAS) break;
      if (idMasViejo !== idNotaVisible.current) estados.delete(idMasViejo);
    }
  }

  // Crea la vista de CodeMirror al montar el componente y la destruye al desmontarlo.
  useEffect(() => {
    const vista = new EditorView({ parent: contenedorDelEditor.current!, state: EditorState.create({ extensions: crearExtensiones() }) });
    vistaDelEditor.current = vista;
    return () => vista.destroy();
  }, []);

  // Al cambiar dónde está la nota visible (otra nota, «Guardar como» u otro hormiguero), sus imágenes
  // se vuelven a buscar desde ahí.
  useEffect(() => {
    vistaDelEditor.current?.dispatch({ effects: cambiarLugarDeLaNota.of(lugarDeLaNotaVigente.current) });
  }, [rutaDeLaNotaVisible, carpetaDelHormiguero]);

  // Al cambiar el modo en Ajustes (o al pasar a una cámara con otro), la nota visible lo aplica al instante.
  useEffect(() => {
    configuracionDelEditorVigente.current = configuracionDelEditor;
    vistaDelEditor.current?.dispatch({ effects: compartimentoDelModo.reconfigure(extensionesDelModo(configuracionDelEditor)) });
  }, [configuracionDelEditorComoTexto]);

  useImperativeHandle(referenciaDelControl, () => ({
    mostrarNota(idNota, textoInicial) {
      const vista = vistaDelEditor.current;
      if (!vista) return;
      // Recuerda el estado de la nota que se deja, para volver a ella con su cursor y su historial.
      if (idNotaVisible.current) recordarEstado(idNotaVisible.current, vista.state);
      const estadoRecordado = estadosRecordadosPorNota.current.get(idNota);
      vista.setState(estadoRecordado ?? EditorState.create({ doc: textoInicial, extensions: crearExtensiones() }));
      idNotaVisible.current = idNota;
      recordarEstado(idNota, vista.state);
      // Una nota recordada pudo quedar con otro modo del editor: se pone al día.
      // Y se le dice dónde está, para sus imágenes.
      vista.dispatch({
        effects: [
          compartimentoDelModo.reconfigure(extensionesDelModo(configuracionDelEditorVigente.current)),
          cambiarLugarDeLaNota.of(lugarDeLaNotaVigente.current),
        ],
      });
      callbacksVigentes.current.alMoverCursor(vista.state.selection.main.head);
      vista.focus();
    },
    recuerdaLaNota: (idNota) => idNota === idNotaVisible.current || estadosRecordadosPorNota.current.has(idNota),
    olvidarNota(idNota) {
      estadosRecordadosPorNota.current.delete(idNota);
      if (idNotaVisible.current === idNota) idNotaVisible.current = null;
    },
    olvidarNotasDentroDe(carpeta) {
      const carpetaSinBarraFinal = carpeta.replace(/[\\/]+$/, "");
      const esDeLaCarpeta = (idNota: string) =>
        idNota.startsWith(`archivo:${carpetaSinBarraFinal}/`) || idNota.startsWith(`archivo:${carpetaSinBarraFinal}\\`);
      for (const idNota of [...estadosRecordadosPorNota.current.keys()]) {
        if (esDeLaCarpeta(idNota)) estadosRecordadosPorNota.current.delete(idNota);
      }
      // Si la visible era de ahí, el editor se vacía (queda escondido hasta mostrar otra nota).
      const vista = vistaDelEditor.current;
      if (vista && idNotaVisible.current && esDeLaCarpeta(idNotaVisible.current)) {
        idNotaVisible.current = null;
        vista.setState(EditorState.create({ extensions: crearExtensiones() }));
      }
    },
    obtenerTextoDeNota(idNota) {
      if (idNota === idNotaVisible.current) return vistaDelEditor.current?.state.doc.toString();
      return estadosRecordadosPorNota.current.get(idNota)?.doc.toString();
    },
    reemplazarTextoDesdeDisco(idNota, textoDelDisco) {
      const vista = vistaDelEditor.current;
      if (vista && idNota === idNotaVisible.current) {
        if (vista.state.doc.toString() !== textoDelDisco) vista.dispatch(transaccionDesdeDisco(vista.state, textoDelDisco));
        return;
      }
      const estadoRecordado = estadosRecordadosPorNota.current.get(idNota);
      if (estadoRecordado && estadoRecordado.doc.toString() !== textoDelDisco) {
        estadosRecordadosPorNota.current.set(idNota, estadoRecordado.update(transaccionDesdeDisco(estadoRecordado, textoDelDisco)).state);
      }
    },
    llevarCursorA(posicion) {
      const vista = vistaDelEditor.current;
      if (!vista) return;
      vista.dispatch({
        selection: EditorSelection.cursor(posicion),
        effects: EditorView.scrollIntoView(posicion, { y: "start", yMargin: 48 }),
      });
      vista.focus();
    },
    enfocar: () => vistaDelEditor.current?.focus(),
    insertarEnLineaPropia(texto, coordenadasEnLaVentana) {
      const vista = vistaDelEditor.current;
      if (!vista) return;
      const posicion = (coordenadasEnLaVentana && vista.posAtCoords(coordenadasEnLaVentana)) ?? vista.state.selection.main.head;
      const linea = vista.state.doc.lineAt(posicion);
      // En una línea vacía va ahí mismo; si no, en una línea nueva debajo.
      const textoQueSeAgrega = linea.length === 0 ? texto : `\n${texto}`;
      const desde = linea.length === 0 ? linea.from : linea.to;
      vista.dispatch({
        changes: { from: desde, insert: textoQueSeAgrega },
        selection: EditorSelection.cursor(desde + textoQueSeAgrega.length),
        scrollIntoView: true,
      });
      vista.focus();
    },
  }));

  // Cambiar el ancho solo afecta a CSS: no reconfigura CodeMirror ni los estados de las notas.
  const estiloDelAncho = anchoDelTexto == null ? undefined : {
    "--ancho-del-texto": anchoDelTexto === 0 ? "100%" : `${anchoDelTexto}px`,
  } as CSSProperties;
  return <div className={`editor${estaOculto ? " oculto" : ""}`} ref={contenedorDelEditor} style={estiloDelAncho} />;
});
