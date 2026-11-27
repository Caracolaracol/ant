// Barra lateral de la ventana principal (el «panel»). Simple a propósito: no tiene líneas
// separadoras, las secciones se separan solo con espacio. De arriba hacia abajo:
//   0. El selector de cámaras (`SelectorDeCamara.tsx`): el nombre de la cámara abierta, que al
//      tocarlo despliega las otras para cambiar de cámara (y «Cámara nueva…»). Si la cámara es
//      cifrada y está bloqueada, la barra muestra solo esto.
//   1. El calendario del modo diario si está activo en Ajustes (`Calendario.tsx`), con la nota
//      diaria abierta debajo. En ese modo la carpeta `Daily` no aparece en el árbol: a las notas
//      diarias se llega desde el calendario.
//   2. Los fijados (`Fijados.tsx`): carpetas, notas y capítulos fijados con clic derecho → Fijar
//      arriba, como una grilla de iconos.
//   3. La cámara abierta como árbol de subcarpetas y notas (`FilasDelArbol.tsx`). En la «Entrada»
//      son solo las notas sueltas de la raíz del hormiguero, y no hay diario (su carpeta `Daily`
//      sería otra cámara).
// Bajo la nota visible aparecen sus títulos (`#`, `##`, …) para saltar a ellos, como en Left.
// El borde derecho no se ve, pero al pasar el mouse el puntero cambia a ↔ y arrastrándolo se
// ensancha o achica la barra (`useArrastreDelBorde`; doble clic vuelve al ancho por defecto).
// Clic derecho (menú propio, `MenuContextual`): en una nota o carpeta, crear una nota o carpeta
// junto a ella o dentro, fijarla y mostrarla en su carpeta; en el espacio libre, crear en la cámara.
// Lo que comparten las filas (nota visible, carpetas desplegadas, menú…) va por
// `ContextoDeLaBarraLateral`.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EntradaDelArbol, carpetaQueContieneA, carpetasQueContienenA, estaDentroDe, estaEnLaCamara } from "../arbolDeCarpetas";
import { diaDeLaNotaDiaria, diasQueTienenNota, buscarCarpetaDelDiario, rutaDeLaCarpetaDelDiario } from "../diario";
import { useTextos } from "../idioma";
import type { TituloDeLaNota } from "../titulosDeLaNota";
import { MenuContextual, OpcionDelMenu } from "../MenuContextual";
import { mostrarArchivoEnSuCarpeta, nombreDelArchivo } from "../archivosDeNotas";
import type { QueSeCrea } from "../hormigueros/NuevaNotaOCarpeta";
import type { NotaAbierta } from "../notasAbiertas/notaAbierta";
import { Calendario } from "./Calendario";
import { ContextoDeLaBarraLateral, DatosDeLaBarraLateral } from "./contextoDeLaBarraLateral";
import { EntradasDelArbol, FilaDeNota, nombreSinExtension } from "./FilasDelArbol";
import { Fijados } from "./Fijados";
import { SelectorDeCamara } from "./SelectorDeCamara";
import { interpretarClaveDeFijado } from "./clavesDeFijados";
import { useArrastreDelBorde } from "./useArrastreDelBorde";

