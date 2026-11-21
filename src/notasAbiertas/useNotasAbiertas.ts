// Las notas abiertas de la ventana y todo lo que les pasa: abrirlas, mostrarlas en el editor,
// guardarlas solas, cerrarlas y no pisar cambios hechos fuera de Ant.
//
// Reglas:
//   · Una sola nota con archivo abierta a la vez: abrir otra guarda y cierra la anterior. Solo
//     siguen abiertas las notas nuevas (sin archivo) que ya tienen algo escrito, para no perderlas.
//   · Guardado automático: una nota con archivo se guarda `PAUSA_ANTES_DE_GUARDAR` después de la
//     última tecla, al abrir otra, al salir de la ventana, al cerrarla y al salir de la app (Rust
//     avisa con `antes-de-salir` y espera a que la interfaz llame a `salir`). Una nota nueva se
//     guarda con Cmd+S la primera vez (pregunta dónde).
//   · Antes de guardar se relee el archivo: si cambió fuera de Ant, no se pisa (avisa; Cmd+S
//     fuerza). Al volver a la ventana, las notas cuyo archivo cambió fuera se recargan.
//   · En cada tecla no se copia el texto: el editor lo tiene. El último texto conocido (para
//     contar palabras y títulos) se pone al día tras `PAUSA_ANTES_DE_CONTAR`.

import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import type { ControlDelEditor } from "../editor/Editor";
import { abrirOCrearNotaDelDia } from "../diario";
import { useTextos } from "../idioma";
import { extraerTitulosDeLaNota } from "../titulosDeLaNota";
import { elegirNotaConElDialogo, elegirDondeGuardarConElDialogo, guardarNotaEnElDisco, leerNotaDelDisco, nombreDelArchivo } from "../archivosDeNotas";
import { useEventoDeRust } from "../useEventoDeRust";
import { NotaAbierta, crearNotaEnBlanco, idDeNotaConArchivo } from "./notaAbierta";

/** Cuánto se espera tras la última tecla para guardar la nota sola, en milisegundos. */
const PAUSA_ANTES_DE_GUARDAR = 600;

/**
 * Cuánto se espera tras la última tecla para poner al día el texto con que se cuentan palabras y
 * se buscan títulos. Hacerlo en cada tecla recorrería la nota entera cada vez, y con una novela
 * en una sola nota escribir se volvería lento.
 */
const PAUSA_ANTES_DE_CONTAR = 250;

/** Une una carpeta y un nombre de archivo con el separador que use la carpeta. */
const unirCarpetaYNombre = (carpeta: string, nombreDelArchivo: string) =>
  `${carpeta.replace(/[\\/]+$/, "")}${carpeta.includes("\\") ? "\\" : "/"}${nombreDelArchivo}`;

interface ParametrosDeLasNotasAbiertas {
  controlDelEditor: RefObject<ControlDelEditor | null>;
  /** Hormiguero abierto: allí se propone guardar las notas nuevas y van las notas diarias. */
  carpetaDelHormigueroAbierto: string | null;
  /** Vuelve a leer el árbol del hormiguero (tras crear una nota). */
  releerArbolDelHormiguero(): void;
  /** Muestra en la barra de estado un error que pasó sin que el usuario hiciera nada (al guardar solo). */
  mostrarError(error: unknown): void;
}

