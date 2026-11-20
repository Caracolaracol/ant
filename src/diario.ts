// Modo diario desde la interfaz: fechas en formato `AAAA-MM-DD` (el nombre de cada nota diaria),
// el título con que nace cada nota y la llamada a Rust (`src-tauri/src/diario.rs`) que crea la
// carpeta `Daily` y la nota del día si todavía no existen.

import { invoke } from "@tauri-apps/api/core";
import { Entrada } from "./carpeta";

/** Nombre de la carpeta de notas diarias dentro de la carpeta de trabajo (igual que en Rust). */
export const CARPETA_DIARIO = "Daily";

/** Ruta donde se crearía la carpeta `Daily` dentro de `carpeta`, con el mismo separador que use la carpeta. */
export const rutaDiario = (carpeta: string) =>
  `${carpeta.replace(/[\\/]+$/, "")}${carpeta.includes("\\") ? "\\" : "/"}${CARPETA_DIARIO}`;

/** Fecha local como `AAAA-MM-DD` (no se usa `toISOString`, que pasa a UTC y puede cambiar el día). */
export function claveDia(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/**
 * Título con que nace la nota de un día, en el idioma de la interfaz (`locale`):
 * «# Friday, November 20, 2026» o «# Viernes 20 de noviembre de 2026».
 */
function tituloDia(fecha: Date, locale: string): string {
  let texto = fecha.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  // En español: «viernes, 20 de noviembre de 2026» → «Viernes 20 de noviembre de 2026».
  if (locale.startsWith("es")) texto = texto.charAt(0).toUpperCase() + texto.slice(1).replace(",", "");
  return `# ${texto}\n\n`;
}

/**
 * Devuelve la ruta de la nota de `fecha` en la carpeta `Daily` de `carpeta`, creándola si no
 * existe (Rust usa la carpeta `Daily` que ya haya, aunque esté escrita `daily` o `DAILY`).
 */
export const abrirDia = (carpeta: string, fecha: Date, locale: string) =>
  invoke<string>("abrir_dia", { carpeta, fecha: claveDia(fecha), contenido: tituloDia(fecha, locale) });

/** Carpeta `Daily` del primer nivel del árbol, sin importar mayúsculas (`Daily`, `daily`…). */
export const entradaDiario = (arbol: Entrada[]) =>
  arbol.find((e) => e.es_carpeta && e.nombre.toLowerCase() === CARPETA_DIARIO.toLowerCase());

/** Días que ya tienen nota, según el árbol de la carpeta de trabajo (`Daily/AAAA-MM-DD.md`). */
export function diasConNota(arbol: Entrada[]): Set<string> {
  const daily = entradaDiario(arbol);
  const dias = new Set<string>();
  for (const e of daily?.hijos ?? []) {
    const m = /^(\d{4}-\d{2}-\d{2})\.md$/.exec(e.nombre);
    if (m && !e.es_carpeta) dias.add(m[1]);
  }
  return dias;
}

/** Si `ruta` es una nota diaria (`…/Daily/AAAA-MM-DD.md`), devuelve su `AAAA-MM-DD`; si no, `null`. */
export function diaDeRuta(ruta: string | null): string | null {
  const m = ruta && /[\\/]Daily[\\/](\d{4}-\d{2}-\d{2})\.md$/i.exec(ruta);
  return m ? m[1] : null;
}
