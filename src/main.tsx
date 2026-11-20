// Punto de entrada de la interfaz. Todas las ventanas cargan este mismo index.html; la de Ajustes
// llega con `#ajustes` en la dirección (ver `src-tauri/src/menu.rs`) y aquí se elige qué montar.
// También aplica en todas las ventanas por igual lo que afecta a la app entera: los colores de
// Ajustes → Apariencia y el idioma de Ajustes → General (con `ContextoTextos`).

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { VentanaAjustes } from "./ajustes/VentanaAjustes";
import { Ajustes, escucharAjustes, leerAjustes } from "./ajustes";
import { aplicarColores } from "./colores";
import { ContextoTextos, Idioma, idiomaDe, textosDe } from "./idioma";

const esAjustes = window.location.hash === "#ajustes";

/** Aplica colores e idioma del documento (atributo `lang`) a partir de los ajustes. */
function aplicar(a: Partial<Ajustes>): Idioma {
  aplicarColores(a.colores ?? {});
  const idioma = idiomaDe(a.idioma);
  document.documentElement.lang = idioma;
  return idioma;
}

/** Raíz de cada ventana: entrega los textos del idioma actual y los cambia cuando cambian los ajustes. */
function Raiz({ idiomaInicial }: { idiomaInicial: Idioma }) {
  const [idioma, setIdioma] = useState(idiomaInicial);
  useEffect(() => {
    const dejar = escucharAjustes((a) => setIdioma(aplicar(a)));
    return () => void dejar.then((f) => f());
  }, []);
  return (
    <ContextoTextos.Provider value={textosDe(idioma)}>
      {esAjustes ? <VentanaAjustes /> : <App />}
    </ContextoTextos.Provider>
  );
}

// Los ajustes se leen antes de montar, para no ver un instante el tema o el idioma por defecto;
// si la lectura falla, la ventana se abre igual, en inglés y con los colores de `App.css`.
leerAjustes()
  .then(aplicar, () => aplicar({}))
  .then((idioma) =>
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <Raiz idiomaInicial={idioma} />
      </React.StrictMode>,
    ),
  );
