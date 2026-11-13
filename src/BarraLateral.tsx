// Barra lateral de la ventana principal, de arriba hacia abajo:
//   1. «Fijados»: notas y carpetas que el usuario fijó (clic derecho → Fijar arriba), al estilo
//      de las pestañas fijadas de Arc o Zen. Lo fijado deja de aparecer en el árbol de abajo.
//   2. «Abiertas»: notas abiertas que no están en la carpeta de trabajo (nuevas sin guardar o de
//      otro lugar).
//   3. La carpeta de trabajo (elegida en Ajustes) como árbol de subcarpetas y notas.
// Bajo la nota visible aparecen sus títulos (`#`, `##`, …) para saltar a ellos, como en Left.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Entrada, carpetasPadre, estaDentro } from "./carpeta";
import { Marcador, extraerMarcadores, marcadorActual } from "./marcadores";
import { MenuContextual } from "./MenuContextual";
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
  /** Rutas fijadas (de los ajustes); solo se muestran las que están dentro de la carpeta de trabajo. */
  fijados: string[];
  notas: NotaResumen[];
  activa: string;
  /** Posición del cursor en la nota activa. */
  cursor: number;
  onElegir(id: string): void;
  onAbrirRuta(ruta: string): void;
  onCerrar(id: string): void;
  onSaltar(pos: number): void;
  onAbrirAjustes(): void;
  onFijar(ruta: string): void;
  onDesfijar(ruta: string): void;
}

/** Sangría en píxeles para un nivel de profundidad del árbol. */
const sangria = (nivel: number) => 4 + nivel * 12;

/** Nombre de una nota sin su extensión, para mostrarlo en la barra. */
const sinExtension = (nombre: string) => nombre.replace(/\.(md|markdown|txt)$/i, "");

