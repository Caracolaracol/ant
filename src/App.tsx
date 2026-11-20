// Ventana principal: barra lateral con el hormiguero abierto, los fijados y los títulos de la nota
// visible, el editor y una barra de estado abajo, como en Left. Hay una sola nota con archivo
// abierta a la vez: abrir otra cierra la anterior. Las notas con archivo se guardan solas
// (`guardarYa`) un momento después de dejar de escribir, al cambiar de nota, al salir de la
// ventana y al cerrar la app; una nota nueva se guarda con Cmd+S la primera vez (pregunta dónde).
// Lleva la lista de notas abiertas (ruta, texto y si tienen cambios sin guardar), cuál está visible, los ajustes (hormigueros,
// fijados con sus iconos…), el modo diario (calendario → nota del día) y los atajos de teclado:
//   Cmd+N nueva · Cmd+O abrir · Cmd+S guardar · Cmd+Shift+S guardar como
//   Cmd+Shift+] / Cmd+Shift+[ nota siguiente / anterior · Cmd+\ mostrar u ocultar la barra lateral
// Encima de todo esto se abren, cuando toca: la bienvenida (sin hormigueros, o desde el menú), los
// Ajustes (Cmd+,), «Hormiguero nuevo» y «Compilar y exportar» (Cmd+Shift+E). Los ítems del menú
// los maneja Rust, que avisa con un evento (`abrir-ajustes`, `abrir-bienvenida`,
// `nuevo-hormiguero`, `abrir-compilar`) y aquí se abre lo que corresponda.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { Editor, EditorHandle } from "./editor/Editor";
import { ANCHO_BARRA, BarraLateral, NotaResumen } from "./BarraLateral";
import { Ajustes, escucharAjustes, guardarAjustes, leerAjustes } from "./ajustes";
import { ModalAjustes } from "./ajustes/ModalAjustes";
import { Bienvenida } from "./bienvenida/Bienvenida";
import { Entrada, listarCarpeta } from "./carpeta";
import { abrirDia } from "./diario";
import { configEscritor } from "./editor/escritor";
import { Compilar } from "./compilar/Compilar";
import { conHormiguero } from "./hormigueros/hormigueros";
import { NuevoHormiguero } from "./hormigueros/NuevoHormiguero";
import { idiomaDe, useTextos } from "./idioma";
import { extraerMarcadores, marcadorActual } from "./marcadores";
import { elegirNota, elegirRutaGuardado, guardarNota, leerNota, nombreArchivo } from "./notas";
import "./App.css";

/** Cuenta palabras, líneas y caracteres del texto, para la barra de estado. */
function contar(texto: string) {
  const palabras = texto.trim() ? texto.trim().split(/\s+/).length : 0;
  return { palabras, lineas: texto.split("\n").length, caracteres: texto.length };
}

/** Genera un identificador único para una nota abierta (no depende de su ruta, que puede cambiar). */
let contador = 0;
const nuevoId = () => `nota-${++contador}`;

/** Cuánto se espera tras la última tecla para guardar la nota solo, en milisegundos. */
const PAUSA_GUARDADO = 600;

/** Nota vacía y sin ruta, la que se crea con Cmd+N o al cerrar la última. */
const notaVacia = (): NotaResumen => ({ id: nuevoId(), ruta: null, texto: "", sucio: false });

/** Une una carpeta y un nombre de archivo con el separador que use la carpeta. */
const unir = (carpeta: string, nombre: string) =>
  `${carpeta.replace(/[\\/]+$/, "")}${carpeta.includes("\\") ? "\\" : "/"}${nombre}`;

/** Escucha un evento que manda Rust (los ítems del menú) mientras el componente está montado. */
function useEvento(nombre: string, alRecibir: () => void) {
  useEffect(() => {
    const dejar = listen(nombre, alRecibir);
    return () => void dejar.then((f) => f());
  }, [nombre, alRecibir]);
}

