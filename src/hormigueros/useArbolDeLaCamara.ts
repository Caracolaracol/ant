// Árbol de subcarpetas y notas de la cámara abierta, para la barra lateral y «Compilar y
// exportar». Se lee al cambiar de cámara y cada vez que la ventana recupera el foco, por si se
// crearon, borraron o movieron notas desde fuera de la app (Finder, Obsidian…). Rust lo lee fuera
// del hilo principal, así una cámara grande no traba la ventana.

import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { EntradaDelArbol, leerArbolDeCarpeta } from "../arbolDeCarpetas";

export function useArbolDeLaCamara(carpetaDeLaCamara: string | null, mostrarError: (error: unknown) => void) {
  const [arbolDeLaCamara, setArbolDeLaCamara] = useState<EntradaDelArbol[]>([]);
  const carpetaVigente = useRef(carpetaDeLaCamara);
  carpetaVigente.current = carpetaDeLaCamara;

  /** Vuelve a leer el árbol (tras crear una nota, o al volver a la ventana). */
  const releerArbolDeLaCamara = useCallback(() => {
    const carpeta = carpetaVigente.current;
    if (!carpeta) return setArbolDeLaCamara([]);
    leerArbolDeCarpeta(carpeta).then(
      (arbolLeido) => {
        // Si mientras se leía se cambió de cámara, este árbol ya no sirve.
        if (carpetaVigente.current === carpeta) setArbolDeLaCamara(arbolLeido);
      },
      (error) => {
        setArbolDeLaCamara([]);
        mostrarError(error);
      },
    );
  }, [mostrarError]);

  useEffect(releerArbolDeLaCamara, [carpetaDeLaCamara, releerArbolDeLaCamara]);
  useEffect(() => {
    const dejarDeEscuchar = getCurrentWindow().onFocusChanged(({ payload: laVentanaTieneElFoco }) => {
      if (laVentanaTieneElFoco) releerArbolDeLaCamara();
    });
    return () => void dejarDeEscuchar.then((dejar) => dejar());
  }, [releerArbolDeLaCamara]);

  return { arbolDeLaCamara, releerArbolDeLaCamara };
}
