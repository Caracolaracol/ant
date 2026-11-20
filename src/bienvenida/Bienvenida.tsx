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
import { cavar } from "../../website/src/lib/cavar";
import tierra from "../../website/src/assets/tierra.svg";
import icono from "../../marca/ant-icono.svg";
import { ElegirHormiguero } from "../hormigueros/ElegirHormiguero";
import { IDIOMAS, Idioma, useTextos } from "../idioma";
import { Hormiga } from "./Hormiga";
import "./Bienvenida.css";

interface Props {
  idioma: Idioma;
  onCambiarIdioma(idioma: Idioma): void;
  /** Recibe la carpeta del hormiguero creado o elegido en la última cámara. */
  onListo(ruta: string): void;
  /** Si ya hay hormigueros, la bienvenida se puede cerrar sin crear otro. */
  onCerrar?: () => void;
}

/** Cuántas cámaras tiene la bienvenida. */
const CAMARAS = 4;

export function Bienvenida({ idioma, onCambiarIdioma, onListo, onCerrar }: Props) {
  const tx = useTextos();
  const nido = useRef<HTMLDivElement>(null);
  const fila = useRef<HTMLDivElement>(null);
  const hormiga = useRef<SVGSVGElement>(null);
  const pista = useRef<HTMLDivElement>(null);
  const hoyos = useRef<HTMLOListElement>(null);

  // Bordes imperfectos de las cámaras y del túnel, como en el sitio.
  useEffect(() => {
    if (fila.current) cavar(fila.current);
  }, []);

  /** Lleva el nido hasta la cámara `i`. */
  const irA = useCallback((i: number) => {
    const n = nido.current;
    if (!n) return;
    const destino = Math.max(0, Math.min(CAMARAS - 1, i));
    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    n.scrollTo({ left: destino * n.clientWidth, behavior: sinMovimiento ? "auto" : "smooth" });
  }, []);

  // La rueda del mouse (vertical) pasa de cámara en cámara: un paso por gesto, con una pausa
  // para que un giro largo no se salte todas. El trackpad (horizontal) usa el scroll normal, que
  // se ajusta a cada cámara por `scroll-snap`.
  useEffect(() => {
    const n = nido.current;
    if (!n) return;
    let bloqueado = false;
    const alGirar = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      if (bloqueado || Math.abs(e.deltaY) < 4) return;
      bloqueado = true;
      setTimeout(() => (bloqueado = false), 650);
      irA(Math.round(n.scrollLeft / n.clientWidth) + Math.sign(e.deltaY));
    };
    n.addEventListener("wheel", alGirar, { passive: false });
    return () => n.removeEventListener("wheel", alGirar);
  }, [irA]);

  // Teclado: flechas, Re Pág/Av Pág, Inicio y Fin (salvo mientras se escribe el nombre).
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as Element).closest("input")) return;
      const i = Math.round((nido.current?.scrollLeft ?? 0) / (nido.current?.clientWidth || 1));
      if (["ArrowRight", "ArrowDown", "PageDown"].includes(e.key)) irA(i + 1);
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) irA(i - 1);
      else if (e.key === "Home") irA(0);
      else if (e.key === "End") irA(CAMARAS - 1);
      else if (e.key === "Escape" && onCerrar) onCerrar();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [irA, onCerrar]);

  // La hormiga de abajo avanza según lo recorrido, mira hacia donde va y mueve las patas
  // mientras hay scroll. El hoyo de la cámara visible se rellena. Todo directo en el DOM, como en
  // el sitio: cambia en cada cuadro del scroll y no hace falta volver a dibujar con React.
  useEffect(() => {
    const n = nido.current;
    if (!n) return;
    let anterior = n.scrollLeft;
    let quieta: ReturnType<typeof setTimeout> | undefined;
    const mover = () => {
      const h = hormiga.current;
      const p = pista.current;
      if (!h || !p) return;
      const max = n.scrollWidth - n.clientWidth;
      const avance = max > 0 ? n.scrollLeft / max : 0;
      h.style.setProperty("--x", `${avance * (p.clientWidth - h.getBoundingClientRect().width)}px`);
      if (n.scrollLeft !== anterior) h.classList.toggle("atras", n.scrollLeft < anterior);
      anterior = n.scrollLeft;
      h.classList.add("caminando");
      clearTimeout(quieta);
      quieta = setTimeout(() => h.classList.remove("caminando"), 160);
      const i = Math.round(n.scrollLeft / (n.clientWidth || 1));
      hoyos.current?.querySelectorAll("button").forEach((b, j) => b.toggleAttribute("aria-current", j === i));
    };
    n.addEventListener("scroll", mover, { passive: true });
    window.addEventListener("resize", mover);
    mover();
    hormiga.current?.classList.remove("caminando");
    return () => {
      n.removeEventListener("scroll", mover);
      window.removeEventListener("resize", mover);
      clearTimeout(quieta);
    };
  }, []);

  /** Botón para pasar a la cámara siguiente. */
  const seguir = (i: number) => (
    <button className="bv-boton" onClick={() => irA(i + 1)}>
      {tx.bvSeguir} <span aria-hidden="true">→</span>
    </button>
  );

  return (
    <div className="bv">
      {/* Superficie: arrastra la ventana; deja lugar a los botones de macOS a la izquierda. */}
      <header className="bv-superficie" data-tauri-drag-region>
        <span className="bv-marca" data-tauri-drag-region>
          <img src={icono} width="28" height="28" alt="" />
          Ant
        </span>
        <nav className="bv-nav">
          <span className="bv-idiomas" aria-label={tx.idioma}>
            {IDIOMAS.map((i, n) => (
              <span key={i.id}>
                {n > 0 && <span aria-hidden="true"> / </span>}
                <button aria-current={i.id === idioma || undefined} lang={i.id} onClick={() => onCambiarIdioma(i.id)}>
                  {i.id.toUpperCase()}
                </button>
              </span>
            ))}
          </span>
          {onCerrar && (
            <button className="bv-cerrar" onClick={onCerrar}>{tx.bvVolver}</button>
          )}
        </nav>
      </header>

      <div className="bv-nido" ref={nido} style={{ backgroundImage: `url(${tierra})` }}>
        <div className="bv-fila" ref={fila}>
          <section className="bv-camara">
            <div className="hueco bv-portada">
              <img className="bv-icono" src={icono} width="150" height="150" alt="" />
              <div>
                <h1>Ant<span>.</span></h1>
                <p className="bv-lema">{tx.bvLema}</p>
                <p>{tx.bvPresentacion}</p>
                {seguir(0)}
              </div>
            </div>
          </section>

          <section className="bv-camara">
            <div className="hueco">
              <p className="bv-etiqueta">{tx.bvArchivosEtiqueta}</p>
              <h2>{tx.bvArchivosTitulo}</h2>
              <p>{tx.bvArchivosTexto}</p>
              <p className="bv-tenue">{tx.bvArchivosNota}</p>
              {seguir(1)}
            </div>
          </section>

          <section className="bv-camara">
            <div className="hueco">
              <p className="bv-etiqueta">{tx.bvHormiguerosEtiqueta}</p>
              <h2>{tx.bvHormiguerosTitulo}</h2>
              <p>{tx.bvHormiguerosTexto}</p>
              <ul className="bv-ejemplos" aria-label={tx.bvEjemplos}>
                {tx.bvEjemplosLista.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <p className="bv-tenue">{tx.bvHormiguerosNota}</p>
              {seguir(2)}
            </div>
          </section>

          <section className="bv-camara">
            <div className="hueco bv-cavar">
              <p className="bv-etiqueta">{tx.bvCavarEtiqueta}</p>
              <h2>{tx.bvCavarTitulo}</h2>
              <p>{tx.bvCavarTexto}</p>
              <ElegirHormiguero onListo={onListo} />
            </div>
          </section>
        </div>
      </div>

      <nav className="bv-recorrido" aria-label={tx.bvRecorrido}>
        <div className="bv-pista" ref={pista}>
          <Hormiga className="bv-hormiga" ref={hormiga} />
        </div>
        <ol className="bv-hoyos" ref={hoyos}>
          {Array.from({ length: CAMARAS }, (_, i) => (
            <li key={i}>
              <button aria-label={tx.bvCamara(i + 1)} onClick={() => irA(i)} />
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
