// Ventana de Ajustes (se abre con Ant → Ajustes… o Cmd+,). Está dividida en dos: a la izquierda
// la lista de áreas de ajustes y a la derecha las opciones del área elegida.
// Para agregar un área nueva: sumarla a `AREAS` y crear su panel.

import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { Ajustes, escucharAjustes, guardarAjustes, leerAjustes } from "../ajustes";
import "../App.css";
import "./VentanaAjustes.css";

/** Áreas de ajustes que aparecen en la columna izquierda. */
const AREAS = [{ id: "general", nombre: "General" }] as const;
type IdArea = (typeof AREAS)[number]["id"];

interface PanelProps {
  ajustes: Ajustes;
  cambiar(cambios: Partial<Ajustes>): void;
}

/** Área «General»: por ahora solo la carpeta de trabajo. */
function PanelGeneral({ ajustes, cambiar }: PanelProps) {
  /** Abre el diálogo del sistema para elegir una carpeta. */
  async function elegirCarpeta() {
    const carpeta = await open({ directory: true, multiple: false, defaultPath: ajustes.carpeta ?? undefined });
    if (typeof carpeta === "string") cambiar({ carpeta });
  }

  return (
    <>
      <h1>General</h1>
      <div className="ajuste">
        <div className="ajuste-titulo">Carpeta de trabajo</div>
        <p className="ajuste-ayuda">La barra lateral muestra las notas de esta carpeta y sus subcarpetas.</p>
        <div className="ajuste-carpeta">
          <code title={ajustes.carpeta ?? undefined}>{ajustes.carpeta ?? "Ninguna seleccionada"}</code>
          <button onClick={elegirCarpeta}>Elegir…</button>
          {ajustes.carpeta && <button onClick={() => cambiar({ carpeta: null })}>Quitar</button>}
        </div>
      </div>
    </>
  );
}

export function VentanaAjustes() {
  const [area, setArea] = useState<IdArea>("general");
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Carga los ajustes al abrir y los mantiene al día si otra ventana los cambia.
  useEffect(() => {
    leerAjustes().then(setAjustes, (e) => setError(String(e)));
    const dejar = escucharAjustes(setAjustes);
    return () => void dejar.then((f) => f());
  }, []);

  // Cmd+W cierra esta ventana (el menú de la app no lo hace, para no cerrar la principal sin querer).
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.metaKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        getCurrentWindow().close();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  /** Aplica un cambio y lo guarda de inmediato (no hay botón «Aceptar», como en macOS). */
  function cambiar(cambios: Partial<Ajustes>) {
    if (!ajustes) return;
    const nuevos = { ...ajustes, ...cambios };
    setAjustes(nuevos);
    guardarAjustes(nuevos).then(() => setError(null), (e) => setError(String(e)));
  }

  return (
    <main className="ajustes">
      <nav className="ajustes-areas" data-tauri-drag-region>
        {AREAS.map((a) => (
          <div key={a.id} className={`ajustes-area${a.id === area ? " activa" : ""}`} onClick={() => setArea(a.id)}>
            {a.nombre}
          </div>
        ))}
      </nav>
      <section className="ajustes-panel">
        <div className="arrastre" data-tauri-drag-region />
        {ajustes && area === "general" && <PanelGeneral ajustes={ajustes} cambiar={cambiar} />}
        {error && <p className="ajustes-error">{error}</p>}
      </section>
    </main>
  );
}
