// Acceso a los ajustes de la app desde cualquier ventana. Los guarda y lee el lado Rust
// (`src-tauri/src/ajustes.rs`), que además avisa a todas las ventanas cuando cambian.

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import type { Idioma } from "./idioma";
import type { EstiloLibro, TamanoPagina } from "./compilar/formato.ts";
import type { OrigenTitulo } from "./compilar/modelo.ts";

/** Preferencias del usuario. Debe coincidir con la estructura `Ajustes` de Rust. */
export interface Ajustes {
  /** Carpeta de trabajo que muestra la barra lateral, o `null` si aún no se eligió. */
  carpeta: string | null;
  /** Notas y carpetas fijadas arriba en la barra lateral (rutas completas, en orden de fijado). */
  fijados: string[];
  /** Modo diario: calendario en la barra lateral; cada día abre o crea `Daily/AAAA-MM-DD.md`. */
  diario: boolean;
  /** Colores cambiados por el usuario, por nombre de variable CSS sin `--` (ver `colores.ts`). */
  colores: Record<string, string>;
  /** Ancho de la barra lateral en píxeles, o `null` para el de por defecto. */
  ancho_barra: number | null;
  /** Idioma de la interfaz: inglés (por defecto) o español. */
  idioma: Idioma;
  /** Modo escritor del editor (activo por defecto): tipografía al escribir, letra de libro, corrector. */
  escritor: boolean;
  /** Opciones del modo escritor (ver `editor/escritor.ts`). */
  opciones_escritor: OpcionesEscritor;
  /** Nombre del autor para las portadas de «Compilar y exportar». */
  autor: string;
  /** Opciones de «Compilar y exportar» de cada carpeta, por su ruta. */
  compilaciones: Record<string, ConfigCompilacion>;
}

/** Lo que se recuerda de cada carpeta compilada, para no volver a armarla cada vez. */
export interface ConfigCompilacion {
  /** Rutas de las notas en el orden elegido (incluidas y excluidas). */
  orden: string[];
  /** Rutas de las notas que no van en el libro. */
  excluidas: string[];
  titulo: string;
  formato: "docx" | "pdf";
  estilo: EstiloLibro;
  pagina: TamanoPagina;
  origenTitulo: OrigenTitulo;
  tipografia: boolean;
}

/** Opciones del modo escritor. Debe coincidir con `OpcionesEscritor` de Rust. */
export interface OpcionesEscritor {
  /** Comillas rectas → tipográficas. */
  comillas: boolean;
  /** Qué comillas dobles usar: según el idioma, curvas “ ” o latinas « ». */
  estilo_comillas: "auto" | "curvas" | "latinas";
  /** `--` → raya `—`. */
  rayas: boolean;
  /** `...` → `…`. */
  puntos: boolean;
  /** `<<` `>>` → `«` `»`. */
  angulares: boolean;
  /** `->` `<-` → `→` `←`. */
  flechas: boolean;
  /** Letra con serifa, más grande y en columna más angosta. */
  letra_libro: boolean;
  /** Corrector ortográfico del sistema. */
  corrector: boolean;
}

/** Opciones del modo escritor de una instalación nueva: todo activado y comillas según el idioma. */
export const OPCIONES_ESCRITOR: OpcionesEscritor = {
  comillas: true,
  estilo_comillas: "auto",
  rayas: true,
  puntos: true,
  angulares: true,
  flechas: true,
  letra_libro: true,
  corrector: true,
};

/** Ajustes por defecto, mientras se leen los guardados. */
export const AJUSTES_INICIALES: Ajustes = { carpeta: null, fijados: [], diario: false, colores: {}, ancho_barra: null, idioma: "en", escritor: true, opciones_escritor: OPCIONES_ESCRITOR, autor: "", compilaciones: {} };

/** Lee los ajustes guardados (o los valores por defecto si no hay). */
export const leerAjustes = () => invoke<Ajustes>("leer_ajustes");

/** Guarda los ajustes; Rust emite `ajustes-cambiados` a todas las ventanas. */
export const guardarAjustes = (ajustes: Ajustes) => invoke<void>("guardar_ajustes", { ajustes });

/** Llama a `alCambiar` cada vez que alguna ventana guarda ajustes. Devuelve la función para dejar de escuchar. */
export const escucharAjustes = (alCambiar: (a: Ajustes) => void): Promise<UnlistenFn> =>
  listen<Ajustes>("ajustes-cambiados", (e) => alCambiar(e.payload));
