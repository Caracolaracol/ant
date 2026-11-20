// Barra lateral de la ventana principal, de arriba hacia abajo (simple a propósito: cambiar de
// hormiguero o cavar uno nuevo se hace en Ajustes o en el menú, no aquí):
//   2. Fijados: carpetas, notas y capítulos que el usuario fijó (clic derecho → Fijar arriba), como
//      las pestañas fijadas de Zen o Arc: una grilla de iconos sin texto, con el nombre en un
//      globo al pasar el mouse. Cada uno tiene el icono de su tipo hasta que se elige otro (clic
//      derecho → Cambiar icono…). Una carpeta fijada se despliega bajo la grilla; un capítulo
//      abre su nota en ese título. Lo fijado deja de aparecer en el árbol de abajo.
//   3. «Abiertas»: notas abiertas que no están en el hormiguero (nuevas sin guardar, ya con
//      algo escrito, o de otro lugar).
//   4. El hormiguero abierto, con su nombre, como árbol de subcarpetas y notas.
//   5. Pegado al fondo (fuera del scroll), el calendario del modo diario si está activo en Ajustes
//      (ver `Calendario.tsx`), con la nota diaria abierta encima. En ese modo la carpeta `Daily`
//      no aparece en el árbol: a las notas diarias se llega desde el calendario.
// Bajo la nota visible aparecen sus títulos (`#`, `##`, …) para saltar a ellos, como en Left.
// El borde derecho no se ve, pero al pasar el mouse el puntero cambia a ↔ y arrastrándolo se
// ensancha o achica la barra (doble clic vuelve al ancho por defecto).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendario } from "./Calendario";
import { Entrada, carpetasPadre, estaDentro } from "./carpeta";
import { diaDeRuta, diasConNota, entradaDiario, rutaDiario } from "./diario";
import { ElegirIcono } from "./ElegirIcono";
import { Fijado, ICONO_POR_DEFECTO, claveCapitulo, leerFijado } from "./fijados";
import { useGlobo } from "./Globo";
import { Icono } from "./Icono";
import { useTextos } from "./idioma";
import { Marcador } from "./marcadores";
import { MenuContextual, OpcionMenu } from "./MenuContextual";
import { nombreArchivo } from "./notas";

/** Lo que la barra necesita saber de cada nota abierta. */
export interface NotaResumen {
  id: string;
  ruta: string | null;
  texto: string;
  sucio: boolean;
}

interface Props {
  /** Hormiguero abierto, o `null` si no hay ninguno. */
  carpeta: string | null;
  arbol: Entrada[];
  /** Claves fijadas (de los ajustes); solo se muestran las que están dentro del hormiguero abierto. */
  fijados: string[];
  /** Icono elegido para cada fijado, por su clave. */
  iconos: Record<string, string>;
  /** Si el modo diario está activo (muestra el calendario). */
  diario: boolean;
  notas: NotaResumen[];
  activa: string;
  /** Títulos de la nota activa (los calcula App, solo cuando cambia el texto). */
  marcadores: Marcador[];
  /** Índice del título donde está el cursor, o -1. */
  tituloActual: number;
  onElegir(id: string): void;
  onAbrirRuta(ruta: string): void;
  /** Abre una nota y lleva el cursor a su título `titulo` (un capítulo fijado). */
  onAbrirCapitulo(ruta: string, titulo: string): void;
  onCerrar(id: string): void;
  onSaltar(pos: number): void;
  onFijar(clave: string): void;
  onDesfijar(clave: string): void;
  /** Cambia el icono de un fijado (`null` vuelve al de por defecto). */
  onCambiarIcono(clave: string, icono: string | null): void;
  /** Abre (o crea) la nota diaria de `fecha`. */
  onAbrirDia(fecha: Date): void;
  /** Ancho de la barra en píxeles. */
  ancho: number;
  /** Se llama al soltar el borde tras arrastrarlo, con el ancho nuevo (o `null` para el de por defecto). */
  onCambiarAncho(ancho: number | null): void;
}

/** Ancho de la barra por defecto y sus límites al arrastrar el borde. */
export const ANCHO_BARRA = 200;
const ANCHO_MIN = 140;
const ANCHO_MAX = 520;

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
function Marcadores({ marcadores, seleccionado, nivelBase, onSaltar, onClicDerecho }: {
  marcadores: Marcador[];
  seleccionado: number;
  nivelBase: number;
  onSaltar(pos: number): void;
  /** Clic derecho en un título (para fijarlo como capítulo), si la nota se puede fijar. */
  onClicDerecho?(e: React.MouseEvent, m: Marcador): void;
}) {
  return (
    <>
      {marcadores.map((m, i) => (
        <div
          key={`${m.pos}-${m.texto}`}
          className={`barra-marcador${i === seleccionado ? " actual" : ""}`}
          style={{ paddingLeft: sangria(nivelBase) + (m.nivel - 1) * 10 }}
          onClick={() => onSaltar(m.pos)}
          onContextMenu={onClicDerecho && ((e) => onClicDerecho(e, m))}
        >
          {m.texto}
        </div>
      ))}
    </>
  );
}

