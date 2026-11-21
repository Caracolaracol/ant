// Formulario para cavar una cámara dentro del hormiguero: su nombre (con ejemplos que se pueden
// tocar para usarlos) y, en la bienvenida, la lista de las que ya hay para abrir una de ellas (con
// la «Entrada» si hay notas sueltas en la raíz). Lo usan la última cámara de la bienvenida y la
// ventanita «Cámara nueva» (selector de cámaras, menú File o Ajustes → General). Entrega el nombre con `alElegirCamara` cuando la carpeta ya existe;
// guardarlo en los ajustes le toca a quien lo usa.

import { FormEvent, useState } from "react";
import { useTextos } from "../idioma";
import { crearCarpetaNueva, nombreVisibleDeLaCamara } from "./hormigueros";
import "./Hormigueros.css";

interface Props {
  carpetaDelHormiguero: string;
  /** Cámaras que ya tiene el hormiguero: no se proponen como ejemplo y, si se pide, se ofrece abrir una. */
  camarasQueYaExisten?: string[];
  /** Muestra las cámaras que ya existen para abrir una (en la bienvenida sí; en «Cámara nueva», no). */
  ofrecerAbrirUnaQueYaExiste?: boolean;
  /** Recibe el nombre de la cámara cavada o elegida (su carpeta ya existe). */
  alElegirCamara(nombreDeLaCamara: string): void | Promise<void>;
  /** Pone el foco en el nombre al aparecer (en la ventanita sí; en la bienvenida, no). */
  enfocarElNombreAlAparecer?: boolean;
}

export function ElegirCamara(props: Props) {
  const { carpetaDelHormiguero, camarasQueYaExisten = [], ofrecerAbrirUnaQueYaExiste, alElegirCamara, enfocarElNombreAlAparecer } = props;
  const textosDeLaInterfaz = useTextos();
  const [nombreDeLaCamara, setNombreDeLaCamara] = useState("");
  const [estaTrabajando, setEstaTrabajando] = useState(false);
  const [mensajeDeError, setMensajeDeError] = useState<string | null>(null);
  const nombreSinEspacios = nombreDeLaCamara.trim();
  /** Ejemplos de nombres que todavía no son cámaras (no se propone cavar una que ya existe). */
  const ejemplosQueNoExisten = textosDeLaInterfaz.ejemplosDeCamaras.filter((ejemplo) => !camarasQueYaExisten.includes(ejemplo));

  /** Crea la carpeta de la cámara y la entrega; muestra el error si falla (por ejemplo, si ya existe). */
  const cavarCamaraNueva = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!nombreSinEspacios) return;
    setEstaTrabajando(true);
    setMensajeDeError(null);
    try {
      await crearCarpetaNueva(carpetaDelHormiguero, nombreSinEspacios);
      await alElegirCamara(nombreSinEspacios);
    } catch (error) {
      setMensajeDeError(String(error));
    } finally {
      setEstaTrabajando(false);
    }
  };

  return (
    <div className="elegir-hormiguero">
      <form className="elegir-hormiguero-nuevo" onSubmit={cavarCamaraNueva}>
        <label className="elegir-hormiguero-campo">
          <span>{textosDeLaInterfaz.nombreDeLaCarpeta}</span>
          <input
            value={nombreDeLaCamara}
            autoFocus={enfocarElNombreAlAparecer}
            spellCheck={false}
            placeholder={ejemplosQueNoExisten[0] ?? ""}
            onChange={(evento) => setNombreDeLaCamara(evento.target.value)}
          />
        </label>
        <div className="elegir-camara-ejemplos" aria-label={textosDeLaInterfaz.ejemplos}>
          {ejemplosQueNoExisten.map((ejemplo) => (
            <button key={ejemplo} type="button" onClick={() => setNombreDeLaCamara(ejemplo)}>{ejemplo}</button>
          ))}
        </div>
        <button type="submit" className="elegir-hormiguero-cavar" disabled={estaTrabajando || !nombreSinEspacios}>
          {textosDeLaInterfaz.cavarCamara}
        </button>
      </form>
      {ofrecerAbrirUnaQueYaExiste && camarasQueYaExisten.length > 0 && (
        <>
          <div className="elegir-hormiguero-o"><span>{textosDeLaInterfaz.camarasQueYaExisten}</span></div>
          <div className="elegir-camara-existentes">
            {camarasQueYaExisten.map((camaraQueExiste) => (
              <button key={camaraQueExiste} disabled={estaTrabajando} onClick={() => alElegirCamara(camaraQueExiste)}>
                {nombreVisibleDeLaCamara(camaraQueExiste, textosDeLaInterfaz.entrada)}
              </button>
            ))}
          </div>
        </>
      )}
      {mensajeDeError && <p className="elegir-hormiguero-error">{mensajeDeError}</p>}
    </div>
  );
}
