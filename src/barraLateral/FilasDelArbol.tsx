// Filas de la barra lateral: una nota (con su `*` si espera guardarse, su × para cerrarla y, si es
// la visible, sus títulos debajo), una carpeta (con su flecha y su contenido si está desplegada) y
// el árbol de entradas, que se dibuja recursivamente saltándose lo fijado (ya está arriba).
// Leen lo compartido de `useBarraLateral()`.

import { useTextos } from "../idioma";
import type { EntradaDelArbol } from "../arbolDeCarpetas";
import { esperaQueLaGuarden, type NotaAbierta } from "../notasAbiertas/notaAbierta";
import { useBarraLateral } from "./contextoDeLaBarraLateral";
import { claveDeCapitulo } from "./clavesDeFijados";

/** Sangría en píxeles para un nivel de profundidad del árbol. */
export const sangriaEnPixeles = (nivelDeProfundidad: number) => 4 + nivelDeProfundidad * 12;

/** Nombre de una nota sin su extensión, para mostrarlo en la barra. */
export const nombreSinExtension = (nombreDelArchivo: string) => nombreDelArchivo.replace(/\.(md|markdown|txt)$/i, "");

/** Títulos de la nota visible, con el título donde está el cursor resaltado. */
function TitulosDeLaNotaVisible({ nivelDeProfundidad }: { nivelDeProfundidad: number }) {
  const barra = useBarraLateral();
  const rutaFijable = barra.rutaDeLaNotaVisibleQueSePuedeFijar;
  return (
    <>
      {barra.titulosDeLaNotaVisible.map((titulo, indice) => (
        <div
          key={`${titulo.posicion}-${titulo.texto}`}
          className={`barra-marcador${indice === barra.indiceDelTituloConElCursor ? " actual" : ""}`}
          style={{ paddingLeft: sangriaEnPixeles(nivelDeProfundidad) + (titulo.nivel - 1) * 10 }}
          onClick={() => barra.alSaltarATitulo(titulo.posicion)}
          // Clic derecho: fijar el título como capítulo (si la nota está en el hormiguero).
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
  /** La nota, si está abierta. */
  notaAbierta: NotaAbierta | undefined;
  alHacerClic(): void;
  /** Ruta con la que se puede fijar la nota (clic derecho); sin ella, la fila no tiene menú. */
  rutaParaFijar?: string;
}

/** Fila de una nota: su nombre y, si está abierta, el botón para cerrarla; si es la visible, sus títulos debajo. */
export function FilaDeNota({ nombreVisible, nivelDeProfundidad, notaAbierta, alHacerClic, rutaParaFijar }: PropsDeFilaDeNota) {
  const barra = useBarraLateral();
  const textosDeLaInterfaz = useTextos();
  const esLaNotaVisible = notaAbierta?.id === barra.idNotaVisible;
  return (
    <>
      <div
        className={`barra-nota${esLaNotaVisible ? " activa" : ""}${notaAbierta ? " abierta" : ""}`}
        style={{ paddingLeft: sangriaEnPixeles(nivelDeProfundidad) }}
        onClick={alHacerClic}
        onContextMenu={rutaParaFijar ? (evento) => barra.abrirMenuContextual(evento, barra.opcionesParaFijarOQuitar(rutaParaFijar)) : undefined}
      >
        <span className="barra-nombre">
          {nombreVisible}
          {notaAbierta && esperaQueLaGuarden(notaAbierta) && " *"}
        </span>
        {notaAbierta && (
          <button
            className="barra-cerrar"
            title={textosDeLaInterfaz.cerrarNota}
            // Detiene el clic para no mostrar la nota al mismo tiempo que se cierra.
            onClick={(evento) => {
              evento.stopPropagation();
              barra.alCerrarNota(notaAbierta.id);
            }}
          >
            ×
          </button>
        )}
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
        onContextMenu={(evento) => barra.abrirMenuContextual(evento, barra.opcionesParaFijarOQuitar(carpeta.ruta))}
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
              notaAbierta={barra.notasAbiertasPorRuta.get(entrada.ruta)}
              alHacerClic={() => barra.alAbrirNotaDeArchivo(entrada.ruta)}
              rutaParaFijar={entrada.ruta}
            />
          ),
        )}
    </>
  );
}
