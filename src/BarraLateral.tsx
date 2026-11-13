// Barra lateral de la ventana principal: muestra la carpeta de trabajo (elegida en Ajustes) como
// árbol de subcarpetas y notas. Bajo la nota visible aparecen sus títulos (`#`, `##`, …) para
// saltar a ellos, como en Left. Las notas abiertas que no están en la carpeta (nuevas sin
// guardar o de otro lugar) se listan arriba, en «Abiertas».

import { useEffect, useMemo, useState } from "react";
import { Entrada, carpetasPadre, estaDentro } from "./carpeta";
import { Marcador, extraerMarcadores, marcadorActual } from "./marcadores";
import { nombreArchivo } from "./notas";

/** Lo que la barra necesita saber de cada nota abierta. */
export interface NotaResumen {
  id: string;
  ruta: string | null;
  texto: string;
  sucio: boolean;
}

interface Props {
  carpeta: string | null;
  arbol: Entrada[];
  notas: NotaResumen[];
  activa: string;
  /** Posición del cursor en la nota activa. */
  cursor: number;
  onElegir(id: string): void;
  onAbrirRuta(ruta: string): void;
  onCerrar(id: string): void;
  onSaltar(pos: number): void;
  onAbrirAjustes(): void;
}

/** Títulos de la nota activa, con el título donde está el cursor resaltado. */
function Marcadores({ marcadores, seleccionado, nivelBase, onSaltar }: {
  marcadores: Marcador[];
  seleccionado: number;
  nivelBase: number;
  onSaltar(pos: number): void;
}) {
  return (
    <>
      {marcadores.map((m, i) => (
        <div
          key={`${m.pos}-${m.texto}`}
          className={`barra-marcador${i === seleccionado ? " actual" : ""}`}
          style={{ paddingLeft: sangria(nivelBase) + (m.nivel - 1) * 10 }}
          onClick={() => onSaltar(m.pos)}
        >
          {m.texto}
        </div>
      ))}
    </>
  );
}

/** Sangría en píxeles para un nivel de profundidad del árbol. */
const sangria = (nivel: number) => 4 + nivel * 12;

export function BarraLateral(props: Props) {
  const { carpeta, arbol, notas, activa, cursor, onElegir, onAbrirRuta, onCerrar, onSaltar, onAbrirAjustes } = props;
  const notaActiva = notas.find((n) => n.id === activa);

  // Los títulos solo se recalculan cuando cambia el texto de la nota activa, no al mover el cursor.
  const textoActivo = notaActiva?.texto ?? "";
  const marcadores = useMemo(() => extraerMarcadores(textoActivo), [textoActivo]);
  const seleccionado = marcadorActual(marcadores, cursor);

  // Carpetas desplegadas del árbol. Al abrir una nota se despliegan las carpetas que la contienen.
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!carpeta || !notaActiva?.ruta) return;
    const padres = carpetasPadre(notaActiva.ruta, carpeta);
    setAbiertas((a) => (padres.every((p) => a.has(p)) ? a : new Set([...a, ...padres])));
  }, [carpeta, notaActiva?.ruta]);

  /** Despliega o pliega una carpeta del árbol. */
  const alternar = (ruta: string) =>
    setAbiertas((a) => {
      const nuevo = new Set(a);
      if (!nuevo.delete(ruta)) nuevo.add(ruta);
      return nuevo;
    });

  const porRuta = new Map(notas.filter((n) => n.ruta).map((n) => [n.ruta!, n]));
  const sueltas = notas.filter((n) => !n.ruta || !carpeta || !estaDentro(n.ruta, carpeta));

  /** Fila de una nota (abierta o no): nombre, `*` si tiene cambios y botón para cerrarla si está abierta. */
  function filaNota(nombre: string, nivel: number, nota: NotaResumen | undefined, alHacerClic: () => void) {
    const esActiva = nota?.id === activa;
    return (
      <>
        <div
          className={`barra-nota${esActiva ? " activa" : ""}${nota ? " abierta" : ""}`}
          style={{ paddingLeft: sangria(nivel) }}
          onClick={alHacerClic}
        >
          <span className="barra-nombre">
            {nombre}
            {nota?.sucio && " *"}
          </span>
          {nota && (
            // Detiene el clic para no activar la nota al mismo tiempo que se cierra.
            <button className="barra-cerrar" title="Cerrar nota" onClick={(e) => { e.stopPropagation(); onCerrar(nota.id); }}>
              ×
            </button>
          )}
        </div>
        {esActiva && <Marcadores marcadores={marcadores} seleccionado={seleccionado} nivelBase={nivel + 1} onSaltar={onSaltar} />}
      </>
    );
  }

  /** Dibuja recursivamente las entradas del árbol de la carpeta. */
  function dibujarArbol(entradas: Entrada[], nivel: number) {
    return entradas.map((e) =>
      e.es_carpeta ? (
        <div key={e.ruta}>
          <div className="barra-carpeta" style={{ paddingLeft: sangria(nivel) }} onClick={() => alternar(e.ruta)}>
            <span className="barra-flecha">{abiertas.has(e.ruta) ? "▾" : "▸"}</span>
            <span className="barra-nombre">{e.nombre}</span>
          </div>
          {abiertas.has(e.ruta) && dibujarArbol(e.hijos, nivel + 1)}
        </div>
      ) : (
        <div key={e.ruta}>
          {filaNota(e.nombre.replace(/\.(md|markdown|txt)$/i, ""), nivel, porRuta.get(e.ruta), () => onAbrirRuta(e.ruta))}
        </div>
      ),
    );
  }

  return (
    <nav className="barra">
      {sueltas.length > 0 && (
        <section className="barra-seccion">
          <div className="barra-encabezado">Abiertas</div>
          {sueltas.map((n) => (
            <div key={n.id}>{filaNota(n.ruta ? nombreArchivo(n.ruta) : "Sin título", 0, n, () => onElegir(n.id))}</div>
          ))}
        </section>
      )}
      {carpeta ? (
        <section className="barra-seccion">
          <div className="barra-encabezado" title={carpeta}>{nombreArchivo(carpeta)}</div>
          {arbol.length ? dibujarArbol(arbol, 0) : <div className="barra-vacia">No hay notas en esta carpeta.</div>}
        </section>
      ) : (
        <section className="barra-seccion">
          <div className="barra-vacia">Elige la carpeta donde vas a trabajar.</div>
          <button className="barra-boton" onClick={onAbrirAjustes}>Abrir Ajustes</button>
        </section>
      )}
    </nav>
  );
}
