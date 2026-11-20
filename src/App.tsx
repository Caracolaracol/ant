// Ventana principal: barra lateral con los fijados, la carpeta de trabajo y los títulos de la nota visible,
// el editor y una barra de estado abajo, como en Left. Lleva la lista de notas abiertas (ruta,
// texto y si tienen cambios sin guardar), cuál está visible, los ajustes (carpeta de trabajo y fijados)
// el modo diario (calendario → nota del día) y los atajos de teclado:
//   Cmd+N nueva · Cmd+O abrir · Cmd+S guardar · Cmd+Shift+S guardar como
//   Cmd+Shift+] / Cmd+Shift+[ nota siguiente / anterior · Cmd+\ mostrar u ocultar la barra lateral
// Cmd+, (Ajustes) y Cmd+Shift+E (Compilar y exportar) los maneja el menú de la app, en Rust; el
// segundo avisa con el evento `abrir-compilar` y aquí se abre el diálogo.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { Editor, EditorHandle } from "./editor/Editor";
import { ANCHO_BARRA, BarraLateral, NotaResumen } from "./BarraLateral";
import { AJUSTES_INICIALES, Ajustes, escucharAjustes, guardarAjustes, leerAjustes } from "./ajustes";
import { Entrada, abrirAjustes, listarCarpeta } from "./carpeta";
import { abrirDia } from "./diario";
import { configEscritor } from "./editor/escritor";
import { Compilar } from "./compilar/Compilar";
import { idiomaDe, useTextos } from "./idioma";
import { extraerMarcadores, marcadorActual } from "./marcadores";
import { elegirNota, elegirRutaGuardado, guardarNota, leerNota, nombreArchivo } from "./notas";
import "./App.css";

/** Cuenta palabras, líneas y caracteres del texto, para la barra de estado. */
function contar(texto: string) {
  const palabras = texto.trim() ? texto.trim().split(/\s+/).length : 0;
  return { palabras, lineas: texto.split("\n").length, caracteres: texto.length };
}

/** Genera un identificador único para una nota abierta (no depende de su ruta, que puede cambiar). */
let contador = 0;
const nuevoId = () => `nota-${++contador}`;

/** Nota vacía y sin ruta, la que se crea con Cmd+N o al cerrar la última. */
const notaVacia = (): NotaResumen => ({ id: nuevoId(), ruta: null, texto: "", sucio: false });

/** Une una carpeta y un nombre de archivo con el separador que use la carpeta. */
const unir = (carpeta: string, nombre: string) =>
  `${carpeta.replace(/[\\/]+$/, "")}${carpeta.includes("\\") ? "\\" : "/"}${nombre}`;

