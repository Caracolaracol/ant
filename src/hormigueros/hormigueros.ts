// El hormiguero y sus cámaras. El hormiguero es una sola carpeta con todas las notas del usuario
// (lo que en Obsidian es la bóveda), en `Ajustes.hormiguero`. Sus carpetas de primer nivel son las
// cámaras: cada una un contexto (las notas personales, todo lo de una novela, el trabajo y sus
// proyectos). La barra lateral muestra una cámara a la vez (`Ajustes.camara_abierta`, guardada por
// nombre y no por ruta). Se cambia de cámara en Ajustes → General y se cava una nueva con
// File → New Chamber… Las notas sueltas en la raíz del hormiguero son la «Entrada»: una cámara más
// (la primera de la lista) que solo existe mientras haya notas sueltas.

import { invoke } from "@tauri-apps/api/core";
import { documentDir, homeDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import type { Ajustes } from "../ajustes";
import { estaDentroDe } from "../arbolDeCarpetas.ts";

/**
 * Nombre con que se guarda y se lista la «Entrada», la cámara de las notas sueltas en la raíz del
 * hormiguero. Es «.» (la carpeta misma), que no puede ser el nombre de una carpeta de verdad; se
 * muestra como «Entrada». Debe coincidir con `CAMARA_DE_ENTRADA` de `src-tauri/src/carpeta.rs`.
 */
export const CAMARA_DE_ENTRADA = ".";

/** Si la cámara `nombreDeLaCamara` es la «Entrada». */
export const esLaEntrada = (nombreDeLaCamara: string | null) => nombreDeLaCamara === CAMARA_DE_ENTRADA;

/** Nombre que se muestra de una cámara: el de su carpeta, o `nombreDeLaEntrada` para la «Entrada». */
export const nombreVisibleDeLaCamara = (nombreDeLaCamara: string, nombreDeLaEntrada: string) =>
  esLaEntrada(nombreDeLaCamara) ? nombreDeLaEntrada : nombreDeLaCamara;

/**
 * Crea la carpeta `nombreDeLaCarpeta` dentro de `carpetaDondeCrearla` y devuelve su ruta: el
 * hormiguero (en Documentos u otro lugar) o una cámara (dentro del hormiguero). Falla si ya existe.
 */
export const crearCarpetaNueva = (carpetaDondeCrearla: string, nombreDeLaCarpeta: string) =>
  invoke<string>("crear_carpeta_nueva", { carpetaDondeCrearla, nombreDeLaCarpeta });

/**
 * Nombres de las cámaras del hormiguero: sus carpetas de primer nivel, aunque estén vacías, y
 * antes, si hay notas sueltas en la raíz, la «Entrada» (`CAMARA_DE_ENTRADA`).
 */
export const listarCamarasDelHormiguero = (carpetaDelHormiguero: string) =>
  invoke<string[]>("listar_camaras", { carpetaDelHormiguero });

/** Cambia el nombre de la carpeta y de sus datos en `.ant/`; devuelve el nuevo nombre. */
export const renombrarCamara = (carpetaDelHormiguero: string, nombreAnterior: string, nombreNuevo: string) =>
  invoke<string>("renombrar_camara", { carpetaDelHormiguero, nombreAnterior, nombreNuevo });

/** Dónde se propone crear el hormiguero: la carpeta Documentos (o la del usuario). */
export const carpetaDondeProponerCrearElHormiguero = () => documentDir().catch(() => homeDir());

/** Muestra el diálogo del sistema para elegir una carpeta; devuelve su ruta o `null` si se canceló. */
export async function elegirCarpetaConElDialogo(carpetaInicial?: string | null): Promise<string | null> {
  const carpetaElegida = await open({ directory: true, multiple: false, defaultPath: carpetaInicial ?? undefined });
  return typeof carpetaElegida === "string" ? carpetaElegida : null;
}

/**
 * Ruta de la cámara `nombreDeLaCamara` dentro del hormiguero, con el separador que use la ruta del
 * hormiguero. La de la «Entrada» es la del hormiguero mismo.
 */
export function rutaDeLaCamara(carpetaDelHormiguero: string, nombreDeLaCamara: string): string {
  const hormigueroSinBarraFinal = carpetaDelHormiguero.replace(/[\\/]+$/, "");
  if (esLaEntrada(nombreDeLaCamara)) return hormigueroSinBarraFinal;
  const separador = carpetaDelHormiguero.includes("\\") && !carpetaDelHormiguero.includes("/") ? "\\" : "/";
  return hormigueroSinBarraFinal + separador + nombreDeLaCamara;
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

/** Actualiza las referencias locales absolutas; los datos de `.ant/` conservan sus rutas relativas. */
export function cambiosAlRenombrarCamara(ajustes: Ajustes, nombreAnterior: string, nombreNuevo: string): Partial<Ajustes> {
  if (!ajustes.hormiguero) return {};
  const rutaAnterior = rutaDeLaCamara(ajustes.hormiguero, nombreAnterior);
  const rutaNueva = rutaDeLaCamara(ajustes.hormiguero, nombreNuevo);
  /** Cambia la raíz solo si la ruta pertenece a la cámara renombrada. */
  const cambiarRaiz = (ruta: string) => estaDentroDe(ruta, rutaAnterior) ? rutaNueva + ruta.slice(rutaAnterior.length) : ruta;
  /** Los fijados y compilaciones antiguos pueden seguir en los ajustes hasta abrir la cámara. */
  const cambiarClaves = <Valor,>(datos: Record<string, Valor>) =>
    Object.fromEntries(Object.entries(datos).map(([ruta, valor]) => [cambiarRaiz(ruta), valor]));
  return {
    camara_abierta: ajustes.camara_abierta === nombreAnterior ? nombreNuevo : ajustes.camara_abierta,
    ultima_nota_abierta: ajustes.ultima_nota_abierta ? cambiarRaiz(ajustes.ultima_nota_abierta) : null,
    fijados: ajustes.fijados.map(cambiarRaiz),
    iconos_de_fijados: cambiarClaves(ajustes.iconos_de_fijados),
    opciones_de_compilacion_por_carpeta: cambiarClaves(ajustes.opciones_de_compilacion_por_carpeta),
  };
}

/** Cambios de ajustes para usar otro hormiguero: su cámara se elige de nuevo (las del anterior no están ahí). */
export const cambiosParaElegirHormiguero = (carpetaDelHormiguero: string): Partial<Ajustes> => ({
  hormiguero: carpetaDelHormiguero,
  camara_abierta: null,
});
