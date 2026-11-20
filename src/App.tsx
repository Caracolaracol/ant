// Ventana principal: barra lateral con el hormiguero abierto, los fijados y los títulos de la nota
// visible, el editor y una barra de estado abajo, como en Left. Hay una sola nota con archivo
// abierta a la vez: abrir otra cierra la anterior. Las notas con archivo se guardan solas
// (`guardarYa`) un momento después de dejar de escribir, al cambiar de nota, al salir de la
// ventana y al cerrar la app; una nota nueva se guarda con Cmd+S la primera vez (pregunta dónde).
// Lleva la lista de notas abiertas (ruta, texto y si tienen cambios sin guardar), cuál está visible, los ajustes (hormigueros,
// fijados con sus iconos…), el modo diario (calendario → nota del día) y los atajos de teclado:
//   Cmd+N nueva · Cmd+O abrir · Cmd+S guardar · Cmd+Shift+S guardar como
//   Cmd+Shift+] / Cmd+Shift+[ nota siguiente / anterior · Cmd+\ mostrar u ocultar la barra lateral
// Encima de todo esto se abren, cuando toca: la bienvenida (sin hormigueros, o desde el menú), los
// Ajustes (Cmd+,), «Hormiguero nuevo» y «Compilar y exportar» (Cmd+Shift+E). Los ítems del menú
// los maneja Rust, que avisa con un evento (`abrir-ajustes`, `abrir-bienvenida`,
// `nuevo-hormiguero`, `abrir-compilar`) y aquí se abre lo que corresponda.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { Editor, ControlDelEditor } from "./editor/Editor";
import { ANCHO_BARRA, BarraLateral, NotaResumen } from "./BarraLateral";
import { Ajustes, escucharAjustes, guardarAjustes, leerAjustes } from "./ajustes";
import { ModalAjustes } from "./ajustes/ModalAjustes";
import { Bienvenida } from "./bienvenida/Bienvenida";
import { Entrada, listarCarpeta } from "./carpeta";
import { abrirDia } from "./diario";
import { configEscritor } from "./editor/escritor";
import { Compilar } from "./compilar/Compilar";
import { conHormiguero } from "./hormigueros/hormigueros";
import { NuevoHormiguero } from "./hormigueros/NuevoHormiguero";
import { idiomaDe, useTextos } from "./idioma";
import { extraerMarcadores, marcadorActual } from "./marcadores";
import { elegirNota, elegirRutaGuardado, guardarNota, leerNota, nombreArchivo } from "./notas";
import "./App.css";

/** Cuenta palabras, líneas y caracteres del texto, para la barra de estado. */
function contar(texto: string) {
  const palabras = texto.trim() ? texto.trim().split(/\s+/).length : 0;
  return { palabras, lineas: texto.split("\n").length, caracteres: texto.length };
}

/** Genera un identificador único para una nota nueva, que todavía no tiene archivo. */
let contadorDeNotasNuevas = 0;
const nuevoId = () => `nota-nueva-${++contadorDeNotasNuevas}`;

/**
 * Identificador de la nota de un archivo: siempre el mismo para la misma ruta, así el editor la
 * reconoce al volver a abrirla y recupera su cursor y su historial de deshacer.
 */
const idDeNotaConArchivo = (rutaDelArchivo: string) => `archivo:${rutaDelArchivo}`;

/** Cuánto se espera tras la última tecla para guardar la nota solo, en milisegundos. */
const PAUSA_GUARDADO = 600;

/**
 * Cuánto se espera tras la última tecla para volver a contar palabras y buscar los títulos de la
 * nota (barra de estado y barra lateral). Hacerlo en cada tecla recorrería la nota entera cada
 * vez, y con una novela en una sola nota escribir se volvería lento.
 */
const PAUSA_PARA_CONTAR_Y_BUSCAR_TITULOS = 250;

/** Nota vacía y sin ruta, la que se crea con Cmd+N o al cerrar la última. */
const notaVacia = (): NotaResumen => ({ id: nuevoId(), ruta: null, texto: "", sucio: false, textoQueHayEnDisco: null });

