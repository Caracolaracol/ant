// Globo de ayuda (tooltip) propio: un rótulo chico con un texto, bajo el elemento que lo pide. Se
// usa en vez del `title` del navegador, que tarda en aparecer y no sigue los colores de la app.
// Se dibuja en `document.body` (portal) para que no lo recorte el scroll de la barra lateral.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Cuánto hay que dejar el mouse encima antes de que aparezca el globo, en milisegundos. */
const ESPERA = 350;

interface Globo {
  texto: string;
  x: number;
  y: number;
}

/**
 * Manejo de un globo: `mostrar(elemento, texto)` al entrar el mouse (aparece tras una pausa) y
 * `ocultar()` al salir, al hacer clic o al abrir un menú. `globo` es lo que hay que dibujar.
 */
export function useGlobo() {
  const [globo, setGlobo] = useState<Globo | null>(null);
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);

  const ocultar = useCallback(() => {
    clearTimeout(espera.current);
    setGlobo(null);
  }, []);

  const mostrar = useCallback((elemento: HTMLElement, texto: string) => {
    clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      const r = elemento.getBoundingClientRect();
      setGlobo({ texto, x: r.left + r.width / 2, y: r.bottom + 6 });
    }, ESPERA);
  }, []);

  useEffect(() => () => clearTimeout(espera.current), []);

  const dibujo = globo
    ? createPortal(<GloboFlotante {...globo} />, document.body)
    : null;
  return { mostrar, ocultar, dibujo };
}

/** El rótulo en sí: centrado bajo el elemento, pero sin salirse de la ventana. */
function GloboFlotante({ texto, x, y }: Globo) {
  const ref = useRef<HTMLDivElement>(null);
  const [izquierda, setIzquierda] = useState(x);
  useEffect(() => {
    const ancho = ref.current?.offsetWidth ?? 0;
    setIzquierda(Math.max(8, Math.min(window.innerWidth - ancho - 8, x - ancho / 2)));
  }, [x, texto]);
  return (
    <div ref={ref} className="globo" role="tooltip" style={{ left: izquierda, top: y }}>
      {texto}
    </div>
  );
}
