// Fijados de la barra lateral: qué es cada uno y con qué icono se dibuja. En los ajustes cada
// fijado es un texto (su clave): la ruta de una nota o carpeta, o `ruta#título` para un capítulo
// (un título `#` dentro de una nota). El icono elegido se guarda aparte, en `Ajustes.iconos`.

/** Un fijado ya interpretado: su clave, la ruta de su nota o carpeta y, si es un capítulo, su título. */
export interface Fijado {
  clave: string;
  ruta: string;
  titulo: string | null;
}

/** `ruta-de-una-nota.md#Título`: lo que sigue al primer `#` después de la extensión es el título. */
const CAPITULO = /^(.*?\.(?:md|markdown|txt))#(.+)$/i;

/** Interpreta la clave de un fijado. */
export function leerFijado(clave: string): Fijado {
  const m = CAPITULO.exec(clave);
  return m ? { clave, ruta: m[1], titulo: m[2] } : { clave, ruta: clave, titulo: null };
}

/** Clave con la que se fija un capítulo de una nota. */
export const claveCapitulo = (ruta: string, titulo: string) => `${ruta}#${titulo}`;

/** Tipo de un fijado, que decide su icono por defecto. */
export type TipoFijado = "carpeta" | "nota" | "capitulo";

/** Icono de cada tipo de fijado mientras el usuario no elija otro (nombres de `iconos.ts`). */
export const ICONO_POR_DEFECTO: Record<TipoFijado, string> = {
  carpeta: "folder",
  nota: "file-text",
  capitulo: "bookmark",
};
