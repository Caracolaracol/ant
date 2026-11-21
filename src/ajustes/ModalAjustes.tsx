// Ajustes (Ant → Settings… / Ajustes… o Cmd+,): una ventanita sobre la ventana principal, no una
// ventana aparte. Está dividida en dos: a la izquierda la lista de áreas de ajustes y a la
// derecha las opciones del área elegida:
//   General (idioma y hormigueros) · Editor (modo escritor) · Diario (calendario y notas
//   diarias) · Apariencia (colores).
// Los cambios se aplican y guardan al instante (`cambiarAjustes`, de App); se cierra con Escape,
// Cmd+W, la × o un clic fuera. Los textos salen de `idioma.tsx`, así cambia de idioma apenas se
// elige otro. Para agregar un área nueva: sumarla a `AREAS_DE_AJUSTES` (y su nombre a `areas` en
// `idioma.tsx`), crear su panel y mostrarlo en `ModalAjustes`.

import { useEffect, useState } from "react";
import { Ajustes, OpcionesDelModoEscritor } from "../ajustes";
import { COLORES_POR_DEFECTO, TEMAS, VARIABLES_DE_COLOR } from "../colores";
import { NOMBRE_DE_LA_CARPETA_DEL_DIARIO } from "../diario";
import { cambiosParaQuitarHormigueroDeLaLista } from "../hormigueros/hormigueros";
import { IDIOMAS, Idioma, idiomaValido, useTextos } from "../idioma";
import { nombreDelArchivo } from "../archivosDeNotas";
import { marcarComoTextoDeIzquierdaADerecha } from "../arbolDeCarpetas";
import "./ModalAjustes.css";

/** Áreas de ajustes que aparecen en la columna izquierda (sus nombres están en `idioma.tsx`). */
const AREAS_DE_AJUSTES = ["general", "editor", "diario", "apariencia"] as const;
type AreaDeAjustes = (typeof AREAS_DE_AJUSTES)[number];

interface PropsDeUnPanel {
  ajustes: Ajustes;
  cambiarAjustes(cambios: Partial<Ajustes>): void;
}

/**
 * Área «General»: idioma de la interfaz y la lista de hormigueros, con el abierto marcado. Desde
 * aquí se abre otro, se quita uno de la lista (su carpeta queda en el disco) o se cava uno nuevo.
 */
function PanelGeneral({ ajustes, cambiarAjustes, alPedirHormigueroNuevo }: PropsDeUnPanel & { alPedirHormigueroNuevo(): void }) {
  const textosDeLaInterfaz = useTextos();
  return (
    <>
      <h1>{textosDeLaInterfaz.areas.general}</h1>
      <div className="ajuste">
        <div className="ajuste-titulo">{textosDeLaInterfaz.idioma}</div>
        <p className="ajuste-ayuda">{textosDeLaInterfaz.idiomaAyuda}</p>
        <select
          className="ajuste-select"
          value={idiomaValido(ajustes.idioma)}
          onChange={(evento) => cambiarAjustes({ idioma: evento.target.value as Idioma })}
        >
          {IDIOMAS.map((idiomaDisponible) => (
            <option key={idiomaDisponible.id} value={idiomaDisponible.id}>{idiomaDisponible.nombre}</option>
          ))}
        </select>
      </div>
      <div className="ajuste">
        <div className="ajuste-titulo">{textosDeLaInterfaz.hormigueros}</div>
        <p className="ajuste-ayuda">{textosDeLaInterfaz.hormiguerosAyuda}</p>
        <div className="ajuste-hormigueros">
          {ajustes.hormigueros.map((carpetaDelHormiguero) => {
            const estaAbierto = carpetaDelHormiguero === ajustes.hormiguero_abierto;
            return (
              <div key={carpetaDelHormiguero} className={`ajuste-hormiguero${estaAbierto ? " actual" : ""}`}>
                <div className="ajuste-hormiguero-nombre">
                  <b>{nombreDelArchivo(carpetaDelHormiguero)}</b>
                  <code title={carpetaDelHormiguero}>{marcarComoTextoDeIzquierdaADerecha(carpetaDelHormiguero)}</code>
                </div>
                {estaAbierto ? (
                  <span className="ajuste-hormiguero-abierto">{textosDeLaInterfaz.abierto}</span>
                ) : (
                  <button onClick={() => cambiarAjustes({ hormiguero_abierto: carpetaDelHormiguero })}>{textosDeLaInterfaz.abrir}</button>
                )}
                <button
                  title={textosDeLaInterfaz.quitarHormigueroAyuda}
                  onClick={() => cambiarAjustes(cambiosParaQuitarHormigueroDeLaLista(ajustes, carpetaDelHormiguero))}
                >
                  {textosDeLaInterfaz.quitar}
                </button>
              </div>
            );
          })}
        </div>
        <button className="ajuste-boton" onClick={alPedirHormigueroNuevo}>{textosDeLaInterfaz.nuevoHormigueroBoton}</button>
      </div>
    </>
  );
}

