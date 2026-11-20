// Página de prueba de la bienvenida fuera de Tauri (`pnpm dev`, luego
// http://localhost:1420/prueba/bienvenida.html). `?es` la muestra en español, `?n=3` abre en la
// cámara 3 y `?vuelta` la muestra como cuando ya hay hormigueros (con «Volver a mis notas»).
// Crear o elegir la carpeta no funciona aquí porque necesita Tauri.

import { useState } from "react";
import ReactDOM from "react-dom/client";
import "../src/App.css";
import { Bienvenida } from "../src/bienvenida/Bienvenida";
import { ContextoTextos, Idioma, textosDe } from "../src/idioma";

const parametros = new URLSearchParams(location.search);

function Prueba() {
  const [idioma, setIdioma] = useState<Idioma>(parametros.has("es") ? "es" : "en");
  return (
    <ContextoTextos.Provider value={textosDe(idioma)}>
      <Bienvenida
        idioma={idioma}
        onCambiarIdioma={setIdioma}
        onListo={(ruta) => console.log("hormiguero", ruta)}
        onCerrar={parametros.has("vuelta") ? () => console.log("cerrar") : undefined}
      />
    </ContextoTextos.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Prueba />);

// Abre en la cámara pedida (`?n=`), sin animación.
const n = Number(parametros.get("n") ?? 1) - 1;
if (n > 0) {
  setTimeout(() => {
    const nido = document.querySelector<HTMLElement>(".bv-nido")!;
    nido.style.scrollSnapType = "none";
    nido.scrollLeft = n * nido.clientWidth;
  }, 50);
}
