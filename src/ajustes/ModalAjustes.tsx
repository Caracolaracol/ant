// Ajustes (Ant → Settings… / Ajustes… o Cmd+,): una ventanita sobre la ventana principal, no una
// ventana aparte. Está dividida en dos: a la izquierda la lista de áreas de ajustes y a la
// derecha las opciones del área elegida:
//   General (idioma, hormiguero y cámaras) · Editor (opciones de la cámara abierta, con presets
//   escritor, programador y simple) · Diario (calendario y notas
//   diarias) · Apariencia (colores) · Atajos (teclas de cada acción, en `PanelAtajos.tsx`).
// Los cambios se aplican y guardan al instante (`cambiarAjustes`, de App); se cierra con Escape,
// Cmd+W, la × o un clic fuera. Los textos salen de `idioma.tsx`, así cambia de idioma apenas se
// elige otro. Para agregar un área nueva: sumarla a `AREAS_DE_AJUSTES` (y su nombre a `areas` en
// `idioma.tsx`), crear su panel y mostrarlo en `ModalAjustes`.

import { useEffect, useState } from "react";
import { Ajustes, OpcionesDelEditor, PRESETS_DEL_EDITOR, PresetDelEditor, presetQueCoincide } from "../ajustes";
import { COLORES_POR_DEFECTO, TEMAS, VARIABLES_DE_COLOR } from "../colores";
import { NOMBRE_DE_LA_CARPETA_DEL_DIARIO } from "../diario";
import { elegirCarpetaConElDialogo, esLaEntrada, nombreVisibleDeLaCamara } from "../hormigueros/hormigueros";
import { RenombrarCamara } from "../hormigueros/RenombrarCamara";
import { IDIOMAS, Idioma, idiomaValido, useTextos } from "../idioma";
import { nombreDelArchivo } from "../archivosDeNotas";
import { marcarComoTextoDeIzquierdaADerecha } from "../arbolDeCarpetas";
import { PanelAtajos } from "./PanelAtajos";
import { Icono } from "../Icono";
import "./ModalAjustes.css";

/** Presets del editor, en el orden en que se ofrecen (sus nombres y ayudas en `idioma.tsx`). */
const PRESETS: PresetDelEditor[] = ["escritor", "programador", "simple"];

/** Anchos máximos de la columna del texto que ofrece el selector, en píxeles. */
const ANCHOS_DEL_TEXTO_EN_PIXELES = [480, 640, 800, 1000, 1200];

/** Áreas de ajustes que aparecen en la columna izquierda (sus nombres están en `idioma.tsx`). */
const AREAS_DE_AJUSTES = ["general", "editor", "diario", "apariencia", "atajos"] as const;
type AreaDeAjustes = (typeof AREAS_DE_AJUSTES)[number];

interface PropsDeUnPanel {
  ajustes: Ajustes;
  cambiarAjustes(cambios: Partial<Ajustes>): void;
}

/** Casilla nativa para el teclado y los lectores de pantalla; la antena solo dibuja su marca. */
function CasillaDeAjustes({ estaMarcada, alCambiar }: { estaMarcada: boolean; alCambiar(estaMarcada: boolean): void }) {
  return (
    <span className="ajuste-marca-de-casilla">
      <input type="checkbox" checked={estaMarcada} onChange={(evento) => alCambiar(evento.target.checked)} />
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M6.5 16.5 9 9l5.5-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="15" cy="5.7" r="1.7" fill="currentColor" />
      </svg>
    </span>
  );
}

/**
 * Área «General»: idioma de la interfaz, el hormiguero (se puede cambiar por otra carpeta) y sus
 * cámaras, con la abierta marcada y las cifradas con candado. Desde aquí se abre otra cámara, se
 * cava una nueva y se cifra una (o se le quita el cifrado). Al cambiar
 * de hormiguero, la bienvenida pide elegir una de sus cámaras.
 */
