// Ventana principal: la barra lateral, el editor y la barra de estado abajo, como en Left. Este
// archivo solo junta las piezas; cada una vive en su lugar:
//   · ajustes: `ajustes/useAjustesGuardados.ts`
//   · árbol del hormiguero abierto: `hormigueros/useArbolDelHormiguero.ts`
//   · notas abiertas, guardado automático y cambios hechos fuera de Ant: `notasAbiertas/useNotasAbiertas.ts`
//   · atajos de teclado: `useAtajosDeTeclado.ts`
//   · barra lateral: `barraLateral/` · barra de estado: `BarraDeEstado.tsx`
// Encima se abren, cuando toca: la bienvenida (sin hormigueros, o desde el menú), los Ajustes
// (Cmd+,), «Hormiguero nuevo» y «Compilar y exportar» (Cmd+Shift+E). Los ítems del menú los maneja
// Rust, que avisa con un evento (`EVENTOS_DE_RUST`) y aquí se abre lo que corresponda.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Editor, ControlDelEditor } from "./editor/Editor";
import { configEscritor } from "./editor/escritor";
import { BarraLateral } from "./barraLateral/BarraLateral";
import { ANCHO_DE_LA_BARRA_POR_DEFECTO } from "./barraLateral/useArrastreDelBorde";
import { BarraDeEstado } from "./BarraDeEstado";
import type { Ajustes } from "./ajustes";
import { ModalAjustes } from "./ajustes/ModalAjustes";
import { useAjustesGuardados } from "./ajustes/useAjustesGuardados";
import { Bienvenida } from "./bienvenida/Bienvenida";
import { Compilar } from "./compilar/Compilar";
import { conHormiguero } from "./hormigueros/hormigueros";
import { NuevoHormiguero } from "./hormigueros/NuevoHormiguero";
import { useArbolDelHormiguero } from "./hormigueros/useArbolDelHormiguero";
import { idiomaDe, useTextos } from "./idioma";
import { extraerMarcadores, marcadorActual } from "./marcadores";
import { nombreArchivo } from "./notas";
import { esperaQueLaGuarden } from "./notasAbiertas/notaAbierta";
import { useNotasAbiertas } from "./notasAbiertas/useNotasAbiertas";
import { useAtajosDeTeclado } from "./useAtajosDeTeclado";
import { EVENTOS_DE_RUST, useEventoDeRust } from "./useEventoDeRust";
import "./App.css";

