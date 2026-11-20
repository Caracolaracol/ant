// Cambiar el ancho de la barra lateral arrastrando su borde derecho (invisible; el puntero cambia
// a ↔). Mientras se arrastra, el ancho se cambia directo en el DOM, sin pasar por React, para no
// volver a dibujar la ventana en cada movimiento del mouse; al soltar se avisa el ancho nuevo.

import { PointerEvent as EventoDePuntero, RefObject } from "react";

/** Ancho de la barra por defecto y sus límites al arrastrar el borde, en píxeles. */
export const ANCHO_DE_LA_BARRA_POR_DEFECTO = 200;
const ANCHO_MINIMO_DE_LA_BARRA = 140;
const ANCHO_MAXIMO_DE_LA_BARRA = 520;

/**
 * Devuelve el manejador para `onPointerDown` del borde. `barraLateral` es el elemento cuyo ancho
 * cambia; `alSoltarConAnchoNuevo` recibe el ancho final (solo si cambió).
 */
export function useArrastreDelBorde(
  barraLateral: RefObject<HTMLElement | null>,
  alSoltarConAnchoNuevo: (anchoEnPixeles: number) => void,
) {
  return (eventoAlPresionar: EventoDePuntero<HTMLDivElement>) => {
    const elementoDeLaBarra = barraLateral.current;
    if (eventoAlPresionar.button !== 0 || !elementoDeLaBarra) return;
    eventoAlPresionar.preventDefault();
    const borde = eventoAlPresionar.currentTarget;
    borde.setPointerCapture(eventoAlPresionar.pointerId);
    const posicionInicialDelMouse = eventoAlPresionar.clientX;
    const anchoInicial = elementoDeLaBarra.offsetWidth;
    let anchoActual = anchoInicial;
    // El puntero ↔ se mantiene en toda la ventana aunque el mouse se salga del borde.
    document.documentElement.classList.add("redimensionando");

    const alMoverElMouse = (evento: PointerEvent) => {
      const anchoPedido = anchoInicial + evento.clientX - posicionInicialDelMouse;
      anchoActual = Math.min(ANCHO_MAXIMO_DE_LA_BARRA, Math.max(ANCHO_MINIMO_DE_LA_BARRA, anchoPedido));
      elementoDeLaBarra.style.width = `${anchoActual}px`;
    };
    const alSoltar = () => {
      borde.removeEventListener("pointermove", alMoverElMouse);
      borde.removeEventListener("pointerup", alSoltar);
      borde.removeEventListener("pointercancel", alSoltar);
      document.documentElement.classList.remove("redimensionando");
      if (anchoActual !== anchoInicial) alSoltarConAnchoNuevo(Math.round(anchoActual));
    };
    borde.addEventListener("pointermove", alMoverElMouse);
    borde.addEventListener("pointerup", alSoltar);
    borde.addEventListener("pointercancel", alSoltar);
  };
}
