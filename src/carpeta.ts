// Lectura de la carpeta de trabajo desde la interfaz: pide a Rust (`src-tauri/src/carpeta.rs`)
// el árbol de subcarpetas y notas que muestra la barra lateral.

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

/** Pide a Rust que abra (o traiga al frente) la ventana de Ajustes. */
export const abrirAjustes = () => invoke<void>("abrir_ajustes");

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
