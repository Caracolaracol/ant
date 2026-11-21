// Archivos de notas desde la interfaz: los diálogos del sistema para abrir y guardar (plugin de
// Tauri), leer y guardar notas con los comandos de Rust (`src-tauri/src/lib.rs`), guardar los
// archivos binarios de «Compilar y exportar» (Word, PDF), crear una nota nueva vacía y mostrar un
// archivo en su carpeta.

import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

/** Tipos de archivo que se ofrecen en los diálogos; `nombreDelFiltro` es «Notes» o «Notas» según el idioma. */
const filtrosDeNotas = (nombreDelFiltro: string) => [{ name: nombreDelFiltro, extensions: ["md", "markdown", "txt"] }];

/** Muestra el diálogo «Abrir» (empezando en `carpetaInicial`, si hay) y devuelve la ruta elegida, o `null`. */
export async function elegirNotaConElDialogo(carpetaInicial: string | null, nombreDelFiltro: string): Promise<string | null> {
  const rutaElegida = await open({
    multiple: false,
    directory: false,
    filters: filtrosDeNotas(nombreDelFiltro),
    defaultPath: carpetaInicial ?? undefined,
  });
  return typeof rutaElegida === "string" ? rutaElegida : null;
}

/** Muestra el diálogo «Guardar como» con `rutaPropuesta` como ruta inicial y devuelve la elegida, o `null`. */
export const elegirDondeGuardarConElDialogo = (rutaPropuesta: string, nombreDelFiltro: string): Promise<string | null> =>
  save({ defaultPath: rutaPropuesta, filters: filtrosDeNotas(nombreDelFiltro) });

/** Lee el texto de una nota. */
/**
 * Crea una nota vacía `nombreDeLaNota` (con `.md` si no trae extensión) en la carpeta y devuelve
 * su ruta (`crear_nota_nueva`, en `src-tauri/src/carpeta.rs`). Falla si ya hay una con ese nombre.
 */
export const crearNotaNueva = (carpetaDondeCrearla: string, nombreDeLaNota: string) =>
  invoke<string>("crear_nota_nueva", { carpetaDondeCrearla, nombreDeLaNota });

export const leerNotaDelDisco = (rutaDelArchivo: string) => invoke<string>("leer_nota_del_disco", { rutaDelArchivo });

/** Guarda el texto de una nota (Rust escribe un archivo temporal y lo renombra: nunca queda a medias). */
export async function guardarNotaEnElDisco(rutaDelArchivo: string, textoDeLaNota: string): Promise<void> {
  await invoke("guardar_nota_en_el_disco", { rutaDelArchivo, textoDeLaNota });
}

/**
 * Guarda bytes en `rutaDelArchivo` (el Word o PDF de «Compilar y exportar»). Los bytes van crudos
 * en el cuerpo de la llamada y la ruta, codificada, en un encabezado (ver
 * `guardar_archivo_binario` en Rust).
 */
export async function guardarArchivoBinarioEnElDisco(rutaDelArchivo: string, bytesDelArchivo: Uint8Array): Promise<void> {
  await invoke("guardar_archivo_binario", bytesDelArchivo, { headers: { ruta: encodeURIComponent(rutaDelArchivo) } });
}

/** Muestra el archivo en el Finder (o el explorador de archivos del sistema). */
export const mostrarArchivoEnSuCarpeta = (rutaDelArchivo: string) =>
  invoke<void>("mostrar_archivo_en_su_carpeta", { rutaDelArchivo });

/** Devuelve solo el nombre del archivo (o carpeta) de una ruta; sirve en macOS, Linux y Windows. */
export function nombreDelArchivo(ruta: string): string {
  return ruta.split(/[\\/]/).filter(Boolean).pop() ?? ruta;
}
