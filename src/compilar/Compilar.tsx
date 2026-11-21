// Diálogo «Compilar y exportar» (menú File → Compile and Export…, Cmd+Shift+E). Une las notas
// de una carpeta, como capítulos de un libro, y lo exporta a Word o PDF:
//   · a la izquierda, la carpeta y sus notas: cada una con su casilla (va o no va en el libro),
//     sus palabras y flechas para cambiar el orden;
//   · a la derecha, título, autor, formato, estilo (manuscrito estándar o libro), tamaño de
//     página, de dónde sale el título de cada capítulo y si se corrige la tipografía.
// Lo elegido para cada carpeta se recuerda en los ajustes (`opciones_de_compilacion_por_carpeta`),
// y el autor para todas. Las notas abiertas se compilan con lo que tienen en el editor, aunque no
// se hayan guardado. Todo se arma aquí mismo, sin depender de programas externos.

import { useEffect, useMemo, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { Ajustes, OpcionesDeCompilacion, OPCIONES_DEL_MODO_ESCRITOR_POR_DEFECTO } from "../ajustes";
import { EntradaDelArbol } from "../arbolDeCarpetas";
import { buscarCarpetaDelDiario } from "../diario";
import { crearConfiguracionModoEscritor } from "../editor/escritor";
import { idiomaValido, useTextos } from "../idioma";
import { guardarArchivoBinarioEnElDisco, leerNotaDelDisco, mostrarArchivoEnSuCarpeta, nombreDelArchivo } from "../archivosDeNotas";
import { analizarNotaEnBloques, compilarLibro, contarPalabrasDeBloques } from "./modelo";
import { crearDocx } from "./docx";
import { crearPdf } from "./pdf";
import "./Compilar.css";

interface Props {
  /** Carpeta de la cámara abierta, o `null` si no hay ninguna. */
  carpetaDeLaCamara: string | null;
  arbolDeLaCamara: EntradaDelArbol[];
  /** Ruta de la nota visible: su carpeta es la que se propone compilar. */
  rutaDeLaNotaVisible: string | null;
  ajustes: Ajustes;
  /** Texto de una nota abierta en el editor (con sus cambios sin guardar), o `undefined`. */
  textoDeNotaAbiertaPorRuta(rutaDelArchivo: string): string | undefined;
  cambiarAjustes(cambios: Partial<Ajustes>): void;
  alCerrar(): void;
}

/** Una carpeta que se puede compilar, con su profundidad para dibujarla con sangría. */
interface CarpetaCompilable {
  ruta: string;
  nombre: string;
  nivelDeProfundidad: number;
  notas: EntradaDelArbol[];
}

/** Una nota de la lista de capítulos. */
interface CapituloDeLaLista {
  ruta: string;
  /** Ruta relativa a la carpeta compilada («Parte I / 01 Inicio.md»). */
  nombreVisible: string;
  vaEnElLibro: boolean;
}

/** Estado del diálogo mientras exporta. */
interface EstadoDeLaExportacion {
  etapa: "listo" | "trabajando" | "hecho" | "error";
  mensaje?: string;
  rutaDelArchivoExportado?: string;
}

/** Notas de unas entradas del árbol, en el orden del árbol y entrando en las subcarpetas. */
function notasDeLasEntradas(entradas: EntradaDelArbol[], rutaQueSeOmite?: string): EntradaDelArbol[] {
  return entradas.flatMap((entrada) =>
    entrada.ruta === rutaQueSeOmite ? [] : entrada.esCarpeta ? notasDeLasEntradas(entrada.hijos, rutaQueSeOmite) : [entrada],
  );
}

/** Carpetas que se pueden compilar: la de la cámara y todas sus subcarpetas (menos `Daily`). */
function carpetasCompilables(carpetaDeLaCamara: string, arbolDeLaCamara: EntradaDelArbol[]): CarpetaCompilable[] {
  const rutaDelDiario = buscarCarpetaDelDiario(arbolDeLaCamara)?.ruta;
  const carpetas: CarpetaCompilable[] = [
    {
      ruta: carpetaDeLaCamara,
      nombre: nombreDelArchivo(carpetaDeLaCamara),
      nivelDeProfundidad: 0,
      notas: notasDeLasEntradas(arbolDeLaCamara, rutaDelDiario),
    },
  ];
  const recorrerSubcarpetas = (entradas: EntradaDelArbol[], nivelDeProfundidad: number) => {
    for (const entrada of entradas) {
      if (!entrada.esCarpeta || entrada.ruta === rutaDelDiario) continue;
      carpetas.push({ ruta: entrada.ruta, nombre: entrada.nombre, nivelDeProfundidad, notas: notasDeLasEntradas(entrada.hijos) });
      recorrerSubcarpetas(entrada.hijos, nivelDeProfundidad + 1);
    }
  };
  recorrerSubcarpetas(arbolDeLaCamara, 1);
  return carpetas;
}

/** Ruta de la carpeta que contiene `ruta`. */
const carpetaQueContiene = (ruta: string) => ruta.replace(/[\\/][^\\/]*$/, "");

/** Une una carpeta y un nombre de archivo con el separador que use la carpeta. */
const unirCarpetaYNombre = (carpeta: string, nombreDelArchivo: string) =>
  `${carpeta}${carpeta.includes("\\") ? "\\" : "/"}${nombreDelArchivo}`;

/** Quita de un título lo que no puede ir en un nombre de archivo. */
const nombreDeArchivoSeguro = (titulo: string) => titulo.replace(/[\\/:*?"<>|]+/g, " ").trim() || "Ant";

export function Compilar({
  carpetaDeLaCamara,
  arbolDeLaCamara,
  rutaDeLaNotaVisible,
  ajustes,
  textoDeNotaAbiertaPorRuta,
  cambiarAjustes,
  alCerrar,
}: Props) {
  const textosDeLaInterfaz = useTextos();
  const idioma = idiomaValido(ajustes.idioma);
  const opcionesGuardadasPorCarpeta = ajustes.opciones_de_compilacion_por_carpeta;
  const carpetas = useMemo(
    () => (carpetaDeLaCamara ? carpetasCompilables(carpetaDeLaCamara, arbolDeLaCamara) : []),
    [carpetaDeLaCamara, arbolDeLaCamara],
  );

  // Carpeta propuesta: la de la nota visible (si es una de las que se pueden compilar), si no,
  // la última que se compiló, y si no, la de la cámara.
  const [rutaDeLaCarpetaElegida, setRutaDeLaCarpetaElegida] = useState(() => {
    const carpetaDeLaNotaVisible = rutaDeLaNotaVisible
      ? carpetas.find((carpeta) => carpeta.ruta === carpetaQueContiene(rutaDeLaNotaVisible))
      : undefined;
    const carpetaYaCompilada = carpetas.find((carpeta) => opcionesGuardadasPorCarpeta[carpeta.ruta]);
    return (carpetaDeLaNotaVisible ?? carpetaYaCompilada ?? carpetas[0])?.ruta ?? "";
  });
  const carpetaElegida = carpetas.find((carpeta) => carpeta.ruta === rutaDeLaCarpetaElegida);
  const opcionesGuardadas: OpcionesDeCompilacion | undefined = opcionesGuardadasPorCarpeta[rutaDeLaCarpetaElegida];

  const [capitulos, setCapitulos] = useState<CapituloDeLaLista[]>([]);
  const [tituloDelLibro, setTituloDelLibro] = useState("");
  const [nombreDelAutor, setNombreDelAutor] = useState(ajustes.nombre_del_autor);
  const [formato, setFormato] = useState<OpcionesDeCompilacion["formato"]>("docx");
  const [estilo, setEstilo] = useState<OpcionesDeCompilacion["estilo"]>("manuscrito");
  const [tamanoDePagina, setTamanoDePagina] = useState<OpcionesDeCompilacion["pagina"]>(idioma === "es" ? "a4" : "carta");
  const [origenDelTitulo, setOrigenDelTitulo] = useState<OpcionesDeCompilacion["origenTitulo"]>("titulo");
  const [corregirTipografia, setCorregirTipografia] = useState(true);
  const [textoPorRuta, setTextoPorRuta] = useState<Map<string, string>>(new Map());
  const [estadoDeLaExportacion, setEstadoDeLaExportacion] = useState<EstadoDeLaExportacion>({ etapa: "listo" });
  const estaExportando = estadoDeLaExportacion.etapa === "trabajando";

  // Al cambiar de carpeta: arma la lista de capítulos (con el orden guardado, y las notas nuevas
  // al final) y recupera las demás opciones que se usaron con esa carpeta.
  useEffect(() => {
    if (!carpetaElegida) return;
    const rutasDeLasNotas = carpetaElegida.notas.map((nota) => nota.ruta);
    const rutasEnOrden = [
      ...(opcionesGuardadas?.orden.filter((ruta) => rutasDeLasNotas.includes(ruta)) ?? []),
      ...rutasDeLasNotas.filter((ruta) => !opcionesGuardadas?.orden.includes(ruta)),
    ];
    const largoDelPrefijoDeLaCarpeta = carpetaElegida.ruta.length + 1;
    setCapitulos(
      rutasEnOrden.map((ruta) => ({
        ruta,
        nombreVisible: ruta.slice(largoDelPrefijoDeLaCarpeta).split(/[\\/]/).join(" / "),
        vaEnElLibro: !opcionesGuardadas?.excluidas.includes(ruta),
      })),
    );
    setTituloDelLibro(opcionesGuardadas?.titulo ?? carpetaElegida.nombre);
    if (opcionesGuardadas) {
      setFormato(opcionesGuardadas.formato);
      setEstilo(opcionesGuardadas.estilo);
      setTamanoDePagina(opcionesGuardadas.pagina);
      setOrigenDelTitulo(opcionesGuardadas.origenTitulo);
      setCorregirTipografia(opcionesGuardadas.tipografia);
    }
    setEstadoDeLaExportacion({ etapa: "listo" });
  }, [rutaDeLaCarpetaElegida, carpetaElegida?.notas]);

  // Lee el texto de cada nota (o el del editor, si está abierta) para contar palabras y compilar.
  useEffect(() => {
    let sigueVigente = true;
    Promise.all(
      (carpetaElegida?.notas ?? []).map(
        async (nota) => [nota.ruta, textoDeNotaAbiertaPorRuta(nota.ruta) ?? (await leerNotaDelDisco(nota.ruta).catch(() => ""))] as const,
      ),
    ).then((rutasYTextos) => sigueVigente && setTextoPorRuta(new Map(rutasYTextos)));
    return () => {
      sigueVigente = false;
    };
  }, [carpetaElegida?.notas]);

  // Palabras de cada nota (sin marcas de Markdown ni notas %% %%), calculadas una vez por texto.
  const palabrasPorRuta = useMemo(() => {
    const palabras = new Map<string, number>();
    for (const [ruta, texto] of textoPorRuta) palabras.set(ruta, contarPalabrasDeBloques(analizarNotaEnBloques(texto)));
    return palabras;
  }, [textoPorRuta]);
  const capitulosQueVanEnElLibro = capitulos.filter((capitulo) => capitulo.vaEnElLibro);
  const palabrasDelLibro = capitulosQueVanEnElLibro.reduce((total, capitulo) => total + (palabrasPorRuta.get(capitulo.ruta) ?? 0), 0);

  // Escape cierra el diálogo (si no está exportando).
  useEffect(() => {
    const alPresionarEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !estaExportando) alCerrar();
    };
    window.addEventListener("keydown", alPresionarEscape);
    return () => window.removeEventListener("keydown", alPresionarEscape);
  }, [estaExportando, alCerrar]);

  /** Mueve el capítulo de `posicion` un lugar (−1 sube, 1 baja). */
  const moverCapitulo = (posicion: number, paso: -1 | 1) =>
    setCapitulos((lista) => {
      const posicionNueva = posicion + paso;
      if (posicionNueva < 0 || posicionNueva >= lista.length) return lista;
      const listaNueva = [...lista];
      [listaNueva[posicion], listaNueva[posicionNueva]] = [listaNueva[posicionNueva], listaNueva[posicion]];
      return listaNueva;
    });

  /** Pide dónde guardar, compila, genera el archivo y recuerda las opciones de esta carpeta. */
  async function exportarLibro() {
    const extension = formato;
    const rutaDeDestino = await save({
      defaultPath: unirCarpetaYNombre(rutaDeLaCarpetaElegida, `${nombreDeArchivoSeguro(tituloDelLibro)}.${extension}`),
      filters: [{ name: textosDeLaInterfaz.formatos[extension], extensions: [extension] }],
    });
    if (!rutaDeDestino) return;
    setEstadoDeLaExportacion({ etapa: "trabajando" });
    try {
      const notasParaCompilar = capitulosQueVanEnElLibro.map((capitulo) => ({
        nombreDelArchivo: nombreDelArchivo(capitulo.ruta),
        texto: textoPorRuta.get(capitulo.ruta) ?? "",
      }));
      // La corrección usa las comillas y reglas del modo escritor (o las de por defecto si está apagado).
      const configuracionTipografica = corregirTipografia
        ? crearConfiguracionModoEscritor(
            ajustes.modo_escritor ? ajustes.opciones_del_modo_escritor : OPCIONES_DEL_MODO_ESCRITOR_POR_DEFECTO,
            idioma,
          )
        : null;
      const libro = compilarLibro(notasParaCompilar, {
        titulo: tituloDelLibro,
        nombreDelAutor,
        origenDelTitulo,
        configuracionTipografica,
      });
      const opcionesDeExportacion = { estilo, tamanoDePagina, idioma };
      const bytesDelArchivo = extension === "docx" ? await crearDocx(libro, opcionesDeExportacion) : await crearPdf(libro, opcionesDeExportacion);
      await guardarArchivoBinarioEnElDisco(rutaDeDestino, bytesDelArchivo);
      const opcionesParaRecordar: OpcionesDeCompilacion = {
        orden: capitulos.map((capitulo) => capitulo.ruta),
        excluidas: capitulos.filter((capitulo) => !capitulo.vaEnElLibro).map((capitulo) => capitulo.ruta),
        titulo: tituloDelLibro,
        formato,
        estilo,
        pagina: tamanoDePagina,
        origenTitulo: origenDelTitulo,
        tipografia: corregirTipografia,
      };
      cambiarAjustes({
        nombre_del_autor: nombreDelAutor,
        opciones_de_compilacion_por_carpeta: { ...opcionesGuardadasPorCarpeta, [rutaDeLaCarpetaElegida]: opcionesParaRecordar },
      });
      setEstadoDeLaExportacion({
        etapa: "hecho",
        mensaje: textosDeLaInterfaz.exportado(nombreDelArchivo(rutaDeDestino)),
        rutaDelArchivoExportado: rutaDeDestino,
      });
    } catch (error) {
      setEstadoDeLaExportacion({ etapa: "error", mensaje: String(error) });
    }
  }

  /** Botones de una opción con pocas alternativas (formato, estilo). */
  function botonesDeOpcion<Valor extends string>(
    valorElegido: Valor,
    valoresPosibles: readonly Valor[],
    nombresVisibles: Record<string, string>,
    alElegir: (valor: Valor) => void,
  ) {
    return (
      <div className="segmentos">
        {valoresPosibles.map((valor) => (
          <button key={valor} className={valor === valorElegido ? "elegido" : ""} onClick={() => alElegir(valor)}>
            {nombresVisibles[valor]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="compilar-fondo" onMouseDown={(evento) => evento.target === evento.currentTarget && !estaExportando && alCerrar()}>
      <div className="compilar" role="dialog" aria-label={textosDeLaInterfaz.compilarTitulo}>
        <h1>{textosDeLaInterfaz.compilarTitulo}</h1>
        {!carpetaDeLaCamara ? (
          <p className="compilar-ayuda">{textosDeLaInterfaz.compilarSinCarpeta}</p>
        ) : (
          <div className="compilar-columnas">
            <section className="compilar-capitulos">
              <label className="compilar-campo">
                <span>{textosDeLaInterfaz.carpetaLibro}</span>
                <select value={rutaDeLaCarpetaElegida} onChange={(evento) => setRutaDeLaCarpetaElegida(evento.target.value)}>
                  {carpetas.map((carpeta) => (
                    <option key={carpeta.ruta} value={carpeta.ruta}>
                      {"  ".repeat(carpeta.nivelDeProfundidad) + carpeta.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <div className="compilar-subtitulo">{textosDeLaInterfaz.capitulos}</div>
              <p className="compilar-ayuda">{textosDeLaInterfaz.capitulosAyuda}</p>
              <div className="compilar-lista">
                {capitulos.length === 0 && <p className="compilar-ayuda">{textosDeLaInterfaz.sinNotas}</p>}
                {capitulos.map((capitulo, posicion) => (
                  <div key={capitulo.ruta} className={`compilar-item${capitulo.vaEnElLibro ? "" : " fuera"}`}>
                    <input
                      type="checkbox"
                      checked={capitulo.vaEnElLibro}
                      onChange={(evento) =>
                        setCapitulos((lista) =>
                          lista.map((otro) => (otro.ruta === capitulo.ruta ? { ...otro, vaEnElLibro: evento.target.checked } : otro)),
                        )
                      }
                    />
                    <span className="compilar-nombre" title={capitulo.ruta}>{capitulo.nombreVisible.replace(/\.(md|markdown|txt)$/i, "")}</span>
                    <span className="compilar-palabras">{(palabrasPorRuta.get(capitulo.ruta) ?? 0).toLocaleString(textosDeLaInterfaz.locale)}</span>
                    <button title={textosDeLaInterfaz.subir} disabled={posicion === 0} onClick={() => moverCapitulo(posicion, -1)}>↑</button>
                    <button title={textosDeLaInterfaz.bajar} disabled={posicion === capitulos.length - 1} onClick={() => moverCapitulo(posicion, 1)}>↓</button>
                  </div>
                ))}
              </div>
              <div className="compilar-total">
                {textosDeLaInterfaz.capitulosN(capitulosQueVanEnElLibro.length, capitulos.length)} · {textosDeLaInterfaz.palabrasN(palabrasDelLibro)}
              </div>
            </section>

            <section className="compilar-opciones">
              <label className="compilar-campo">
                <span>{textosDeLaInterfaz.tituloLibro}</span>
                <input value={tituloDelLibro} onChange={(evento) => setTituloDelLibro(evento.target.value)} />
              </label>
              <label className="compilar-campo">
                <span>{textosDeLaInterfaz.autor}</span>
                <input value={nombreDelAutor} onChange={(evento) => setNombreDelAutor(evento.target.value)} />
              </label>
              <div className="compilar-campo">
                <span>{textosDeLaInterfaz.formato}</span>
                {botonesDeOpcion(formato, ["docx", "pdf"] as const, textosDeLaInterfaz.formatos, setFormato)}
              </div>
              <div className="compilar-campo">
                <span>{textosDeLaInterfaz.estiloLibro}</span>
                {botonesDeOpcion(estilo, ["manuscrito", "libro"] as const, textosDeLaInterfaz.estilos, setEstilo)}
                <small>{textosDeLaInterfaz.estilosAyuda[estilo]}</small>
              </div>
              {estilo === "manuscrito" && (
                <label className="compilar-campo">
                  <span>{textosDeLaInterfaz.paginaLibro}</span>
                  <select
                    value={tamanoDePagina}
                    onChange={(evento) => setTamanoDePagina(evento.target.value as OpcionesDeCompilacion["pagina"])}
                  >
                    {(["a4", "carta"] as const).map((tamano) => (
                      <option key={tamano} value={tamano}>{textosDeLaInterfaz.paginas[tamano]}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="compilar-campo">
                <span>{textosDeLaInterfaz.tituloCapitulos}</span>
                <select
                  value={origenDelTitulo}
                  onChange={(evento) => setOrigenDelTitulo(evento.target.value as OpcionesDeCompilacion["origenTitulo"])}
                >
                  {(["titulo", "archivo", "ninguno"] as const).map((origen) => (
                    <option key={origen} value={origen}>{textosDeLaInterfaz.origenesTitulo[origen]}</option>
                  ))}
                </select>
              </label>
              <label className="compilar-casilla">
                <input type="checkbox" checked={corregirTipografia} onChange={(evento) => setCorregirTipografia(evento.target.checked)} />
                <span>{textosDeLaInterfaz.corregirTipografia}</span>
              </label>
              <p className="compilar-ayuda">{textosDeLaInterfaz.notasPropiasAyuda}</p>
            </section>
          </div>
        )}

        <footer className="compilar-pie">
          <span className={`compilar-estado ${estadoDeLaExportacion.etapa}`}>
            {estaExportando ? textosDeLaInterfaz.exportando : estadoDeLaExportacion.mensaje}
            {estadoDeLaExportacion.etapa === "hecho" && estadoDeLaExportacion.rutaDelArchivoExportado && (
              <button
                className="compilar-enlace"
                onClick={() => mostrarArchivoEnSuCarpeta(estadoDeLaExportacion.rutaDelArchivoExportado!)}
              >
                {textosDeLaInterfaz.mostrarEnFinder}
              </button>
            )}
          </span>
          <button onClick={alCerrar} disabled={estaExportando}>{textosDeLaInterfaz.cerrar}</button>
          <button
            className="principal"
            onClick={exportarLibro}
            disabled={!carpetaDeLaCamara || !capitulosQueVanEnElLibro.length || estaExportando || textoPorRuta.size === 0}
          >
            {textosDeLaInterfaz.exportar}
          </button>
        </footer>
      </div>
    </div>
  );
}
