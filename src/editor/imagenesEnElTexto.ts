// Imágenes escritas en el texto de una nota: encontrarlas en una línea, saber a qué archivo
// apuntan y escribir el enlace de una imagen nueva. Es la parte de `imagenes.ts` (el editor) que
// no depende de la ventana, así se prueba aparte (`prueba/automaticas/imagenes.prueba.ts`).
//
// Se reconocen dos formas:
//   · Markdown: `![texto](Images/foto.png)`, `![](<Mi carpeta/foto 1.png>)`, `![](foto%201.png)`,
//     una ruta completa o una dirección web.
//   · Obsidian: `![[foto.png]]` o `![[foto.png|300]]`, solo con el nombre (se busca en el hormiguero).

/** Una imagen encontrada en una línea. */
export interface ImagenEnElTexto {
  /** Dónde empieza y termina, dentro de la línea. */
  desde: number;
  hasta: number;
  /** Destino tal como está escrito, ya sin `< >` ni `%20` (una ruta relativa o completa, o una dirección web). */
  destino: string;
  /** Si es un enlace de Obsidian (`![[…]]`): el destino es un nombre que hay que buscar. */
  esDeObsidian: boolean;
}

/** `![texto](destino "título")`, con el destino entre `< >` o sin espacios. */
const FORMA_DE_IMAGEN_MARKDOWN = /!\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^)\s]+)(?:\s+"[^"\n]*")?\s*\)/g;
/** `![[nombre]]` o `![[nombre|ancho]]`. */
const FORMA_DE_IMAGEN_DE_OBSIDIAN = /!\[\[([^\]|\n]+)(?:\|[^\]\n]*)?\]\]/g;
/** Extensiones de archivo que se muestran como imagen (deben coincidir con las de `src-tauri/src/imagenes.rs`). */
export const EXTENSIONES_DE_IMAGENES = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];

/** Si una ruta o nombre tiene extensión de imagen. */
export const esArchivoDeImagen = (ruta: string) =>
  EXTENSIONES_DE_IMAGENES.includes(ruta.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? "");

/** Si el destino es una dirección web (o datos en línea) y no un archivo. */
export const esDireccionWeb = (destino: string) => /^(https?:|data:)/i.test(destino);

/** Quita `%20` y demás códigos de una ruta escrita en Markdown (si alguno está mal, la deja como está). */
function decodificarRuta(rutaEscrita: string): string {
  try {
    return decodeURI(rutaEscrita);
  } catch {
    return rutaEscrita;
  }
}

/** Imágenes de una línea, en orden. Los enlaces de Obsidian solo cuentan si apuntan a una imagen. */
export function imagenesDeLaLinea(textoDeLaLinea: string): ImagenEnElTexto[] {
  if (!textoDeLaLinea.includes("![")) return [];
  const imagenes: ImagenEnElTexto[] = [];
  for (const coincidencia of textoDeLaLinea.matchAll(FORMA_DE_IMAGEN_MARKDOWN)) {
    const destinoEscrito = coincidencia[1].startsWith("<") ? coincidencia[1].slice(1, -1) : coincidencia[1];
    const destino = esDireccionWeb(destinoEscrito) ? destinoEscrito : decodificarRuta(destinoEscrito);
    imagenes.push({ desde: coincidencia.index, hasta: coincidencia.index + coincidencia[0].length, destino, esDeObsidian: false });
  }
  for (const coincidencia of textoDeLaLinea.matchAll(FORMA_DE_IMAGEN_DE_OBSIDIAN)) {
    const nombre = coincidencia[1].trim();
    if (!esArchivoDeImagen(nombre)) continue;
    imagenes.push({ desde: coincidencia.index, hasta: coincidencia.index + coincidencia[0].length, destino: nombre, esDeObsidian: true });
  }
  return imagenes.sort((primera, segunda) => primera.desde - segunda.desde);
}

/** Separador de rutas que usa una carpeta (`\` en Windows, `/` en los demás). */
const separadorDe = (ruta: string) => (ruta.includes("\\") && !ruta.includes("/") ? "\\" : "/");

/** Si una ruta es completa (`/…`, `C:\…`, `\\servidor\…`). */
const esRutaCompleta = (ruta: string) => /^(\/|[a-zA-Z]:[\\/]|\\\\)/.test(ruta);

/**
 * Ruta completa del archivo de una imagen de Markdown, a partir de la carpeta de la nota: resuelve
 * `./` y `../`. Una ruta que ya es completa queda igual.
 */
export function rutaCompletaDeLaImagen(destino: string, carpetaDeLaNota: string): string {
  if (esRutaCompleta(destino)) return destino;
  const separador = separadorDe(carpetaDeLaNota);
  const partes = carpetaDeLaNota.replace(/[\\/]+$/, "").split(/[\\/]/);
  for (const parte of destino.split(/[\\/]/)) {
    if (parte === "..") partes.pop();
    else if (parte !== "." && parte !== "") partes.push(parte);
  }
  return partes.join(separador);
}

/**
 * Ruta relativa de `rutaDelArchivo` vista desde `carpetaDeLaNota`, con `/` (`Images/a.png`,
 * `../Otra/a.png`). Se usa para enlazar una imagen que ya está dentro del hormiguero sin copiarla.
 */
export function rutaRelativaDesde(carpetaDeLaNota: string, rutaDelArchivo: string): string {
  const partesDeLaCarpeta = carpetaDeLaNota.replace(/[\\/]+$/, "").split(/[\\/]/);
  const partesDelArchivo = rutaDelArchivo.split(/[\\/]/);
  let comunes = 0;
  while (comunes < partesDeLaCarpeta.length && comunes < partesDelArchivo.length - 1 && partesDeLaCarpeta[comunes] === partesDelArchivo[comunes]) comunes++;
  const subidas = partesDeLaCarpeta.slice(comunes).map(() => "..");
  return [...subidas, ...partesDelArchivo.slice(comunes)].join("/");
}

/**
 * Enlace de Markdown para una imagen, con su ruta relativa: `![foto](Images/foto.png)`. Si la ruta
 * tiene espacios va entre `< >`, que entiende cualquier Markdown. El texto es el nombre sin extensión.
 */
export function enlaceDeImagen(rutaRelativa: string): string {
  const nombreSinExtension = (rutaRelativa.split("/").pop() ?? "").replace(/\.[^.]+$/, "").replace(/[[\]]/g, "");
  const destino = /\s/.test(rutaRelativa) ? `<${rutaRelativa}>` : rutaRelativa;
  return `![${nombreSinExtension}](${destino})`;
}
