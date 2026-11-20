// Carpetas desde la interfaz: pide a Rust (`src-tauri/src/carpeta.rs`) el árbol de subcarpetas
// y notas del hormiguero abierto, que muestra la barra lateral. También utilidades de rutas.

import { invoke } from "@tauri-apps/api/core";

/** Un elemento del árbol. Debe coincidir con la estructura `Entrada` de Rust. */
export interface Entrada {
  nombre: string;
  ruta: string;
  es_carpeta: boolean;
  hijos: Entrada[];
}

/** Devuelve el árbol de notas (.md, .markdown, .txt) de `carpeta`, con las carpetas primero. */
export const listarCarpeta = (carpeta: string) => invoke<Entrada[]>("listar_carpeta", { path: carpeta });


/** Indica si `ruta` está dentro de `carpeta` (o es la carpeta misma). */
export function estaDentro(ruta: string, carpeta: string): boolean {
  const base = carpeta.replace(/[\\/]+$/, "");
  return ruta === base || ruta.startsWith(base + "/") || ruta.startsWith(base + "\\");
}

/** Devuelve las carpetas que contienen a `ruta` dentro de `carpeta` (para desplegarlas en el árbol). */
export function carpetasPadre(ruta: string, carpeta: string): string[] {
  const padres: string[] = [];
  let actual = ruta;
  for (;;) {
    const corte = Math.max(actual.lastIndexOf("/"), actual.lastIndexOf("\\"));
    if (corte <= 0) break;
    actual = actual.slice(0, corte);
    if (!estaDentro(actual, carpeta) || actual === carpeta.replace(/[\\/]+$/, "")) break;
    padres.push(actual);
  }
  return padres;
}

/**
 * Marca una ruta como texto de izquierda a derecha. Las rutas largas se muestran con
 * `direction: rtl` para que, si no caben, se corte el principio y se vea el final; sin esta marca
 * la `/` del principio aparecería al final.
 */
export const ltr = (ruta: string) => `\u200e${ruta}\u200e`;

/** Busca en el árbol la entrada (carpeta o nota) de `rutaBuscada`, a cualquier profundidad. */
export function buscarEntradaPorRuta(entradas: Entrada[], rutaBuscada: string): Entrada | undefined {
  for (const entrada of entradas) {
    if (entrada.ruta === rutaBuscada) return entrada;
    if (entrada.es_carpeta && estaDentro(rutaBuscada, entrada.ruta)) {
      const encontrada = buscarEntradaPorRuta(entrada.hijos, rutaBuscada);
      if (encontrada) return encontrada;
    }
  }
  return undefined;
}
