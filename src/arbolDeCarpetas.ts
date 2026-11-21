// Árbol de carpetas y notas desde la interfaz: le pide a Rust (`src-tauri/src/carpeta.rs`) el
// árbol de subcarpetas y notas de la cámara abierta, que muestra la barra lateral, y tiene las
// utilidades de rutas que usa el resto de la app.

import { invoke } from "@tauri-apps/api/core";

/** Una carpeta o nota del árbol. Debe coincidir con la estructura `EntradaDelArbol` de Rust. */
export interface EntradaDelArbol {
  nombre: string;
  ruta: string;
  esCarpeta: boolean;
  /** Contenido de la carpeta (vacío en las notas). */
  hijos: EntradaDelArbol[];
}

/** Devuelve el árbol de notas (.md, .markdown, .txt) de una carpeta, con las carpetas primero. */
export const leerArbolDeCarpeta = (rutaDeLaCarpeta: string) =>
  invoke<EntradaDelArbol[]>("leer_arbol_de_carpeta", { rutaDeLaCarpeta });

/** Quita las barras del final de una ruta de carpeta. */
const sinBarraFinal = (rutaDeLaCarpeta: string) => rutaDeLaCarpeta.replace(/[\\/]+$/, "");

/** Indica si `ruta` está dentro de `rutaDeLaCarpeta` (o es la carpeta misma). */
export function estaDentroDe(ruta: string, rutaDeLaCarpeta: string): boolean {
  const carpeta = sinBarraFinal(rutaDeLaCarpeta);
  return ruta === carpeta || ruta.startsWith(carpeta + "/") || ruta.startsWith(carpeta + "\\");
}

/**
 * Devuelve las carpetas que contienen a `ruta` dentro de `carpetaDeLaCamara`, de la más honda
 * a la más alta (para desplegarlas en el árbol al abrir una nota).
 */
export function carpetasQueContienenA(ruta: string, carpetaDeLaCamara: string): string[] {
  const carpetasQueLaContienen: string[] = [];
  let rutaActual = ruta;
  for (;;) {
    const posicionDeLaUltimaBarra = Math.max(rutaActual.lastIndexOf("/"), rutaActual.lastIndexOf("\\"));
    if (posicionDeLaUltimaBarra <= 0) break;
    rutaActual = rutaActual.slice(0, posicionDeLaUltimaBarra);
    if (!estaDentroDe(rutaActual, carpetaDeLaCamara) || rutaActual === sinBarraFinal(carpetaDeLaCamara)) break;
    carpetasQueLaContienen.push(rutaActual);
  }
  return carpetasQueLaContienen;
}

/** Busca en el árbol la entrada (carpeta o nota) de `rutaBuscada`, a cualquier profundidad. */
export function buscarEntradaPorRuta(entradas: EntradaDelArbol[], rutaBuscada: string): EntradaDelArbol | undefined {
  for (const entrada of entradas) {
    if (entrada.ruta === rutaBuscada) return entrada;
    if (entrada.esCarpeta && estaDentroDe(rutaBuscada, entrada.ruta)) {
      const entradaEncontrada = buscarEntradaPorRuta(entrada.hijos, rutaBuscada);
      if (entradaEncontrada) return entradaEncontrada;
    }
  }
  return undefined;
}

/**
 * Marca una ruta como texto de izquierda a derecha. Las rutas largas se muestran con
 * `direction: rtl` para que, si no caben, se corte el principio y se vea el final; sin esta marca
 * la `/` del principio aparecería al final.
 */
export const marcarComoTextoDeIzquierdaADerecha = (ruta: string) => `‎${ruta}‎`;
