// Página de prueba del diálogo «Compilar y exportar» fuera de Tauri (`pnpm dev`, luego
// http://localhost:1420/prueba/compilar.html, con `?es` para verlo en español y `?libro` para
// abrirlo con el estilo libro). Muestra el diálogo con una carpeta de ejemplo para revisar su
// diseño; exportar no funciona aquí porque necesita los comandos de Rust.

import ReactDOM from "react-dom/client";
import "../src/App.css";
import { AJUSTES_POR_DEFECTO, type Ajustes, type OpcionesDeCompilacion } from "../src/ajustes";
import type { EntradaDelArbol } from "../src/arbolDeCarpetas";
import { Compilar } from "../src/compilar/Compilar";
import { ContextoDeTextos, textosDelIdioma } from "../src/idioma";

const base = "/Users/yo/Hormiguero/Novela";
const nota = (ruta: string): EntradaDelArbol => ({ nombre: ruta.split("/").pop()!, ruta: `${base}/${ruta}`, esCarpeta: false, hijos: [] });
const carpeta = (nombre: string, hijos: EntradaDelArbol[]): EntradaDelArbol => ({ nombre, ruta: `${base}/${nombre}`, esCarpeta: true, hijos });
const arbol: EntradaDelArbol[] = [
  carpeta("Libro I", [nota("Libro I/01 - El hormiguero.md"), nota("Libro I/02 - La lluvia.md"), nota("Libro I/03 - La mudanza.md"), nota("Libro I/Notas de investigación.md")]),
  carpeta("Personajes", [nota("Personajes/Reina.md")]),
  nota("Ideas.md"),
];
const texto = "# Capítulo\n\n" + "La hormiga caminaba por el borde de la mesa pensando en la lluvia. ".repeat(60);
const enEspanol = location.search.includes("es");
const ajustes: Ajustes = { ...AJUSTES_POR_DEFECTO, idioma: enEspanol ? "es" : "en", nombre_del_autor: "Agustín Rojas", hormiguero: "/Users/yo/Hormiguero", camara_abierta: "Novela" };
const opcionesGuardadasPorCarpeta: Record<string, OpcionesDeCompilacion> = {};
if (location.search.includes("libro")) {
  Object.assign(opcionesGuardadasPorCarpeta, {
    [`${base}/Libro I`]: { orden: [], excluidas: [`${base}/Libro I/Notas de investigación.md`], titulo: "La colonia", formato: "pdf", estilo: "libro", pagina: "a4", origenTitulo: "titulo", tipografia: true },
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ContextoDeTextos.Provider value={textosDelIdioma(ajustes.idioma)}>
    <main className="app" />
    <Compilar
      carpetaDeLaCamara={base}
      arbolDeLaCamara={arbol}
      rutaDeLaNotaVisible={`${base}/Libro I/02 - La lluvia.md`}
      ajustes={ajustes}
      textoDeNotaAbiertaPorRuta={() => texto}
      cambiarAjustes={() => {}}
      opcionesGuardadasPorCarpeta={opcionesGuardadasPorCarpeta}
      alRecordarOpciones={() => {}}
      alCerrar={() => {}}
    />
  </ContextoDeTextos.Provider>,
);
