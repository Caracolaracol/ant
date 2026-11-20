// Escritor de archivos ZIP mínimo, sin dependencias: un .docx (y más adelante un .epub) es un ZIP
// con archivos XML adentro. Comprime con `CompressionStream("deflate-raw")` del navegador cuando
// existe; si no, guarda los archivos sin comprimir, que también es un ZIP válido.

/** Un archivo dentro del ZIP. */
export interface ArchivoZip {
  nombre: string;
  datos: Uint8Array | string;
  /** `false` para guardarlo sin comprimir (el `mimetype` de un EPUB lo exige). */
  comprimir?: boolean;
}

/** Tabla del CRC-32 (el control de integridad que lleva cada archivo del ZIP). */
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 de unos bytes. */
export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Comprime con el `CompressionStream` del sistema (`deflate-raw` para ZIP, `deflate` para PDF), o `null` si no está. */
export async function comprimir(datos: Uint8Array, formato: "deflate-raw" | "deflate"): Promise<Uint8Array | null> {
  try {
    if (typeof CompressionStream === "undefined") return null;
    const flujo = new Blob([datos as BlobPart]).stream().pipeThrough(new CompressionStream(formato as CompressionFormat));
    return new Uint8Array(await new Response(flujo).arrayBuffer());
  } catch {
    return null;
  }
}

/** Une varios trozos de bytes en uno. */
export function unir(trozos: Uint8Array[]): Uint8Array {
  const total = trozos.reduce((s, t) => s + t.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const t of trozos) {
    out.set(t, pos);
    pos += t.length;
  }
  return out;
}

/** Arma el ZIP con los archivos en el orden dado. */
export async function crearZip(archivos: ArchivoZip[]): Promise<Uint8Array> {
  const cod = new TextEncoder();
  const locales: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let desplazamiento = 0;
  // Fecha y hora en formato MS-DOS (la del momento de exportar).
  const ahora = new Date();
  const hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
  const fecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();

  for (const a of archivos) {
    const nombre = cod.encode(a.nombre);
    const datos = typeof a.datos === "string" ? cod.encode(a.datos) : a.datos;
    const comprimido = a.comprimir === false ? null : await comprimir(datos, "deflate-raw");
    const metodo = comprimido ? 8 : 0;
    const cuerpo = comprimido ?? datos;
    const crc = crc32(datos);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint16(8, metodo, true);
    local.setUint16(10, hora, true);
    local.setUint16(12, fecha, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, cuerpo.length, true);
    local.setUint32(22, datos.length, true);
    local.setUint16(26, nombre.length, true);
    local.setUint16(28, 0, true);
    locales.push(new Uint8Array(local.buffer), nombre, cuerpo);

    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, metodo, true);
    c.setUint16(12, hora, true);
    c.setUint16(14, fecha, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, cuerpo.length, true);
    c.setUint32(24, datos.length, true);
    c.setUint16(28, nombre.length, true);
    c.setUint32(42, desplazamiento, true);
    central.push(new Uint8Array(c.buffer), nombre);
    desplazamiento += 30 + nombre.length + cuerpo.length;
  }

  const tamCentral = central.reduce((s, t) => s + t.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, desplazamiento, true);
  return unir([...locales, ...central, new Uint8Array(fin.buffer)]);
}