function PanelGeneral({
  ajustes,
  cambiarAjustes,
  camarasDelHormiguero,
  alPedirCamaraNueva,
  camarasCifradas,
  alPedirCifrado,
  alAbrirCamara,
  alElegirHormiguero,
  alRenombrarCamara,
}: PropsDeUnPanel & Pick<Props, "camarasDelHormiguero" | "alPedirCamaraNueva" | "camarasCifradas" | "alPedirCifrado" | "alAbrirCamara" | "alElegirHormiguero" | "alRenombrarCamara">) {
  const textosDeLaInterfaz = useTextos();
  const carpetaDelHormiguero = ajustes.hormiguero;
  const [nombreDeLaCamaraARenombrar, setNombreDeLaCamaraARenombrar] = useState<string | null>(null);

  /** Elige otra carpeta como hormiguero con el diálogo del sistema. */
  const cambiarDeHormiguero = () =>
    elegirCarpetaConElDialogo(carpetaDelHormiguero).then(
      (carpetaElegida) => carpetaElegida && carpetaElegida !== carpetaDelHormiguero && alElegirHormiguero(carpetaElegida),
      () => {},
    );

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
      {carpetaDelHormiguero && (
        <div className="ajuste">
          <div className="ajuste-titulo">{textosDeLaInterfaz.hormiguero}</div>
          <p className="ajuste-ayuda">{textosDeLaInterfaz.hormigueroAyuda}</p>
          <div className="ajuste-camara">
            <div className="ajuste-camara-nombre">
              <b>{nombreDelArchivo(carpetaDelHormiguero)}</b>
              <code title={carpetaDelHormiguero}>{marcarComoTextoDeIzquierdaADerecha(carpetaDelHormiguero)}</code>
            </div>
            <button onClick={cambiarDeHormiguero}>{textosDeLaInterfaz.cambiar}</button>
          </div>
        </div>
      )}
      {carpetaDelHormiguero && (
        <div className="ajuste">
          <div className="ajuste-titulo">{textosDeLaInterfaz.camaras}</div>
          <p className="ajuste-ayuda">{textosDeLaInterfaz.camarasAyuda}</p>
          <div className="ajuste-camaras">
            {camarasDelHormiguero.length === 0 && <p className="ajuste-ayuda">{textosDeLaInterfaz.sinCamaras}</p>}
            {camarasDelHormiguero.map((nombreDeLaCamara) => {
              const estaAbierta = nombreDeLaCamara === ajustes.camara_abierta;
              const estaCifrada = camarasCifradas.includes(nombreDeLaCamara);
              return (
                <div key={nombreDeLaCamara} className={`ajuste-camara${estaAbierta ? " actual" : ""}`}>
                  <div className="ajuste-camara-nombre">
                    <b>{nombreVisibleDeLaCamara(nombreDeLaCamara, textosDeLaInterfaz.entrada)}</b>
                    {esLaEntrada(nombreDeLaCamara) && <span className="ajuste-camara-detalle">{textosDeLaInterfaz.entradaAyuda}</span>}
                    {estaCifrada && (
                      <span className="ajuste-camara-detalle ajuste-camara-cifrada">
                        <Icono nombreDelIcono="lock" tamanoEnPixeles={11} /> {textosDeLaInterfaz.cifrada}
                      </span>
                    )}
                  </div>
                  {/* La Entrada no tiene carpeta propia: no se cambia su nombre ni se cifra. */}
                  {!esLaEntrada(nombreDeLaCamara) && (
                    <button
                      className="ajuste-camara-secundario ajuste-camara-renombrar"
                      title={textosDeLaInterfaz.renombrarCamaraTitulo(nombreDeLaCamara)}
                      aria-label={textosDeLaInterfaz.renombrarCamaraTitulo(nombreDeLaCamara)}
                      onClick={() => setNombreDeLaCamaraARenombrar(nombreDeLaCamara)}
                    >
                      <Icono nombreDelIcono="pencil" tamanoEnPixeles={14} />
                    </button>
                  )}
                  {!esLaEntrada(nombreDeLaCamara) && (
                    <button
                      className="ajuste-camara-secundario"
                      onClick={() => alPedirCifrado(estaCifrada ? "quitar_cifrado" : "cifrar", nombreDeLaCamara)}
                    >
                      {estaCifrada ? textosDeLaInterfaz.quitarCifradoBoton : textosDeLaInterfaz.cifrarCamaraBoton}
                    </button>
                  )}
                  {estaAbierta ? (
                    <span className="ajuste-camara-abierta">{textosDeLaInterfaz.abierta}</span>
                  ) : (
                    <button onClick={() => alAbrirCamara(nombreDeLaCamara)}>{textosDeLaInterfaz.abrir}</button>
                  )}
                </div>
              );
            })}
          </div>
          <button className="ajuste-boton" onClick={alPedirCamaraNueva}>{textosDeLaInterfaz.camaraNuevaBoton}</button>
        </div>
      )}
      {nombreDeLaCamaraARenombrar !== null && (
        <RenombrarCamara
          nombreAnterior={nombreDeLaCamaraARenombrar}
          alRenombrar={(nombreNuevo) => alRenombrarCamara(nombreDeLaCamaraARenombrar, nombreNuevo)}
          alCerrar={() => setNombreDeLaCamaraARenombrar(null)}
        />
      )}
    </>
  );
}

