// Árbol de subcarpetas y notas del hormiguero abierto, para la barra lateral y «Compilar y
// exportar». Se lee al cambiar de hormiguero y cada vez que la ventana recupera el foco, por si se
// crearon, borraron o movieron notas desde fuera de la app (Finder, Obsidian…). Rust lo lee fuera
// del hilo principal, así un hormiguero grande no traba la ventana.

import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Entrada, listarCarpeta } from "../carpeta";

export function useArbolDelHormiguero(carpetaDelHormiguero: string | null, mostrarError: (error: unknown) => void) {
  const [arbolDelHormiguero, setArbolDelHormiguero] = useState<Entrada[]>([]);
  const carpetaVigente = useRef(carpetaDelHormiguero);
  carpetaVigente.current = carpetaDelHormiguero;

  /** Vuelve a leer el árbol (tras crear una nota, o al volver a la ventana). */
  const releerArbolDelHormiguero = useCallback(() => {
    const carpeta = carpetaVigente.current;
    if (!carpeta) return setArbolDelHormiguero([]);
    listarCarpeta(carpeta).then(
      (arbolLeido) => {
        // Si mientras se leía se cambió de hormiguero, este árbol ya no sirve.
        if (carpetaVigente.current === carpeta) setArbolDelHormiguero(arbolLeido);
      },
      (error) => {
        setArbolDelHormiguero([]);
        mostrarError(error);
      },
    );
  }, [mostrarError]);

  useEffect(releerArbolDelHormiguero, [carpetaDelHormiguero, releerArbolDelHormiguero]);
  useEffect(() => {
    const dejarDeEscuchar = getCurrentWindow().onFocusChanged(({ payload: laVentanaTieneElFoco }) => {
      if (laVentanaTieneElFoco) releerArbolDelHormiguero();
    });
    return () => void dejarDeEscuchar.then((dejar) => dejar());
  }, [releerArbolDelHormiguero]);

  return { arbolDelHormiguero, releerArbolDelHormiguero };
}
