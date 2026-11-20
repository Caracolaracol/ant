// Hormiga vista desde arriba, mirando a la derecha: la misma del sitio (website/src/components/
// Hormiga.astro). Las patas van en dos grupos (trípodes), como caminan las hormigas de verdad:
// con la clase `caminando` en un ancestro, los grupos se mueven alternados (ver Bienvenida.css).

import type { Ref } from "react";

export function Hormiga({ className, ref }: { className?: string; ref?: Ref<SVGSVGElement> }) {
  return (
    <svg ref={ref} className={`hormiga ${className ?? ""}`} viewBox="0 0 64 40" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <g className="pata-a">
          <path d="M37 18L42 10L46 7" />
          <path d="M34 22L34 31L31 35" />
          <path d="M31 18L25 10L20 8" />
        </g>
        <g className="pata-b">
          <path d="M37 22L42 30L46 33" />
          <path d="M34 18L34 9L31 5" />
          <path d="M31 22L25 30L20 32" />
        </g>
      </g>
      <path d="M49 17L54 11L60 12M49 23L54 29L60 28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="16" cy="20" rx="10" ry="7.5" fill="currentColor" />
      <circle cx="27" cy="20" r="1.8" fill="currentColor" />
      <ellipse cx="34" cy="20" rx="6" ry="3.6" fill="currentColor" />
      <ellipse cx="46" cy="20" rx="5.5" ry="5" fill="currentColor" />
    </svg>
  );
}
