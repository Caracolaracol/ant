// Área «Atajos» de Ajustes: cada acción de la app con su atajo de teclado. Al hacer clic en un
// atajo, espera las teclas nuevas: la siguiente combinación con ⌘ (Ctrl en Windows y Linux) queda
// como su atajo, salvo que ya la use otra acción, el editor o el sistema (lo avisa y sigue
// esperando). Escape o un clic fuera cancelan. Cada atajo cambiado se puede volver al de por
// defecto. Debajo, los atajos fijos del editor, solo para verlos.
// Los cambios se guardan en `Ajustes.atajos_de_teclado` (ver `src/atajos.ts`); los del menú
// (Ajustes, cámara nueva, compilar) los aplica Rust al rehacer el menú.

import { useEffect, useState } from "react";
import type { Ajustes } from "../ajustes";
import {
  ACCIONES_CON_ATAJO,
  ATAJOS_DEL_EDITOR,
  ES_MAC,
  IdDeAccion,
  atajoDeLaAccion,
  atajoDeLaTecla,
  atajosConElCambio,
  motivoParaNoUsarElAtajo,
  textoDelAtajo,
} from "../atajos";
import { Icono } from "../Icono";
import { useTextos } from "../idioma";

interface Props {
  ajustes: Ajustes;
  cambiarAjustes(cambios: Partial<Ajustes>): void;
}

export function PanelAtajos({ ajustes, cambiarAjustes }: Props) {
  const textosDeLaInterfaz = useTextos();
  const atajosElegidos = ajustes.atajos_de_teclado;
  // Acción que espera sus teclas nuevas, o null; y el aviso si la combinación no se pudo usar.
  const [accionQueEspera, setAccionQueEspera] = useState<IdDeAccion | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  /** Deja de esperar teclas (al elegir, cancelar o hacer clic fuera). */
  const dejarDeEsperar = () => {
    setAccionQueEspera(null);
    setAviso(null);
  };

  // Mientras una acción espera sus teclas, la próxima combinación es para ella y para nada más:
  // se escucha antes que nadie (fase de captura) y no sigue a los demás atajos ni a Ajustes, así
  // Escape no los cierra y Cmd+N no abre una nota.
  useEffect(() => {
    if (!accionQueEspera) return;
    const alPresionarTecla = (evento: KeyboardEvent) => {
      evento.preventDefault();
      evento.stopPropagation();
      if (evento.key === "Escape" && !evento.metaKey && !evento.ctrlKey) return dejarDeEsperar();
      const atajo = atajoDeLaTecla(evento, ES_MAC);
      if (!atajo) return; // Solo modificadores, o falta ⌘ / Ctrl: sigue esperando.
      const motivo = motivoParaNoUsarElAtajo(atajosElegidos, accionQueEspera, atajo);
      if (motivo) {
        setAviso(
          motivo.tipo === "reservado"
            ? textosDeLaInterfaz.atajoReservado(textoDelAtajo(atajo, ES_MAC))
            : textosDeLaInterfaz.atajoEnUso(textoDelAtajo(atajo, ES_MAC), textosDeLaInterfaz.accionesConAtajo[motivo.id]),
        );
        return;
      }
      cambiarAjustes({ atajos_de_teclado: atajosConElCambio(atajosElegidos, accionQueEspera, atajo) });
      dejarDeEsperar();
    };
    const cancelarConUnClic = () => dejarDeEsperar();
    window.addEventListener("keydown", alPresionarTecla, true);
    window.addEventListener("mousedown", cancelarConUnClic);
    return () => {
      window.removeEventListener("keydown", alPresionarTecla, true);
      window.removeEventListener("mousedown", cancelarConUnClic);
    };
  }, [accionQueEspera, atajosElegidos, cambiarAjustes, textosDeLaInterfaz]);

  const hayAtajosCambiados = Object.keys(atajosElegidos).length > 0;

  return (
    <>
      <h1>{textosDeLaInterfaz.areas.atajos}</h1>
      <div className="ajuste">
        <p className="ajuste-ayuda">{textosDeLaInterfaz.atajosAyuda(ES_MAC ? "⌘" : "Ctrl")}</p>
        <div className="ajuste-atajos">
          {ACCIONES_CON_ATAJO.map((accion) => {
            const estaEsperando = accion.id === accionQueEspera;
            const estaCambiado = accion.id in atajosElegidos;
            return (
              <div key={accion.id} className="ajuste-atajo">
                <span className="ajuste-atajo-nombre">{textosDeLaInterfaz.accionesConAtajo[accion.id]}</span>
                {estaCambiado && !estaEsperando && (
                  <button
                    className="ajuste-atajo-restablecer"
                    title={textosDeLaInterfaz.restablecerAtajo(textoDelAtajo(accion.porDefecto, ES_MAC))}
                    aria-label={textosDeLaInterfaz.restablecerAtajo(textoDelAtajo(accion.porDefecto, ES_MAC))}
                    onClick={() => cambiarAjustes({ atajos_de_teclado: atajosConElCambio(atajosElegidos, accion.id, null) })}
                  >
                    <Icono nombreDelIcono="rotate-ccw" tamanoEnPixeles={13} />
                  </button>
                )}
                <button
                  className={`ajuste-atajo-teclas${estaEsperando ? " esperando" : ""}${estaCambiado ? " cambiado" : ""}`}
                  // Detiene el mousedown: si no, el clic que empieza a esperar lo cancelaría al instante.
                  onMouseDown={(evento) => evento.stopPropagation()}
                  onClick={() => (estaEsperando ? dejarDeEsperar() : (setAccionQueEspera(accion.id), setAviso(null)))}
                >
                  {estaEsperando ? textosDeLaInterfaz.pulsaLasTeclas : textoDelAtajo(atajoDeLaAccion(atajosElegidos, accion.id), ES_MAC)}
                </button>
                {estaEsperando && aviso && <span className="ajuste-atajo-aviso">{aviso}</span>}
              </div>
            );
          })}
        </div>
        {hayAtajosCambiados && (
          <button className="ajuste-boton" onClick={() => cambiarAjustes({ atajos_de_teclado: {} })}>
            {textosDeLaInterfaz.restablecerTodosLosAtajos}
          </button>
        )}
      </div>
      <div className="ajuste">
        <div className="ajuste-titulo">{textosDeLaInterfaz.atajosDelEditor}</div>
        <div className="ajuste-atajos">
          {ATAJOS_DEL_EDITOR.map((atajoDelEditor) => (
            <div key={atajoDelEditor.id} className="ajuste-atajo">
              <span className="ajuste-atajo-nombre">{textosDeLaInterfaz.accionesConAtajo[atajoDelEditor.id]}</span>
              <kbd className="ajuste-atajo-teclas fijo">{textoDelAtajo(atajoDelEditor.atajo, ES_MAC)}</kbd>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
