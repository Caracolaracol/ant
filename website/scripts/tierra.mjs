// Genera `src/assets/tierra.svg`, el grano de la tierra que va de fondo en todo el sitio: granos
// con lugar, tamaño, forma y tono al azar (semilla fija, así sale siempre igual), para que la
// tierra no se vea como una cuadrícula de puntos. Es un mosaico de 640×560 que se repite sin
// cortes. Se corre a mano solo si se quiere cambiar la textura: `node scripts/tierra.mjs`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ANCHO = 640;
const ALTO = 560;
const CLARO = '#ffecd2';
const OSCURO = '#000';

/** Números al azar repetibles (mulberry32): la misma semilla da siempre la misma tierra. */
function azar(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = azar(2026);
const entre = (a, b) => a + r() * (b - a);
/** Desviación normal (Box-Muller), para apiñar los granos de un grumo. */
const normal = (sigma) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()) * sigma;
const dec = (n) => String(Math.round(n * 10) / 10);

// Cada grano es un trazo corto de punta redonda. Se agrupan por color, opacidad y grosor en un
// solo `<path>` por grupo, para que el SVG pese poco.
const grupos = new Map();

/** Agrega un grano; si toca un borde se repite del otro lado para que el mosaico no tenga cortes. */
function grano(color, [opMin, opMax], [gMin, gMax], x = entre(0, ANCHO), y = entre(0, ALTO)) {
  x = ((x % ANCHO) + ANCHO) % ANCHO;
  y = ((y % ALTO) + ALTO) % ALTO;
  const op = Math.round(entre(opMin, opMax) * 100) / 100;
  const g = Math.round(entre(gMin, gMax) * 2) / 2;
  // Algunos granos son alargados, en cualquier dirección.
  const largo = r() < 0.6 ? [0, 0] : [entre(-1, 1) * g * 0.6, entre(-1, 1) * g * 0.6];
  const clave = `${color}|${op}|${g}`;
  if (!grupos.has(clave)) grupos.set(clave, []);
  for (const ox of [-ANCHO, 0, ANCHO]) {
    for (const oy of [-ALTO, 0, ALTO]) {
      const px = x + ox;
      const py = y + oy;
      if (px >= -g && px <= ANCHO + g && py >= -g && py <= ALTO + g) {
        grupos.get(clave).push(`M${dec(px)} ${dec(py)}l${dec(largo[0])} ${dec(largo[1])}`);
      }
    }
  }
}

for (let i = 0; i < 650; i++) grano(CLARO, [0.03, 0.09], [1, 2.5]); // granos claros
for (let i = 0; i < 520; i++) grano(OSCURO, [0.1, 0.3], [1, 3]); // granos oscuros
for (let i = 0; i < 12; i++) grano(CLARO, [0.03, 0.06], [3.5, 6]); // piedritas claras
for (let i = 0; i < 16; i++) grano(OSCURO, [0.1, 0.2], [3.5, 6.5]); // piedritas oscuras
// Grumos: de 4 a 10 granos apiñados, como tierra apelmazada.
for (let i = 0; i < 30; i++) {
  const cx = entre(0, ANCHO);
  const cy = entre(0, ALTO);
  const n = 4 + Math.floor(r() * 7);
  for (let j = 0; j < n; j++) {
    const claro = r() < 1 / 3;
    grano(claro ? CLARO : OSCURO, claro ? [0.04, 0.08] : [0.12, 0.26], [1, 2.5], cx + normal(6), cy + normal(6));
  }
}

const trazos = [...grupos]
  .map(([clave, d]) => {
    const [color, op, g] = clave.split('|');
    return `<path stroke="${color}" stroke-opacity="${op}" stroke-width="${g}" d="${d.join('')}"/>`;
  })
  .join('');
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" fill="none" stroke-linecap="round">` +
  `<!-- Generado por scripts/tierra.mjs; no editar a mano. -->${trazos}</svg>\n`;

const destino = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'tierra.svg');
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, svg);
console.log(`${destino}: ${svg.length} bytes`);
