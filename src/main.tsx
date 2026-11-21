// Punto de entrada de la interfaz: monta la ventana principal (`App`), la única ventana de la app
// (Ajustes, la bienvenida y los diálogos se abren dentro de ella). También aplica lo que afecta a
// la app entera: los colores de Ajustes → Apariencia y el idioma de Ajustes → General (con
// `ContextoDeTextos`), al abrir y cada vez que cambian los ajustes.

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AJUSTES_POR_DEFECTO, Ajustes, escucharCambiosDeAjustes, leerAjustesGuardados } from "./ajustes";
import { aplicarColores } from "./colores";
import { ContextoDeTextos, idiomaValido, textosDelIdioma } from "./idioma";

/** Aplica colores e idioma del documento (atributo `lang`) a partir de los ajustes. */
function aplicarColoresEIdioma(ajustes: Partial<Ajustes>) {
  aplicarColores(ajustes.colores_elegidos ?? {});
  document.documentElement.lang = idiomaValido(ajustes.idioma);
}

/** Raíz: entrega los textos del idioma actual y los cambia cuando cambian los ajustes. */
function Raiz({ ajustesIniciales }: { ajustesIniciales: Ajustes }) {
  const [idioma, setIdioma] = useState(idiomaValido(ajustesIniciales.idioma));
  useEffect(() => {
    const dejarDeEscuchar = escucharCambiosDeAjustes((ajustesNuevos) => {
      aplicarColoresEIdioma(ajustesNuevos);
      setIdioma(idiomaValido(ajustesNuevos.idioma));
    });
    return () => void dejarDeEscuchar.then((dejar) => dejar());
  }, []);
  return (
    <ContextoDeTextos.Provider value={textosDelIdioma(idioma)}>
      <App ajustesIniciales={ajustesIniciales} />
    </ContextoDeTextos.Provider>
  );
}

// Los ajustes se leen antes de montar, para no ver un instante el tema, el idioma por defecto o
// la bienvenida; si la lectura falla, la ventana se abre igual, en inglés y con los colores de
// `App.css`.
leerAjustesGuardados()
  .catch(() => AJUSTES_POR_DEFECTO)
  .then((ajustes) => {
    aplicarColoresEIdioma(ajustes);
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <Raiz ajustesIniciales={ajustes} />
      </React.StrictMode>,
    );
  });