/**
 * Área «Editor»: las opciones del editor de la cámara abierta (cada cámara tiene las suyas, en sus
 * datos de `.ant/`). Arriba, tres presets rápidos (Escritor, Programador, Simple) que marcan las
 * opciones de una vez; el que coincide con lo marcado se ve elegido. Abajo, cada opción por
 * separado, en tres grupos: tipografía al escribir, página y código. Se pueden mezclar: una cámara
 * puede tener la tipografía del escritor y las ayudas para código a la vez. El ancho de la página
 * es una preferencia local de la app y no cambia al elegir un preset ni al cambiar de cámara.
 */
function PanelEditor({
  ajustes,
  cambiarAjustes,
  nombreDeLaCamaraAbierta,
  opcionesDelEditor,
  cambiarOpcionesDelEditor,
}: PropsDeUnPanel & Pick<Props, "nombreDeLaCamaraAbierta" | "opcionesDelEditor" | "cambiarOpcionesDelEditor">) {
  const textosDeLaInterfaz = useTextos();
  const presetElegido = presetQueCoincide(opcionesDelEditor);
  /** Si se usarán comillas latinas, para mostrar el ejemplo según el estilo elegido y el idioma de la app. */
  const seUsanComillasLatinas =
    opcionesDelEditor.estilo_de_comillas === "latinas" ||
    (opcionesDelEditor.estilo_de_comillas === "auto" && idiomaValido(ajustes.idioma) === "es");

  /** Casilla de una opción, con su nombre y, a la derecha, un ejemplo (lo que se teclea → lo que queda). */
  const filaDeReemplazo = (opcion: keyof OpcionesDelEditor, nombreVisible: string, loQueSeTeclea: string, loQueQueda: string) => (
    <label className="ajuste-casilla ajuste-reemplazo">
      <CasillaDeAjustes
        estaMarcada={opcionesDelEditor[opcion] as boolean}
        alCambiar={(estaMarcada) => cambiarOpcionesDelEditor({ [opcion]: estaMarcada })}
      />
      <span>{nombreVisible}</span>
      <code>{loQueSeTeclea} → {loQueQueda}</code>
    </label>
  );

  /** Casilla de una opción con su nombre y una línea de ayuda debajo. */
  const filaConAyuda = (opcion: keyof OpcionesDelEditor, nombreVisible: string, ayuda: string) => (
    <label className="ajuste-casilla ajuste-casilla-ayuda">
      <CasillaDeAjustes
        estaMarcada={opcionesDelEditor[opcion] as boolean}
        alCambiar={(estaMarcada) => cambiarOpcionesDelEditor({ [opcion]: estaMarcada })}
      />
      <span>{nombreVisible}<small>{ayuda}</small></span>
    </label>
  );

  return (
    <>
      <h1>{textosDeLaInterfaz.areas.editor}</h1>
      {nombreDeLaCamaraAbierta && <p className="ajuste-ayuda">{textosDeLaInterfaz.editorDeLaCamara(nombreDeLaCamaraAbierta)}</p>}

      <div className="ajuste">
        <div className="ajuste-titulo">{textosDeLaInterfaz.presetsDelEditor}</div>
        <p className="ajuste-ayuda">{textosDeLaInterfaz.presetsDelEditorAyuda}</p>
        <div className="ajuste-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              className={`ajuste-preset${preset === presetElegido ? " elegido" : ""}`}
              // El estilo de comillas elegido se conserva: el preset no lo cambia.
              onClick={() => cambiarOpcionesDelEditor({ ...PRESETS_DEL_EDITOR[preset], estilo_de_comillas: opcionesDelEditor.estilo_de_comillas })}
            >
              <span className="ajuste-preset-titulo">{textosDeLaInterfaz.presets[preset].titulo}</span>
              <span className="ajuste-preset-ayuda">{textosDeLaInterfaz.presets[preset].ayuda}</span>
            </button>
          ))}
        </div>
        {!presetElegido && <p className="ajuste-ayuda ajuste-personalizado">{textosDeLaInterfaz.opcionesPersonalizadas}</p>}
      </div>

      <div className="ajuste">
        <div className="ajuste-titulo">{textosDeLaInterfaz.tipografia}</div>
        <p className="ajuste-ayuda">{textosDeLaInterfaz.tipografiaAyuda}</p>
        <div className="ajuste-lista">
          <div className="ajuste-con-opcion">
            {filaDeReemplazo("comillas_tipograficas", textosDeLaInterfaz.comillas, '"hola"', seUsanComillasLatinas ? "«hola»" : "“hola”")}
            {opcionesDelEditor.comillas_tipograficas && (
              <select
                className="ajuste-select"
                value={opcionesDelEditor.estilo_de_comillas}
                onChange={(evento) => cambiarOpcionesDelEditor({ estilo_de_comillas: evento.target.value as OpcionesDelEditor["estilo_de_comillas"] })}
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
          {filaConAyuda("letra_de_libro", textosDeLaInterfaz.letraLibro, textosDeLaInterfaz.letraLibroAyuda)}
          {filaConAyuda("corrector_ortografico", textosDeLaInterfaz.corrector, textosDeLaInterfaz.correctorAyuda)}
          <div className="ajuste-ancho-del-texto">
            <label htmlFor="ancho-del-texto">{textosDeLaInterfaz.anchoDelTexto}</label>
            <p className="ajuste-ayuda" id="ayuda-del-ancho-del-texto">{textosDeLaInterfaz.anchoDelTextoAyuda}</p>
            <select
              id="ancho-del-texto"
              className="ajuste-select"
              aria-describedby="ayuda-del-ancho-del-texto"
              value={ajustes.ancho_del_texto ?? ""}
              onChange={(evento) => cambiarAjustes({ ancho_del_texto: evento.target.value === "" ? null : Number(evento.target.value) })}
            >
              <option value="">{textosDeLaInterfaz.anchoDelTextoAutomatico}</option>
              {ANCHOS_DEL_TEXTO_EN_PIXELES.map((anchoEnPixeles) => (
                <option key={anchoEnPixeles} value={anchoEnPixeles}>{anchoEnPixeles} px</option>
              ))}
              <option value={0}>{textosDeLaInterfaz.anchoDelTextoCompleto}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cada elemento del Markdown con su casilla y su ejemplo: lo que se escribe → cómo se ve. */}
      <div className="ajuste">
        <div className="ajuste-titulo">{textosDeLaInterfaz.vistaDelMarkdown}</div>
        <p className="ajuste-ayuda">{textosDeLaInterfaz.vistaDelMarkdownAyuda}</p>
        <div className="ajuste-lista">
          {filaDeReemplazo("titulos_sin_almohadillas", textosDeLaInterfaz.titulosSinAlmohadillas, `## ${textosDeLaInterfaz.ejemploTitulo}`, textosDeLaInterfaz.ejemploTitulo)}
          {filaDeReemplazo("enfasis_sin_marcas", textosDeLaInterfaz.enfasisSinMarcas, `**${textosDeLaInterfaz.ejemploNegrita}**`, textosDeLaInterfaz.ejemploNegrita)}
          {filaDeReemplazo("codigo_en_linea_sin_marcas", textosDeLaInterfaz.codigoEnLineaSinMarcas, `\`${textosDeLaInterfaz.ejemploCodigo}\``, textosDeLaInterfaz.ejemploCodigo)}
          {filaDeReemplazo("enlaces_solo_texto", textosDeLaInterfaz.enlacesSoloTexto, "[Ant](https://…)", "Ant")}
          {filaDeReemplazo("citas_con_linea", textosDeLaInterfaz.citasConLinea, `> ${textosDeLaInterfaz.ejemploCita}`, `▏${textosDeLaInterfaz.ejemploCita}`)}
          {filaDeReemplazo("vinetas_en_listas", textosDeLaInterfaz.vinetasEnListas, `- ${textosDeLaInterfaz.ejemploPunto}`, `• ${textosDeLaInterfaz.ejemploPunto}`)}
          {filaDeReemplazo("casillas_en_tareas", textosDeLaInterfaz.casillasEnTareas, `- [ ] ${textosDeLaInterfaz.ejemploTarea}`, `☐ ${textosDeLaInterfaz.ejemploTarea}`)}
          {filaDeReemplazo("separadores_como_linea", textosDeLaInterfaz.separadoresComoLinea, "---", "────")}
          {filaConAyuda("mostrar_imagenes", textosDeLaInterfaz.mostrarImagenes, textosDeLaInterfaz.mostrarImagenesAyuda)}
        </div>
      </div>

      <div className="ajuste">
        <div className="ajuste-titulo">{textosDeLaInterfaz.codigo}</div>
        <div className="ajuste-lista">
          {filaConAyuda("cerrar_bloques_de_codigo", textosDeLaInterfaz.cerrarBloques, textosDeLaInterfaz.cerrarBloquesAyuda)}
          {filaConAyuda("cerrar_parentesis", textosDeLaInterfaz.cerrarParentesis, textosDeLaInterfaz.cerrarParentesisAyuda)}
          {filaConAyuda("marcar_el_par", textosDeLaInterfaz.marcarElPar, textosDeLaInterfaz.marcarElParAyuda)}
          {filaConAyuda("fondo_en_bloques_de_codigo", textosDeLaInterfaz.fondoEnBloques, textosDeLaInterfaz.fondoEnBloquesAyuda)}
        </div>
      </div>
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
          <CasillaDeAjustes estaMarcada={ajustes.modo_diario} alCambiar={(estaMarcada) => cambiarAjustes({ modo_diario: estaMarcada })} />
          <span className="ajuste-titulo">{textosDeLaInterfaz.activarDiario}</span>
        </label>
        <p className="ajuste-ayuda">
          {textosDeLaInterfaz.diarioAyuda(
            <code>{NOMBRE_DE_LA_CARPETA_DEL_DIARIO}/2026-11-20.md</code>,
            <code>{NOMBRE_DE_LA_CARPETA_DEL_DIARIO}</code>,
          )}
        </p>
        {ajustes.modo_diario && !ajustes.camara_abierta && <p className="ajuste-aviso">{textosDeLaInterfaz.diarioAviso}</p>}
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
  /** Cámaras del hormiguero, para la lista del área General. */
  camarasDelHormiguero: string[];
  alAbrirCamara(nombreDeLaCamara: string): void;
  alElegirHormiguero(carpetaDelHormiguero: string): void;
  alRenombrarCamara(nombreAnterior: string, nombreNuevo: string): Promise<void>;
  /** Abre la ventanita «Cámara nueva» encima de los Ajustes. */
  alPedirCamaraNueva(): void;
  /** Cámaras cifradas, para marcarlas y ofrecer quitarles el cifrado. */
  camarasCifradas: string[];
  /** Nombre visible de la cámara abierta: el área Editor configura la suya. */
  nombreDeLaCamaraAbierta: string | null;
  /** Opciones del editor de la cámara abierta, y cómo cambiarlas (se guardan en sus datos de `.ant/`). */
  opcionesDelEditor: OpcionesDelEditor;
  cambiarOpcionesDelEditor(cambios: Partial<OpcionesDelEditor>): void;
  /** Abre la ventanita para cifrar una cámara o quitarle el cifrado. */
  alPedirCifrado(queSeHace: "cifrar" | "quitar_cifrado", nombreDeLaCamara: string): void;
  alCerrar(): void;
  /** Área que se muestra al abrir (por defecto, General); la usa la página de prueba. */
  areaInicial?: string;
}

