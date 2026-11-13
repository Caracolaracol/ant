// Ventana principal: barra lateral con los fijados, la carpeta de trabajo y los títulos de la nota visible,
// el editor y una barra de estado abajo, como en Left. Lleva la lista de notas abiertas (ruta,
// texto y si tienen cambios sin guardar), cuál está visible, los ajustes (carpeta de trabajo y fijados)
// y los atajos de teclado:
//   Cmd+N nueva · Cmd+O abrir · Cmd+S guardar · Cmd+Shift+S guardar como
//   Cmd+Shift+] / Cmd+Shift+[ nota siguiente / anterior · Cmd+\ mostrar u ocultar la barra lateral
// Cmd+, (Ajustes) lo maneja el menú de la app, en Rust.

import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import { Editor, EditorHandle } from "./editor/Editor";
import { BarraLateral, NotaResumen } from "./BarraLateral";
import { Ajustes, escucharAjustes, guardarAjustes, leerAjustes } from "./ajustes";
import { Entrada, abrirAjustes, listarCarpeta } from "./carpeta";
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
  const [notas, setNotas] = useState<NotaResumen[]>(() => [notaVacia()]);
  const [activa, setActiva] = useState(() => notas[0].id);
  const [cursor, setCursor] = useState(0);
  const [barraVisible, setBarraVisible] = useState(true);
  const [ajustes, setAjustes] = useState<Ajustes>({ carpeta: null, fijados: [] });
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

  /** Muestra el diálogo «Abrir» (empezando en la carpeta de trabajo) y abre la nota elegida. */
  const abrir = useCallback(async () => {
    const ruta = await elegirNota(carpetaRef.current);
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
      const nombre = nota.ruta ? nombreArchivo(nota.ruta) : "Nota.md";
      destino = await elegirRutaGuardado(carpetaRef.current ? unir(carpetaRef.current, nombre) : nombre);
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
      const nombre = nota.ruta ? nombreArchivo(nota.ruta) : "Sin título";
      const descartar = await ask(`«${nombre}» tiene cambios sin guardar. ¿Cerrarla igual?`, {
        title: "Cerrar nota",
        kind: "warning",
        okLabel: "Descartar cambios",
        cancelLabel: "Cancelar",
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
  const nombre = nota.ruta ? nombreArchivo(nota.ruta) : "Sin título";

  // El título de la ventana (visible en Mission Control y el Dock) muestra la nota y si tiene cambios.
  useEffect(() => {
    getCurrentWindow().setTitle(`${nota.sucio ? "• " : ""}${nombre}`).catch(() => {});
  }, [nombre, nota.sucio]);

  const { palabras, lineas, caracteres } = contar(nota.texto);

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
            onFijar={(ruta) => cambiarFijados((f) => (f.includes(ruta) ? f : [...f, ruta]))}
            onDesfijar={(ruta) => cambiarFijados((f) => f.filter((r) => r !== ruta))}
            notas={notas}
            activa={activa}
            cursor={cursor}
            onElegir={setActiva}
            onAbrirRuta={(ruta) => abrirRuta(ruta).then(() => setError(null), fallo)}
            onCerrar={(id) => cerrar(id).catch(fallo)}
            onSaltar={(pos) => editor.current?.irA(pos)}
            onAbrirAjustes={() => abrirAjustes().catch(fallo)}
          />
        )}
        <Editor ref={editor} onChange={alCambiar} onCursor={setCursor} />
      </div>
      <footer className="estado">
        <span>{nota.sucio ? `${nombre} *` : nombre}</span>
        {error ? (
          <span className="estado-error">{error}</span>
        ) : (
          <span>{palabras} palabras · {lineas} líneas · {caracteres} caracteres</span>
        )}
      </footer>
    </main>
  );
}

export default App;
