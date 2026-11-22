// Cámaras cifradas desde la interfaz: llamadas a `src-tauri/src/camaras_cifradas.rs` (cifrar una
// cámara con contraseña, desbloquearla, bloquearla, quitarle el cifrado y saber cuáles lo están) y
// los errores que Rust devuelve como código (`camara-bloqueada`, `contrasena-incorrecta`), que aquí
// se pasan al idioma de la app. Lo que es cifrar y cómo se guarda está explicado en el archivo de Rust.

import { invoke } from "@tauri-apps/api/core";
import type { TextosDeLaInterfaz } from "../idioma";

/** Si una cámara está cifrada y, en ese caso, si está bloqueada o desbloqueada. */
export type EstadoDeCifrado = "sin_cifrar" | "bloqueada" | "desbloqueada";

export const leerEstadoDeCifrado = (carpetaDeLaCamara: string) => invoke<EstadoDeCifrado>("estado_de_cifrado", { carpetaDeLaCamara });

/** Nombres de las cámaras cifradas entre `camaras` (para marcarlas con un candado). */
export const listarCamarasCifradas = (carpetaDelHormiguero: string, camaras: string[]) =>
  invoke<string[]>("camaras_cifradas", { carpetaDelHormiguero, camaras });

/** Cifra una cámara con una contraseña; queda desbloqueada. */
export const cifrarCamara = (carpetaDeLaCamara: string, contrasena: string) => invoke<void>("cifrar_camara", { carpetaDeLaCamara, contrasena });

export const desbloquearCamara = (carpetaDeLaCamara: string, contrasena: string) =>
  invoke<void>("desbloquear_camara", { carpetaDeLaCamara, contrasena });

export const bloquearCamaraEnRust = (carpetaDeLaCamara: string) => invoke<void>("bloquear_camara", { carpetaDeLaCamara });

/** Descifra todos los archivos de la cámara y borra su llave (pide la contraseña). */
export const quitarCifradoDeLaCamara = (carpetaDeLaCamara: string, contrasena: string) =>
  invoke<void>("quitar_cifrado_de_la_camara", { carpetaDeLaCamara, contrasena });

/** Códigos de error de Rust para las cámaras cifradas. */
export const ERROR_CAMARA_BLOQUEADA = "camara-bloqueada";
export const ERROR_CONTRASENA_INCORRECTA = "contrasena-incorrecta";

/** Si un error es el de una cámara bloqueada (leer o guardar una nota de una cámara cifrada sin desbloquear). */
export const esErrorDeCamaraBloqueada = (error: unknown) => String(error) === ERROR_CAMARA_BLOQUEADA;

/** Texto para mostrar un error: los de las cámaras cifradas en el idioma de la app; los demás, tal cual. */
export function textoDelError(error: unknown, textosDeLaInterfaz: TextosDeLaInterfaz): string {
  const texto = String(error);
  if (texto === ERROR_CAMARA_BLOQUEADA) return textosDeLaInterfaz.errorCamaraBloqueada;
  if (texto === ERROR_CONTRASENA_INCORRECTA) return textosDeLaInterfaz.errorContrasenaIncorrecta;
  return texto;
}
