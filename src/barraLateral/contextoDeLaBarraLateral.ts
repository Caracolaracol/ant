// Lo que comparten las piezas de la barra lateral (`FilasDelArbol`, `Fijados`): la nota visible y
// sus títulos, las notas abiertas, qué carpetas están desplegadas, qué está fijado, el menú de clic
// derecho (y sus opciones) y lo que se hace al elegir algo. `BarraLateral` lo provee y cada fila lo lee con
// `useBarraLateral()`, así no hay que pasarlo de componente en componente.

import { createContext, useContext } from "react";
import type { TituloDeLaNota } from "../titulosDeLaNota";
import type { OpcionDelMenu } from "../MenuContextual";
import type { NotaAbierta } from "../notasAbiertas/notaAbierta";

export interface DatosDeLaBarraLateral {
  idNotaVisible: string;
  /** Notas abiertas que tienen archivo, por su ruta. */
  notasAbiertasPorRuta: Map<string, NotaAbierta>;
  /** Títulos (`#`…) de la nota visible. */
  titulosDeLaNotaVisible: TituloDeLaNota[];
  /** Índice del título donde está el cursor, o -1. */
  indiceDelTituloConElCursor: number;
  /** Ruta de la nota visible si está en la cámara (sus títulos se pueden fijar como capítulos), o `null`. */
  rutaDeLaNotaVisibleQueSePuedeFijar: string | null;
  /** Carpetas desplegadas, en el árbol o bajo una carpeta fijada. */
  carpetasDesplegadas: Set<string>;
  desplegarOPlegarCarpeta(rutaDeLaCarpeta: string): void;
  /** Claves de lo fijado en la cámara abierta (lo fijado no se repite en el árbol). */
  clavesFijadasVisibles: Set<string>;
  /** Abre el menú de clic derecho con `opciones` donde se hizo el clic. */
  abrirMenuContextual(evento: React.MouseEvent, opciones: OpcionDelMenu[]): void;
  /** Opciones del clic derecho para fijar algo, o para quitarlo si ya está fijado. */
  opcionesParaFijarOQuitar(clave: string): OpcionDelMenu[];
  /** Opciones del clic derecho de una nota o carpeta del árbol: crear junto a ella o dentro, fijar y mostrarla en su carpeta. */
  opcionesDeUnaEntrada(ruta: string, esCarpeta: boolean): OpcionDelMenu[];
  alAbrirNotaDeArchivo(rutaDelArchivo: string): void;
  alCerrarNota(idNota: string): void;
  alSaltarATitulo(posicionDelTitulo: number): void;
}

export const ContextoDeLaBarraLateral = createContext<DatosDeLaBarraLateral | null>(null);

/** Datos compartidos de la barra lateral; solo se puede usar dentro de `BarraLateral`. */
export function useBarraLateral(): DatosDeLaBarraLateral {
  const datos = useContext(ContextoDeLaBarraLateral);
  if (!datos) throw new Error("useBarraLateral se usó fuera de BarraLateral");
  return datos;
}
