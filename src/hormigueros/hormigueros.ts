// Hormigueros: cada uno es una carpeta del usuario con las notas de un proyecto (una novela, un
// diario, el trabajo). Puede tener todos los que quiera y pasar de uno a otro en Ajustes →
// General; la barra lateral muestra el abierto (`Ajustes.carpeta`). La lista vive en
// `Ajustes.hormigueros`; quitar uno de la lista no borra su carpeta.

import { invoke } from "@tauri-apps/api/core";
import { documentDir, homeDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import type { Ajustes } from "../ajustes";

/** Crea la carpeta `nombre` dentro de `padre` (si no existe ya) y devuelve su ruta. */
export const crearCarpetaHormiguero = (padre: string, nombre: string) =>
  invoke<string>("crear_hormiguero", { padre, nombre });

/** Dónde se propone crear un hormiguero nuevo: la carpeta Documentos (o la del usuario). */
export const carpetaPorDefecto = () => documentDir().catch(() => homeDir());

/** Muestra el diálogo del sistema para elegir una carpeta; devuelve su ruta o `null` si se canceló. */
export async function elegirCarpeta(desde?: string | null): Promise<string | null> {
  const ruta = await open({ directory: true, multiple: false, defaultPath: desde ?? undefined });
  return typeof ruta === "string" ? ruta : null;
}

/** Cambios de ajustes para abrir el hormiguero `ruta`, sumándolo a la lista si es nuevo. */
export const conHormiguero = (a: Ajustes, ruta: string): Partial<Ajustes> => ({
  carpeta: ruta,
  hormigueros: a.hormigueros.includes(ruta) ? a.hormigueros : [...a.hormigueros, ruta],
});

/**
 * Cambios de ajustes para quitar `ruta` de la lista (la carpeta queda en el disco). Si era el
 * abierto, se abre el primero que quede; sin ninguno, la app vuelve a la bienvenida.
 */
export function sinHormiguero(a: Ajustes, ruta: string): Partial<Ajustes> {
  const resto = a.hormigueros.filter((r) => r !== ruta);
  return { hormigueros: resto, carpeta: a.carpeta === ruta ? (resto[0] ?? null) : a.carpeta };
}
