// Hormigueros: cada uno es una carpeta del usuario con las notas de un proyecto (una novela, un
// diario, el trabajo). Puede tener todos los que quiera y pasar de uno a otro en Ajustes →
// General; la barra lateral muestra el abierto (`Ajustes.hormiguero_abierto`). La lista vive en
// `Ajustes.hormigueros`; quitar uno de la lista no borra su carpeta.

import { invoke } from "@tauri-apps/api/core";
import { documentDir, homeDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import type { Ajustes } from "../ajustes";

/** Crea la carpeta `nombreDelHormiguero` dentro de `carpetaDondeCrearla` (si no existe ya) y devuelve su ruta. */
export const crearCarpetaDeHormigueroNuevo = (carpetaDondeCrearla: string, nombreDelHormiguero: string) =>
  invoke<string>("crear_carpeta_de_hormiguero", { carpetaDondeCrearla, nombreDelHormiguero });

/** Dónde se propone crear un hormiguero nuevo: la carpeta Documentos (o la del usuario). */
export const carpetaDondeProponerCrearHormigueros = () => documentDir().catch(() => homeDir());

/** Muestra el diálogo del sistema para elegir una carpeta; devuelve su ruta o `null` si se canceló. */
export async function elegirCarpetaConElDialogo(carpetaInicial?: string | null): Promise<string | null> {
  const carpetaElegida = await open({ directory: true, multiple: false, defaultPath: carpetaInicial ?? undefined });
  return typeof carpetaElegida === "string" ? carpetaElegida : null;
}

/** Cambios de ajustes para abrir el hormiguero de `carpetaDelHormiguero`, sumándolo a la lista si es nuevo. */
export const cambiosParaAbrirHormiguero = (ajustes: Ajustes, carpetaDelHormiguero: string): Partial<Ajustes> => ({
  hormiguero_abierto: carpetaDelHormiguero,
  hormigueros: ajustes.hormigueros.includes(carpetaDelHormiguero) ? ajustes.hormigueros : [...ajustes.hormigueros, carpetaDelHormiguero],
});

/**
 * Cambios de ajustes para quitar un hormiguero de la lista (su carpeta queda en el disco). Si era
 * el abierto, se abre el primero que quede; sin ninguno, la app vuelve a la bienvenida.
 */
export function cambiosParaQuitarHormigueroDeLaLista(ajustes: Ajustes, carpetaDelHormiguero: string): Partial<Ajustes> {
  const hormiguerosQueQuedan = ajustes.hormigueros.filter((carpeta) => carpeta !== carpetaDelHormiguero);
  return {
    hormigueros: hormiguerosQueQuedan,
    hormiguero_abierto:
      ajustes.hormiguero_abierto === carpetaDelHormiguero ? (hormiguerosQueQuedan[0] ?? null) : ajustes.hormiguero_abierto,
  };
}
