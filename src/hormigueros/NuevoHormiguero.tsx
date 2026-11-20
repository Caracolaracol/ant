// Ventanita «Hormiguero nuevo» sobre la ventana principal (menú File → New Anthill… o
// Ajustes → General). Explica en una línea qué es un hormiguero y muestra el formulario para
// crearlo o elegir su carpeta. Se cierra con Escape.

import { useEffect } from "react";
import { useTextos } from "../idioma";
import { ElegirHormiguero } from "./ElegirHormiguero";

interface Props {
  onListo(ruta: string): void;
  onCerrar(): void;
}

export function NuevoHormiguero({ onListo, onCerrar }: Props) {
  const tx = useTextos();

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  return (
    <div className="modal-fondo modal-encima" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal nuevo-hormiguero" role="dialog" aria-label={tx.nuevoHormiguero}>
        <button className="modal-cerrar" aria-label={tx.cerrar} onClick={onCerrar}>×</button>
        <h1>{tx.nuevoHormiguero}</h1>
        <p className="nuevo-hormiguero-ayuda">{tx.nuevoHormigueroAyuda}</p>
        <ElegirHormiguero onListo={onListo} autoFoco />
      </div>
    </div>
  );
}
