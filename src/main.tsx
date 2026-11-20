// Punto de entrada de la interfaz: monta la ventana principal (`App`), la única ventana de la app
// (Ajustes, la bienvenida y los diálogos se abren dentro de ella). También aplica lo que afecta a
// la app entera: los colores de Ajustes → Apariencia y el idioma de Ajustes → General (con
// `ContextoTextos`), al abrir y cada vez que cambian los ajustes.

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AJUSTES_INICIALES, Ajustes, escucharAjustes, leerAjustes } from "./ajustes";
import { aplicarColores } from "./colores";
import { ContextoTextos, idiomaDe, textosDe } from "./idioma";

/** Aplica colores e idioma del documento (atributo `lang`) a partir de los ajustes. */
function aplicar(a: Partial<Ajustes>) {
  aplicarColores(a.colores ?? {});
  document.documentElement.lang = idiomaDe(a.idioma);
}

/** Raíz: entrega los textos del idioma actual y los cambia cuando cambian los ajustes. */
function Raiz({ ajustesIniciales }: { ajustesIniciales: Ajustes }) {
  const [idioma, setIdioma] = useState(idiomaDe(ajustesIniciales.idioma));
  useEffect(() => {
    const dejar = escucharAjustes((a) => {
      aplicar(a);
      setIdioma(idiomaDe(a.idioma));
    });
    return () => void dejar.then((f) => f());
  }, []);
  return (
    <ContextoTextos.Provider value={textosDe(idioma)}>
      <App ajustesIniciales={ajustesIniciales} />
    </ContextoTextos.Provider>
  );
}

// Los ajustes se leen antes de montar, para no ver un instante el tema, el idioma por defecto o
// la bienvenida; si la lectura falla, la ventana se abre igual, en inglés y con los colores de
// `App.css`.
leerAjustes()
  .catch(() => AJUSTES_INICIALES)
  .then((ajustes) => {
    aplicar(ajustes);
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <Raiz ajustesIniciales={ajustes} />
      </React.StrictMode>,
    );
  });
