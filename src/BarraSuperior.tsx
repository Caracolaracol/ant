// Franja de arriba de la ventana, que reemplaza la barra de título nativa (oculta en
// `tauri.conf.json`): sirve para arrastrar la ventana y tiene tres botones chicos, a la altura de
// los de cerrar, minimizar y maximizar: mostrar u ocultar el panel (la barra lateral), nota nueva
// y cámara nueva. En macOS los botones de la ventana se dibujan encima de esta franja, a la
// izquierda, así que los nuestros empiezan después; en Windows y Linux la barra de título nativa
// queda arriba y los botones van pegados al borde. Cada botón muestra su nombre y su atajo en un
// globo al pasar el mouse.

import { useGloboDeAyuda } from "./GloboDeAyuda";
import { Icono } from "./Icono";
import { useTextos } from "./idioma";

/** Si la app corre en macOS (deja lugar a los botones de la ventana y muestra los atajos con ⌘). */
const ES_MAC = typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);

/** Atajo como se lee en cada sistema: `⌘⇧N` en macOS, `Ctrl+Shift+N` en los otros. */
function textoDelAtajo(tecla: string, conShift = false): string {
  if (ES_MAC) return `⌘${conShift ? "⇧" : ""}${tecla}`;
  return `Ctrl+${conShift ? "Shift+" : ""}${tecla}`;
}

interface Props {
  barraLateralVisible: boolean;
  alMostrarUOcultarBarraLateral(): void;
  alPedirNotaNueva(): void;
  alPedirCamaraNueva(): void;
}

export function BarraSuperior({ barraLateralVisible, alMostrarUOcultarBarraLateral, alPedirNotaNueva, alPedirCamaraNueva }: Props) {
  const textosDeLaInterfaz = useTextos();
  const globoConElNombre = useGloboDeAyuda();

  /** Un botón con icono; su nombre y atajo van en el globo (y en `aria-label`). */
  const botonDeLaBarra = (nombreDelIcono: string, nombreDelBoton: string, atajo: string, alHacerClic: () => void) => (
    <button
      className="barra-superior-boton"
      aria-label={nombreDelBoton}
      onMouseEnter={(evento) => globoConElNombre.mostrarGlobo(evento.currentTarget, `${nombreDelBoton}  ${atajo}`)}
      onMouseLeave={globoConElNombre.ocultarGlobo}
      onClick={() => {
        globoConElNombre.ocultarGlobo();
        alHacerClic();
      }}
    >
      <Icono nombreDelIcono={nombreDelIcono} tamanoEnPixeles={15} />
    </button>
  );

  return (
    // Solo la franja misma arrastra la ventana (Tauri no lo pasa a los hijos): los botones se pueden tocar.
    <div className={`arrastre${ES_MAC ? " con-botones-de-mac" : ""}`} data-tauri-drag-region>
      {botonDeLaBarra(
        barraLateralVisible ? "panel-left-close" : "panel-left-open",
        barraLateralVisible ? textosDeLaInterfaz.ocultarPanel : textosDeLaInterfaz.mostrarPanel,
        textoDelAtajo("\\"),
        alMostrarUOcultarBarraLateral,
      )}
      {botonDeLaBarra("square-pen", textosDeLaInterfaz.notaNuevaBoton, textoDelAtajo("N"), alPedirNotaNueva)}
      {botonDeLaBarra("folder-plus", textosDeLaInterfaz.camaraNueva, textoDelAtajo("N", true), alPedirCamaraNueva)}
      {globoConElNombre.globoParaDibujar}
    </div>
  );
}
