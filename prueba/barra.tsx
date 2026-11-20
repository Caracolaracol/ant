// Página de prueba de la barra lateral con fijados (iconos), y de las ventanitas de Ajustes,
// «Hormiguero nuevo» y el selector de iconos, fuera de Tauri (`pnpm dev`, luego
// http://localhost:1420/prueba/barra.html). Parámetros: `?es` en español, `?ajustes` abre los
// Ajustes, `?nuevo` la ventanita «Hormiguero nuevo», `?iconos` el selector de iconos, `?globo`
// muestra el globo del primer fijado y `?diario` el calendario del modo diario.

import ReactDOM from "react-dom/client";
import "../src/App.css";
import { AJUSTES_INICIALES, type Ajustes } from "../src/ajustes";
import { ModalAjustes } from "../src/ajustes/ModalAjustes";
import { BarraLateral } from "../src/BarraLateral";
import type { Entrada } from "../src/carpeta";
import { ElegirIcono } from "../src/ElegirIcono";
import { NuevoHormiguero } from "../src/hormigueros/NuevoHormiguero";
import { ContextoTextos, textosDe } from "../src/idioma";
import { extraerMarcadores } from "../src/marcadores";

const p = new URLSearchParams(location.search);
const base = "/Users/yo/Documents/Novela";
const nota = (ruta: string): Entrada => ({ nombre: ruta.split("/").pop()!, ruta: `${base}/${ruta}`, es_carpeta: false, hijos: [] });
const carpeta = (nombre: string, hijos: Entrada[]): Entrada => ({ nombre, ruta: `${base}/${nombre}`, es_carpeta: true, hijos });
const arbol: Entrada[] = [
  carpeta("Libro I", [nota("Libro I/01 - El hormiguero.md"), nota("Libro I/02 - La lluvia.md"), nota("Libro I/03 - La mudanza.md")]),
  carpeta("Personajes", [nota("Personajes/Reina.md"), nota("Personajes/Mira.md")]),
  nota("Ideas.md"),
  nota("Mapa del nido.md"),
];
const texto = "# La lluvia\n\nTexto.\n\n## La cueva\n\nMás texto.\n\n## La salida\n";
const ajustes: Ajustes = {
  ...AJUSTES_INICIALES,
  idioma: p.has("es") ? "es" : "en",
  carpeta: base,
  hormigueros: [base, "/Users/yo/Documents/Diario", "/Users/yo/Trabajo/Notas"],
  fijados: [`${base}/Libro I`, `${base}/Ideas.md`, `${base}/Libro I/02 - La lluvia.md#La cueva`, `${base}/Personajes`, `${base}/Borrado.md`],
  iconos: { [`${base}/Personajes`]: "drama", [`${base}/Ideas.md`]: "lightbulb" },
};
const notas = [{ id: "a", ruta: `${base}/Libro I/02 - La lluvia.md`, texto, sucio: false }];
const nada = () => {};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ContextoTextos.Provider value={textosDe(ajustes.idioma)}>
    <main className="app">
      <div className="arrastre" />
      <div className="cuerpo">
        <BarraLateral
          carpeta={base}
          arbol={arbol}
          fijados={ajustes.fijados}
          iconos={ajustes.iconos}
          diario={p.has("diario")}
          notas={notas}
          activa="a"
          marcadores={extraerMarcadores(texto)}
          tituloActual={1}
          onElegir={nada}
          onAbrirRuta={nada}
          onAbrirCapitulo={nada}
          onCerrar={nada}
          onSaltar={nada}
          onFijar={nada}
          onDesfijar={nada}
          onCambiarIcono={nada}
          onAbrirDia={nada}
          ancho={240}
          onCambiarAncho={nada}
        />
        <div className="editor" />
      </div>
      <footer className="estado"><span>02 - La lluvia.md</span><span /></footer>
    </main>
    {p.has("ajustes") && <ModalAjustes ajustes={ajustes} cambiar={nada} onNuevoHormiguero={nada} onCerrar={nada} />}
    {p.has("nuevo") && <NuevoHormiguero onListo={nada} onCerrar={nada} />}
    {p.has("iconos") && <ElegirIcono x={120} y={90} actual="drama" onElegir={nada} onCerrar={nada} />}
  </ContextoTextos.Provider>,
);

// Simula pasar el mouse por el primer fijado, para ver su globo.
if (p.has("globo")) {
  setTimeout(() => document.querySelectorAll(".fijado")[2]?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })), 100);
}
