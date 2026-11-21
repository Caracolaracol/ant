// Los ajustes de la app dentro de la interfaz: el estado vigente, cambiarlos (se aplican al
// instante y se guardan) y escuchar cuando se guardan. Los guarda y lee Rust
// (`src-tauri/src/ajustes.rs`); el formato está en `ajustes.ts`.

import { useCallback, useEffect, useRef, useState } from "react";
import { Ajustes, escucharCambiosDeAjustes, guardarAjustesEnDisco, leerAjustesGuardados } from "../ajustes";

/**
 * `ajustesIniciales` ya vienen leídos de `main.tsx`: así la bienvenida o el tema por defecto no
 * aparecen un instante antes de tiempo. `mostrarError` recibe los errores al guardar.
 */
export function useAjustesGuardados(ajustesIniciales: Ajustes, mostrarError: (error: unknown) => void) {
  const [ajustes, setAjustes] = useState<Ajustes>(ajustesIniciales);
  // Copia en una ref para que los callbacks, que no se vuelven a crear, lean siempre lo último.
  const ajustesVigentes = useRef(ajustes);
  ajustesVigentes.current = ajustes;

  // Vuelve a leer los ajustes al iniciar y los pone al día cada vez que se guardan.
  useEffect(() => {
    leerAjustesGuardados().then(setAjustes, mostrarError);
    const dejarDeEscuchar = escucharCambiosDeAjustes(setAjustes);
    return () => void dejarDeEscuchar.then((dejar) => dejar());
  }, [mostrarError]);

  /** Cambia algunos ajustes: se aplican al instante y se guardan. */
  const cambiarAjustes = useCallback((cambios: Partial<Ajustes>) => {
    const ajustesNuevos = { ...ajustesVigentes.current, ...cambios };
    ajustesVigentes.current = ajustesNuevos;
    setAjustes(ajustesNuevos);
    guardarAjustesEnDisco(ajustesNuevos).catch(mostrarError);
  }, [mostrarError]);

  return { ajustes, ajustesVigentes, cambiarAjustes };
}
