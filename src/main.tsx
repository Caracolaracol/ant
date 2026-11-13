// Punto de entrada de la interfaz. Todas las ventanas cargan este mismo index.html; la de Ajustes
// llega con `#ajustes` en la dirección (ver `src-tauri/src/menu.rs`) y aquí se elige qué montar.

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { VentanaAjustes } from "./ajustes/VentanaAjustes";

const esAjustes = window.location.hash === "#ajustes";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{esAjustes ? <VentanaAjustes /> : <App />}</React.StrictMode>,
);
