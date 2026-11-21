// Escritor de archivos ZIP mínimo, sin dependencias: un .docx (y más adelante un .epub) es un ZIP
// con archivos XML adentro. Comprime con `CompressionStream("deflate-raw")` del navegador cuando
// existe; si no, guarda los archivos sin comprimir, que también es un ZIP válido.

/** Un archivo dentro del ZIP. */
export interface ArchivoDentroDelZip {
  nombre: string;
  contenido: Uint8Array | string;
  /** `false` para guardarlo sin comprimir (el `mimetype` de un EPUB lo exige). */
  comprimirlo?: boolean;
}

/** Tabla del CRC-32 (el control de integridad que lleva cada archivo del ZIP). */
const TABLA_DEL_CRC32 = (() => {
  const tabla = new Uint32Array(256);
  for (let byte = 0; byte < 256; byte++) {
    let valor = byte;
    for (let bit = 0; bit < 8; bit++) valor = valor & 1 ? 0xedb88320 ^ (valor >>> 1) : valor >>> 1;
    tabla[byte] = valor >>> 0;
  }
  return tabla;
})();

/** CRC-32 de unos bytes. */
export function calcularCrc32(bytes: Uint8Array): number {
  let valorDelCrc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) valorDelCrc = TABLA_DEL_CRC32[(valorDelCrc ^ bytes[i]) & 0xff] ^ (valorDelCrc >>> 8);
  return (valorDelCrc ^ 0xffffffff) >>> 0;
}

/** Comprime con el `CompressionStream` del sistema (`deflate-raw` para ZIP, `deflate` para PDF), o `null` si no está. */
export async function comprimirBytes(bytes: Uint8Array, formatoDeCompresion: "deflate-raw" | "deflate"): Promise<Uint8Array | null> {
  try {
    if (typeof CompressionStream === "undefined") return null;
    const flujoComprimido = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream(formatoDeCompresion as CompressionFormat));
    return new Uint8Array(await new Response(flujoComprimido).arrayBuffer());
  } catch {
    return null;
  }
}

/** Une varios trozos de bytes en uno. */
export function unirBytes(trozos: Uint8Array[]): Uint8Array {
  const largoTotal = trozos.reduce((total, trozo) => total + trozo.length, 0);
  const bytesUnidos = new Uint8Array(largoTotal);
  let posicion = 0;
  for (const trozo of trozos) {
    bytesUnidos.set(trozo, posicion);
    posicion += trozo.length;
  }
  return bytesUnidos;
}

/** Arma el ZIP con los archivos en el orden dado. */
export async function crearZip(archivos: ArchivoDentroDelZip[]): Promise<Uint8Array> {
  const codificadorUtf8 = new TextEncoder();
  const encabezadosLocales: Uint8Array[] = [];
  const directorioCentral: Uint8Array[] = [];
  let posicionDelArchivoEnElZip = 0;
  // Fecha y hora en formato MS-DOS (las del momento de exportar).
  const ahora = new Date();
  const horaMsDos = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
  const fechaMsDos = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();

  for (const archivo of archivos) {
    const nombreEnBytes = codificadorUtf8.encode(archivo.nombre);
    const contenidoEnBytes = typeof archivo.contenido === "string" ? codificadorUtf8.encode(archivo.contenido) : archivo.contenido;
    const contenidoComprimido = archivo.comprimirlo === false ? null : await comprimirBytes(contenidoEnBytes, "deflate-raw");
    const metodoDeCompresion = contenidoComprimido ? 8 : 0;
    const bytesGuardados = contenidoComprimido ?? contenidoEnBytes;
    const crcDelContenido = calcularCrc32(contenidoEnBytes);

    const encabezadoLocal = new DataView(new ArrayBuffer(30));
    encabezadoLocal.setUint32(0, 0x04034b50, true);
    encabezadoLocal.setUint16(4, 20, true);
    encabezadoLocal.setUint16(6, 0x0800, true); // nombres en UTF-8
    encabezadoLocal.setUint16(8, metodoDeCompresion, true);
    encabezadoLocal.setUint16(10, horaMsDos, true);
    encabezadoLocal.setUint16(12, fechaMsDos, true);
    encabezadoLocal.setUint32(14, crcDelContenido, true);
    encabezadoLocal.setUint32(18, bytesGuardados.length, true);
    encabezadoLocal.setUint32(22, contenidoEnBytes.length, true);
    encabezadoLocal.setUint16(26, nombreEnBytes.length, true);
    encabezadoLocal.setUint16(28, 0, true);
    encabezadosLocales.push(new Uint8Array(encabezadoLocal.buffer), nombreEnBytes, bytesGuardados);

    const entradaDelDirectorio = new DataView(new ArrayBuffer(46));
    entradaDelDirectorio.setUint32(0, 0x02014b50, true);
    entradaDelDirectorio.setUint16(4, 20, true);
    entradaDelDirectorio.setUint16(6, 20, true);
    entradaDelDirectorio.setUint16(8, 0x0800, true);
    entradaDelDirectorio.setUint16(10, metodoDeCompresion, true);
    entradaDelDirectorio.setUint16(12, horaMsDos, true);
    entradaDelDirectorio.setUint16(14, fechaMsDos, true);
    entradaDelDirectorio.setUint32(16, crcDelContenido, true);
    entradaDelDirectorio.setUint32(20, bytesGuardados.length, true);
    entradaDelDirectorio.setUint32(24, contenidoEnBytes.length, true);
    entradaDelDirectorio.setUint16(28, nombreEnBytes.length, true);
    entradaDelDirectorio.setUint32(42, posicionDelArchivoEnElZip, true);
    directorioCentral.push(new Uint8Array(entradaDelDirectorio.buffer), nombreEnBytes);
    posicionDelArchivoEnElZip += 30 + nombreEnBytes.length + bytesGuardados.length;
  }

  const largoDelDirectorioCentral = directorioCentral.reduce((total, trozo) => total + trozo.length, 0);
  const finDelDirectorio = new DataView(new ArrayBuffer(22));
  finDelDirectorio.setUint32(0, 0x06054b50, true);
  finDelDirectorio.setUint16(8, archivos.length, true);
  finDelDirectorio.setUint16(10, archivos.length, true);
  finDelDirectorio.setUint32(12, largoDelDirectorioCentral, true);
  finDelDirectorio.setUint32(16, posicionDelArchivoEnElZip, true);
  return unirBytes([...encabezadosLocales, ...directorioCentral, new Uint8Array(finDelDirectorio.buffer)]);
}
