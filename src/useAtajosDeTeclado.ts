// Atajos de teclado de la ventana principal que no están en el menú de la app: nota nueva (la
// ventanita «Nota nueva»), abrir, guardar, guardar como, nota abierta siguiente y anterior, y
// mostrar u ocultar la barra lateral. Las teclas son las de `atajos.ts` (por defecto Cmd+N, Cmd+O,
// Cmd+S, Cmd+Shift+S, Cmd+Shift+] / [ y Cmd+\), o las que el usuario eligió en Ajustes → Atajos.
// (Ajustes, cámara nueva y compilar los maneja el menú, en Rust.) Los errores de cada acción
// (permisos, disco lleno…) van a la barra de estado.

import { useEffect, useRef } from "react";
import { ES_MAC, atajoDeLaAccion, esElAtajo, type IdDeAccion } from "./atajos";

/** Lo que hace cada atajo. Cada acción puede devolver una promesa; si falla, se muestra el error. */
export interface AccionesDeLosAtajos {
  pedirNotaNueva(): Promise<void> | void;
  abrirNotaConElDialogo(): Promise<void> | void;
  guardarNotaVisible(enOtroArchivo: boolean): Promise<void> | void;
  pasarANotaVecina(paso: 1 | -1): void;
  mostrarUOcultarBarraLateral(): void;
}

export function useAtajosDeTeclado(
  acciones: AccionesDeLosAtajos,
  /** Atajos que eligió el usuario (`Ajustes.atajos_de_teclado`); los que faltan, los de por defecto. */
  atajosElegidos: Record<string, string>,
  alTerminarBien: () => void,
  alFallar: (error: unknown) => void,
) {
  // Las acciones en una ref: el listener se registra una sola vez y siempre usa las vigentes.
  const vigentes = useRef({ acciones, atajosElegidos, alTerminarBien, alFallar });
  vigentes.current = { acciones, atajosElegidos, alTerminarBien, alFallar };

  useEffect(() => {
    const alPresionarTecla = (evento: KeyboardEvent) => {
      if (!(evento.metaKey || evento.ctrlKey)) return;
      const { acciones: accionesDeAhora, atajosElegidos: atajos, alTerminarBien: terminarBien, alFallar: fallar } = vigentes.current;
      // Qué hace cada atajo de la ventana.
      const accionDeCadaAtajo: [IdDeAccion, () => Promise<void> | void][] = [
        ["nota_nueva", accionesDeAhora.pedirNotaNueva],
        ["abrir_nota", accionesDeAhora.abrirNotaConElDialogo],
        ["guardar", () => accionesDeAhora.guardarNotaVisible(false)],
        ["guardar_como", () => accionesDeAhora.guardarNotaVisible(true)],
        ["nota_siguiente", () => accionesDeAhora.pasarANotaVecina(1)],
        ["nota_anterior", () => accionesDeAhora.pasarANotaVecina(-1)],
        ["mostrar_panel", accionesDeAhora.mostrarUOcultarBarraLateral],
      ];
      const accionDelAtajo = accionDeCadaAtajo.find(([id]) => esElAtajo(evento, atajoDeLaAccion(atajos, id), ES_MAC))?.[1];
      if (!accionDelAtajo) return;
      evento.preventDefault();
      Promise.resolve(accionDelAtajo()).then(terminarBien, fallar);
    };
    window.addEventListener("keydown", alPresionarTecla);
    return () => window.removeEventListener("keydown", alPresionarTecla);
  }, []);
}