function App() {
  const editor = useRef<EditorHandle>(null);
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
  const [ajustes, setAjustes] = useState<Ajustes>(AJUSTES_INICIALES);
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

  // Carga los ajustes (carpeta de trabajo y fijados) al iniciar y los actualiza cuando cambian
  // en cualquier ventana.
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

  // Diálogo «Compilar y exportar»: lo abre el menú (File → Compile and Export…).
  const [compilando, setCompilando] = useState(false);
  useEffect(() => {
    const dejar = listen("abrir-compilar", () => setCompilando(true));
    return () => void dejar.then((f) => f());
  }, []);

  /** Texto de una nota abierta, con sus cambios sin guardar (para compilarla tal como se ve). */
  const textoAbierto = useCallback((ruta: string) => {
    const nota = notasRef.current.find((n) => n.ruta === ruta);
    return nota ? editor.current?.getText(nota.id) : undefined;
  }, []);

  /** Vuelve a leer el árbol de la carpeta de trabajo (tras guardar, o al volver a la ventana). */
  const refrescarArbol = useCallback(() => {
    const dir = carpetaRef.current;
    if (!dir) return setArbol([]);
    listarCarpeta(dir).then(setArbol, (e) => {
      setArbol([]);
      fallo(e);
    });
  }, [fallo]);

  // Lee el árbol cuando cambia la carpeta y cada vez que la ventana recupera el foco, por si se
  // crearon, borraron o movieron notas desde fuera de la app (Finder, Obsidian, etc.).
  useEffect(refrescarArbol, [carpeta, refrescarArbol]);
  useEffect(() => {
    const dejar = getCurrentWindow().onFocusChanged(({ payload: enfocada }) => enfocada && refrescarArbol());
    return () => void dejar.then((f) => f());
  }, [refrescarArbol]);

  // Al cambiar la nota activa, el editor muestra su estado (o la crea con su texto la primera vez).
  useEffect(() => {
    const nota = notasRef.current.find((n) => n.id === activa);
    if (nota) editor.current?.mostrar(nota.id, nota.texto);
  }, [activa]);

  /** Cambia los datos de una nota abierta. */
  const actualizar = useCallback((id: string, cambios: Partial<NotaResumen>) => {
    setNotas((ns) => ns.map((n) => (n.id === id ? { ...n, ...cambios } : n)));
  }, []);

  // Cada cambio en el editor actualiza el texto de la nota activa y la marca como modificada.
  const alCambiar = useCallback((t: string) => actualizar(activaRef.current, { texto: t, sucio: true }), [actualizar]);

  /** Agrega una nota a la lista y la deja visible. */
  const agregar = useCallback((nota: NotaResumen) => {
    setNotas((ns) => [...ns, nota]);
    setActiva(nota.id);
  }, []);

  /**
   * Abre la nota de `ruta`; si ya estaba abierta, solo la muestra.
   * Si la única nota abierta es una vacía sin guardar, la reemplaza en vez de acumularla.
   */
  const abrirRuta = useCallback(async (ruta: string) => {
    const ya = notasRef.current.find((n) => n.ruta === ruta);
    if (ya) return setActiva(ya.id);
    const nota = { id: nuevoId(), ruta, texto: await leerNota(ruta), sucio: false };
    const [unica] = notasRef.current;
    if (notasRef.current.length === 1 && !unica.ruta && !unica.texto) {
      editor.current?.olvidar(unica.id);
      setNotas([nota]);
      setActiva(nota.id);
    } else agregar(nota);
  }, [agregar]);

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

  /** Muestra el diálogo «Abrir» (empezando en la carpeta de trabajo) y abre la nota elegida. */
  const abrir = useCallback(async () => {
    const ruta = await elegirNota(carpetaRef.current, txRef.current.filtroNotas);
    if (ruta) await abrirRuta(ruta);
  }, [abrirRuta]);

  /**
   * Guarda la nota activa; si todavía no tiene ruta, o se pide «guardar como», pregunta dónde,
   * proponiendo la carpeta de trabajo. Después refresca el árbol para que aparezca la nota nueva.
   */
  const guardar = useCallback(async (como = false) => {
    const nota = notasRef.current.find((n) => n.id === activaRef.current);
    if (!nota) return;
    let destino = nota.ruta;
    if (!destino || como) {
      const nombre = nota.ruta ? nombreArchivo(nota.ruta) : txRef.current.notaNueva;
      destino = await elegirRutaGuardado(carpetaRef.current ? unir(carpetaRef.current, nombre) : nombre, txRef.current.filtroNotas);
    }
    if (!destino) return;
    await guardarNota(destino, editor.current?.getText(nota.id) ?? "");
    actualizar(nota.id, { ruta: destino, sucio: false });
    refrescarArbol();
  }, [actualizar, refrescarArbol]);

  /** Cierra una nota (preguntando si tiene cambios sin guardar) y muestra la vecina. */
  const cerrar = useCallback(async (id: string) => {
    const lista = notasRef.current;
    const i = lista.findIndex((n) => n.id === id);
    const nota = lista[i];
    if (!nota) return;
    if (nota.sucio) {
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
    editor.current?.olvidar(id);
    const resto = lista.filter((n) => n.id !== id);
    // Nunca queda la ventana vacía: si se cerró la última nota, se abre una en blanco.
    if (resto.length === 0) resto.push(notaVacia());
    setNotas(resto);
    if (id === activaRef.current) setActiva(resto[Math.min(i, resto.length - 1)].id);
  }, []);

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
      else if (tecla === "n") accion = () => agregar(notaVacia());
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
  }, [guardar, abrir, agregar, moverse, fallo]);

  const nota = notas.find((n) => n.id === activa) ?? notas[0];
  const nombre = nota.ruta ? nombreArchivo(nota.ruta) : tx.sinTitulo;

  // El título de la ventana (visible en Mission Control y el Dock) muestra la nota y si tiene cambios.
  useEffect(() => {
    getCurrentWindow().setTitle(`${nota.sucio ? "• " : ""}${nombre}`).catch(() => {});
  }, [nombre, nota.sucio]);

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
            diario={ajustes.diario}
            ancho={ajustes.ancho_barra ?? ANCHO_BARRA}
            onCambiarAncho={cambiarAnchoBarra}
            onAbrirDia={(fecha) => abrirDiaElegido(fecha).then(() => setError(null), fallo)}
            onFijar={(ruta) => cambiarFijados((f) => (f.includes(ruta) ? f : [...f, ruta]))}
            onDesfijar={(ruta) => cambiarFijados((f) => f.filter((r) => r !== ruta))}
            notas={notas}
            activa={activa}
            marcadores={marcadores}
            tituloActual={marcadorActual(marcadores, cursor.current)}
            onElegir={setActiva}
            onAbrirRuta={(ruta) => abrirRuta(ruta).then(() => setError(null), fallo)}
            onCerrar={(id) => cerrar(id).catch(fallo)}
            onSaltar={(pos) => editor.current?.irA(pos)}
            onAbrirAjustes={() => abrirAjustes().catch(fallo)}
          />
        )}
        <Editor ref={editor} onChange={alCambiar} onCursor={alMoverCursor} escritor={escritor} />
      </div>
      {compilando && (
        <Compilar
          carpeta={carpeta}
          arbol={arbol}
          rutaActiva={nota.ruta}
          ajustes={ajustes}
          textoAbierto={textoAbierto}
          onGuardarAjustes={cambiarAjustes}
          onCerrar={() => {
            setCompilando(false);
            editor.current?.focus();
          }}
        />
      )}
      <footer className="estado">
        <span>{nota.sucio ? `${nombre} *` : nombre}</span>
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
