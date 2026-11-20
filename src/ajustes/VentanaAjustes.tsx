// Ventana de Ajustes (se abre con Ant → Settings… / Ajustes… o Cmd+,). Está dividida en dos: a la
// izquierda la lista de áreas de ajustes y a la derecha las opciones del área elegida:
//   General (idioma y carpeta de trabajo) · Editor (modo escritor) · Diario (calendario y notas
//   diarias) · Apariencia (colores).
// Los textos salen de `idioma.tsx`, así la ventana cambia de idioma apenas se elige otro.
// Para agregar un área nueva: sumarla a `AREAS` (y su nombre a `areas` en `idioma.tsx`), crear
// su panel y mostrarlo en `VentanaAjustes`.

import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { Ajustes, OpcionesEscritor, escucharAjustes, guardarAjustes, leerAjustes } from "../ajustes";
import { COLORES_BASE, TEMAS, VARIABLES } from "../colores";
import { CARPETA_DIARIO } from "../diario";
import { IDIOMAS, Idioma, idiomaDe, useTextos } from "../idioma";
import "../App.css";
import "./VentanaAjustes.css";

/** Áreas de ajustes que aparecen en la columna izquierda (sus nombres están en `idioma.tsx`). */
const AREAS = ["general", "editor", "diario", "apariencia"] as const;
type IdArea = (typeof AREAS)[number];

interface PanelProps {
  ajustes: Ajustes;
  cambiar(cambios: Partial<Ajustes>): void;
}

/** Área «General»: idioma de la interfaz y carpeta de trabajo. */
function PanelGeneral({ ajustes, cambiar }: PanelProps) {
  const tx = useTextos();

  /** Abre el diálogo del sistema para elegir una carpeta. */
  async function elegirCarpeta() {
    const carpeta = await open({ directory: true, multiple: false, defaultPath: ajustes.carpeta ?? undefined });
    if (typeof carpeta === "string") cambiar({ carpeta });
  }

  return (
    <>
      <h1>{tx.areas.general}</h1>
      <div className="ajuste">
        <div className="ajuste-titulo">{tx.idioma}</div>
        <p className="ajuste-ayuda">{tx.idiomaAyuda}</p>
        <select
          className="ajuste-select"
          value={idiomaDe(ajustes.idioma)}
          onChange={(e) => cambiar({ idioma: e.target.value as Idioma })}
        >
          {IDIOMAS.map((i) => (
            <option key={i.id} value={i.id}>{i.nombre}</option>
          ))}
        </select>
      </div>
      <div className="ajuste">
        <div className="ajuste-titulo">{tx.carpetaTrabajo}</div>
        <p className="ajuste-ayuda">{tx.carpetaAyuda}</p>
        <div className="ajuste-carpeta">
          <code title={ajustes.carpeta ?? undefined}>{ajustes.carpeta ?? tx.ningunaCarpeta}</code>
          <button onClick={elegirCarpeta}>{tx.elegir}</button>
          {ajustes.carpeta && <button onClick={() => cambiar({ carpeta: null })}>{tx.quitar}</button>}
        </div>
      </div>
    </>
  );
}

/**
 * Área «Editor»: arriba de todo, el interruptor del modo escritor; con el modo activo aparecen
 * debajo sus opciones (tipografía al escribir y página). Con el modo apagado, por ahora, nada más.
 */
