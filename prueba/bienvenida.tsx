// Página de prueba de la bienvenida fuera de Tauri (`pnpm dev`, luego
// http://localhost:1420/prueba/bienvenida.html). `?es` la muestra en español, `?n=3` abre en la
// página 3, `?hormiguero` como si ya hubiera hormiguero (con cámaras para elegir) y `?vuelta`
// como cuando ya hay hormiguero y cámara (con «Volver a mis notas»). Crear o elegir carpetas no
// funciona aquí porque necesita Tauri.

import { useState } from "react";
import ReactDOM from "react-dom/client";
import "../src/App.css";
import { Bienvenida } from "../src/bienvenida/Bienvenida";
import { ContextoDeTextos, Idioma, textosDelIdioma } from "../src/idioma";

const parametros = new URLSearchParams(location.search);
const hayHormiguero = parametros.has("hormiguero") || parametros.has("vuelta");

function Prueba() {
  const [idioma, setIdioma] = useState<Idioma>(parametros.has("es") ? "es" : "en");
  return (
    <ContextoDeTextos.Provider value={textosDelIdioma(idioma)}>
      <Bienvenida
        idioma={idioma}
        alCambiarIdioma={setIdioma}
        carpetaDelHormiguero={hayHormiguero ? "/Users/yo/Documents/Hormiguero" : null}
        camarasDelHormiguero={hayHormiguero ? ["Novela", "Personal"] : []}
        alElegirHormiguero={(carpeta) => console.log("hormiguero", carpeta)}
        alElegirCamara={(camara) => console.log("cámara", camara)}
        alCerrar={parametros.has("vuelta") ? () => console.log("cerrar") : undefined}
      />
    </ContextoDeTextos.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Prueba />);

// Abre en la página pedida (`?n=`), sin animación.
const camaraInicial = Number(parametros.get("n") ?? 1) - 1;
if (camaraInicial > 0) {
  setTimeout(() => {
    const nido = document.querySelector<HTMLElement>(".bienvenida-nido")!;
    nido.style.scrollSnapType = "none";
    nido.scrollLeft = camaraInicial * nido.clientWidth;
  }, 50);
}
