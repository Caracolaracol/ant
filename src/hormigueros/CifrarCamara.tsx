// Ventanita para cifrar una cámara o quitarle el cifrado (Ajustes → General → Cámaras).
//   · Cifrar: explica qué protege, avisa en grande que olvidar la contraseña es perder todo lo de
//     la cámara (nadie puede recuperarla), cuenta lo que cambia (los nombres siguen visibles, otras
//     apps no la abren, se bloquea sola) y pide la contraseña dos veces y marcar que se entiende el
//     riesgo. Sin esas tres cosas, el botón no se activa.
//   · Quitar el cifrado: avisa que todo vuelve a quedar legible y pide la contraseña.
// Cifrar o descifrar todos los archivos puede tardar: mientras tanto el botón dice «Cifrando…».

import { FormEvent, useEffect, useState } from "react";
import { useTextos } from "../idioma";
import { Icono } from "../Icono";
import { textoDelError } from "./camarasCifradas";
import "./Hormigueros.css";

/** Largo mínimo de la contraseña (el mismo que pide Rust). */
const LARGO_MINIMO_DE_LA_CONTRASENA = 8;

interface Props {
  /** Cifrar la cámara, o quitarle el cifrado. */
  queSeHace: "cifrar" | "quitar_cifrado";
  /** Nombre visible de la cámara. */
  nombreDeLaCamara: string;
  /** Cifra (o descifra) con la contraseña; si falla (contraseña incorrecta…), se muestra el error. */
  alConfirmar(contrasena: string): Promise<void>;
  alCerrar(): void;
}

export function CifrarCamara({ queSeHace, nombreDeLaCamara, alConfirmar, alCerrar }: Props) {
  const textosDeLaInterfaz = useTextos();
  const esCifrar = queSeHace === "cifrar";
  const [contrasena, setContrasena] = useState("");
  const [contrasenaRepetida, setContrasenaRepetida] = useState("");
  const [entiendeElRiesgo, setEntiendeElRiesgo] = useState(false);
  const [estaTrabajando, setEstaTrabajando] = useState(false);
  const [mensajeDeError, setMensajeDeError] = useState<string | null>(null);

  // Escape cierra, salvo mientras se cifra (no se puede dejar a medias desde aquí).
  useEffect(() => {
    const alPresionarEscape = (evento: KeyboardEvent) => evento.key === "Escape" && !estaTrabajando && alCerrar();
    window.addEventListener("keydown", alPresionarEscape);
    return () => window.removeEventListener("keydown", alPresionarEscape);
  }, [alCerrar, estaTrabajando]);

  const contrasenaEsCorta = contrasena.length > 0 && contrasena.length < LARGO_MINIMO_DE_LA_CONTRASENA;
  const contrasenasDistintas = contrasenaRepetida.length > 0 && contrasena !== contrasenaRepetida;
  const sePuedeConfirmar = esCifrar
    ? contrasena.length >= LARGO_MINIMO_DE_LA_CONTRASENA && contrasena === contrasenaRepetida && entiendeElRiesgo
    : contrasena.length > 0;

  /** Cifra o descifra; si sale bien, quien la abrió la cierra. */
  const confirmar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!sePuedeConfirmar || estaTrabajando) return;
    setEstaTrabajando(true);
    setMensajeDeError(null);
    try {
      await alConfirmar(contrasena);
    } catch (error) {
      setMensajeDeError(textoDelError(error, textosDeLaInterfaz));
      setEstaTrabajando(false);
    }
  };

  return (
    <div className="modal-fondo modal-encima" onMouseDown={(evento) => evento.target === evento.currentTarget && !estaTrabajando && alCerrar()}>
      <div className="modal nuevo-hormiguero cifrar-camara" role="dialog" aria-label={esCifrar ? textosDeLaInterfaz.cifrarCamaraTitulo(nombreDeLaCamara) : textosDeLaInterfaz.quitarCifradoTitulo(nombreDeLaCamara)}>
        <button className="modal-cerrar" aria-label={textosDeLaInterfaz.cerrar} onClick={alCerrar} disabled={estaTrabajando}>×</button>
        <h1>{esCifrar ? textosDeLaInterfaz.cifrarCamaraTitulo(nombreDeLaCamara) : textosDeLaInterfaz.quitarCifradoTitulo(nombreDeLaCamara)}</h1>
        <p className="nuevo-hormiguero-ayuda">{esCifrar ? textosDeLaInterfaz.cifrarCamaraTexto : textosDeLaInterfaz.quitarCifradoTexto}</p>
        {esCifrar && (
          <>
            <div className="cifrar-camara-advertencia" role="alert">
              <Icono nombreDelIcono="triangle-exclamation-point" tamanoEnPixeles={18} />
              <span>{textosDeLaInterfaz.cifrarAdvertencia}</span>
            </div>
            <p className="nuevo-hormiguero-ayuda">{textosDeLaInterfaz.cifrarDetalles}</p>
          </>
        )}
        <form className="elegir-hormiguero elegir-hormiguero-nuevo" onSubmit={confirmar}>
          <label className="elegir-hormiguero-campo">
            <span>{textosDeLaInterfaz.contrasena}</span>
            <input type="password" value={contrasena} autoFocus autoComplete="new-password" onChange={(evento) => setContrasena(evento.target.value)} />
            {esCifrar && contrasenaEsCorta && <small className="cifrar-camara-pista">{textosDeLaInterfaz.contrasenaCorta}</small>}
          </label>
          {esCifrar && (
            <label className="elegir-hormiguero-campo">
              <span>{textosDeLaInterfaz.repetirContrasena}</span>
              <input type="password" value={contrasenaRepetida} autoComplete="new-password" onChange={(evento) => setContrasenaRepetida(evento.target.value)} />
              {contrasenasDistintas && <small className="cifrar-camara-pista">{textosDeLaInterfaz.contrasenasDistintas}</small>}
            </label>
          )}
          {esCifrar && (
            <label className="cifrar-camara-entiendo">
              <input type="checkbox" checked={entiendeElRiesgo} onChange={(evento) => setEntiendeElRiesgo(evento.target.checked)} />
              <span>{textosDeLaInterfaz.entiendoQuePierdoTodo}</span>
            </label>
          )}
          <button type="submit" className="elegir-hormiguero-cavar" disabled={!sePuedeConfirmar || estaTrabajando}>
            {estaTrabajando
              ? esCifrar ? textosDeLaInterfaz.cifrando : textosDeLaInterfaz.quitandoElCifrado
              : esCifrar ? textosDeLaInterfaz.cifrarLaCamara : textosDeLaInterfaz.quitarElCifrado}
          </button>
          {mensajeDeError && <p className="elegir-hormiguero-error">{mensajeDeError}</p>}
        </form>
      </div>
    </div>
  );
}
