// Ventana principal: barra lateral con las notas abiertas y sus títulos, el editor y una barra
// de estado abajo, como en Left. Lleva la lista de notas abiertas (ruta, texto y si tienen
// cambios sin guardar), cuál está visible, y los atajos de teclado:
//   Cmd+N nueva · Cmd+O abrir · Cmd+S guardar · Cmd+Shift+S guardar como
//   Cmd+Shift+] / Cmd+Shift+[ nota siguiente / anterior · Cmd+\ mostrar u ocultar la barra lateral

import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import { Editor, EditorHandle } from "./editor/Editor";
import { BarraLateral, NotaResumen } from "./BarraLateral";
import { abrirNota, elegirRutaGuardado, guardarNota, nombreArchivo } from "./notas";
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

function App() {
  const editor = useRef<EditorHandle>(null);
  const [notas, setNotas] = useState<NotaResumen[]>(() => [notaVacia()]);
  const [activa, setActiva] = useState(() => notas[0].id);
  const [cursor, setCursor] = useState(0);
  const [barraVisible, setBarraVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Copias en refs para que los atajos y callbacks lean siempre el valor más reciente.
  const notasRef = useRef(notas);
  notasRef.current = notas;
  const activaRef = useRef(activa);
  activaRef.current = activa;

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

  /** Abre un archivo; si ya estaba abierto, solo lo muestra. Si la única nota es una vacía, la reemplaza. */
  const abrir = useCallback(async () => {
    const archivo = await abrirNota();
    if (!archivo) return;
    const ya = notasRef.current.find((n) => n.ruta === archivo.ruta);
    if (ya) return setActiva(ya.id);
    const nota = { id: nuevoId(), ruta: archivo.ruta, texto: archivo.texto, sucio: false };
    const [unica] = notasRef.current;
    if (notasRef.current.length === 1 && !unica.ruta && !unica.texto) {
      editor.current?.olvidar(unica.id);
      setNotas([nota]);
      setActiva(nota.id);
    } else agregar(nota);
  }, [agregar]);

  /** Guarda la nota activa; si todavía no tiene ruta, o se pide «guardar como», pregunta dónde. */
  const guardar = useCallback(async (como = false) => {
    const nota = notasRef.current.find((n) => n.id === activaRef.current);
    if (!nota) return;
    let destino = nota.ruta;
    if (!destino || como) destino = await elegirRutaGuardado(nota.ruta ? nombreArchivo(nota.ruta) : undefined);
    if (!destino) return;
    await guardarNota(destino, editor.current?.getText(nota.id) ?? "");
    actualizar(nota.id, { ruta: destino, sucio: false });
  }, [actualizar]);

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
      Promise.resolve(accion()).then(() => setError(null), (err) => setError(String(err)));
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [guardar, abrir, agregar, moverse]);

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
            notas={notas}
            activa={activa}
            cursor={cursor}
            onElegir={setActiva}
            onCerrar={(id) => cerrar(id).catch((err) => setError(String(err)))}
            onSaltar={(pos) => editor.current?.irA(pos)}
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
