// Ventana principal: la barra lateral, el editor y la barra de estado abajo, como en Left. Este
// archivo solo junta las piezas; cada una vive en su lugar:
//   · ajustes: `ajustes/useAjustesGuardados.ts`
//   · cámaras del hormiguero: `hormigueros/useCamarasDelHormiguero.ts`; árbol de la cámara
//     abierta: `hormigueros/useArbolDeLaCamara.ts`; sus datos en `.ant/` (fijados, iconos,
//     compilaciones): `hormigueros/useDatosDeLaCamara.ts`
//   · notas abiertas, guardado automático y cambios hechos fuera de Ant: `notasAbiertas/useNotasAbiertas.ts`
//   · atajos de teclado: `useAtajosDeTeclado.ts`
//   · imágenes arrastradas o pegadas en la nota: `editor/useImagenesEnLaNota.ts`
//   · barra lateral: `barraLateral/` · barra de estado: `BarraDeEstado.tsx`
// Encima se abren, cuando toca: la bienvenida (sin hormiguero o sin cámara, o desde el menú), los
// Ajustes (Cmd+,), «Nota nueva» (Cmd+N) o «Carpeta nueva» (clic derecho en la barra lateral),
// «Cámara nueva» (Cmd+Shift+N) y «Compilar y exportar»
// (Cmd+Shift+E). Los ítems del menú los maneja
// Rust, que avisa con un evento (`EVENTOS_DE_RUST`) y aquí se abre lo que corresponda.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Editor, ControlDelEditor } from "./editor/Editor";
import { crearConfiguracionModoEscritor } from "./editor/escritor";
import { BarraLateral } from "./barraLateral/BarraLateral";
import { ANCHO_DE_LA_BARRA_POR_DEFECTO } from "./barraLateral/useArrastreDelBorde";
import { BarraDeEstado } from "./BarraDeEstado";
import { hayTipografiaActiva, opcionesDelEditorDeLaCamara, type Ajustes, type OpcionesDelEditor } from "./ajustes";
import { ModalAjustes } from "./ajustes/ModalAjustes";
import { useAjustesGuardados } from "./ajustes/useAjustesGuardados";
import { Bienvenida } from "./bienvenida/Bienvenida";
import { Compilar } from "./compilar/Compilar";
import { carpetaQueContieneA, estaEnLaCamara } from "./arbolDeCarpetas";
import { cambiosParaElegirHormiguero, carpetaDeLaCamaraAbierta, esLaEntrada, nombreVisibleDeLaCamara , rutaDeLaCamara } from "./hormigueros/hormigueros";
import { NuevaCamara } from "./hormigueros/NuevaCamara";
import { useArbolDeLaCamara } from "./hormigueros/useArbolDeLaCamara";
import { useCamarasDelHormiguero } from "./hormigueros/useCamarasDelHormiguero";
import { useDatosDeLaCamara } from "./hormigueros/useDatosDeLaCamara";
import { useCifradoDeLaCamara } from "./hormigueros/useCifradoDeLaCamara";
import { esErrorDeCamaraBloqueada, textoDelError } from "./hormigueros/camarasCifradas";
import { CifrarCamara } from "./hormigueros/CifrarCamara";
import { DesbloquearCamara } from "./hormigueros/DesbloquearCamara";
import { idiomaValido, useTextos } from "./idioma";
import { extraerTitulosDeLaNota, indiceDelTituloEnLaPosicion } from "./titulosDeLaNota";
import { nombreDelArchivo } from "./archivosDeNotas";
import { esperaQueLaGuarden } from "./notasAbiertas/notaAbierta";
import { NuevaNotaOCarpeta, type QueSeCrea } from "./hormigueros/NuevaNotaOCarpeta";
import { InvitacionANotaNueva } from "./notasAbiertas/InvitacionANotaNueva";
import { useNotasAbiertas } from "./notasAbiertas/useNotasAbiertas";
import { useAtajosDeTeclado } from "./useAtajosDeTeclado";
import { ES_MAC, atajoDeLaAccion, textoDelAtajo } from "./atajos";
import { useImagenesEnLaNota } from "./editor/useImagenesEnLaNota";
import { EVENTOS_DE_RUST, useEventoDeRust } from "./useEventoDeRust";
import "./App.css";

