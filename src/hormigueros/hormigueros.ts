// El hormiguero y sus cámaras. El hormiguero es una sola carpeta con todas las notas del usuario
// (lo que en Obsidian es la bóveda), en `Ajustes.hormiguero`. Sus carpetas de primer nivel son las
// cámaras: cada una un contexto (las notas personales, todo lo de una novela, el trabajo y sus
// proyectos). La barra lateral muestra una cámara a la vez (`Ajustes.camara_abierta`, guardada por
// nombre y no por ruta). Se cambia de cámara en Ajustes → General y se cava una nueva con
// File → New Chamber… Las notas sueltas en la raíz del hormiguero no son de ninguna cámara.

import { invoke } from "@tauri-apps/api/core";
import { documentDir, homeDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import type { Ajustes } from "../ajustes";

/**
 * Crea la carpeta `nombreDeLaCarpeta` dentro de `carpetaDondeCrearla` y devuelve su ruta: el
 * hormiguero (en Documentos u otro lugar) o una cámara (dentro del hormiguero). Falla si ya existe.
 */
export const crearCarpetaNueva = (carpetaDondeCrearla: string, nombreDeLaCarpeta: string) =>
  invoke<string>("crear_carpeta_nueva", { carpetaDondeCrearla, nombreDeLaCarpeta });

/** Nombres de las cámaras del hormiguero (sus carpetas de primer nivel, aunque estén vacías). */
export const listarCamarasDelHormiguero = (carpetaDelHormiguero: string) =>
  invoke<string[]>("listar_camaras", { carpetaDelHormiguero });

/** Dónde se propone crear el hormiguero: la carpeta Documentos (o la del usuario). */
export const carpetaDondeProponerCrearElHormiguero = () => documentDir().catch(() => homeDir());

/** Muestra el diálogo del sistema para elegir una carpeta; devuelve su ruta o `null` si se canceló. */
export async function elegirCarpetaConElDialogo(carpetaInicial?: string | null): Promise<string | null> {
  const carpetaElegida = await open({ directory: true, multiple: false, defaultPath: carpetaInicial ?? undefined });
  return typeof carpetaElegida === "string" ? carpetaElegida : null;
}

/** Ruta de la cámara `nombreDeLaCamara` dentro del hormiguero, con el separador que use la ruta del hormiguero. */
export function rutaDeLaCamara(carpetaDelHormiguero: string, nombreDeLaCamara: string): string {
  const separador = carpetaDelHormiguero.includes("\\") && !carpetaDelHormiguero.includes("/") ? "\\" : "/";
  return carpetaDelHormiguero.replace(/[\\/]+$/, "") + separador + nombreDeLaCamara;
}

/**
 * Si la cámara abierta existe en el hormiguero. Mientras todavía no se leyeron las cámaras
 * (`camarasDelHormiguero` es `null`, al abrir la app) se da por buena, así la barra lateral no
 * espera a esa lectura para mostrarse.
 */
export const laCamaraAbiertaExiste = (ajustes: Ajustes, camarasDelHormiguero: string[] | null) =>
  ajustes.camara_abierta !== null && (camarasDelHormiguero === null || camarasDelHormiguero.includes(ajustes.camara_abierta));

/** Carpeta de la cámara abierta, o `null` si falta el hormiguero o la cámara (o ya no existe). */
export const carpetaDeLaCamaraAbierta = (ajustes: Ajustes, camarasDelHormiguero: string[] | null) =>
  ajustes.hormiguero && laCamaraAbiertaExiste(ajustes, camarasDelHormiguero) ? rutaDeLaCamara(ajustes.hormiguero, ajustes.camara_abierta!) : null;

/** Cambios de ajustes para usar otro hormiguero: su cámara se elige de nuevo (las del anterior no están ahí). */
export const cambiosParaElegirHormiguero = (carpetaDelHormiguero: string): Partial<Ajustes> => ({
  hormiguero: carpetaDelHormiguero,
  camara_abierta: null,
});
