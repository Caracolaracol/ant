// Menú de clic derecho propio de Ant (en vez del del sistema, que en la ventana solo ofrecería
// «Recargar» o «Inspeccionar»). Lo usan la barra lateral (notas, carpetas, títulos, fijados y el
// espacio libre) y el selector de cámaras, como lista desplegable. Cada opción puede llevar un
// icono de `iconos.ts` o la marca ✓, y una línea fina antes para separarla de las anteriores.
// Se maneja con el mouse o con el teclado (↑ ↓ para moverse, Enter para elegir) y se cierra al
// elegir, al hacer clic fuera, con scroll o con Escape. Nunca se sale de la ventana: si no cabe
// donde se hizo el clic, se corre hacia adentro.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icono } from "./Icono";

export interface OpcionDelMenu {
  texto: string;
  alElegir(): void;
  /** Icono a la izquierda del texto (un nombre de `iconos.ts`). */
  icono?: string;
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

/** Distancia mínima entre el menú y los bordes de la ventana, en píxeles. */
const MARGEN_CON_EL_BORDE_DE_LA_VENTANA = 8;

export function MenuContextual({ x, y, opciones, alCerrar }: Props) {
  const elementoDelMenu = useRef<HTMLDivElement>(null);
  // Posición final, corrida hacia adentro si el menú no cabía donde se hizo el clic.
  const [posicion, setPosicion] = useState({ x, y });
  // Opción marcada con el mouse o las flechas (la que elige Enter), o -1.
  const [indiceDeLaOpcionActiva, setIndiceDeLaOpcionActiva] = useState(-1);

  // Antes de dibujarse en pantalla, mide el menú y lo corre para que no se salga de la ventana.
  useLayoutEffect(() => {
    const menu = elementoDelMenu.current;
    if (!menu) return;
    const { offsetWidth: ancho, offsetHeight: alto } = menu;
    setPosicion({
      x: Math.max(MARGEN_CON_EL_BORDE_DE_LA_VENTANA, Math.min(x, window.innerWidth - ancho - MARGEN_CON_EL_BORDE_DE_LA_VENTANA)),
      y: Math.max(MARGEN_CON_EL_BORDE_DE_LA_VENTANA, Math.min(y, window.innerHeight - alto - MARGEN_CON_EL_BORDE_DE_LA_VENTANA)),
    });
  }, [x, y, opciones.length]);

  /** Elige una opción y cierra el menú. */
  const elegirOpcion = (opcion: OpcionDelMenu) => {
    alCerrar();
    opcion.alElegir();
  };

  // Se cierra ante cualquier clic, scroll, cambio de tamaño o al salir de la ventana. Con el
  // teclado: ↑ ↓ mueven la opción activa, Enter la elige y Escape cierra.
  const opcionesVigentes = useRef({ opciones, indiceDeLaOpcionActiva, elegirOpcion });
  opcionesVigentes.current = { opciones, indiceDeLaOpcionActiva, elegirOpcion };
  useEffect(() => {
    const cerrarMenu = () => alCerrar();
    const alPresionarTecla = (evento: KeyboardEvent) => {
      const { opciones: opcionesDeAhora, indiceDeLaOpcionActiva: indiceDeAhora, elegirOpcion: elegir } = opcionesVigentes.current;
      if (evento.key === "Escape") alCerrar();
      else if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
        const paso = evento.key === "ArrowDown" ? 1 : -1;
        const cantidad = opcionesDeAhora.length;
        setIndiceDeLaOpcionActiva(indiceDeAhora < 0 ? (paso > 0 ? 0 : cantidad - 1) : (indiceDeAhora + paso + cantidad) % cantidad);
      } else if (evento.key === "Enter" && indiceDeAhora >= 0) elegir(opcionesDeAhora[indiceDeAhora]);
      else return;
      evento.preventDefault();
      evento.stopPropagation();
    };
    const eventosQueCierran = ["mousedown", "blur", "resize", "wheel"] as const;
    for (const nombreDelEvento of eventosQueCierran) window.addEventListener(nombreDelEvento, cerrarMenu);
    window.addEventListener("keydown", alPresionarTecla, true);
    return () => {
      for (const nombreDelEvento of eventosQueCierran) window.removeEventListener(nombreDelEvento, cerrarMenu);
      window.removeEventListener("keydown", alPresionarTecla, true);
    };
  }, [alCerrar]);

  // Si alguna opción lleva icono o marca, todas dejan su lugar, así los textos quedan alineados.
  const hayColumnaDeIconos = opciones.some((opcion) => opcion.icono || opcion.estaMarcada !== undefined);

  return (
    // Detiene el mousedown para que hacer clic en una opción no cierre el menú antes de elegirla.
    <div
      ref={elementoDelMenu}
      className="menu-contextual"
      role="menu"
      style={{ left: posicion.x, top: posicion.y }}
      onMouseDown={(evento) => evento.stopPropagation()}
      onContextMenu={(evento) => evento.preventDefault()}
    >
      {opciones.map((opcion, i) => (
        <div
          key={i}
          role="menuitem"
          className={[
            "menu-opcion",
            opcion.vaSeparadaDeLaAnterior && i > 0 ? "separada" : "",
            opcion.estaMarcada ? "marcada" : "",
            i === indiceDeLaOpcionActiva ? "activa" : "",
          ].filter(Boolean).join(" ")}
          onMouseEnter={() => setIndiceDeLaOpcionActiva(i)}
          onMouseLeave={() => setIndiceDeLaOpcionActiva(-1)}
          onClick={() => elegirOpcion(opcion)}
        >
          {hayColumnaDeIconos && (
            <span className="menu-opcion-icono">
              {opcion.estaMarcada ? (
                <Icono nombreDelIcono="check" tamanoEnPixeles={14} />
              ) : (
                opcion.icono && <Icono nombreDelIcono={opcion.icono} tamanoEnPixeles={14} />
              )}
            </span>
          )}
          <span className="menu-opcion-texto">{opcion.texto}</span>
        </div>
      ))}
    </div>
  );
}
