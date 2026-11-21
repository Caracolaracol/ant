// Las cámaras del hormiguero (sus carpetas de primer nivel), para la bienvenida, Ajustes y saber
// si la cámara abierta sigue existiendo. Se leen al cambiar de hormiguero y cada vez que la ventana
// recupera el foco, por si se creó, borró o renombró una carpeta desde fuera de la app.

import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listarCamarasDelHormiguero } from "./hormigueros";

/**
 * Devuelve `camarasDelHormiguero` (`null` mientras no se leyeron, `[]` si no hay hormiguero o no se
 * pudo leer) y `releerCamarasDelHormiguero`, que termina cuando la lista ya está al día (por
 * ejemplo, para abrir una cámara recién cavada sabiendo que ya aparece).
 */
export function useCamarasDelHormiguero(carpetaDelHormiguero: string | null) {
  const [camarasDelHormiguero, setCamarasDelHormiguero] = useState<string[] | null>(null);
  const carpetaVigente = useRef(carpetaDelHormiguero);
  carpetaVigente.current = carpetaDelHormiguero;

  const releerCamarasDelHormiguero = useCallback(async () => {
    const carpeta = carpetaVigente.current;
    if (!carpeta) return setCamarasDelHormiguero([]);
    const camarasLeidas = await listarCamarasDelHormiguero(carpeta).catch(() => []);
    // Si mientras se leía se cambió de hormiguero, esta lista ya no sirve.
    if (carpetaVigente.current === carpeta) setCamarasDelHormiguero(camarasLeidas);
  }, []);

  useEffect(() => {
    setCamarasDelHormiguero(null);
    releerCamarasDelHormiguero();
  }, [carpetaDelHormiguero, releerCamarasDelHormiguero]);
  useEffect(() => {
    const dejarDeEscuchar = getCurrentWindow().onFocusChanged(({ payload: laVentanaTieneElFoco }) => {
      if (laVentanaTieneElFoco) releerCamarasDelHormiguero();
    });
    return () => void dejarDeEscuchar.then((dejar) => dejar());
  }, [releerCamarasDelHormiguero]);

  return { camarasDelHormiguero, releerCamarasDelHormiguero };
}
