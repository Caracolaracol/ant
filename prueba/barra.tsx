// Página de prueba de la barra lateral con fijados (iconos), y de las ventanitas de Ajustes,
// «Hormiguero nuevo» y el selector de iconos, fuera de Tauri (`pnpm dev`, luego
// http://localhost:1420/prueba/barra.html). Parámetros: `?es` en español, `?ajustes` abre los
// Ajustes, `?nuevo` la ventanita «Hormiguero nuevo», `?iconos` el selector de iconos, `?globo`
// muestra el globo del primer fijado y `?diario` el calendario del modo diario.

import ReactDOM from "react-dom/client";
import "../src/App.css";
import { AJUSTES_POR_DEFECTO, type Ajustes } from "../src/ajustes";
import { ModalAjustes } from "../src/ajustes/ModalAjustes";
import { BarraLateral } from "../src/barraLateral/BarraLateral";
import type { EntradaDelArbol } from "../src/arbolDeCarpetas";
import { ElegirIconoDeFijado } from "../src/barraLateral/ElegirIconoDeFijado";
import { NuevoHormiguero } from "../src/hormigueros/NuevoHormiguero";
import { ContextoDeTextos, textosDelIdioma } from "../src/idioma";
import { extraerTitulosDeLaNota } from "../src/titulosDeLaNota";

const parametrosDeLaDireccion = new URLSearchParams(location.search);
const base = "/Users/yo/Documents/Novela";
const nota = (ruta: string): EntradaDelArbol => ({ nombre: ruta.split("/").pop()!, ruta: `${base}/${ruta}`, esCarpeta: false, hijos: [] });
const carpeta = (nombre: string, hijos: EntradaDelArbol[]): EntradaDelArbol => ({ nombre, ruta: `${base}/${nombre}`, esCarpeta: true, hijos });
const arbol: EntradaDelArbol[] = [
  carpeta("Libro I", [nota("Libro I/01 - El hormiguero.md"), nota("Libro I/02 - La lluvia.md"), nota("Libro I/03 - La mudanza.md")]),
  carpeta("Personajes", [nota("Personajes/Reina.md"), nota("Personajes/Mira.md")]),
  nota("Ideas.md"),
  nota("Mapa del nido.md"),
];
const texto = "# La lluvia\n\nTexto.\n\n## La cueva\n\nMás texto.\n\n## La salida\n";
const ajustes: Ajustes = {
  ...AJUSTES_POR_DEFECTO,
  idioma: parametrosDeLaDireccion.has("es") ? "es" : "en",
  hormiguero_abierto: base,
  hormigueros: [base, "/Users/yo/Documents/Diario", "/Users/yo/Trabajo/Notas"],
  fijados: [`${base}/Libro I`, `${base}/Ideas.md`, `${base}/Libro I/02 - La lluvia.md#La cueva`, `${base}/Personajes`, `${base}/Borrado.md`],
  iconos_de_fijados: { [`${base}/Personajes`]: "drama", [`${base}/Ideas.md`]: "lightbulb" },
};
const notasAbiertas = [
  { id: "a", rutaDelArchivo: `${base}/Libro I/02 - La lluvia.md`, ultimoTextoConocido: texto, tieneCambiosSinGuardar: false, textoQueHayEnDisco: texto },
];
const nada = () => {};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ContextoDeTextos.Provider value={textosDelIdioma(ajustes.idioma)}>
    <main className="app">
      <div className="arrastre" />
      <div className="cuerpo">
        <BarraLateral
          carpetaDelHormiguero={base}
          arbolDelHormiguero={arbol}
          clavesDeFijados={ajustes.fijados}
          iconosElegidosPorFijado={ajustes.iconos_de_fijados}
          modoDiarioActivo={parametrosDeLaDireccion.has("diario")}
          notasAbiertas={notasAbiertas}
          idNotaVisible="a"
          titulosDeLaNotaVisible={extraerTitulosDeLaNota(texto)}
          indiceDelTituloConElCursor={1}
          anchoEnPixeles={240}
          alCambiarAncho={nada}
          alMostrarNotaAbierta={nada}
          alAbrirNotaDeArchivo={nada}
          alAbrirCapitulo={nada}
          alAbrirNotaDelDia={nada}
          alCerrarNota={nada}
          alSaltarATitulo={nada}
          alFijar={nada}
          alQuitarFijado={nada}
          alCambiarIconoDeFijado={nada}
        />
        <div className="editor" />
      </div>
      <footer className="estado"><span>02 - La lluvia.md</span><span /></footer>
    </main>
    {parametrosDeLaDireccion.has("ajustes") && <ModalAjustes ajustes={ajustes} cambiarAjustes={nada} alPedirHormigueroNuevo={nada} alCerrar={nada} />}
    {parametrosDeLaDireccion.has("nuevo") && <NuevoHormiguero alElegirCarpeta={nada} alCerrar={nada} />}
    {parametrosDeLaDireccion.has("iconos") && <ElegirIconoDeFijado x={120} y={90} iconoActual="drama" alElegirIcono={nada} alCerrar={nada} />}
  </ContextoDeTextos.Provider>,
);

// Simula pasar el mouse por el primer fijado, para ver su globo.
if (parametrosDeLaDireccion.has("globo")) {
  setTimeout(() => document.querySelectorAll(".fijado")[2]?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })), 100);
}
