// Página de prueba del diálogo «Compilar y exportar» fuera de Tauri (`pnpm dev`, luego
// http://localhost:1420/prueba/compilar.html, con `?es` para verlo en español y `?libro` para
// abrirlo con el estilo libro). Muestra el diálogo con una carpeta de ejemplo para revisar su
// diseño; exportar no funciona aquí porque necesita los comandos de Rust.

import ReactDOM from "react-dom/client";
import "../src/App.css";
import { AJUSTES_INICIALES, type Ajustes } from "../src/ajustes";
import type { Entrada } from "../src/carpeta";
import { Compilar } from "../src/compilar/Compilar";
import { ContextoTextos, textosDe } from "../src/idioma";

const base = "/Users/yo/Baul/Novela";
const nota = (ruta: string): Entrada => ({ nombre: ruta.split("/").pop()!, ruta: `${base}/${ruta}`, es_carpeta: false, hijos: [] });
const carpeta = (nombre: string, hijos: Entrada[]): Entrada => ({ nombre, ruta: `${base}/${nombre}`, es_carpeta: true, hijos });
const arbol: Entrada[] = [
  carpeta("Libro I", [nota("Libro I/01 - El hormiguero.md"), nota("Libro I/02 - La lluvia.md"), nota("Libro I/03 - La mudanza.md"), nota("Libro I/Notas de investigación.md")]),
  carpeta("Personajes", [nota("Personajes/Reina.md")]),
  nota("Ideas.md"),
];
const texto = "# Capítulo\n\n" + "La hormiga caminaba por el borde de la mesa pensando en la lluvia. ".repeat(60);
const es = location.search.includes("es");
const ajustes: Ajustes = { ...AJUSTES_INICIALES, idioma: es ? "es" : "en", autor: "Agustín Rojas", carpeta: base };
if (location.search.includes("libro")) {
  ajustes.compilaciones = {
    [`${base}/Libro I`]: { orden: [], excluidas: [`${base}/Libro I/Notas de investigación.md`], titulo: "La colonia", formato: "pdf", estilo: "libro", pagina: "a4", origenTitulo: "titulo", tipografia: true },
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ContextoTextos.Provider value={textosDe(ajustes.idioma)}>
    <main className="app" />
    <Compilar
      carpeta={base}
      arbol={arbol}
      rutaActiva={`${base}/Libro I/02 - La lluvia.md`}
      ajustes={ajustes}
      textoAbierto={() => texto}
      onGuardarAjustes={() => {}}
      onCerrar={() => {}}
    />
  </ContextoTextos.Provider>,
);