function App({ ajustesIniciales }: { ajustesIniciales: Ajustes }) {
  const editor = useRef<EditorHandle>(null);
  // Textos del idioma elegido; en una ref también, para los callbacks que no se vuelven a crear.
  const tx = useTextos();
  const txRef = useRef(tx);
  txRef.current = tx;
  const [notas, setNotas] = useState<NotaResumen[]>(() => [notaVacia()]);
  const [activa, setActiva] = useState(() => notas[0].id);
  // Posición del cursor en una ref y no en el estado: cambia en cada movimiento del mouse al
  // seleccionar, y si cada cambio volviera a dibujar la ventana entera (barra lateral, conteo de
  // palabras), el scroll al seleccionar texto largo perdería cuadros. Solo se vuelve a dibujar
  // cuando el cursor pasa a otro título (`tituloCursor`).
  const cursor = useRef(0);
  const [, setTituloCursor] = useState(-1);
  const [barraVisible, setBarraVisible] = useState(true);
  // Los ajustes ya vienen leídos de `main.tsx`: así la bienvenida no aparece un instante si ya
  // hay hormigueros.
  const [ajustes, setAjustes] = useState<Ajustes>(ajustesIniciales);
  const carpeta = ajustes.carpeta;
  const [arbol, setArbol] = useState<Entrada[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Copias en refs para que los atajos y callbacks lean siempre el valor más reciente.
  const notasRef = useRef(notas);
  notasRef.current = notas;
  const activaRef = useRef(activa);
  activaRef.current = activa;
  const carpetaRef = useRef(carpeta);
  carpetaRef.current = carpeta;
  const ajustesRef = useRef(ajustes);
  ajustesRef.current = ajustes;

  /** Muestra un error en la barra de estado. */
  const fallo = useCallback((e: unknown) => setError(String(e)), []);

  // Vuelve a leer los ajustes al iniciar y los actualiza cada vez que se guardan.
  useEffect(() => {
    leerAjustes().then(setAjustes, fallo);
    const dejar = escucharAjustes(setAjustes);
    return () => void dejar.then((f) => f());
  }, [fallo]);

  /** Cambia la lista de fijados: se muestra al instante y se guarda en los ajustes. */
  const cambiarFijados = useCallback((cambiar: (fijados: string[]) => string[]) => {
    const nuevos = { ...ajustesRef.current, fijados: cambiar(ajustesRef.current.fijados) };
    setAjustes(nuevos);
    guardarAjustes(nuevos).catch(fallo);
  }, [fallo]);

  /** Cambia algunos ajustes: se aplican al instante y se guardan. */
  const cambiarAjustes = useCallback((cambios: Partial<Ajustes>) => {
    const nuevos = { ...ajustesRef.current, ...cambios };
    setAjustes(nuevos);
    guardarAjustes(nuevos).catch(fallo);
  }, [fallo]);

  /** Guarda el ancho de la barra lateral (tras arrastrar su borde) en los ajustes. */
  const cambiarAnchoBarra = useCallback((ancho: number | null) => cambiarAjustes({ ancho_barra: ancho }), [cambiarAjustes]);

  // Lo que se abre encima del editor desde el menú: «Compilar y exportar», Ajustes, «Hormiguero
  // nuevo» y la bienvenida (que también aparece sola mientras no haya ningún hormiguero).
  const [compilando, setCompilando] = useState(false);
  const [enAjustes, setEnAjustes] = useState(false);
  const [cavando, setCavando] = useState(false);
  const [verBienvenida, setVerBienvenida] = useState(false);
  useEvento("abrir-compilar", useCallback(() => setCompilando(true), []));
  useEvento("abrir-ajustes", useCallback(() => setEnAjustes(true), []));
  useEvento("nuevo-hormiguero", useCallback(() => setCavando(true), []));
  useEvento("abrir-bienvenida", useCallback(() => setVerBienvenida(true), []));
  const bienvenida = verBienvenida || ajustes.hormigueros.length === 0;

  /** Abre un hormiguero (y lo suma a la lista si es nuevo); cierra lo que se abrió para cavarlo. */
  const abrirHormiguero = useCallback((ruta: string) => {
    cambiarAjustes(conHormiguero(ajustesRef.current, ruta));
    setCavando(false);
    setVerBienvenida(false);
  }, [cambiarAjustes]);

  /** Cambia el icono de un fijado; `null` vuelve al de su tipo. */
  const cambiarIcono = useCallback((clave: string, icono: string | null) => {
    const iconos = { ...ajustesRef.current.iconos };
    if (icono) iconos[clave] = icono;
    else delete iconos[clave];
    cambiarAjustes({ iconos });
  }, [cambiarAjustes]);

  /** Quita un fijado, y su icono si tenía uno elegido. */
  const desfijar = useCallback((clave: string) => {
    const { [clave]: _, ...iconos } = ajustesRef.current.iconos;
    cambiarAjustes({ fijados: ajustesRef.current.fijados.filter((f) => f !== clave), iconos });
  }, [cambiarAjustes]);

  /** Texto de una nota abierta, con sus cambios sin guardar (para compilarla tal como se ve). */
  const textoAbierto = useCallback((ruta: string) => {
    const nota = notasRef.current.find((n) => n.ruta === ruta);
    return nota ? editor.current?.getText(nota.id) : undefined;
  }, []);

  /** Vuelve a leer el árbol del hormiguero abierto (tras guardar, o al volver a la ventana). */
  const refrescarArbol = useCallback(() => {
    const dir = carpetaRef.current;
    if (!dir) return setArbol([]);
    listarCarpeta(dir).then(setArbol, (e) => {
      setArbol([]);
      fallo(e);
    });
  }, [fallo]);

  // Guardado automático: cada nota con archivo que cambia tiene un temporizador; al vencer (tras
  // `PAUSA_GUARDADO` sin escribir) se guarda.
  const temporizadores = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  /**
   * Guarda ya en su archivo una nota con cambios, con el texto del editor. Si mientras se
   * guardaba se siguió escribiendo, la nota queda con cambios para el próximo guardado.
   */
  const guardarYa = useCallback(async (id: string) => {
    clearTimeout(temporizadores.current.get(id));
    temporizadores.current.delete(id);
    const nota = notasRef.current.find((n) => n.id === id);
    if (!nota?.ruta || !nota.sucio) return;
    const texto = editor.current?.getText(id) ?? nota.texto;
    await guardarNota(nota.ruta, texto);
    setNotas((ns) => ns.map((n) => (n.id === id && n.texto === texto ? { ...n, sucio: false } : n)));
  }, []);

  /** Guarda ya todas las notas con archivo que tienen cambios (al salir de la ventana o de la app). */
  const guardarPendientes = useCallback(
    () => Promise.all(notasRef.current.filter((n) => n.ruta && n.sucio).map((n) => guardarYa(n.id))),
    [guardarYa],
  );

  // Lee el árbol cuando cambia la carpeta y cada vez que la ventana recupera el foco, por si se
  // crearon, borraron o movieron notas desde fuera de la app (Finder, Obsidian, etc.). Al perder
  // el foco, guarda lo pendiente.
  useEffect(refrescarArbol, [carpeta, refrescarArbol]);
  useEffect(() => {
    const dejar = getCurrentWindow().onFocusChanged(({ payload: enfocada }) => {
      if (enfocada) refrescarArbol();
      else guardarPendientes().catch(fallo);
    });
    return () => void dejar.then((f) => f());
  }, [refrescarArbol, guardarPendientes, fallo]);

  // Antes de cerrar la ventana (botón rojo) se guarda lo pendiente; si falla, la ventana se
  // cierra igual, para no dejarla trabada.
  useEffect(() => {
    const dejar = getCurrentWindow().onCloseRequested(() => guardarPendientes().then(() => {}, () => {}));
    return () => void dejar.then((f) => f());
  }, [guardarPendientes]);

  // Al salir de la app (Cmd+Q, el Dock) Rust espera a que se guarde lo pendiente: avisa con
  // `antes-de-salir` y sale cuando la interfaz llama a `salir` (o a los pocos segundos).
  useEvento(
    "antes-de-salir",
    useCallback(() => void guardarPendientes().finally(() => invoke("salir")), [guardarPendientes]),
  );

  /** Lleva el cursor al título `titulo` de la nota visible, cuyo texto es `texto`. */
  const irATitulo = useCallback((texto: string, titulo: string) => {
    const m = extraerMarcadores(texto).find((m) => m.texto === titulo);
    if (m) editor.current?.irA(m.pos);
  }, []);
  // Título al que hay que ir apenas se muestre la nota que se está abriendo (capítulo fijado).
  const capituloPendiente = useRef<string | null>(null);

  // Al cambiar la nota activa, el editor muestra su estado (o la crea con su texto la primera vez)
  // y, si se abrió desde un capítulo fijado, va a ese título.
  useEffect(() => {
    const nota = notasRef.current.find((n) => n.id === activa);
    if (!nota) return;
    editor.current?.mostrar(nota.id, nota.texto);
    if (capituloPendiente.current) irATitulo(nota.texto, capituloPendiente.current);
    capituloPendiente.current = null;
  }, [activa, irATitulo]);

  /** Cambia los datos de una nota abierta. */
  const actualizar = useCallback((id: string, cambios: Partial<NotaResumen>) => {
    setNotas((ns) => ns.map((n) => (n.id === id ? { ...n, ...cambios } : n)));
  }, []);

  // Cada cambio en el editor actualiza el texto de la nota activa, la marca como modificada y, si
  // tiene archivo, programa su guardado.
  const alCambiar = useCallback((t: string) => {
    const id = activaRef.current;
    actualizar(id, { texto: t, sucio: true });
    if (!notasRef.current.find((n) => n.id === id)?.ruta) return;
    clearTimeout(temporizadores.current.get(id));
    temporizadores.current.set(id, setTimeout(() => guardarYa(id).catch(fallo), PAUSA_GUARDADO));
  }, [actualizar, guardarYa, fallo]);

  /**
   * Deja visible `nota` como la única nota con archivo abierta: las demás con archivo se guardan
   * y se cierran, y también la nota en blanco. Solo siguen abiertas las notas nuevas que ya tienen
   * algo escrito (sin archivo todavía), para no perderlas.
   */
  const dejarSola = useCallback(async (nota: NotaResumen) => {
    const otras = notasRef.current.filter((n) => n.id !== nota.id);
    const salen = otras.filter((n) => n.ruta || (!n.texto && !n.sucio));
    await Promise.all(salen.map((n) => guardarYa(n.id)));
    salen.forEach((n) => editor.current?.olvidar(n.id));
    setNotas([...otras.filter((n) => !salen.includes(n)), nota]);
    setActiva(nota.id);
  }, [guardarYa]);

  /** Abre la nota de `ruta` (o la muestra, si ya estaba abierta) en lugar de la que había. */
  const abrirRuta = useCallback(async (ruta: string) => {
    const ya = notasRef.current.find((n) => n.ruta === ruta);
    await dejarSola(ya ?? { id: nuevoId(), ruta, texto: await leerNota(ruta), sucio: false });
  }, [dejarSola]);

  /**
   * Modo diario: abre la nota del día elegido en el calendario (`Daily/AAAA-MM-DD.md`). Rust crea
   * la carpeta y la nota si no existen; luego se refresca el árbol para que aparezcan.
   */
  const abrirDiaElegido = useCallback(async (fecha: Date) => {
    const dir = carpetaRef.current;
    if (!dir) throw new Error(txRef.current.diarioSinCarpeta);
    await abrirRuta(await abrirDia(dir, fecha, txRef.current.locale));
    refrescarArbol();
  }, [abrirRuta, refrescarArbol]);

  /** Abre la nota de un capítulo fijado y lleva el cursor a su título. */
  const abrirCapitulo = useCallback(async (ruta: string, titulo: string) => {
    const abierta = notasRef.current.find((n) => n.ruta === ruta);
    if (abierta && abierta.id === activaRef.current) return irATitulo(abierta.texto, titulo);
    capituloPendiente.current = titulo;
    try {
      await abrirRuta(ruta);
    } catch (e) {
      capituloPendiente.current = null;
      throw e;
    }
  }, [abrirRuta, irATitulo]);

  /** Muestra el diálogo «Abrir» (empezando en el hormiguero) y abre la nota elegida. */
  const abrir = useCallback(async () => {
    const ruta = await elegirNota(carpetaRef.current, txRef.current.filtroNotas);
    if (ruta) await abrirRuta(ruta);
  }, [abrirRuta]);

  /**
   * Guarda la nota activa; si todavía no tiene ruta, o se pide «guardar como», pregunta dónde,
   * proponiendo el hormiguero abierto. Después refresca el árbol para que aparezca la nota nueva.
   */
  const guardar = useCallback(async (como = false) => {
    const nota = notasRef.current.find((n) => n.id === activaRef.current);
    if (!nota) return;
    if (nota.ruta && !como) return guardarYa(nota.id);
    let destino = nota.ruta;
    if (!destino || como) {
      const nombre = nota.ruta ? nombreArchivo(nota.ruta) : txRef.current.notaNueva;
      destino = await elegirRutaGuardado(carpetaRef.current ? unir(carpetaRef.current, nombre) : nombre, txRef.current.filtroNotas);
    }
    if (!destino) return;
    clearTimeout(temporizadores.current.get(nota.id));
    await guardarNota(destino, editor.current?.getText(nota.id) ?? "");
    actualizar(nota.id, { ruta: destino, sucio: false });
    refrescarArbol();
  }, [actualizar, refrescarArbol, guardarYa]);

  /**
   * Cierra una nota y muestra la vecina. Si tiene archivo, antes guarda sus cambios; si es una
   * nota nueva con algo escrito, pregunta antes de descartarla.
   */
  const cerrar = useCallback(async (id: string) => {
    const lista = notasRef.current;
    const i = lista.findIndex((n) => n.id === id);
    const nota = lista[i];
    if (!nota) return;
    if (nota.ruta) await guardarYa(id);
    else if (nota.sucio) {
      const t = txRef.current;
      const nombre = nota.ruta ? nombreArchivo(nota.ruta) : t.sinTitulo;
      const descartar = await ask(t.cambiosSinGuardar(nombre), {
        title: t.cerrarNotaTitulo,
        kind: "warning",
        okLabel: t.descartarCambios,
        cancelLabel: t.cancelar,
      });
      if (!descartar) return;
    }
    editor.current?.olvidar(id);
    const resto = lista.filter((n) => n.id !== id);
    // Nunca queda la ventana vacía: si se cerró la última nota, se abre una en blanco.
    if (resto.length === 0) resto.push(notaVacia());
    setNotas(resto);
    if (id === activaRef.current) setActiva(resto[Math.min(i, resto.length - 1)].id);
  }, [guardarYa]);

  /** Pasa a la nota siguiente (`paso` = 1) o anterior (`paso` = -1), dando la vuelta al llegar al final. */
  const moverse = useCallback((paso: number) => {
    const lista = notasRef.current;
    const i = lista.findIndex((n) => n.id === activaRef.current);
    setActiva(lista[(i + paso + lista.length) % lista.length].id);
  }, []);

  // Atajos de teclado. Los errores (permisos, disco lleno…) se muestran en la barra de estado.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const tecla = e.key.toLowerCase();
      let accion: (() => Promise<void> | void) | null = null;
      if (tecla === "s") accion = () => guardar(e.shiftKey);
      else if (tecla === "o") accion = abrir;
      else if (tecla === "n") accion = () => dejarSola(notaVacia());
      else if (tecla === "\\") accion = () => setBarraVisible((v) => !v);
      // Con Shift, las teclas [ y ] cambian de carácter según el teclado; se usa el código físico.
      else if (e.shiftKey && e.code === "BracketRight") accion = () => moverse(1);
      else if (e.shiftKey && e.code === "BracketLeft") accion = () => moverse(-1);
      if (!accion) return;
      e.preventDefault();
      Promise.resolve(accion()).then(() => setError(null), fallo);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [guardar, abrir, dejarSola, moverse, fallo]);

  const nota = notas.find((n) => n.id === activa) ?? notas[0];
  const nombre = nota.ruta ? nombreArchivo(nota.ruta) : tx.sinTitulo;

  // Solo una nota nueva (sin archivo) tiene cambios que esperan a que el usuario la guarde; las
  // demás se guardan solas, así que no se marcan (la marca parpadearía al escribir).
  const sinGuardar = nota.sucio && !nota.ruta;

  // El título de la ventana (visible en Mission Control y el Dock) muestra la nota y si está sin guardar.
  useEffect(() => {
    getCurrentWindow().setTitle(`${sinGuardar ? "• " : ""}${nombre}`).catch(() => {});
  }, [nombre, sinGuardar]);

  // El conteo y los títulos recorren la nota entera: solo se recalculan cuando cambia su texto.
  const { palabras, lineas, caracteres } = useMemo(() => contar(nota.texto), [nota.texto]);
  const marcadores = useMemo(() => extraerMarcadores(nota.texto), [nota.texto]);
  const marcadoresRef = useRef(marcadores);
  marcadoresRef.current = marcadores;

  // Modo escritor para el editor (o `null` si está apagado), con las comillas según el idioma.
  const escritor = useMemo(
    () => (ajustes.escritor ? configEscritor(ajustes.opciones_escritor, idiomaDe(ajustes.idioma)) : null),
    [ajustes.escritor, ajustes.opciones_escritor, ajustes.idioma],
  );

  /** Guarda la posición del cursor y vuelve a dibujar solo si cambió el título en el que está. */
  const alMoverCursor = useCallback((pos: number) => {
    cursor.current = pos;
    setTituloCursor(marcadorActual(marcadoresRef.current, pos));
  }, []);

  return (
    <main className="app">
      {/* Franja superior que reemplaza la barra de título nativa (oculta en tauri.conf.json):
          deja espacio a los botones de la ventana y permite arrastrarla. */}
      <div className="arrastre" data-tauri-drag-region />
      <div className="cuerpo">
        {barraVisible && (
          <BarraLateral
            carpeta={carpeta}
            arbol={arbol}
            fijados={ajustes.fijados}
            iconos={ajustes.iconos}
            diario={ajustes.diario}
            ancho={ajustes.ancho_barra ?? ANCHO_BARRA}
            onCambiarAncho={cambiarAnchoBarra}
            onAbrirDia={(fecha) => abrirDiaElegido(fecha).then(() => setError(null), fallo)}
            onFijar={(ruta) => cambiarFijados((f) => (f.includes(ruta) ? f : [...f, ruta]))}
            onDesfijar={desfijar}
            onCambiarIcono={cambiarIcono}
            onAbrirCapitulo={(ruta, titulo) => abrirCapitulo(ruta, titulo).then(() => setError(null), fallo)}
            notas={notas}
            activa={activa}
            marcadores={marcadores}
            tituloActual={marcadorActual(marcadores, cursor.current)}
            onElegir={setActiva}
            onAbrirRuta={(ruta) => abrirRuta(ruta).then(() => setError(null), fallo)}
            onCerrar={(id) => cerrar(id).catch(fallo)}
            onSaltar={(pos) => editor.current?.irA(pos)}
          />
        )}
        <Editor ref={editor} onChange={alCambiar} onCursor={alMoverCursor} escritor={escritor} />
      </div>
      {compilando && !bienvenida && (
        <Compilar
          carpeta={carpeta}
          arbol={arbol}
          rutaActiva={nota.ruta}
          ajustes={ajustes}
          textoAbierto={textoAbierto}
          onGuardarAjustes={cambiarAjustes}
          onCerrar={() => {
            setCompilando(false);
            editor.current?.focus();
          }}
        />
      )}
      {enAjustes && !bienvenida && (
        <ModalAjustes
          ajustes={ajustes}
          cambiar={cambiarAjustes}
          onNuevoHormiguero={() => setCavando(true)}
          onCerrar={() => {
            setEnAjustes(false);
            editor.current?.focus();
          }}
        />
      )}
      {bienvenida && (
        <Bienvenida
          idioma={idiomaDe(ajustes.idioma)}
          onCambiarIdioma={(idioma) => cambiarAjustes({ idioma })}
          onListo={abrirHormiguero}
          onCerrar={ajustes.hormigueros.length ? () => setVerBienvenida(false) : undefined}
        />
      )}
      {cavando && <NuevoHormiguero onListo={abrirHormiguero} onCerrar={() => setCavando(false)} />}
      <footer className="estado">
        <span>{sinGuardar ? `${nombre} *` : nombre}</span>
        {error ? (
          <span className="estado-error">{error}</span>
        ) : (
          <span>{tx.conteo(palabras, lineas, caracteres)}</span>
        )}
      </footer>
    </main>
  );
}

export default App;
