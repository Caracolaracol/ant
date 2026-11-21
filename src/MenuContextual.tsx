// Menú contextual propio (clic derecho) para la barra lateral. Se dibuja en la posición del
// mouse y se cierra al elegir una opción, al hacer clic fuera, al hacer scroll o con Escape.

import { useEffect } from "react";

export interface OpcionDelMenu {
  texto: string;
  alElegir(): void;
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
      {opciones.map((opcion) => (
        <div
          key={opcion.texto}
          className="menu-opcion"
          onClick={() => {
            opcion.alElegir();
            alCerrar();
          }}
        >
          {opcion.texto}
        </div>
      ))}
    </div>
  );
}
