// Dibuja un icono de `iconos.ts` como SVG en línea, del color del texto que lo rodea. Lo usan
// los fijados de la barra lateral y el selector de iconos.

import { createElement } from "react";
import { ICONOS } from "./iconos";

interface Props {
  /** Nombre del icono (una clave de `ICONOS`); si no existe, se dibuja el de una nota. */
  id: string;
  /** Lado en píxeles. */
  tamano?: number;
}

export function Icono({ id, tamano = 16 }: Props) {
  const nodos = ICONOS[id] ?? ICONOS["file-text"];
  return (
    <svg
      className="icono"
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {nodos.map(([etiqueta, atributos], i) => createElement(etiqueta, { key: i, ...atributos }))}
    </svg>
  );
}
