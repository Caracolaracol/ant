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

/**
 * Devuelve el árbol de notas (.md, .markdown, .txt) de una carpeta, con las carpetas primero. Con
 * `soloNotasSueltas` (la «Entrada» del hormiguero) devuelve solo las notas de su primer nivel.
 */
export const leerArbolDeCarpeta = (rutaDeLaCarpeta: string, soloNotasSueltas = false) =>
  invoke<EntradaDelArbol[]>("leer_arbol_de_carpeta", { rutaDeLaCarpeta, soloNotasSueltas });

/** Quita las barras del final de una ruta de carpeta. */
const sinBarraFinal = (rutaDeLaCarpeta: string) => rutaDeLaCarpeta.replace(/[\\/]+$/, "");

/** Indica si `ruta` está dentro de `rutaDeLaCarpeta` (o es la carpeta misma). */
export function estaDentroDe(ruta: string, rutaDeLaCarpeta: string): boolean {
  const carpeta = sinBarraFinal(rutaDeLaCarpeta);
  return ruta === carpeta || ruta.startsWith(carpeta + "/") || ruta.startsWith(carpeta + "\\");
}

/** Carpeta que contiene a `ruta` (sin la barra del final), o `""` si no tiene. */
export function carpetaQueContieneA(ruta: string): string {
  const posicionDeLaUltimaBarra = Math.max(ruta.lastIndexOf("/"), ruta.lastIndexOf("\\"));
  return posicionDeLaUltimaBarra < 0 ? "" : ruta.slice(0, posicionDeLaUltimaBarra);
}

/**
 * Indica si `ruta` es de la cámara abierta: si está dentro de su carpeta o, en la «Entrada»
 * (`soloNotasSueltas`), si es la raíz del hormiguero o una nota suelta en ella (lo que está en sus
 * subcarpetas es de las otras cámaras).
 */
export function estaEnLaCamara(ruta: string, carpetaDeLaCamara: string, soloNotasSueltas: boolean): boolean {
  if (!soloNotasSueltas) return estaDentroDe(ruta, carpetaDeLaCamara);
  const carpeta = sinBarraFinal(carpetaDeLaCamara);
  return ruta === carpeta || carpetaQueContieneA(ruta) === carpeta;
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
