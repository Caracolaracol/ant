// Formulario para cavar un hormiguero: crear una carpeta nueva (nombre y dónde, por defecto en
// Documentos) o usar una carpeta que ya existe. Lo usan la última cámara de la bienvenida y la
// ventanita «Hormiguero nuevo» (menú File o Ajustes → General). Entrega la ruta de la
// carpeta con `onListo`; guardarla en los ajustes le toca a quien lo usa.

import { FormEvent, useEffect, useState } from "react";
import { useTextos } from "../idioma";
import { carpetaPorDefecto, crearCarpetaHormiguero, elegirCarpeta } from "./hormigueros";
import { ltr } from "../carpeta";
import "./Hormigueros.css";

interface Props {
  onListo(ruta: string): void;
  /** Pone el foco en el nombre al aparecer (en la ventanita sí; en la bienvenida, al llegar a su cámara). */
  autoFoco?: boolean;
}

export function ElegirHormiguero({ onListo, autoFoco }: Props) {
  const tx = useTextos();
  const [nombre, setNombre] = useState(tx.hormigueroPorDefecto);
  const [padre, setPadre] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Propone crear el hormiguero en Documentos.
  useEffect(() => {
    carpetaPorDefecto().then(setPadre, () => {});
  }, []);

  /** Corre una acción mostrando el error si falla y sin dejar pulsar dos veces. */
  async function hacer(accion: () => Promise<string | null>) {
    setOcupado(true);
    setError(null);
    try {
      const ruta = await accion();
      if (ruta) onListo(ruta);
    } catch (e) {
      setError(String(e));
    } finally {
      setOcupado(false);
    }
  }

  /** Crea la carpeta nueva. */
  const cavar = (e: FormEvent) => {
    e.preventDefault();
    if (padre && nombre.trim()) hacer(() => crearCarpetaHormiguero(padre, nombre));
  };

  return (
    <div className="elegir-hormiguero">
      <form className="eh-nuevo" onSubmit={cavar}>
        <label className="eh-campo">
          <span>{tx.nombreHormiguero}</span>
          <input
            value={nombre}
            autoFocus={autoFoco}
            spellCheck={false}
            placeholder={tx.hormigueroEjemplo}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <div className="eh-campo">
          <span>{tx.dentroDe}</span>
          <div className="eh-donde">
            <code title={padre ?? undefined}>{padre ? ltr(padre) : "…"}</code>
            <button type="button" onClick={() => elegirCarpeta(padre).then((r) => r && setPadre(r), (e) => setError(String(e)))}>
              {tx.cambiar}
            </button>
          </div>
        </div>
        <button type="submit" className="eh-cavar" disabled={ocupado || !padre || !nombre.trim()}>
          {tx.cavarHormiguero}
        </button>
      </form>
      <div className="eh-o"><span>{tx.o}</span></div>
      <button className="eh-existente" disabled={ocupado} onClick={() => hacer(() => elegirCarpeta(padre))}>
        {tx.usarCarpeta}
      </button>
      {error && <p className="eh-error">{error}</p>}
    </div>
  );
}