/** Busca una entrada del árbol por su ruta, en cualquier profundidad. */
function buscar(entradas: Entrada[], ruta: string): Entrada | undefined {
  for (const e of entradas) {
    if (e.ruta === ruta) return e;
    if (e.es_carpeta && estaDentro(ruta, e.ruta)) {
      const hallada = buscar(e.hijos, ruta);
      if (hallada) return hallada;
    }
  }
  return undefined;
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

export function BarraLateral(props: Props) {
  const { carpeta, arbol, fijados, notas, activa, cursor } = props;
  const notaActiva = notas.find((n) => n.id === activa);

  // Los títulos solo se recalculan cuando cambia el texto de la nota activa, no al mover el cursor.
  const textoActivo = notaActiva?.texto ?? "";
  const marcadores = useMemo(() => extraerMarcadores(textoActivo), [textoActivo]);
  const seleccionado = marcadorActual(marcadores, cursor);

  // Carpetas desplegadas (del árbol o fijadas). Al abrir una nota se despliegan las que la contienen.
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!carpeta || !notaActiva?.ruta) return;
    const padres = carpetasPadre(notaActiva.ruta, carpeta);
    setAbiertas((a) => (padres.every((p) => a.has(p)) ? a : new Set([...a, ...padres])));
  }, [carpeta, notaActiva?.ruta]);

  /** Despliega o pliega una carpeta. */
  const alternar = (ruta: string) =>
    setAbiertas((a) => {
      const nuevo = new Set(a);
      if (!nuevo.delete(ruta)) nuevo.add(ruta);
      return nuevo;
    });

  // Menú contextual abierto (posición y elemento sobre el que se hizo clic derecho), o null.
  const [menu, setMenu] = useState<{ x: number; y: number; ruta: string } | null>(null);
  const cerrarMenu = useCallback(() => setMenu(null), []);

  /** Abre el menú contextual de un elemento de la carpeta (solo esos se pueden fijar). */
  const alClicDerecho = (e: React.MouseEvent, ruta: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, ruta });
  };

  // Solo cuentan los fijados que están dentro de la carpeta actual: al cambiar de carpeta, cada
  // una muestra los suyos.
  const fijadosVisibles = carpeta ? fijados.filter((r) => estaDentro(r, carpeta)) : [];
  const conjuntoFijados = new Set(fijadosVisibles);

  const porRuta = new Map(notas.filter((n) => n.ruta).map((n) => [n.ruta!, n]));
  const sueltas = notas.filter((n) => !n.ruta || !carpeta || !estaDentro(n.ruta, carpeta));

  /** Fila de una nota: nombre, `*` si tiene cambios, botón para cerrarla si está abierta y sus títulos si es la visible. */
  function filaNota(nombre: string, nivel: number, nota: NotaResumen | undefined, alHacerClic: () => void, ruta?: string) {
    const esActiva = nota?.id === activa;
    return (
      <>
        <div
          className={`barra-nota${esActiva ? " activa" : ""}${nota ? " abierta" : ""}`}
          style={{ paddingLeft: sangria(nivel) }}
          onClick={alHacerClic}
          onContextMenu={ruta ? (e) => alClicDerecho(e, ruta) : undefined}
        >
          <span className="barra-nombre">
            {nombre}
            {nota?.sucio && " *"}
          </span>
          {nota && (
            // Detiene el clic para no activar la nota al mismo tiempo que se cierra.
            <button className="barra-cerrar" title="Cerrar nota" onClick={(e) => { e.stopPropagation(); props.onCerrar(nota.id); }}>
              ×
            </button>
          )}
        </div>
        {esActiva && <Marcadores marcadores={marcadores} seleccionado={seleccionado} nivelBase={nivel + 1} onSaltar={props.onSaltar} />}
      </>
    );
  }

  /** Fila de una carpeta con su flecha y, si está desplegada, su contenido. */
  function filaCarpeta(e: Entrada, nivel: number) {
    return (
      <div key={e.ruta}>
        <div className="barra-carpeta" style={{ paddingLeft: sangria(nivel) }} onClick={() => alternar(e.ruta)} onContextMenu={(ev) => alClicDerecho(ev, e.ruta)}>
          <span className="barra-flecha">{abiertas.has(e.ruta) ? "▾" : "▸"}</span>
          <span className="barra-nombre">{e.nombre}</span>
        </div>
        {abiertas.has(e.ruta) && dibujarArbol(e.hijos, nivel + 1)}
      </div>
    );
  }

  /** Dibuja recursivamente las entradas del árbol, saltándose las fijadas (ya están arriba). */
  function dibujarArbol(entradas: Entrada[], nivel: number): React.ReactNode {
    return entradas
      .filter((e) => !conjuntoFijados.has(e.ruta))
      .map((e) =>
        e.es_carpeta ? (
          filaCarpeta(e, nivel)
        ) : (
          <div key={e.ruta}>{filaNota(sinExtension(e.nombre), nivel, porRuta.get(e.ruta), () => props.onAbrirRuta(e.ruta), e.ruta)}</div>
        ),
      );
  }

  /** Dibuja un elemento fijado. Si ya no existe en la carpeta (se borró o movió), se muestra atenuado. */
  function dibujarFijado(ruta: string) {
    const entrada = buscar(arbol, ruta);
    if (entrada?.es_carpeta) return filaCarpeta(entrada, 0);
    if (entrada) return <div key={ruta}>{filaNota(sinExtension(entrada.nombre), 0, porRuta.get(ruta), () => props.onAbrirRuta(ruta), ruta)}</div>;
    return (
      <div key={ruta} className="barra-nota perdida" style={{ paddingLeft: sangria(0) }} title="Ya no está en la carpeta" onContextMenu={(e) => alClicDerecho(e, ruta)}>
        <span className="barra-nombre">{sinExtension(nombreArchivo(ruta))}</span>
      </div>
    );
  }

  return (
    <nav className="barra">
      {fijadosVisibles.length > 0 && (
        <section className="barra-seccion barra-fijados">
          <div className="barra-encabezado">Fijados</div>
          {fijadosVisibles.map(dibujarFijado)}
        </section>
      )}
      {sueltas.length > 0 && (
        <section className="barra-seccion">
          <div className="barra-encabezado">Abiertas</div>
          {sueltas.map((n) => (
            <div key={n.id}>{filaNota(n.ruta ? nombreArchivo(n.ruta) : "Sin título", 0, n, () => props.onElegir(n.id))}</div>
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
          <button className="barra-boton" onClick={props.onAbrirAjustes}>Abrir Ajustes</button>
        </section>
      )}
      {menu && (
        <MenuContextual
          x={menu.x}
          y={menu.y}
          onCerrar={cerrarMenu}
          opciones={
            conjuntoFijados.has(menu.ruta)
              ? [{ texto: "Quitar de fijados", accion: () => props.onDesfijar(menu.ruta) }]
              : [{ texto: "Fijar arriba", accion: () => props.onFijar(menu.ruta) }]
          }
        />
      )}
    </nav>
  );
}
