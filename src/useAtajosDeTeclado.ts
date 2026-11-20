// Atajos de teclado de la ventana principal que no están en el menú de la app:
//   Cmd+N nota nueva · Cmd+O abrir · Cmd+S guardar · Cmd+Shift+S guardar como
//   Cmd+Shift+] / Cmd+Shift+[ nota abierta siguiente / anterior · Cmd+\ mostrar u ocultar la barra lateral
// (Cmd+, y Cmd+Shift+E los maneja el menú, en Rust.) Los errores de cada acción (permisos, disco
// lleno…) van a la barra de estado.

import { useEffect, useRef } from "react";

/** Lo que hace cada atajo. Cada acción puede devolver una promesa; si falla, se muestra el error. */
export interface AccionesDeLosAtajos {
  abrirNotaEnBlanco(): Promise<void> | void;
  abrirNotaConElDialogo(): Promise<void> | void;
  guardarNotaVisible(enOtroArchivo: boolean): Promise<void> | void;
  pasarANotaVecina(paso: 1 | -1): void;
  mostrarUOcultarBarraLateral(): void;
}

export function useAtajosDeTeclado(
  acciones: AccionesDeLosAtajos,
  alTerminarBien: () => void,
  alFallar: (error: unknown) => void,
) {
  // Las acciones en una ref: el listener se registra una sola vez y siempre usa las vigentes.
  const accionesVigentes = useRef({ acciones, alTerminarBien, alFallar });
  accionesVigentes.current = { acciones, alTerminarBien, alFallar };

  useEffect(() => {
    const alPresionarTecla = (evento: KeyboardEvent) => {
      if (!(evento.metaKey || evento.ctrlKey)) return;
      const { acciones: accionesDeAhora, alTerminarBien: terminarBien, alFallar: fallar } = accionesVigentes.current;
      const tecla = evento.key.toLowerCase();
      let accionDelAtajo: (() => Promise<void> | void) | null = null;
      if (tecla === "s") accionDelAtajo = () => accionesDeAhora.guardarNotaVisible(evento.shiftKey);
      else if (tecla === "o") accionDelAtajo = accionesDeAhora.abrirNotaConElDialogo;
      else if (tecla === "n") accionDelAtajo = accionesDeAhora.abrirNotaEnBlanco;
      else if (tecla === "\\") accionDelAtajo = accionesDeAhora.mostrarUOcultarBarraLateral;
      // Con Shift, las teclas [ y ] cambian de carácter según el teclado; se usa la tecla física.
      else if (evento.shiftKey && evento.code === "BracketRight") accionDelAtajo = () => accionesDeAhora.pasarANotaVecina(1);
      else if (evento.shiftKey && evento.code === "BracketLeft") accionDelAtajo = () => accionesDeAhora.pasarANotaVecina(-1);
      if (!accionDelAtajo) return;
      evento.preventDefault();
      Promise.resolve(accionDelAtajo()).then(terminarBien, fallar);
    };
    window.addEventListener("keydown", alPresionarTecla);
    return () => window.removeEventListener("keydown", alPresionarTecla);
  }, []);
}