export function useNotasAbiertas({
  controlDelEditor,
  carpetaDelHormigueroAbierto,
  releerArbolDelHormiguero,
  mostrarError,
}: ParametrosDeLasNotasAbiertas) {
  const textosDeLaInterfaz = useTextos();
  const [notasAbiertas, setNotasAbiertas] = useState<NotaAbierta[]>(() => [crearNotaEnBlanco()]);
  const [idNotaVisible, setIdNotaVisible] = useState(() => notasAbiertas[0].id);

  // Copias en refs para que los callbacks, que no se vuelven a crear, lean siempre lo último.
  const notasAbiertasVigentes = useRef(notasAbiertas);
  notasAbiertasVigentes.current = notasAbiertas;
  const idNotaVisibleVigente = useRef(idNotaVisible);
  idNotaVisibleVigente.current = idNotaVisible;
  const textosVigentes = useRef(textosDeLaInterfaz);
  textosVigentes.current = textosDeLaInterfaz;
  const carpetaDelHormigueroVigente = useRef(carpetaDelHormigueroAbierto);
  carpetaDelHormigueroVigente.current = carpetaDelHormigueroAbierto;

  // Un temporizador de guardado por nota con cambios.
  const temporizadoresDeGuardado = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Cuántos cambios lleva cada nota: al terminar de guardar, si cambió el número es que se siguió
  // escribiendo, y la nota sigue con cambios sin guardar.
  const cantidadDeCambiosPorNota = useRef(new Map<string, number>());
  // Temporizador para poner al día el último texto conocido tras una pausa.
  const temporizadorDelConteo = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Título al que hay que llevar el cursor apenas se muestre la nota que se está abriendo
  // (al abrir un capítulo fijado).
  const tituloAlQueIrAlMostrar = useRef<string | null>(null);

  /** Cambia algunos datos de una nota abierta. */
  const cambiarDatosDeNota = useCallback((idNota: string, cambios: Partial<NotaAbierta>) => {
    setNotasAbiertas((notas) => notas.map((nota) => (nota.id === idNota ? { ...nota, ...cambios } : nota)));
  }, []);

  /** Texto actual de una nota: el del editor (al día) o, si el editor no la tiene, el último conocido. */
  const textoActualDeNota = useCallback(
    (nota: NotaAbierta) => controlDelEditor.current?.obtenerTextoDeNota(nota.id) ?? nota.ultimoTextoConocido,
    [controlDelEditor],
  );

  /** Mensaje de error para un archivo que cambió fuera de Ant y no se quiso pisar. */
  const errorCambiadaFueraDeAnt = (rutaDelArchivo: string) =>
    new Error(textosVigentes.current.cambiadaFueraDeAnt(nombreDelArchivo(rutaDelArchivo)));

  /**
   * Guarda ya en su archivo una nota con cambios. Antes mira el archivo: si cambió fuera de Ant
   * desde la última vez que se leyó o guardó, no lo pisa y falla con un aviso. Con
   * `aunqueHayaCambiadoFueraDeAnt` (Cmd+S) se guarda igual, quedándose con la versión de Ant.
   */
  const guardarNotaEnDiscoAhora = useCallback(async (idNota: string, aunqueHayaCambiadoFueraDeAnt = false) => {
    clearTimeout(temporizadoresDeGuardado.current.get(idNota));
    temporizadoresDeGuardado.current.delete(idNota);
    const notaAGuardar = notasAbiertasVigentes.current.find((nota) => nota.id === idNota);
    if (!notaAGuardar?.rutaDelArchivo || !notaAGuardar.tieneCambiosSinGuardar) return;
    const rutaDelArchivo = notaAGuardar.rutaDelArchivo;
    const textoAGuardar = textoActualDeNota(notaAGuardar);
    const cambiosAlEmpezarAGuardar = cantidadDeCambiosPorNota.current.get(idNota) ?? 0;
    if (!aunqueHayaCambiadoFueraDeAnt) {
      // Si el archivo ya no existe (se borró o movió), se vuelve a crear con lo que hay en Ant.
      const textoQueHayAhoraEnDisco = await leerNotaDelDisco(rutaDelArchivo).catch(() => null);
      const cambioFueraDeAnt =
        textoQueHayAhoraEnDisco !== null &&
        textoQueHayAhoraEnDisco !== notaAGuardar.textoQueHayEnDisco &&
        textoQueHayAhoraEnDisco !== textoAGuardar;
      if (cambioFueraDeAnt) throw errorCambiadaFueraDeAnt(rutaDelArchivo);
    }
    await guardarNotaEnElDisco(rutaDelArchivo, textoAGuardar);
    const seSiguioEscribiendo = (cantidadDeCambiosPorNota.current.get(idNota) ?? 0) !== cambiosAlEmpezarAGuardar;
    cambiarDatosDeNota(idNota, { textoQueHayEnDisco: textoAGuardar, tieneCambiosSinGuardar: seSiguioEscribiendo });
  }, [textoActualDeNota, cambiarDatosDeNota]);

  /** Guarda ya todas las notas con archivo que tienen cambios (al salir de la ventana o de la app). */
  const guardarTodasLasNotasConCambios = useCallback(
    () =>
      Promise.all(
        notasAbiertasVigentes.current
          .filter((nota) => nota.rutaDelArchivo && nota.tieneCambiosSinGuardar)
          .map((nota) => guardarNotaEnDiscoAhora(nota.id)),
      ),
    [guardarNotaEnDiscoAhora],
  );

  /**
   * Pone al día las notas abiertas cuyo archivo cambió fuera de Ant (en Obsidian, por una
   * sincronización…). Si además tenían cambios sin guardar en Ant, no se tocan y se avisa del
   * conflicto (Cmd+S se queda con la versión de Ant).
   */
  const recargarNotasCambiadasFueraDeAnt = useCallback(async () => {
    for (const notaAbierta of notasAbiertasVigentes.current) {
      if (!notaAbierta.rutaDelArchivo) continue;
      const textoDelDisco = await leerNotaDelDisco(notaAbierta.rutaDelArchivo).catch(() => null);
      if (textoDelDisco === null || textoDelDisco === notaAbierta.textoQueHayEnDisco) continue;
      if (notaAbierta.tieneCambiosSinGuardar && textoDelDisco !== textoActualDeNota(notaAbierta)) {
        throw errorCambiadaFueraDeAnt(notaAbierta.rutaDelArchivo);
      }
      controlDelEditor.current?.reemplazarTextoDesdeDisco(notaAbierta.id, textoDelDisco);
      cambiarDatosDeNota(notaAbierta.id, {
        ultimoTextoConocido: textoDelDisco,
        textoQueHayEnDisco: textoDelDisco,
        tieneCambiosSinGuardar: false,
      });
    }
  }, [controlDelEditor, textoActualDeNota, cambiarDatosDeNota]);

  // Al salir de la ventana se guarda lo pendiente; al volver, se recargan las notas que
  // cambiaron fuera de Ant.
  useEffect(() => {
    const dejarDeEscuchar = getCurrentWindow().onFocusChanged(({ payload: laVentanaTieneElFoco }) => {
      if (laVentanaTieneElFoco) recargarNotasCambiadasFueraDeAnt().catch(mostrarError);
      else guardarTodasLasNotasConCambios().catch(mostrarError);
    });
    return () => void dejarDeEscuchar.then((dejar) => dejar());
  }, [recargarNotasCambiadasFueraDeAnt, guardarTodasLasNotasConCambios, mostrarError]);

  // Antes de cerrar la ventana (botón rojo) se guarda lo pendiente; si falla, la ventana se
  // cierra igual, para no dejarla trabada.
  useEffect(() => {
    const dejarDeEscuchar = getCurrentWindow().onCloseRequested(() =>
      guardarTodasLasNotasConCambios().then(() => {}, () => {}),
    );
    return () => void dejarDeEscuchar.then((dejar) => dejar());
  }, [guardarTodasLasNotasConCambios]);

  // Al salir de la app (Cmd+Q, el Dock) Rust espera a que se guarde lo pendiente.
  useEventoDeRust(
    "antes-de-salir",
    useCallback(() => void guardarTodasLasNotasConCambios().finally(() => invoke("salir")), [guardarTodasLasNotasConCambios]),
  );

  /** Lleva el cursor al título `tituloBuscado` de la nota visible, cuyo texto es `textoDeLaNota`. */
  const llevarCursorATitulo = useCallback((textoDeLaNota: string, tituloBuscado: string) => {
    const titulo = extraerTitulosDeLaNota(textoDeLaNota).find((marcador) => marcador.texto === tituloBuscado);
    if (titulo) controlDelEditor.current?.llevarCursorA(titulo.posicion);
  }, [controlDelEditor]);

  // Al cambiar la nota visible, el editor la muestra (o la crea con su texto la primera vez) y, si
  // se abrió desde un capítulo fijado, lleva el cursor a ese título.
  useEffect(() => {
    const notaParaMostrar = notasAbiertasVigentes.current.find((nota) => nota.id === idNotaVisible);
    if (!notaParaMostrar) return;
    controlDelEditor.current?.mostrarNota(notaParaMostrar.id, notaParaMostrar.ultimoTextoConocido);
    if (tituloAlQueIrAlMostrar.current) llevarCursorATitulo(notaParaMostrar.ultimoTextoConocido, tituloAlQueIrAlMostrar.current);
    tituloAlQueIrAlMostrar.current = null;
  }, [idNotaVisible, controlDelEditor, llevarCursorATitulo]);

  /**
   * Cada tecla en el editor: la nota visible queda con cambios (eso vuelve a dibujar la ventana
   * solo con la primera tecla), se programa su guardado si tiene archivo, y tras una pausa se pone
   * al día su último texto conocido. Nada de esto crece con el largo de la nota.
   */
  const alCambiarTextoEnElEditor = useCallback(() => {
    const idNota = idNotaVisibleVigente.current;
    cantidadDeCambiosPorNota.current.set(idNota, (cantidadDeCambiosPorNota.current.get(idNota) ?? 0) + 1);
    const notaQueCambio = notasAbiertasVigentes.current.find((nota) => nota.id === idNota);
    if (notaQueCambio && !notaQueCambio.tieneCambiosSinGuardar) cambiarDatosDeNota(idNota, { tieneCambiosSinGuardar: true });
    clearTimeout(temporizadorDelConteo.current);
    temporizadorDelConteo.current = setTimeout(() => {
      const textoDeLaNota = controlDelEditor.current?.obtenerTextoDeNota(idNota);
      if (textoDeLaNota !== undefined) cambiarDatosDeNota(idNota, { ultimoTextoConocido: textoDeLaNota });
    }, PAUSA_ANTES_DE_CONTAR);
    if (!notaQueCambio?.rutaDelArchivo) return;
    clearTimeout(temporizadoresDeGuardado.current.get(idNota));
    temporizadoresDeGuardado.current.set(
      idNota,
      setTimeout(() => guardarNotaEnDiscoAhora(idNota).catch(mostrarError), PAUSA_ANTES_DE_GUARDAR),
    );
  }, [controlDelEditor, cambiarDatosDeNota, guardarNotaEnDiscoAhora, mostrarError]);

  /**
   * Deja visible `notaQueQueda` como la única nota con archivo abierta: las demás con archivo se
   * guardan y se cierran (el editor las recuerda, con su cursor y su historial, por si se vuelven
   * a abrir), y la nota en blanco se descarta. Solo siguen abiertas las notas nuevas que ya tienen
   * algo escrito.
   */
  const dejarComoUnicaNotaAbierta = useCallback(async (notaQueQueda: NotaAbierta) => {
    const otrasNotas = notasAbiertasVigentes.current.filter((nota) => nota.id !== notaQueQueda.id);
    const notasQueSeCierran = otrasNotas.filter(
      (nota) => nota.rutaDelArchivo || (!nota.ultimoTextoConocido && !nota.tieneCambiosSinGuardar),
    );
    await Promise.all(notasQueSeCierran.map((nota) => guardarNotaEnDiscoAhora(nota.id)));
    for (const nota of notasQueSeCierran) {
      if (!nota.rutaDelArchivo) controlDelEditor.current?.olvidarNota(nota.id);
    }
    setNotasAbiertas([...otrasNotas.filter((nota) => !notasQueSeCierran.includes(nota)), notaQueQueda]);
    setIdNotaVisible(notaQueQueda.id);
  }, [controlDelEditor, guardarNotaEnDiscoAhora]);

  /**
   * Abre la nota de `rutaDelArchivo` en lugar de la que había. Siempre lee el archivo, así se
   * abre con lo que hay en el disco aunque haya cambiado fuera de Ant.
   */
  const abrirNotaDeArchivo = useCallback(async (rutaDelArchivo: string) => {
    const yaAbierta = notasAbiertasVigentes.current.find((nota) => nota.rutaDelArchivo === rutaDelArchivo);
    if (yaAbierta?.tieneCambiosSinGuardar) return dejarComoUnicaNotaAbierta(yaAbierta);
    const textoDelDisco = await leerNotaDelDisco(rutaDelArchivo);
    const idNota = yaAbierta?.id ?? idDeNotaConArchivo(rutaDelArchivo);
    // Si el editor la recuerda de antes, se pone al día con el archivo (pudo cambiar fuera de Ant)
    // sin perder su cursor ni su historial.
    const editor = controlDelEditor.current;
    if (editor?.recuerdaLaNota(idNota)) editor.reemplazarTextoDesdeDisco(idNota, textoDelDisco);
    await dejarComoUnicaNotaAbierta({
      id: idNota,
      rutaDelArchivo,
      ultimoTextoConocido: textoDelDisco,
      textoQueHayEnDisco: textoDelDisco,
      tieneCambiosSinGuardar: false,
    });
  }, [controlDelEditor, dejarComoUnicaNotaAbierta]);

  /** Abre la nota de un capítulo fijado y lleva el cursor a su título. */
  const abrirCapitulo = useCallback(async (rutaDelArchivo: string, tituloDelCapitulo: string) => {
    const yaAbierta = notasAbiertasVigentes.current.find((nota) => nota.rutaDelArchivo === rutaDelArchivo);
    if (yaAbierta && yaAbierta.id === idNotaVisibleVigente.current) {
      return llevarCursorATitulo(textoActualDeNota(yaAbierta), tituloDelCapitulo);
    }
    tituloAlQueIrAlMostrar.current = tituloDelCapitulo;
    try {
      await abrirNotaDeArchivo(rutaDelArchivo);
    } catch (error) {
      tituloAlQueIrAlMostrar.current = null;
      throw error;
    }
  }, [abrirNotaDeArchivo, llevarCursorATitulo, textoActualDeNota]);

  /**
   * Modo diario: abre la nota del día elegido en el calendario (`Daily/AAAA-MM-DD.md`). Rust crea
   * la carpeta y la nota si no existen; luego se relee el árbol para que aparezcan.
   */
  const abrirNotaDelDia = useCallback(async (diaElegido: Date) => {
    const carpetaDelHormiguero = carpetaDelHormigueroVigente.current;
    if (!carpetaDelHormiguero) throw new Error(textosVigentes.current.diarioSinCarpeta);
    await abrirNotaDeArchivo(await abrirOCrearNotaDelDia(carpetaDelHormiguero, diaElegido, textosVigentes.current.locale));
    releerArbolDelHormiguero();
  }, [abrirNotaDeArchivo, releerArbolDelHormiguero]);

  /** Muestra el diálogo «Abrir» (empezando en el hormiguero) y abre la nota elegida. */
  const abrirNotaConElDialogo = useCallback(async () => {
    const rutaElegida = await elegirNotaConElDialogo(carpetaDelHormigueroVigente.current, textosVigentes.current.filtroNotas);
    if (rutaElegida) await abrirNotaDeArchivo(rutaElegida);
  }, [abrirNotaDeArchivo]);

  /** Abre una nota nueva en blanco (Cmd+N) en lugar de la que había. */
  const abrirNotaEnBlanco = useCallback(() => dejarComoUnicaNotaAbierta(crearNotaEnBlanco()), [dejarComoUnicaNotaAbierta]);

  /**
   * Guarda la nota visible (Cmd+S). Si tiene archivo, la guarda ya, aunque su archivo haya
   * cambiado fuera de Ant. Si todavía no tiene archivo, o `enOtroArchivo` (Cmd+Shift+S), pregunta
   * dónde, proponiendo el hormiguero abierto, y relee el árbol para que aparezca.
   */
  const guardarNotaVisible = useCallback(async (enOtroArchivo = false) => {
    const notaVisible = notasAbiertasVigentes.current.find((nota) => nota.id === idNotaVisibleVigente.current);
    if (!notaVisible) return;
    if (notaVisible.rutaDelArchivo && !enOtroArchivo) return guardarNotaEnDiscoAhora(notaVisible.id, true);
    const textos = textosVigentes.current;
    const nombrePropuesto = notaVisible.rutaDelArchivo ? nombreDelArchivo(notaVisible.rutaDelArchivo) : textos.notaNueva;
    const carpetaDelHormiguero = carpetaDelHormigueroVigente.current;
    const rutaElegida = await elegirDondeGuardarConElDialogo(
      carpetaDelHormiguero ? unirCarpetaYNombre(carpetaDelHormiguero, nombrePropuesto) : nombrePropuesto,
      textos.filtroNotas,
    );
    if (!rutaElegida) return;
    clearTimeout(temporizadoresDeGuardado.current.get(notaVisible.id));
    const textoGuardado = textoActualDeNota(notaVisible);
    await guardarNotaEnElDisco(rutaElegida, textoGuardado);
    cambiarDatosDeNota(notaVisible.id, {
      rutaDelArchivo: rutaElegida,
      tieneCambiosSinGuardar: false,
      textoQueHayEnDisco: textoGuardado,
    });
    releerArbolDelHormiguero();
  }, [guardarNotaEnDiscoAhora, textoActualDeNota, cambiarDatosDeNota, releerArbolDelHormiguero]);

  /**
   * Cierra una nota y muestra la vecina. Si tiene archivo, antes guarda sus cambios; si es una
   * nota nueva con algo escrito, pregunta antes de descartarla.
   */
  const cerrarNota = useCallback(async (idNota: string) => {
    const notas = notasAbiertasVigentes.current;
    const posicionEnLaLista = notas.findIndex((nota) => nota.id === idNota);
    const notaQueSeCierra = notas[posicionEnLaLista];
    if (!notaQueSeCierra) return;
    if (notaQueSeCierra.rutaDelArchivo) await guardarNotaEnDiscoAhora(idNota);
    else if (notaQueSeCierra.tieneCambiosSinGuardar) {
      const textos = textosVigentes.current;
      const quiereDescartarla = await ask(textos.cambiosSinGuardar(textos.sinTitulo), {
        title: textos.cerrarNotaTitulo,
        kind: "warning",
        okLabel: textos.descartarCambios,
        cancelLabel: textos.cancelar,
      });
      if (!quiereDescartarla) return;
    }
    // Las notas con archivo se siguen recordando en el editor por si se vuelven a abrir.
    if (!notaQueSeCierra.rutaDelArchivo) controlDelEditor.current?.olvidarNota(idNota);
    const notasQueQuedan = notas.filter((nota) => nota.id !== idNota);
    // Nunca queda la ventana vacía: si se cerró la última nota, se abre una en blanco.
    if (notasQueQuedan.length === 0) notasQueQuedan.push(crearNotaEnBlanco());
    setNotasAbiertas(notasQueQuedan);
    if (idNota === idNotaVisibleVigente.current) {
      setIdNotaVisible(notasQueQuedan[Math.min(posicionEnLaLista, notasQueQuedan.length - 1)].id);
    }
  }, [controlDelEditor, guardarNotaEnDiscoAhora]);

  /** Pasa a la nota abierta siguiente (`paso` = 1) o anterior (`paso` = -1), dando la vuelta al llegar al final. */
  const pasarANotaVecina = useCallback((paso: 1 | -1) => {
    const notas = notasAbiertasVigentes.current;
    const posicionActual = notas.findIndex((nota) => nota.id === idNotaVisibleVigente.current);
    setIdNotaVisible(notas[(posicionActual + paso + notas.length) % notas.length].id);
  }, []);

  /** Texto de una nota abierta, con sus cambios sin guardar (para compilarla tal como se ve). */
  const textoDeNotaAbiertaPorRuta = useCallback((rutaDelArchivo: string) => {
    const nota = notasAbiertasVigentes.current.find((notaAbierta) => notaAbierta.rutaDelArchivo === rutaDelArchivo);
    return nota ? controlDelEditor.current?.obtenerTextoDeNota(nota.id) : undefined;
  }, [controlDelEditor]);

  const notaVisible = notasAbiertas.find((nota) => nota.id === idNotaVisible) ?? notasAbiertas[0];

  return {
    notasAbiertas,
    notaVisible,
    mostrarNotaAbierta: setIdNotaVisible,
    abrirNotaDeArchivo,
    abrirCapitulo,
    abrirNotaDelDia,
    abrirNotaConElDialogo,
    abrirNotaEnBlanco,
    guardarNotaVisible,
    cerrarNota,
    pasarANotaVecina,
    alCambiarTextoEnElEditor,
    textoDeNotaAbiertaPorRuta,
  };
}