/**
 * Área «Editor»: arriba de todo, el interruptor del modo escritor; con el modo activo aparecen
 * debajo sus opciones (tipografía al escribir y página). Con el modo apagado, por ahora, nada más.
 */
function PanelEditor({ ajustes, cambiarAjustes }: PropsDeUnPanel) {
  const textosDeLaInterfaz = useTextos();
  const opcionesDelModoEscritor = ajustes.opciones_del_modo_escritor;
  /** Cambia algunas opciones del modo escritor. */
  const cambiarOpcionesDelModoEscritor = (cambios: Partial<OpcionesDelModoEscritor>) =>
    cambiarAjustes({ opciones_del_modo_escritor: { ...opcionesDelModoEscritor, ...cambios } });
  /** Si se usarán comillas latinas, para mostrar el ejemplo según el estilo elegido y el idioma de la app. */
  const seUsanComillasLatinas =
    opcionesDelModoEscritor.estilo_de_comillas === "latinas" ||
    (opcionesDelModoEscritor.estilo_de_comillas === "auto" && idiomaValido(ajustes.idioma) === "es");

  /** Fila con casilla, nombre y, a la derecha, el ejemplo de lo que se teclea → lo que queda. */
  const filaDeReemplazo = (opcion: keyof OpcionesDelModoEscritor, nombreVisible: string, loQueSeTeclea: string, loQueQueda: string) => (
    <label className="ajuste-casilla ajuste-reemplazo">
      <input
        type="checkbox"
        checked={opcionesDelModoEscritor[opcion] as boolean}
        onChange={(evento) => cambiarOpcionesDelModoEscritor({ [opcion]: evento.target.checked })}
      />
      <span>{nombreVisible}</span>
      <code>{loQueSeTeclea} → {loQueQueda}</code>
    </label>
  );

  return (
    <>
      <h1>{textosDeLaInterfaz.areas.editor}</h1>
      {/* El modo escritor no es un ajuste más: va destacado, con un interruptor. */}
      <label className={`ajuste-modo${ajustes.modo_escritor ? " activo" : ""}`}>
        <div>
          <div className="ajuste-modo-titulo">{textosDeLaInterfaz.modoEscritor}</div>
          <p className="ajuste-ayuda">{textosDeLaInterfaz.modoEscritorAyuda}</p>
        </div>
        <input
          type="checkbox"
          className="interruptor"
          role="switch"
          checked={ajustes.modo_escritor}
          onChange={(evento) => cambiarAjustes({ modo_escritor: evento.target.checked })}
        />
      </label>

      {ajustes.modo_escritor && (
        <>
          <div className="ajuste">
            <div className="ajuste-titulo">{textosDeLaInterfaz.tipografia}</div>
            <p className="ajuste-ayuda">{textosDeLaInterfaz.tipografiaAyuda}</p>
            <div className="ajuste-lista">
              <div className="ajuste-con-opcion">
                {filaDeReemplazo("comillas_tipograficas", textosDeLaInterfaz.comillas, '"hola"', seUsanComillasLatinas ? "«hola»" : "“hola”")}
                {opcionesDelModoEscritor.comillas_tipograficas && (
                  <select
                    className="ajuste-select"
                    value={opcionesDelModoEscritor.estilo_de_comillas}
                    onChange={(evento) =>
                      cambiarOpcionesDelModoEscritor({ estilo_de_comillas: evento.target.value as OpcionesDelModoEscritor["estilo_de_comillas"] })
                    }
                  >
                    {(["auto", "curvas", "latinas"] as const).map((estiloDeComillas) => (
                      <option key={estiloDeComillas} value={estiloDeComillas}>{textosDeLaInterfaz.estiloComillas[estiloDeComillas]}</option>
                    ))}
                  </select>
                )}
              </div>
              {filaDeReemplazo("rayas_de_dialogo", textosDeLaInterfaz.rayas, "--", "—")}
              {filaDeReemplazo("puntos_suspensivos", textosDeLaInterfaz.puntos, "...", "…")}
              {filaDeReemplazo("comillas_angulares", textosDeLaInterfaz.angulares, "<< >>", "« »")}
              {filaDeReemplazo("flechas", textosDeLaInterfaz.flechas, "-> <-", "→ ←")}
            </div>
          </div>
          <div className="ajuste">
            <div className="ajuste-titulo">{textosDeLaInterfaz.pagina}</div>
            <div className="ajuste-lista">
              <label className="ajuste-casilla ajuste-casilla-ayuda">
                <input
                  type="checkbox"
                  checked={opcionesDelModoEscritor.letra_de_libro}
                  onChange={(evento) => cambiarOpcionesDelModoEscritor({ letra_de_libro: evento.target.checked })}
                />
                <span>{textosDeLaInterfaz.letraLibro}<small>{textosDeLaInterfaz.letraLibroAyuda}</small></span>
              </label>
              <label className="ajuste-casilla ajuste-casilla-ayuda">
                <input
                  type="checkbox"
                  checked={opcionesDelModoEscritor.corrector_ortografico}
                  onChange={(evento) => cambiarOpcionesDelModoEscritor({ corrector_ortografico: evento.target.checked })}
                />
                <span>{textosDeLaInterfaz.corrector}<small>{textosDeLaInterfaz.correctorAyuda}</small></span>
              </label>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/** Área «Diario»: activa el calendario de la barra lateral y las notas diarias en `Daily/`. */
function PanelDiario({ ajustes, cambiarAjustes }: PropsDeUnPanel) {
  const textosDeLaInterfaz = useTextos();
  return (
    <>
      <h1>{textosDeLaInterfaz.areas.diario}</h1>
      <div className="ajuste">
        <label className="ajuste-casilla">
          <input
            type="checkbox"
            checked={ajustes.modo_diario}
            onChange={(evento) => cambiarAjustes({ modo_diario: evento.target.checked })}
          />
          <span className="ajuste-titulo">{textosDeLaInterfaz.activarDiario}</span>
        </label>
        <p className="ajuste-ayuda">
          {textosDeLaInterfaz.diarioAyuda(
            <code>{NOMBRE_DE_LA_CARPETA_DEL_DIARIO}/2026-11-20.md</code>,
            <code>{NOMBRE_DE_LA_CARPETA_DEL_DIARIO}</code>,
          )}
        </p>
        {ajustes.modo_diario && !ajustes.hormiguero_abierto && <p className="ajuste-aviso">{textosDeLaInterfaz.diarioAviso}</p>}
      </div>
    </>
  );
}

/**
 * Área «Apariencia»: temas listos y cada color por separado. Los colores se guardan en
 * `Ajustes.colores_elegidos` y `main.tsx` los aplica al instante.
 */
function PanelApariencia({ ajustes, cambiarAjustes }: PropsDeUnPanel) {
  const textosDeLaInterfaz = useTextos();
  /** Color que se ve ahora para una variable: el elegido por el usuario o el de por defecto. */
  const colorQueSeVe = (nombreDeLaVariable: string) =>
    ajustes.colores_elegidos[nombreDeLaVariable] ?? COLORES_POR_DEFECTO[nombreDeLaVariable];
  /** El tema elegido es el que coincide en todos sus colores con los que se ven (o ninguno, si se retocó). */
  const temaQueCoincide = TEMAS.find((tema) =>
    VARIABLES_DE_COLOR.every((nombreDeLaVariable) => tema.colores[nombreDeLaVariable] === colorQueSeVe(nombreDeLaVariable)),
  )?.id;

  return (
    <>
      <h1>{textosDeLaInterfaz.areas.apariencia}</h1>
      <div className="ajuste">
        <div className="ajuste-titulo">{textosDeLaInterfaz.tema}</div>
        <p className="ajuste-ayuda">{textosDeLaInterfaz.temaAyuda}</p>
        <div className="ajuste-temas">
          {TEMAS.map((tema, posicion) => (
            <button
              key={tema.id}
              className={`ajuste-tema${tema.id === temaQueCoincide ? " elegido" : ""}`}
              style={{ background: tema.colores.fondo, color: tema.colores.texto }}
              // El primer tema es el de `App.css`: elegirlo deja los colores sin cambios guardados.
              onClick={() => cambiarAjustes({ colores_elegidos: posicion === 0 ? {} : { ...tema.colores } })}
            >
              <span className="ajuste-tema-punto" style={{ background: tema.colores.acento }} />
              {textosDeLaInterfaz.nombresTemas[tema.id]}
            </button>
          ))}
        </div>
      </div>
      <div className="ajuste">
        <div className="ajuste-titulo">{textosDeLaInterfaz.colores}</div>
        <div className="ajuste-colores">
          {VARIABLES_DE_COLOR.map((nombreDeLaVariable) => (
            <label key={nombreDeLaVariable} className="ajuste-color">
              <input
                type="color"
                value={colorQueSeVe(nombreDeLaVariable)}
                onChange={(evento) =>
                  cambiarAjustes({ colores_elegidos: { ...ajustes.colores_elegidos, [nombreDeLaVariable]: evento.target.value } })
                }
              />
              <span>{textosDeLaInterfaz.nombresColores[nombreDeLaVariable]}</span>
              <code>{colorQueSeVe(nombreDeLaVariable)}</code>
            </label>
          ))}
        </div>
        <button className="ajuste-boton" onClick={() => cambiarAjustes({ colores_elegidos: {} })}>{textosDeLaInterfaz.restablecerColores}</button>
      </div>
    </>
  );
}

interface Props {
  ajustes: Ajustes;
  /** Aplica y guarda un cambio al instante (no hay botón «Aceptar», como en macOS). */
  cambiarAjustes(cambios: Partial<Ajustes>): void;
  /** Abre la ventanita «Hormiguero nuevo» encima de los Ajustes. */
  alPedirHormigueroNuevo(): void;
  alCerrar(): void;
}

export function ModalAjustes({ ajustes, cambiarAjustes, alPedirHormigueroNuevo, alCerrar }: Props) {
  const textosDeLaInterfaz = useTextos();
  const [areaElegida, setAreaElegida] = useState<AreaDeAjustes>("general");

  // Escape y Cmd+W cierran los Ajustes (Cmd+W no cierra la ventana principal). Si hay una
  // ventanita encima (hormiguero nuevo), Escape la cierra a ella primero.
  useEffect(() => {
    const alPresionarTecla = (evento: KeyboardEvent) => {
      const hayOtraVentanitaEncima = document.querySelector(".modal-encima");
      const esEscape = evento.key === "Escape" && !hayOtraVentanitaEncima;
      const esCmdW = evento.metaKey && evento.key.toLowerCase() === "w";
      if (esEscape || esCmdW) {
        evento.preventDefault();
        alCerrar();
      }
    };
    window.addEventListener("keydown", alPresionarTecla);
    return () => window.removeEventListener("keydown", alPresionarTecla);
  }, [alCerrar]);

  return (
    <div className="modal-fondo" onMouseDown={(evento) => evento.target === evento.currentTarget && alCerrar()}>
      <div className="modal ajustes" role="dialog" aria-label={textosDeLaInterfaz.ajustes}>
        <nav className="ajustes-areas">
          {AREAS_DE_AJUSTES.map((area) => (
            <div key={area} className={`ajustes-area${area === areaElegida ? " activa" : ""}`} onClick={() => setAreaElegida(area)}>
              {textosDeLaInterfaz.areas[area]}
            </div>
          ))}
        </nav>
        <section className="ajustes-panel">
          <button className="modal-cerrar" aria-label={textosDeLaInterfaz.cerrar} onClick={alCerrar}>×</button>
          {areaElegida === "general" && (
            <PanelGeneral ajustes={ajustes} cambiarAjustes={cambiarAjustes} alPedirHormigueroNuevo={alPedirHormigueroNuevo} />
          )}
          {areaElegida === "editor" && <PanelEditor ajustes={ajustes} cambiarAjustes={cambiarAjustes} />}
          {areaElegida === "diario" && <PanelDiario ajustes={ajustes} cambiarAjustes={cambiarAjustes} />}
          {areaElegida === "apariencia" && <PanelApariencia ajustes={ajustes} cambiarAjustes={cambiarAjustes} />}
        </section>
      </div>
    </div>
  );
}
