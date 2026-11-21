// Datos de cada cámara guardados en el hormiguero, en su carpeta oculta `.ant/` (ver
// `src-tauri/src/datos_del_hormiguero.rs`): los fijados, sus iconos y las opciones de «Compilar y
// exportar». Así viajan con las notas al mover o sincronizar el hormiguero.
//
// En el archivo las rutas son relativas a la cámara y con `/` («Libro I/01.md#Inicio»; `.` es la
// cámara misma), para que sirvan en otro computador o sistema. En la app se usan completas, como
// en el resto del código: aquí están las conversiones de un lado a otro y el paso de los datos que
// antes vivían en `ajustes.json` (con rutas completas) al archivo de su cámara.

import { invoke } from "@tauri-apps/api/core";
import type { Ajustes, OpcionesDeCompilacion } from "../ajustes";
import { estaEnLaCamara } from "../arbolDeCarpetas.ts";
import { claveDeCapitulo, interpretarClaveDeFijado } from "../barraLateral/clavesDeFijados.ts";

/** Lo que se guarda de una cámara. Debe coincidir con `DatosDeLaCamara` de Rust. */
export interface DatosDeLaCamara {
  /** Claves de lo fijado, en orden: la ruta, o `ruta#título` para un capítulo. */
  fijados: string[];
  /** Icono elegido para cada fijado, por su clave. */
  iconos_de_fijados: Record<string, string>;
  /** Opciones de «Compilar y exportar» de cada carpeta, por su ruta. */
  opciones_de_compilacion_por_carpeta: Record<string, OpcionesDeCompilacion>;
}

/** Una cámara sin datos todavía. */
export const DATOS_VACIOS_DE_LA_CAMARA: DatosDeLaCamara = { fijados: [], iconos_de_fijados: {}, opciones_de_compilacion_por_carpeta: {} };

/** Lee los datos de una cámara (con rutas relativas), o `null` si todavía no tiene archivo. */
export const leerDatosDeLaCamara = (carpetaDelHormiguero: string, nombreDeLaCamara: string) =>
  invoke<DatosDeLaCamara | null>("leer_datos_de_la_camara", { carpetaDelHormiguero, nombreDeLaCamara });

/** Guarda los datos de una cámara (con rutas relativas) en `.ant/camaras/`. */
export const guardarDatosDeLaCamara = (carpetaDelHormiguero: string, nombreDeLaCamara: string, datos: DatosDeLaCamara) =>
  invoke<void>("guardar_datos_de_la_camara", { carpetaDelHormiguero, nombreDeLaCamara, datos });

/** Quita las barras del final de una ruta de carpeta. */
const sinBarraFinal = (rutaDeLaCarpeta: string) => rutaDeLaCarpeta.replace(/[\\/]+$/, "");

/** Ruta relativa a la cámara, con `/` (`.` es la cámara misma). Supone que la ruta está dentro de la cámara. */
export function rutaRelativaALaCamara(ruta: string, carpetaDeLaCamara: string): string {
  const carpeta = sinBarraFinal(carpetaDeLaCamara);
  if (ruta === carpeta) return ".";
  return ruta.slice(carpeta.length + 1).replace(/\\/g, "/");
}

/** Ruta completa a partir de una relativa a la cámara, con el separador que use la carpeta de la cámara. */
export function rutaCompletaEnLaCamara(rutaRelativa: string, carpetaDeLaCamara: string): string {
  const carpeta = sinBarraFinal(carpetaDeLaCamara);
  if (rutaRelativa === "." || rutaRelativa === "") return carpeta;
  const separador = carpeta.includes("\\") && !carpeta.includes("/") ? "\\" : "/";
  return carpeta + separador + rutaRelativa.split("/").join(separador);
}

/** Pasa la clave de un fijado a relativa (o a completa), sin tocar el título de un capítulo. */
function convertirClaveDeFijado(clave: string, convertirRuta: (ruta: string) => string): string {
  const fijado = interpretarClaveDeFijado(clave);
  const rutaConvertida = convertirRuta(fijado.ruta);
  return fijado.tituloDelCapitulo === null ? rutaConvertida : claveDeCapitulo(rutaConvertida, fijado.tituloDelCapitulo);
}

