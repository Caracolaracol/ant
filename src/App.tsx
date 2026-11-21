// Ventana principal: la barra lateral, el editor y la barra de estado abajo, como en Left. Este
// archivo solo junta las piezas; cada una vive en su lugar:
//   · ajustes: `ajustes/useAjustesGuardados.ts`
//   · cámaras del hormiguero: `hormigueros/useCamarasDelHormiguero.ts`; árbol de la cámara
//     abierta: `hormigueros/useArbolDeLaCamara.ts`; sus datos en `.ant/` (fijados, iconos,
//     compilaciones): `hormigueros/useDatosDeLaCamara.ts`
//   · notas abiertas, guardado automático y cambios hechos fuera de Ant: `notasAbiertas/useNotasAbiertas.ts`
//   · atajos de teclado: `useAtajosDeTeclado.ts`
//   · franja de arriba con sus botones (panel, nota nueva, cámara nueva): `BarraSuperior.tsx`
//   · barra lateral: `barraLateral/` · barra de estado: `BarraDeEstado.tsx`
// Encima se abren, cuando toca: la bienvenida (sin hormiguero o sin cámara, o desde el menú), los
// Ajustes (Cmd+,), «Nota nueva» (Cmd+N), «Cámara nueva» (Cmd+Shift+N) y «Compilar y exportar»
// (Cmd+Shift+E). Los ítems del menú los maneja
// Rust, que avisa con un evento (`EVENTOS_DE_RUST`) y aquí se abre lo que corresponda.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Editor, ControlDelEditor } from "./editor/Editor";
import { crearConfiguracionModoEscritor } from "./editor/escritor";
import { BarraLateral } from "./barraLateral/BarraLateral";
import { ANCHO_DE_LA_BARRA_POR_DEFECTO } from "./barraLateral/useArrastreDelBorde";
import { BarraDeEstado } from "./BarraDeEstado";
import { BarraSuperior } from "./BarraSuperior";
import type { Ajustes } from "./ajustes";
import { ModalAjustes } from "./ajustes/ModalAjustes";
import { useAjustesGuardados } from "./ajustes/useAjustesGuardados";
import { Bienvenida } from "./bienvenida/Bienvenida";
import { Compilar } from "./compilar/Compilar";
import { carpetaQueContieneA, estaEnLaCamara } from "./arbolDeCarpetas";
import { cambiosParaElegirHormiguero, carpetaDeLaCamaraAbierta, esLaEntrada, nombreVisibleDeLaCamara } from "./hormigueros/hormigueros";
import { NuevaCamara } from "./hormigueros/NuevaCamara";
import { useArbolDeLaCamara } from "./hormigueros/useArbolDeLaCamara";
import { useCamarasDelHormiguero } from "./hormigueros/useCamarasDelHormiguero";
import { useDatosDeLaCamara } from "./hormigueros/useDatosDeLaCamara";
import { idiomaValido, useTextos } from "./idioma";
import { extraerTitulosDeLaNota, indiceDelTituloEnLaPosicion } from "./titulosDeLaNota";
import { nombreDelArchivo } from "./archivosDeNotas";
import { esperaQueLaGuarden } from "./notasAbiertas/notaAbierta";
import { NuevaNota } from "./notasAbiertas/NuevaNota";
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
  const carpetaDelHormiguero = ajustes.hormiguero;
  const { camarasDelHormiguero, releerCamarasDelHormiguero } = useCamarasDelHormiguero(carpetaDelHormiguero);
  const carpetaDeLaCamara = carpetaDeLaCamaraAbierta(ajustes, camarasDelHormiguero);
  // En la «Entrada» (las notas sueltas de la raíz) el árbol y lo que es de la cámara cambian: lo
  // que está en las subcarpetas del hormiguero es de las otras cámaras.
  const laCamaraEsLaEntrada = esLaEntrada(ajustes.camara_abierta);
  const { arbolDeLaCamara, releerArbolDeLaCamara } = useArbolDeLaCamara(carpetaDeLaCamara, laCamaraEsLaEntrada, mostrarError);
  const { datosDeLaCamara, cambiarDatosDeLaCamara } = useDatosDeLaCamara({
    carpetaDelHormiguero,
    nombreDeLaCamara: ajustes.camara_abierta,
    carpetaDeLaCamara,
    ajustesVigentes,
    cambiarAjustes,
    mostrarError,
  });
  const notas = useNotasAbiertas({
    controlDelEditor,
    carpetaDeLaCamaraAbierta: carpetaDeLaCamara,
    releerArbolDeLaCamara,
    mostrarError,
  });
  const { notaVisible } = notas;

  // «Nota nueva» (botón de arriba o Cmd+N): la carpeta donde se creará, o null si está cerrada.
  // Se crea junto a la nota visible si es de la cámara (así los capítulos de «Libro I» quedan
  // juntos) o, si no, en la cámara misma.
  const [carpetaParaLaNotaNueva, setCarpetaParaLaNotaNueva] = useState<string | null>(null);
  const pedirNotaNueva = () => {
    if (!carpetaDeLaCamara) return notas.abrirNotaEnBlanco();
    const rutaDeLaNotaVisible = notaVisible.rutaDelArchivo;
    const laNotaVisibleEsDeLaCamara = rutaDeLaNotaVisible && estaEnLaCamara(rutaDeLaNotaVisible, carpetaDeLaCamara, laCamaraEsLaEntrada);
    setCarpetaParaLaNotaNueva(laNotaVisibleEsDeLaCamara ? carpetaQueContieneA(rutaDeLaNotaVisible) : carpetaDeLaCamara);
  };

  useAtajosDeTeclado(
    {
      pedirNotaNueva,
      abrirNotaConElDialogo: notas.abrirNotaConElDialogo,
      guardarNotaVisible: notas.guardarNotaVisible,
      pasarANotaVecina: notas.pasarANotaVecina,
      mostrarUOcultarBarraLateral: () => setBarraLateralVisible((visible) => !visible),
    },
    () => setMensajeDeError(null),
    mostrarError,
  );

  // Lo que se abre encima del editor desde el menú: «Compilar y exportar», Ajustes, «Cámara
  // nueva» y la bienvenida (que también aparece sola mientras falte el hormiguero o la cámara).
  const [compilarAbierto, setCompilarAbierto] = useState(false);
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [cavandoCamaraNueva, setCavandoCamaraNueva] = useState(false);
  const [bienvenidaPedida, setBienvenidaPedida] = useState(false);
  useEventoDeRust(EVENTOS_DE_RUST.abrirCompilar, useCallback(() => setCompilarAbierto(true), []));
  useEventoDeRust(EVENTOS_DE_RUST.abrirAjustes, useCallback(() => setAjustesAbiertos(true), []));
  useEventoDeRust(EVENTOS_DE_RUST.cavarCamaraNueva, useCallback(() => setCavandoCamaraNueva(true), []));
  useEventoDeRust(EVENTOS_DE_RUST.abrirBienvenida, useCallback(() => setBienvenidaPedida(true), []));
  const faltaElegirLaCamara = !carpetaDeLaCamara;
  const bienvenidaVisible = bienvenidaPedida || faltaElegirLaCamara;

  /** Usa la carpeta elegida en la bienvenida como hormiguero; la cámara se elige en la página siguiente. */
  const elegirHormiguero = useCallback((carpetaDelHormigueroElegido: string) => {
    if (carpetaDelHormigueroElegido !== ajustesVigentes.current.hormiguero) cambiarAjustes(cambiosParaElegirHormiguero(carpetaDelHormigueroElegido));
  }, [cambiarAjustes, ajustesVigentes]);

  /**
   * Abre una cámara (recién cavada o que ya existía) y cierra lo que se abrió para elegirla. Antes
   * relee la lista de cámaras, así una recién cavada ya está en ella y no parece que falta.
   */
  const abrirCamara = useCallback(async (nombreDeLaCamara: string) => {
    await releerCamarasDelHormiguero();
    cambiarAjustes({ camara_abierta: nombreDeLaCamara });
    setCavandoCamaraNueva(false);
    setBienvenidaPedida(false);
  }, [cambiarAjustes, releerCamarasDelHormiguero]);

  // Fijados de la cámara abierta: se guardan en su archivo de `.ant/`, no en los ajustes.

  /** Fija una carpeta, nota o capítulo arriba de la barra lateral. */
  const fijar = useCallback((clave: string) => {
    cambiarDatosDeLaCamara(({ fijados }) => (fijados.includes(clave) ? {} : { fijados: [...fijados, clave] }));
  }, [cambiarDatosDeLaCamara]);

  /** Quita un fijado, y su icono si tenía uno elegido. */
  const quitarFijado = useCallback((clave: string) => {
    cambiarDatosDeLaCamara(({ fijados, iconos_de_fijados }) => {
      const { [clave]: _iconoQueSeQuita, ...iconosQueQuedan } = iconos_de_fijados;
      return { fijados: fijados.filter((claveFijada) => claveFijada !== clave), iconos_de_fijados: iconosQueQuedan };
    });
  }, [cambiarDatosDeLaCamara]);

  /** Cambia el icono de un fijado; `null` vuelve al de su tipo. */
  const cambiarIconoDeFijado = useCallback((clave: string, icono: string | null) => {
    cambiarDatosDeLaCamara(({ iconos_de_fijados }) => {
      const iconosDeFijados = { ...iconos_de_fijados };
      if (icono) iconosDeFijados[clave] = icono;
      else delete iconosDeFijados[clave];
      return { iconos_de_fijados: iconosDeFijados };
    });
  }, [cambiarDatosDeLaCamara]);

  // Títulos de la nota visible y el título donde está el cursor. La posición del cursor va en una
  // ref y no en el estado: cambia en cada movimiento del mouse al seleccionar, y si cada cambio
  // volviera a dibujar la ventana, el scroll al seleccionar texto largo perdería cuadros. Solo se
  // vuelve a dibujar cuando el cursor pasa a otro título.
  const titulosDeLaNotaVisible = useMemo(() => extraerTitulosDeLaNota(notaVisible.ultimoTextoConocido), [notaVisible.ultimoTextoConocido]);
  const titulosVigentes = useRef(titulosDeLaNotaVisible);
  titulosVigentes.current = titulosDeLaNotaVisible;
  const posicionDelCursor = useRef(0);
  const [, setIndiceDelTituloConElCursor] = useState(-1);
  const alMoverCursor = useCallback((posicion: number) => {
    posicionDelCursor.current = posicion;
    setIndiceDelTituloConElCursor(indiceDelTituloEnLaPosicion(titulosVigentes.current, posicion));
  }, []);

  // Modo escritor para el editor (o `null` si está apagado), con las comillas según el idioma.
  const configuracionModoEscritor = useMemo(
    () => (ajustes.modo_escritor ? crearConfiguracionModoEscritor(ajustes.opciones_del_modo_escritor, idiomaValido(ajustes.idioma)) : null),
    [ajustes.modo_escritor, ajustes.opciones_del_modo_escritor, ajustes.idioma],
  );

  const nombreDeLaNotaVisible = notaVisible.rutaDelArchivo ? nombreDelArchivo(notaVisible.rutaDelArchivo) : textosDeLaInterfaz.sinTitulo;
  const notaVisibleEsperaQueLaGuarden = esperaQueLaGuarden(notaVisible);

  // El título de la ventana (visible en Mission Control y el Dock) muestra la nota y si está sin guardar.
  useEffect(() => {
    getCurrentWindow().setTitle(`${notaVisibleEsperaQueLaGuarden ? "• " : ""}${nombreDeLaNotaVisible}`).catch(() => {});
  }, [nombreDeLaNotaVisible, notaVisibleEsperaQueLaGuarden]);

  /** Devuelve el foco al editor al cerrar una ventanita. */
  const enfocarElEditor = () => controlDelEditor.current?.enfocar();

  /** Una carpeta de la cámara como se muestra: el nombre de la cámara y las subcarpetas («Novela / Libro I»). */
  const lugarVisibleDentroDeLaCamara = (rutaDeLaCarpeta: string) => {
    const nombreDeLaCamara = nombreVisibleDeLaCamara(ajustes.camara_abierta ?? "", textosDeLaInterfaz.entrada);
    const subcarpetas = carpetaDeLaCamara ? rutaDeLaCarpeta.slice(carpetaDeLaCamara.length).split(/[\\/]/).filter(Boolean) : [];
    return [nombreDeLaCamara, ...subcarpetas].join(" / ");
  };

  return (
    <main className="app">
      <BarraSuperior
        barraLateralVisible={barraLateralVisible}
        alMostrarUOcultarBarraLateral={() => setBarraLateralVisible((visible) => !visible)}
        alPedirNotaNueva={pedirNotaNueva}
        alPedirCamaraNueva={() => setCavandoCamaraNueva(true)}
      />
      <div className="cuerpo">
        {barraLateralVisible && (
          <BarraLateral
            carpetaDeLaCamara={carpetaDeLaCamara}
            nombreDeLaCamaraAbierta={ajustes.camara_abierta}
            laCamaraEsLaEntrada={laCamaraEsLaEntrada}
            camarasDelHormiguero={camarasDelHormiguero ?? []}
            arbolDeLaCamara={arbolDeLaCamara}
            clavesDeFijados={datosDeLaCamara.fijados}
            iconosElegidosPorFijado={datosDeLaCamara.iconos_de_fijados}
            modoDiarioActivo={ajustes.modo_diario}
            notasAbiertas={notas.notasAbiertas}
            idNotaVisible={notaVisible.id}
            titulosDeLaNotaVisible={titulosDeLaNotaVisible}
            indiceDelTituloConElCursor={indiceDelTituloEnLaPosicion(titulosDeLaNotaVisible, posicionDelCursor.current)}
            anchoEnPixeles={ajustes.ancho_de_la_barra_lateral ?? ANCHO_DE_LA_BARRA_POR_DEFECTO}
            alCambiarAncho={(anchoEnPixeles) => cambiarAjustes({ ancho_de_la_barra_lateral: anchoEnPixeles })}
            alMostrarNotaAbierta={notas.mostrarNotaAbierta}
            alAbrirNotaDeArchivo={(rutaDelArchivo) => ejecutarMostrandoErrores(notas.abrirNotaDeArchivo(rutaDelArchivo))}
            alAbrirCapitulo={(rutaDeLaNota, titulo) => ejecutarMostrandoErrores(notas.abrirCapitulo(rutaDeLaNota, titulo))}
            alAbrirNotaDelDia={(diaElegido) => ejecutarMostrandoErrores(notas.abrirNotaDelDia(diaElegido))}
            alCerrarNota={(idNota) => ejecutarMostrandoErrores(notas.cerrarNota(idNota))}
            alSaltarATitulo={(posicionDelTitulo) => controlDelEditor.current?.llevarCursorA(posicionDelTitulo)}
            alFijar={fijar}
            alQuitarFijado={quitarFijado}
            alCambiarIconoDeFijado={cambiarIconoDeFijado}
            alAbrirCamara={(nombreDeLaCamara) => ejecutarMostrandoErrores(abrirCamara(nombreDeLaCamara))}
            alPedirCamaraNueva={() => setCavandoCamaraNueva(true)}
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
          carpetaDeLaCamara={carpetaDeLaCamara}
          arbolDeLaCamara={arbolDeLaCamara}
          rutaDeLaNotaVisible={notaVisible.rutaDelArchivo}
          ajustes={ajustes}
          textoDeNotaAbiertaPorRuta={notas.textoDeNotaAbiertaPorRuta}
          cambiarAjustes={cambiarAjustes}
          opcionesGuardadasPorCarpeta={datosDeLaCamara.opciones_de_compilacion_por_carpeta}
          alRecordarOpciones={(rutaDeLaCarpeta, opciones) =>
            cambiarDatosDeLaCamara(({ opciones_de_compilacion_por_carpeta }) => ({
              opciones_de_compilacion_por_carpeta: { ...opciones_de_compilacion_por_carpeta, [rutaDeLaCarpeta]: opciones },
            }))
          }
          alCerrar={() => {
            setCompilarAbierto(false);
            enfocarElEditor();
          }}
        />
      )}
      {ajustesAbiertos && !bienvenidaVisible && (
        <ModalAjustes
          ajustes={ajustes}
          cambiarAjustes={cambiarAjustes}
          camarasDelHormiguero={camarasDelHormiguero ?? []}
          alPedirCamaraNueva={() => setCavandoCamaraNueva(true)}
          alCerrar={() => {
            setAjustesAbiertos(false);
            enfocarElEditor();
          }}
        />
      )}
      {bienvenidaVisible && (
        <Bienvenida
          idioma={idiomaValido(ajustes.idioma)}
          alCambiarIdioma={(idiomaElegido) => cambiarAjustes({ idioma: idiomaElegido })}
          carpetaDelHormiguero={carpetaDelHormiguero}
          camarasDelHormiguero={camarasDelHormiguero ?? []}
          alElegirHormiguero={elegirHormiguero}
          alElegirCamara={abrirCamara}
          empezarEnLasCamaras={Boolean(carpetaDelHormiguero) && faltaElegirLaCamara}
          alCerrar={faltaElegirLaCamara ? undefined : () => setBienvenidaPedida(false)}
        />
      )}
      {carpetaParaLaNotaNueva && carpetaDeLaCamara && !bienvenidaVisible && (
        <NuevaNota
          carpetaDondeCrearla={carpetaParaLaNotaNueva}
          lugarVisible={lugarVisibleDentroDeLaCamara(carpetaParaLaNotaNueva)}
          alCrearNota={async (rutaDeLaNota) => {
            setCarpetaParaLaNotaNueva(null);
            await notas.abrirNotaDeArchivo(rutaDeLaNota).catch(mostrarError);
            // La nota nueva aparece en el árbol; si es la primera suelta en la raíz, también la «Entrada».
            releerArbolDeLaCamara();
            void releerCamarasDelHormiguero();
            enfocarElEditor();
          }}
          alCerrar={() => {
            setCarpetaParaLaNotaNueva(null);
            enfocarElEditor();
          }}
        />
      )}
      {cavandoCamaraNueva && carpetaDelHormiguero && !bienvenidaVisible && (
        <NuevaCamara
          carpetaDelHormiguero={carpetaDelHormiguero}
          camarasDelHormiguero={camarasDelHormiguero ?? []}
          alCavarCamara={abrirCamara} alCerrar={() => setCavandoCamaraNueva(false)} />
      )}
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
