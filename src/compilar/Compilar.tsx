// Diálogo «Compilar y exportar» (menú File → Compile and Export…, Cmd+Shift+E). Une las notas
// de una carpeta, como capítulos de un libro, y lo exporta a Word o PDF:
//   · a la izquierda, la carpeta y sus notas: cada una con su casilla (va o no va en el libro),
//     sus palabras y flechas para cambiar el orden;
//   · a la derecha, título, autor, formato, estilo (manuscrito estándar o libro), tamaño de
//     página, de dónde sale el título de cada capítulo y si se corrige la tipografía.
// Lo elegido para cada carpeta se recuerda en los ajustes (`compilaciones`), y el autor para
// todas. Las notas abiertas se compilan con lo que tienen en el editor, aunque no se hayan
// guardado. Todo se arma aquí mismo, sin depender de programas externos.

import { useEffect, useMemo, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { Ajustes, ConfigCompilacion, OPCIONES_ESCRITOR } from "../ajustes";
import { Entrada } from "../carpeta";
import { entradaDiario } from "../diario";
import { configEscritor } from "../editor/escritor";
import { idiomaDe, useTextos } from "../idioma";
import { guardarBinario, leerNota, mostrarEnCarpeta, nombreArchivo } from "../notas";
import { analizar, compilar, contarPalabras } from "./modelo";
import { crearDocx } from "./docx";
import { crearPdf } from "./pdf";
import "./Compilar.css";

interface Props {
  /** Carpeta de trabajo, o `null` si no se eligió. */
  carpeta: string | null;
  arbol: Entrada[];
  /** Ruta de la nota visible: su carpeta es la que se propone compilar. */
  rutaActiva: string | null;
  ajustes: Ajustes;
  /** Texto de una nota abierta en el editor (con sus cambios sin guardar), o `undefined`. */
  textoAbierto(ruta: string): string | undefined;
  onGuardarAjustes(cambios: Partial<Ajustes>): void;
  onCerrar(): void;
}

/** Una carpeta que se puede compilar, con su profundidad para dibujarla con sangría. */
interface OpcionCarpeta {
  ruta: string;
  nombre: string;
  nivel: number;
  notas: Entrada[];
}

/** Una nota de la lista de capítulos. */
interface Item {
  ruta: string;
  /** Ruta relativa a la carpeta compilada («Parte I / 01 Inicio.md»). */
  nombre: string;
  incluida: boolean;
}

/** Notas de unas entradas del árbol, en el orden del árbol y entrando en las subcarpetas. */
function notasDe(entradas: Entrada[], omitir?: string): Entrada[] {
  return entradas.flatMap((e) => (e.ruta === omitir ? [] : e.es_carpeta ? notasDe(e.hijos, omitir) : [e]));
}

/** Carpetas que se pueden compilar: la de trabajo y todas sus subcarpetas (menos `Daily`). */
function carpetasDe(carpeta: string, arbol: Entrada[]): OpcionCarpeta[] {
  const daily = entradaDiario(arbol)?.ruta;
  const out: OpcionCarpeta[] = [{ ruta: carpeta, nombre: nombreArchivo(carpeta), nivel: 0, notas: notasDe(arbol, daily) }];
  const recorrer = (entradas: Entrada[], nivel: number) => {
    for (const e of entradas) {
      if (!e.es_carpeta || e.ruta === daily) continue;
      out.push({ ruta: e.ruta, nombre: e.nombre, nivel, notas: notasDe(e.hijos) });
      recorrer(e.hijos, nivel + 1);
    }
  };
  recorrer(arbol, 1);
  return out;
}

/** Ruta de la carpeta que contiene `ruta`. */
const padre = (ruta: string) => ruta.replace(/[\\/][^\\/]*$/, "");

/** Une una carpeta y un nombre de archivo con el separador que use la carpeta. */
const unir = (carpeta: string, nombre: string) => `${carpeta}${carpeta.includes("\\") ? "\\" : "/"}${nombre}`;

/** Quita de un título lo que no puede ir en un nombre de archivo. */
const nombreSeguro = (t: string) => t.replace(/[\\/:*?"<>|]+/g, " ").trim() || "Ant";

export function Compilar({ carpeta, arbol, rutaActiva, ajustes, textoAbierto, onGuardarAjustes, onCerrar }: Props) {
  const tx = useTextos();
  const idioma = idiomaDe(ajustes.idioma);
  const carpetas = useMemo(() => (carpeta ? carpetasDe(carpeta, arbol) : []), [carpeta, arbol]);

  // Carpeta propuesta: la de la nota visible (si es una de las que se pueden compilar), si no,
  // la última que se compiló, y si no, la de trabajo.
  const [elegida, setElegida] = useState(() => {
    const deActiva = rutaActiva ? carpetas.find((c) => c.ruta === padre(rutaActiva)) : undefined;
    const compilada = carpetas.find((c) => ajustes.compilaciones[c.ruta]);
    return (deActiva ?? compilada ?? carpetas[0])?.ruta ?? "";
  });
  const opcion = carpetas.find((c) => c.ruta === elegida);
  const guardada: ConfigCompilacion | undefined = ajustes.compilaciones[elegida];

  const [items, setItems] = useState<Item[]>([]);
  const [titulo, setTitulo] = useState("");
  const [autor, setAutor] = useState(ajustes.autor);
  const [formato, setFormato] = useState<ConfigCompilacion["formato"]>("docx");
  const [estilo, setEstilo] = useState<ConfigCompilacion["estilo"]>("manuscrito");
  const [pagina, setPagina] = useState<ConfigCompilacion["pagina"]>(idioma === "es" ? "a4" : "carta");
  const [origenTitulo, setOrigenTitulo] = useState<ConfigCompilacion["origenTitulo"]>("titulo");
  const [tipografia, setTipografia] = useState(true);
  const [textos, setTextos] = useState<Map<string, string>>(new Map());
  const [estado, setEstado] = useState<{ tipo: "listo" | "trabajando" | "hecho" | "error"; mensaje?: string; ruta?: string }>({ tipo: "listo" });

  // Al cambiar de carpeta: arma la lista de capítulos (con el orden guardado, y las notas nuevas
  // al final) y recupera las demás opciones que se usaron con esa carpeta.
  useEffect(() => {
    if (!opcion) return;
    const g = guardada;
    const rutas = opcion.notas.map((n) => n.ruta);
    const ordenadas = [...(g?.orden.filter((r) => rutas.includes(r)) ?? []), ...rutas.filter((r) => !g?.orden.includes(r))];
    const base = opcion.ruta.length + 1;
    setItems(
      ordenadas.map((ruta) => ({
        ruta,
        nombre: ruta.slice(base).split(/[\\/]/).join(" / "),
        incluida: !g?.excluidas.includes(ruta),
      })),
    );
    setTitulo(g?.titulo ?? opcion.nombre);
    if (g) {
      setFormato(g.formato);
      setEstilo(g.estilo);
      setPagina(g.pagina);
      setOrigenTitulo(g.origenTitulo);
      setTipografia(g.tipografia);
    }
    setEstado({ tipo: "listo" });
  }, [elegida, opcion?.notas]);

  // Lee el texto de cada nota (o el del editor, si está abierta) para contar palabras y compilar.
  useEffect(() => {
    let vigente = true;
    Promise.all(
      (opcion?.notas ?? []).map(async (n) => [n.ruta, textoAbierto(n.ruta) ?? (await leerNota(n.ruta).catch(() => ""))] as const),
    ).then((pares) => vigente && setTextos(new Map(pares)));
    return () => {
      vigente = false;
    };
  }, [opcion?.notas]);

  // Palabras de cada nota (sin marcas de Markdown ni notas %% %%), calculadas una vez por texto.
  const palabras = useMemo(() => {
    const m = new Map<string, number>();
    for (const [ruta, texto] of textos) m.set(ruta, contarPalabras(analizar(texto)));
    return m;
  }, [textos]);
  const incluidas = items.filter((i) => i.incluida);
  const total = incluidas.reduce((s, i) => s + (palabras.get(i.ruta) ?? 0), 0);

  // Escape cierra el diálogo (si no está exportando).
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape" && estado.tipo !== "trabajando") onCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [estado.tipo, onCerrar]);

  /** Mueve un capítulo `paso` lugares (−1 sube, 1 baja). */
  const mover = (i: number, paso: number) =>
    setItems((lista) => {
      const j = i + paso;
      if (j < 0 || j >= lista.length) return lista;
      const nueva = [...lista];
      [nueva[i], nueva[j]] = [nueva[j], nueva[i]];
      return nueva;
    });

  /** Pide dónde guardar, compila, genera el archivo y recuerda las opciones de esta carpeta. */
  async function exportar() {
    const ext = formato;
    const destino = await save({
      defaultPath: unir(elegida, `${nombreSeguro(titulo)}.${ext}`),
      filters: [{ name: tx.formatos[ext], extensions: [ext] }],
    });
    if (!destino) return;
    setEstado({ tipo: "trabajando" });
    try {
      const notas = incluidas.map((i) => ({ nombre: nombreArchivo(i.ruta), texto: textos.get(i.ruta) ?? "" }));
      // La corrección usa las comillas y reglas del modo escritor (o las de por defecto si está apagado).
      const reglas = tipografia ? configEscritor(ajustes.escritor ? ajustes.opciones_escritor : OPCIONES_ESCRITOR, idioma) : null;
      const libro = compilar(notas, { titulo, autor, origenTitulo, tipografia: reglas });
      const opciones = { estilo, pagina, idioma };
      const datos = ext === "docx" ? await crearDocx(libro, opciones) : await crearPdf(libro, opciones);
      await guardarBinario(destino, datos);
      const config: ConfigCompilacion = {
        orden: items.map((i) => i.ruta),
        excluidas: items.filter((i) => !i.incluida).map((i) => i.ruta),
        titulo,
        formato,
        estilo,
        pagina,
        origenTitulo,
        tipografia,
      };
      onGuardarAjustes({ autor, compilaciones: { ...ajustes.compilaciones, [elegida]: config } });
      setEstado({ tipo: "hecho", mensaje: tx.exportado(nombreArchivo(destino)), ruta: destino });
    } catch (e) {
      setEstado({ tipo: "error", mensaje: String(e) });
    }
  }

  /** Botones de una opción con pocas alternativas (formato, estilo). */
  function segmentos<T extends string>(valor: T, valores: readonly T[], nombres: Record<string, string>, cambiar: (v: T) => void) {
    return (
      <div className="segmentos">
        {valores.map((v) => (
          <button key={v} className={v === valor ? "elegido" : ""} onClick={() => cambiar(v)}>
            {nombres[v]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="compilar-fondo" onMouseDown={(e) => e.target === e.currentTarget && estado.tipo !== "trabajando" && onCerrar()}>
      <div className="compilar" role="dialog" aria-label={tx.compilarTitulo}>
        <h1>{tx.compilarTitulo}</h1>
        {!carpeta ? (
          <p className="compilar-ayuda">{tx.compilarSinCarpeta}</p>
        ) : (
          <div className="compilar-columnas">
            <section className="compilar-capitulos">
              <label className="compilar-campo">
                <span>{tx.carpetaLibro}</span>
                <select value={elegida} onChange={(e) => setElegida(e.target.value)}>
                  {carpetas.map((c) => (
                    <option key={c.ruta} value={c.ruta}>
                      {"  ".repeat(c.nivel) + c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <div className="compilar-subtitulo">{tx.capitulos}</div>
              <p className="compilar-ayuda">{tx.capitulosAyuda}</p>
              <div className="compilar-lista">
                {items.length === 0 && <p className="compilar-ayuda">{tx.sinNotas}</p>}
                {items.map((it, i) => (
                  <div key={it.ruta} className={`compilar-item${it.incluida ? "" : " fuera"}`}>
                    <input
                      type="checkbox"
                      checked={it.incluida}
                      onChange={(e) => setItems((l) => l.map((x) => (x.ruta === it.ruta ? { ...x, incluida: e.target.checked } : x)))}
                    />
                    <span className="compilar-nombre" title={it.ruta}>{it.nombre.replace(/\.(md|markdown|txt)$/i, "")}</span>
                    <span className="compilar-palabras">{(palabras.get(it.ruta) ?? 0).toLocaleString(tx.locale)}</span>
                    <button title={tx.subir} disabled={i === 0} onClick={() => mover(i, -1)}>↑</button>
                    <button title={tx.bajar} disabled={i === items.length - 1} onClick={() => mover(i, 1)}>↓</button>
                  </div>
                ))}
              </div>
              <div className="compilar-total">
                {tx.capitulosN(incluidas.length, items.length)} · {tx.palabrasN(total)}
              </div>
            </section>

            <section className="compilar-opciones">
              <label className="compilar-campo">
                <span>{tx.tituloLibro}</span>
                <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </label>
              <label className="compilar-campo">
                <span>{tx.autor}</span>
                <input value={autor} onChange={(e) => setAutor(e.target.value)} />
              </label>
              <div className="compilar-campo">
                <span>{tx.formato}</span>
                {segmentos(formato, ["docx", "pdf"] as const, tx.formatos, setFormato)}
              </div>
              <div className="compilar-campo">
                <span>{tx.estiloLibro}</span>
                {segmentos(estilo, ["manuscrito", "libro"] as const, tx.estilos, setEstilo)}
                <small>{tx.estilosAyuda[estilo]}</small>
              </div>
              {estilo === "manuscrito" && (
                <label className="compilar-campo">
                  <span>{tx.paginaLibro}</span>
                  <select value={pagina} onChange={(e) => setPagina(e.target.value as ConfigCompilacion["pagina"])}>
                    {(["a4", "carta"] as const).map((p) => (
                      <option key={p} value={p}>{tx.paginas[p]}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="compilar-campo">
                <span>{tx.tituloCapitulos}</span>
                <select value={origenTitulo} onChange={(e) => setOrigenTitulo(e.target.value as ConfigCompilacion["origenTitulo"])}>
                  {(["titulo", "archivo", "ninguno"] as const).map((o) => (
                    <option key={o} value={o}>{tx.origenesTitulo[o]}</option>
                  ))}
                </select>
              </label>
              <label className="compilar-casilla">
                <input type="checkbox" checked={tipografia} onChange={(e) => setTipografia(e.target.checked)} />
                <span>{tx.corregirTipografia}</span>
              </label>
              <p className="compilar-ayuda">{tx.notasPropiasAyuda}</p>
            </section>
          </div>
        )}

        <footer className="compilar-pie">
          <span className={`compilar-estado ${estado.tipo}`}>
            {estado.tipo === "trabajando" ? tx.exportando : estado.mensaje}
            {estado.tipo === "hecho" && estado.ruta && (
              <button className="compilar-enlace" onClick={() => mostrarEnCarpeta(estado.ruta!)}>{tx.mostrarEnFinder}</button>
            )}
          </span>
          <button onClick={onCerrar} disabled={estado.tipo === "trabajando"}>{tx.cerrar}</button>
          <button
            className="principal"
            onClick={exportar}
            disabled={!carpeta || !incluidas.length || estado.tipo === "trabajando" || textos.size === 0}
          >
            {tx.exportar}
          </button>
        </footer>
      </div>
    </div>
  );
}
