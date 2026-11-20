// Dibuja las cámaras y el túnel del nido con bordes imperfectos, como cavados por hormigas.
//
// CSS solo da curvas perfectas (border-radius), así que cada hueco recibe un SVG detrás con un
// contorno irregular: una forma entre rectángulo y elipse (superelipse) a la que se le suman
// ondulaciones de distinto tamaño y un temblor fino en cada punto, y que luego se suaviza con
// curvas. La forma se calcula en píxeles reales del hueco (no se estira) y se vuelve a dibujar si
// cambia de tamaño. Cada hueco usa su propia semilla, así su forma es distinta a la de los demás
// pero no cambia al redibujar. Sin JavaScript, quedan los bordes redondeados del CSS.

const NS = 'http://www.w3.org/2000/svg';
/** Cuánto sobresale el SVG del hueco por cada lado, para que las ondas no corten el contenido. */
const MARGEN = 14;

type Punto = [number, number];

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

/** Borde de arriba o de abajo del túnel: una línea ondulada a lo largo de todo el nido. */
function bordeTunel(ancho: number, y: number, r: () => number): Punto[] {
  const fases = [r(), r(), r()].map((f) => f * Math.PI * 2);
  const puntos: Punto[] = [];
  for (let x = 0; x <= ancho + 24; x += 24) {
    const ola = 4 * Math.sin(x / 140 + fases[0]) + 2.5 * Math.sin(x / 53 + fases[1]) + 1.5 * Math.sin(x / 23 + fases[2]);
    puntos.push([x, y + ola + (r() - 0.5) * 2]);
  }
  return puntos;
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
 * Dibuja los bordes imperfectos de todas las cámaras y del túnel (si `tunel`), y los rehace al
 * cambiar de tamaño.
 */
export function cavar(fila: HTMLElement, { tunel = true } = {}) {
  crearFiltro();
  const huecos = [...fila.querySelectorAll<HTMLElement>('.hueco')];

  const dibujarHueco = (hueco: HTMLElement, i: number) => {
    const { offsetWidth: w, offsetHeight: h } = hueco;
    if (!w || !h) return;
    const path = forma(hueco, 'hueco-forma');
    const svg = path.ownerSVGElement!;
    svg.setAttribute('width', String(w + MARGEN * 2));
    svg.setAttribute('height', String(h + MARGEN * 2));
    const semilla = 7919 * (i + 1);
    path.setAttribute('d', hueco.classList.contains('gigante') ? contornoRectangular(w, h, semilla) : contornoCamara(w, h, semilla));
    hueco.classList.add('cavado');
  };

  // El túnel nace en el borde izquierdo y termina dentro de la última cámara (a la mitad de su
  // hueco, tapado por ella): es el final del nido y no sale otro túnel hacia la derecha.
  const dibujarTunel = () => {
    const ultimo = huecos[huecos.length - 1];
    const w = ultimo
      ? ultimo.getBoundingClientRect().left - fila.getBoundingClientRect().left + ultimo.offsetWidth / 2
      : fila.scrollWidth;
    const alto = 70;
    const path = forma(fila, 'tunel');
    const svg = path.ownerSVGElement!;
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(alto));
    const r = azar(424242);
    const arriba = bordeTunel(w, 9, r);
    const abajo = bordeTunel(w, alto - 9, r).reverse();
    path.setAttribute('d', curva(arriba, false) + curva(abajo, false).replace(/^M/, 'L') + 'Z');
    fila.classList.add('con-tunel');
  };

  // Redibuja en el siguiente cuadro, una sola vez aunque cambien varios tamaños a la vez.
  let pendiente = 0;
  const redibujar = () => {
    cancelAnimationFrame(pendiente);
    pendiente = requestAnimationFrame(() => {
      huecos.forEach(dibujarHueco);
      if (tunel) dibujarTunel();
    });
  };
  const observador = new ResizeObserver(redibujar);
  huecos.forEach((h) => observador.observe(h));
  observador.observe(fila);
  redibujar();
}
