// Datos de la cámara abierta guardados en `.ant/` del hormiguero (fijados, sus iconos y las
// opciones de «Compilar y exportar»; ver `datosDeLaCamara.ts`). Se leen al abrir la cámara y cada
// vez que la ventana recupera el foco (por si llegaron cambios de otro computador por una
// sincronización), y se guardan apenas cambian.
//
// La primera vez que se abre una cámara sin archivo, se pasa a él lo que esa cámara tenía en
// `ajustes.json` (de las versiones de antes) y se quita de los ajustes.

import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Ajustes } from "../ajustes";
import {
  DATOS_VACIOS_DE_LA_CAMARA,
  DatosDeLaCamara,
  datosParaGuardar,
  datosParaUsar,
  datosQueQuedabanEnLosAjustes,
  guardarDatosDeLaCamara,
  leerDatosDeLaCamara,
  sonDatosVacios,
} from "./datosDeLaCamara";
import { esLaEntrada } from "./hormigueros";

interface Parametros {
  carpetaDelHormiguero: string | null;
  /** Nombre de la cámara abierta (`CAMARA_DE_ENTRADA` para la «Entrada»), o `null`. */
  nombreDeLaCamara: string | null;
  /** Carpeta de la cámara abierta, o `null` si no hay ninguna (o ya no existe). */
  carpetaDeLaCamara: string | null;
  /** Los ajustes al día, para pasar al archivo lo que la cámara tenía en ellos. */
  ajustesVigentes: { current: Ajustes };
  cambiarAjustes(cambios: Partial<Ajustes>): void;
  mostrarError(error: unknown): void;
}

export function useDatosDeLaCamara({ carpetaDelHormiguero, nombreDeLaCamara, carpetaDeLaCamara, ajustesVigentes, cambiarAjustes, mostrarError }: Parametros) {
  const [datosDeLaCamara, setDatosDeLaCamara] = useState<DatosDeLaCamara>(DATOS_VACIOS_DE_LA_CAMARA);
  // La cámara a la que pertenecen los datos de ahora: una lectura que vuelve tarde, de otra
  // cámara, se descarta; y no se guarda nada hasta haber leído la cámara abierta.
  const camaraAbierta = carpetaDelHormiguero && nombreDeLaCamara && carpetaDeLaCamara
    ? { carpetaDelHormiguero, nombreDeLaCamara, carpetaDeLaCamara }
    : null;
  const identificadorDeLaCamara = camaraAbierta ? `${carpetaDelHormiguero}\n${nombreDeLaCamara}` : null;
  const camaraVigente = useRef({ camaraAbierta, identificadorDeLaCamara });
  camaraVigente.current = { camaraAbierta, identificadorDeLaCamara };
  const datosVigentes = useRef<{ identificador: string | null; datos: DatosDeLaCamara }>({ identificador: null, datos: DATOS_VACIOS_DE_LA_CAMARA });
  const guardadosEnCurso = useRef(new Map<string, Promise<void>>());

  /** Serializa las escrituras de `.ant/` para que la última no se pise con una anterior. */
  const guardarDatos = useCallback((camara: { carpetaDelHormiguero: string; nombreDeLaCamara: string; carpetaDeLaCamara: string }, datos: DatosDeLaCamara) => {
    const carpeta = camara.carpetaDeLaCamara;
    const guardadoAnterior = guardadosEnCurso.current.get(carpeta);
    const guardado = (async () => {
      await guardadoAnterior?.catch(() => {});
      await guardarDatosDeLaCamara(camara.carpetaDelHormiguero, camara.nombreDeLaCamara, datosParaGuardar(datos, carpeta));
    })().finally(() => {
      if (guardadosEnCurso.current.get(carpeta) === guardado) guardadosEnCurso.current.delete(carpeta);
    });
    guardadosEnCurso.current.set(carpeta, guardado);
    return guardado;
  }, []);

  /** Espera a que terminen los cambios de Ajustes antes de mover el archivo de la cámara. */
  const esperarGuardadoDeLaCamara = (carpeta: string) => guardadosEnCurso.current.get(carpeta);

  /** Deja los datos de una cámara como los de ahora. */
  const usarDatos = useCallback((identificador: string, datos: DatosDeLaCamara) => {
    datosVigentes.current = { identificador, datos };
    setDatosDeLaCamara(datos);
  }, []);

  /** Lee los datos de la cámara abierta (o los pasa desde los ajustes si todavía no tiene archivo). */
  const releerDatosDeLaCamara = useCallback(async () => {
    const { camaraAbierta: camara, identificadorDeLaCamara: identificador } = camaraVigente.current;
    if (!camara || !identificador) {
      datosVigentes.current = { identificador: null, datos: DATOS_VACIOS_DE_LA_CAMARA };
      return setDatosDeLaCamara(DATOS_VACIOS_DE_LA_CAMARA);
    }
    const datosDelArchivo = await leerDatosDeLaCamara(camara.carpetaDelHormiguero, camara.nombreDeLaCamara);
    if (camaraVigente.current.identificadorDeLaCamara !== identificador) return;
    if (datosDelArchivo) return usarDatos(identificador, datosParaUsar(datosDelArchivo, camara.carpetaDeLaCamara));

    const { datosDeLaCamara: datosDeLosAjustes, ajustesSinEsosDatos } = datosQueQuedabanEnLosAjustes(
      ajustesVigentes.current,
      camara.carpetaDeLaCamara,
      esLaEntrada(camara.nombreDeLaCamara),
    );
    usarDatos(identificador, datosDeLosAjustes);
    if (sonDatosVacios(datosDeLosAjustes)) return;
    // Primero se guarda el archivo y solo después se quita de los ajustes: si falla, no se pierde nada.
    await guardarDatos(camara, datosDeLosAjustes);
    cambiarAjustes(ajustesSinEsosDatos);
  }, [ajustesVigentes, cambiarAjustes, guardarDatos, usarDatos]);

  useEffect(() => {
    releerDatosDeLaCamara().catch(mostrarError);
  }, [identificadorDeLaCamara, carpetaDeLaCamara, releerDatosDeLaCamara, mostrarError]);
  useEffect(() => {
    const dejarDeEscuchar = getCurrentWindow().onFocusChanged(({ payload: laVentanaTieneElFoco }) => {
      if (laVentanaTieneElFoco) releerDatosDeLaCamara().catch(mostrarError);
    });
    return () => void dejarDeEscuchar.then((dejar) => dejar());
  }, [releerDatosDeLaCamara, mostrarError]);

  /**
   * Cambia algunos datos de la cámara abierta y los guarda en su archivo. Recibe una función con
   * los datos de ahora, así dos cambios seguidos no se pisan.
   */
  const cambiarDatosDeLaCamara = useCallback((calcularCambios: (datosDeAhora: DatosDeLaCamara) => Partial<DatosDeLaCamara>) => {
    const { camaraAbierta: camara, identificadorDeLaCamara: identificador } = camaraVigente.current;
    if (!camara || datosVigentes.current.identificador !== identificador) return;
    const datosNuevos = { ...datosVigentes.current.datos, ...calcularCambios(datosVigentes.current.datos) };
    usarDatos(identificador!, datosNuevos);
    guardarDatos(camara, datosNuevos).catch(mostrarError);
  }, [guardarDatos, usarDatos, mostrarError]);

  return { datosDeLaCamara, cambiarDatosDeLaCamara, esperarGuardadoDeLaCamara };
}
