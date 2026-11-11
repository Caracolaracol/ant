// Ventana principal: el editor a pantalla completa y una barra de estado abajo, como en Left.
// Lleva la nota abierta (ruta y si tiene cambios sin guardar) y los atajos de archivo:
// Cmd+N nueva, Cmd+O abrir, Cmd+S guardar, Cmd+Shift+S guardar como.

import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Editor, EditorHandle } from "./editor/Editor";
import { abrirNota, elegirRutaGuardado, guardarNota, nombreArchivo } from "./notas";
import "./App.css";

/** Cuenta palabras, líneas y caracteres del texto, para la barra de estado. */
function contar(texto: string) {
  const palabras = texto.trim() ? texto.trim().split(/\s+/).length : 0;
  return { palabras, lineas: texto.split("\n").length, caracteres: texto.length };
}

function App() {
  const editor = useRef<EditorHandle>(null);
  const [ruta, setRuta] = useState<string | null>(null);
  const [sucio, setSucio] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Cada cambio en el editor marca la nota como modificada y actualiza los contadores.
  const alCambiar = useCallback((t: string) => {
    setTexto(t);
    setSucio(true);
  }, []);

  /** Carga un texto en el editor como nota recién abierta (sin cambios pendientes). */
  const cargar = useCallback((nuevaRuta: string | null, t: string) => {
    editor.current?.setText(t);
    setRuta(nuevaRuta);
    setTexto(t);
    setSucio(false);
    editor.current?.focus();
  }, []);

  /** Guarda la nota; si todavía no tiene ruta, o se pide «guardar como», pregunta dónde. */
  const guardar = useCallback(
    async (como = false) => {
      let destino = ruta;
      if (!destino || como) destino = await elegirRutaGuardado(ruta ? nombreArchivo(ruta) : undefined);
      if (!destino) return;
      await guardarNota(destino, editor.current?.getText() ?? "");
      setRuta(destino);
      setSucio(false);
    },
    [ruta],
  );

  // Atajos de archivo. Los errores (permisos, disco lleno…) se muestran en la barra de estado.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const tecla = e.key.toLowerCase();
      let accion: (() => Promise<void>) | null = null;
      if (tecla === "s") accion = () => guardar(e.shiftKey);
      else if (tecla === "o") accion = async () => { const n = await abrirNota(); if (n) cargar(n.ruta, n.texto); };
      else if (tecla === "n") accion = async () => cargar(null, "");
      if (!accion) return;
      e.preventDefault();
      accion().then(() => setError(null), (err) => setError(String(err)));
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [guardar, cargar]);

  // El título de la ventana muestra la nota abierta y un punto si tiene cambios sin guardar.
  const nombre = ruta ? nombreArchivo(ruta) : "Sin título";
  useEffect(() => {
    getCurrentWindow().setTitle(`${sucio ? "• " : ""}${nombre}`).catch(() => {});
  }, [nombre, sucio]);

  const { palabras, lineas, caracteres } = contar(texto);

  return (
    <main className="app">
      <Editor ref={editor} onChange={alCambiar} />
      <footer className="estado">
        <span>{sucio ? `${nombre} *` : nombre}</span>
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
