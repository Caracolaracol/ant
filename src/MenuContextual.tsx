// Menú contextual propio (clic derecho) para la barra lateral. Se dibuja en la posición del
// mouse y se cierra al elegir una opción, al hacer clic fuera, al hacer scroll o con Escape.

import { useEffect } from "react";

export interface OpcionMenu {
  texto: string;
  accion(): void;
}

interface Props {
  x: number;
  y: number;
  opciones: OpcionMenu[];
  onCerrar(): void;
}

export function MenuContextual({ x, y, opciones, onCerrar }: Props) {
  // Cierra el menú ante cualquier clic, scroll, cambio de tamaño o la tecla Escape.
  useEffect(() => {
    const cerrar = () => onCerrar();
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("mousedown", cerrar);
    window.addEventListener("blur", cerrar);
    window.addEventListener("resize", cerrar);
    window.addEventListener("wheel", cerrar);
    window.addEventListener("keydown", alTeclear);
    return () => {
      window.removeEventListener("mousedown", cerrar);
      window.removeEventListener("blur", cerrar);
      window.removeEventListener("resize", cerrar);
      window.removeEventListener("wheel", cerrar);
      window.removeEventListener("keydown", alTeclear);
    };
  }, [onCerrar]);

  return (
    // Detiene el mousedown para que hacer clic en una opción no cierre el menú antes de ejecutarla.
    <div className="menu-contextual" style={{ left: x, top: y }} onMouseDown={(e) => e.stopPropagation()}>
      {opciones.map((o, i) => (
        <div
          key={i}
          className="menu-opcion"
          onClick={() => {
            o.accion();
            onCerrar();
          }}
        >
          {o.texto}
        </div>
      ))}
    </div>
  );
}
