// Imágenes dentro del editor: cada imagen escrita en la nota (`![…](…)` o `![[…]]`, ver
// `imagenesEnElTexto.ts`) se muestra debajo de su línea, sin esconder el Markdown (como el resto
// de la nota, que se ve tal cual se escribe).
//
// Las rutas relativas se resuelven desde la carpeta de la nota visible, que el editor conoce por
// `cambiarLugarDeLaNota` (también el hormiguero, para buscar las de Obsidian por nombre). Los
// archivos se leen con el protocolo `asset:` de Tauri, que solo deja leer las carpetas permitidas:
// antes de mostrar una imagen se permite su carpeta (`permitir_mostrar_imagenes_de`). Una imagen de
// una cámara cifrada no se puede leer así: se piden sus bytes descifrados a Rust y se muestra
// desde la memoria (una dirección `blob:`, que se libera al quitar la imagen).
//
// Rendimiento: las imágenes se buscan en toda la nota solo al abrirla; al escribir, solo se
// vuelven a buscar en las líneas que cambiaron (las demás decoraciones se corren con el cambio).

import { EditorState, Range, StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { carpetaQueContieneA } from "../arbolDeCarpetas";
import { esDireccionWeb, imagenesDeLaLinea, rutaCompletaDeLaImagen } from "./imagenesEnElTexto";

/** Dónde está la nota visible: su archivo (o `null` si no tiene) y el hormiguero. */
export interface LugarDeLaNota {
  rutaDeLaNota: string | null;
  carpetaDelHormiguero: string | null;
}

/** Efecto para avisar al editor dónde está la nota visible (al abrirla o al guardarla con otro nombre). */
export const cambiarLugarDeLaNota = StateEffect.define<LugarDeLaNota>();

/** Dónde está la nota de este estado del editor. */
const lugarDeLaNota = StateField.define<LugarDeLaNota>({
  create: () => ({ rutaDeLaNota: null, carpetaDelHormiguero: null }),
  update(lugar, transaccion) {
    for (const efecto of transaccion.effects) if (efecto.is(cambiarLugarDeLaNota)) lugar = efecto.value;
    return lugar;
  },
});

// Carpetas ya permitidas para el protocolo `asset:` y búsquedas de Obsidian ya hechas, para no
// repetir llamadas a Rust cada vez que una imagen se vuelve a dibujar.
const carpetasPermitidas = new Map<string, Promise<void>>();
const imagenesDeObsidianEncontradas = new Map<string, string>();

/** Permite (una vez) que la ventana lea las imágenes de una carpeta. */
function permitirCarpeta(carpeta: string): Promise<void> {
  let permiso = carpetasPermitidas.get(carpeta);
  if (!permiso) {
    permiso = invoke<void>("permitir_mostrar_imagenes_de", { carpeta });
    carpetasPermitidas.set(carpeta, permiso);
    permiso.catch(() => carpetasPermitidas.delete(carpeta));
  }
  return permiso;
}

/**
 * Dirección con que la ventana puede mostrar una imagen, o `null` si no se encuentra (una ruta
 * relativa en una nota sin archivo, o un nombre de Obsidian que no está en el hormiguero).
 */
async function direccionDeLaImagen(imagen: ImagenDeLaNota): Promise<string | null> {
  if (esDireccionWeb(imagen.destino)) return imagen.destino;
  if (!imagen.carpetaDeLaNota) return null;
  let rutaDelArchivo: string | null;
  if (imagen.esDeObsidian) {
    const claveDeLaBusqueda = `${imagen.carpetaDelHormiguero}\n${imagen.carpetaDeLaNota}\n${imagen.destino}`;
    rutaDelArchivo = imagenesDeObsidianEncontradas.get(claveDeLaBusqueda) ?? null;
    if (!rutaDelArchivo) {
      rutaDelArchivo = await invoke<string | null>("buscar_imagen_en_el_hormiguero", {
        nombre: imagen.destino,
        carpetaDeLaNota: imagen.carpetaDeLaNota,
        hormiguero: imagen.carpetaDelHormiguero,
      });
      // Solo se recuerda lo encontrado: si falta, se vuelve a buscar (quizás se agregó después).
      if (rutaDelArchivo) imagenesDeObsidianEncontradas.set(claveDeLaBusqueda, rutaDelArchivo);
    }
  } else {
    rutaDelArchivo = rutaCompletaDeLaImagen(imagen.destino, imagen.carpetaDeLaNota);
  }
  if (!rutaDelArchivo) return null;
  if (await invoke<boolean>("es_imagen_cifrada", { ruta: rutaDelArchivo })) {
    const bytesDeLaImagen = await invoke<ArrayBuffer>("leer_imagen_cifrada", { ruta: rutaDelArchivo });
    return URL.createObjectURL(new Blob([bytesDeLaImagen], { type: tipoDeImagen(rutaDelArchivo) }));
  }
  await permitirCarpeta(carpetaQueContieneA(rutaDelArchivo));
  return convertFileSrc(rutaDelArchivo);
}

/** Tipo de una imagen por su extensión (para mostrar bien las SVG desde la memoria). */
function tipoDeImagen(ruta: string): string {
  const extension = ruta.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "svg") return "image/svg+xml";
  if (extension === "jpg") return "image/jpeg";
  return `image/${extension}`;
}

