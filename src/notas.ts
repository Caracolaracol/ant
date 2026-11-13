// Acceso a las notas en disco desde la interfaz: diálogos de abrir/guardar (plugin de Tauri)
// y los comandos Rust `read_note` / `write_note` definidos en `src-tauri/src/lib.rs`.

import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

/** Tipos de archivo que se ofrecen en los diálogos. */
const filtros = [{ name: "Notas", extensions: ["md", "markdown", "txt"] }];

/** Muestra el diálogo «Abrir» (empezando en `carpeta`, si hay) y devuelve la ruta elegida, o `null`. */
export async function elegirNota(carpeta?: string | null): Promise<string | null> {
  const ruta = await open({ multiple: false, directory: false, filters: filtros, defaultPath: carpeta ?? undefined });
  return typeof ruta === "string" ? ruta : null;
}

/** Lee el texto de una nota. */
export const leerNota = (ruta: string) => invoke<string>("read_note", { path: ruta });

/** Muestra el diálogo «Guardar como» con `sugerida` como ruta inicial y devuelve la elegida, o `null`. */
export async function elegirRutaGuardado(sugerida: string): Promise<string | null> {
  return save({ defaultPath: sugerida, filters: filtros });
}

/** Escribe el texto en la ruta indicada. */
export async function guardarNota(ruta: string, texto: string): Promise<void> {
  await invoke("write_note", { path: ruta, contents: texto });
}

/** Devuelve solo el nombre del archivo de una ruta (sirve en macOS, Linux y Windows). */
export function nombreArchivo(ruta: string): string {
  return ruta.split(/[\\/]/).filter(Boolean).pop() ?? ruta;
}