function App({ ajustesIniciales }: { ajustesIniciales: Ajustes }) {
  const controlDelEditor = useRef<ControlDelEditor>(null);
  const textosDeLaInterfaz = useTextos();
  const [mensajeDeError, setMensajeDeError] = useState<string | null>(null);
  const [barraLateralVisible, setBarraLateralVisible] = useState(true);

  /** Muestra un error en la barra de estado. */
  const mostrarError = useCallback((error: unknown) => setMensajeDeError(String(error)), []);
  /** Corre una acción del usuario: si sale bien, borra el error anterior; si falla, lo muestra. */
  const ejecutarMostrandoErrores = useCallback(
    (accion: Promise<unknown>) => void accion.then(() => setMensajeDeError(null), mostrarError),
    [mostrarError],
  );

  const { ajustes, ajustesVigentes, cambiarAjustes } = useAjustesGuardados(ajustesIniciales, mostrarError);
  const carpetaDelHormiguero = ajustes.carpeta;
  const { arbolDelHormiguero, releerArbolDelHormiguero } = useArbolDelHormiguero(carpetaDelHormiguero, mostrarError);
  const notas = useNotasAbiertas({
    controlDelEditor,
    carpetaDelHormigueroAbierto: carpetaDelHormiguero,
    releerArbolDelHormiguero,
    mostrarError,
  });
  const { notaVisible } = notas;

  useAtajosDeTeclado(
    {
      abrirNotaEnBlanco: notas.abrirNotaEnBlanco,
      abrirNotaConElDialogo: notas.abrirNotaConElDialogo,
      guardarNotaVisible: notas.guardarNotaVisible,
      pasarANotaVecina: notas.pasarANotaVecina,
      mostrarUOcultarBarraLateral: () => setBarraLateralVisible((visible) => !visible),
    },
    () => setMensajeDeError(null),
    mostrarError,
  );

  // Lo que se abre encima del editor desde el menú: «Compilar y exportar», Ajustes, «Hormiguero
  // nuevo» y la bienvenida (que también aparece sola mientras no haya ningún hormiguero).
  const [compilarAbierto, setCompilarAbierto] = useState(false);
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [cavandoHormigueroNuevo, setCavandoHormigueroNuevo] = useState(false);
  const [bienvenidaPedida, setBienvenidaPedida] = useState(false);
  useEventoDeRust(EVENTOS_DE_RUST.abrirCompilar, useCallback(() => setCompilarAbierto(true), []));
  useEventoDeRust(EVENTOS_DE_RUST.abrirAjustes, useCallback(() => setAjustesAbiertos(true), []));
  useEventoDeRust(EVENTOS_DE_RUST.cavarHormigueroNuevo, useCallback(() => setCavandoHormigueroNuevo(true), []));
  useEventoDeRust(EVENTOS_DE_RUST.abrirBienvenida, useCallback(() => setBienvenidaPedida(true), []));
  const hayHormigueros = ajustes.hormigueros.length > 0;
  const bienvenidaVisible = bienvenidaPedida || !hayHormigueros;

  /** Abre un hormiguero (y lo suma a la lista si es nuevo); cierra lo que se abrió para cavarlo. */
  const abrirHormiguero = useCallback((carpetaDelHormigueroElegido: string) => {
    cambiarAjustes(conHormiguero(ajustesVigentes.current, carpetaDelHormigueroElegido));
    setCavandoHormigueroNuevo(false);
    setBienvenidaPedida(false);
  }, [cambiarAjustes, ajustesVigentes]);

  /** Fija una carpeta, nota o capítulo arriba de la barra lateral. */
  const fijar = useCallback((clave: string) => {
    const { fijados } = ajustesVigentes.current;
    if (!fijados.includes(clave)) cambiarAjustes({ fijados: [...fijados, clave] });
  }, [cambiarAjustes, ajustesVigentes]);

  /** Quita un fijado, y su icono si tenía uno elegido. */
  const quitarFijado = useCallback((clave: string) => {
    const { [clave]: _iconoQueSeQuita, ...iconosQueQuedan } = ajustesVigentes.current.iconos;
    cambiarAjustes({ fijados: ajustesVigentes.current.fijados.filter((claveFijada) => claveFijada !== clave), iconos: iconosQueQuedan });
  }, [cambiarAjustes, ajustesVigentes]);

  /** Cambia el icono de un fijado; `null` vuelve al de su tipo. */
  const cambiarIconoDeFijado = useCallback((clave: string, icono: string | null) => {
    const iconos = { ...ajustesVigentes.current.iconos };
    if (icono) iconos[clave] = icono;
    else delete iconos[clave];
    cambiarAjustes({ iconos });
  }, [cambiarAjustes, ajustesVigentes]);

  // Títulos de la nota visible y el título donde está el cursor. La posición del cursor va en una
  // ref y no en el estado: cambia en cada movimiento del mouse al seleccionar, y si cada cambio
  // volviera a dibujar la ventana, el scroll al seleccionar texto largo perdería cuadros. Solo se
  // vuelve a dibujar cuando el cursor pasa a otro título.
  const titulosDeLaNotaVisible = useMemo(() => extraerMarcadores(notaVisible.ultimoTextoConocido), [notaVisible.ultimoTextoConocido]);
  const titulosVigentes = useRef(titulosDeLaNotaVisible);
  titulosVigentes.current = titulosDeLaNotaVisible;
  const posicionDelCursor = useRef(0);
  const [, setIndiceDelTituloConElCursor] = useState(-1);
  const alMoverCursor = useCallback((posicion: number) => {
    posicionDelCursor.current = posicion;
    setIndiceDelTituloConElCursor(marcadorActual(titulosVigentes.current, posicion));
  }, []);

  // Modo escritor para el editor (o `null` si está apagado), con las comillas según el idioma.
  const configuracionModoEscritor = useMemo(
    () => (ajustes.escritor ? configEscritor(ajustes.opciones_escritor, idiomaDe(ajustes.idioma)) : null),
    [ajustes.escritor, ajustes.opciones_escritor, ajustes.idioma],
  );

  const nombreDeLaNotaVisible = notaVisible.rutaDelArchivo ? nombreArchivo(notaVisible.rutaDelArchivo) : textosDeLaInterfaz.sinTitulo;
  const notaVisibleEsperaQueLaGuarden = esperaQueLaGuarden(notaVisible);

  // El título de la ventana (visible en Mission Control y el Dock) muestra la nota y si está sin guardar.
  useEffect(() => {
    getCurrentWindow().setTitle(`${notaVisibleEsperaQueLaGuarden ? "• " : ""}${nombreDeLaNotaVisible}`).catch(() => {});
  }, [nombreDeLaNotaVisible, notaVisibleEsperaQueLaGuarden]);

  /** Devuelve el foco al editor al cerrar una ventanita. */
  const enfocarElEditor = () => controlDelEditor.current?.enfocar();

  return (
    <main className="app">
      {/* Franja superior que reemplaza la barra de título nativa (oculta en tauri.conf.json):
          deja espacio a los botones de la ventana y permite arrastrarla. */}
      <div className="arrastre" data-tauri-drag-region />
      <div className="cuerpo">
        {barraLateralVisible && (
          <BarraLateral
            carpetaDelHormiguero={carpetaDelHormiguero}
            arbolDelHormiguero={arbolDelHormiguero}
            clavesDeFijados={ajustes.fijados}
            iconosElegidosPorFijado={ajustes.iconos}
            modoDiarioActivo={ajustes.diario}
            notasAbiertas={notas.notasAbiertas}
            idNotaVisible={notaVisible.id}
            titulosDeLaNotaVisible={titulosDeLaNotaVisible}
            indiceDelTituloConElCursor={marcadorActual(titulosDeLaNotaVisible, posicionDelCursor.current)}
            anchoEnPixeles={ajustes.ancho_barra ?? ANCHO_DE_LA_BARRA_POR_DEFECTO}
            alCambiarAncho={(anchoEnPixeles) => cambiarAjustes({ ancho_barra: anchoEnPixeles })}
            alMostrarNotaAbierta={notas.mostrarNotaAbierta}
            alAbrirNotaDeArchivo={(rutaDelArchivo) => ejecutarMostrandoErrores(notas.abrirNotaDeArchivo(rutaDelArchivo))}
            alAbrirCapitulo={(rutaDeLaNota, titulo) => ejecutarMostrandoErrores(notas.abrirCapitulo(rutaDeLaNota, titulo))}
            alAbrirNotaDelDia={(diaElegido) => ejecutarMostrandoErrores(notas.abrirNotaDelDia(diaElegido))}
            alCerrarNota={(idNota) => ejecutarMostrandoErrores(notas.cerrarNota(idNota))}
            alSaltarATitulo={(posicionDelTitulo) => controlDelEditor.current?.llevarCursorA(posicionDelTitulo)}
            alFijar={fijar}
            alQuitarFijado={quitarFijado}
            alCambiarIconoDeFijado={cambiarIconoDeFijado}
          />
        )}
        <Editor
          ref={controlDelEditor}
          alCambiarTexto={notas.alCambiarTextoEnElEditor}
          alMoverCursor={alMoverCursor}
          configuracionModoEscritor={configuracionModoEscritor}
        />
      </div>
      {compilarAbierto && !bienvenidaVisible && (
        <Compilar
          carpeta={carpetaDelHormiguero}
          arbol={arbolDelHormiguero}
          rutaActiva={notaVisible.rutaDelArchivo}
          ajustes={ajustes}
          textoAbierto={notas.textoDeNotaAbiertaPorRuta}
          onGuardarAjustes={cambiarAjustes}
          onCerrar={() => {
            setCompilarAbierto(false);
            enfocarElEditor();
          }}
        />
      )}
      {ajustesAbiertos && !bienvenidaVisible && (
        <ModalAjustes
          ajustes={ajustes}
          cambiar={cambiarAjustes}
          onNuevoHormiguero={() => setCavandoHormigueroNuevo(true)}
          onCerrar={() => {
            setAjustesAbiertos(false);
            enfocarElEditor();
          }}
        />
      )}
      {bienvenidaVisible && (
        <Bienvenida
          idioma={idiomaDe(ajustes.idioma)}
          onCambiarIdioma={(idioma) => cambiarAjustes({ idioma })}
          onListo={abrirHormiguero}
          onCerrar={hayHormigueros ? () => setBienvenidaPedida(false) : undefined}
        />
      )}
      {cavandoHormigueroNuevo && <NuevoHormiguero onListo={abrirHormiguero} onCerrar={() => setCavandoHormigueroNuevo(false)} />}
      <BarraDeEstado
        nombreDeLaNota={nombreDeLaNotaVisible}
        esperaQueLaGuarden={notaVisibleEsperaQueLaGuarden}
        textoParaContar={notaVisible.ultimoTextoConocido}
        mensajeDeError={mensajeDeError}
      />
    </main>
  );
}

export default App;
