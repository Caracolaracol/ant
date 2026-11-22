// Lo que se ve en el lugar del editor cuando la cámara abierta está cifrada y bloqueada: un
// candado, su nombre y el campo para la contraseña. Con la contraseña correcta la cámara se
// desbloquea (su árbol, sus fijados y sus notas vuelven a verse); si no, avisa.

import { FormEvent, useState } from "react";
import { Icono } from "../Icono";
import { useTextos } from "../idioma";
import { textoDelError } from "./camarasCifradas";

interface Props {
  nombreDeLaCamara: string;
  /** Desbloquea con la contraseña; falla si es incorrecta. */
  alDesbloquear(contrasena: string): Promise<void>;
}

export function DesbloquearCamara({ nombreDeLaCamara, alDesbloquear }: Props) {
  const textosDeLaInterfaz = useTextos();
  const [contrasena, setContrasena] = useState("");
  const [estaTrabajando, setEstaTrabajando] = useState(false);
  const [mensajeDeError, setMensajeDeError] = useState<string | null>(null);

  /** Intenta desbloquear; si la contraseña es incorrecta, la deja seleccionada para escribirla de nuevo. */
  const desbloquear = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!contrasena || estaTrabajando) return;
    setEstaTrabajando(true);
    setMensajeDeError(null);
    try {
      await alDesbloquear(contrasena);
    } catch (error) {
      setMensajeDeError(textoDelError(error, textosDeLaInterfaz));
      setEstaTrabajando(false);
      setContrasena("");
    }
  };

  return (
    <div className="invitacion">
      <div className="invitacion-icono">
        <Icono nombreDelIcono="lock" tamanoEnPixeles={26} />
      </div>
      <h1>{textosDeLaInterfaz.desbloquearTitulo(nombreDeLaCamara)}</h1>
      <p>{textosDeLaInterfaz.desbloquearTexto}</p>
      <form className="desbloquear" onSubmit={desbloquear}>
        <input
          type="password"
          value={contrasena}
          autoFocus
          placeholder={textosDeLaInterfaz.contrasena}
          aria-label={textosDeLaInterfaz.contrasena}
          onChange={(evento) => setContrasena(evento.target.value)}
        />
        <button type="submit" className="invitacion-boton" disabled={!contrasena || estaTrabajando}>
          {estaTrabajando ? textosDeLaInterfaz.desbloqueando : textosDeLaInterfaz.desbloquear}
        </button>
      </form>
      {mensajeDeError && <p className="desbloquear-error">{mensajeDeError}</p>}
    </div>
  );
}
