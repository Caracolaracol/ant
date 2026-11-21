// Modo diario desde la interfaz: fechas en formato `AAAA-MM-DD` (el nombre de cada nota diaria),
// el título con que nace cada nota y la llamada a Rust (`src-tauri/src/diario.rs`) que crea la
// carpeta `Daily` y la nota del día si todavía no existen.

import { invoke } from "@tauri-apps/api/core";
import type { EntradaDelArbol } from "./arbolDeCarpetas";

/** Nombre de la carpeta de notas diarias dentro de la cámara abierta (igual que en Rust). */
export const NOMBRE_DE_LA_CARPETA_DEL_DIARIO = "Daily";

/** Ruta donde se crearía la carpeta `Daily` dentro de la cámara, con el mismo separador que use su ruta. */
export const rutaDeLaCarpetaDelDiario = (carpetaDeLaCamara: string) =>
  `${carpetaDeLaCamara.replace(/[\\/]+$/, "")}${carpetaDeLaCamara.includes("\\") ? "\\" : "/"}${NOMBRE_DE_LA_CARPETA_DEL_DIARIO}`;

/** Fecha local como `AAAA-MM-DD` (no se usa `toISOString`, que pasa a UTC y puede cambiar el día). */
export function claveDelDia(dia: Date): string {
  const conDosCifras = (numero: number) => String(numero).padStart(2, "0");
  return `${dia.getFullYear()}-${conDosCifras(dia.getMonth() + 1)}-${conDosCifras(dia.getDate())}`;
}

/**
 * Título con que nace la nota de un día, en el idioma de la interfaz (`codigoDeIdioma`):
 * «# Friday, November 20, 2026» o «# Viernes 20 de noviembre de 2026».
 */
function tituloDeLaNotaDelDia(dia: Date, codigoDeIdioma: string): string {
  let fechaEscrita = dia.toLocaleDateString(codigoDeIdioma, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  // En español: «viernes, 20 de noviembre de 2026» → «Viernes 20 de noviembre de 2026».
  if (codigoDeIdioma.startsWith("es")) fechaEscrita = fechaEscrita.charAt(0).toUpperCase() + fechaEscrita.slice(1).replace(",", "");
  return `# ${fechaEscrita}\n\n`;
}

/**
 * Devuelve la ruta de la nota de `dia` en la carpeta `Daily` de la cámara, creándola si no
 * existe (Rust usa la carpeta `Daily` que ya haya, aunque esté escrita `daily` o `DAILY`).
 */
export const abrirOCrearNotaDelDia = (carpetaDeLaCamara: string, dia: Date, codigoDeIdioma: string) =>
  invoke<string>("abrir_o_crear_nota_del_dia", {
    carpetaDeLaCamara,
    claveDelDia: claveDelDia(dia),
    textoInicial: tituloDeLaNotaDelDia(dia, codigoDeIdioma),
  });

/** Carpeta `Daily` del primer nivel del árbol, sin importar mayúsculas (`Daily`, `daily`…). */
export const buscarCarpetaDelDiario = (arbolDeLaCamara: EntradaDelArbol[]) =>
  arbolDeLaCamara.find(
    (entrada) => entrada.esCarpeta && entrada.nombre.toLowerCase() === NOMBRE_DE_LA_CARPETA_DEL_DIARIO.toLowerCase(),
  );

/** Días que ya tienen nota, según el árbol de la cámara abierta (`Daily/AAAA-MM-DD.md`). */
export function diasQueTienenNota(arbolDeLaCamara: EntradaDelArbol[]): Set<string> {
  const carpetaDelDiario = buscarCarpetaDelDiario(arbolDeLaCamara);
  const dias = new Set<string>();
  for (const entrada of carpetaDelDiario?.hijos ?? []) {
    const nombreConFecha = /^(\d{4}-\d{2}-\d{2})\.md$/.exec(entrada.nombre);
    if (nombreConFecha && !entrada.esCarpeta) dias.add(nombreConFecha[1]);
  }
  return dias;
}

/** Si `ruta` es una nota diaria (`…/Daily/AAAA-MM-DD.md`), devuelve su `AAAA-MM-DD`; si no, `null`. */
export function diaDeLaNotaDiaria(ruta: string | null): string | null {
  const rutaConFecha = ruta && /[\\/]Daily[\\/](\d{4}-\d{2}-\d{2})\.md$/i.exec(ruta);
  return rutaConFecha ? rutaConFecha[1] : null;
}
