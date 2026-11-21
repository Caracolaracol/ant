// Ventanita «Cámara nueva» sobre la ventana principal (menú File → New Chamber… o Ajustes →
// General). Explica en una línea qué es una cámara y muestra el formulario para cavarla dentro del
// hormiguero. Se cierra con Escape, la × o un clic fuera.

import { useEffect } from "react";
import { useTextos } from "../idioma";
import { ElegirCamara } from "./ElegirCamara";

interface Props {
  carpetaDelHormiguero: string;
  /** Cámaras que ya existen, para no proponer sus nombres como ejemplo. */
  camarasDelHormiguero: string[];
  /** Recibe el nombre de la cámara recién cavada. */
  alCavarCamara(nombreDeLaCamara: string): void | Promise<void>;
  alCerrar(): void;
}

export function NuevaCamara({ carpetaDelHormiguero, camarasDelHormiguero, alCavarCamara, alCerrar }: Props) {
  const textosDeLaInterfaz = useTextos();

  useEffect(() => {
    const alPresionarEscape = (evento: KeyboardEvent) => evento.key === "Escape" && alCerrar();
    window.addEventListener("keydown", alPresionarEscape);
    return () => window.removeEventListener("keydown", alPresionarEscape);
  }, [alCerrar]);

  return (
    <div className="modal-fondo modal-encima" onMouseDown={(evento) => evento.target === evento.currentTarget && alCerrar()}>
      <div className="modal nuevo-hormiguero" role="dialog" aria-label={textosDeLaInterfaz.camaraNueva}>
        <button className="modal-cerrar" aria-label={textosDeLaInterfaz.cerrar} onClick={alCerrar}>×</button>
        <h1>{textosDeLaInterfaz.camaraNueva}</h1>
        <p className="nuevo-hormiguero-ayuda">{textosDeLaInterfaz.camaraNuevaAyuda}</p>
        <ElegirCamara
          carpetaDelHormiguero={carpetaDelHormiguero}
          camarasQueYaExisten={camarasDelHormiguero}
          alElegirCamara={alCavarCamara}
          enfocarElNombreAlAparecer
        />
      </div>
    </div>
  );
}
