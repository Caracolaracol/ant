// Dibuja las cámaras y el túnel del nido con bordes imperfectos, como cavados por hormigas.
//
// El túnel sigue las líneas que le pasa quien arma el nido (`hormiguero.ts`): en la portada va de
// cámara en cámara, baja al final de cada piso y tiene un ramal sin salida; en pantallas angostas
// baja derecho. Sus bordes ondulan a lo largo de la línea, así se ven igual de cavados en un tramo
// horizontal, en uno vertical o en una curva.
//
// CSS solo da curvas perfectas (border-radius), así que cada hueco recibe un SVG detrás con un
// contorno irregular: una forma entre rectángulo y elipse (superelipse) a la que se le suman
// ondulaciones de distinto tamaño y un temblor fino en cada punto, y que luego se suaviza con
// curvas. La forma se calcula en píxeles reales del hueco (no se estira) y se vuelve a dibujar si
// cambia de tamaño. Cada hueco usa su propia semilla, así su forma es distinta a la de los demás
// pero no cambia al redibujar. Sin JavaScript, quedan los bordes redondeados del CSS.

import { muestrearLinea, type Punto } from './camino';

const NS = 'http://www.w3.org/2000/svg';
/** Cuánto sobresale el SVG del hueco por cada lado, para que las ondas no corten el contenido. */
const MARGEN = 14;

