// Página de prueba de la barra lateral con el selector de cámaras y los fijados (iconos), el menú
// de clic derecho y las ventanitas de Ajustes, «Cámara nueva», «Nota nueva», «Carpeta nueva» y el
// selector de iconos, fuera de Tauri (`pnpm dev`, luego http://localhost:1420/prueba/barra.html).
// Parámetros: `?es` en español, `?ajustes` abre los Ajustes (`?ajustes=atajos` en esa área),
// `?nueva` la ventanita «Cámara nueva», `?nota` la de «Nota nueva», `?carpeta` la de «Carpeta
// nueva», `?menu` el clic derecho de una nota, `?iconos` el selector de iconos, `?globo` muestra el
// globo del primer fijado, `?camaras` despliega el selector de cámaras, `?entrada` abre la
// «Entrada», `?diario` el calendario del modo diario, `?sinnota` la invitación a crear una nota
// (sin ninguna abierta), `?bloqueada` la cámara cifrada y bloqueada, `?cifrar` la ventanita para
// cifrar una cámara y `?captura` (con `?ajustes`) deja solo los Ajustes, arriba a la izquierda y a
// todo su alto, para sacar la captura del sitio.

import ReactDOM from "react-dom/client";
import "../src/App.css";
import { AJUSTES_POR_DEFECTO, opcionesDelEditorDeLaCamara, type Ajustes } from "../src/ajustes";
import { ModalAjustes } from "../src/ajustes/ModalAjustes";
import { BarraLateral } from "../src/barraLateral/BarraLateral";
import { CAMARA_DE_ENTRADA } from "../src/hormigueros/hormigueros";
import { NuevaNotaOCarpeta } from "../src/hormigueros/NuevaNotaOCarpeta";
import { InvitacionANotaNueva } from "../src/notasAbiertas/InvitacionANotaNueva";
import { CifrarCamara } from "../src/hormigueros/CifrarCamara";
import { DesbloquearCamara } from "../src/hormigueros/DesbloquearCamara";
import type { EntradaDelArbol } from "../src/arbolDeCarpetas";
import { ElegirIconoDeFijado } from "../src/barraLateral/ElegirIconoDeFijado";
import { NuevaCamara } from "../src/hormigueros/NuevaCamara";
import { ContextoDeTextos, textosDelIdioma } from "../src/idioma";
import { extraerTitulosDeLaNota } from "../src/titulosDeLaNota";