interface Props {
  /** Carpeta de la cámara abierta, o `null` si no hay ninguna. */
  carpetaDeLaCamara: string | null;
  /** Nombre de la cámara abierta (`CAMARA_DE_ENTRADA` para la «Entrada»), o `null`. */
  nombreDeLaCamaraAbierta: string | null;
  /** Si la cámara abierta es la «Entrada»: solo son suyas las notas sueltas de la raíz del hormiguero. */
  laCamaraEsLaEntrada: boolean;
  /**
   * Si la cámara abierta es cifrada y está bloqueada (o todavía no se sabe): la barra muestra solo
   * el selector de cámaras, nada de lo que hay dentro.
   */
  laCamaraEstaBloqueada: boolean;
  /** Las cámaras del hormiguero, para el selector, y cuáles están cifradas (llevan candado). */
  camarasDelHormiguero: string[];
  camarasCifradas: string[];
  /** Bloquea la cámara abierta (si es cifrada y está desbloqueada; si no, `null`). */
  alBloquearLaCamara: (() => void) | null;
  arbolDeLaCamara: EntradaDelArbol[];
  /** Claves de todo lo fijado (de los ajustes); solo se muestran las de la cámara abierta. */
  clavesDeFijados: string[];
  /** Icono elegido para cada fijado, por su clave. */
  iconosElegidosPorFijado: Record<string, string>;
  /** Si el modo diario está activo (muestra el calendario). */
  modoDiarioActivo: boolean;
  /** Nota del editor; la barra solo la resalta si pertenece a la cámara abierta. */
  notaVisible: NotaAbierta | null;
  /** Títulos de la nota visible (los calcula App tras una pausa al escribir). */
  titulosDeLaNotaVisible: TituloDeLaNota[];
  /** Índice del título donde está el cursor, o -1. */
  indiceDelTituloConElCursor: number;
  /** Ancho de la barra en píxeles. */
  anchoEnPixeles: number;
  /** Se llama al soltar el borde tras arrastrarlo, con el ancho nuevo (o `null` para el de por defecto). */
  alCambiarAncho(anchoEnPixeles: number | null): void;
  alAbrirNotaDeArchivo(rutaDelArchivo: string): void;
  /** Abre una nota y lleva el cursor a su título `tituloDelCapitulo` (un capítulo fijado). */
  alAbrirCapitulo(rutaDeLaNota: string, tituloDelCapitulo: string): void;
  /** Abre (o crea) la nota diaria de `diaElegido`. */
  alAbrirNotaDelDia(diaElegido: Date): void;
  alSaltarATitulo(posicionDelTitulo: number): void;
  alFijar(clave: string): void;
  alQuitarFijado(clave: string): void;
  /** Cambia el icono de un fijado (`null` vuelve al de por defecto). */
  alCambiarIconoDeFijado(clave: string, icono: string | null): void;
  alAbrirCamara(nombreDeLaCamara: string): void;
  alPedirCamaraNueva(): void;
  /** Pide crear una nota o carpeta dentro de `carpetaDondeCrearla` (abre la ventanita del nombre). */
  alPedirCrear(queSeCrea: QueSeCrea, carpetaDondeCrearla: string): void;
  /** Carpeta recién creada: se despliega (y las que la contienen) para que se vea. */
  carpetaRecienCreada: string | null;
}

