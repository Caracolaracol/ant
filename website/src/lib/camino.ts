// Caminos por el plano del nido: una línea que pasa por varios puntos y dobla con curvas suaves en
// cada esquina, muestreada en puntos cercanos con la distancia recorrida hasta cada uno. La usan
// el recorrido de la portada (`hormiguero.ts`: por dónde viaja la vista, que dobla hacia abajo al
// final de cada piso) y el dibujo del túnel (`cavar.ts`: la línea central del túnel).

/** Un punto del plano: `[x, y]` en píxeles. */
export type Punto = [number, number];

/** Un camino muestreado: sus puntos y la distancia recorrida desde el inicio hasta cada uno. */
export interface Camino {
  puntos: Punto[];
  distancias: number[];
  largo: number;
}

const distanciaEntre = (desde: Punto, hasta: Punto) => Math.hypot(hasta[0] - desde[0], hasta[1] - desde[1]);

/** Dirección de `desde` a `hasta`, de largo 1 (o `[0, 0]` si son el mismo punto). */
function direccionEntre(desde: Punto, hasta: Punto): Punto {
  const largo = distanciaEntre(desde, hasta);
  return largo === 0 ? [0, 0] : [(hasta[0] - desde[0]) / largo, (hasta[1] - desde[1]) / largo];
}

/**
 * Puntos cada `paso` píxeles (más o menos) a lo largo de la línea que une los `vertices`. En cada
 * vértice donde la línea cambia de dirección, la esquina se reemplaza por una curva (Bézier
 * cuadrática) que empieza y termina a `radioDeLasCurvas` del vértice, o a la mitad del tramo si
 * el tramo es más corto.
 */
export function muestrearLinea(vertices: Punto[], radioDeLasCurvas: number, paso: number): Punto[] {
  const sinRepetidos = vertices.filter((vertice, i) => i === 0 || distanciaEntre(vertices[i - 1], vertice) > 0.5);
  if (sinRepetidos.length < 2) return sinRepetidos.slice();
  const puntos: Punto[] = [sinRepetidos[0]];
  /** Agrega los puntos de una recta hasta `hasta`, sin repetir el de partida. */
  const agregarRecta = (hasta: Punto) => {
    const desde = puntos[puntos.length - 1];
    const cantidad = Math.max(1, Math.ceil(distanciaEntre(desde, hasta) / paso));
    for (let i = 1; i <= cantidad; i++) {
      puntos.push([desde[0] + ((hasta[0] - desde[0]) * i) / cantidad, desde[1] + ((hasta[1] - desde[1]) * i) / cantidad]);
    }
  };
  for (let i = 1; i < sinRepetidos.length - 1; i++) {
    const anterior = sinRepetidos[i - 1], esquina = sinRepetidos[i], siguiente = sinRepetidos[i + 1];
    const direccionDeLlegada = direccionEntre(anterior, esquina);
    const direccionDeSalida = direccionEntre(esquina, siguiente);
    const sigueRecto = Math.abs(direccionDeLlegada[0] * direccionDeSalida[1] - direccionDeLlegada[1] * direccionDeSalida[0]) < 0.01
      && direccionDeLlegada[0] * direccionDeSalida[0] + direccionDeLlegada[1] * direccionDeSalida[1] > 0;
    const recorte = sigueRecto ? 0 : Math.min(radioDeLasCurvas, distanciaEntre(anterior, esquina) / 2, distanciaEntre(esquina, siguiente) / 2);
    if (recorte === 0) {
      agregarRecta(esquina);
      continue;
    }
    const inicioDeLaCurva: Punto = [esquina[0] - direccionDeLlegada[0] * recorte, esquina[1] - direccionDeLlegada[1] * recorte];
    const finDeLaCurva: Punto = [esquina[0] + direccionDeSalida[0] * recorte, esquina[1] + direccionDeSalida[1] * recorte];
    agregarRecta(inicioDeLaCurva);
    const cantidad = Math.max(2, Math.ceil((recorte * 1.6) / paso));
    for (let j = 1; j <= cantidad; j++) {
      const t = j / cantidad;
      const resto = 1 - t;
      puntos.push([
        resto * resto * inicioDeLaCurva[0] + 2 * resto * t * esquina[0] + t * t * finDeLaCurva[0],
        resto * resto * inicioDeLaCurva[1] + 2 * resto * t * esquina[1] + t * t * finDeLaCurva[1],
      ]);
    }
  }
  agregarRecta(sinRepetidos[sinRepetidos.length - 1]);
  return puntos;
}

/** Camino que pasa por los `vertices`, con curvas en las esquinas (ver `muestrearLinea`). */
export function crearCamino(vertices: Punto[], radioDeLasCurvas: number, paso = 4): Camino {
  const puntos = muestrearLinea(vertices, radioDeLasCurvas, paso);
  const distancias = [0];
  for (let i = 1; i < puntos.length; i++) distancias.push(distancias[i - 1] + distanciaEntre(puntos[i - 1], puntos[i]));
  return { puntos, distancias, largo: distancias[distancias.length - 1] ?? 0 };
}

/** Índice del último punto del camino que está antes de `distancia` (búsqueda binaria). */
function indiceAntesDe(camino: Camino, distancia: number): number {
  let desde = 0, hasta = camino.distancias.length - 1;
  while (hasta - desde > 1) {
    const medio = (desde + hasta) >> 1;
    if (camino.distancias[medio] <= distancia) desde = medio;
    else hasta = medio;
  }
  return desde;
}

/** Punto del camino a `distancia` de su inicio (entre los dos puntos muestreados más cercanos). */
export function puntoDelCamino(camino: Camino, distancia: number): Punto {
  if (camino.puntos.length === 0) return [0, 0];
  if (camino.puntos.length === 1 || distancia <= 0) return camino.puntos[0];
  if (distancia >= camino.largo) return camino.puntos[camino.puntos.length - 1];
  const i = indiceAntesDe(camino, distancia);
  const tramo = camino.distancias[i + 1] - camino.distancias[i] || 1;
  const t = (distancia - camino.distancias[i]) / tramo;
  const desde = camino.puntos[i], hasta = camino.puntos[i + 1];
  return [desde[0] + (hasta[0] - desde[0]) * t, desde[1] + (hasta[1] - desde[1]) * t];
}

/** Hacia dónde va el camino a `distancia` de su inicio, de largo 1. */
export function direccionDelCamino(camino: Camino, distancia: number): Punto {
  if (camino.puntos.length < 2) return [1, 0];
  const i = Math.min(indiceAntesDe(camino, distancia), camino.puntos.length - 2);
  return direccionEntre(camino.puntos[i], camino.puntos[i + 1]);
}

/** Distancia desde el inicio del camino hasta su punto más cercano a `punto`. */
export function distanciaMasCercana(camino: Camino, punto: Punto): number {
  let mejorDistancia = 0, menorSeparacion = Infinity;
  camino.puntos.forEach((puntoDelCamino, i) => {
    const separacion = distanciaEntre(puntoDelCamino, punto);
    if (separacion < menorSeparacion) {
      menorSeparacion = separacion;
      mejorDistancia = camino.distancias[i];
    }
  });
  return mejorDistancia;
}
