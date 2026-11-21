// Conteo de palabras, líneas y caracteres de un texto, para la barra de estado. Está aparte (y no
// en `BarraDeEstado.tsx`) para poder probarlo con `node --test` (ver `prueba/automaticas/`).

/** Cuenta palabras, líneas y caracteres de un texto. */
export function contarPalabrasLineasYCaracteres(texto: string) {
  const textoSinEspaciosEnLosBordes = texto.trim();
  return {
    cantidadDePalabras: textoSinEspaciosEnLosBordes ? textoSinEspaciosEnLosBordes.split(/\s+/).length : 0,
    cantidadDeLineas: texto.split("\n").length,
    cantidadDeCaracteres: texto.length,
  };
}
