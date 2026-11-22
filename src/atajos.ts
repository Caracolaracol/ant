// Atajos de teclado de la app y cómo se cambian (Ajustes → Atajos). Cada acción tiene un atajo
// por defecto; los que el usuario cambia se guardan en `Ajustes.atajos_de_teclado` (solo los
// cambiados, por el id de la acción).
//
// Un atajo se escribe como los entiende el menú de Tauri: modificadores y la tecla física con su
// nombre del navegador (`KeyboardEvent.code`), separados por `+`: `CmdOrCtrl+Shift+KeyN`.
// `CmdOrCtrl` es ⌘ en macOS y Ctrl en Windows y Linux. Usar la tecla física (y no el carácter)
// hace que el atajo no cambie con la distribución del teclado.
//
// Las acciones del menú (`esDelMenu`) las atiende Rust (`src-tauri/src/menu.rs`, que lee los mismos
// ids y valores por defecto); las demás, `useAtajosDeTeclado.ts`. Lo que no depende de la ventana
// está aquí para probarlo aparte (`prueba/automaticas/atajos.prueba.ts`).

/** Si la app corre en macOS: el atajo principal es ⌘ (en los demás sistemas, Ctrl). */
export const ES_MAC = typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);

/** Una acción que se puede hacer con un atajo. Su nombre visible está en `idioma.tsx` (`accionesConAtajo`). */
export interface AccionConAtajo {
  id: IdDeAccion;
  porDefecto: string;
  /** Si la atiende el menú de la app (Rust) y no la ventana. */
  esDelMenu?: boolean;
}

export type IdDeAccion =
  | "nota_nueva"
  | "abrir_nota"
  | "guardar"
  | "guardar_como"
  | "nota_siguiente"
  | "nota_anterior"
  | "mostrar_panel"
  | "camara_nueva"
  | "compilar"
  | "ajustes";

/** Acciones con atajo, en el orden en que aparecen en Ajustes. */
export const ACCIONES_CON_ATAJO: AccionConAtajo[] = [
  { id: "nota_nueva", porDefecto: "CmdOrCtrl+KeyN" },
  { id: "abrir_nota", porDefecto: "CmdOrCtrl+KeyO" },
  { id: "guardar", porDefecto: "CmdOrCtrl+KeyS" },
  { id: "guardar_como", porDefecto: "CmdOrCtrl+Shift+KeyS" },
  { id: "nota_siguiente", porDefecto: "CmdOrCtrl+Shift+BracketRight" },
  { id: "nota_anterior", porDefecto: "CmdOrCtrl+Shift+BracketLeft" },
  { id: "mostrar_panel", porDefecto: "CmdOrCtrl+Backslash" },
  { id: "camara_nueva", porDefecto: "CmdOrCtrl+Shift+KeyN", esDelMenu: true },
  { id: "compilar", porDefecto: "CmdOrCtrl+Shift+KeyE", esDelMenu: true },
  { id: "ajustes", porDefecto: "CmdOrCtrl+Comma", esDelMenu: true },
];

/**
 * Atajos que no se pueden elegir porque ya los usa el sistema o el editor (salir, cerrar, copiar,
 * pegar, cortar, deshacer, rehacer, seleccionar todo, buscar, ocultar, minimizar).
 */
export const ATAJOS_RESERVADOS = [
  "CmdOrCtrl+KeyQ", "CmdOrCtrl+KeyW", "CmdOrCtrl+KeyC", "CmdOrCtrl+KeyV", "CmdOrCtrl+KeyX", "CmdOrCtrl+KeyZ",
  "CmdOrCtrl+Shift+KeyZ", "CmdOrCtrl+KeyA", "CmdOrCtrl+KeyF", "CmdOrCtrl+KeyH", "CmdOrCtrl+KeyM",
];

/** Atajos fijos del editor, que se muestran en Ajustes pero no se cambian (nombres en `idioma.tsx`). */
export const ATAJOS_DEL_EDITOR = [
  { id: "buscar", atajo: "CmdOrCtrl+KeyF" },
  { id: "deshacer", atajo: "CmdOrCtrl+KeyZ" },
  { id: "rehacer", atajo: "CmdOrCtrl+Shift+KeyZ" },
] as const;

/** Atajo vigente de una acción: el que eligió el usuario o el de por defecto. */
export function atajoDeLaAccion(atajosElegidos: Record<string, string>, id: IdDeAccion): string {
  return atajosElegidos[id] ?? ACCIONES_CON_ATAJO.find((accion) => accion.id === id)!.porDefecto;
}