const parametrosDeLaDireccion = new URLSearchParams(location.search);
const estaEnEspanol = parametrosDeLaDireccion.has("es");
// Nombres del hormiguero y las cámaras de ejemplo en el idioma de la página (así sirven para las
// capturas del sitio en los dos idiomas).
const hormiguero = estaEnEspanol ? "/Users/yo/Documents/Hormiguero" : "/Users/me/Documents/Anthill";
const camaraDeLaNovela = estaEnEspanol ? "Novela" : "Novel";
const camaraCifrada = estaEnEspanol ? "Bóveda" : "Vault";
const abrirLaEntrada = parametrosDeLaDireccion.has("entrada");
const base = abrirLaEntrada ? hormiguero : `${hormiguero}/${camaraDeLaNovela}`;
const camaras = [CAMARA_DE_ENTRADA, camaraDeLaNovela, "Personal", estaEnEspanol ? "Trabajo" : "Work", camaraCifrada];
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
  idioma: estaEnEspanol ? "es" : "en",
  hormiguero,
  camara_abierta: abrirLaEntrada ? CAMARA_DE_ENTRADA : camaraDeLaNovela,
  // Un atajo cambiado, para ver cómo se marca en Ajustes → Atajos.
  atajos_de_teclado: { mostrar_panel: "CmdOrCtrl+Shift+KeyB" },
};
// Los fijados y sus iconos son datos de la cámara (en `.ant/`); aquí, de ejemplo.
const datosDeLaCamara = {
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
          carpetaDeLaCamara={base}
          nombreDeLaCamaraAbierta={ajustes.camara_abierta}
          laCamaraEsLaEntrada={abrirLaEntrada}
          laCamaraEstaBloqueada={parametrosDeLaDireccion.has("bloqueada")}
          camarasDelHormiguero={camaras}
          camarasCifradas={[camaraCifrada]}
          alBloquearLaCamara={null}
          arbolDeLaCamara={abrirLaEntrada ? arbol.filter((entrada) => !entrada.esCarpeta) : arbol}
          clavesDeFijados={datosDeLaCamara.fijados}
          iconosElegidosPorFijado={datosDeLaCamara.iconos_de_fijados}
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
          alAbrirCamara={nada}
          alPedirCamaraNueva={nada}
          alPedirCrear={nada}
          carpetaRecienCreada={null}
        />
        {parametrosDeLaDireccion.has("bloqueada") ? (
          <DesbloquearCamara nombreDeLaCamara={camaraDeLaNovela} alDesbloquear={async () => {}} />
        ) : parametrosDeLaDireccion.has("sinnota") ? (
          <InvitacionANotaNueva nombreDeLaCamara={camaraDeLaNovela} atajoDeNotaNueva="⌘N" alCrearNotaNueva={nada} />
        ) : (
          <div className="editor" />
        )}
      </div>
      <footer className="estado"><span>02 - La lluvia.md</span><span /></footer>
    </main>
    {parametrosDeLaDireccion.has("ajustes") && <ModalAjustes ajustes={ajustes} cambiarAjustes={nada} camarasDelHormiguero={camaras} alPedirCamaraNueva={nada} camarasCifradas={[camaraCifrada]} alPedirCifrado={nada} nombreDeLaCamaraAbierta={camaraDeLaNovela} opcionesDelEditor={opcionesDelEditorDeLaCamara({}, ajustes)} cambiarOpcionesDelEditor={nada} alCerrar={nada} areaInicial={parametrosDeLaDireccion.get("ajustes") ?? undefined} />}
    {parametrosDeLaDireccion.has("nueva") && <NuevaCamara carpetaDelHormiguero={hormiguero} camarasDelHormiguero={camaras} alCavarCamara={nada} alCerrar={nada} />}
    {parametrosDeLaDireccion.has("nota") && <NuevaNotaOCarpeta queSeCrea="nota" carpetaDondeCrearla={`${base}/Libro I`} lugarVisible="Novela / Libro I" alCrear={nada} alCerrar={nada} />}
    {parametrosDeLaDireccion.has("carpeta") && <NuevaNotaOCarpeta queSeCrea="carpeta" carpetaDondeCrearla={base} lugarVisible={camaraDeLaNovela} alCrear={nada} alCerrar={nada} />}
    {parametrosDeLaDireccion.has("cifrar") && (
      <CifrarCamara queSeHace="cifrar" nombreDeLaCamara="Contraseñas" alConfirmar={async () => {}} alCerrar={nada} />
    )}
    {parametrosDeLaDireccion.has("iconos") && <ElegirIconoDeFijado x={120} y={90} iconoActual="drama" alElegirIcono={nada} alCerrar={nada} />}
  </ContextoDeTextos.Provider>,
);

// Simula pasar el mouse por el primer fijado, para ver su globo.
if (parametrosDeLaDireccion.has("globo")) {
  setTimeout(() => document.querySelectorAll(".fijado")[2]?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })), 100);
}

// En las capturas sin ventana la animación de los menús no avanza: se apaga para verlos enteros.
if (parametrosDeLaDireccion.has("menu") || parametrosDeLaDireccion.has("camaras")) {
  document.head.insertAdjacentHTML("beforeend", "<style>.menu-contextual { animation: none; }</style>");
}

// Abre el clic derecho de la última nota del árbol, para ver el menú.
if (parametrosDeLaDireccion.has("menu")) {
  setTimeout(() => {
    const filaDeLaCarpeta = [...document.querySelectorAll<HTMLElement>(".barra-nota")].pop();
    const rectangulo = filaDeLaCarpeta?.getBoundingClientRect();
    filaDeLaCarpeta?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: (rectangulo?.left ?? 0) + 40, clientY: (rectangulo?.top ?? 0) + 10 }));
  }, 100);
}

// Despliega el selector de cámaras, para ver la lista.
if (parametrosDeLaDireccion.has("camaras")) {
  setTimeout(() => document.querySelector<HTMLElement>(".selector-de-camara")?.click(), 100);
}

// Para la captura de los Ajustes del sitio: sin la ventana de atrás ni el fondo oscuro, y con el
// panel a todo su alto (sin scroll), así se ven todas las cámaras.
if (parametrosDeLaDireccion.has("captura")) {
  document.head.insertAdjacentHTML(
    "beforeend",
    `<style>
      body { background: transparent; }
      body > #root > main { display: none; }
      .modal-fondo { position: static; padding: 0; background: none; display: block; }
      .modal { box-shadow: none; }
      .ajustes { width: 720px; height: auto; max-height: none; }
      .ajustes-panel { overflow: visible; }
    </style>`,
  );
}
