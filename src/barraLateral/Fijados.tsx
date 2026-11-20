// Fijados de la barra lateral: una grilla de iconos sin texto, como las pestañas fijadas de Zen o
// Arc, con el nombre en un globo al pasar el mouse. Cada fijado tiene el icono de su tipo
// (carpeta, nota o capítulo) hasta que se elige otro (clic derecho → Cambiar icono…).
//   · Una nota fijada se abre con un clic; un capítulo abre su nota en ese título.
//   · Una carpeta fijada se despliega bajo la grilla (una a la vez). Se despliega sola si contiene
//     la nota visible, porque lo fijado no está en el árbol y la nota no se vería en otro lado.
//   · Si la nota visible está fijada, su fila y sus títulos van bajo la grilla, por lo mismo.
//   · Lo que ya no existe en el hormiguero (se borró o movió) se ve atenuado y no hace nada.

import { useCallback, useEffect, useState } from "react";
import { Entrada, buscarEntradaPorRuta, estaDentro } from "../carpeta";
import { useGlobo } from "../Globo";
import { Icono } from "../Icono";
import { useTextos } from "../idioma";
import { nombreArchivo } from "../notas";
import type { NotaAbierta } from "../notasAbiertas/notaAbierta";
import { useBarraLateral } from "./contextoDeLaBarraLateral";
import { ElegirIconoDeFijado } from "./ElegirIconoDeFijado";
import { EntradasDelArbol, FilaDeNota, nombreSinExtension } from "./FilasDelArbol";
import { Fijado, ICONO_POR_DEFECTO_DE_CADA_TIPO } from "./clavesDeFijados";

interface Props {
  /** Fijados del hormiguero abierto, ya interpretados. */
  fijadosVisibles: Fijado[];
  arbolDelHormiguero: Entrada[];
  /** Icono elegido para cada fijado, por su clave. */
  iconosElegidosPorFijado: Record<string, string>;
  notaVisible: NotaAbierta | undefined;
  alAbrirCapitulo(rutaDeLaNota: string, tituloDelCapitulo: string): void;
  alQuitarFijado(clave: string): void;
  /** Cambia el icono de un fijado (`null` vuelve al de su tipo). */
  alCambiarIconoDeFijado(clave: string, icono: string | null): void;
}

