// Formato de los ajustes de la app y cómo leerlos, guardarlos y enterarse cuando cambian. Los
// guarda y lee Rust (`src-tauri/src/ajustes.rs`) en `ajustes.json`, y avisa a la interfaz con el
// evento `ajustes-cambiados`. Los nombres de los campos son los del archivo: si se cambia uno, Rust
// tiene que seguir leyendo el nombre anterior (`#[serde(alias = …)]`).

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import type { Idioma } from "./idioma";
import type { EstiloDelLibro, TamanoDePagina } from "./compilar/formato.ts";
import type { OrigenDelTituloDeCadaCapitulo } from "./compilar/modelo.ts";

/** Preferencias del usuario. Debe coincidir con la estructura `Ajustes` de Rust. */
export interface Ajustes {
  /** Hormiguero abierto (la carpeta que muestra la barra lateral), o `null` si no hay ninguno. */
  hormiguero_abierto: string | null;
  /** Hormigueros del usuario: rutas de sus carpetas, en el orden en que se agregaron. */
  hormigueros: string[];
  /**
   * Notas, carpetas y capítulos fijados arriba en la barra lateral, en orden de fijado: la ruta
   * completa, o `ruta#título` para un capítulo (ver `barraLateral/clavesDeFijados.ts`).
   */
  fijados: string[];
  /** Icono elegido para cada fijado (un nombre de `iconos.ts`), por su clave en `fijados`. */
  iconos_de_fijados: Record<string, string>;
  /** Modo diario: calendario en la barra lateral; cada día abre o crea `Daily/AAAA-MM-DD.md`. */
  modo_diario: boolean;
  /** Colores que eligió el usuario, por nombre de variable CSS sin `--` (ver `colores.ts`). */
  colores_elegidos: Record<string, string>;
  /** Ancho de la barra lateral en píxeles, o `null` para el de por defecto. */
  ancho_de_la_barra_lateral: number | null;
  /** Idioma de la interfaz: inglés (por defecto) o español. */
  idioma: Idioma;
  /** Modo escritor del editor (activo por defecto): tipografía al escribir, letra de libro, corrector. */
  modo_escritor: boolean;
  /** Opciones del modo escritor (ver `editor/escritor.ts`). */
  opciones_del_modo_escritor: OpcionesDelModoEscritor;
  /** Nombre del autor para las portadas de «Compilar y exportar». */
  nombre_del_autor: string;
  /** Opciones de «Compilar y exportar» de cada carpeta, por su ruta. */
  opciones_de_compilacion_por_carpeta: Record<string, OpcionesDeCompilacion>;
}

/** Lo que se recuerda de cada carpeta compilada, para no volver a armarla cada vez. */
export interface OpcionesDeCompilacion {
  /** Rutas de las notas en el orden elegido (incluidas y excluidas). */
  orden: string[];
  /** Rutas de las notas que no van en el libro. */
  excluidas: string[];
  titulo: string;
  formato: "docx" | "pdf";
  estilo: EstiloDelLibro;
  pagina: TamanoDePagina;
  origenTitulo: OrigenDelTituloDeCadaCapitulo;
  tipografia: boolean;
}

/** Opciones del modo escritor. Debe coincidir con `OpcionesDelModoEscritor` de Rust. */
export interface OpcionesDelModoEscritor {
  /** Comillas rectas → tipográficas. */
  comillas_tipograficas: boolean;
  /** Qué comillas dobles usar: según el idioma, curvas “ ” o latinas « ». */
  estilo_de_comillas: "auto" | "curvas" | "latinas";
  /** `--` → raya `—`. */
  rayas_de_dialogo: boolean;
  /** `...` → `…`. */
  puntos_suspensivos: boolean;
  /** `<<` `>>` → `«` `»`. */
  comillas_angulares: boolean;
  /** `->` `<-` → `→` `←`. */
  flechas: boolean;
  /** Letra con serifa, más grande y en columna más angosta. */
  letra_de_libro: boolean;
  /** Corrector ortográfico del sistema. */
  corrector_ortografico: boolean;
}

/** Opciones del modo escritor de una instalación nueva: todo activado y comillas según el idioma. */
export const OPCIONES_DEL_MODO_ESCRITOR_POR_DEFECTO: OpcionesDelModoEscritor = {
  comillas_tipograficas: true,
  estilo_de_comillas: "auto",
  rayas_de_dialogo: true,
  puntos_suspensivos: true,
  comillas_angulares: true,
  flechas: true,
  letra_de_libro: true,
  corrector_ortografico: true,
};

/** Ajustes de una instalación nueva, mientras se leen los guardados. */
export const AJUSTES_POR_DEFECTO: Ajustes = {
  hormiguero_abierto: null,
  hormigueros: [],
  fijados: [],
  iconos_de_fijados: {},
  modo_diario: false,
  colores_elegidos: {},
  ancho_de_la_barra_lateral: null,
  idioma: "en",
  modo_escritor: true,
  opciones_del_modo_escritor: OPCIONES_DEL_MODO_ESCRITOR_POR_DEFECTO,
  nombre_del_autor: "",
  opciones_de_compilacion_por_carpeta: {},
};

/** Lee los ajustes guardados (o los valores por defecto si no hay). */
export const leerAjustesGuardados = () => invoke<Ajustes>("leer_ajustes");

/** Guarda los ajustes; Rust avisa del cambio con el evento `ajustes-cambiados`. */
export const guardarAjustesEnDisco = (ajustes: Ajustes) => invoke<void>("guardar_ajustes", { ajustes });

/** Llama a `alCambiar` cada vez que se guardan los ajustes. Devuelve la función para dejar de escuchar. */
export const escucharCambiosDeAjustes = (alCambiar: (ajustesNuevos: Ajustes) => void): Promise<UnlistenFn> =>
  listen<Ajustes>("ajustes-cambiados", (evento) => alCambiar(evento.payload));
