// Bienvenida: lo primero que se ve al abrir Ant sin hormiguero o sin cámara abierta (y desde
// Ant → Welcome to Ant…). Tiene el diseño del sitio: un hormiguero en corte, con cámaras unidas
// por un túnel que se recorre hacia la derecha, y abajo una hormiga que avanza y un hoyo por
// cámara. Cada cámara del dibujo es una página:
//   1. Ant, en pocas palabras.
//   2. Tus textos son archivos en tu computador.
//   3. Tu hormiguero: la carpeta de todas tus notas; crearla o elegir una que existe
//      (`ElegirHormiguero`). Al elegirla, sigue sola a la página 4.
//   4. Las cámaras: cada una un contexto (personal, una novela, el trabajo); cavar la primera o
//      abrir una que ya hay (`ElegirCamara`). Al elegirla, la bienvenida se cierra.
// Si ya hay hormiguero pero falta la cámara (por ejemplo, se borró su carpeta), abre en la 4.
// Se avanza con los botones, los hoyos de abajo, la rueda del mouse, el trackpad o las flechas.
// Los bordes cavados y la tierra son los del sitio (`website/src/lib/cavar.ts` y
// `website/src/assets/tierra.svg`), así la app y el sitio se ven iguales.

import { useCallback, useEffect, useRef, useState } from "react";
import { cavarHuecos, dibujarTunel } from "../../website/src/lib/cavar";
import imagenDeLaTierra from "../../website/src/assets/tierra.svg";
import iconoDeAnt from "../../marca/ant-icono.svg";
import { ElegirHormiguero } from "../hormigueros/ElegirHormiguero";
import { ElegirCamara } from "../hormigueros/ElegirCamara";
import { marcarComoTextoDeIzquierdaADerecha } from "../arbolDeCarpetas";
import { IDIOMAS, Idioma, useTextos } from "../idioma";
import { Hormiga } from "./Hormiga";
import "./Bienvenida.css";

interface Props {
  idioma: Idioma;
  alCambiarIdioma(idiomaElegido: Idioma): void;
  /** El hormiguero elegido, o `null` si todavía no hay. */
  carpetaDelHormiguero: string | null;
  /** Cámaras que ya tiene el hormiguero (para ofrecer abrir una). */
  camarasDelHormiguero: string[];
  /** Recibe la carpeta del hormiguero creado o elegido en la página 3. */
  alElegirHormiguero(carpetaDelHormiguero: string): void | Promise<void>;
  /** Recibe el nombre de la cámara cavada o elegida en la página 4. */
  alElegirCamara(nombreDeLaCamara: string): void | Promise<void>;
  /** Abre directo en la página de las cámaras (ya hay hormiguero, falta la cámara). */
  empezarEnLasCamaras?: boolean;
  /** Si ya hay hormiguero y cámara, la bienvenida se puede cerrar sin cambiar nada. */
  alCerrar?: () => void;
}

/** Cuántas páginas (cámaras del dibujo) tiene la bienvenida. */
const CANTIDAD_DE_PAGINAS = 4;
/** Número (desde 0) de las páginas del hormiguero y de las cámaras. */
const PAGINA_DEL_HORMIGUERO = 2;
const PAGINA_DE_LAS_CAMARAS = 3;

/** Pausa tras un paso con la rueda del mouse, para que un giro largo no se salte todas las cámaras. */
const PAUSA_ENTRE_PASOS_DE_LA_RUEDA = 650;