/** Une una carpeta y un nombre de archivo con el separador que use la carpeta. */
const unir = (carpeta: string, nombre: string) =>
  `${carpeta.replace(/[\\/]+$/, "")}${carpeta.includes("\\") ? "\\" : "/"}${nombre}`;

/** Escucha un evento que manda Rust (los ítems del menú) mientras el componente está montado. */
function useEvento(nombre: string, alRecibir: () => void) {
  useEffect(() => {
    const dejar = listen(nombre, alRecibir);
    return () => void dejar.then((f) => f());
  }, [nombre, alRecibir]);
}

function App({ ajustesIniciales }: { ajustesIniciales: Ajustes }) {
  const editor = useRef<ControlDelEditor>(null);
  // Textos del idioma elegido; en una ref también, para los callbacks que no se vuelven a crear.
  const tx = useTextos();
  const txRef = useRef(tx);
  txRef.current = tx;
  const [notas, setNotas] = useState<NotaResumen[]>(() => [notaVacia()]);
  const [activa, setActiva] = useState(() => notas[0].id);
  // Posición del cursor en una ref y no en el estado: cambia en cada movimiento del mouse al
  // seleccionar, y si cada cambio volviera a dibujar la ventana entera (barra lateral, conteo de
  // palabras), el scroll al seleccionar texto largo perdería cuadros. Solo se vuelve a dibujar
  // cuando el cursor pasa a otro título (`tituloCursor`).
  const cursor = useRef(0);
  const [, setTituloCursor] = useState(-1);
  const [barraVisible, setBarraVisible] = useState(true);
  // Los ajustes ya vienen leídos de `main.tsx`: así la bienvenida no aparece un instante si ya
  // hay hormigueros.
  const [ajustes, setAjustes] = useState<Ajustes>(ajustesIniciales);
  const carpeta = ajustes.carpeta;
  const [arbol, setArbol] = useState<Entrada[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Copias en refs para que los atajos y callbacks lean siempre el valor más reciente.
  const notasRef = useRef(notas);
  notasRef.current = notas;
  const activaRef = useRef(activa);
  activaRef.current = activa;
  const carpetaRef = useRef(carpeta);
  carpetaRef.current = carpeta;
  const ajustesRef = useRef(ajustes);
  ajustesRef.current = ajustes;

  /** Muestra un error en la barra de estado. */
  const fallo = useCallback((e: unknown) => setError(String(e)), []);

  // Vuelve a leer los ajustes al iniciar y los actualiza cada vez que se guardan.
  useEffect(() => {
    leerAjustes().then(setAjustes, fallo);
    const dejar = escucharAjustes(setAjustes);
    return () => void dejar.then((f) => f());
  }, [fallo]);

  /** Cambia la lista de fijados: se muestra al instante y se guarda en los ajustes. */
  const cambiarFijados = useCallback((cambiar: (fijados: string[]) => string[]) => {
    const nuevos = { ...ajustesRef.current, fijados: cambiar(ajustesRef.current.fijados) };
    setAjustes(nuevos);
    guardarAjustes(nuevos).catch(fallo);
  }, [fallo]);

  /** Cambia algunos ajustes: se aplican al instante y se guardan. */
  const cambiarAjustes = useCallback((cambios: Partial<Ajustes>) => {
    const nuevos = { ...ajustesRef.current, ...cambios };
    setAjustes(nuevos);
    guardarAjustes(nuevos).catch(fallo);
  }, [fallo]);

  /** Guarda el ancho de la barra lateral (tras arrastrar su borde) en los ajustes. */
  const cambiarAnchoBarra = useCallback((ancho: number | null) => cambiarAjustes({ ancho_barra: ancho }), [cambiarAjustes]);

  // Lo que se abre encima del editor desde el menú: «Compilar y exportar», Ajustes, «Hormiguero
  // nuevo» y la bienvenida (que también aparece sola mientras no haya ningún hormiguero).
  const [compilando, setCompilando] = useState(false);
  const [enAjustes, setEnAjustes] = useState(false);
  const [cavando, setCavando] = useState(false);
  const [verBienvenida, setVerBienvenida] = useState(false);
  useEvento("abrir-compilar", useCallback(() => setCompilando(true), []));
  useEvento("abrir-ajustes", useCallback(() => setEnAjustes(true), []));
  useEvento("nuevo-hormiguero", useCallback(() => setCavando(true), []));
  useEvento("abrir-bienvenida", useCallback(() => setVerBienvenida(true), []));
  const bienvenida = verBienvenida || ajustes.hormigueros.length === 0;

  /** Abre un hormiguero (y lo suma a la lista si es nuevo); cierra lo que se abrió para cavarlo. */
  const abrirHormiguero = useCallback((ruta: string) => {
    cambiarAjustes(conHormiguero(ajustesRef.current, ruta));
    setCavando(false);
    setVerBienvenida(false);
  }, [cambiarAjustes]);

  /** Cambia el icono de un fijado; `null` vuelve al de su tipo. */
  const cambiarIcono = useCallback((clave: string, icono: string | null) => {
    const iconos = { ...ajustesRef.current.iconos };
    if (icono) iconos[clave] = icono;
    else delete iconos[clave];
    cambiarAjustes({ iconos });
  }, [cambiarAjustes]);

  /** Quita un fijado, y su icono si tenía uno elegido. */
  const desfijar = useCallback((clave: string) => {
    const { [clave]: _, ...iconos } = ajustesRef.current.iconos;
    cambiarAjustes({ fijados: ajustesRef.current.fijados.filter((f) => f !== clave), iconos });
  }, [cambiarAjustes]);

  /** Texto de una nota abierta, con sus cambios sin guardar (para compilarla tal como se ve). */
  const textoAbierto = useCallback((ruta: string) => {
    const nota = notasRef.current.find((n) => n.ruta === ruta);
    return nota ? editor.current?.obtenerTextoDeNota(nota.id) : undefined;
  }, []);

  /** Vuelve a leer el árbol del hormiguero abierto (tras guardar, o al volver a la ventana). */
  const refrescarArbol = useCallback(() => {
    const dir = carpetaRef.current;
    if (!dir) return setArbol([]);
    listarCarpeta(dir).then(setArbol, (e) => {
      setArbol([]);
      fallo(e);
    });
  }, [fallo]);

  // Guardado automático: cada nota con archivo que cambia tiene un temporizador; al vencer (tras
  // `PAUSA_GUARDADO` sin escribir) se guarda.
  const temporizadores = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Cuántos cambios lleva cada nota desde que se abrió: al terminar de guardar, si cambió el número,
  // es que se siguió escribiendo y la nota sigue con cambios sin guardar.
  const cambiosPorNota = useRef(new Map<string, number>());
  // Temporizador para poner al día el texto que se cuenta (palabras, títulos) tras una pausa.
  const temporizadorDelConteo = useRef<ReturnType<typeof setTimeout>>(undefined);

  /** Texto actual de una nota: el del editor (al día) o, si el editor no la tiene, el último conocido. */
  const textoActualDeNota = useCallback(
    (nota: NotaResumen) => editor.current?.obtenerTextoDeNota(nota.id) ?? nota.texto,
    [],
  );

  /**
   * Guarda ya en su archivo una nota con cambios, con el texto del editor. Si mientras se
   * guardaba se siguió escribiendo, la nota queda con cambios para el próximo guardado.
   *
   * Antes de escribir mira el archivo: si cambió fuera de Ant desde la última vez que se leyó o
   * guardó (otra app, una sincronización), no lo pisa y avisa en la barra de estado. Con
   * `aunqueHayaCambiadoFuera` (Cmd+S) se guarda igual, quedándose con la versión de Ant.
   */
  const guardarYa = useCallback(async (idNota: string, aunqueHayaCambiadoFuera = false) => {
    clearTimeout(temporizadores.current.get(idNota));
    temporizadores.current.delete(idNota);
    const notaAGuardar = notasRef.current.find((nota) => nota.id === idNota);
    if (!notaAGuardar?.ruta || !notaAGuardar.sucio) return;
    const textoAGuardar = textoActualDeNota(notaAGuardar);
    const cambiosAlEmpezarAGuardar = cambiosPorNota.current.get(idNota) ?? 0;
    if (!aunqueHayaCambiadoFuera) {
      // Si el archivo ya no existe (se borró o movió), se vuelve a crear con lo que hay en Ant.
      const textoQueHayAhoraEnDisco = await leerNota(notaAGuardar.ruta).catch(() => null);
      const cambioFueraDeAnt =
        textoQueHayAhoraEnDisco !== null &&
        textoQueHayAhoraEnDisco !== notaAGuardar.textoQueHayEnDisco &&
        textoQueHayAhoraEnDisco !== textoAGuardar;
      if (cambioFueraDeAnt) throw new Error(txRef.current.cambiadaFueraDeAnt(nombreArchivo(notaAGuardar.ruta)));
    }
    await guardarNota(notaAGuardar.ruta, textoAGuardar);
    setNotas((notasAbiertas) =>
      notasAbiertas.map((nota) =>
        nota.id === idNota
          ? { ...nota, textoQueHayEnDisco: textoAGuardar, sucio: (cambiosPorNota.current.get(idNota) ?? 0) !== cambiosAlEmpezarAGuardar }
          : nota,
      ),
    );
  }, [textoActualDeNota]);

  /**
   * Al volver a la ventana: las notas abiertas cuyo archivo cambió fuera de Ant (en Obsidian, por
   * una sincronización…) se ponen al día con lo que hay en el disco. Si además tenían cambios sin
   * guardar en Ant, no se tocan y se avisa del conflicto (Cmd+S se queda con la versión de Ant).
   */
  const recargarNotasCambiadasFueraDeAnt = useCallback(async () => {
    for (const notaAbierta of notasRef.current) {
      if (!notaAbierta.ruta) continue;
      const textoDelDisco = await leerNota(notaAbierta.ruta).catch(() => null);
      if (textoDelDisco === null || textoDelDisco === notaAbierta.textoQueHayEnDisco) continue;
      if (notaAbierta.sucio && textoDelDisco !== textoActualDeNota(notaAbierta)) {
        throw new Error(txRef.current.cambiadaFueraDeAnt(nombreArchivo(notaAbierta.ruta)));
      }
      editor.current?.reemplazarTextoDesdeDisco(notaAbierta.id, textoDelDisco);
      setNotas((notasAbiertas) =>
        notasAbiertas.map((nota) =>
          nota.id === notaAbierta.id ? { ...nota, texto: textoDelDisco, textoQueHayEnDisco: textoDelDisco, sucio: false } : nota,
        ),
      );
    }
  }, [textoActualDeNota]);

  /** Guarda ya todas las notas con archivo que tienen cambios (al salir de la ventana o de la app). */
  const guardarPendientes = useCallback(
    () => Promise.all(notasRef.current.filter((n) => n.ruta && n.sucio).map((n) => guardarYa(n.id))),
    [guardarYa],
  );

  // Lee el árbol cuando cambia la carpeta y cada vez que la ventana recupera el foco, por si se
  // crearon, borraron o movieron notas desde fuera de la app (Finder, Obsidian, etc.). Al perder
  // el foco, guarda lo pendiente.
  useEffect(refrescarArbol, [carpeta, refrescarArbol]);
  useEffect(() => {
    const dejar = getCurrentWindow().onFocusChanged(({ payload: enfocada }) => {
      if (enfocada) {
        refrescarArbol();
        recargarNotasCambiadasFueraDeAnt().catch(fallo);
      } else guardarPendientes().catch(fallo);
    });
    return () => void dejar.then((f) => f());
  }, [refrescarArbol, recargarNotasCambiadasFueraDeAnt, guardarPendientes, fallo]);

  // Antes de cerrar la ventana (botón rojo) se guarda lo pendiente; si falla, la ventana se
  // cierra igual, para no dejarla trabada.
  useEffect(() => {
    const dejar = getCurrentWindow().onCloseRequested(() => guardarPendientes().then(() => {}, () => {}));
    return () => void dejar.then((f) => f());
  }, [guardarPendientes]);

  // Al salir de la app (Cmd+Q, el Dock) Rust espera a que se guarde lo pendiente: avisa con
  // `antes-de-salir` y sale cuando la interfaz llama a `salir` (o a los pocos segundos).
  useEvento(
    "antes-de-salir",
    useCallback(() => void guardarPendientes().finally(() => invoke("salir")), [guardarPendientes]),
  );

  /** Lleva el cursor al título `titulo` de la nota visible, cuyo texto es `texto`. */
  const irATitulo = useCallback((texto: string, titulo: string) => {
    const m = extraerMarcadores(texto).find((m) => m.texto === titulo);
    if (m) editor.current?.llevarCursorA(m.pos);
  }, []);
  // Título al que hay que ir apenas se muestre la nota que se está abriendo (capítulo fijado).
  const capituloPendiente = useRef<string | null>(null);

  // Al cambiar la nota activa, el editor muestra su estado (o la crea con su texto la primera vez)
  // y, si se abrió desde un capítulo fijado, va a ese título.
  useEffect(() => {
    const nota = notasRef.current.find((n) => n.id === activa);
    if (!nota) return;
    editor.current?.mostrarNota(nota.id, nota.texto);
    if (capituloPendiente.current) irATitulo(nota.texto, capituloPendiente.current);
    capituloPendiente.current = null;
  }, [activa, irATitulo]);

  /** Cambia los datos de una nota abierta. */
  const actualizar = useCallback((id: string, cambios: Partial<NotaResumen>) => {
    setNotas((ns) => ns.map((n) => (n.id === id ? { ...n, ...cambios } : n)));
  }, []);

  // Cada tecla en el editor: la nota activa queda con cambios (eso vuelve a dibujar la ventana
  // solo con la primera tecla), se programa su guardado si tiene archivo, y tras una pausa se
  // pone al día el texto que se cuenta. Así escribir no hace trabajo que crezca con el largo de
  // la nota.
  const alCambiarTextoEnElEditor = useCallback(() => {
    const idNota = activaRef.current;
    cambiosPorNota.current.set(idNota, (cambiosPorNota.current.get(idNota) ?? 0) + 1);
    const notaQueCambio = notasRef.current.find((nota) => nota.id === idNota);
    if (notaQueCambio && !notaQueCambio.sucio) actualizar(idNota, { sucio: true });
    clearTimeout(temporizadorDelConteo.current);
    temporizadorDelConteo.current = setTimeout(() => {
      const textoParaContar = editor.current?.obtenerTextoDeNota(idNota);
      if (textoParaContar !== undefined) actualizar(idNota, { texto: textoParaContar });
    }, PAUSA_PARA_CONTAR_Y_BUSCAR_TITULOS);
    if (!notaQueCambio?.ruta) return;
    clearTimeout(temporizadores.current.get(idNota));
    temporizadores.current.set(idNota, setTimeout(() => guardarYa(idNota).catch(fallo), PAUSA_GUARDADO));
  }, [actualizar, guardarYa, fallo]);

  /**
   * Deja visible `notaQueQueda` como la única nota con archivo abierta: las demás con archivo se
   * guardan y se cierran (el editor las recuerda, con su cursor y su historial, por si se vuelven
   * a abrir), y la nota en blanco se descarta. Solo siguen abiertas las notas nuevas que ya tienen
   * algo escrito (sin archivo todavía), para no perderlas.
   */
  const dejarSola = useCallback(async (notaQueQueda: NotaResumen) => {
    const otrasNotas = notasRef.current.filter((nota) => nota.id !== notaQueQueda.id);
    const notasQueSeCierran = otrasNotas.filter((nota) => nota.ruta || (!nota.texto && !nota.sucio));
    await Promise.all(notasQueSeCierran.map((nota) => guardarYa(nota.id)));
    notasQueSeCierran.filter((nota) => !nota.ruta).forEach((notaEnBlanco) => editor.current?.olvidarNota(notaEnBlanco.id));
    setNotas([...otrasNotas.filter((nota) => !notasQueSeCierran.includes(nota)), notaQueQueda]);
    setActiva(notaQueQueda.id);
  }, [guardarYa]);

  /**
   * Abre la nota de `ruta` en lugar de la que había. Siempre lee el archivo, así se abre con lo que
   * hay en el disco aunque haya cambiado fuera de Ant.
   */
  const abrirRuta = useCallback(async (ruta: string) => {
    const yaAbierta = notasRef.current.find((nota) => nota.ruta === ruta);
    if (yaAbierta?.sucio) return dejarSola(yaAbierta);
    const textoDelDisco = await leerNota(ruta);
    const idNota = yaAbierta?.id ?? idDeNotaConArchivo(ruta);
    // Si el editor la recuerda de antes, se pone al día con el archivo (pudo cambiar fuera de Ant)
    // sin perder su cursor ni su historial.
    if (editor.current?.recuerdaLaNota(idNota)) editor.current.reemplazarTextoDesdeDisco(idNota, textoDelDisco);
    await dejarSola({
      id: idNota,
      ruta,
      texto: textoDelDisco,
      textoQueHayEnDisco: textoDelDisco,
      sucio: false,
    });
  }, [dejarSola]);

  /**
   * Modo diario: abre la nota del día elegido en el calendario (`Daily/AAAA-MM-DD.md`). Rust crea
   * la carpeta y la nota si no existen; luego se refresca el árbol para que aparezcan.
   */
  const abrirDiaElegido = useCallback(async (fecha: Date) => {
    const dir = carpetaRef.current;
    if (!dir) throw new Error(txRef.current.diarioSinCarpeta);
    await abrirRuta(await abrirDia(dir, fecha, txRef.current.locale));
    refrescarArbol();
  }, [abrirRuta, refrescarArbol]);

  /** Abre la nota de un capítulo fijado y lleva el cursor a su título. */
  const abrirCapitulo = useCallback(async (ruta: string, titulo: string) => {
    const abierta = notasRef.current.find((n) => n.ruta === ruta);
    if (abierta && abierta.id === activaRef.current) return irATitulo(textoActualDeNota(abierta), titulo);
    capituloPendiente.current = titulo;
    try {
      await abrirRuta(ruta);
    } catch (e) {
      capituloPendiente.current = null;
      throw e;
    }
  }, [abrirRuta, irATitulo, textoActualDeNota]);

  /** Muestra el diálogo «Abrir» (empezando en el hormiguero) y abre la nota elegida. */
  const abrir = useCallback(async () => {
    const ruta = await elegirNota(carpetaRef.current, txRef.current.filtroNotas);
    if (ruta) await abrirRuta(ruta);
  }, [abrirRuta]);

  /**
   * Guarda la nota activa; si todavía no tiene ruta, o se pide «guardar como», pregunta dónde,
   * proponiendo el hormiguero abierto. Después refresca el árbol para que aparezca la nota nueva.
   */
  const guardar = useCallback(async (como = false) => {
    const nota = notasRef.current.find((n) => n.id === activaRef.current);
    if (!nota) return;
    // Cmd+S en una nota con archivo la guarda ya, aunque su archivo haya cambiado fuera de Ant.
    if (nota.ruta && !como) return guardarYa(nota.id, true);
    let destino = nota.ruta;
    if (!destino || como) {
      const nombre = nota.ruta ? nombreArchivo(nota.ruta) : txRef.current.notaNueva;
      destino = await elegirRutaGuardado(carpetaRef.current ? unir(carpetaRef.current, nombre) : nombre, txRef.current.filtroNotas);
    }
    if (!destino) return;
    clearTimeout(temporizadores.current.get(nota.id));
    const textoGuardado = editor.current?.obtenerTextoDeNota(nota.id) ?? "";
    await guardarNota(destino, textoGuardado);
    actualizar(nota.id, { ruta: destino, sucio: false, textoQueHayEnDisco: textoGuardado });
    refrescarArbol();
  }, [actualizar, refrescarArbol, guardarYa]);

  /**
   * Cierra una nota y muestra la vecina. Si tiene archivo, antes guarda sus cambios; si es una
   * nota nueva con algo escrito, pregunta antes de descartarla.
   */
  const cerrar = useCallback(async (id: string) => {
    const lista = notasRef.current;
    const i = lista.findIndex((n) => n.id === id);
    const nota = lista[i];
    if (!nota) return;
    if (nota.ruta) await guardarYa(id);
    else if (nota.sucio) {
      const t = txRef.current;
      const nombre = nota.ruta ? nombreArchivo(nota.ruta) : t.sinTitulo;
      const descartar = await ask(t.cambiosSinGuardar(nombre), {
        title: t.cerrarNotaTitulo,
        kind: "warning",
        okLabel: t.descartarCambios,
        cancelLabel: t.cancelar,
      });
      if (!descartar) return;
    }
    // Las notas con archivo se siguen recordando en el editor por si se vuelven a abrir.
    if (!nota.ruta) editor.current?.olvidarNota(id);
    const resto = lista.filter((n) => n.id !== id);
    // Nunca queda la ventana vacía: si se cerró la última nota, se abre una en blanco.
    if (resto.length === 0) resto.push(notaVacia());
    setNotas(resto);
    if (id === activaRef.current) setActiva(resto[Math.min(i, resto.length - 1)].id);
  }, [guardarYa]);

  /** Pasa a la nota siguiente (`paso` = 1) o anterior (`paso` = -1), dando la vuelta al llegar al final. */
  const moverse = useCallback((paso: number) => {
    const lista = notasRef.current;
    const i = lista.findIndex((n) => n.id === activaRef.current);
    setActiva(lista[(i + paso + lista.length) % lista.length].id);
  }, []);

  // Atajos de teclado. Los errores (permisos, disco lleno…) se muestran en la barra de estado.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const tecla = e.key.toLowerCase();
      let accion: (() => Promise<void> | void) | null = null;
      if (tecla === "s") accion = () => guardar(e.shiftKey);
      else if (tecla === "o") accion = abrir;
      else if (tecla === "n") accion = () => dejarSola(notaVacia());
      else if (tecla === "\\") accion = () => setBarraVisible((v) => !v);
      // Con Shift, las teclas [ y ] cambian de carácter según el teclado; se usa el código físico.
      else if (e.shiftKey && e.code === "BracketRight") accion = () => moverse(1);
      else if (e.shiftKey && e.code === "BracketLeft") accion = () => moverse(-1);
      if (!accion) return;
      e.preventDefault();
      Promise.resolve(accion()).then(() => setError(null), fallo);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [guardar, abrir, dejarSola, moverse, fallo]);

  const nota = notas.find((n) => n.id === activa) ?? notas[0];
  const nombre = nota.ruta ? nombreArchivo(nota.ruta) : tx.sinTitulo;

  // Solo una nota nueva (sin archivo) tiene cambios que esperan a que el usuario la guarde; las
  // demás se guardan solas, así que no se marcan (la marca parpadearía al escribir).
  const sinGuardar = nota.sucio && !nota.ruta;

  // El título de la ventana (visible en Mission Control y el Dock) muestra la nota y si está sin guardar.
  useEffect(() => {
    getCurrentWindow().setTitle(`${sinGuardar ? "• " : ""}${nombre}`).catch(() => {});
  }, [nombre, sinGuardar]);

  // El conteo y los títulos recorren la nota entera: solo se recalculan cuando cambia su texto.
  const { palabras, lineas, caracteres } = useMemo(() => contar(nota.texto), [nota.texto]);
  const marcadores = useMemo(() => extraerMarcadores(nota.texto), [nota.texto]);
  const marcadoresRef = useRef(marcadores);
  marcadoresRef.current = marcadores;

  // Modo escritor para el editor (o `null` si está apagado), con las comillas según el idioma.
  const escritor = useMemo(
    () => (ajustes.escritor ? configEscritor(ajustes.opciones_escritor, idiomaDe(ajustes.idioma)) : null),
    [ajustes.escritor, ajustes.opciones_escritor, ajustes.idioma],
  );

  /** Guarda la posición del cursor y vuelve a dibujar solo si cambió el título en el que está. */
  const alMoverCursor = useCallback((pos: number) => {
    cursor.current = pos;
    setTituloCursor(marcadorActual(marcadoresRef.current, pos));
  }, []);

  return (
    <main className="app">
      {/* Franja superior que reemplaza la barra de título nativa (oculta en tauri.conf.json):
          deja espacio a los botones de la ventana y permite arrastrarla. */}
      <div className="arrastre" data-tauri-drag-region />
      <div className="cuerpo">
        {barraVisible && (
          <BarraLateral
            carpeta={carpeta}
            arbol={arbol}
            fijados={ajustes.fijados}
            iconos={ajustes.iconos}
            diario={ajustes.diario}
            ancho={ajustes.ancho_barra ?? ANCHO_BARRA}
            onCambiarAncho={cambiarAnchoBarra}
            onAbrirDia={(fecha) => abrirDiaElegido(fecha).then(() => setError(null), fallo)}
            onFijar={(ruta) => cambiarFijados((f) => (f.includes(ruta) ? f : [...f, ruta]))}
            onDesfijar={desfijar}
            onCambiarIcono={cambiarIcono}
            onAbrirCapitulo={(ruta, titulo) => abrirCapitulo(ruta, titulo).then(() => setError(null), fallo)}
            notas={notas}
            activa={activa}
            marcadores={marcadores}
            tituloActual={marcadorActual(marcadores, cursor.current)}
            onElegir={setActiva}
            onAbrirRuta={(ruta) => abrirRuta(ruta).then(() => setError(null), fallo)}
            onCerrar={(id) => cerrar(id).catch(fallo)}
            onSaltar={(posicion) => editor.current?.llevarCursorA(posicion)}
          />
        )}
        <Editor ref={editor} alCambiarTexto={alCambiarTextoEnElEditor} alMoverCursor={alMoverCursor} configuracionModoEscritor={escritor} />
      </div>
      {compilando && !bienvenida && (
        <Compilar
          carpeta={carpeta}
          arbol={arbol}
          rutaActiva={nota.ruta}
          ajustes={ajustes}
          textoAbierto={textoAbierto}
          onGuardarAjustes={cambiarAjustes}
          onCerrar={() => {
            setCompilando(false);
            editor.current?.enfocar();
          }}
        />
      )}
      {enAjustes && !bienvenida && (
        <ModalAjustes
          ajustes={ajustes}
          cambiar={cambiarAjustes}
          onNuevoHormiguero={() => setCavando(true)}
          onCerrar={() => {
            setEnAjustes(false);
            editor.current?.enfocar();
          }}
        />
      )}
      {bienvenida && (
        <Bienvenida
          idioma={idiomaDe(ajustes.idioma)}
          onCambiarIdioma={(idioma) => cambiarAjustes({ idioma })}
          onListo={abrirHormiguero}
          onCerrar={ajustes.hormigueros.length ? () => setVerBienvenida(false) : undefined}
        />
      )}
      {cavando && <NuevoHormiguero onListo={abrirHormiguero} onCerrar={() => setCavando(false)} />}
      <footer className="estado">
        <span>{sinGuardar ? `${nombre} *` : nombre}</span>
        {error ? (
          <span className="estado-error">{error}</span>
        ) : (
          <span>{tx.conteo(palabras, lineas, caracteres)}</span>
        )}
      </footer>
    </main>
  );
}

export default App;
