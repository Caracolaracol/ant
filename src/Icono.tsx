// Dibuja un icono de `iconos.ts` como SVG en línea, del color del texto que lo rodea. Lo usan
// los fijados de la barra lateral y el selector de iconos.

import { createElement } from "react";
import { ICONOS } from "./iconos";

interface Props {
  /** Nombre del icono (una clave de `ICONOS`); si no existe, se dibuja el de una nota. */
  nombreDelIcono: string;
  /** Lado en píxeles. */
  tamanoEnPixeles?: number;
}

export function Icono({ nombreDelIcono, tamanoEnPixeles = 16 }: Props) {
  const elementosDelDibujo = ICONOS[nombreDelIcono] ?? ICONOS["file-text"];
  return (
    <svg
      className="icono"
      width={tamanoEnPixeles}
      height={tamanoEnPixeles}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {elementosDelDibujo.map(([etiqueta, atributos], i) => createElement(etiqueta, { key: i, ...atributos }))}
    </svg>
  );
}