export function BarraLateral(props: Props) {
  const { carpetaDeLaCamara, laCamaraEsLaEntrada, arbolDeLaCamara } = props;
  /** Si una ruta es de la cámara abierta (en la «Entrada», solo lo que está suelto en la raíz). */
  const esDeLaCamara = (ruta: string) => carpetaDeLaCamara !== null && estaEnLaCamara(ruta, carpetaDeLaCamara, laCamaraEsLaEntrada);
  const textosDeLaInterfaz = useTextos();
  const notaVisible = props.notaVisible?.rutaDelArchivo && esDeLaCamara(props.notaVisible.rutaDelArchivo) ? props.notaVisible : undefined;
  const rutaDeLaNotaVisible = notaVisible?.rutaDelArchivo ?? null;

  const elementoDeLaBarra = useRef<HTMLElement>(null);
  const alPresionarElBorde = useArrastreDelBorde(elementoDeLaBarra, props.alCambiarAncho);

  // Días con nota en `Daily/`, para marcarlos en el calendario (solo se recalcula si cambia el árbol).
  const diasConNotaEnLaCamara = useMemo(() => diasQueTienenNota(arbolDeLaCamara), [arbolDeLaCamara]);

  // Carpetas desplegadas. Al abrir una nota se despliegan las que la contienen.
  const [carpetasDesplegadas, setCarpetasDesplegadas] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!carpetaDeLaCamara || !rutaDeLaNotaVisible) return;
    const carpetasQueLaContienen = carpetasQueContienenA(rutaDeLaNotaVisible, carpetaDeLaCamara);
    setCarpetasDesplegadas((desplegadas) =>
      carpetasQueLaContienen.every((carpeta) => desplegadas.has(carpeta)) ? desplegadas : new Set([...desplegadas, ...carpetasQueLaContienen]),
    );
  }, [carpetaDeLaCamara, rutaDeLaNotaVisible]);

  // Al crear una carpeta, se despliegan ella y las que la contienen, para que se vea en el árbol.
  const { carpetaRecienCreada } = props;
  useEffect(() => {
    if (!carpetaDeLaCamara || !carpetaRecienCreada) return;
    const carpetasParaDesplegar = [carpetaRecienCreada, ...carpetasQueContienenA(carpetaRecienCreada, carpetaDeLaCamara)];
    setCarpetasDesplegadas((desplegadas) => new Set([...desplegadas, ...carpetasParaDesplegar]));
  }, [carpetaDeLaCamara, carpetaRecienCreada]);

  /** Despliega o pliega una carpeta. */
  const desplegarOPlegarCarpeta = useCallback((rutaDeLaCarpeta: string) => {
    setCarpetasDesplegadas((desplegadas) => {
      const nuevas = new Set(desplegadas);
      if (!nuevas.delete(rutaDeLaCarpeta)) nuevas.add(rutaDeLaCarpeta);
      return nuevas;
    });
  }, []);

  // Menú de clic derecho abierto (posición y opciones), o null.
  const [menuContextual, setMenuContextual] = useState<{ x: number; y: number; opciones: OpcionDelMenu[] } | null>(null);
  const cerrarMenuContextual = useCallback(() => setMenuContextual(null), []);

  // Solo cuentan los fijados que están dentro de la cámara abierta: al cambiar de cámara,
  // cada uno muestra los suyos.
  const fijadosVisibles = carpetaDeLaCamara
    ? props.clavesDeFijados.map(interpretarClaveDeFijado).filter((fijado) => esDeLaCamara(fijado.ruta))
    : [];

  // Con el modo diario activo, la carpeta `Daily` se esconde del árbol y su nota abierta se muestra
  // bajo el calendario. Se usa la carpeta `Daily` que ya exista (aunque esté en minúsculas) o, si
  // no, donde se creará. La «Entrada» no tiene diario: su `Daily` sería otra cámara.
  const carpetaDelDiario =
    props.modoDiarioActivo && carpetaDeLaCamara && !laCamaraEsLaEntrada
      ? (buscarCarpetaDelDiario(arbolDeLaCamara)?.ruta ?? rutaDeLaCarpetaDelDiario(carpetaDeLaCamara))
      : null;
  const arbolSinElDiario = carpetaDelDiario ? arbolDeLaCamara.filter((entrada) => entrada.ruta !== carpetaDelDiario) : arbolDeLaCamara;
  const rutaDeLaNotaDiariaVisible = carpetaDelDiario && rutaDeLaNotaVisible && estaDentroDe(rutaDeLaNotaVisible, carpetaDelDiario)
    ? rutaDeLaNotaVisible : null;

  /** Opciones del clic derecho para fijar algo, o para quitarlo si ya está fijado. */
  function opcionesParaFijarOQuitar(clave: string): OpcionDelMenu[] {
    return props.clavesDeFijados.includes(clave)
      ? [{ texto: textosDeLaInterfaz.quitarFijado, icono: "pin-off", alElegir: () => props.alQuitarFijado(clave) }]
      : [{ texto: textosDeLaInterfaz.fijarArriba, icono: "pin", alElegir: () => props.alFijar(clave) }];
  }

  /**
   * Opciones del clic derecho para crear una nota o carpeta en `carpetaDondeCrear`. En la
   * «Entrada» no se crean carpetas: una carpeta en la raíz del hormiguero sería otra cámara.
   */
  function opcionesParaCrearEn(carpetaDondeCrear: string): OpcionDelMenu[] {
    const opciones: OpcionDelMenu[] = [
      { texto: textosDeLaInterfaz.notaNuevaMenu, icono: "file-plus", alElegir: () => props.alPedirCrear("nota", carpetaDondeCrear) },
    ];
    if (!laCamaraEsLaEntrada) {
      opciones.push({ texto: textosDeLaInterfaz.carpetaNuevaMenu, icono: "folder-plus", alElegir: () => props.alPedirCrear("carpeta", carpetaDondeCrear) });
    }
    return opciones;
  }

  // Lo que comparten las filas del árbol y los fijados.
  const datosCompartidos: DatosDeLaBarraLateral = {
    notaVisible,
    rutaDeLaNotaVisible,
    titulosDeLaNotaVisible: props.titulosDeLaNotaVisible,
    indiceDelTituloConElCursor: props.indiceDelTituloConElCursor,
    carpetasDesplegadas,
    desplegarOPlegarCarpeta,
    clavesFijadasVisibles: new Set(fijadosVisibles.map((fijado) => fijado.clave)),
    abrirMenuContextual(evento, opciones) {
      evento.preventDefault();
      evento.stopPropagation();
      setMenuContextual({ x: evento.clientX, y: evento.clientY, opciones });
    },
    opcionesParaFijarOQuitar,
    opcionesDeUnaEntrada: (ruta, esCarpeta) => [
      // Dentro de la carpeta, o junto a la nota.
      ...opcionesParaCrearEn(esCarpeta ? ruta : carpetaQueContieneA(ruta)),
      ...opcionesParaFijarOQuitar(ruta).map((opcion, i) => (i === 0 ? { ...opcion, vaSeparadaDeLaAnterior: true } : opcion)),
      { texto: textosDeLaInterfaz.mostrarEnFinder, icono: "folder-open", alElegir: () => void mostrarArchivoEnSuCarpeta(ruta).catch(() => {}) },
    ],
    alAbrirNotaDeArchivo: props.alAbrirNotaDeArchivo,
    alSaltarATitulo: props.alSaltarATitulo,
  };

  return (
    <ContextoDeLaBarraLateral.Provider value={datosCompartidos}>
      <nav className="barra" ref={elementoDeLaBarra} style={{ width: props.anchoEnPixeles }}>
        {/* Clic derecho en el espacio libre: crear una nota o carpeta en la cámara. Las filas
            tienen su propio menú (y detienen el evento). */}
        <div
          className="barra-contenido"
          onContextMenu={(evento) =>
            carpetaDeLaCamara && !props.laCamaraEstaBloqueada && datosCompartidos.abrirMenuContextual(evento, opcionesParaCrearEn(carpetaDeLaCamara))
          }
        >
          {carpetaDeLaCamara && props.nombreDeLaCamaraAbierta && (
            <SelectorDeCamara
              nombreDeLaCamaraAbierta={props.nombreDeLaCamaraAbierta}
              carpetaDeLaCamara={carpetaDeLaCamara}
              camarasDelHormiguero={props.camarasDelHormiguero}
              camarasCifradas={props.camarasCifradas}
              alAbrirCamara={props.alAbrirCamara}
              alPedirCamaraNueva={props.alPedirCamaraNueva}
              alBloquearLaCamara={props.alBloquearLaCamara}
            />
          )}
          {!props.laCamaraEstaBloqueada && (
          <>
          {carpetaDelDiario && (
            <section className="barra-seccion barra-diario">
              <Calendario
                diasQueTienenNota={diasConNotaEnLaCamara}
                diaDeLaNotaVisible={diaDeLaNotaDiaria(rutaDeLaNotaDiariaVisible)}
                alElegirDia={props.alAbrirNotaDelDia}
              />
              {rutaDeLaNotaDiariaVisible && (
                <FilaDeNota
                  nombreVisible={nombreSinExtension(nombreDelArchivo(rutaDeLaNotaDiariaVisible))}
                  nivelDeProfundidad={0}
                  rutaDelArchivo={rutaDeLaNotaDiariaVisible}
                  alHacerClic={() => props.alAbrirNotaDeArchivo(rutaDeLaNotaDiariaVisible)}
                />
              )}
            </section>
          )}
          {fijadosVisibles.length > 0 && (
            <Fijados
              fijadosVisibles={fijadosVisibles}
              arbolDeLaCamara={arbolDeLaCamara}
              iconosElegidosPorFijado={props.iconosElegidosPorFijado}
              alAbrirCapitulo={props.alAbrirCapitulo}
              alQuitarFijado={props.alQuitarFijado}
              alCambiarIconoDeFijado={props.alCambiarIconoDeFijado}
            />
          )}
          {carpetaDeLaCamara && (
            // Sin encabezado: el nombre de la cámara ya está arriba, en el selector.
            <section className="barra-seccion">
              {arbolSinElDiario.length ? (
                <EntradasDelArbol entradas={arbolSinElDiario} nivelDeProfundidad={0} />
              ) : (
                <div className="barra-vacia">{textosDeLaInterfaz.carpetaVacia}</div>
              )}
            </section>
          )}
          </>
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
          <MenuContextual x={menuContextual.x} y={menuContextual.y} alCerrar={cerrarMenuContextual} opciones={menuContextual.opciones} />
        )}
      </nav>
    </ContextoDeLaBarraLateral.Provider>
  );
}