export function ModalAjustes({
  ajustes,
  cambiarAjustes,
  camarasDelHormiguero,
  alAbrirCamara,
  alElegirHormiguero,
  alRenombrarCamara,
  alPedirCamaraNueva,
  camarasCifradas,
  alPedirCifrado,
  nombreDeLaCamaraAbierta,
  opcionesDelEditor,
  cambiarOpcionesDelEditor,
  alCerrar,
  areaInicial,
}: Props) {
  const textosDeLaInterfaz = useTextos();
  const [areaElegida, setAreaElegida] = useState<AreaDeAjustes>(() =>
    AREAS_DE_AJUSTES.find((area) => area === areaInicial) ?? "general",
  );

  // Escape y Cmd+W cierran los Ajustes (Cmd+W no cierra la ventana principal). Si hay una
  // ventanita encima (cámara nueva), Escape la cierra a ella primero.
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
    <div className="modal-fondo ajustes-fondo" onMouseDown={(evento) => evento.target === evento.currentTarget && alCerrar()}>
      <div className="modal ajustes" role="dialog" aria-label={textosDeLaInterfaz.ajustes}>
        {/* Cabecera de la ventanita, a todo el ancho: el título y la × para cerrar, fuera de lo
            que se está configurando (y fijas, sin desplazarse con las opciones). */}
        <header className="ajustes-cabecera">
          <span>{textosDeLaInterfaz.ajustes}</span>
          <button className="ajustes-cerrar" aria-label={textosDeLaInterfaz.cerrar} onClick={alCerrar}>×</button>
        </header>
        <div className="ajustes-cuerpo">
        <nav className="ajustes-areas">
          {AREAS_DE_AJUSTES.map((area) => (
            <div key={area} className={`ajustes-area${area === areaElegida ? " activa" : ""}`} onClick={() => setAreaElegida(area)}>
              {textosDeLaInterfaz.areas[area]}
            </div>
          ))}
        </nav>
        <section className="ajustes-panel">
          {areaElegida === "general" && (
            <PanelGeneral
              ajustes={ajustes}
              cambiarAjustes={cambiarAjustes}
              camarasDelHormiguero={camarasDelHormiguero}
              alAbrirCamara={alAbrirCamara}
              alElegirHormiguero={alElegirHormiguero}
              alRenombrarCamara={alRenombrarCamara}
              alPedirCamaraNueva={alPedirCamaraNueva}
              camarasCifradas={camarasCifradas}
              alPedirCifrado={alPedirCifrado}
            />
          )}
          {areaElegida === "editor" && (
            <PanelEditor
              ajustes={ajustes}
              cambiarAjustes={cambiarAjustes}
              nombreDeLaCamaraAbierta={nombreDeLaCamaraAbierta}
              opcionesDelEditor={opcionesDelEditor}
              cambiarOpcionesDelEditor={cambiarOpcionesDelEditor}
            />
          )}
          {areaElegida === "diario" && <PanelDiario ajustes={ajustes} cambiarAjustes={cambiarAjustes} />}
          {areaElegida === "apariencia" && <PanelApariencia ajustes={ajustes} cambiarAjustes={cambiarAjustes} />}
          {areaElegida === "atajos" && <PanelAtajos ajustes={ajustes} cambiarAjustes={cambiarAjustes} />}
        </section>
        </div>
      </div>
    </div>
  );
}