function PanelEditor({ ajustes, cambiar }: PanelProps) {
  const tx = useTextos();
  const o = ajustes.opciones_escritor;
  /** Cambia una opción del modo escritor. */
  const opcion = (cambios: Partial<OpcionesEscritor>) => cambiar({ opciones_escritor: { ...o, ...cambios } });
  /** Ejemplo de las comillas que se usarán, según el estilo elegido y el idioma de la app. */
  const latinas = o.estilo_comillas === "latinas" || (o.estilo_comillas === "auto" && idiomaDe(ajustes.idioma) === "es");

  /** Fila con casilla, nombre y, a la derecha, el ejemplo de lo que se teclea → lo que queda. */
  const fila = (clave: keyof OpcionesEscritor, nombre: string, de: string, a: string) => (
    <label className="ajuste-casilla ajuste-reemplazo">
      <input type="checkbox" checked={o[clave] as boolean} onChange={(e) => opcion({ [clave]: e.target.checked })} />
      <span>{nombre}</span>
      <code>{de} → {a}</code>
    </label>
  );

  return (
    <>
      <h1>{tx.areas.editor}</h1>
      {/* El modo escritor no es un ajuste más: va destacado, con un interruptor. */}
      <label className={`ajuste-modo${ajustes.escritor ? " activo" : ""}`}>
        <div>
          <div className="ajuste-modo-titulo">{tx.modoEscritor}</div>
          <p className="ajuste-ayuda">{tx.modoEscritorAyuda}</p>
        </div>
        <input
          type="checkbox"
          className="interruptor"
          role="switch"
          checked={ajustes.escritor}
          onChange={(e) => cambiar({ escritor: e.target.checked })}
        />
      </label>

      {ajustes.escritor && (
        <>
          <div className="ajuste">
            <div className="ajuste-titulo">{tx.tipografia}</div>
            <p className="ajuste-ayuda">{tx.tipografiaAyuda}</p>
            <div className="ajuste-lista">
              <div className="ajuste-con-opcion">
                {fila("comillas", tx.comillas, '"hola"', latinas ? "«hola»" : "“hola”")}
                {o.comillas && (
                  <select
                    className="ajuste-select"
                    value={o.estilo_comillas}
                    onChange={(e) => opcion({ estilo_comillas: e.target.value as OpcionesEscritor["estilo_comillas"] })}
                  >
                    {(["auto", "curvas", "latinas"] as const).map((v) => (
                      <option key={v} value={v}>{tx.estiloComillas[v]}</option>
                    ))}
                  </select>
                )}
              </div>
              {fila("rayas", tx.rayas, "--", "—")}
              {fila("puntos", tx.puntos, "...", "…")}
              {fila("angulares", tx.angulares, "<< >>", "« »")}
              {fila("flechas", tx.flechas, "-> <-", "→ ←")}
            </div>
          </div>
          <div className="ajuste">
            <div className="ajuste-titulo">{tx.pagina}</div>
            <div className="ajuste-lista">
              <label className="ajuste-casilla ajuste-casilla-ayuda">
                <input type="checkbox" checked={o.letra_libro} onChange={(e) => opcion({ letra_libro: e.target.checked })} />
                <span>{tx.letraLibro}<small>{tx.letraLibroAyuda}</small></span>
              </label>
              <label className="ajuste-casilla ajuste-casilla-ayuda">
                <input type="checkbox" checked={o.corrector} onChange={(e) => opcion({ corrector: e.target.checked })} />
                <span>{tx.corrector}<small>{tx.correctorAyuda}</small></span>
              </label>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/** Área «Diario»: activa el calendario de la barra lateral y las notas diarias en `Daily/`. */
function PanelDiario({ ajustes, cambiar }: PanelProps) {
  const tx = useTextos();
  return (
    <>
      <h1>{tx.areas.diario}</h1>
      <div className="ajuste">
        <label className="ajuste-casilla">
          <input type="checkbox" checked={ajustes.diario} onChange={(e) => cambiar({ diario: e.target.checked })} />
          <span className="ajuste-titulo">{tx.activarDiario}</span>
        </label>
        <p className="ajuste-ayuda">
          {tx.diarioAyuda(<code>{CARPETA_DIARIO}/2026-11-20.md</code>, <code>{CARPETA_DIARIO}</code>)}
        </p>
        {ajustes.diario && !ajustes.carpeta && <p className="ajuste-aviso">{tx.diarioAviso}</p>}
      </div>
    </>
  );
}

/**
 * Área «Apariencia»: temas listos y cada color por separado. Los colores se guardan en
 * `ajustes.colores` y `main.tsx` los aplica al instante en todas las ventanas.
 */
function PanelApariencia({ ajustes, cambiar }: PanelProps) {
  const tx = useTextos();
  /** Color que se ve ahora para una variable: el cambiado por el usuario o el de por defecto. */
  const actual = (id: string) => ajustes.colores[id] ?? COLORES_BASE[id];
  /** El tema elegido es el que coincide en todos sus colores con los actuales (o ninguno, si se retocó). */
  const temaActual = TEMAS.find((t) => VARIABLES.every((id) => t.colores[id] === actual(id)))?.id;

  return (
    <>
      <h1>{tx.areas.apariencia}</h1>
      <div className="ajuste">
        <div className="ajuste-titulo">{tx.tema}</div>
        <p className="ajuste-ayuda">{tx.temaAyuda}</p>
        <div className="ajuste-temas">
          {TEMAS.map((t, i) => (
            <button
              key={t.id}
              className={`ajuste-tema${t.id === temaActual ? " elegido" : ""}`}
              style={{ background: t.colores.fondo, color: t.colores.texto }}
              // El primer tema es el de `App.css`: elegirlo deja los colores sin cambios guardados.
              onClick={() => cambiar({ colores: i === 0 ? {} : { ...t.colores } })}
            >
              <span className="ajuste-tema-punto" style={{ background: t.colores.acento }} />
              {tx.nombresTemas[t.id]}
            </button>
          ))}
        </div>
      </div>
      <div className="ajuste">
        <div className="ajuste-titulo">{tx.colores}</div>
        <div className="ajuste-colores">
          {VARIABLES.map((id) => (
            <label key={id} className="ajuste-color">
              <input
                type="color"
                value={actual(id)}
                onChange={(e) => cambiar({ colores: { ...ajustes.colores, [id]: e.target.value } })}
              />
              <span>{tx.nombresColores[id]}</span>
              <code>{actual(id)}</code>
            </label>
          ))}
        </div>
        <button className="ajuste-boton" onClick={() => cambiar({ colores: {} })}>{tx.restablecerColores}</button>
      </div>
    </>
  );
}

export function VentanaAjustes() {
  const tx = useTextos();
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
          <div key={a} className={`ajustes-area${a === area ? " activa" : ""}`} onClick={() => setArea(a)}>
            {tx.areas[a]}
          </div>
        ))}
      </nav>
      <section className="ajustes-panel">
        <div className="arrastre" data-tauri-drag-region />
        {ajustes && area === "general" && <PanelGeneral ajustes={ajustes} cambiar={cambiar} />}
        {ajustes && area === "editor" && <PanelEditor ajustes={ajustes} cambiar={cambiar} />}
        {ajustes && area === "diario" && <PanelDiario ajustes={ajustes} cambiar={cambiar} />}
        {ajustes && area === "apariencia" && <PanelApariencia ajustes={ajustes} cambiar={cambiar} />}
        {error && <p className="ajustes-error">{error}</p>}
      </section>
    </main>
  );
}
