// Formulario para cavar el hormiguero: crear una carpeta nueva (nombre y dónde, por defecto
// «Hormiguero» en Documentos) o usar una carpeta que ya existe. Lo usa la cámara «Tu hormiguero»
// de la bienvenida. Entrega la carpeta con `alElegirCarpeta`; guardarla en los ajustes le toca a
// quien lo usa.

import { FormEvent, useEffect, useState } from "react";
import { useTextos } from "../idioma";
import { marcarComoTextoDeIzquierdaADerecha } from "../arbolDeCarpetas";
import { carpetaDondeProponerCrearElHormiguero, crearCarpetaNueva, elegirCarpetaConElDialogo } from "./hormigueros";
import "./Hormigueros.css";

interface Props {
  /** Recibe la carpeta del hormiguero, creada o elegida. */
  alElegirCarpeta(carpetaDelHormiguero: string): void | Promise<void>;
}

export function ElegirHormiguero({ alElegirCarpeta }: Props) {
  const textosDeLaInterfaz = useTextos();
  const [nombreDelHormiguero, setNombreDelHormiguero] = useState(textosDeLaInterfaz.hormigueroPorDefecto);
  const [carpetaDondeCrearlo, setCarpetaDondeCrearlo] = useState<string | null>(null);
  const [estaTrabajando, setEstaTrabajando] = useState(false);
  const [mensajeDeError, setMensajeDeError] = useState<string | null>(null);

  // Propone crear el hormiguero en Documentos.
  useEffect(() => {
    carpetaDondeProponerCrearElHormiguero().then(setCarpetaDondeCrearlo, () => {});
  }, []);

  /** Corre una acción que entrega una carpeta, mostrando el error si falla y sin dejar pulsar dos veces. */
  async function obtenerCarpetaYEntregarla(obtenerCarpeta: () => Promise<string | null>) {
    setEstaTrabajando(true);
    setMensajeDeError(null);
    try {
      const carpetaObtenida = await obtenerCarpeta();
      if (carpetaObtenida) await alElegirCarpeta(carpetaObtenida);
    } catch (error) {
      setMensajeDeError(String(error));
    } finally {
      setEstaTrabajando(false);
    }
  }

  /** Crea la carpeta nueva. */
  const cavarHormigueroNuevo = (evento: FormEvent) => {
    evento.preventDefault();
    if (carpetaDondeCrearlo && nombreDelHormiguero.trim()) {
      obtenerCarpetaYEntregarla(() => crearCarpetaNueva(carpetaDondeCrearlo, nombreDelHormiguero));
    }
  };

  /** Cambia dónde se creará la carpeta. */
  const cambiarCarpetaDondeCrearlo = () =>
    elegirCarpetaConElDialogo(carpetaDondeCrearlo).then(
      (carpetaElegida) => carpetaElegida && setCarpetaDondeCrearlo(carpetaElegida),
      (error) => setMensajeDeError(String(error)),
    );

  return (
    <div className="elegir-hormiguero">
      <form className="elegir-hormiguero-nuevo" onSubmit={cavarHormigueroNuevo}>
        <label className="elegir-hormiguero-campo">
          <span>{textosDeLaInterfaz.nombreDeLaCarpeta}</span>
          <input
            value={nombreDelHormiguero}
            spellCheck={false}
            placeholder={textosDeLaInterfaz.hormigueroPorDefecto}
            onChange={(evento) => setNombreDelHormiguero(evento.target.value)}
          />
        </label>
        <div className="elegir-hormiguero-campo">
          <span>{textosDeLaInterfaz.dentroDe}</span>
          <div className="elegir-hormiguero-donde">
            <code title={carpetaDondeCrearlo ?? undefined}>
              {carpetaDondeCrearlo ? marcarComoTextoDeIzquierdaADerecha(carpetaDondeCrearlo) : "…"}
            </code>
            <button type="button" onClick={cambiarCarpetaDondeCrearlo}>
              {textosDeLaInterfaz.cambiar}
            </button>
          </div>
        </div>
        <button
          type="submit"
          className="elegir-hormiguero-cavar"
          disabled={estaTrabajando || !carpetaDondeCrearlo || !nombreDelHormiguero.trim()}
        >
          {textosDeLaInterfaz.cavarHormiguero}
        </button>
      </form>
      <div className="elegir-hormiguero-o"><span>{textosDeLaInterfaz.o}</span></div>
      <button
        className="elegir-hormiguero-existente"
        disabled={estaTrabajando}
        onClick={() => obtenerCarpetaYEntregarla(() => elegirCarpetaConElDialogo(carpetaDondeCrearlo))}
      >
        {textosDeLaInterfaz.usarCarpeta}
      </button>
      {mensajeDeError && <p className="elegir-hormiguero-error">{mensajeDeError}</p>}
    </div>
  );
}
