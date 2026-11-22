// Lo que se ve en el lugar del editor cuando no hay ninguna nota abierta (al entrar por primera
// vez, o al cerrar la última): una invitación a empezar una nota nueva, con un botón que la crea en
// la raíz de la cámara abierta (pidiendo su nombre, como Cmd+N), o a abrir una desde el panel.

import { Icono } from "../Icono";
import { useTextos } from "../idioma";

interface Props {
  /** Nombre visible de la cámara abierta, donde se creará la nota. */
  nombreDeLaCamara: string;
  /** Atajo de «Nota nueva» como se lee (`⌘N`, o el que eligió el usuario). */
  atajoDeNotaNueva: string;
  alCrearNotaNueva(): void;
}

export function InvitacionANotaNueva({ nombreDeLaCamara, atajoDeNotaNueva, alCrearNotaNueva }: Props) {
  const textosDeLaInterfaz = useTextos();
  return (
    <div className="invitacion">
      <div className="invitacion-icono">
        <Icono nombreDelIcono="file-plus" tamanoEnPixeles={26} />
      </div>
      <h1>{textosDeLaInterfaz.sinNotaAbiertaTitulo}</h1>
      <p>{textosDeLaInterfaz.sinNotaAbiertaTexto(nombreDeLaCamara)}</p>
      <button className="invitacion-boton" onClick={alCrearNotaNueva}>
        {textosDeLaInterfaz.notaNuevaTitulo}
        <kbd>{atajoDeNotaNueva}</kbd>
      </button>
    </div>
  );
}
