// Estado del cifrado de las cámaras para la ventana: si la cámara abierta está cifrada y, en ese
// caso, bloqueada o desbloqueada; y cuáles cámaras del hormiguero están cifradas (para el candado
// del selector y Ajustes). Bloquea sola la cámara cifrada que se deja al pasar a otra (y Rust
// olvida todas las llaves al cerrar Ant). Lo que hay que hacer en la ventana al bloquear (guardar
// y cerrar sus notas, que el editor olvide su texto) lo pasa `App` como `prepararseParaBloquear`.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  EstadoDeCifrado,
  bloquearCamaraEnRust,
  cifrarCamara,
  desbloquearCamara,
  leerEstadoDeCifrado,
  listarCamarasCifradas,
  quitarCifradoDeLaCamara,
} from "./camarasCifradas";

interface Parametros {
  carpetaDelHormiguero: string | null;
  camarasDelHormiguero: string[] | null;
  /** Carpeta de la cámara abierta, o `null`. */
  carpetaDeLaCamara: string | null;
  /** Guarda y cierra lo abierto de una cámara antes de bloquearla. */
  prepararseParaBloquear(carpetaDeLaCamara: string): Promise<void>;
  mostrarError(error: unknown): void;
}

export function useCifradoDeLaCamara({ carpetaDelHormiguero, camarasDelHormiguero, carpetaDeLaCamara, prepararseParaBloquear, mostrarError }: Parametros) {
  // Estado de cifrado leído y de qué cámara es (así, recién cambiada la cámara, no se usa el de la
  // anterior), y nombres de las cámaras cifradas.
  const [estadoLeido, setEstadoLeido] = useState<{ carpeta: string | null; estado: EstadoDeCifrado | null }>({ carpeta: null, estado: null });
  const estadoDeLaCamaraAbierta = estadoLeido.carpeta === carpetaDeLaCamara ? estadoLeido.estado : null;
  const setEstadoDeLaCamaraAbierta = useCallback(
    (estado: EstadoDeCifrado | null) => setEstadoLeido({ carpeta: carpetaDeLaCamara, estado }),
    [carpetaDeLaCamara],
  );
  const [camarasCifradas, setCamarasCifradas] = useState<string[]>([]);
  const prepararseParaBloquearVigente = useRef(prepararseParaBloquear);
  prepararseParaBloquearVigente.current = prepararseParaBloquear;

  /** Vuelve a leer el estado de la cámara abierta y la lista de cámaras cifradas. */
  const releerCifrado = useCallback(async () => {
    const [estado, cifradas] = await Promise.all([
      carpetaDeLaCamara ? leerEstadoDeCifrado(carpetaDeLaCamara) : Promise.resolve(null),
      carpetaDelHormiguero && camarasDelHormiguero ? listarCamarasCifradas(carpetaDelHormiguero, camarasDelHormiguero) : Promise.resolve([]),
    ]);
    setEstadoLeido({ carpeta: carpetaDeLaCamara, estado });
    setCamarasCifradas(cifradas);
  }, [carpetaDeLaCamara, carpetaDelHormiguero, camarasDelHormiguero]);

  useEffect(() => {
    releerCifrado().catch(mostrarError);
  }, [releerCifrado, mostrarError]);

  /** Bloquea una cámara cifrada: primero cierra lo suyo en la ventana, después Rust olvida su llave. */
  const bloquearCamara = useCallback(async (carpeta: string) => {
    await prepararseParaBloquearVigente.current(carpeta);
    await bloquearCamaraEnRust(carpeta);
    if (carpeta === carpetaDeLaCamara) setEstadoDeLaCamaraAbierta("bloqueada");
  }, [carpetaDeLaCamara, setEstadoDeLaCamaraAbierta]);

  // Al pasar a otra cámara, la cámara cifrada que se deja se bloquea sola.
  const camaraAnterior = useRef<{ carpeta: string | null; estado: EstadoDeCifrado | null }>({ carpeta: null, estado: null });
  useEffect(() => {
    const anterior = camaraAnterior.current;
    if (anterior.carpeta && anterior.carpeta !== carpetaDeLaCamara && anterior.estado === "desbloqueada") {
      bloquearCamara(anterior.carpeta).catch(mostrarError);
    }
    camaraAnterior.current = { carpeta: carpetaDeLaCamara, estado: estadoDeLaCamaraAbierta };
  }, [carpetaDeLaCamara, estadoDeLaCamaraAbierta, bloquearCamara, mostrarError]);

  /** Desbloquea la cámara abierta con su contraseña (falla si es incorrecta). */
  const desbloquearLaCamaraAbierta = useCallback(async (contrasena: string) => {
    if (!carpetaDeLaCamara) return;
    await desbloquearCamara(carpetaDeLaCamara, contrasena);
    setEstadoDeLaCamaraAbierta("desbloqueada");
  }, [carpetaDeLaCamara, setEstadoDeLaCamaraAbierta]);

  /**
   * Cifra una cámara. Si es la abierta queda desbloqueada (sus notas siguen abiertas); si es otra,
   * se bloquea enseguida.
   */
  const cifrarUnaCamara = useCallback(async (carpeta: string, contrasena: string) => {
    await cifrarCamara(carpeta, contrasena);
    if (carpeta !== carpetaDeLaCamara) await bloquearCamara(carpeta);
    await releerCifrado();
  }, [carpetaDeLaCamara, bloquearCamara, releerCifrado]);

  /** Quita el cifrado de una cámara (pide su contraseña). */
  const quitarCifradoDeUnaCamara = useCallback(async (carpeta: string, contrasena: string) => {
    await quitarCifradoDeLaCamara(carpeta, contrasena);
    await releerCifrado();
  }, [releerCifrado]);

  return {
    estadoDeLaCamaraAbierta,
    laCamaraEstaBloqueada: estadoDeLaCamaraAbierta === "bloqueada",
    camarasCifradas,
    desbloquearLaCamaraAbierta,
    bloquearCamara,
    cifrarUnaCamara,
    quitarCifradoDeUnaCamara,
  };
}
