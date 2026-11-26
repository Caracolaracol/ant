// Recorrido de la portada: el nido es un hormiguero en corte que se recorre siguiendo su túnel.
//
// En pantallas anchas las cámaras se acomodan en pisos de `CAMARAS_POR_PISO`, en zigzag: el primer
// piso va hacia la derecha, al final el túnel dobla hacia abajo, el segundo va hacia la izquierda,
// vuelve a bajar, y así. La rueda del mouse (o el trackpad, o el dedo) no mueve el scroll del
// navegador sino un avance a lo largo de un camino (`camino.ts`) que pasa por cada cámara y dobla
// con una curva al final de cada piso: la vista va en horizontal por los pisos y baja suavemente
// en las curvas.
//
// Una cámara marcada con `data-ramal` (en la portada, «Cámaras cifradas») no está en el camino:
// queda en un ramal sin salida que sale del costado de la cámara anterior. Al llegar a esa cámara
// aparece un chevron flotando (`.desvio.adelante`) que lleva la vista por el ramal; allá, otro
// (`.desvio.atras`) la trae de vuelta, y la rueda también la devuelve al camino.
//
// En pantallas angostas (el mismo corte que el CSS) las cámaras quedan en una columna que se
// recorre con el scroll vertical normal, con el ramal en su lugar del orden. Sin JavaScript, el
// CSS deja la fila horizontal de siempre.

import { crearCamino, direccionDelCamino, distanciaMasCercana, puntoDelCamino, type Camino, type Punto } from './camino';
import { dibujarTunel } from './cavar';

/** Cámaras en cada piso antes de que el túnel doble hacia abajo. */
const CAMARAS_POR_PISO = 3;
/** Pantallas donde las cámaras van en columna (igual que `@media (max-width: 720px)` del CSS). */
const CONSULTA_DE_PANTALLA_ANGOSTA = '(max-width: 720px)';

export interface OpcionesDelRecorrido {
  /** Cuando cambian las paradas (las cámaras con hoyo abajo): al empezar y al pasar de ancho a angosto. */
  alCambiarLasParadas: (paradas: HTMLElement[], irALaParada: (indice: number) => void) => void;
  /** Cada vez que la vista se mueve: la parada actual y cuánto se ha recorrido (de 0 a 1). */
  alMoverse: (indiceDeLaParada: number, avance: number) => void;
  /** Chevron para tomar el ramal y chevron para volver de él (opcionales). */
  botonHaciaElRamal: HTMLButtonElement | null;
  botonDeVuelta: HTMLButtonElement | null;
}

