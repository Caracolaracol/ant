// Acceso a los ajustes de la app desde cualquier ventana. Los guarda y lee el lado Rust
// (`src-tauri/src/ajustes.rs`), que además avisa a todas las ventanas cuando cambian.

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

/** Preferencias del usuario. Debe coincidir con la estructura `Ajustes` de Rust. */
export interface Ajustes {
  /** Carpeta de trabajo que muestra la barra lateral, o `null` si aún no se eligió. */
  carpeta: string | null;
}

/** Lee los ajustes guardados (o los valores por defecto si no hay). */
export const leerAjustes = () => invoke<Ajustes>("leer_ajustes");

/** Guarda los ajustes; Rust emite `ajustes-cambiados` a todas las ventanas. */
export const guardarAjustes = (ajustes: Ajustes) => invoke<void>("guardar_ajustes", { ajustes });

/** Llama a `alCambiar` cada vez que alguna ventana guarda ajustes. Devuelve la función para dejar de escuchar. */
export const escucharAjustes = (alCambiar: (a: Ajustes) => void): Promise<UnlistenFn> =>
  listen<Ajustes>("ajustes-cambiados", (e) => alCambiar(e.payload));