/** La imagen que se dibuja debajo de su línea. */
class ImagenDeLaNota extends WidgetType {
  constructor(
    readonly destino: string,
    readonly esDeObsidian: boolean,
    readonly carpetaDeLaNota: string | null,
    readonly carpetaDelHormiguero: string | null,
  ) {
    super();
  }

  /** Dos imágenes iguales no se vuelven a dibujar (así no parpadean al escribir en otra línea). */
  eq(otra: ImagenDeLaNota) {
    return otra.destino === this.destino && otra.esDeObsidian === this.esDeObsidian && otra.carpetaDeLaNota === this.carpetaDeLaNota && otra.carpetaDelHormiguero === this.carpetaDelHormiguero;
  }

  toDOM(vista: EditorView) {
    const contenedor = document.createElement("div");
    contenedor.className = "cm-imagen";
    /** Si no se encuentra o no se puede leer, muestra su nombre tenue en lugar de la imagen. */
    const mostrarQueNoSeEncontro = () => {
      contenedor.className = "cm-imagen no-encontrada";
      contenedor.textContent = `⚠ ${this.destino}`;
      vista.requestMeasure();
    };
    const imagen = document.createElement("img");
    imagen.alt = "";
    imagen.draggable = false;
    // Al cargar cambia el alto de la línea: CodeMirror tiene que volver a medir.
    imagen.onload = () => vista.requestMeasure();
    imagen.onerror = mostrarQueNoSeEncontro;
    contenedor.append(imagen);
    direccionDeLaImagen(this).then((direccion) => (direccion ? (imagen.src = direccion) : mostrarQueNoSeEncontro()), mostrarQueNoSeEncontro);
    return contenedor;
  }

  /** Al quitar la imagen se libera su copia en memoria, si venía de una cámara cifrada. */
  destroy(contenedor: HTMLElement) {
    const direccion = contenedor.querySelector("img")?.src;
    if (direccion?.startsWith("blob:")) URL.revokeObjectURL(direccion);
  }

  /** Los clics en la imagen llegan al editor (llevan el cursor a esa línea). */
  ignoreEvent() {
    return false;
  }
}

/** Decoraciones de las imágenes de las líneas `primeraLinea`…`ultimaLinea` (numeradas desde 1). */
function decoracionesDeLasLineas(estado: EditorState, primeraLinea: number, ultimaLinea: number): Range<Decoration>[] {
  const { rutaDeLaNota, carpetaDelHormiguero } = estado.field(lugarDeLaNota);
  const carpetaDeLaNota = rutaDeLaNota ? carpetaQueContieneA(rutaDeLaNota) : null;
  const decoraciones: Range<Decoration>[] = [];
  for (let numeroDeLinea = primeraLinea; numeroDeLinea <= ultimaLinea; numeroDeLinea++) {
    const linea = estado.doc.line(numeroDeLinea);
    for (const imagen of imagenesDeLaLinea(linea.text)) {
      const widget = new ImagenDeLaNota(imagen.destino, imagen.esDeObsidian, carpetaDeLaNota, carpetaDelHormiguero);
      decoraciones.push(Decoration.widget({ widget, block: true, side: 1 }).range(linea.to));
    }
  }
  return decoraciones;
}

/** Todas las imágenes de la nota (al abrirla o al cambiar dónde está). */
const decoracionesDeTodaLaNota = (estado: EditorState) => Decoration.set(decoracionesDeLasLineas(estado, 1, estado.doc.lines));

/** Imágenes de la nota, al día con cada cambio (revisando solo las líneas que cambiaron). */
const imagenesDeLaNota = StateField.define<DecorationSet>({
  create: decoracionesDeTodaLaNota,
  update(decoraciones, transaccion) {
    if (transaccion.effects.some((efecto) => efecto.is(cambiarLugarDeLaNota))) return decoracionesDeTodaLaNota(transaccion.state);
    if (!transaccion.docChanged) return decoraciones;
    let decoracionesAlDia = decoraciones.map(transaccion.changes);
    const documento = transaccion.state.doc;
    transaccion.changes.iterChangedRanges((_desdeAntes, _hastaAntes, desde, hasta) => {
      const primeraLinea = documento.lineAt(desde);
      const ultimaLinea = documento.lineAt(hasta);
      decoracionesAlDia = decoracionesAlDia.update({
        filterFrom: primeraLinea.from,
        filterTo: ultimaLinea.to,
        filter: (desdeLaDecoracion) => desdeLaDecoracion < primeraLinea.from || desdeLaDecoracion > ultimaLinea.to,
        add: decoracionesDeLasLineas(transaccion.state, primeraLinea.number, ultimaLinea.number),
      });
    });
    return decoracionesAlDia;
  },
  provide: (campo) => EditorView.decorations.from(campo),
});

/** Extensiones de las imágenes para el editor. */
export const extensionesDeImagenes = [lugarDeLaNota, imagenesDeLaNota];
