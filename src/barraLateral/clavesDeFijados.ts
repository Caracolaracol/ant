// Fijados de la barra lateral: qué es cada uno y con qué icono se dibuja. En los ajustes cada
// fijado es un texto (su clave): la ruta de una nota o carpeta, o `ruta#título` para un capítulo
// (un título `#` dentro de una nota). El icono elegido se guarda aparte, en `Ajustes.iconos`.

/** Un fijado ya interpretado: su clave, la ruta de su nota o carpeta y, si es un capítulo, su título. */
export interface Fijado {
  clave: string;
  ruta: string;
  tituloDelCapitulo: string | null;
}

/** `ruta-de-una-nota.md#Título`: lo que sigue al primer `#` después de la extensión es el título. */
const FORMA_DE_LA_CLAVE_DE_UN_CAPITULO = /^(.*?\.(?:md|markdown|txt))#(.+)$/i;

/** Interpreta la clave de un fijado. */
export function interpretarClaveDeFijado(clave: string): Fijado {
  const partesDelCapitulo = FORMA_DE_LA_CLAVE_DE_UN_CAPITULO.exec(clave);
  return partesDelCapitulo
    ? { clave, ruta: partesDelCapitulo[1], tituloDelCapitulo: partesDelCapitulo[2] }
    : { clave, ruta: clave, tituloDelCapitulo: null };
}

/** Clave con la que se fija un capítulo de una nota. */
export const claveDeCapitulo = (rutaDeLaNota: string, tituloDelCapitulo: string) => `${rutaDeLaNota}#${tituloDelCapitulo}`;

/** Tipo de un fijado, que decide su icono por defecto. */
export type TipoDeFijado = "carpeta" | "nota" | "capitulo";

/** Icono de cada tipo de fijado mientras el usuario no elija otro (nombres de `iconos.ts`). */
export const ICONO_POR_DEFECTO_DE_CADA_TIPO: Record<TipoDeFijado, string> = {
  carpeta: "folder",
  nota: "file-text",
  capitulo: "bookmark",
};