export function Bienvenida(props: Props) {
  const { idioma, alCambiarIdioma, carpetaDelHormiguero, camarasDelHormiguero, alElegirCamara, empezarEnLasCamaras, alCerrar } = props;
  const textosDeLaInterfaz = useTextos();
  const nidoConScroll = useRef<HTMLDivElement>(null);
  const filaDeCamaras = useRef<HTMLDivElement>(null);
  const hormigaDelRecorrido = useRef<SVGSVGElement>(null);
  const pistaDelRecorrido = useRef<HTMLDivElement>(null);
  const hoyosDelRecorrido = useRef<HTMLOListElement>(null);

  // Comparte los bordes cavados con el sitio, pero aquí el túnel va recto por la fila de cámaras.
  useEffect(() => {
    const fila = filaDeCamaras.current;
    if (!fila) return;
    const dejarDeCavarHuecos = cavarHuecos(fila);
    const redibujarTunelHorizontal = () => {
      // Termina en el centro de la última cámara (todas las páginas miden lo mismo).
      const largoDelTunel = fila.clientWidth * (1 - 0.5 / CANTIDAD_DE_PAGINAS);
      const altoDelTunel = 70;
      const centroDelTunel = altoDelTunel / 2;
      dibujarTunel(fila, [{ vertices: [[0, centroDelTunel], [largoDelTunel, centroDelTunel]] }], largoDelTunel, altoDelTunel);
    };
    const observadorDeLaFila = new ResizeObserver(redibujarTunelHorizontal);
    observadorDeLaFila.observe(fila);
    return () => {
      dejarDeCavarHuecos();
      observadorDeLaFila.disconnect();
    };
  }, []);

  /** Página que se ve ahora (la más cercana al scroll). */
  const paginaVisible = () => {
    const nido = nidoConScroll.current;
    return nido ? Math.round(nido.scrollLeft / (nido.clientWidth || 1)) : 0;
  };

  /** Lleva el nido hasta la página `numeroDePagina` (desde 0); sin animación si `deInmediato`. */
  const irAPagina = useCallback((numeroDePagina: number, deInmediato = false) => {
    const nido = nidoConScroll.current;
    if (!nido) return;
    const paginaDestino = Math.max(0, Math.min(CANTIDAD_DE_PAGINAS - 1, numeroDePagina));
    const prefiereSinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nido.scrollTo({ left: paginaDestino * nido.clientWidth, behavior: deInmediato || prefiereSinMovimiento ? "auto" : "smooth" });
  }, []);

  // Si falta solo la cámara, se abre directo en esa página (solo al aparecer, no cada vez que cambia).
  const empezabaEnLasCamaras = useRef(empezarEnLasCamaras);
  useEffect(() => {
    if (empezabaEnLasCamaras.current) irAPagina(PAGINA_DE_LAS_CAMARAS, true);
  }, [irAPagina]);

  // Con un hormiguero ya elegido, la página 3 lo muestra con «Sigue el túnel», y el formulario para
  // usar otra carpeta aparece solo si se pide (si no, no cabe en la cámara).
  const [quiereOtroHormiguero, setQuiereOtroHormiguero] = useState(false);

  /** Guarda el hormiguero elegido y sigue el túnel hasta las cámaras. */
  const elegirHormigueroYSeguir = async (carpetaElegida: string) => {
    await props.alElegirHormiguero(carpetaElegida);
    setQuiereOtroHormiguero(false);
    irAPagina(PAGINA_DE_LAS_CAMARAS);
  };

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
      irAPagina(paginaVisible() + Math.sign(evento.deltaY));
    };
    nido.addEventListener("wheel", alGirarLaRueda, { passive: false });
    return () => nido.removeEventListener("wheel", alGirarLaRueda);
  }, [irAPagina]);

  // Teclado: flechas, Re Pág/Av Pág, Inicio y Fin (salvo mientras se escribe el nombre), y
  // Escape para cerrar si se puede.
  useEffect(() => {
    const alPresionarTecla = (evento: KeyboardEvent) => {
      if (evento.metaKey || evento.ctrlKey || evento.altKey || (evento.target as Element).closest("input")) return;
      if (["ArrowRight", "ArrowDown", "PageDown"].includes(evento.key)) irAPagina(paginaVisible() + 1);
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(evento.key)) irAPagina(paginaVisible() - 1);
      else if (evento.key === "Home") irAPagina(0);
      else if (evento.key === "End") irAPagina(CANTIDAD_DE_PAGINAS - 1);
      else if (evento.key === "Escape" && alCerrar) alCerrar();
      else return;
      evento.preventDefault();
    };
    window.addEventListener("keydown", alPresionarTecla);
    return () => window.removeEventListener("keydown", alPresionarTecla);
  }, [irAPagina, alCerrar]);

  // La hormiga de abajo avanza según lo recorrido, mira hacia donde va y mueve las patas
  // mientras hay scroll. El hoyo de la página visible se rellena. Todo directo en el DOM, como en
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
      const numeroDePaginaVisible = paginaVisible();
      hoyosDelRecorrido.current?.querySelectorAll("button").forEach((hoyo, numeroDeHoyo) => {
        hoyo.toggleAttribute("aria-current", numeroDeHoyo === numeroDePaginaVisible);
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

  /** Botón para pasar de la página `numeroDePagina` a la siguiente. */
  const botonParaSeguirDesde = (numeroDePagina: number) => (
    <button className="bienvenida-boton" onClick={() => irAPagina(numeroDePagina + 1)}>
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
            <div className="hueco bienvenida-cavar">
              <p className="bienvenida-etiqueta">{textosDeLaInterfaz.bienvenidaHormigueroEtiqueta}</p>
              <h2>{textosDeLaInterfaz.bienvenidaHormigueroTitulo}</h2>
              <p>{textosDeLaInterfaz.bienvenidaHormigueroTexto}</p>
              {/* Si ya hay hormiguero (al volver a la bienvenida), se puede seguir con ese. */}
              {carpetaDelHormiguero && !quiereOtroHormiguero ? (
                <>
                  <div className="bienvenida-elegido">
                    <span>{textosDeLaInterfaz.bienvenidaHormigueroElegido}</span>
                    <code title={carpetaDelHormiguero}>{marcarComoTextoDeIzquierdaADerecha(carpetaDelHormiguero)}</code>
                  </div>
                  {botonParaSeguirDesde(PAGINA_DEL_HORMIGUERO)}
                  <button className="bienvenida-enlace" onClick={() => setQuiereOtroHormiguero(true)}>
                    {textosDeLaInterfaz.bienvenidaUsarOtroHormiguero}
                  </button>
                </>
              ) : (
                <ElegirHormiguero alElegirCarpeta={elegirHormigueroYSeguir} />
              )}
            </div>
          </section>

          <section className="bienvenida-camara">
            <div className="hueco bienvenida-cavar">
              <p className="bienvenida-etiqueta">{textosDeLaInterfaz.bienvenidaCamarasEtiqueta}</p>
              <h2>{textosDeLaInterfaz.bienvenidaCamarasTitulo}</h2>
              <p>{textosDeLaInterfaz.bienvenidaCamarasTexto}</p>
              {carpetaDelHormiguero ? (
                <ElegirCamara
                  carpetaDelHormiguero={carpetaDelHormiguero}
                  camarasQueYaExisten={camarasDelHormiguero}
                  ofrecerAbrirUnaQueYaExiste
                  alElegirCamara={alElegirCamara}
                />
              ) : (
                <>
                  <p className="bienvenida-tenue">{textosDeLaInterfaz.bienvenidaFaltaHormiguero}</p>
                  <button className="bienvenida-boton" onClick={() => irAPagina(PAGINA_DEL_HORMIGUERO)}>
                    <span aria-hidden="true">←</span> {textosDeLaInterfaz.bienvenidaVolverAlHormiguero}
                  </button>
                </>
              )}
              <p className="bienvenida-tenue">{textosDeLaInterfaz.bienvenidaCamarasNota}</p>
            </div>
          </section>
        </div>
      </div>

      <nav className="bienvenida-recorrido" aria-label={textosDeLaInterfaz.bienvenidaRecorrido}>
        <div className="bienvenida-pista" ref={pistaDelRecorrido}>
          <Hormiga className="bienvenida-hormiga" ref={hormigaDelRecorrido} />
        </div>
        <ol className="bienvenida-hoyos" ref={hoyosDelRecorrido}>
          {Array.from({ length: CANTIDAD_DE_PAGINAS }, (_, numeroDePagina) => (
            <li key={numeroDePagina}>
              <button aria-label={textosDeLaInterfaz.bienvenidaPagina(numeroDePagina + 1)} onClick={() => irAPagina(numeroDePagina)} />
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
