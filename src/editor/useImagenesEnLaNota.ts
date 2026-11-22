// Agregar imágenes a la nota visible, arrastrándolas o pegándolas:
//   · Arrastrar: Tauri recibe los archivos que se sueltan sobre la ventana (con sus rutas, que el
//     navegador no daría) y avisa con `onDragDropEvent`. Cada imagen de fuera del hormiguero se
//     copia a `Images/` junto a la nota; una que ya está en el hormiguero se enlaza donde está, sin
//     copiarla. Los enlaces van debajo de la línea donde se soltó. Soltar una nota (.md, .txt) la abre.
//   · Pegar (una captura, una imagen copiada): el editor pasa los archivos y se guardan en
//     `Images/` junto a la nota.
// La nota tiene que tener archivo (las rutas de sus imágenes son relativas a su carpeta).

import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { carpetaQueContieneA, estaDentroDe } from "../arbolDeCarpetas";
import { useTextos } from "../idioma";
import type { ControlDelEditor } from "./Editor";
import { enlaceDeImagen, esArchivoDeImagen, rutaRelativaDesde } from "./imagenesEnElTexto";

/** Extensiones de las notas que se abren al soltarlas sobre la ventana. */
const ES_ARCHIVO_DE_NOTA = /\.(md|markdown|txt)$/i;

interface Parametros {
  controlDelEditor: { current: ControlDelEditor | null };
  rutaDeLaNotaVisible: string | null;
  carpetaDelHormiguero: string | null;
  abrirNotaDeArchivo(rutaDelArchivo: string): Promise<void>;
  /** Corre una acción y muestra su error en la barra de estado si falla. */
  ejecutarMostrandoErrores(accion: Promise<unknown>): void;
}

/** Fecha y hora para el nombre de una imagen pegada: `2026-11-22 10.30.05`. */
function fechaParaElNombre(): string {
  const ahora = new Date();
  const dosCifras = (numero: number) => String(numero).padStart(2, "0");
  return `${ahora.getFullYear()}-${dosCifras(ahora.getMonth() + 1)}-${dosCifras(ahora.getDate())} ${dosCifras(ahora.getHours())}.${dosCifras(ahora.getMinutes())}.${dosCifras(ahora.getSeconds())}`;
}

export function useImagenesEnLaNota({ controlDelEditor, rutaDeLaNotaVisible, carpetaDelHormiguero, abrirNotaDeArchivo, ejecutarMostrandoErrores }: Parametros) {
  const textosDeLaInterfaz = useTextos();
  const vigentes = useRef({ rutaDeLaNotaVisible, carpetaDelHormiguero, abrirNotaDeArchivo, ejecutarMostrandoErrores, textosDeLaInterfaz });
  vigentes.current = { rutaDeLaNotaVisible, carpetaDelHormiguero, abrirNotaDeArchivo, ejecutarMostrandoErrores, textosDeLaInterfaz };

  /** Carpeta de la nota visible; falla con un aviso si la nota todavía no tiene archivo. */
  const carpetaDeLaNotaVisible = () => {
    const { rutaDeLaNotaVisible: rutaDeLaNota, textosDeLaInterfaz: textos } = vigentes.current;
    if (!rutaDeLaNota) throw new Error(textos.imagenSinArchivo);
    return carpetaQueContieneA(rutaDeLaNota);
  };

  /** Agrega imágenes que están en el disco (arrastradas), debajo de la línea donde se soltaron. */
  const agregarImagenesDelDisco = useCallback(async (rutasDeLasImagenes: string[], coordenadas: { x: number; y: number }) => {
    const carpetaDeLaNota = carpetaDeLaNotaVisible();
    const { carpetaDelHormiguero: hormiguero } = vigentes.current;
    const enlaces: string[] = [];
    for (const rutaDeLaImagen of rutasDeLasImagenes) {
      const yaEstaEnElHormiguero = hormiguero && estaDentroDe(rutaDeLaImagen, hormiguero);
      const rutaRelativa = yaEstaEnElHormiguero
        ? rutaRelativaDesde(carpetaDeLaNota, rutaDeLaImagen)
        : await invoke<string>("copiar_imagen_junto_a_la_nota", { rutaDeLaImagen, carpetaDeLaNota });
      enlaces.push(enlaceDeImagen(rutaRelativa));
    }
    controlDelEditor.current?.insertarEnLineaPropia(enlaces.join("\n"), coordenadas);
  }, [controlDelEditor]);

  // Archivos soltados sobre la ventana: imágenes a la nota visible, o abrir una nota.
  useEffect(() => {
    const dejarDeEscuchar = getCurrentWebview().onDragDropEvent(({ payload: eventoDeArrastre }) => {
      if (eventoDeArrastre.type !== "drop") return;
      const { ejecutarMostrandoErrores: ejecutar, abrirNotaDeArchivo: abrirNota } = vigentes.current;
      const imagenes = eventoDeArrastre.paths.filter(esArchivoDeImagen);
      const notas = eventoDeArrastre.paths.filter((ruta) => ES_ARCHIVO_DE_NOTA.test(ruta));
      // Tauri da la posición en píxeles físicos; el editor la quiere en los de la página.
      const escala = window.devicePixelRatio || 1;
      const coordenadas = { x: eventoDeArrastre.position.x / escala, y: eventoDeArrastre.position.y / escala };
      if (imagenes.length) ejecutar(agregarImagenesDelDisco(imagenes, coordenadas));
      else if (notas.length) ejecutar(abrirNota(notas[0]));
    });
    return () => void dejarDeEscuchar.then((dejar) => dejar());
  }, [agregarImagenesDelDisco]);

  /** Guarda imágenes pegadas en `Images/` junto a la nota y agrega sus enlaces debajo del cursor. */
  const pegarImagenes = useCallback((archivos: File[]) => {
    const guardarYEnlazar = async () => {
      const carpetaDeLaNota = carpetaDeLaNotaVisible();
      const enlaces: string[] = [];
      for (const archivo of archivos) {
        const extension = archivo.type.split("/")[1]?.replace("jpeg", "jpg").replace("svg+xml", "svg") || "png";
        // Las capturas llegan como «image.png»: se nombran con la fecha para no repetir.
        const nombreDelArchivo = archivo.name && archivo.name !== "image.png"
          ? archivo.name
          : `${vigentes.current.textosDeLaInterfaz.imagenPegada} ${fechaParaElNombre()}.${extension}`;
        const bytesDeLaImagen = new Uint8Array(await archivo.arrayBuffer());
        const rutaRelativa = await invoke<string>("guardar_imagen_pegada", bytesDeLaImagen, {
          headers: { carpeta: encodeURIComponent(carpetaDeLaNota), nombre: encodeURIComponent(nombreDelArchivo) },
        });
        enlaces.push(enlaceDeImagen(rutaRelativa));
      }
      controlDelEditor.current?.insertarEnLineaPropia(enlaces.join("\n"));
    };
    vigentes.current.ejecutarMostrandoErrores(guardarYEnlazar());
  }, [controlDelEditor]);

  return { pegarImagenes };
}