export function Fijados({
  fijadosVisibles,
  arbolDelHormiguero,
  iconosElegidosPorFijado,
  notaVisible,
  alAbrirCapitulo,
  alQuitarFijado,
  alCambiarIconoDeFijado,
}: Props) {
  const barra = useBarraLateral();
  const textosDeLaInterfaz = useTextos();
  const globoConElNombre = useGlobo();

  // Carpeta fijada desplegada bajo la grilla (una a la vez), o null.
  const [carpetaFijadaDesplegada, setCarpetaFijadaDesplegada] = useState<string | null>(null);
  // Selector de iconos abierto para un fijado (junto al clic derecho), o null.
  const [eleccionDeIcono, setEleccionDeIcono] = useState<{ x: number; y: number; clave: string; iconoActual: string } | null>(null);
  const cerrarEleccionDeIcono = useCallback(() => setEleccionDeIcono(null), []);

  // Al abrir una nota que está dentro de una carpeta fijada, esa carpeta se despliega bajo la grilla.
  const rutaDeLaNotaVisible = notaVisible?.rutaDelArchivo ?? null;
  const clavesFijadasComoTexto = fijadosVisibles.map((fijado) => fijado.clave).join("\n");
  useEffect(() => {
    if (!rutaDeLaNotaVisible || barra.clavesFijadasVisibles.has(rutaDeLaNotaVisible)) return;
    const carpetaQueLaContiene = fijadosVisibles.find(
      (fijado) => !fijado.tituloDelCapitulo && fijado.ruta !== rutaDeLaNotaVisible && estaDentro(rutaDeLaNotaVisible, fijado.ruta),
    );
    if (carpetaQueLaContiene) setCarpetaFijadaDesplegada(carpetaQueLaContiene.ruta);
  }, [rutaDeLaNotaVisible, clavesFijadasComoTexto]);

  /**
   * Dibuja el botón de un fijado: su icono, su globo con el nombre y su menú de clic derecho. Es
   * una función y no un componente dentro de otro: así React no lo vuelve a crear en cada dibujo
   * (perdería el estado del mouse encima).
   */
  function dibujarBotonDeFijado(fijado: Fijado) {
    const entradaEnElArbol = buscarEntradaPorRuta(arbolDelHormiguero, fijado.ruta);
    const tipo = fijado.tituloDelCapitulo ? "capitulo" : entradaEnElArbol?.es_carpeta ? "carpeta" : "nota";
    const iconoDelFijado = iconosElegidosPorFijado[fijado.clave] ?? ICONO_POR_DEFECTO_DE_CADA_TIPO[tipo];
    const nombreDeLaNota = nombreSinExtension(nombreArchivo(fijado.ruta));
    const nombreVisible = fijado.tituloDelCapitulo
      ? `${fijado.tituloDelCapitulo} · ${nombreDeLaNota}`
      : entradaEnElArbol?.es_carpeta
        ? entradaEnElArbol.nombre
        : nombreDeLaNota;
    const notaAbierta = barra.notasAbiertasPorRuta.get(fijado.ruta);
    const esLaNotaVisible = !!notaAbierta && notaAbierta.id === barra.idNotaVisible;
    // Un capítulo está activo si su nota es la visible y el cursor está en su título.
    const estaActivo = fijado.tituloDelCapitulo
      ? esLaNotaVisible && barra.titulosDeLaNotaVisible[barra.indiceDelTituloConElCursor]?.texto === fijado.tituloDelCapitulo
      : tipo === "nota" && esLaNotaVisible;
    const clases = [
      "fijado",
      estaActivo && "activo",
      !entradaEnElArbol && "perdido",
      tipo === "carpeta" && carpetaFijadaDesplegada === fijado.ruta && "desplegado",
      tipo === "nota" && notaAbierta && !esLaNotaVisible && "abierto",
    ].filter(Boolean).join(" ");

    /** Abre la nota o el capítulo, o despliega la carpeta. */
    const alHacerClic = () => {
      globoConElNombre.ocultar();
      if (!entradaEnElArbol) return;
      if (fijado.tituloDelCapitulo) alAbrirCapitulo(fijado.ruta, fijado.tituloDelCapitulo);
      else if (entradaEnElArbol.es_carpeta) setCarpetaFijadaDesplegada((desplegada) => (desplegada === fijado.ruta ? null : fijado.ruta));
      else barra.alAbrirNotaDeArchivo(fijado.ruta);
    };

    return (
      <button
        key={fijado.clave}
        className={clases}
        aria-label={nombreVisible}
        onClick={alHacerClic}
        onMouseEnter={(evento) =>
          globoConElNombre.mostrar(evento.currentTarget, entradaEnElArbol ? nombreVisible : `${nombreVisible} — ${textosDeLaInterfaz.yaNoEsta}`)
        }
        onMouseLeave={globoConElNombre.ocultar}
        onContextMenu={(evento) => {
          globoConElNombre.ocultar();
          const { clientX: x, clientY: y } = evento;
          barra.abrirMenuContextual(evento, [
            { texto: textosDeLaInterfaz.cambiarIcono, accion: () => setEleccionDeIcono({ x, y, clave: fijado.clave, iconoActual: iconoDelFijado }) },
            { texto: textosDeLaInterfaz.quitarFijado, accion: () => alQuitarFijado(fijado.clave) },
          ]);
        }}
      >
        <Icono id={iconoDelFijado} />
      </button>
    );
  }

  const carpetaDesplegada =
    carpetaFijadaDesplegada && barra.clavesFijadasVisibles.has(carpetaFijadaDesplegada)
      ? buscarEntradaPorRuta(arbolDelHormiguero, carpetaFijadaDesplegada)
      : undefined;
  const notaVisibleEstaFijada = !!rutaDeLaNotaVisible && barra.clavesFijadasVisibles.has(rutaDeLaNotaVisible);

  return (
    <section className="barra-seccion barra-fijados" aria-label={textosDeLaInterfaz.fijados}>
      <div className="fijados-grilla">
        {fijadosVisibles.map(dibujarBotonDeFijado)}
      </div>
      {notaVisibleEstaFijada && notaVisible && (
        <div className="fijados-carpeta">
          <FilaDeNota
            nombreVisible={nombreSinExtension(nombreArchivo(rutaDeLaNotaVisible))}
            nivelDeProfundidad={0}
            notaAbierta={notaVisible}
            alHacerClic={() => {}}
            rutaParaFijar={rutaDeLaNotaVisible}
          />
        </div>
      )}
      {carpetaDesplegada && (
        <div className="fijados-carpeta">
          <div className="barra-encabezado">{carpetaDesplegada.nombre}</div>
          <EntradasDelArbol entradas={carpetaDesplegada.hijos} nivelDeProfundidad={0} />
        </div>
      )}
      {eleccionDeIcono && (
        <ElegirIconoDeFijado
          x={eleccionDeIcono.x}
          y={eleccionDeIcono.y}
          iconoActual={eleccionDeIcono.iconoActual}
          alElegirIcono={(iconoElegido) => alCambiarIconoDeFijado(eleccionDeIcono.clave, iconoElegido)}
          alCerrar={cerrarEleccionDeIcono}
        />
      )}
      {globoConElNombre.dibujo}
    </section>
  );
}
