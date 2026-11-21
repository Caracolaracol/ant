// Bienvenida: lo primero que se ve al abrir Ant sin ningún hormiguero (y desde Ant → Welcome to
// Ant…). Tiene el diseño del sitio: un hormiguero en corte, con cámaras unidas por un túnel que
// se recorre hacia la derecha, y abajo una hormiga que avanza y un hoyo por cámara. Cada cámara
// es una página:
//   1. Ant, en pocas palabras.
//   2. Tus textos son archivos en tu computador.
//   3. Hormigueros: uno por proyecto, todos los que quieras.
//   4. Cavar el primero: crear una carpeta o elegir una que ya existe (`ElegirHormiguero`).
// Se avanza con los botones, los hoyos de abajo, la rueda del mouse, el trackpad o las flechas.
// Los bordes cavados y la tierra son los del sitio (`website/src/lib/cavar.ts` y
// `website/src/assets/tierra.svg`), así la app y el sitio se ven iguales.

import { useCallback, useEffect, useRef } from "react";
import { cavar as cavarBordesDeLasCamaras } from "../../website/src/lib/cavar";
import imagenDeLaTierra from "../../website/src/assets/tierra.svg";
import iconoDeAnt from "../../marca/ant-icono.svg";
import { ElegirHormiguero } from "../hormigueros/ElegirHormiguero";
import { IDIOMAS, Idioma, useTextos } from "../idioma";
import { Hormiga } from "./Hormiga";
import "./Bienvenida.css";

interface Props {
  idioma: Idioma;
  alCambiarIdioma(idiomaElegido: Idioma): void;
  /** Recibe la carpeta del hormiguero creado o elegido en la última cámara. */
  alElegirCarpeta(carpetaDelHormiguero: string): void;
  /** Si ya hay hormigueros, la bienvenida se puede cerrar sin crear otro. */
  alCerrar?: () => void;
}

/** Cuántas cámaras (páginas) tiene la bienvenida. */
const CANTIDAD_DE_CAMARAS = 4;

/** Pausa tras un paso con la rueda del mouse, para que un giro largo no se salte todas las cámaras. */
const PAUSA_ENTRE_PASOS_DE_LA_RUEDA = 650;