/** Arma el recorrido del nido de la portada y lo mantiene al día al cambiar el tamaño de la ventana. */
export function recorrerHormiguero(nido: HTMLElement, fila: HTMLElement, opciones: OpcionesDelRecorrido) {
  const camaras = [...fila.querySelectorAll<HTMLElement>(':scope > .camara')];
  const camaraDelRamal = camaras.find((camara) => camara.hasAttribute('data-ramal')) ?? null;
  const camaraDeLaBifurcacion = camaraDelRamal ? camaras[camaras.indexOf(camaraDelRamal) - 1] ?? null : null;
  const camarasDelCamino = camaras.filter((camara) => camara !== camaraDelRamal);
  const pantallaAngosta = window.matchMedia(CONSULTA_DE_PANTALLA_ANGOSTA);
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
  const { botonHaciaElRamal, botonDeVuelta } = opciones;

  // Estado del nido doblado en pisos (pantallas anchas).
  let estaDoblado = false;
  let paradas: HTMLElement[] = [];
  let caminoPrincipal: Camino = crearCamino([[0, 0]], 0);
  /** Distancia en el camino principal hasta cada parada. */
  let distanciasDeLasParadas: number[] = [];
  let distanciaDeLaBifurcacion = 0;
  let caminoDelRamal: Camino | null = null;
  /** Posición de la vista (scroll) que muestra la cámara del ramal. */
  let vistaDeLaCamaraDelRamal: Punto = [0, 0];
  /** Dónde flotan los chevrons, en el plano: en el túnel del ramal, entre las dos cámaras. */
  let lugarDeLosChevrons: Punto = [0, 0];
  let avanceEnElCamino = 0;
  let estaEnElRamal = false;
  let avanceEnElRamal = 0;
  let animacionEnCurso = 0;
  /** Scroll que puso el recorrido, para notar cuando el navegador mueve el nido por su cuenta (Tab, buscar). */
  let scrollEsperado: Punto = [0, 0];

  const limitar = (valor: number, minimo: number, maximo: number) => Math.min(maximo, Math.max(minimo, valor));

  /** Centro del hueco de una cámara, en píxeles desde la esquina de `fila`. */
  const centroDelHueco = (camara: HTMLElement): Punto => {
    const hueco = camara.querySelector<HTMLElement>('.hueco') ?? camara;
    return [camara.offsetLeft + hueco.offsetLeft + hueco.offsetWidth / 2, camara.offsetTop + hueco.offsetTop + hueco.offsetHeight / 2];
  };

  /** Deja las cámaras como las pone el CSS (fila horizontal o columna), sin posiciones propias. */
  const quitarElDoblez = () => {
    estaDoblado = false;
    nido.classList.remove('doblado');
    fila.classList.remove('doblada');
    fila.style.width = fila.style.height = '';
    camaras.forEach((camara) => { camara.style.left = camara.style.top = camara.style.width = camara.style.height = ''; });
  };

  // ── Pantallas anchas: pisos en zigzag ──

  /** Acomoda las cámaras en pisos, arma el camino de la vista y dibuja el túnel. */
  const doblarEnPisos = (indiceQueSeMostraba: number, estabaEnElRamal: boolean) => {
    quitarElDoblez();
    const anchoDeLaVista = nido.clientWidth, altoDelPiso = nido.clientHeight;
    // Anchos medidos en la fila horizontal del CSS, antes de sacar las cámaras de ella.
    const anchos = new Map(camaras.map((camara) => [camara, camara.offsetWidth]));
    const separacionEntrePisos = Math.round(altoDelPiso * 0.12);
    const largoDelRamal = Math.round(anchoDeLaVista * 0.08);
    const posiciones = new Map<HTMLElement, { x: number; y: number }>();

    // Cada piso empieza bajo la última cámara del anterior (centrado con ella) y avanza hacia el
    // otro lado: los pares hacia la derecha, los impares hacia la izquierda.
    let centroDeLaUltimaDelPisoAnterior: number | null = null;
    const cantidadDePisos = Math.ceil(camarasDelCamino.length / CAMARAS_POR_PISO);
    for (let numeroDePiso = 0; numeroDePiso < cantidadDePisos; numeroDePiso++) {
      const piso = camarasDelCamino.slice(numeroDePiso * CAMARAS_POR_PISO, (numeroDePiso + 1) * CAMARAS_POR_PISO);
      const y = numeroDePiso * (altoDelPiso + separacionEntrePisos);
      const vaHaciaLaDerecha = numeroDePiso % 2 === 0;
      let bordeLibre = 0;
      piso.forEach((camara, i) => {
        const ancho = anchos.get(camara)!;
        const x = i === 0
          ? (centroDeLaUltimaDelPisoAnterior ?? ancho / 2) - ancho / 2
          : vaHaciaLaDerecha ? bordeLibre : bordeLibre - ancho;
        bordeLibre = vaHaciaLaDerecha ? x + ancho : x;
        posiciones.set(camara, { x, y });
      });
      const ultimaDelPiso = piso[piso.length - 1];
      centroDeLaUltimaDelPisoAnterior = posiciones.get(ultimaDelPiso)!.x + anchos.get(ultimaDelPiso)! / 2;
    }
    // El ramal sale hacia el costado libre de su cámara (el contrario al que trae el túnel).
    if (camaraDelRamal && camaraDeLaBifurcacion) {
      const origen = posiciones.get(camaraDeLaBifurcacion)!;
      const pisoDelOrigen = Math.round(origen.y / (altoDelPiso + separacionEntrePisos));
      const haciaLaDerecha = pisoDelOrigen % 2 === 0;
      const anchoDelRamal = anchos.get(camaraDelRamal)!;
      posiciones.set(camaraDelRamal, {
        x: haciaLaDerecha ? origen.x + anchos.get(camaraDeLaBifurcacion)! + largoDelRamal : origen.x - largoDelRamal - anchoDelRamal,
        y: origen.y,
      });
    }

    // Todo corrido para que nada quede a la izquierda del borde del plano, y el plano con espacio
    // para centrar en la vista cualquier cámara (también la primera y la del ramal).
    const izquierdaDeLaVistaCentrada = (camara: HTMLElement) => posiciones.get(camara)!.x + Math.min(0, anchos.get(camara)! / 2 - anchoDeLaVista / 2);
    const derechaDeLaVistaCentrada = (camara: HTMLElement) => posiciones.get(camara)!.x + Math.max(anchos.get(camara)!, anchos.get(camara)! / 2 + anchoDeLaVista / 2);
    const bordeIzquierdo = Math.min(...camaras.map(izquierdaDeLaVistaCentrada));
    posiciones.forEach((posicion) => { posicion.x -= bordeIzquierdo; });
    const anchoDelPlano = Math.max(...camaras.map(derechaDeLaVistaCentrada));
    const altoDelPlano = cantidadDePisos * (altoDelPiso + separacionEntrePisos) - separacionEntrePisos;

    estaDoblado = true;
    nido.classList.add('doblado');
    fila.classList.add('doblada');
    fila.style.width = `${anchoDelPlano}px`;
    fila.style.height = `${altoDelPlano}px`;
    camaras.forEach((camara) => {
      const posicion = posiciones.get(camara)!;
      camara.style.left = `${posicion.x}px`;
      camara.style.top = `${posicion.y}px`;
      camara.style.width = `${anchos.get(camara)}px`;
      camara.style.height = `${altoDelPiso}px`;
    });

    /** Scroll que muestra una cámara: centrada si cabe, y si no, desde su borde izquierdo. */
    const vistaDeLaCamara = (camara: HTMLElement): Punto => {
      const { x, y } = posiciones.get(camara)!;
      const ancho = anchos.get(camara)!;
      const izquierda = ancho >= anchoDeLaVista ? x : x + ancho / 2 - anchoDeLaVista / 2;
      return [limitar(izquierda, 0, Math.max(0, anchoDelPlano - anchoDeLaVista)), limitar(y, 0, Math.max(0, altoDelPlano - altoDelPiso))];
    };

    paradas = camarasDelCamino;
    // Las curvas de la vista son cortas: así la vista para casi justo en la cámara de la esquina.
    caminoPrincipal = crearCamino(paradas.map(vistaDeLaCamara), Math.min(anchoDeLaVista, altoDelPiso) * 0.22);
    distanciasDeLasParadas = paradas.map((camara) => distanciaMasCercana(caminoPrincipal, vistaDeLaCamara(camara)));
    if (camaraDelRamal && camaraDeLaBifurcacion) {
      distanciaDeLaBifurcacion = distanciasDeLasParadas[paradas.indexOf(camaraDeLaBifurcacion)];
      vistaDeLaCamaraDelRamal = vistaDeLaCamara(camaraDelRamal);
      // Los chevrons flotan en el túnel del ramal, a mitad de camino entre los dos huecos.
      const huecoDeLaBifurcacion = camaraDeLaBifurcacion.querySelector<HTMLElement>('.hueco')!;
      const huecoDelRamal = camaraDelRamal.querySelector<HTMLElement>('.hueco')!;
      const bordesDeLosHuecos = [
        camaraDeLaBifurcacion.offsetLeft + huecoDeLaBifurcacion.offsetLeft, camaraDeLaBifurcacion.offsetLeft + huecoDeLaBifurcacion.offsetLeft + huecoDeLaBifurcacion.offsetWidth,
        camaraDelRamal.offsetLeft + huecoDelRamal.offsetLeft, camaraDelRamal.offsetLeft + huecoDelRamal.offsetLeft + huecoDelRamal.offsetWidth,
      ].sort((primero, segundo) => primero - segundo);
      lugarDeLosChevrons = [(bordesDeLosHuecos[1] + bordesDeLosHuecos[2]) / 2, centroDelHueco(camaraDeLaBifurcacion)[1]];
    }

    // El túnel nace en el borde izquierdo, a la altura del primer piso, y pasa por el centro de
    // cada cámara; el ramal va del centro de su cámara al de la cámara del ramal.
    const centros = paradas.map(centroDelHueco);
    const lineasDelTunel: Punto[][] = [[[0, centros[0][1]], ...centros]];
    if (camaraDelRamal && camaraDeLaBifurcacion) lineasDelTunel.push([centroDelHueco(camaraDeLaBifurcacion), centroDelHueco(camaraDelRamal)]);
    dibujarTunel(fila, lineasDelTunel, anchoDelPlano, altoDelPlano);

    opciones.alCambiarLasParadas(paradas, irALaParada);
    avanceEnElCamino = distanciasDeLasParadas[limitar(indiceQueSeMostraba, 0, paradas.length - 1)];
    estaEnElRamal = false;
    if (estabaEnElRamal && camaraDelRamal) {
      avanceEnElCamino = distanciaDeLaBifurcacion;
      armarCaminoDelRamal();
      estaEnElRamal = true;
      avanceEnElRamal = caminoDelRamal!.largo;
    }
    mostrarDondeVa();
  };

  /** Camino del ramal: desde donde la vista deja el camino principal hasta la cámara del ramal. */
  const armarCaminoDelRamal = () => {
    caminoDelRamal = crearCamino([puntoDelCamino(caminoPrincipal, distanciaDeLaBifurcacion), vistaDeLaCamaraDelRamal], 0);
  };

  /** Parada más cercana a donde está la vista (en el ramal, la de la bifurcación). */
  const indiceDeLaParadaActual = () => {
    let indiceMasCercano = 0;
    distanciasDeLasParadas.forEach((distancia, i) => {
      if (Math.abs(distancia - avanceEnElCamino) < Math.abs(distanciasDeLasParadas[indiceMasCercano] - avanceEnElCamino)) indiceMasCercano = i;
    });
    return indiceMasCercano;
  };

  /** Mueve el scroll del nido a donde va la vista y avisa (hormiga, hoyos y chevrons). */
  const mostrarDondeVa = () => {
    const [x, y] = estaEnElRamal && caminoDelRamal ? puntoDelCamino(caminoDelRamal, avanceEnElRamal) : puntoDelCamino(caminoPrincipal, avanceEnElCamino);
    nido.scrollLeft = x;
    nido.scrollTop = y;
    scrollEsperado = [nido.scrollLeft, nido.scrollTop];
    opciones.alMoverse(indiceDeLaParadaActual(), caminoPrincipal.largo > 0 ? avanceEnElCamino / caminoPrincipal.largo : 0);
    const estaCercaDeLaBifurcacion = !estaEnElRamal && camaraDelRamal !== null
      && Math.abs(avanceEnElCamino - distanciaDeLaBifurcacion) < nido.clientWidth * 0.25;
    botonHaciaElRamal?.classList.toggle('visible', estaCercaDeLaBifurcacion);
    botonDeVuelta?.classList.toggle('visible', estaEnElRamal && caminoDelRamal !== null && avanceEnElRamal > caminoDelRamal.largo * 0.6);
    // Los chevrons siguen al túnel del ramal en la pantalla, sin salirse de la vista.
    const rectanguloDelNido = nido.getBoundingClientRect();
    const izquierdaEnPantalla = limitar(rectanguloDelNido.left + lugarDeLosChevrons[0] - nido.scrollLeft, rectanguloDelNido.left + 48, rectanguloDelNido.right - 48);
    const arribaEnPantalla = limitar(rectanguloDelNido.top + lugarDeLosChevrons[1] - nido.scrollTop, rectanguloDelNido.top + 48, rectanguloDelNido.bottom - 48);
    for (const boton of [botonHaciaElRamal, botonDeVuelta]) {
      if (!boton) continue;
      boton.style.left = `${izquierdaEnPantalla}px`;
      boton.style.top = `${arribaEnPantalla}px`;
    }
  };

  const detenerAnimacion = () => {
    cancelAnimationFrame(animacionEnCurso);
    animacionEnCurso = 0;
  };

  /**
   * Lleva un avance de `desde` a `hasta` con una curva suave (acelera y frena), cuadro a cuadro, para
   * que la vista siga el túnel y no corte camino en línea recta. Sin animaciones (preferencia del
   * sistema), salta directo.
   */
  const animarAvance = (desde: number, hasta: number, ponerAvance: (avance: number) => void, alTerminar?: () => void) => {
    detenerAnimacion();
    if (sinMovimiento.matches || Math.abs(hasta - desde) < 1) {
      ponerAvance(hasta);
      mostrarDondeVa();
      alTerminar?.();
      return;
    }
    const duracion = Math.min(1400, 380 + Math.abs(hasta - desde) * 0.22);
    const inicio = performance.now();
    const avanzarUnCuadro = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracion);
      const suavizado = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      ponerAvance(desde + (hasta - desde) * suavizado);
      mostrarDondeVa();
      if (t < 1) animacionEnCurso = requestAnimationFrame(avanzarUnCuadro);
      else {
        animacionEnCurso = 0;
        alTerminar?.();
      }
    };
    animacionEnCurso = requestAnimationFrame(avanzarUnCuadro);
  };

  /** Vuelve del ramal al camino principal (animado) y luego hace `despues`, si hay algo. */
  const salirDelRamal = (despues?: () => void) => {
    animarAvance(avanceEnElRamal, 0, (avance) => { avanceEnElRamal = avance; }, () => {
      estaEnElRamal = false;
      mostrarDondeVa();
      despues?.();
    });
  };

  /** Lleva la vista hasta la bifurcación y de ahí, por el ramal, hasta su cámara. */
  const entrarAlRamal = () => {
    if (!camaraDelRamal) return;
    animarAvance(avanceEnElCamino, distanciaDeLaBifurcacion, (avance) => { avanceEnElCamino = avance; }, () => {
      armarCaminoDelRamal();
      estaEnElRamal = true;
      avanceEnElRamal = 0;
      animarAvance(0, caminoDelRamal!.largo, (avance) => { avanceEnElRamal = avance; });
    });
  };

  /** Lleva la vista a una parada siguiendo el túnel (saliendo antes del ramal, si está en él). */
  const irALaParadaDoblado = (indice: number) => {
    const destino = distanciasDeLasParadas[limitar(indice, 0, paradas.length - 1)];
    const recorrerElCamino = () => animarAvance(avanceEnElCamino, destino, (avance) => { avanceEnElCamino = avance; });
    if (estaEnElRamal) salirDelRamal(recorrerElCamino);
    else recorrerElCamino();
  };

  /** Avanza (o retrocede, si es negativo) por el túnel; en el ramal, cualquier movimiento lo devuelve al camino. */
  const avanzarPorElTunel = (cuanto: number) => {
    detenerAnimacion();
    if (estaEnElRamal) {
      avanceEnElRamal = Math.max(0, avanceEnElRamal - Math.abs(cuanto));
      if (avanceEnElRamal === 0) estaEnElRamal = false;
    } else {
      avanceEnElCamino = limitar(avanceEnElCamino + cuanto, 0, caminoPrincipal.largo);
    }
    mostrarDondeVa();
  };

  /**
   * Sentido del movimiento horizontal en el tramo actual: en los pisos que van hacia la izquierda,
   * deslizar hacia la izquierda en el trackpad avanza (en vez de retroceder).
   */
  const sentidoHorizontalDelTramo = () => {
    if (estaEnElRamal) return 1;
    const [direccionX] = direccionDelCamino(caminoPrincipal, avanceEnElCamino);
    return direccionX < -0.3 ? -1 : 1;
  };

  // ── Pantallas angostas: una columna con el scroll del navegador ──

  /** Deja las cámaras en columna (CSS) y dibuja el túnel bajando por el centro de cada una. */
  const enderezarEnColumna = (indiceQueSeMostraba: number) => {
    detenerAnimacion();
    quitarElDoblez();
    estaEnElRamal = false;
    botonHaciaElRamal?.classList.remove('visible');
    botonDeVuelta?.classList.remove('visible');
    paradas = camaras;
    const centros = paradas.map(centroDelHueco);
    dibujarTunel(fila, [[[centros[0][0], 0], ...centros]], fila.offsetWidth, fila.offsetHeight);
    opciones.alCambiarLasParadas(paradas, irALaParada);
    nido.scrollTop = paradas[limitar(indiceQueSeMostraba, 0, paradas.length - 1)].offsetTop;
    avisarEnColumna();
  };

  /** Parada actual y avance según el scroll vertical (en columna). */
  const avisarEnColumna = () => {
    const recorridoMaximo = nido.scrollHeight - nido.clientHeight;
    const lineaDeLectura = nido.scrollTop + nido.clientHeight / 3;
    let indice = 0;
    paradas.forEach((camara, i) => { if (camara.offsetTop <= lineaDeLectura) indice = i; });
    if (nido.scrollTop >= recorridoMaximo - 2) indice = paradas.length - 1;
    opciones.alMoverse(indice, recorridoMaximo > 0 ? nido.scrollTop / recorridoMaximo : 0);
  };

  /** Lleva la vista a una parada, en el modo que esté. */
  function irALaParada(indice: number) {
    if (estaDoblado) irALaParadaDoblado(indice);
    else nido.scrollTo({ top: paradas[limitar(indice, 0, paradas.length - 1)].offsetTop, behavior: sinMovimiento.matches ? 'auto' : 'smooth' });
  }

  /** Índice (en `camaras`, el orden de la página) de la cámara que se está mostrando. */
  const camaraQueSeMuestra = () => {
    if (paradas.length === 0) return null;
    if (estaDoblado && estaEnElRamal) return camaraDelRamal;
    if (estaDoblado) return paradas[indiceDeLaParadaActual()];
    const lineaDeLectura = nido.scrollTop + nido.clientHeight / 3;
    return [...paradas].reverse().find((camara) => camara.offsetTop <= lineaDeLectura) ?? paradas[0];
  };

  /** Arma el nido según el ancho de la pantalla, sin perder la cámara que se estaba mirando. */
  const armar = (camaraAMostrar: HTMLElement | null) => {
    const vaAlRamal = camaraAMostrar !== null && camaraAMostrar === camaraDelRamal;
    if (pantallaAngosta.matches) {
      enderezarEnColumna(camaraAMostrar ? Math.max(0, camaras.indexOf(camaraAMostrar)) : 0);
    } else {
      const camaraDelCamino = vaAlRamal ? camaraDeLaBifurcacion : camaraAMostrar;
      doblarEnPisos(camaraDelCamino ? Math.max(0, camarasDelCamino.indexOf(camaraDelCamino)) : 0, vaAlRamal);
    }
  };

  // ── Eventos ──

  // La rueda (y el trackpad) avanza por el túnel. Si el puntero está sobre un bloque con scroll
  // propio que todavía puede moverse, se deja ese scroll.
  nido.addEventListener('wheel', (evento) => {
    if (!estaDoblado || evento.ctrlKey) return;
    const bloqueConScroll = (evento.target as Element).closest<HTMLElement>('.desborda');
    if (bloqueConScroll) {
      const puedeMoverse = evento.deltaY > 0
        ? bloqueConScroll.scrollTop + bloqueConScroll.clientHeight < bloqueConScroll.scrollHeight - 1
        : bloqueConScroll.scrollTop > 0;
      if (puedeMoverse) return;
    }
    evento.preventDefault();
    const multiplicador = evento.deltaMode === 1 ? 32 : evento.deltaMode === 2 ? nido.clientHeight : 1;
    const esVertical = Math.abs(evento.deltaY) >= Math.abs(evento.deltaX);
    avanzarPorElTunel((esVertical ? evento.deltaY : evento.deltaX * sentidoHorizontalDelTramo()) * multiplicador);
  }, { passive: false });

  // Con el dedo (tabletas anchas): deslizar avanza por el túnel igual que la rueda.
  let ultimoToque: Punto | null = null;
  nido.addEventListener('touchstart', (evento) => {
    ultimoToque = estaDoblado && evento.touches.length === 1 ? [evento.touches[0].clientX, evento.touches[0].clientY] : null;
  }, { passive: true });
  nido.addEventListener('touchmove', (evento) => {
    if (!estaDoblado || !ultimoToque || evento.touches.length !== 1) return;
    const toque = evento.touches[0];
    const movimientoX = ultimoToque[0] - toque.clientX, movimientoY = ultimoToque[1] - toque.clientY;
    ultimoToque = [toque.clientX, toque.clientY];
    evento.preventDefault();
    avanzarPorElTunel(Math.abs(movimientoY) >= Math.abs(movimientoX) ? movimientoY : movimientoX * sentidoHorizontalDelTramo());
  }, { passive: false });
  nido.addEventListener('touchend', () => { ultimoToque = null; });

  // Teclado: las teclas de avance o retroceso saltan de cámara en cámara por el túnel. En el
  // ramal, cualquiera de ellas (o Escape) vuelve al camino.
  document.addEventListener('keydown', (evento) => {
    if (!estaDoblado || evento.metaKey || evento.ctrlKey || evento.altKey) return;
    const sobreUnControl = (evento.target as Element | null)?.closest('button, a, input, select, textarea');
    if (sobreUnControl && (evento.key === ' ' || evento.key === 'Enter')) return;
    const avanza = ['ArrowRight', 'ArrowDown', 'PageDown'].includes(evento.key) || (evento.key === ' ' && !evento.shiftKey);
    const retrocede = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(evento.key) || (evento.key === ' ' && evento.shiftKey);
    if (estaEnElRamal) {
      if (!avanza && !retrocede && evento.key !== 'Escape') return;
      salirDelRamal();
    } else if (avanza) {
      const siguiente = distanciasDeLasParadas.findIndex((distancia) => distancia > avanceEnElCamino + 2);
      irALaParadaDoblado(siguiente === -1 ? paradas.length - 1 : siguiente);
    } else if (retrocede) {
      const anteriores = distanciasDeLasParadas.filter((distancia) => distancia < avanceEnElCamino - 2);
      irALaParadaDoblado(Math.max(0, anteriores.length - 1));
    } else if (evento.key === 'Home') irALaParadaDoblado(0);
    else if (evento.key === 'End') irALaParadaDoblado(paradas.length - 1);
    else return;
    evento.preventDefault();
  });

  botonHaciaElRamal?.addEventListener('click', entrarAlRamal);
  botonDeVuelta?.addEventListener('click', () => salirDelRamal());
  if (camaraDelRamal && botonHaciaElRamal) botonHaciaElRamal.title = camaraDelRamal.dataset.nombre ?? '';
  if (camaraDeLaBifurcacion && botonDeVuelta) botonDeVuelta.title = camaraDeLaBifurcacion.dataset.nombre ?? '';

  // Si el navegador mueve el nido por su cuenta (Tab hasta un enlace de otra cámara, buscar en la
  // página), el recorrido se pone al día con el punto del túnel más cercano a donde quedó.
  nido.addEventListener('scroll', () => {
    if (!estaDoblado) {
      avisarEnColumna();
      return;
    }
    if (animacionEnCurso || (Math.abs(nido.scrollLeft - scrollEsperado[0]) < 2 && Math.abs(nido.scrollTop - scrollEsperado[1]) < 2)) return;
    estaEnElRamal = false;
    avanceEnElCamino = distanciaMasCercana(caminoPrincipal, [nido.scrollLeft, nido.scrollTop]);
    mostrarDondeVa();
  }, { passive: true });

  // Al cambiar el tamaño de la ventana (o pasar de ancha a angosta) se vuelve a armar, en la
  // misma cámara; una sola vez por cuadro aunque lleguen varios avisos.
  let rearmadoPendiente = 0;
  const rearmar = () => {
    cancelAnimationFrame(rearmadoPendiente);
    rearmadoPendiente = requestAnimationFrame(() => armar(camaraQueSeMuestra()));
  };
  window.addEventListener('resize', rearmar);
  pantallaAngosta.addEventListener('change', rearmar);
  // Las letras y las imágenes cambian el ancho de las cámaras: cuando terminan de cargar, se mide
  // de nuevo (si no, una cámara podría quedar encima de otra).
  document.fonts?.ready.then(rearmar);
  fila.querySelectorAll('img').forEach((imagen) => { if (!imagen.complete) imagen.addEventListener('load', rearmar, { once: true }); });

  // Al llegar con un #ancla en la dirección, se abre en esa cámara (también la del ramal).
  const camaraDelAncla = location.hash ? camaras.find((camara) => camara.id === decodeURIComponent(location.hash.slice(1))) ?? null : null;
  armar(camaraDelAncla);
}
