// Extrae los marcadores de una nota: las líneas de título de Markdown (`#`, `##`, …), que la
// barra lateral muestra como índice para saltar dentro del documento, igual que en Left.

export interface Marcador {
  /** Texto del título sin los `#`. */
  texto: string;
  /** Nivel del título: 1 para `#`, 2 para `##`, etc. */
  nivel: number;
  /** Posición (en caracteres) del inicio de la línea dentro de la nota. */
  pos: number;
}

/**
 * Recorre la nota línea por línea y devuelve sus títulos en orden.
 * Ignora lo que esté dentro de bloques de código (```), donde `#` suele ser un comentario.
 */
export function extraerMarcadores(texto: string): Marcador[] {
  const marcadores: Marcador[] = [];
  let pos = 0;
  let enCodigo = false;
  for (const linea of texto.split("\n")) {
    if (/^\s*(```|~~~)/.test(linea)) enCodigo = !enCodigo;
    else if (!enCodigo) {
      const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(linea);
      if (m) marcadores.push({ texto: m[2], nivel: m[1].length, pos });
    }
    pos += linea.length + 1;
  }
  return marcadores;
}

/** Índice del marcador en el que está el cursor (el último título antes de `pos`), o -1. */
export function marcadorActual(marcadores: Marcador[], pos: number): number {
  let indice = -1;
  for (let i = 0; i < marcadores.length && marcadores[i].pos <= pos; i++) indice = i;
  return indice;
}
