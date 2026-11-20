// Qué se sabe de cada nota abierta en la ventana. El texto vivo de la nota lo tiene el editor
// (CodeMirror); aquí va lo que necesita el resto de la interfaz: su archivo, si tiene cambios sin
// guardar, el último texto conocido (para contar palabras y buscar títulos, al día tras una pausa)
// y lo que hay en su archivo (para notar si cambió fuera de Ant).

/** Una nota abierta. */
export interface NotaAbierta {
  /**
   * Identificador de la nota en el editor. Las notas con archivo usan siempre el mismo para la
   * misma ruta (`idDeNotaConArchivo`), así el editor las reconoce al volver a abrirlas.
   */
  id: string;
  /** Ruta de su archivo, o `null` si es una nota nueva que todavía no se guardó. */
  rutaDelArchivo: string | null;
  /**
   * Último texto conocido de la nota. No se pone al día en cada tecla (eso haría lento escribir
   * en notas largas) sino tras una pausa; el texto exacto se le pide al editor.
   */
  ultimoTextoConocido: string;
  /** Si tiene cambios que todavía no están en su archivo. */
  tieneCambiosSinGuardar: boolean;
  /**
   * Lo que hay en su archivo según la última vez que Ant lo leyó o lo guardó (`null` si no tiene
   * archivo). Sirve para notar si el archivo cambió fuera de Ant y no pisar esos cambios.
   */
  textoQueHayEnDisco: string | null;
}

let contadorDeNotasNuevas = 0;

/** Nota nueva y en blanco, sin archivo: la que se crea con Cmd+N o al cerrar la última. */
export const crearNotaEnBlanco = (): NotaAbierta => ({
  id: `nota-nueva-${++contadorDeNotasNuevas}`,
  rutaDelArchivo: null,
  ultimoTextoConocido: "",
  tieneCambiosSinGuardar: false,
  textoQueHayEnDisco: null,
});

/**
 * Identificador de la nota de un archivo: siempre el mismo para la misma ruta, así el editor la
 * reconoce al volver a abrirla y recupera su cursor y su historial de deshacer.
 */
export const idDeNotaConArchivo = (rutaDelArchivo: string) => `archivo:${rutaDelArchivo}`;

/**
 * Indica si una nota es la nota en blanco con que arranca la app (sin archivo ni texto). Esa no
 * se lista en la barra lateral y se descarta sola al abrir otra.
 */
export const esNotaEnBlanco = (nota: NotaAbierta) =>
  !nota.rutaDelArchivo && !nota.ultimoTextoConocido && !nota.tieneCambiosSinGuardar;

/**
 * Indica si una nota espera que el usuario la guarde: solo las nuevas (sin archivo) con algo
 * escrito. Las demás se guardan solas, así que no se marcan (la marca parpadearía al escribir).
 */
export const esperaQueLaGuarden = (nota: NotaAbierta) => nota.tieneCambiosSinGuardar && !nota.rutaDelArchivo;
