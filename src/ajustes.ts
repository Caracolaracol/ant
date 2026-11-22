// Formato de los ajustes de la app (lo que es de este computador; lo que es de cada cámara va en
// `.ant/` del hormiguero, ver `hormigueros/datosDeLaCamara.ts`) y cómo leerlos, guardarlos y enterarse cuando cambian. Los
// guarda y lee Rust (`src-tauri/src/ajustes.rs`) en `ajustes.json`, y avisa a la interfaz con el
// evento `ajustes-cambiados`. Los nombres de los campos son los del archivo: si se cambia uno, Rust
// tiene que seguir leyendo el nombre anterior (`#[serde(alias = …)]`).

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Idioma } from "./idioma";
import type { EstiloDelLibro, TamanoDePagina } from "./compilar/formato.ts";
import type { OrigenDelTituloDeCadaCapitulo } from "./compilar/modelo.ts";

/** Preferencias del usuario. Debe coincidir con la estructura `Ajustes` de Rust. */
export interface Ajustes {
  /** El hormiguero: la carpeta con todas las notas del usuario, o `null` si todavía no lo eligió. */
  hormiguero: string | null;
  /**
   * Cámara abierta: el nombre de una carpeta de primer nivel del hormiguero (un contexto: notas
   * personales, una novela, el trabajo), o `null`. La barra lateral muestra su contenido.
   */
  camara_abierta: string | null;
  /** Ruta de la última nota abierta: al volver a entrar se abre esa (`null`: arranca sin notas). */
  ultima_nota_abierta: string | null;
  /**
   * De antes: fijados con rutas completas. Ahora van en `.ant/` de cada cámara
   * (`hormigueros/datosDeLaCamara.ts`); al abrir una cámara se pasan allá los suyos y se quitan de aquí.
   */
  fijados: string[];
  /** De antes (ahora en `.ant/`): icono elegido para cada fijado, por su clave en `fijados`. */
  iconos_de_fijados: Record<string, string>;
  /** Modo diario: calendario en la barra lateral; cada día abre o crea `Daily/AAAA-MM-DD.md`. */
  modo_diario: boolean;
  /** Colores que eligió el usuario, por nombre de variable CSS sin `--` (ver `colores.ts`). */
  colores_elegidos: Record<string, string>;
  /** Ancho de la barra lateral en píxeles, o `null` para el de por defecto. */
  ancho_de_la_barra_lateral: number | null;
  /** Idioma de la interfaz: inglés (por defecto) o español. */
  idioma: Idioma;
  /**
   * Modo escritor (activo por defecto) y sus opciones, para las cámaras que todavía no eligieron su
   * propia configuración del editor (ver `ConfiguracionDelEditor`).
   */
  modo_escritor: boolean;
  /** Opciones del modo escritor de esas cámaras (ver `editor/escritor.ts`). */
  opciones_del_modo_escritor: OpcionesDelModoEscritor;
  /** Nombre del autor para las portadas de «Compilar y exportar». */
  nombre_del_autor: string;
  /** De antes (ahora en `.ant/`): opciones de «Compilar y exportar» de cada carpeta, por su ruta. */
  opciones_de_compilacion_por_carpeta: Record<string, OpcionesDeCompilacion>;
  /**
   * Atajos de teclado que el usuario cambió (Ajustes → Atajos), por id de acción (`atajos.ts`),
   * como `CmdOrCtrl+Shift+KeyN`. Las acciones que no están aquí usan su atajo por defecto.
   */
  atajos_de_teclado: Record<string, string>;
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

/**
 * Modo del editor de una cámara: «escritor» (prosa: tipografía, letra de libro, títulos sin `#`),
 * «programador» (código: bloques de código cómodos, paréntesis que se cierran solos) o «simple»
 * (Markdown tal cual, sin nada más).
 */
export type ModoDelEditor = "escritor" | "programador" | "simple";

/**
 * Configuración del editor de una cámara (Ajustes → Editor): cada cámara tiene la suya, guardada
 * en sus datos de `.ant/` (`hormigueros/datosDeLaCamara.ts`). Una cámara que todavía no la tiene
 * usa la de `modo_escritor` y `opciones_del_modo_escritor` de los ajustes.
 */
export interface ConfiguracionDelEditor {
  modo: ModoDelEditor;
  opciones_del_modo_escritor: OpcionesDelModoEscritor;
}

/** Configuración del editor de una cámara que todavía no eligió la suya: la de los ajustes generales. */
export const configuracionDelEditorPorDefecto = (ajustes: Ajustes): ConfiguracionDelEditor => ({
  modo: ajustes.modo_escritor ? "escritor" : "simple",
  opciones_del_modo_escritor: ajustes.opciones_del_modo_escritor,
});

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
  hormiguero: null,
  camara_abierta: null,
  ultima_nota_abierta: null,
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
  atajos_de_teclado: {},
};

/** Lee los ajustes guardados (o los valores por defecto si no hay). */
export const leerAjustesGuardados = () => invoke<Ajustes>("leer_ajustes");

/** Guarda los ajustes; Rust avisa del cambio con el evento `ajustes-cambiados`. */
export const guardarAjustesEnDisco = (ajustes: Ajustes) => invoke<void>("guardar_ajustes", { ajustes });

/** Llama a `alCambiar` cada vez que se guardan los ajustes. Devuelve la función para dejar de escuchar. */
export const escucharCambiosDeAjustes = (alCambiar: (ajustesNuevos: Ajustes) => void): Promise<UnlistenFn> =>
  listen<Ajustes>("ajustes-cambiados", (evento) => alCambiar(evento.payload));
