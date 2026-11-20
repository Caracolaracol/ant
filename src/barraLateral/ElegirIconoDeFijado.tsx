// Selector de iconos para un fijado (clic derecho sobre el fijado → Cambiar icono…): una ventanita
// junto al fijado con los iconos de `iconos.ts` agrupados por tema. Al elegir uno se cierra; se
// cierra también con clic fuera o Escape. «Icono por defecto» vuelve al de su tipo.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icono } from "../Icono";
import { GRUPOS_ICONOS, GrupoIconos } from "../iconos";
import { useGlobo } from "../Globo";
import { useTextos } from "../idioma";

interface Props {
  /** Punto de la ventana junto al que se abre (donde se hizo clic derecho). */
  x: number;
  y: number;
  /** Icono que tiene ahora el fijado. */
  iconoActual: string;
  /** Recibe el icono elegido, o `null` para volver al de por defecto. */
  alElegirIcono(iconoElegido: string | null): void;
  alCerrar(): void;
}

export function ElegirIconoDeFijado({ x, y, iconoActual, alElegirIcono, alCerrar }: Props) {
  const textosDeLaInterfaz = useTextos();
  const cajaDelSelector = useRef<HTMLDivElement>(null);
  const globoConElNombre = useGlobo();
  // Posición final: la del clic, corrida para que la ventanita no se salga de la pantalla.
  const [posicionEnPantalla, setPosicionEnPantalla] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const caja = cajaDelSelector.current;
    if (!caja) return;
    setPosicionEnPantalla({
      left: Math.max(8, Math.min(x, window.innerWidth - caja.offsetWidth - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - caja.offsetHeight - 8)),
    });
  }, [x, y]);

  // Se cierra con un clic fuera o con Escape.
  useEffect(() => {
    const alHacerClicFuera = (evento: MouseEvent) => {
      if (!cajaDelSelector.current?.contains(evento.target as Node)) alCerrar();
    };
    const alPresionarEscape = (evento: KeyboardEvent) => evento.key === "Escape" && alCerrar();
    window.addEventListener("mousedown", alHacerClicFuera);
    window.addEventListener("keydown", alPresionarEscape);
    return () => {
      window.removeEventListener("mousedown", alHacerClicFuera);
      window.removeEventListener("keydown", alPresionarEscape);
    };
  }, [alCerrar]);

  /** Elige un icono (o el de por defecto, con `null`) y cierra. */
  const elegirYCerrar = (iconoElegido: string | null) => {
    globoConElNombre.ocultar();
    alElegirIcono(iconoElegido);
    alCerrar();
  };

  return createPortal(
    <div ref={cajaDelSelector} className="elegir-icono" style={posicionEnPantalla} role="dialog" aria-label={textosDeLaInterfaz.cambiarIcono}>
      <div className="elegir-icono-lista">
        {(Object.keys(GRUPOS_ICONOS) as GrupoIconos[]).map((grupoDeIconos) => (
          <section key={grupoDeIconos}>
            <div className="elegir-icono-grupo">{textosDeLaInterfaz.gruposIconos[grupoDeIconos]}</div>
            <div className="elegir-icono-grilla">
              {GRUPOS_ICONOS[grupoDeIconos].map((nombreDelIcono) => (
                <button
                  key={nombreDelIcono}
                  className={`elegir-icono-opcion${nombreDelIcono === iconoActual ? " elegido" : ""}`}
                  aria-label={nombreDelIcono}
                  onClick={() => elegirYCerrar(nombreDelIcono)}
                  onMouseEnter={(evento) => globoConElNombre.mostrar(evento.currentTarget, nombreDelIcono.replace(/-/g, " "))}
                  onMouseLeave={globoConElNombre.ocultar}
                >
                  <Icono id={nombreDelIcono} tamano={18} />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <button className="elegir-icono-defecto" onClick={() => elegirYCerrar(null)}>{textosDeLaInterfaz.iconoPorDefecto}</button>
      {globoConElNombre.dibujo}
    </div>,
    document.body,
  );
}