function App({ ajustesIniciales }: { ajustesIniciales: Ajustes }) {
  const controlDelEditor = useRef<ControlDelEditor>(null);
  const textosDeLaInterfaz = useTextos();
  const [mensajeDeError, setMensajeDeError] = useState<string | null>(null);
  const [barraLateralVisible, setBarraLateralVisible] = useState(true);

  /** Muestra un error en la barra de estado (los de las cámaras cifradas, en el idioma de la app). */
  const textosVigentes = useRef(textosDeLaInterfaz);
  textosVigentes.current = textosDeLaInterfaz;
  const mostrarError = useCallback((error: unknown) => setMensajeDeError(textoDelError(error, textosVigentes.current)), []);
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

  // Cámaras cifradas: si la abierta está bloqueada, no se lee su árbol ni se muestra nada de ella
  // hasta desbloquearla. Al bloquearla se guardan y cierran sus notas y el editor olvida su texto
  // (las notas abiertas se crean más abajo: se llega a ellas por una ref).
  const cerrarNotasDentroDe = useRef<(carpeta: string) => Promise<void>>(async () => {});
  // Al bloquear se cierran sus notas, pero la última nota abierta se sigue recordando: al volver a
  // desbloquear la cámara (o al entrar de nuevo) se abre esa.
  const seCierranNotasPorBloqueo = useRef(false);
  const cifrado = useCifradoDeLaCamara({
    carpetaDelHormiguero,
    camarasDelHormiguero,
    carpetaDeLaCamara,
    async prepararseParaBloquear(carpeta) {
      seCierranNotasPorBloqueo.current = true;
      await cerrarNotasDentroDe.current(carpeta);
      controlDelEditor.current?.olvidarNotasDentroDe(carpeta);
    },
    mostrarError,
  });
  // Mientras no se sabe si está bloqueada (un instante, al cambiar de cámara) se trata como bloqueada.
  const laCamaraSeVe = cifrado.estadoDeLaCamaraAbierta === "sin_cifrar" || cifrado.estadoDeLaCamaraAbierta === "desbloqueada";
  const { arbolDeLaCamara, releerArbolDeLaCamara } = useArbolDeLaCamara(laCamaraSeVe ? carpetaDeLaCamara : null, laCamaraEsLaEntrada, mostrarError);
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
  cerrarNotasDentroDe.current = notas.cerrarNotasDentroDe;

  /**
   * Desbloquea la cámara abierta con su contraseña y, si no hay ninguna nota a la vista, abre la
   * última que se usó si es de esa cámara.
   */
  const desbloquearLaCamara = async (contrasena: string) => {
    await cifrado.desbloquearLaCamaraAbierta(contrasena);
    const rutaDeLaUltimaNota = ajustesVigentes.current.ultima_nota_abierta;
    if (!notas.notaVisible && rutaDeLaUltimaNota && carpetaDeLaCamara && estaEnLaCamara(rutaDeLaUltimaNota, carpetaDeLaCamara, laCamaraEsLaEntrada)) {
      ejecutarMostrandoErrores(notas.abrirNotaDeArchivo(rutaDeLaUltimaNota));
    }
  };

  // Imágenes arrastradas o pegadas en la nota visible (se guardan junto a ella).
  const { pegarImagenes } = useImagenesEnLaNota({
    controlDelEditor,
    rutaDeLaNotaVisible: notaVisible?.rutaDelArchivo ?? null,
    carpetaDelHormiguero,
    abrirNotaDeArchivo: notas.abrirNotaDeArchivo,
    ejecutarMostrandoErrores,
  });

  // Ventanita «Nota nueva» o «Carpeta nueva»: qué se crea y dónde, o null si está cerrada. Se
  // pide con clic derecho en la barra lateral (en una carpeta, junto a una nota o en la cámara), o
  // con Cmd+N (la nota).
  const [creacionPedida, setCreacionPedida] = useState<{ queSeCrea: QueSeCrea; carpetaDondeCrearla: string } | null>(null);
  // La última carpeta creada, para que la barra lateral la despliegue.
  const [carpetaRecienCreada, setCarpetaRecienCreada] = useState<string | null>(null);

  /**
   * «Nota nueva» de Cmd+N: junto a la nota visible si es de la cámara (así los
   * capítulos de «Libro I» quedan juntos) o, si no, en la cámara misma.
   */
  const pedirNotaNueva = () => {
    if (carpetaDeLaCamara && !laCamaraSeVe) return; // Cámara cifrada bloqueada: primero hay que desbloquearla.
    if (!carpetaDeLaCamara) return notas.abrirNotaEnBlanco();
    const rutaDeLaNotaVisible = notaVisible?.rutaDelArchivo;
    const laNotaVisibleEsDeLaCamara = rutaDeLaNotaVisible && estaEnLaCamara(rutaDeLaNotaVisible, carpetaDeLaCamara, laCamaraEsLaEntrada);
    setCreacionPedida({ queSeCrea: "nota", carpetaDondeCrearla: laNotaVisibleEsDeLaCamara ? carpetaQueContieneA(rutaDeLaNotaVisible) : carpetaDeLaCamara });
  };

  useAtajosDeTeclado(
    {
      pedirNotaNueva,
      abrirNotaConElDialogo: notas.abrirNotaConElDialogo,
      guardarNotaVisible: notas.guardarNotaVisible,
      pasarANotaVecina: notas.pasarANotaVecina,
      mostrarUOcultarBarraLateral: () => setBarraLateralVisible((visible) => !visible),
    },
    ajustes.atajos_de_teclado,
    () => setMensajeDeError(null),
    mostrarError,
  );

  // Lo que se abre encima del editor desde el menú: «Compilar y exportar», Ajustes, «Cámara
  // nueva» y la bienvenida (que también aparece sola mientras falte el hormiguero o la cámara).
  const [compilarAbierto, setCompilarAbierto] = useState(false);
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [cavandoCamaraNueva, setCavandoCamaraNueva] = useState(false);
  // Ventanita para cifrar una cámara o quitarle el cifrado (desde Ajustes → General), o null.
  const [cifradoPedido, setCifradoPedido] = useState<{ queSeHace: "cifrar" | "quitar_cifrado"; nombreDeLaCamara: string } | null>(null);
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
  const textoDeLaNotaVisible = notaVisible?.ultimoTextoConocido ?? "";
  const titulosDeLaNotaVisible = useMemo(() => extraerTitulosDeLaNota(textoDeLaNotaVisible), [textoDeLaNotaVisible]);
  const titulosVigentes = useRef(titulosDeLaNotaVisible);
  titulosVigentes.current = titulosDeLaNotaVisible;
  const posicionDelCursor = useRef(0);
  const [, setIndiceDelTituloConElCursor] = useState(-1);
  const alMoverCursor = useCallback((posicion: number) => {
    posicionDelCursor.current = posicion;
    setIndiceDelTituloConElCursor(indiceDelTituloEnLaPosicion(titulosVigentes.current, posicion));
  }, []);

  // Opciones del editor de la cámara abierta (cada cámara tiene las suyas, en sus datos de `.ant/`;
  // la que no eligió usa las de los ajustes generales) y, para el editor, ya resueltas: las del
  // escritor, con las comillas según el idioma.
  const opcionesDelEditor = opcionesDelEditorDeLaCamara(datosDeLaCamara, ajustes);
  const configuracionDelEditor = useMemo(
    () => ({ opciones: opcionesDelEditor, escritor: crearConfiguracionModoEscritor(opcionesDelEditor, idiomaValido(ajustes.idioma)) }),
    [JSON.stringify(opcionesDelEditor), ajustes.idioma],
  );
  /** Cambia opciones del editor de la cámara abierta (se guardan en sus datos de `.ant/`, ya con la forma nueva). */
  const cambiarOpcionesDelEditor = (cambios: Partial<OpcionesDelEditor>) =>
    cambiarDatosDeLaCamara((datos) => ({
      opciones_del_editor: { ...opcionesDelEditorDeLaCamara(datos, ajustesVigentes.current), ...cambios },
      editor: null,
    }));

  const nombreDeLaNotaVisible = !notaVisible ? null : notaVisible.rutaDelArchivo ? nombreDelArchivo(notaVisible.rutaDelArchivo) : textosDeLaInterfaz.sinTitulo;
  const notaVisibleEsperaQueLaGuarden = notaVisible !== null && esperaQueLaGuarden(notaVisible);

  // Al entrar a la app se vuelve a abrir la última nota (si todavía existe); si no había, la app
  // arranca sin notas, con la invitación a crear una. Nunca se crea una nota de la nada.
  const yaSeIntentoAbrirLaUltimaNota = useRef(false);
  useEffect(() => {
    if (yaSeIntentoAbrirLaUltimaNota.current) return;
    yaSeIntentoAbrirLaUltimaNota.current = true;
    const rutaDeLaUltimaNota = ajustesIniciales.ultima_nota_abierta;
    // Si es de una cámara cifrada bloqueada, se sigue recordando: se abre al desbloquearla.
    if (rutaDeLaUltimaNota) {
      notas.abrirNotaDeArchivo(rutaDeLaUltimaNota).catch((error) => !esErrorDeCamaraBloqueada(error) && cambiarAjustes({ ultima_nota_abierta: null }));
    }
  }, []);

  // Se recuerda la última nota abierta (o que no quedó ninguna, al cerrar la última). Una nota en
  // blanco sin archivo no cambia lo recordado.
  const rutaDeLaNotaVisible = notaVisible?.rutaDelArchivo ?? null;
  useEffect(() => {
    if (notaVisible && !rutaDeLaNotaVisible) return;
    if (seCierranNotasPorBloqueo.current) {
      seCierranNotasPorBloqueo.current = false;
      if (!notaVisible) return;
    }
    if (rutaDeLaNotaVisible !== ajustesVigentes.current.ultima_nota_abierta) cambiarAjustes({ ultima_nota_abierta: rutaDeLaNotaVisible });
  }, [rutaDeLaNotaVisible, notaVisible === null]);

  // Sin el menú de clic derecho del sistema (que en la ventana solo ofrece «Recargar» o
  // «Inspeccionar»): la barra lateral tiene el suyo (`MenuContextual`). Se deja en el editor y en
  // los campos de texto, donde trae cortar, copiar, pegar y las sugerencias del corrector.
  useEffect(() => {
    const alPedirMenuDelSistema = (evento: MouseEvent) => {
      const dondeSeHizoClic = evento.target instanceof Element ? evento.target : null;
      if (!dondeSeHizoClic?.closest(".cm-editor, input, textarea")) evento.preventDefault();
    };
    window.addEventListener("contextmenu", alPedirMenuDelSistema);
    return () => window.removeEventListener("contextmenu", alPedirMenuDelSistema);
  }, []);

  // El título de la ventana (visible en Mission Control y el Dock) muestra la nota y si está sin guardar.
  useEffect(() => {
    // Sin ninguna nota abierta, solo «Ant».
    getCurrentWindow().setTitle(`${notaVisibleEsperaQueLaGuarden ? "• " : ""}${nombreDeLaNotaVisible ?? "Ant"}`).catch(() => {});
  }, [nombreDeLaNotaVisible, notaVisibleEsperaQueLaGuarden]);

  /** Ancho de la barra lateral (el panel) en píxeles. */
  const anchoDelPanel = ajustes.ancho_de_la_barra_lateral ?? ANCHO_DE_LA_BARRA_POR_DEFECTO;

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
      {/* Franja superior que reemplaza la barra de título nativa (oculta en tauri.conf.json):
          deja espacio a los botones de la ventana y permite arrastrarla. */}
      <div className="arrastre" data-tauri-drag-region />
      <div className="cuerpo">
        {barraLateralVisible && (
          <BarraLateral
            carpetaDeLaCamara={carpetaDeLaCamara}
            nombreDeLaCamaraAbierta={ajustes.camara_abierta}
            laCamaraEsLaEntrada={laCamaraEsLaEntrada}
            laCamaraEstaBloqueada={!laCamaraSeVe}
            camarasDelHormiguero={camarasDelHormiguero ?? []}
            camarasCifradas={cifrado.camarasCifradas}
            alBloquearLaCamara={
              cifrado.estadoDeLaCamaraAbierta === "desbloqueada" && carpetaDeLaCamara
                ? () => ejecutarMostrandoErrores(cifrado.bloquearCamara(carpetaDeLaCamara))
                : null
            }
            arbolDeLaCamara={arbolDeLaCamara}
            clavesDeFijados={datosDeLaCamara.fijados}
            iconosElegidosPorFijado={datosDeLaCamara.iconos_de_fijados}
            modoDiarioActivo={ajustes.modo_diario}
            notasAbiertas={notas.notasAbiertas}
            idNotaVisible={notaVisible?.id ?? null}
            titulosDeLaNotaVisible={titulosDeLaNotaVisible}
            indiceDelTituloConElCursor={indiceDelTituloEnLaPosicion(titulosDeLaNotaVisible, posicionDelCursor.current)}
            anchoEnPixeles={anchoDelPanel}
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
            alPedirCrear={(queSeCrea, carpetaDondeCrearla) => setCreacionPedida({ queSeCrea, carpetaDondeCrearla })}
            carpetaRecienCreada={carpetaRecienCreada}
          />
        )}
        <Editor
          ref={controlDelEditor}
          alCambiarTexto={notas.alCambiarTextoEnElEditor}
          alMoverCursor={alMoverCursor}
          configuracionDelEditor={configuracionDelEditor}
          rutaDeLaNotaVisible={rutaDeLaNotaVisible}
          carpetaDelHormiguero={carpetaDelHormiguero}
          alPegarImagenes={pegarImagenes}
          estaOculto={!notaVisible || cifrado.laCamaraEstaBloqueada}
        />
        {cifrado.laCamaraEstaBloqueada && carpetaDeLaCamara && (
          <DesbloquearCamara
            key={carpetaDeLaCamara}
            nombreDeLaCamara={nombreVisibleDeLaCamara(ajustes.camara_abierta ?? "", textosDeLaInterfaz.entrada)}
            alDesbloquear={desbloquearLaCamara}
          />
        )}
        {!notaVisible && carpetaDeLaCamara && laCamaraSeVe && (
          <InvitacionANotaNueva
            nombreDeLaCamara={nombreVisibleDeLaCamara(ajustes.camara_abierta ?? "", textosDeLaInterfaz.entrada)}
            atajoDeNotaNueva={textoDelAtajo(atajoDeLaAccion(ajustes.atajos_de_teclado, "nota_nueva"), ES_MAC)}
            alCrearNotaNueva={() => setCreacionPedida({ queSeCrea: "nota", carpetaDondeCrearla: carpetaDeLaCamara })}
          />
        )}
      </div>
      {compilarAbierto && !bienvenidaVisible && (
        <Compilar
          carpetaDeLaCamara={carpetaDeLaCamara}
          arbolDeLaCamara={arbolDeLaCamara}
          rutaDeLaNotaVisible={rutaDeLaNotaVisible}
          ajustes={ajustes}
          opcionesDelModoEscritor={hayTipografiaActiva(opcionesDelEditor) ? opcionesDelEditor : null}
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
          camarasCifradas={cifrado.camarasCifradas}
          nombreDeLaCamaraAbierta={ajustes.camara_abierta ? nombreVisibleDeLaCamara(ajustes.camara_abierta, textosDeLaInterfaz.entrada) : null}
          opcionesDelEditor={opcionesDelEditor}
          cambiarOpcionesDelEditor={cambiarOpcionesDelEditor}
          alPedirCifrado={(queSeHace, nombreDeLaCamara) => setCifradoPedido({ queSeHace, nombreDeLaCamara })}
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
      {creacionPedida && carpetaDeLaCamara && !bienvenidaVisible && (
        <NuevaNotaOCarpeta
          queSeCrea={creacionPedida.queSeCrea}
          carpetaDondeCrearla={creacionPedida.carpetaDondeCrearla}
          lugarVisible={lugarVisibleDentroDeLaCamara(creacionPedida.carpetaDondeCrearla)}
          alCrear={async (rutaCreada) => {
            setCreacionPedida(null);
            if (creacionPedida.queSeCrea === "carpeta") setCarpetaRecienCreada(rutaCreada);
            else await notas.abrirNotaDeArchivo(rutaCreada).catch(mostrarError);
            // Lo nuevo aparece en el árbol; una nota suelta en la raíz también hace aparecer la «Entrada».
            releerArbolDeLaCamara();
            void releerCamarasDelHormiguero();
            enfocarElEditor();
          }}
          alCerrar={() => {
            setCreacionPedida(null);
            enfocarElEditor();
          }}
        />
      )}
      {cifradoPedido && carpetaDelHormiguero && (
        <CifrarCamara
          queSeHace={cifradoPedido.queSeHace}
          nombreDeLaCamara={cifradoPedido.nombreDeLaCamara}
          alConfirmar={async (contrasena) => {
            const carpeta = rutaDeLaCamara(carpetaDelHormiguero, cifradoPedido.nombreDeLaCamara);
            if (cifradoPedido.queSeHace === "cifrar") await cifrado.cifrarUnaCamara(carpeta, contrasena);
            else await cifrado.quitarCifradoDeUnaCamara(carpeta, contrasena);
            setCifradoPedido(null);
          }}
          alCerrar={() => setCifradoPedido(null)}
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
        textoParaContar={notaVisible ? notaVisible.ultimoTextoConocido : null}
        mensajeDeError={mensajeDeError}
      />
    </main>
  );
}

export default App;
