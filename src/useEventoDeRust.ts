// Escucha un evento que manda Rust a la ventana (los ítems del menú, `antes-de-salir`) mientras
// el componente que lo usa está montado. Los nombres de los eventos están en `EVENTOS_DE_RUST`,
// iguales a los de `src-tauri/src/menu.rs` y `lib.rs`.

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

/** Eventos que Rust manda a la ventana principal. */
export const EVENTOS_DE_RUST = {
  abrirAjustes: "abrir-ajustes",
  abrirBienvenida: "abrir-bienvenida",
  cavarHormigueroNuevo: "nuevo-hormiguero",
  abrirCompilar: "abrir-compilar",
  antesDeSalir: "antes-de-salir",
} as const;

export type EventoDeRust = (typeof EVENTOS_DE_RUST)[keyof typeof EVENTOS_DE_RUST];

/** Llama a `alRecibirElEvento` cada vez que llega `nombreDelEvento`. Conviene pasarle un callback estable (`useCallback`). */
export function useEventoDeRust(nombreDelEvento: EventoDeRust, alRecibirElEvento: () => void) {
  useEffect(() => {
    const dejarDeEscuchar = listen(nombreDelEvento, alRecibirElEvento);
    return () => void dejarDeEscuchar.then((dejar) => dejar());
  }, [nombreDelEvento, alRecibirElEvento]);
}
