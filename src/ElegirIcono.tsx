// Selector de iconos para un fijado (clic derecho sobre el fijado → Cambiar icono…): una ventanita
// junto al fijado con los iconos de `iconos.ts` agrupados por tema. Al elegir uno se cierra; se
// cierra también con clic fuera o Escape. «Icono por defecto» vuelve al de su tipo.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icono } from "./Icono";
import { GRUPOS_ICONOS, GrupoIconos } from "./iconos";
import { useGlobo } from "./Globo";
import { useTextos } from "./idioma";

interface Props {
  /** Punto de la ventana junto al que se abre (donde se hizo clic derecho). */
  x: number;
  y: number;
  /** Icono que tiene ahora el fijado. */
  actual: string;
  /** Recibe el icono elegido, o `null` para volver al de por defecto. */
  onElegir(icono: string | null): void;
  onCerrar(): void;
}

export function ElegirIcono({ x, y, actual, onElegir, onCerrar }: Props) {
  const tx = useTextos();
  const caja = useRef<HTMLDivElement>(null);
  const globo = useGlobo();
  // Posición final: la del clic, corrida para que la ventanita no se salga de la pantalla.
  const [pos, setPos] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - el.offsetWidth - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - el.offsetHeight - 8)),
    });
  }, [x, y]);

  // Se cierra con un clic fuera o con Escape.
  useEffect(() => {
    const fuera = (e: MouseEvent) => !caja.current?.contains(e.target as Node) && onCerrar();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("mousedown", fuera);
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("mousedown", fuera);
      window.removeEventListener("keydown", tecla);
    };
  }, [onCerrar]);

  /** Elige un icono y cierra. */
  const elegir = (icono: string | null) => {
    globo.ocultar();
    onElegir(icono);
    onCerrar();
  };

  return createPortal(
    <div ref={caja} className="elegir-icono" style={pos} role="dialog" aria-label={tx.cambiarIcono}>
      <div className="elegir-icono-lista">
        {(Object.keys(GRUPOS_ICONOS) as GrupoIconos[]).map((grupo) => (
          <section key={grupo}>
            <div className="elegir-icono-grupo">{tx.gruposIconos[grupo]}</div>
            <div className="elegir-icono-grilla">
              {GRUPOS_ICONOS[grupo].map((id) => (
                <button
                  key={id}
                  className={`elegir-icono-opcion${id === actual ? " elegido" : ""}`}
                  aria-label={id}
                  onClick={() => elegir(id)}
                  onMouseEnter={(e) => globo.mostrar(e.currentTarget, id.replace(/-/g, " "))}
                  onMouseLeave={globo.ocultar}
                >
                  <Icono id={id} tamano={18} />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <button className="elegir-icono-defecto" onClick={() => elegir(null)}>{tx.iconoPorDefecto}</button>
      {globo.dibujo}
    </div>,
    document.body,
  );
}
