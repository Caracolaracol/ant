// Barra de estado, al pie de la ventana: a la izquierda el nombre de la nota visible (con `*` si
// es una nota nueva sin guardar) y a la derecha el conteo de palabras, líneas y caracteres, o el
// último error si lo hay (permisos, disco lleno, un archivo cambiado fuera de Ant…).

import { useMemo } from "react";
import { contarPalabrasLineasYCaracteres } from "./conteoDelTexto";
import { useTextos } from "./idioma";

interface Props {
  nombreDeLaNota: string;
  /** Si la nota espera que el usuario la guarde (nota nueva con algo escrito). */
  esperaQueLaGuarden: boolean;
  /** Texto con que se cuenta: el último conocido de la nota (al día tras una pausa al escribir). */
  textoParaContar: string;
  /** Error que mostrar en vez del conteo, o `null`. */
  mensajeDeError: string | null;
}

export function BarraDeEstado({ nombreDeLaNota, esperaQueLaGuarden, textoParaContar, mensajeDeError }: Props) {
  const textosDeLaInterfaz = useTextos();
  // El conteo recorre la nota entera: solo se recalcula cuando cambia el texto para contar.
  const { cantidadDePalabras, cantidadDeLineas, cantidadDeCaracteres } = useMemo(
    () => contarPalabrasLineasYCaracteres(textoParaContar),
    [textoParaContar],
  );
  return (
    <footer className="estado">
      <span>{esperaQueLaGuarden ? `${nombreDeLaNota} *` : nombreDeLaNota}</span>
      {mensajeDeError ? (
        <span className="estado-error">{mensajeDeError}</span>
      ) : (
        <span>{textosDeLaInterfaz.conteo(cantidadDePalabras, cantidadDeLineas, cantidadDeCaracteres)}</span>
      )}
    </footer>
  );
}
