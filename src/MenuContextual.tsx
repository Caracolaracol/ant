// Menú contextual propio (clic derecho) para la barra lateral, que también usa el selector de
// cámaras como lista desplegable. Se dibuja en la posición pedida y se cierra al elegir una
// opción, al hacer clic fuera, al hacer scroll o con Escape.

import { useEffect } from "react";
import { Icono } from "./Icono";

export interface OpcionDelMenu {
  texto: string;
  alElegir(): void;
  /** Muestra una marca ✓ junto a la opción (la elegida ahora, como la cámara abierta). */
  estaMarcada?: boolean;
  /** Dibuja una línea fina antes de la opción, para separarla de las anteriores. */
  vaSeparadaDeLaAnterior?: boolean;
}

interface Props {
  x: number;
  y: number;
  opciones: OpcionDelMenu[];
  alCerrar(): void;
}

export function MenuContextual({ x, y, opciones, alCerrar }: Props) {
  // Se cierra ante cualquier clic, scroll, cambio de tamaño, al salir de la ventana o con Escape.
  useEffect(() => {
    const cerrarMenu = () => alCerrar();
    const alPresionarEscape = (evento: KeyboardEvent) => evento.key === "Escape" && alCerrar();
    const eventosQueCierran = ["mousedown", "blur", "resize", "wheel"] as const;
    for (const nombreDelEvento of eventosQueCierran) window.addEventListener(nombreDelEvento, cerrarMenu);
    window.addEventListener("keydown", alPresionarEscape);
    return () => {
      for (const nombreDelEvento of eventosQueCierran) window.removeEventListener(nombreDelEvento, cerrarMenu);
      window.removeEventListener("keydown", alPresionarEscape);
    };
  }, [alCerrar]);

  return (
    // Detiene el mousedown para que hacer clic en una opción no cierre el menú antes de elegirla.
    <div className="menu-contextual" style={{ left: x, top: y }} onMouseDown={(evento) => evento.stopPropagation()}>
      {opciones.map((opcion, i) => (
        <div
          key={i}
          className={`menu-opcion${opcion.vaSeparadaDeLaAnterior ? " separada" : ""}${opcion.estaMarcada ? " marcada" : ""}`}
          onClick={() => {
            opcion.alElegir();
            alCerrar();
          }}
        >
          {opcion.estaMarcada !== undefined && (
            <span className="menu-opcion-marca">{opcion.estaMarcada && <Icono nombreDelIcono="check" tamanoEnPixeles={12} />}</span>
          )}
          {opcion.texto}
        </div>
      ))}
    </div>
  );
}
