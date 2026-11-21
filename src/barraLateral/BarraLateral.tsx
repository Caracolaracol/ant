// Barra lateral de la ventana principal (el «panel»). Simple a propósito: no tiene líneas
// separadoras, las secciones se separan solo con espacio. De arriba hacia abajo:
//   0. El selector de cámaras (`SelectorDeCamara.tsx`): el nombre de la cámara abierta, que al
//      tocarlo despliega las otras para cambiar de cámara (y «Cámara nueva…»).
//   1. El calendario del modo diario si está activo en Ajustes (`Calendario.tsx`), con la nota
//      diaria abierta debajo. En ese modo la carpeta `Daily` no aparece en el árbol: a las notas
//      diarias se llega desde el calendario.
//   2. Los fijados (`Fijados.tsx`): carpetas, notas y capítulos fijados con clic derecho → Fijar
//      arriba, como una grilla de iconos.
//   3. «Abiertas»: notas abiertas que no están en la cámara (nuevas sin guardar ya con algo
//      escrito, o de otro lugar).
//   4. La cámara abierta como árbol de subcarpetas y notas (`FilasDelArbol.tsx`). En la «Entrada»
//      son solo las notas sueltas de la raíz del hormiguero, y no hay diario (su carpeta `Daily`
//      sería otra cámara).
// Bajo la nota visible aparecen sus títulos (`#`, `##`, …) para saltar a ellos, como en Left.
// El borde derecho no se ve, pero al pasar el mouse el puntero cambia a ↔ y arrastrándolo se
// ensancha o achica la barra (`useArrastreDelBorde`; doble clic vuelve al ancho por defecto).
// Lo que comparten las filas (nota visible, carpetas desplegadas, menú…) va por
// `ContextoDeLaBarraLateral`.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EntradaDelArbol, carpetasQueContienenA, estaDentroDe, estaEnLaCamara } from "../arbolDeCarpetas";
import { diaDeLaNotaDiaria, diasQueTienenNota, buscarCarpetaDelDiario, rutaDeLaCarpetaDelDiario } from "../diario";
import { useTextos } from "../idioma";
import type { TituloDeLaNota } from "../titulosDeLaNota";
import { MenuContextual, OpcionDelMenu } from "../MenuContextual";
import { nombreDelArchivo } from "../archivosDeNotas";
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
  /** Las cámaras del hormiguero, para el selector. */
  camarasDelHormiguero: string[];
  arbolDeLaCamara: EntradaDelArbol[];
  /** Claves de todo lo fijado (de los ajustes); solo se muestran las de la cámara abierta. */
  clavesDeFijados: string[];
  /** Icono elegido para cada fijado, por su clave. */
  iconosElegidosPorFijado: Record<string, string>;
  /** Si el modo diario está activo (muestra el calendario). */
  modoDiarioActivo: boolean;
  notasAbiertas: NotaAbierta[];
  idNotaVisible: string;
  /** Títulos de la nota visible (los calcula App tras una pausa al escribir). */
  titulosDeLaNotaVisible: TituloDeLaNota[];
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
  alAbrirCamara(nombreDeLaCamara: string): void;
  alPedirCamaraNueva(): void;
}

