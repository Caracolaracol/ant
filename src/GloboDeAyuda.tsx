// Globo de ayuda (tooltip) propio: un rótulo chico con un texto, bajo el elemento que lo pide. Se
// usa en vez del `title` del navegador, que tarda en aparecer y no sigue los colores de la app.
// Se dibuja en `document.body` (portal) para que no lo recorte el scroll de la barra lateral.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Cuánto hay que dejar el mouse encima antes de que aparezca el globo, en milisegundos. */
const ESPERA_ANTES_DE_MOSTRAR_EL_GLOBO = 350;

interface GloboVisible {
  texto: string;
  /** Centro horizontal del elemento, en la ventana. */
  x: number;
  /** Borde inferior del elemento (más un respiro), en la ventana. */
  y: number;
}

/**
 * Manejo de un globo: `mostrarGlobo(elemento, texto)` al entrar el mouse (aparece tras una pausa)
 * y `ocultarGlobo()` al salir, al hacer clic o al abrir un menú. `globoParaDibujar` es lo que hay
 * que poner en el JSX.
 */
export function useGloboDeAyuda() {
  const [globoVisible, setGloboVisible] = useState<GloboVisible | null>(null);
  const temporizadorDeLaEspera = useRef<ReturnType<typeof setTimeout>>(undefined);

  const ocultarGlobo = useCallback(() => {
    clearTimeout(temporizadorDeLaEspera.current);
    setGloboVisible(null);
  }, []);

  const mostrarGlobo = useCallback((elementoConElMouse: HTMLElement, texto: string) => {
    clearTimeout(temporizadorDeLaEspera.current);
    temporizadorDeLaEspera.current = setTimeout(() => {
      const rectanguloDelElemento = elementoConElMouse.getBoundingClientRect();
      setGloboVisible({
        texto,
        x: rectanguloDelElemento.left + rectanguloDelElemento.width / 2,
        y: rectanguloDelElemento.bottom + 6,
      });
    }, ESPERA_ANTES_DE_MOSTRAR_EL_GLOBO);
  }, []);

  useEffect(() => () => clearTimeout(temporizadorDeLaEspera.current), []);

  const globoParaDibujar = globoVisible ? createPortal(<GloboFlotante {...globoVisible} />, document.body) : null;
  return { mostrarGlobo, ocultarGlobo, globoParaDibujar };
}

/** El rótulo en sí: centrado bajo el elemento, pero sin salirse de la ventana. */
function GloboFlotante({ texto, x, y }: GloboVisible) {
  const elementoDelGlobo = useRef<HTMLDivElement>(null);
  const [distanciaAlBordeIzquierdo, setDistanciaAlBordeIzquierdo] = useState(x);
  useEffect(() => {
    const anchoDelGlobo = elementoDelGlobo.current?.offsetWidth ?? 0;
    setDistanciaAlBordeIzquierdo(Math.max(8, Math.min(window.innerWidth - anchoDelGlobo - 8, x - anchoDelGlobo / 2)));
  }, [x, texto]);
  return (
    <div ref={elementoDelGlobo} className="globo" role="tooltip" style={{ left: distanciaAlBordeIzquierdo, top: y }}>
      {texto}
    </div>
  );
}
