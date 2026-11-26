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
   * Modo escritor (activo por defecto) y sus opciones, para las cámaras que todavía no eligieron
   * sus propias opciones del editor (ver `OpcionesDelEditor`).
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

/**
 * Opciones del editor de una cámara (Ajustes → Editor): cada cámara tiene las suyas, guardadas en
 * sus datos de `.ant/` (`hormigueros/datosDeLaCamara.ts`). Son independientes: una cámara puede
 * tener la tipografía del escritor y, a la vez, las ayudas para código del programador. Los
 * presets (`PRESETS_DEL_EDITOR`) solo las marcan de una vez.
 */
export interface OpcionesDelEditor extends OpcionesDelModoEscritor {
  // Vista del Markdown (`editor/vistaDelMarkdown.ts`): las marcas se esconden, salvo en la línea del cursor.
  /** Títulos sin `#`. */
  titulos_sin_almohadillas: boolean;
  /** Negrita, itálica y tachado sin `**`, `*`, `_` ni `~~`. */
  enfasis_sin_marcas: boolean;
  /** Código en línea sin las comillas invertidas, con un fondo. */
  codigo_en_linea_sin_marcas: boolean;
  /** Enlaces que muestran solo su texto. */
  enlaces_solo_texto: boolean;
  /** Citas con una línea a la izquierda en vez del `>`. */
  citas_con_linea: boolean;
  /** Viñetas `•` en las listas. */
  vinetas_en_listas: boolean;
  /** Casillas que se marcan con un clic en las tareas (`- [ ]`). */
  casillas_en_tareas: boolean;
  /** `---` como una línea a lo ancho. */
  separadores_como_linea: boolean;
  /** Mostrar las imágenes debajo de su línea (`editor/imagenes.ts`). */
  mostrar_imagenes: boolean;
  // Código (`editor/programador.ts`).
  /** Al escribir ``` y Enter, cerrar el bloque de código solo. */
  cerrar_bloques_de_codigo: boolean;
  /** Cerrar solos paréntesis, corchetes, llaves (y comillas, si no están las tipográficas). */
  cerrar_parentesis: boolean;
  /** Marcar el paréntesis que hace par con el que está junto al cursor. */
  marcar_el_par: boolean;
  /** Fondo en las líneas de los bloques de código. */
  fondo_en_bloques_de_codigo: boolean;
}

/** Presets del editor, en el orden en que se ofrecen (sus nombres en `idioma.tsx`). */
export type PresetDelEditor = "escritor" | "programador" | "simple";

/** Todo apagado: Markdown tal cual se escribe (el preset «Simple»), y la base de los demás. */
const OPCIONES_DEL_EDITOR_APAGADAS: OpcionesDelEditor = {
  comillas_tipograficas: false,
  estilo_de_comillas: "auto",
  rayas_de_dialogo: false,
  puntos_suspensivos: false,
  comillas_angulares: false,
  flechas: false,
  letra_de_libro: false,
  corrector_ortografico: false,
  titulos_sin_almohadillas: false,
  enfasis_sin_marcas: false,
  codigo_en_linea_sin_marcas: false,
  enlaces_solo_texto: false,
  citas_con_linea: false,
  vinetas_en_listas: false,
  casillas_en_tareas: false,
  separadores_como_linea: false,
  mostrar_imagenes: false,
  cerrar_bloques_de_codigo: false,
  cerrar_parentesis: false,
  marcar_el_par: false,
  fondo_en_bloques_de_codigo: false,
};

/** Toda la vista del Markdown activa: el texto se ve como queda, sin marcas. */
const VISTA_DEL_MARKDOWN_COMPLETA: Partial<OpcionesDelEditor> = {
  titulos_sin_almohadillas: true,
  enfasis_sin_marcas: true,
  codigo_en_linea_sin_marcas: true,
  enlaces_solo_texto: true,
  citas_con_linea: true,
  vinetas_en_listas: true,
  casillas_en_tareas: true,
  separadores_como_linea: true,
  mostrar_imagenes: true,
};

/**
 * Presets rápidos: «Escritor» (prosa: tipografía, letra de libro, corrector y el Markdown visto
 * como queda), «Programador» (código: bloques que se cierran solos, paréntesis, par marcado, fondo;
 * el Markdown a la vista, salvo imágenes y casillas) y «Simple» (nada: Markdown tal cual). Después
 * cada opción se puede cambiar por separado.
 */
export const PRESETS_DEL_EDITOR: Record<PresetDelEditor, OpcionesDelEditor> = {
  escritor: { ...OPCIONES_DEL_EDITOR_APAGADAS, ...OPCIONES_DEL_MODO_ESCRITOR_POR_DEFECTO, ...VISTA_DEL_MARKDOWN_COMPLETA },
  programador: {
    ...OPCIONES_DEL_EDITOR_APAGADAS,
    mostrar_imagenes: true,
    casillas_en_tareas: true,
    cerrar_bloques_de_codigo: true,
    cerrar_parentesis: true,
    marcar_el_par: true,
    fondo_en_bloques_de_codigo: true,
  },
  simple: OPCIONES_DEL_EDITOR_APAGADAS,
};

/** El preset que coincide con unas opciones (sin contar el estilo de comillas), o `null` si se personalizaron. */
export function presetQueCoincide(opciones: OpcionesDelEditor): PresetDelEditor | null {
  const claves = (Object.keys(OPCIONES_DEL_EDITOR_APAGADAS) as (keyof OpcionesDelEditor)[]).filter((clave) => clave !== "estilo_de_comillas");
  return (Object.keys(PRESETS_DEL_EDITOR) as PresetDelEditor[]).find((preset) => claves.every((clave) => PRESETS_DEL_EDITOR[preset][clave] === opciones[clave])) ?? null;
}

/** Si alguna opción de tipografía al escribir está activa. */
export const hayTipografiaActiva = (opciones: OpcionesDelEditor) =>
  opciones.comillas_tipograficas || opciones.rayas_de_dialogo || opciones.puntos_suspensivos || opciones.comillas_angulares || opciones.flechas;

/**
 * Opciones del editor de una cámara a partir de lo guardado en sus datos: las opciones (con las
 * que falten apagadas), o la forma de antes (`{ modo, opciones_del_modo_escritor }`), o, si no
 * guardó nada, las de los ajustes generales (`modo_escritor` y sus opciones).
 */
export function opcionesDelEditorDeLaCamara(
  guardadas: { opciones_del_editor?: Partial<OpcionesDelEditor> | null; editor?: { modo?: string; opciones_del_modo_escritor?: OpcionesDelModoEscritor } | null },
  ajustes: Pick<Ajustes, "modo_escritor" | "opciones_del_modo_escritor">,
): OpcionesDelEditor {
  // Lo que falta en lo guardado (opciones que se agregaron después) queda apagado, salvo las
  // imágenes, que antes se veían siempre.
  if (guardadas.opciones_del_editor) return { ...OPCIONES_DEL_EDITOR_APAGADAS, mostrar_imagenes: true, ...guardadas.opciones_del_editor };
  const anterior = guardadas.editor;
  if (anterior?.modo === "programador") return PRESETS_DEL_EDITOR.programador;
  if (anterior?.modo === "simple") return PRESETS_DEL_EDITOR.simple;
  if (anterior?.modo === "escritor") return { ...PRESETS_DEL_EDITOR.escritor, ...anterior.opciones_del_modo_escritor };
  return ajustes.modo_escritor ? { ...PRESETS_DEL_EDITOR.escritor, ...ajustes.opciones_del_modo_escritor } : PRESETS_DEL_EDITOR.simple;
}

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