export function BarraLateral(props: Props) {
  const { carpetaDeLaCamara, laCamaraEsLaEntrada, arbolDeLaCamara, notasAbiertas, idNotaVisible } = props;
  /** Si una ruta es de la cámara abierta (en la «Entrada», solo lo que está suelto en la raíz). */
  const esDeLaCamara = (ruta: string) => Boolean(carpetaDeLaCamara) && estaEnLaCamara(ruta, carpetaDeLaCamara!, laCamaraEsLaEntrada);
  const textosDeLaInterfaz = useTextos();
  const notaVisible = notasAbiertas.find((nota) => nota.id === idNotaVisible);
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
  const notasDiariasAbiertas = carpetaDelDiario
    ? notasAbiertas.filter((nota) => nota.rutaDelArchivo && estaDentroDe(nota.rutaDelArchivo, carpetaDelDiario))
    : [];

  // «Abiertas»: notas fuera de la cámara. La nota en blanco con que arranca la app no se lista:
  // solo aparece cuando se empieza a escribir en ella.
  const notasFueraDeLaCamara = notasAbiertas.filter((nota) =>
    nota.rutaDelArchivo ? !esDeLaCamara(nota.rutaDelArchivo) : nota.ultimoTextoConocido || nota.tieneCambiosSinGuardar,
  );

  // Lo que comparten las filas del árbol y los fijados.
  const datosCompartidos: DatosDeLaBarraLateral = {
    idNotaVisible,
    notasAbiertasPorRuta: new Map(
      notasAbiertas.filter((nota) => nota.rutaDelArchivo).map((nota) => [nota.rutaDelArchivo!, nota]),
    ),
    titulosDeLaNotaVisible: props.titulosDeLaNotaVisible,
    indiceDelTituloConElCursor: props.indiceDelTituloConElCursor,
    // Los títulos de la nota visible se pueden fijar como capítulos si la nota está en la cámara.
    rutaDeLaNotaVisibleQueSePuedeFijar:
      rutaDeLaNotaVisible && esDeLaCamara(rutaDeLaNotaVisible) ? rutaDeLaNotaVisible : null,
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
        ? [{ texto: textosDeLaInterfaz.quitarFijado, alElegir: () => props.alQuitarFijado(clave) }]
        : [{ texto: textosDeLaInterfaz.fijarArriba, alElegir: () => props.alFijar(clave) }],
    alAbrirNotaDeArchivo: props.alAbrirNotaDeArchivo,
    alCerrarNota: props.alCerrarNota,
    alSaltarATitulo: props.alSaltarATitulo,
  };

  return (
    <ContextoDeLaBarraLateral.Provider value={datosCompartidos}>
      <nav className="barra" ref={elementoDeLaBarra} style={{ width: props.anchoEnPixeles }}>
        <div className="barra-contenido">
          {carpetaDeLaCamara && props.nombreDeLaCamaraAbierta && (
            <SelectorDeCamara
              nombreDeLaCamaraAbierta={props.nombreDeLaCamaraAbierta}
              carpetaDeLaCamara={carpetaDeLaCamara}
              camarasDelHormiguero={props.camarasDelHormiguero}
              alAbrirCamara={props.alAbrirCamara}
              alPedirCamaraNueva={props.alPedirCamaraNueva}
            />
          )}
          {carpetaDelDiario && (
            <section className="barra-seccion barra-diario">
              <Calendario
                diasQueTienenNota={diasConNotaEnLaCamara}
                diaDeLaNotaVisible={diaDeLaNotaDiaria(rutaDeLaNotaVisible)}
                alElegirDia={props.alAbrirNotaDelDia}
              />
              {notasDiariasAbiertas.map((notaDiaria) => (
                <FilaDeNota
                  key={notaDiaria.id}
                  nombreVisible={nombreSinExtension(nombreDelArchivo(notaDiaria.rutaDelArchivo!))}
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
              arbolDeLaCamara={arbolDeLaCamara}
              iconosElegidosPorFijado={props.iconosElegidosPorFijado}
              notaVisible={notaVisible}
              alAbrirCapitulo={props.alAbrirCapitulo}
              alQuitarFijado={props.alQuitarFijado}
              alCambiarIconoDeFijado={props.alCambiarIconoDeFijado}
            />
          )}
          {notasFueraDeLaCamara.length > 0 && (
            <section className="barra-seccion">
              <div className="barra-encabezado">{textosDeLaInterfaz.abiertas}</div>
              {notasFueraDeLaCamara.map((nota) => (
                <FilaDeNota
                  key={nota.id}
                  nombreVisible={nota.rutaDelArchivo ? nombreDelArchivo(nota.rutaDelArchivo) : textosDeLaInterfaz.sinTitulo}
                  nivelDeProfundidad={0}
                  notaAbierta={nota}
                  alHacerClic={() => props.alMostrarNotaAbierta(nota.id)}
                />
              ))}
            </section>
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
