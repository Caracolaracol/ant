// Acceso a las notas en disco desde la interfaz: diálogos de abrir/guardar (plugin de Tauri)
// y los comandos Rust `read_note` / `write_note` definidos en `src-tauri/src/lib.rs`.

import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

/** Tipos de archivo que se ofrecen en los diálogos. */
const filtros = [{ name: "Notas", extensions: ["md", "markdown", "txt"] }];

/** Muestra el diálogo «Abrir» y devuelve la ruta elegida y su texto, o `null` si se canceló. */
export async function abrirNota(): Promise<{ ruta: string; texto: string } | null> {
  const ruta = await open({ multiple: false, directory: false, filters: filtros });
  if (typeof ruta !== "string") return null;
  const texto = await invoke<string>("read_note", { path: ruta });
  return { ruta, texto };
}

/** Muestra el diálogo «Guardar como» y devuelve la ruta elegida, o `null` si se canceló. */
export async function elegirRutaGuardado(sugerida?: string): Promise<string | null> {
  return save({ defaultPath: sugerida ?? "Nota.md", filters: filtros });
}

/** Escribe el texto en la ruta indicada. */
export async function guardarNota(ruta: string, texto: string): Promise<void> {
  await invoke("write_note", { path: ruta, contents: texto });
}

/** Devuelve solo el nombre del archivo de una ruta (sirve en macOS, Linux y Windows). */
export function nombreArchivo(ruta: string): string {
  return ruta.split(/[\\/]/).pop() ?? ruta;
}
