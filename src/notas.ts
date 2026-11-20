// Acceso a las notas en disco desde la interfaz: diálogos de abrir/guardar (plugin de Tauri),
// los comandos Rust `read_note` / `write_note` definidos en `src-tauri/src/lib.rs` y el guardado
// de archivos binarios (Word, PDF) de «Compilar y exportar».

import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

/** Tipos de archivo que se ofrecen en los diálogos; `nombre` es «Notes» o «Notas» según el idioma. */
const filtros = (nombre: string) => [{ name: nombre, extensions: ["md", "markdown", "txt"] }];

/** Muestra el diálogo «Abrir» (empezando en `carpeta`, si hay) y devuelve la ruta elegida, o `null`. */
export async function elegirNota(carpeta: string | null, nombreFiltro: string): Promise<string | null> {
  const ruta = await open({ multiple: false, directory: false, filters: filtros(nombreFiltro), defaultPath: carpeta ?? undefined });
  return typeof ruta === "string" ? ruta : null;
}

/** Lee el texto de una nota. */
export const leerNota = (ruta: string) => invoke<string>("read_note", { path: ruta });

/** Muestra el diálogo «Guardar como» con `sugerida` como ruta inicial y devuelve la elegida, o `null`. */
export async function elegirRutaGuardado(sugerida: string, nombreFiltro: string): Promise<string | null> {
  return save({ defaultPath: sugerida, filters: filtros(nombreFiltro) });
}

/** Escribe el texto en la ruta indicada. */
export async function guardarNota(ruta: string, texto: string): Promise<void> {
  await invoke("write_note", { path: ruta, contents: texto });
}

/**
 * Guarda bytes en `ruta` (el Word o PDF de «Compilar y exportar»). Los bytes van crudos en el
 * cuerpo de la llamada y la ruta, codificada, en un encabezado (ver `guardar_binario` en Rust).
 */
export async function guardarBinario(ruta: string, datos: Uint8Array): Promise<void> {
  await invoke("guardar_binario", datos, { headers: { ruta: encodeURIComponent(ruta) } });
}

/** Muestra el archivo en el Finder (o el explorador de archivos del sistema). */
export const mostrarEnCarpeta = (ruta: string) => invoke<void>("mostrar_en_carpeta", { ruta });

/** Devuelve solo el nombre del archivo de una ruta (sirve en macOS, Linux y Windows). */
export function nombreArchivo(ruta: string): string {
  return ruta.split(/[\\/]/).filter(Boolean).pop() ?? ruta;
}
