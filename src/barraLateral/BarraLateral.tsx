// Barra lateral de la ventana principal. Simple a propósito: cambiar de hormiguero o cavar uno
// nuevo se hace en Ajustes o en el menú, no aquí; y no tiene líneas separadoras, las secciones se
// separan solo con espacio. De arriba hacia abajo:
//   1. El calendario del modo diario si está activo en Ajustes (`Calendario.tsx`), con la nota
//      diaria abierta debajo. En ese modo la carpeta `Daily` no aparece en el árbol: a las notas
//      diarias se llega desde el calendario.
//   2. Los fijados (`Fijados.tsx`): carpetas, notas y capítulos fijados con clic derecho → Fijar
//      arriba, como una grilla de iconos.
//   3. «Abiertas»: notas abiertas que no están en el hormiguero (nuevas sin guardar ya con algo
//      escrito, o de otro lugar).
//   4. El hormiguero abierto, con su nombre, como árbol de subcarpetas y notas (`FilasDelArbol.tsx`).
// Bajo la nota visible aparecen sus títulos (`#`, `##`, …) para saltar a ellos, como en Left.
// El borde derecho no se ve, pero al pasar el mouse el puntero cambia a ↔ y arrastrándolo se
// ensancha o achica la barra (`useArrastreDelBorde`; doble clic vuelve al ancho por defecto).
// Lo que comparten las filas (nota visible, carpetas desplegadas, menú…) va por
// `ContextoDeLaBarraLateral`.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Entrada, carpetasPadre, estaDentro } from "../carpeta";
import { diaDeRuta, diasConNota, entradaDiario, rutaDiario } from "../diario";
import { useTextos } from "../idioma";
import type { Marcador } from "../marcadores";
import { MenuContextual, OpcionMenu } from "../MenuContextual";
import { nombreArchivo } from "../notas";
import type { NotaAbierta } from "../notasAbiertas/notaAbierta";
import { Calendario } from "./Calendario";
import { ContextoDeLaBarraLateral, DatosDeLaBarraLateral } from "./contextoDeLaBarraLateral";
import { EntradasDelArbol, FilaDeNota, nombreSinExtension } from "./FilasDelArbol";
import { Fijados } from "./Fijados";
import { interpretarClaveDeFijado } from "./clavesDeFijados";
import { useArrastreDelBorde } from "./useArrastreDelBorde";

interface Props {
  /** Carpeta del hormiguero abierto, o `null` si no hay ninguno. */
  carpetaDelHormiguero: string | null;
  arbolDelHormiguero: Entrada[];
  /** Claves de todo lo fijado (de los ajustes); solo se muestran las del hormiguero abierto. */
  clavesDeFijados: string[];
  /** Icono elegido para cada fijado, por su clave. */
  iconosElegidosPorFijado: Record<string, string>;
  /** Si el modo diario está activo (muestra el calendario). */
  modoDiarioActivo: boolean;
  notasAbiertas: NotaAbierta[];
  idNotaVisible: string;
  /** Títulos de la nota visible (los calcula App tras una pausa al escribir). */
  titulosDeLaNotaVisible: Marcador[];
  /** Índice del título donde está el cursor, o -1. */
  indiceDelTituloConElCursor: number;
  /** Ancho de la barra en píxeles. */
  anchoEnPixeles: number;
  /** Se llama al soltar el borde tras arrastrarlo, con el ancho nuevo (o `null` para el de por defecto). */
  alCambiarAncho(anchoEnPixeles: number | null): void;
  alMostrarNotaAbierta(idNota: string): void;
  alAbrirNotaDeArchivo(rutaDelArchivo: string): void;
  /** Abre una nota y lleva el cursor a su título `tituloDelCapitulo` (un capítulo fijado). */
  alAbrirCapitulo(rutaDeLaNota: string, tituloDelCapitulo: string): void;
  /** Abre (o crea) la nota diaria de `diaElegido`. */
  alAbrirNotaDelDia(diaElegido: Date): void;
  alCerrarNota(idNota: string): void;
  alSaltarATitulo(posicionDelTitulo: number): void;
  alFijar(clave: string): void;
  alQuitarFijado(clave: string): void;
  /** Cambia el icono de un fijado (`null` vuelve al de por defecto). */
  alCambiarIconoDeFijado(clave: string, icono: string | null): void;
}