export function BarraLateral(props: Props) {
  const { carpeta, arbol, fijados, notas, activa, marcadores, tituloActual: seleccionado } = props;
  const tx = useTextos();
  const notaActiva = notas.find((n) => n.id === activa);
  const globo = useGlobo();

  // Arrastre del borde derecho. Mientras se arrastra, el ancho se cambia directo en el DOM (sin
  // pasar por React, para no volver a dibujar la ventana en cada movimiento del mouse); al soltar
  // se avisa a App, que lo guarda en los ajustes.
  const barra = useRef<HTMLElement>(null);
  const alEmpezarArrastre = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !barra.current) return;
    e.preventDefault();
    const tirador = e.currentTarget;
    tirador.setPointerCapture(e.pointerId);
    const inicioX = e.clientX;
    const inicioAncho = barra.current.offsetWidth;
    let ancho = inicioAncho;
    // El puntero ↔ se mantiene en toda la ventana aunque el mouse se salga del borde.
    document.documentElement.classList.add("redimensionando");
    const mover = (ev: PointerEvent) => {
      ancho = Math.min(ANCHO_MAX, Math.max(ANCHO_MIN, inicioAncho + ev.clientX - inicioX));
      if (barra.current) barra.current.style.width = `${ancho}px`;
    };
    const soltar = () => {
      tirador.removeEventListener("pointermove", mover);
      tirador.removeEventListener("pointerup", soltar);
      tirador.removeEventListener("pointercancel", soltar);
      document.documentElement.classList.remove("redimensionando");
      if (ancho !== inicioAncho) props.onCambiarAncho(Math.round(ancho));
    };
    tirador.addEventListener("pointermove", mover);
    tirador.addEventListener("pointerup", soltar);
    tirador.addEventListener("pointercancel", soltar);
  };
  // Días con nota en `Daily/`, para marcarlos en el calendario (solo se recalcula si cambia el árbol).
  const conNota = useMemo(() => diasConNota(arbol), [arbol]);

  // Carpetas desplegadas del árbol. Al abrir una nota se despliegan las que la contienen.
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

  // Carpeta fijada desplegada bajo la grilla de fijados (una a la vez), o null.
  const [fijadaAbierta, setFijadaAbierta] = useState<string | null>(null);
  // Al abrir una nota que está dentro de una carpeta fijada, esa carpeta se despliega bajo la
  // grilla (si no, la nota y sus títulos no se verían en ningún lado).
  const clavesFijadas = fijados.join("\n");
  useEffect(() => {
    const ruta = notaActiva?.ruta;
    if (!ruta || fijados.includes(ruta)) return;
    const contenedora = fijados.find((f) => f !== ruta && estaDentro(ruta, f));
    if (contenedora) setFijadaAbierta(contenedora);
  }, [notaActiva?.ruta, clavesFijadas]);

  // Menú contextual abierto (posición y opciones), o null.
  const [menu, setMenu] = useState<{ x: number; y: number; opciones: OpcionMenu[] } | null>(null);
  const cerrarMenu = useCallback(() => setMenu(null), []);
  // Selector de iconos abierto para un fijado (junto al clic derecho), o null.
  const [eligiendo, setEligiendo] = useState<{ x: number; y: number; clave: string; actual: string } | null>(null);
  const cerrarEleccion = useCallback(() => setEligiendo(null), []);

  /** Abre un menú contextual con `opciones` en la posición del clic. */
  const abrirMenu = (e: React.MouseEvent, opciones: OpcionMenu[]) => {
    e.preventDefault();
    e.stopPropagation();
    globo.ocultar();
    setMenu({ x: e.clientX, y: e.clientY, opciones });
  };

  // Solo cuentan los fijados que están dentro del hormiguero abierto: al cambiar de hormiguero,
  // cada uno muestra los suyos.
  const fijadosVisibles = carpeta ? fijados.map(leerFijado).filter((f) => estaDentro(f.ruta, carpeta)) : [];
  const conjuntoFijados = new Set(fijadosVisibles.map((f) => f.clave));

  /** Menú de clic derecho de una carpeta o nota del árbol, o de un título de la nota activa (capítulo). */
  const menuFijar = (clave: string): OpcionMenu[] =>
    conjuntoFijados.has(clave)
      ? [{ texto: tx.quitarFijado, accion: () => props.onDesfijar(clave) }]
      : [{ texto: tx.fijarArriba, accion: () => props.onFijar(clave) }];

  // Con el modo diario activo, la carpeta `Daily` se esconde del árbol y su nota abierta se
  // muestra sobre el calendario.
  // Se usa la carpeta `Daily` que ya exista (aunque esté en minúsculas) o, si no, donde se creará.
  const daily = props.diario && carpeta ? (entradaDiario(arbol)?.ruta ?? rutaDiario(carpeta)) : null;
  const arbolVisible = daily ? arbol.filter((e) => e.ruta !== daily) : arbol;
  const diarias = daily ? notas.filter((n) => n.ruta && estaDentro(n.ruta, daily)) : [];

  const porRuta = new Map(notas.filter((n) => n.ruta).map((n) => [n.ruta!, n]));
  // La nota en blanco con que arranca la app (sin ruta ni texto) no se lista: solo aparece en
  // «Abiertas» cuando se empieza a escribir en ella.
  const sueltas = notas.filter((n) => (n.ruta ? !carpeta || !estaDentro(n.ruta, carpeta) : n.texto || n.sucio));
  // Los títulos de la nota activa se pueden fijar como capítulos si la nota está en el hormiguero.
  const rutaFijable = notaActiva?.ruta && carpeta && estaDentro(notaActiva.ruta, carpeta) ? notaActiva.ruta : null;

  /** Fila de una nota: nombre, `*` si tiene cambios, botón para cerrarla si está abierta y sus títulos si es la visible. */
  function filaNota(nombre: string, nivel: number, nota: NotaResumen | undefined, alHacerClic: () => void, ruta?: string) {
    const esActiva = nota?.id === activa;
    return (
      <>
        <div
          className={`barra-nota${esActiva ? " activa" : ""}${nota ? " abierta" : ""}`}
          style={{ paddingLeft: sangria(nivel) }}
          onClick={alHacerClic}
          onContextMenu={ruta ? (e) => abrirMenu(e, menuFijar(ruta)) : undefined}
        >
          <span className="barra-nombre">
            {nombre}
            {/* Solo las notas nuevas esperan a guardarse; las demás se guardan solas. */}
            {nota?.sucio && !nota.ruta && " *"}
          </span>
          {nota && (
            // Detiene el clic para no activar la nota al mismo tiempo que se cierra.
            <button className="barra-cerrar" title={tx.cerrarNota} onClick={(e) => { e.stopPropagation(); props.onCerrar(nota.id); }}>
              ×
            </button>
          )}
        </div>
        {esActiva && (
          <Marcadores
            marcadores={marcadores}
            seleccionado={seleccionado}
            nivelBase={nivel + 1}
            onSaltar={props.onSaltar}
            onClicDerecho={rutaFijable ? (e, m) => abrirMenu(e, menuFijar(claveCapitulo(rutaFijable, m.texto))) : undefined}
          />
        )}
      </>
    );
  }

  /** Fila de una carpeta con su flecha y, si está desplegada, su contenido. */
  function filaCarpeta(e: Entrada, nivel: number) {
    return (
      <div key={e.ruta}>
        <div className="barra-carpeta" style={{ paddingLeft: sangria(nivel) }} onClick={() => alternar(e.ruta)} onContextMenu={(ev) => abrirMenu(ev, menuFijar(e.ruta))}>
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

  /**
   * Dibuja un fijado como un botón con su icono. El nombre aparece en un globo al pasar el mouse.
   * Si ya no existe en el hormiguero (se borró o movió), se ve atenuado y no hace nada.
   */
  function dibujarFijado(f: Fijado) {
    const entrada = buscar(arbol, f.ruta);
    const tipo = f.titulo ? "capitulo" : entrada?.es_carpeta ? "carpeta" : "nota";
    const icono = props.iconos[f.clave] ?? ICONO_POR_DEFECTO[tipo];
    const nombreNota = sinExtension(nombreArchivo(f.ruta));
    const nombre = f.titulo ? `${f.titulo} · ${nombreNota}` : entrada?.es_carpeta ? entrada.nombre : nombreNota;
    const nota = porRuta.get(f.ruta);
    const esActiva = !!nota && nota.id === activa;
    // Un capítulo está activo si su nota es la visible y el cursor está en su título.
    const activo = f.titulo ? esActiva && marcadores[seleccionado]?.texto === f.titulo : tipo === "nota" && esActiva;
    const clases = [
      "fijado",
      activo && "activo",
      !entrada && "perdido",
      tipo === "carpeta" && fijadaAbierta === f.ruta && "desplegado",
      tipo === "nota" && nota && !esActiva && "abierto",
    ].filter(Boolean).join(" ");

    /** Abre la nota, el capítulo o despliega la carpeta. */
    const alHacerClic = () => {
      globo.ocultar();
      if (!entrada) return;
      if (f.titulo) props.onAbrirCapitulo(f.ruta, f.titulo);
      else if (entrada.es_carpeta) setFijadaAbierta((a) => (a === f.ruta ? null : f.ruta));
      else props.onAbrirRuta(f.ruta);
    };

    return (
      <button
        key={f.clave}
        className={clases}
        aria-label={nombre}
        onClick={alHacerClic}
        onMouseEnter={(e) => globo.mostrar(e.currentTarget, entrada ? nombre : `${nombre} — ${tx.yaNoEsta}`)}
        onMouseLeave={globo.ocultar}
        onContextMenu={(e) => {
          const { clientX: x, clientY: y } = e;
          abrirMenu(e, [
            { texto: tx.cambiarIcono, accion: () => setEligiendo({ x, y, clave: f.clave, actual: icono }) },
            { texto: tx.quitarFijado, accion: () => props.onDesfijar(f.clave) },
          ]);
        }}
      >
        <Icono id={icono} />
      </button>
    );
  }

  const carpetaDesplegada = fijadaAbierta && conjuntoFijados.has(fijadaAbierta) ? buscar(arbol, fijadaAbierta) : undefined;
  // Si la nota visible está fijada, no está en el árbol: su fila y sus títulos van bajo la grilla.
  const activaFijada = notaActiva?.ruta && conjuntoFijados.has(notaActiva.ruta) ? notaActiva : undefined;

  return (
    <nav className="barra" ref={barra} style={{ width: props.ancho }}>
      <div className="barra-contenido">
        {fijadosVisibles.length > 0 && (
          <section className="barra-seccion barra-fijados" aria-label={tx.fijados}>
            <div className="fijados-grilla">{fijadosVisibles.map(dibujarFijado)}</div>
            {activaFijada && (
              <div className="fijados-carpeta">
                {filaNota(sinExtension(nombreArchivo(activaFijada.ruta!)), 0, activaFijada, () => {}, activaFijada.ruta!)}
              </div>
            )}
            {carpetaDesplegada && (
              <div className="fijados-carpeta">
                <div className="barra-encabezado">{carpetaDesplegada.nombre}</div>
                {dibujarArbol(carpetaDesplegada.hijos, 0)}
              </div>
            )}
          </section>
        )}
        {sueltas.length > 0 && (
          <section className="barra-seccion">
            <div className="barra-encabezado">{tx.abiertas}</div>
            {sueltas.map((n) => (
              <div key={n.id}>{filaNota(n.ruta ? nombreArchivo(n.ruta) : tx.sinTitulo, 0, n, () => props.onElegir(n.id))}</div>
            ))}
          </section>
        )}
        {carpeta && (
          <section className="barra-seccion">
            <div className="barra-encabezado" title={carpeta}>{nombreArchivo(carpeta)}</div>
            {arbolVisible.length ? dibujarArbol(arbolVisible, 0) : <div className="barra-vacia">{tx.carpetaVacia}</div>}
          </section>
        )}
      </div>
      {/* Modo diario: la nota diaria abierta y, pegado al fondo de la barra, el calendario. */}
      {daily && (
        <section className="barra-diario">
          {diarias.map((n) => (
            <div key={n.id}>{filaNota(sinExtension(nombreArchivo(n.ruta!)), 0, n, () => props.onElegir(n.id))}</div>
          ))}
          <Calendario conNota={conNota} activo={diaDeRuta(notaActiva?.ruta ?? null)} onElegir={props.onAbrirDia} />
        </section>
      )}
      {/* Borde invisible para cambiar el ancho; doble clic vuelve al ancho por defecto. */}
      <div className="barra-tirador" title={tx.bordeBarra} onPointerDown={alEmpezarArrastre} onDoubleClick={() => props.onCambiarAncho(null)} />
      {menu && <MenuContextual x={menu.x} y={menu.y} onCerrar={cerrarMenu} opciones={menu.opciones} />}
      {eligiendo && (
        <ElegirIcono
          x={eligiendo.x}
          y={eligiendo.y}
          actual={eligiendo.actual}
          onElegir={(icono) => props.onCambiarIcono(eligiendo.clave, icono)}
          onCerrar={cerrarEleccion}
        />
      )}
      {globo.dibujo}
    </nav>
  );
}
