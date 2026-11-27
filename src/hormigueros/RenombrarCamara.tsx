// Diálogo de Ajustes → General para cambiar el nombre de una cámara sin moverla de hormiguero.

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTextos } from "../idioma";
import { textoDelError } from "./camarasCifradas";
import "./Hormigueros.css";

interface Props {
  nombreAnterior: string;
  alRenombrar(nombreNuevo: string): Promise<void>;
  alCerrar(): void;
}

/** Pide el nombre de la carpeta y muestra cualquier error sin perder el nombre escrito. */
export function RenombrarCamara({ nombreAnterior, alRenombrar, alCerrar }: Props) {
  const textosDeLaInterfaz = useTextos();
  const [nombre, setNombre] = useState(nombreAnterior);
  const [estaGuardando, setEstaGuardando] = useState(false);
  const [mensajeDeError, setMensajeDeError] = useState<string | null>(null);
  const campoDelNombre = useRef<HTMLInputElement>(null);
  // Al abrir, se puede escribir encima del nombre o mover el cursor para editar una parte.
  useEffect(() => {
    campoDelNombre.current?.focus();
    campoDelNombre.current?.select();
  }, []);
  const nombreNuevo = nombre.trim();
  const puedeGuardar = !estaGuardando && nombreNuevo !== "" && nombreNuevo !== nombreAnterior;
  const titulo = textosDeLaInterfaz.renombrarCamaraTitulo(nombreAnterior);

  /** Solo cierra el diálogo cuando terminó el cambio en disco. */
  const guardarNombre = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!puedeGuardar) return;
    setEstaGuardando(true);
    setMensajeDeError(null);
    try {
      await alRenombrar(nombreNuevo);
      alCerrar();
    } catch (error) {
      setMensajeDeError(textoDelError(error, textosDeLaInterfaz));
      setEstaGuardando(false);
    }
  };

  return (
    <div
      className="modal-fondo modal-encima"
      onMouseDown={(evento) => !estaGuardando && evento.target === evento.currentTarget && alCerrar()}
      onKeyDown={(evento) => {
        if (evento.key === "Escape") {
          evento.stopPropagation();
          if (!estaGuardando) alCerrar();
        }
      }}
    >
      <div className="modal nuevo-hormiguero" role="dialog" aria-modal="true" aria-label={titulo}>
        <button className="modal-cerrar" aria-label={textosDeLaInterfaz.cerrar} disabled={estaGuardando} onClick={alCerrar}>×</button>
        <h1>{titulo}</h1>
        <form className="elegir-hormiguero elegir-hormiguero-nuevo" onSubmit={guardarNombre}>
          <label className="elegir-hormiguero-campo">
            <span>{textosDeLaInterfaz.nombreDeLaNota}</span>
            <input
              ref={campoDelNombre}
              value={nombre}
              readOnly={estaGuardando}
              spellCheck={false}
              onChange={(evento) => setNombre(evento.target.value)}
            />
          </label>
          <button type="submit" className="elegir-hormiguero-cavar" disabled={!puedeGuardar}>{textosDeLaInterfaz.renombrarCamaraGuardar}</button>
          {mensajeDeError && <p className="elegir-hormiguero-error" role="alert">{mensajeDeError}</p>}
        </form>
      </div>
    </div>
  );
}
