// Ventanita «Nota nueva» (botón de arriba o Cmd+N): pide el nombre de la nota, propone «Sin
// título» ya seleccionado para escribir encima, y dice dónde se va a crear (la carpeta de la nota
// visible si es de la cámara abierta, o la cámara misma). Al confirmar, Rust crea el archivo vacío
// (`crear_nota_nueva`, nunca pisa otra nota) y quien la abre recibe su ruta. Se cierra con Escape,
// la × o un clic fuera.

import { FormEvent, useEffect, useState } from "react";
import { crearNotaNueva } from "../archivosDeNotas";
import { useTextos } from "../idioma";
import "../hormigueros/Hormigueros.css";

interface Props {
  carpetaDondeCrearla: string;
  /** Lugar donde se crea, como se muestra («Novela / Libro I»). */
  lugarVisible: string;
  /** Recibe la ruta de la nota recién creada, para abrirla. */
  alCrearNota(rutaDeLaNota: string): void | Promise<void>;
  alCerrar(): void;
}

export function NuevaNota({ carpetaDondeCrearla, lugarVisible, alCrearNota, alCerrar }: Props) {
  const textosDeLaInterfaz = useTextos();
  const [nombreDeLaNota, setNombreDeLaNota] = useState(textosDeLaInterfaz.nombrePropuestoDeLaNota);
  const [estaTrabajando, setEstaTrabajando] = useState(false);
  const [mensajeDeError, setMensajeDeError] = useState<string | null>(null);
  const nombreSinEspacios = nombreDeLaNota.trim();

  useEffect(() => {
    const alPresionarEscape = (evento: KeyboardEvent) => evento.key === "Escape" && alCerrar();
    window.addEventListener("keydown", alPresionarEscape);
    return () => window.removeEventListener("keydown", alPresionarEscape);
  }, [alCerrar]);

  /** Crea el archivo y lo entrega; si falla (ya hay una nota con ese nombre), muestra el error. */
  const crearLaNota = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!nombreSinEspacios) return;
    setEstaTrabajando(true);
    setMensajeDeError(null);
    try {
      await alCrearNota(await crearNotaNueva(carpetaDondeCrearla, nombreSinEspacios));
    } catch (error) {
      setMensajeDeError(String(error));
      setEstaTrabajando(false);
    }
  };

  return (
    <div className="modal-fondo modal-encima" onMouseDown={(evento) => evento.target === evento.currentTarget && alCerrar()}>
      <div className="modal nuevo-hormiguero" role="dialog" aria-label={textosDeLaInterfaz.notaNuevaTitulo}>
        <button className="modal-cerrar" aria-label={textosDeLaInterfaz.cerrar} onClick={alCerrar}>×</button>
        <h1>{textosDeLaInterfaz.notaNuevaTitulo}</h1>
        <p className="nuevo-hormiguero-ayuda">
          {textosDeLaInterfaz.seCrearaEn} <b>{lugarVisible}</b>
        </p>
        <form className="elegir-hormiguero elegir-hormiguero-nuevo" onSubmit={crearLaNota}>
          <label className="elegir-hormiguero-campo">
            <span>{textosDeLaInterfaz.nombreDeLaNota}</span>
            <input
              value={nombreDeLaNota}
              autoFocus
              // Seleccionado al aparecer: se escribe el nombre encima, o Enter deja «Sin título».
              onFocus={(evento) => evento.currentTarget.select()}
              spellCheck={false}
              onChange={(evento) => setNombreDeLaNota(evento.target.value)}
            />
          </label>
          <button type="submit" className="elegir-hormiguero-cavar" disabled={estaTrabajando || !nombreSinEspacios}>
            {textosDeLaInterfaz.crearNota}
          </button>
          {mensajeDeError && <p className="elegir-hormiguero-error">{mensajeDeError}</p>}
        </form>
      </div>
    </div>
  );
}