/** Lo que importa de una tecla pulsada (un `KeyboardEvent` sirve tal cual). */
export interface TeclaPulsada {
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/** Teclas que solo son modificadores: pulsarlas solas todavía no forma un atajo. */
const TECLAS_MODIFICADORAS = /^(Meta|Control|Alt|Shift|OS|CapsLock)/;

/**
 * Atajo de una tecla pulsada, escrito como los de `ACCIONES_CON_ATAJO`, o `null` si no forma uno:
 * tiene que llevar ⌘ (en macOS) o Ctrl (en los demás), y una tecla que no sea un modificador. En
 * macOS, Ctrl también vale como modificador aparte.
 */
export function atajoDeLaTecla(tecla: TeclaPulsada, esMac: boolean): string | null {
  if (!tecla.code || TECLAS_MODIFICADORAS.test(tecla.code)) return null;
  const tieneLaTeclaPrincipal = esMac ? tecla.metaKey : tecla.ctrlKey;
  if (!tieneLaTeclaPrincipal) return null;
  const partes = ["CmdOrCtrl"];
  if (esMac && tecla.ctrlKey) partes.push("Ctrl");
  if (!esMac && tecla.metaKey) partes.push("Super");
  if (tecla.altKey) partes.push("Alt");
  if (tecla.shiftKey) partes.push("Shift");
  partes.push(tecla.code);
  return partes.join("+");
}

/** Si una tecla pulsada es el atajo `atajo`. */
export const esElAtajo = (tecla: TeclaPulsada, atajo: string, esMac: boolean) => atajoDeLaTecla(tecla, esMac) === atajo;

/** Cómo se lee cada tecla en pantalla (las demás, con su nombre sin `Key` ni `Digit`). */
const TEXTO_DE_LAS_TECLAS: Record<string, string> = {
  Comma: ",", Period: ".", Slash: "/", Backslash: "\\", BracketLeft: "[", BracketRight: "]", Semicolon: ";",
  Quote: "'", Backquote: "`", Minus: "-", Equal: "=", Space: "Space", Enter: "↩", Backspace: "⌫", Tab: "⇥",
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Escape: "Esc", Delete: "⌦",
};

/**
 * Atajo como se lee en pantalla: `⌃⌥⇧⌘N` en macOS (en el orden de Apple) y `Ctrl+Alt+Shift+N`
 * en Windows y Linux.
 */
export function textoDelAtajo(atajo: string, esMac: boolean): string {
  const partes = atajo.split("+");
  const codigoDeLaTecla = partes.pop() ?? "";
  const tecla = TEXTO_DE_LAS_TECLAS[codigoDeLaTecla] ?? codigoDeLaTecla.replace(/^(Key|Digit|Numpad)/, "");
  const tiene = (modificador: string) => partes.includes(modificador);
  if (esMac) {
    return `${tiene("Ctrl") ? "⌃" : ""}${tiene("Alt") ? "⌥" : ""}${tiene("Shift") ? "⇧" : ""}${tiene("CmdOrCtrl") ? "⌘" : ""}${tecla}`;
  }
  const modificadores = [tiene("CmdOrCtrl") && "Ctrl", tiene("Super") && "Win", tiene("Alt") && "Alt", tiene("Shift") && "Shift"].filter(Boolean);
  return [...modificadores, tecla].join("+");
}

/** Qué impide usar un atajo para una acción: otra acción que ya lo tiene, o que lo usa el sistema. */
export type MotivoParaNoUsarElAtajo = { tipo: "reservado" } | { tipo: "en_uso"; id: IdDeAccion | (typeof ATAJOS_DEL_EDITOR)[number]["id"] };

/** Por qué no se puede usar `atajo` para la acción `id`, o `null` si se puede. */
export function motivoParaNoUsarElAtajo(atajosElegidos: Record<string, string>, id: IdDeAccion, atajo: string): MotivoParaNoUsarElAtajo | null {
  const delEditor = ATAJOS_DEL_EDITOR.find((atajoDelEditor) => atajoDelEditor.atajo === atajo);
  if (delEditor) return { tipo: "en_uso", id: delEditor.id };
  if (ATAJOS_RESERVADOS.includes(atajo)) return { tipo: "reservado" };
  const otraAccion = ACCIONES_CON_ATAJO.find((accion) => accion.id !== id && atajoDeLaAccion(atajosElegidos, accion.id) === atajo);
  return otraAccion ? { tipo: "en_uso", id: otraAccion.id } : null;
}

/**
 * Atajos elegidos después de poner `atajo` a la acción `id`: si es el de por defecto, se quita de
 * los elegidos (así un cambio futuro del valor por defecto le llega).
 */
export function atajosConElCambio(atajosElegidos: Record<string, string>, id: IdDeAccion, atajo: string | null): Record<string, string> {
  const { [id]: _anterior, ...losDemas } = atajosElegidos;
  const porDefecto = ACCIONES_CON_ATAJO.find((accion) => accion.id === id)!.porDefecto;
  return atajo && atajo !== porDefecto ? { ...losDemas, [id]: atajo } : losDemas;
}
