// Árbol de subcarpetas y notas de la cámara abierta, para la barra lateral y «Compilar y
// exportar». Se lee al cambiar de cámara y cada vez que la ventana recupera el foco, por si se
// crearon, borraron o movieron notas desde fuera de la app (Finder, Obsidian…). Rust lo lee fuera
// del hilo principal, así una cámara grande no traba la ventana. En la «Entrada» (`soloNotasSueltas`)
// son solo las notas sueltas de la raíz del hormiguero: sus carpetas son las otras cámaras.

import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { EntradaDelArbol, leerArbolDeCarpeta } from "../arbolDeCarpetas";

const ARBOL_VACIO: EntradaDelArbol[] = [];

/** Mantiene el árbol de la carpeta vigente a medida que se abre o se actualiza. */
export function useArbolDeLaCamara(
  carpetaDeLaCamara: string | null,
  soloNotasSueltas: boolean,
  mostrarError: (error: unknown) => void,
) {
  // Etiqueta cada lectura: mientras llega el árbol nuevo no se muestra el de la cámara anterior.
  const [arbolLeido, setArbolLeido] = useState<{ carpeta: string; soloLasSueltas: boolean; entradas: EntradaDelArbol[] } | null>(null);
  const arbolDeLaCamara = arbolLeido?.carpeta === carpetaDeLaCamara && arbolLeido.soloLasSueltas === soloNotasSueltas
    ? arbolLeido.entradas : ARBOL_VACIO;
  const carpetaVigente = useRef(carpetaDeLaCamara);
  carpetaVigente.current = carpetaDeLaCamara;
  const soloNotasSueltasVigente = useRef(soloNotasSueltas);
  soloNotasSueltasVigente.current = soloNotasSueltas;

  /** Vuelve a leer el árbol (tras crear una nota, o al volver a la ventana). */
  const releerArbolDeLaCamara = useCallback(() => {
    const carpeta = carpetaVigente.current;
    if (!carpeta) return setArbolLeido(null);
    const soloLasSueltas = soloNotasSueltasVigente.current;
    leerArbolDeCarpeta(carpeta, soloLasSueltas).then(
      (entradas) => {
        // Si mientras se leía se cambió de cámara, este árbol ya no sirve.
        if (carpetaVigente.current === carpeta && soloNotasSueltasVigente.current === soloLasSueltas) setArbolLeido({ carpeta, soloLasSueltas, entradas });
      },
      (error) => {
        if (carpetaVigente.current !== carpeta || soloNotasSueltasVigente.current !== soloLasSueltas) return;
        setArbolLeido(null);
        mostrarError(error);
      },
    );
  }, [mostrarError]);

  useEffect(releerArbolDeLaCamara, [carpetaDeLaCamara, soloNotasSueltas, releerArbolDeLaCamara]);
  useEffect(() => {
    const dejarDeEscuchar = getCurrentWindow().onFocusChanged(({ payload: laVentanaTieneElFoco }) => {
      if (laVentanaTieneElFoco) releerArbolDeLaCamara();
    });
    return () => void dejarDeEscuchar.then((dejar) => dejar());
  }, [releerArbolDeLaCamara]);

  return { arbolDeLaCamara, releerArbolDeLaCamara };
}