export function Bienvenida({ idioma, alCambiarIdioma, alElegirCarpeta, alCerrar }: Props) {
  const textosDeLaInterfaz = useTextos();
  const nidoConScroll = useRef<HTMLDivElement>(null);
  const filaDeCamaras = useRef<HTMLDivElement>(null);
  const hormigaDelRecorrido = useRef<SVGSVGElement>(null);
  const pistaDelRecorrido = useRef<HTMLDivElement>(null);
  const hoyosDelRecorrido = useRef<HTMLOListElement>(null);

  // Bordes imperfectos de las cámaras y del túnel, como en el sitio.
  useEffect(() => {
    if (filaDeCamaras.current) cavarBordesDeLasCamaras(filaDeCamaras.current);
  }, []);

  /** Cámara que se ve ahora (la más cercana al scroll). */
  const camaraVisible = () => {
    const nido = nidoConScroll.current;
    return nido ? Math.round(nido.scrollLeft / (nido.clientWidth || 1)) : 0;
  };

  /** Lleva el nido hasta la cámara `numeroDeCamara` (desde 0). */
  const irACamara = useCallback((numeroDeCamara: number) => {
    const nido = nidoConScroll.current;
    if (!nido) return;
    const camaraDestino = Math.max(0, Math.min(CANTIDAD_DE_CAMARAS - 1, numeroDeCamara));
    const prefiereSinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nido.scrollTo({ left: camaraDestino * nido.clientWidth, behavior: prefiereSinMovimiento ? "auto" : "smooth" });
  }, []);

  // La rueda del mouse (vertical) pasa de cámara en cámara: un paso por gesto, con una pausa
  // para que un giro largo no se salte todas. El trackpad (horizontal) usa el scroll normal, que
  // se ajusta a cada cámara por `scroll-snap`.
  useEffect(() => {
    const nido = nidoConScroll.current;
    if (!nido) return;
    let estaEnPausa = false;
    const alGirarLaRueda = (evento: WheelEvent) => {
      if (evento.ctrlKey || Math.abs(evento.deltaY) <= Math.abs(evento.deltaX)) return;
      evento.preventDefault();
      if (estaEnPausa || Math.abs(evento.deltaY) < 4) return;
      estaEnPausa = true;
      setTimeout(() => (estaEnPausa = false), PAUSA_ENTRE_PASOS_DE_LA_RUEDA);
      irACamara(camaraVisible() + Math.sign(evento.deltaY));
    };
    nido.addEventListener("wheel", alGirarLaRueda, { passive: false });
    return () => nido.removeEventListener("wheel", alGirarLaRueda);
  }, [irACamara]);

  // Teclado: flechas, Re Pág/Av Pág, Inicio y Fin (salvo mientras se escribe el nombre), y
  // Escape para cerrar si se puede.
  useEffect(() => {
    const alPresionarTecla = (evento: KeyboardEvent) => {
      if (evento.metaKey || evento.ctrlKey || evento.altKey || (evento.target as Element).closest("input")) return;
      if (["ArrowRight", "ArrowDown", "PageDown"].includes(evento.key)) irACamara(camaraVisible() + 1);
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(evento.key)) irACamara(camaraVisible() - 1);
      else if (evento.key === "Home") irACamara(0);
      else if (evento.key === "End") irACamara(CANTIDAD_DE_CAMARAS - 1);
      else if (evento.key === "Escape" && alCerrar) alCerrar();
      else return;
      evento.preventDefault();
    };
    window.addEventListener("keydown", alPresionarTecla);
    return () => window.removeEventListener("keydown", alPresionarTecla);
  }, [irACamara, alCerrar]);

  // La hormiga de abajo avanza según lo recorrido, mira hacia donde va y mueve las patas
  // mientras hay scroll. El hoyo de la cámara visible se rellena. Todo directo en el DOM, como en
  // el sitio: cambia en cada cuadro del scroll y no hace falta volver a dibujar con React.
  useEffect(() => {
    const nido = nidoConScroll.current;
    if (!nido) return;
    let scrollAnterior = nido.scrollLeft;
    let temporizadorDeQuietud: ReturnType<typeof setTimeout> | undefined;
    const moverLaHormiga = () => {
      const hormiga = hormigaDelRecorrido.current;
      const pista = pistaDelRecorrido.current;
      if (!hormiga || !pista) return;
      const scrollMaximo = nido.scrollWidth - nido.clientWidth;
      const fraccionRecorrida = scrollMaximo > 0 ? nido.scrollLeft / scrollMaximo : 0;
      const espacioParaAvanzar = pista.clientWidth - hormiga.getBoundingClientRect().width;
      hormiga.style.setProperty("--x", `${fraccionRecorrida * espacioParaAvanzar}px`);
      if (nido.scrollLeft !== scrollAnterior) hormiga.classList.toggle("atras", nido.scrollLeft < scrollAnterior);
      scrollAnterior = nido.scrollLeft;
      hormiga.classList.add("caminando");
      clearTimeout(temporizadorDeQuietud);
      temporizadorDeQuietud = setTimeout(() => hormiga.classList.remove("caminando"), 160);
      const numeroDeCamaraVisible = camaraVisible();
      hoyosDelRecorrido.current?.querySelectorAll("button").forEach((hoyo, numeroDeHoyo) => {
        hoyo.toggleAttribute("aria-current", numeroDeHoyo === numeroDeCamaraVisible);
      });
    };
    nido.addEventListener("scroll", moverLaHormiga, { passive: true });
    window.addEventListener("resize", moverLaHormiga);
    moverLaHormiga();
    hormigaDelRecorrido.current?.classList.remove("caminando");
    return () => {
      nido.removeEventListener("scroll", moverLaHormiga);
      window.removeEventListener("resize", moverLaHormiga);
      clearTimeout(temporizadorDeQuietud);
    };
  }, []);

  /** Botón para pasar de la cámara `numeroDeCamara` a la siguiente. */
  const botonParaSeguirDesde = (numeroDeCamara: number) => (
    <button className="bienvenida-boton" onClick={() => irACamara(numeroDeCamara + 1)}>
      {textosDeLaInterfaz.bienvenidaSeguir} <span aria-hidden="true">→</span>
    </button>
  );

  return (
    <div className="bienvenida">
      {/* Superficie: arrastra la ventana; deja lugar a los botones de macOS a la izquierda. */}
      <header className="bienvenida-superficie" data-tauri-drag-region>
        <span className="bienvenida-marca" data-tauri-drag-region>
          <img src={iconoDeAnt} width="28" height="28" alt="" />
          Ant
        </span>
        <nav className="bienvenida-navegacion">
          <span className="bienvenida-idiomas" aria-label={textosDeLaInterfaz.idioma}>
            {IDIOMAS.map((idiomaDisponible, posicion) => (
              <span key={idiomaDisponible.id}>
                {posicion > 0 && <span aria-hidden="true"> / </span>}
                <button
                  aria-current={idiomaDisponible.id === idioma || undefined}
                  lang={idiomaDisponible.id}
                  onClick={() => alCambiarIdioma(idiomaDisponible.id)}
                >
                  {idiomaDisponible.id.toUpperCase()}
                </button>
              </span>
            ))}
          </span>
          {alCerrar && (
            <button className="bienvenida-cerrar" onClick={alCerrar}>{textosDeLaInterfaz.bienvenidaVolver}</button>
          )}
        </nav>
      </header>

      <div className="bienvenida-nido" ref={nidoConScroll} style={{ backgroundImage: `url(${imagenDeLaTierra})` }}>
        <div className="bienvenida-fila" ref={filaDeCamaras}>
          <section className="bienvenida-camara">
            <div className="hueco bienvenida-portada">
              <img className="bienvenida-icono" src={iconoDeAnt} width="150" height="150" alt="" />
              <div>
                <h1>Ant<span>.</span></h1>
                <p className="bienvenida-lema">{textosDeLaInterfaz.bienvenidaLema}</p>
                <p>{textosDeLaInterfaz.bienvenidaPresentacion}</p>
                {botonParaSeguirDesde(0)}
              </div>
            </div>
          </section>

          <section className="bienvenida-camara">
            <div className="hueco">
              <p className="bienvenida-etiqueta">{textosDeLaInterfaz.bienvenidaArchivosEtiqueta}</p>
              <h2>{textosDeLaInterfaz.bienvenidaArchivosTitulo}</h2>
              <p>{textosDeLaInterfaz.bienvenidaArchivosTexto}</p>
              <p className="bienvenida-tenue">{textosDeLaInterfaz.bienvenidaArchivosNota}</p>
              {botonParaSeguirDesde(1)}
            </div>
          </section>

          <section className="bienvenida-camara">
            <div className="hueco">
              <p className="bienvenida-etiqueta">{textosDeLaInterfaz.bienvenidaHormiguerosEtiqueta}</p>
              <h2>{textosDeLaInterfaz.bienvenidaHormiguerosTitulo}</h2>
              <p>{textosDeLaInterfaz.bienvenidaHormiguerosTexto}</p>
              <ul className="bienvenida-ejemplos" aria-label={textosDeLaInterfaz.bienvenidaEjemplos}>
                {textosDeLaInterfaz.bienvenidaEjemplosLista.map((ejemploDeHormiguero) => (
                  <li key={ejemploDeHormiguero}>{ejemploDeHormiguero}</li>
                ))}
              </ul>
              <p className="bienvenida-tenue">{textosDeLaInterfaz.bienvenidaHormiguerosNota}</p>
              {botonParaSeguirDesde(2)}
            </div>
          </section>

          <section className="bienvenida-camara">
            <div className="hueco bienvenida-cavar">
              <p className="bienvenida-etiqueta">{textosDeLaInterfaz.bienvenidaCavarEtiqueta}</p>
              <h2>{textosDeLaInterfaz.bienvenidaCavarTitulo}</h2>
              <p>{textosDeLaInterfaz.bienvenidaCavarTexto}</p>
              <ElegirHormiguero alElegirCarpeta={alElegirCarpeta} />
            </div>
          </section>
        </div>
      </div>

      <nav className="bienvenida-recorrido" aria-label={textosDeLaInterfaz.bienvenidaRecorrido}>
        <div className="bienvenida-pista" ref={pistaDelRecorrido}>
          <Hormiga className="bienvenida-hormiga" ref={hormigaDelRecorrido} />
        </div>
        <ol className="bienvenida-hoyos" ref={hoyosDelRecorrido}>
          {Array.from({ length: CANTIDAD_DE_CAMARAS }, (_, numeroDeCamara) => (
            <li key={numeroDeCamara}>
              <button aria-label={textosDeLaInterfaz.bienvenidaCamara(numeroDeCamara + 1)} onClick={() => irACamara(numeroDeCamara)} />
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
