// Ventanita «Nota nueva» o «Carpeta nueva». La nota se pide con Cmd+N o clic
// derecho → Nota nueva…; la carpeta, con clic derecho → Carpeta nueva… en el árbol de la cámara.
// Pide el nombre (propone «Sin título» o «Carpeta nueva», ya seleccionado para escribir encima)
// y dice dónde se va a crear. Al confirmar, Rust crea la nota vacía (`crear_nota_nueva`) o la
// carpeta (`crear_carpeta_nueva`), sin pisar nunca una que ya exista, y quien la pidió recibe su
// ruta. Se cierra con Escape, la × o un clic fuera.

import { FormEvent, useEffect, useState } from "react";
import { crearNotaNueva } from "../archivosDeNotas";
import { useTextos } from "../idioma";
import { crearCarpetaNueva } from "./hormigueros";
import "./Hormigueros.css";

/** Qué se crea: una nota (`.md`) o una carpeta. */
export type QueSeCrea = "nota" | "carpeta";

interface Props {
  queSeCrea: QueSeCrea;
  carpetaDondeCrearla: string;
  /** Lugar donde se crea, como se muestra («Novela / Libro I»). */
  lugarVisible: string;
  /** Recibe la ruta de la nota o carpeta recién creada. */
  alCrear(rutaCreada: string): void | Promise<void>;
  alCerrar(): void;
}

export function NuevaNotaOCarpeta({ queSeCrea, carpetaDondeCrearla, lugarVisible, alCrear, alCerrar }: Props) {
  const textosDeLaInterfaz = useTextos();
  const esCarpeta = queSeCrea === "carpeta";
  const [nombre, setNombre] = useState(esCarpeta ? textosDeLaInterfaz.nombrePropuestoDeLaCarpeta : textosDeLaInterfaz.nombrePropuestoDeLaNota);
  const [estaTrabajando, setEstaTrabajando] = useState(false);
  const [mensajeDeError, setMensajeDeError] = useState<string | null>(null);
  const nombreSinEspacios = nombre.trim();
  const titulo = esCarpeta ? textosDeLaInterfaz.carpetaNuevaTitulo : textosDeLaInterfaz.notaNuevaTitulo;

  useEffect(() => {
    const alPresionarEscape = (evento: KeyboardEvent) => evento.key === "Escape" && alCerrar();
    window.addEventListener("keydown", alPresionarEscape);
    return () => window.removeEventListener("keydown", alPresionarEscape);
  }, [alCerrar]);

  /** Crea la nota o la carpeta y la entrega; si falla (ya hay una con ese nombre), muestra el error. */
  const crear = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!nombreSinEspacios) return;
    setEstaTrabajando(true);
    setMensajeDeError(null);
    try {
      const rutaCreada = esCarpeta
        ? await crearCarpetaNueva(carpetaDondeCrearla, nombreSinEspacios)
        : await crearNotaNueva(carpetaDondeCrearla, nombreSinEspacios);
      await alCrear(rutaCreada);
    } catch (error) {
      setMensajeDeError(String(error));
      setEstaTrabajando(false);
    }
  };

  return (
    <div className="modal-fondo modal-encima" onMouseDown={(evento) => evento.target === evento.currentTarget && alCerrar()}>
      <div className="modal nuevo-hormiguero" role="dialog" aria-label={titulo}>
        <button className="modal-cerrar" aria-label={textosDeLaInterfaz.cerrar} onClick={alCerrar}>×</button>
        <h1>{titulo}</h1>
        <p className="nuevo-hormiguero-ayuda">
          {textosDeLaInterfaz.seCrearaEn} <b>{lugarVisible}</b>
        </p>
        <form className="elegir-hormiguero elegir-hormiguero-nuevo" onSubmit={crear}>
          <label className="elegir-hormiguero-campo">
            <span>{textosDeLaInterfaz.nombreDeLaNota}</span>
            <input
              value={nombre}
              autoFocus
              // Seleccionado al aparecer: se escribe el nombre encima, o Enter deja el propuesto.
              onFocus={(evento) => evento.currentTarget.select()}
              spellCheck={false}
              onChange={(evento) => setNombre(evento.target.value)}
            />
          </label>
          <button type="submit" className="elegir-hormiguero-cavar" disabled={estaTrabajando || !nombreSinEspacios}>
            {esCarpeta ? textosDeLaInterfaz.crearCarpeta : textosDeLaInterfaz.crearNota}
          </button>
          {mensajeDeError && <p className="elegir-hormiguero-error">{mensajeDeError}</p>}
        </form>
      </div>
    </div>
  );
}