/** Convierte todas las rutas de unos datos (claves de fijados, carpetas y notas de las compilaciones). */
function convertirRutasDeLosDatos(datos: DatosDeLaCamara, convertirRuta: (ruta: string) => string): DatosDeLaCamara {
  const convertirClave = (clave: string) => convertirClaveDeFijado(clave, convertirRuta);
  return {
    fijados: (datos.fijados ?? []).map(convertirClave),
    iconos_de_fijados: Object.fromEntries(Object.entries(datos.iconos_de_fijados ?? {}).map(([clave, icono]) => [convertirClave(clave), icono])),
    opciones_de_compilacion_por_carpeta: Object.fromEntries(
      Object.entries(datos.opciones_de_compilacion_por_carpeta ?? {}).map(([rutaDeLaCarpeta, opciones]) => [
        convertirRuta(rutaDeLaCarpeta),
        { ...opciones, orden: (opciones.orden ?? []).map(convertirRuta), excluidas: (opciones.excluidas ?? []).map(convertirRuta) },
      ]),
    ),
  };
}

/** Datos como se guardan en el archivo: rutas relativas a la cámara. */
export const datosParaGuardar = (datos: DatosDeLaCamara, carpetaDeLaCamara: string) =>
  convertirRutasDeLosDatos(datos, (ruta) => rutaRelativaALaCamara(ruta, carpetaDeLaCamara));

/** Datos como se usan en la app: rutas completas. */
export const datosParaUsar = (datosDelArchivo: DatosDeLaCamara, carpetaDeLaCamara: string) =>
  convertirRutasDeLosDatos(datosDelArchivo, (rutaRelativa) => rutaCompletaEnLaCamara(rutaRelativa, carpetaDeLaCamara));

/** Si unos datos no tienen nada (no hace falta crear su archivo). */
export const sonDatosVacios = (datos: DatosDeLaCamara) =>
  datos.fijados.length === 0 && Object.keys(datos.iconos_de_fijados).length === 0 && Object.keys(datos.opciones_de_compilacion_por_carpeta).length === 0;

/**
 * Lo que una cámara tenía en `ajustes.json` antes de existir `.ant/` (fijados, iconos y
 * compilaciones dentro de su carpeta), con rutas completas, y los cambios de ajustes que lo
 * quitan de ahí una vez guardado en su archivo. Lo de las otras cámaras queda en los ajustes
 * hasta que se abran.
 */
export function datosQueQuedabanEnLosAjustes(ajustes: Ajustes, carpetaDeLaCamara: string, soloNotasSueltas: boolean) {
  const esDeLaCamara = (clave: string) => estaEnLaCamara(interpretarClaveDeFijado(clave).ruta, carpetaDeLaCamara, soloNotasSueltas);
  const fijados = ajustes.fijados ?? [];
  const iconos = Object.entries(ajustes.iconos_de_fijados ?? {});
  const compilaciones = Object.entries(ajustes.opciones_de_compilacion_por_carpeta ?? {});
  const datosDeLaCamara: DatosDeLaCamara = {
    fijados: fijados.filter(esDeLaCamara),
    iconos_de_fijados: Object.fromEntries(iconos.filter(([clave]) => esDeLaCamara(clave))),
    opciones_de_compilacion_por_carpeta: Object.fromEntries(compilaciones.filter(([rutaDeLaCarpeta]) => esDeLaCamara(rutaDeLaCarpeta))),
  };
  const ajustesSinEsosDatos: Partial<Ajustes> = {
    fijados: fijados.filter((clave) => !esDeLaCamara(clave)),
    iconos_de_fijados: Object.fromEntries(iconos.filter(([clave]) => !esDeLaCamara(clave))),
    opciones_de_compilacion_por_carpeta: Object.fromEntries(compilaciones.filter(([rutaDeLaCarpeta]) => !esDeLaCamara(rutaDeLaCarpeta))),
  };
  return { datosDeLaCamara, ajustesSinEsosDatos };
}
