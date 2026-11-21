// Ventanita «Hormiguero nuevo» sobre la ventana principal (menú File → New Anthill… o
// Ajustes → General). Explica en una línea qué es un hormiguero y muestra el formulario para
// crearlo o elegir su carpeta. Se cierra con Escape, la × o un clic fuera.

import { useEffect } from "react";
import { useTextos } from "../idioma";
import { ElegirHormiguero } from "./ElegirHormiguero";

interface Props {
  /** Recibe la carpeta del hormiguero, creada o elegida. */
  alElegirCarpeta(carpetaDelHormiguero: string): void;
  alCerrar(): void;
}

export function NuevoHormiguero({ alElegirCarpeta, alCerrar }: Props) {
  const textosDeLaInterfaz = useTextos();

  useEffect(() => {
    const alPresionarEscape = (evento: KeyboardEvent) => evento.key === "Escape" && alCerrar();
    window.addEventListener("keydown", alPresionarEscape);
    return () => window.removeEventListener("keydown", alPresionarEscape);
  }, [alCerrar]);

  return (
    <div className="modal-fondo modal-encima" onMouseDown={(evento) => evento.target === evento.currentTarget && alCerrar()}>
      <div className="modal nuevo-hormiguero" role="dialog" aria-label={textosDeLaInterfaz.nuevoHormiguero}>
        <button className="modal-cerrar" aria-label={textosDeLaInterfaz.cerrar} onClick={alCerrar}>×</button>
        <h1>{textosDeLaInterfaz.nuevoHormiguero}</h1>
        <p className="nuevo-hormiguero-ayuda">{textosDeLaInterfaz.nuevoHormigueroAyuda}</p>
        <ElegirHormiguero alElegirCarpeta={alElegirCarpeta} enfocarElNombreAlAparecer />
      </div>
    </div>
  );
}