export function BarraLateral(props: Props) {
  const { carpetaDelHormiguero, arbolDelHormiguero, notasAbiertas, idNotaVisible } = props;
  const textosDeLaInterfaz = useTextos();
  const notaVisible = notasAbiertas.find((nota) => nota.id === idNotaVisible);
  const rutaDeLaNotaVisible = notaVisible?.rutaDelArchivo ?? null;

  const elementoDeLaBarra = useRef<HTMLElement>(null);
  const alPresionarElBorde = useArrastreDelBorde(elementoDeLaBarra, props.alCambiarAncho);

  // Días con nota en `Daily/`, para marcarlos en el calendario (solo se recalcula si cambia el árbol).
  const diasQueTienenNota = useMemo(() => diasConNota(arbolDelHormiguero), [arbolDelHormiguero]);

  // Carpetas desplegadas. Al abrir una nota se despliegan las que la contienen.
  const [carpetasDesplegadas, setCarpetasDesplegadas] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!carpetaDelHormiguero || !rutaDeLaNotaVisible) return;
    const carpetasQueLaContienen = carpetasPadre(rutaDeLaNotaVisible, carpetaDelHormiguero);
    setCarpetasDesplegadas((desplegadas) =>
      carpetasQueLaContienen.every((carpeta) => desplegadas.has(carpeta)) ? desplegadas : new Set([...desplegadas, ...carpetasQueLaContienen]),
    );
  }, [carpetaDelHormiguero, rutaDeLaNotaVisible]);

  /** Despliega o pliega una carpeta. */
  const desplegarOPlegarCarpeta = useCallback((rutaDeLaCarpeta: string) => {
    setCarpetasDesplegadas((desplegadas) => {
      const nuevas = new Set(desplegadas);
      if (!nuevas.delete(rutaDeLaCarpeta)) nuevas.add(rutaDeLaCarpeta);
      return nuevas;
    });
  }, []);

  // Menú de clic derecho abierto (posición y opciones), o null.
  const [menuContextual, setMenuContextual] = useState<{ x: number; y: number; opciones: OpcionMenu[] } | null>(null);
  const cerrarMenuContextual = useCallback(() => setMenuContextual(null), []);

  // Solo cuentan los fijados que están dentro del hormiguero abierto: al cambiar de hormiguero,
  // cada uno muestra los suyos.
  const fijadosVisibles = carpetaDelHormiguero
    ? props.clavesDeFijados.map(interpretarClaveDeFijado).filter((fijado) => estaDentro(fijado.ruta, carpetaDelHormiguero))
    : [];

  // Con el modo diario activo, la carpeta `Daily` se esconde del árbol y su nota abierta se muestra
  // bajo el calendario. Se usa la carpeta `Daily` que ya exista (aunque esté en minúsculas) o, si
  // no, donde se creará.
  const carpetaDelDiario =
    props.modoDiarioActivo && carpetaDelHormiguero
      ? (entradaDiario(arbolDelHormiguero)?.ruta ?? rutaDiario(carpetaDelHormiguero))
      : null;
  const arbolSinElDiario = carpetaDelDiario ? arbolDelHormiguero.filter((entrada) => entrada.ruta !== carpetaDelDiario) : arbolDelHormiguero;
  const notasDiariasAbiertas = carpetaDelDiario
    ? notasAbiertas.filter((nota) => nota.rutaDelArchivo && estaDentro(nota.rutaDelArchivo, carpetaDelDiario))
    : [];

  // «Abiertas»: notas fuera del hormiguero. La nota en blanco con que arranca la app no se lista:
  // solo aparece cuando se empieza a escribir en ella.
  const notasFueraDelHormiguero = notasAbiertas.filter((nota) =>
    nota.rutaDelArchivo
      ? !carpetaDelHormiguero || !estaDentro(nota.rutaDelArchivo, carpetaDelHormiguero)
      : nota.ultimoTextoConocido || nota.tieneCambiosSinGuardar,
  );

  // Lo que comparten las filas del árbol y los fijados.
  const datosCompartidos: DatosDeLaBarraLateral = {
    idNotaVisible,
    notasAbiertasPorRuta: new Map(
      notasAbiertas.filter((nota) => nota.rutaDelArchivo).map((nota) => [nota.rutaDelArchivo!, nota]),
    ),
    titulosDeLaNotaVisible: props.titulosDeLaNotaVisible,
    indiceDelTituloConElCursor: props.indiceDelTituloConElCursor,
    // Los títulos de la nota visible se pueden fijar como capítulos si la nota está en el hormiguero.
    rutaDeLaNotaVisibleQueSePuedeFijar:
      rutaDeLaNotaVisible && carpetaDelHormiguero && estaDentro(rutaDeLaNotaVisible, carpetaDelHormiguero) ? rutaDeLaNotaVisible : null,
    carpetasDesplegadas,
    desplegarOPlegarCarpeta,
    clavesFijadasVisibles: new Set(fijadosVisibles.map((fijado) => fijado.clave)),
    abrirMenuContextual(evento, opciones) {
      evento.preventDefault();
      evento.stopPropagation();
      setMenuContextual({ x: evento.clientX, y: evento.clientY, opciones });
    },
    opcionesParaFijarOQuitar: (clave) =>
      props.clavesDeFijados.includes(clave)
        ? [{ texto: textosDeLaInterfaz.quitarFijado, accion: () => props.alQuitarFijado(clave) }]
        : [{ texto: textosDeLaInterfaz.fijarArriba, accion: () => props.alFijar(clave) }],
    alAbrirNotaDeArchivo: props.alAbrirNotaDeArchivo,
    alCerrarNota: props.alCerrarNota,
    alSaltarATitulo: props.alSaltarATitulo,
  };

  return (
    <ContextoDeLaBarraLateral.Provider value={datosCompartidos}>
      <nav className="barra" ref={elementoDeLaBarra} style={{ width: props.anchoEnPixeles }}>
        <div className="barra-contenido">
          {carpetaDelDiario && (
            <section className="barra-seccion barra-diario">
              <Calendario
                diasConNota={diasQueTienenNota}
                diaDeLaNotaVisible={diaDeRuta(rutaDeLaNotaVisible)}
                alElegirDia={props.alAbrirNotaDelDia}
              />
              {notasDiariasAbiertas.map((notaDiaria) => (
                <FilaDeNota
                  key={notaDiaria.id}
                  nombreVisible={nombreSinExtension(nombreArchivo(notaDiaria.rutaDelArchivo!))}
                  nivelDeProfundidad={0}
                  notaAbierta={notaDiaria}
                  alHacerClic={() => props.alMostrarNotaAbierta(notaDiaria.id)}
                />
              ))}
            </section>
          )}
          {fijadosVisibles.length > 0 && (
            <Fijados
              fijadosVisibles={fijadosVisibles}
              arbolDelHormiguero={arbolDelHormiguero}
              iconosElegidosPorFijado={props.iconosElegidosPorFijado}
              notaVisible={notaVisible}
              alAbrirCapitulo={props.alAbrirCapitulo}
              alQuitarFijado={props.alQuitarFijado}
              alCambiarIconoDeFijado={props.alCambiarIconoDeFijado}
            />
          )}
          {notasFueraDelHormiguero.length > 0 && (
            <section className="barra-seccion">
              <div className="barra-encabezado">{textosDeLaInterfaz.abiertas}</div>
              {notasFueraDelHormiguero.map((nota) => (
                <FilaDeNota
                  key={nota.id}
                  nombreVisible={nota.rutaDelArchivo ? nombreArchivo(nota.rutaDelArchivo) : textosDeLaInterfaz.sinTitulo}
                  nivelDeProfundidad={0}
                  notaAbierta={nota}
                  alHacerClic={() => props.alMostrarNotaAbierta(nota.id)}
                />
              ))}
            </section>
          )}
          {carpetaDelHormiguero && (
            <section className="barra-seccion">
              <div className="barra-encabezado" title={carpetaDelHormiguero}>{nombreArchivo(carpetaDelHormiguero)}</div>
              {arbolSinElDiario.length ? (
                <EntradasDelArbol entradas={arbolSinElDiario} nivelDeProfundidad={0} />
              ) : (
                <div className="barra-vacia">{textosDeLaInterfaz.carpetaVacia}</div>
              )}
            </section>
          )}
        </div>
        {/* Borde invisible para cambiar el ancho; doble clic vuelve al ancho por defecto. */}
        <div
          className="barra-tirador"
          title={textosDeLaInterfaz.bordeBarra}
          onPointerDown={alPresionarElBorde}
          onDoubleClick={() => props.alCambiarAncho(null)}
        />
        {menuContextual && (
          <MenuContextual x={menuContextual.x} y={menuContextual.y} onCerrar={cerrarMenuContextual} opciones={menuContextual.opciones} />
        )}
      </nav>
    </ContextoDeLaBarraLateral.Provider>
  );
}
