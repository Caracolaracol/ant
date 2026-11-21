// Títulos de una nota: las líneas de título de Markdown (`#`, `##`, …), que la barra lateral
// muestra bajo la nota visible como índice para saltar dentro del documento, igual que en Left.

export interface TituloDeLaNota {
  /** Texto del título sin los `#`. */
  texto: string;
  /** Nivel del título: 1 para `#`, 2 para `##`, etc. */
  nivel: number;
  /** Posición (en caracteres) del inicio de su línea dentro de la nota. */
  posicion: number;
}

/**
 * Recorre la nota línea por línea y devuelve sus títulos en orden. Ignora lo que esté dentro de
 * bloques de código (```), donde `#` suele ser un comentario.
 */
export function extraerTitulosDeLaNota(textoDeLaNota: string): TituloDeLaNota[] {
  const titulos: TituloDeLaNota[] = [];
  let posicionDeLaLinea = 0;
  let estaDentroDeUnBloqueDeCodigo = false;
  for (const linea of textoDeLaNota.split("\n")) {
    if (/^\s*(```|~~~)/.test(linea)) estaDentroDeUnBloqueDeCodigo = !estaDentroDeUnBloqueDeCodigo;
    else if (!estaDentroDeUnBloqueDeCodigo) {
      const partesDelTitulo = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(linea);
      if (partesDelTitulo) {
        titulos.push({ texto: partesDelTitulo[2], nivel: partesDelTitulo[1].length, posicion: posicionDeLaLinea });
      }
    }
    posicionDeLaLinea += linea.length + 1;
  }
  return titulos;
}

/** Índice del título en el que está `posicionDelCursor` (el último título antes de ella), o -1. */
export function indiceDelTituloEnLaPosicion(titulos: TituloDeLaNota[], posicionDelCursor: number): number {
  let indiceEncontrado = -1;
  for (let i = 0; i < titulos.length && titulos[i].posicion <= posicionDelCursor; i++) indiceEncontrado = i;
  return indiceEncontrado;
}
