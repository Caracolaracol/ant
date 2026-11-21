// Colores de la app. Todo lo que se ve (ventana principal, Ajustes y el editor) usa las variables
// CSS de `App.css`; aquí están sus nombres, los temas listos para elegir y la función que aplica
// los colores elegidos en los ajustes sobre esas variables. Se llama desde `main.tsx` al abrir la
// app y cada vez que cambian los ajustes.

/** Variables de color que se pueden cambiar (sus nombres visibles están en `idioma.tsx`). */
export const VARIABLES_DE_COLOR = [
  "fondo",
  "fondo-bajo",
  "texto",
  "tenue",
  "titulo",
  "acento",
  "codigo",
  "seleccion",
  "coincidencia",
] as const;

export type ColoresPorVariable = Record<string, string>;

/**
 * Temas listos: cada uno define todas las variables. El primero, «Ant» (amarillo de la hormiga
 * sobre oscuro, como el icono), es el de por defecto: el de `App.css`. Sus nombres visibles están en `idioma.tsx` (`nombresTemas`).
 */
export const TEMAS: { id: string; colores: ColoresPorVariable }[] = [
  {
    id: "hormiga",
    colores: { fondo: "#1d1d20", "fondo-bajo": "#141415", texto: "#e6e6dc", tenue: "#7d7d70", titulo: "#ffffff", acento: "#e5ea15", codigo: "#c9d48a", seleccion: "#3d3e26", coincidencia: "#33341f" },
  },
  {
    id: "oscuro",
    colores: { fondo: "#1d1d20", "fondo-bajo": "#161617", texto: "#e8e8e6", tenue: "#7a7a78", titulo: "#ffffff", acento: "#f9a26c", codigo: "#a9c7f9", seleccion: "#3a3f5c", coincidencia: "#33384d" },
  },
  {
    id: "noche",
    colores: { fondo: "#15192b", "fondo-bajo": "#10131f", texto: "#d6dbf0", tenue: "#6b7290", titulo: "#ffffff", acento: "#7aa2f7", codigo: "#9ece6a", seleccion: "#2e3657", coincidencia: "#262c47" },
  },
  {
    id: "papel",
    colores: { fondo: "#f6f3ec", "fondo-bajo": "#ebe7dd", texto: "#2b2a27", tenue: "#8c877b", titulo: "#000000", acento: "#c4581f", codigo: "#2f5fa8", seleccion: "#d3d9ec", coincidencia: "#e1e5f1" },
  },
  {
    id: "sepia",
    colores: { fondo: "#f1e7d0", "fondo-bajo": "#e6d9bc", texto: "#433422", tenue: "#9a8566", titulo: "#2a1e10", acento: "#b5532a", codigo: "#5a6e2e", seleccion: "#d9c79f", coincidencia: "#e3d5b3" },
  },
];

/** Colores por defecto (los del tema «Ant»), para mostrar el valor actual de lo que no se cambió. */
export const COLORES_POR_DEFECTO: ColoresPorVariable = TEMAS[0].colores;

/**
 * Pone los colores guardados en las variables CSS de la ventana. Las variables que no vienen en
 * `colores` vuelven a su valor de `App.css`. También avisa al sistema si el fondo es claro u
 * oscuro (`color-scheme`), para que las barras de scroll y los controles nativos combinen.
 */
export function aplicarColores(coloresElegidos: ColoresPorVariable) {
  const estiloDelDocumento = document.documentElement.style;
  for (const nombreDeLaVariable of VARIABLES_DE_COLOR) {
    const colorElegido = coloresElegidos[nombreDeLaVariable];
    if (colorElegido) estiloDelDocumento.setProperty(`--${nombreDeLaVariable}`, colorElegido);
    else estiloDelDocumento.removeProperty(`--${nombreDeLaVariable}`);
  }
  estiloDelDocumento.colorScheme = esColorClaro(coloresElegidos.fondo ?? COLORES_POR_DEFECTO.fondo) ? "light" : "dark";
}

/** Indica si un color `#rrggbb` es claro (luminancia percibida sobre la mitad). */
export function esColorClaro(colorHexadecimal: string): boolean {
  const valorNumerico = parseInt(colorHexadecimal.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(valorNumerico)) return false;
  const [rojo, verde, azul] = [(valorNumerico >> 16) & 255, (valorNumerico >> 8) & 255, valorNumerico & 255];
  return 0.299 * rojo + 0.587 * verde + 0.114 * azul > 140;
}
