// Selector de cámaras, arriba de la barra lateral: muestra el nombre de la cámara abierta y, al
// hacer clic, despliega la lista de las cámaras del hormiguero (la abierta con ✓, la «Entrada»
// primero si hay notas sueltas, las cifradas con candado) para cambiar a otra, «Bloquear ahora»
// si la abierta es cifrada y está desbloqueada, y al final «Cámara nueva…».

import { useCallback, useState } from "react";
import { esLaEntrada, nombreVisibleDeLaCamara } from "../hormigueros/hormigueros";
import { Icono } from "../Icono";
import { useTextos } from "../idioma";
import { MenuContextual, type OpcionDelMenu } from "../MenuContextual";

interface Props {
  /** Nombre (de carpeta) de la cámara abierta, o `CAMARA_DE_ENTRADA`. */
  nombreDeLaCamaraAbierta: string;
  /** Ruta de la cámara abierta, para mostrarla al pasar el mouse. */
  carpetaDeLaCamara: string;
  camarasDelHormiguero: string[];
  /** Cámaras cifradas (llevan un candado). */
  camarasCifradas: string[];
  alAbrirCamara(nombreDeLaCamara: string): void;
  alPedirCamaraNueva(): void;
  /** Bloquea la cámara abierta, si es cifrada y está desbloqueada (si no, `null`). */
  alBloquearLaCamara: (() => void) | null;
}

export function SelectorDeCamara(props: Props) {
  const { nombreDeLaCamaraAbierta, camarasDelHormiguero } = props;
  const textosDeLaInterfaz = useTextos();
  // Posición de la lista desplegada (bajo el botón), o null si está cerrada.
  const [posicionDeLaLista, setPosicionDeLaLista] = useState<{ x: number; y: number } | null>(null);
  const cerrarLista = useCallback(() => setPosicionDeLaLista(null), []);

  /** Abre la lista bajo el botón, o la cierra si ya estaba abierta. */
  const abrirOCerrarLista = (botonDelSelector: HTMLElement) => {
    if (posicionDeLaLista) return cerrarLista();
    const rectanguloDelBoton = botonDelSelector.getBoundingClientRect();
    setPosicionDeLaLista({ x: rectanguloDelBoton.left, y: rectanguloDelBoton.bottom + 4 });
  };

  const opcionesDeLaLista: OpcionDelMenu[] = [
    ...camarasDelHormiguero.map((nombreDeLaCamara) => ({
      texto: nombreVisibleDeLaCamara(nombreDeLaCamara, textosDeLaInterfaz.entrada),
      estaMarcada: nombreDeLaCamara === nombreDeLaCamaraAbierta,
      icono: props.camarasCifradas.includes(nombreDeLaCamara) ? "lock" : undefined,
      alElegir: () => nombreDeLaCamara !== nombreDeLaCamaraAbierta && props.alAbrirCamara(nombreDeLaCamara),
    })),
    ...(props.alBloquearLaCamara
      ? [{ texto: textosDeLaInterfaz.bloquearAhora, icono: "lock", vaSeparadaDeLaAnterior: true, alElegir: props.alBloquearLaCamara }]
      : []),
    { texto: textosDeLaInterfaz.camaraNuevaBoton, icono: "folder-plus", vaSeparadaDeLaAnterior: true, alElegir: props.alPedirCamaraNueva },
  ];

  return (
    <>
      <button
        className="selector-de-camara"
        title={esLaEntrada(nombreDeLaCamaraAbierta) ? textosDeLaInterfaz.entradaAyuda : props.carpetaDeLaCamara}
        aria-label={textosDeLaInterfaz.cambiarDeCamara}
        aria-expanded={Boolean(posicionDeLaLista)}
        // Sin esto, el mousedown cerraría la lista abierta y el clic la volvería a abrir.
        onMouseDown={(evento) => evento.stopPropagation()}
        onClick={(evento) => abrirOCerrarLista(evento.currentTarget)}
      >
        <span className="selector-de-camara-nombre">{nombreVisibleDeLaCamara(nombreDeLaCamaraAbierta, textosDeLaInterfaz.entrada)}</span>
        {props.camarasCifradas.includes(nombreDeLaCamaraAbierta) && (
          <span className="selector-de-camara-candado" title={textosDeLaInterfaz.candadoCamaraCifrada}>
            <Icono nombreDelIcono={props.alBloquearLaCamara ? "lock-open" : "lock"} tamanoEnPixeles={12} />
          </span>
        )}
        <Icono nombreDelIcono="chevrons-up-down" tamanoEnPixeles={12} />
      </button>
      {posicionDeLaLista && (
        <MenuContextual x={posicionDeLaLista.x} y={posicionDeLaLista.y} opciones={opcionesDeLaLista} alCerrar={cerrarLista} />
      )}
    </>
  );
}
