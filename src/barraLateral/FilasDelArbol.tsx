// Filas de la barra lateral: una nota (con su `*` si espera guardarse y, si es la visible, sus
// títulos debajo), una carpeta (con su flecha y su contenido si está desplegada) y
// el árbol de entradas, que se dibuja recursivamente saltándose lo fijado (ya está arriba).
// Leen lo compartido de `useBarraLateral()`.

import type { EntradaDelArbol } from "../arbolDeCarpetas";
import { esperaQueLaGuarden } from "../notasAbiertas/notaAbierta";
import { useBarraLateral } from "./contextoDeLaBarraLateral";
import { claveDeCapitulo } from "./clavesDeFijados";

/** Sangría en píxeles para un nivel de profundidad del árbol. */
export const sangriaEnPixeles = (nivelDeProfundidad: number) => 4 + nivelDeProfundidad * 12;

/** Nombre de una nota sin su extensión, para mostrarlo en la barra. */
export const nombreSinExtension = (nombreDelArchivo: string) => nombreDelArchivo.replace(/\.(md|markdown|txt)$/i, "");

/** Títulos de la nota visible, con el título donde está el cursor resaltado. */
function TitulosDeLaNotaVisible({ nivelDeProfundidad }: { nivelDeProfundidad: number }) {
  const barra = useBarraLateral();
  const rutaFijable = barra.rutaDeLaNotaVisible;
  return (
    <>
      {barra.titulosDeLaNotaVisible.map((titulo, indice) => (
        <div
          key={`${titulo.posicion}-${titulo.texto}`}
          className={`barra-marcador${indice === barra.indiceDelTituloConElCursor ? " actual" : ""}`}
          style={{ paddingLeft: sangriaEnPixeles(nivelDeProfundidad) + (titulo.nivel - 1) * 10 }}
          onClick={() => barra.alSaltarATitulo(titulo.posicion)}
          // Clic derecho: fijar el título como capítulo (si la nota está en la cámara).
          onContextMenu={
            rutaFijable
              ? (evento) => barra.abrirMenuContextual(evento, barra.opcionesParaFijarOQuitar(claveDeCapitulo(rutaFijable, titulo.texto)))
              : undefined
          }
        >
          {titulo.texto}
        </div>
      ))}
    </>
  );
}

interface PropsDeFilaDeNota {
  nombreVisible: string;
  nivelDeProfundidad: number;
  rutaDelArchivo: string;
  alHacerClic(): void;
  /** El calendario no ofrece el menú contextual que tienen las filas del árbol. */
  tieneMenuContextual?: boolean;
}

/** Fila de una nota: muestra sus títulos debajo solo si es la nota visible. */
export function FilaDeNota({ nombreVisible, nivelDeProfundidad, rutaDelArchivo, alHacerClic, tieneMenuContextual = false }: PropsDeFilaDeNota) {
  const barra = useBarraLateral();
  const esLaNotaVisible = rutaDelArchivo === barra.rutaDeLaNotaVisible;
  return (
    <>
      <div
        className={`barra-nota${esLaNotaVisible ? " activa" : ""}`}
        style={{ paddingLeft: sangriaEnPixeles(nivelDeProfundidad) }}
        onClick={alHacerClic}
        onContextMenu={tieneMenuContextual ? (evento) => barra.abrirMenuContextual(evento, barra.opcionesDeUnaEntrada(rutaDelArchivo, false)) : undefined}
      >
        <span className="barra-nombre">
          {nombreVisible}
          {esLaNotaVisible && barra.notaVisible && esperaQueLaGuarden(barra.notaVisible) && " *"}
        </span>
      </div>
      {esLaNotaVisible && <TitulosDeLaNotaVisible nivelDeProfundidad={nivelDeProfundidad + 1} />}
    </>
  );
}

/** Fila de una carpeta con su flecha y, si está desplegada, su contenido. */
function FilaDeCarpeta({ carpeta, nivelDeProfundidad }: { carpeta: EntradaDelArbol; nivelDeProfundidad: number }) {
  const barra = useBarraLateral();
  const estaDesplegada = barra.carpetasDesplegadas.has(carpeta.ruta);
  return (
    <div>
      <div
        className="barra-carpeta"
        style={{ paddingLeft: sangriaEnPixeles(nivelDeProfundidad) }}
        onClick={() => barra.desplegarOPlegarCarpeta(carpeta.ruta)}
        onContextMenu={(evento) => barra.abrirMenuContextual(evento, barra.opcionesDeUnaEntrada(carpeta.ruta, true))}
      >
        <span className="barra-flecha">{estaDesplegada ? "▾" : "▸"}</span>
        <span className="barra-nombre">{carpeta.nombre}</span>
      </div>
      {estaDesplegada && <EntradasDelArbol entradas={carpeta.hijos} nivelDeProfundidad={nivelDeProfundidad + 1} />}
    </div>
  );
}

/** Dibuja las entradas del árbol (carpetas y notas), saltándose las fijadas (ya están arriba). */
export function EntradasDelArbol({ entradas, nivelDeProfundidad }: { entradas: EntradaDelArbol[]; nivelDeProfundidad: number }) {
  const barra = useBarraLateral();
  return (
    <>
      {entradas
        .filter((entrada) => !barra.clavesFijadasVisibles.has(entrada.ruta))
        .map((entrada) =>
          entrada.esCarpeta ? (
            <FilaDeCarpeta key={entrada.ruta} carpeta={entrada} nivelDeProfundidad={nivelDeProfundidad} />
          ) : (
            <FilaDeNota
              key={entrada.ruta}
              nombreVisible={nombreSinExtension(entrada.nombre)}
              nivelDeProfundidad={nivelDeProfundidad}
              rutaDelArchivo={entrada.ruta}
              alHacerClic={() => barra.alAbrirNotaDeArchivo(entrada.ruta)}
              tieneMenuContextual
            />
          ),
        )}
    </>
  );
}