/** Números pseudoaleatorios repetibles a partir de una semilla (mulberry32). */
function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Une los puntos con curvas suaves (Catmull-Rom convertido a Bézier); `cerrado` une el último con el primero. */
function curva(p: Punto[], cerrado: boolean): string {
  const n = p.length;
  const en = (i: number) => (cerrado ? p[(i + n) % n] : p[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  const tramos = cerrado ? n : n - 1;
  for (let i = 0; i < tramos; i++) {
    const [a, b, c, e] = [en(i - 1), en(i), en(i + 1), en(i + 2)];
    const c1: Punto = [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6];
    const c2: Punto = [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${c[0].toFixed(1)} ${c[1].toFixed(1)}`;
  }
  return cerrado ? d + 'Z' : d;
}

/**
 * Contorno cerrado e irregular para un hueco de `ancho`×`alto` (más el margen). Las ondas
 * grandes deforman la silueta; las chicas y el temblor por punto le dan la textura de tierra.
 */
function contornoCamara(ancho: number, alto: number, semilla: number): string {
  const r = azar(semilla);
  const cx = ancho / 2 + MARGEN, cy = alto / 2 + MARGEN;
  const a = ancho / 2 + 4, b = alto / 2 + 4;
  const exponente = 2 / (3 + r() * 1.5); // entre elipse (2) y rectángulo (∞)
  const menor = Math.min(ancho, alto);
  const ondas = [2, 3, 5, 7, 11, 17].map((k, i) => ({
    k,
    amp: Math.min(menor * [0.03, 0.025, 0.018, 0.012, 0.008, 0.005][i], [12, 10, 7, 5, 3.5, 2.5][i]) * (0.6 + r() * 0.8),
    fase: r() * Math.PI * 2,
  }));
  const n = Math.max(48, Math.round((2 * (ancho + alto)) / 18));
  const puntos: Punto[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const cos = Math.cos(t), sin = Math.sin(t);
    const x = a * Math.sign(cos) * Math.abs(cos) ** exponente;
    const y = b * Math.sign(sin) * Math.abs(sin) ** exponente;
    let d = (r() - 0.5) * 3.5;
    for (const o of ondas) d += o.amp * Math.sin(o.k * t + o.fase);
    // La onda se aplica hacia afuera/adentro según la dirección del punto desde el centro.
    const largo = Math.hypot(x, y) || 1;
    puntos.push([cx + x + (x / largo) * d, cy + y + (y / largo) * d]);
  }
  return curva(puntos, true);
}

/**
 * Contorno irregular que sigue un rectángulo de esquinas redondeadas, para la cámara gigante de
 * la documentación: así queda pegada a los bordes de la ventana en vez de angostarse arriba y
 * abajo como una elipse. Las ondas se miden en píxeles a lo largo del borde (no en ángulos), así
 * tienen el mismo tamaño en un borde corto que en uno muy largo.
 */
function contornoRectangular(ancho: number, alto: number, semilla: number): string {
  const r = azar(semilla);
  const radio = Math.min(56, ancho / 4, alto / 4);
  const x0 = MARGEN, y0 = MARGEN, x1 = MARGEN + ancho, y1 = MARGEN + alto;
  // Tramos del borde en orden (sentido horario): rectas y cuartos de círculo en las esquinas.
  const rectoH = ancho - 2 * radio, rectoV = alto - 2 * radio, arco = (Math.PI / 2) * radio;
  const perimetro = 2 * rectoH + 2 * rectoV + 4 * arco;
  /** Punto y normal hacia afuera a una distancia `s` del inicio del borde. */
  const enBorde = (s: number): [number, number, number, number] => {
    const tramos: Array<[number, (u: number) => [number, number, number, number]]> = [
      [rectoH, (u) => [x0 + radio + u, y0, 0, -1]],
      [arco, (u) => { const a = -Math.PI / 2 + u / radio; return [x1 - radio + Math.cos(a) * radio, y0 + radio + Math.sin(a) * radio, Math.cos(a), Math.sin(a)]; }],
      [rectoV, (u) => [x1, y0 + radio + u, 1, 0]],
      [arco, (u) => { const a = u / radio; return [x1 - radio + Math.cos(a) * radio, y1 - radio + Math.sin(a) * radio, Math.cos(a), Math.sin(a)]; }],
      [rectoH, (u) => [x1 - radio - u, y1, 0, 1]],
      [arco, (u) => { const a = Math.PI / 2 + u / radio; return [x0 + radio + Math.cos(a) * radio, y1 - radio + Math.sin(a) * radio, Math.cos(a), Math.sin(a)]; }],
      [rectoV, (u) => [x0, y1 - radio - u, -1, 0]],
      [arco, (u) => { const a = Math.PI + u / radio; return [x0 + radio + Math.cos(a) * radio, y0 + radio + Math.sin(a) * radio, Math.cos(a), Math.sin(a)]; }],
    ];
    for (const [largo, f] of tramos) {
      if (s <= largo) return f(s);
      s -= largo;
    }
    return tramos[0][1](0);
  };
  // Largos de onda en píxeles, ajustados para que entren un número entero de veces en el borde
  // (si no, quedaría un salto donde el contorno se cierra).
  const ondas = [[520, 9], [260, 6.5], [130, 4.5], [70, 2.8], [37, 1.6]].map(([largo, amp]) => ({
    vueltas: Math.max(1, Math.round(perimetro / largo)),
    amp: amp * (0.6 + r() * 0.8),
    fase: r() * Math.PI * 2,
  }));
  const n = Math.max(48, Math.round(perimetro / 18));
  const puntos: Punto[] = [];
  for (let i = 0; i < n; i++) {
    const s = (i / n) * perimetro;
    const [x, y, nx, ny] = enBorde(s);
    let d = (r() - 0.5) * 3.5;
    for (const o of ondas) d += o.amp * Math.sin((o.vueltas * 2 * Math.PI * s) / perimetro + o.fase);
    puntos.push([x + nx * d, y + ny * d]);
  }
  return curva(puntos, true);
}

/** Mitad del ancho del túnel, sin contar las ondas de sus bordes. */
const MEDIO_ANCHO_DEL_TUNEL = 26;

/** Un tramo del túnel: la línea que sigue y, si se abre como una boca al empezar, cuánto. */
export interface TramoDelTunel {
  vertices: Punto[];
  /** Cuánto más ancho (en píxeles, de cada lado) es el tramo en su inicio. */
  ensancheAlInicio?: number;
  /** En cuántos píxeles de recorrido se va angostando hasta el ancho normal. */
  largoDelEnsanche?: number;
}

/**
 * Contorno cerrado de un tramo de túnel que sigue la línea de sus `vertices`: los dos bordes se
 * apartan de la línea hacia cada lado, con ondas de distinto largo que se miden a lo largo del
 * camino (así un tramo vertical ondula igual que uno horizontal) y un temblor fino. Si el tramo
 * tiene ensanche, empieza más ancho y se angosta suavemente.
 */
function contornoDelTunel({ vertices, ensancheAlInicio = 0, largoDelEnsanche = 1 }: TramoDelTunel, azarDelTunel: () => number): string {
  const centro = muestrearLinea(vertices, 160, 24);
  /** Ancho extra en un punto del recorrido: todo el ensanche al inicio, nada al final de su largo. */
  const ensancheEn = (recorrido: number) => ensancheAlInicio * Math.pow(Math.max(0, 1 - recorrido / largoDelEnsanche), 1.6);
  if (centro.length < 2) return '';
  const fasesDeUnLado = [azarDelTunel(), azarDelTunel(), azarDelTunel()].map((fase) => fase * Math.PI * 2);
  const fasesDelOtroLado = [azarDelTunel(), azarDelTunel(), azarDelTunel()].map((fase) => fase * Math.PI * 2);
  const ondaDelBorde = (recorrido: number, fases: number[]) =>
    4 * Math.sin(recorrido / 140 + fases[0]) + 2.5 * Math.sin(recorrido / 53 + fases[1]) + 1.5 * Math.sin(recorrido / 23 + fases[2]);
  const unLado: Punto[] = [], otroLado: Punto[] = [];
  let recorrido = 0;
  centro.forEach((punto, i) => {
    const anterior = centro[Math.max(0, i - 1)], siguiente = centro[Math.min(centro.length - 1, i + 1)];
    if (i > 0) recorrido += Math.hypot(punto[0] - anterior[0], punto[1] - anterior[1]);
    const largo = Math.hypot(siguiente[0] - anterior[0], siguiente[1] - anterior[1]) || 1;
    // Perpendicular a la línea en este punto.
    const normalX = -(siguiente[1] - anterior[1]) / largo, normalY = (siguiente[0] - anterior[0]) / largo;
    const apartadoDeUnLado = MEDIO_ANCHO_DEL_TUNEL + ensancheEn(recorrido) + ondaDelBorde(recorrido, fasesDeUnLado) + (azarDelTunel() - 0.5) * 2;
    const apartadoDelOtroLado = MEDIO_ANCHO_DEL_TUNEL + ensancheEn(recorrido) + ondaDelBorde(recorrido, fasesDelOtroLado) + (azarDelTunel() - 0.5) * 2;
    unLado.push([punto[0] + normalX * apartadoDeUnLado, punto[1] + normalY * apartadoDeUnLado]);
    otroLado.push([punto[0] - normalX * apartadoDelOtroLado, punto[1] - normalY * apartadoDelOtroLado]);
  });
  return curva(unLado, false) + curva(otroLado.reverse(), false).replace(/^M/, 'L') + 'Z';
}

/** Filtro de sombra interior (la tierra hace sombra hacia adentro del hueco), compartido por todos. */
function crearFiltro() {
  if (document.getElementById('sombra-cavada')) return;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.innerHTML = `
    <filter id="sombra-cavada" x="-5%" y="-5%" width="110%" height="110%">
      <feComponentTransfer in="SourceAlpha" result="fuera"><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
      <feGaussianBlur in="fuera" stdDeviation="16" result="difusa" />
      <feOffset in="difusa" dy="6" result="caida" />
      <feComposite in="caida" in2="SourceAlpha" operator="in" result="dentro" />
      <feComponentTransfer in="dentro" result="sombra"><feFuncA type="linear" slope="0.4" /></feComponentTransfer>
      <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="sombra" /></feMerge>
    </filter>`;
  document.body.append(svg);
}

/** Crea (o reutiliza) el SVG de forma dentro de un elemento y devuelve su `<path>`. */
function forma(contenedor: HTMLElement, clase: string): SVGPathElement {
  let svg = contenedor.querySelector<SVGSVGElement>(`:scope > svg.${clase}`);
  if (!svg) {
    svg = document.createElementNS(NS, 'svg');
    svg.classList.add(clase);
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('filter', 'url(#sombra-cavada)');
    svg.append(path);
    contenedor.prepend(svg);
  }
  return svg.querySelector('path')!;
}

/**
 * Dibuja los bordes imperfectos de todas las cámaras (los huecos) dentro de `fila`, y los rehace
 * cuando una cambia de tamaño. El túnel va aparte (`dibujarTunel`), porque depende de dónde quedó
 * cada cámara.
 */
export function cavarHuecos(fila: HTMLElement) {
  crearFiltro();
  const huecos = [...fila.querySelectorAll<HTMLElement>('.hueco')];

  const dibujarHueco = (hueco: HTMLElement, i: number) => {
    const { offsetWidth: ancho, offsetHeight: alto } = hueco;
    if (!ancho || !alto) return;
    const path = forma(hueco, 'hueco-forma');
    const svg = path.ownerSVGElement!;
    svg.setAttribute('width', String(ancho + MARGEN * 2));
    svg.setAttribute('height', String(alto + MARGEN * 2));
    const semilla = 7919 * (i + 1);
    path.setAttribute('d', hueco.classList.contains('gigante') ? contornoRectangular(ancho, alto, semilla) : contornoCamara(ancho, alto, semilla));
    hueco.classList.add('cavado');
  };

  // Redibuja en el siguiente cuadro, una sola vez aunque cambien varios tamaños a la vez.
  let pendiente = 0;
  const redibujar = () => {
    cancelAnimationFrame(pendiente);
    pendiente = requestAnimationFrame(() => huecos.forEach(dibujarHueco));
  };
  const observador = new ResizeObserver(redibujar);
  huecos.forEach((hueco) => observador.observe(hueco));
  redibujar();
}

/**
 * Dibuja el túnel detrás de las cámaras de `fila`: un contorno por cada tramo (puntos en píxeles
 * desde la esquina de arriba a la izquierda de `fila`), en un SVG del tamaño del plano. Siempre
 * con la misma semilla, así no cambia de forma al redibujarlo.
 */
export function dibujarTunel(fila: HTMLElement, tramos: TramoDelTunel[], anchoDelPlano: number, altoDelPlano: number) {
  crearFiltro();
  const path = forma(fila, 'tunel');
  const svg = path.ownerSVGElement!;
  svg.setAttribute('width', String(Math.ceil(anchoDelPlano)));
  svg.setAttribute('height', String(Math.ceil(altoDelPlano)));
  const azarDelTunel = azar(424242);
  path.setAttribute('d', tramos.map((tramo) => contornoDelTunel(tramo, azarDelTunel)).join(''));
  fila.classList.add('con-tunel');
}
