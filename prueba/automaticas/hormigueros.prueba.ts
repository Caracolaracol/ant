// Pruebas automáticas del hormiguero y sus cámaras, el árbol de carpetas, el modo diario y los colores. Se
// corren con `pnpm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buscarEntradaPorRuta,
  carpetaQueContieneA,
  carpetasQueContienenA,
  estaDentroDe,
  estaEnLaCamara,
  marcarComoTextoDeIzquierdaADerecha,
  type EntradaDelArbol,
} from "../../src/arbolDeCarpetas.ts";
import {
  buscarCarpetaDelDiario,
  claveDelDia,
  diaDeLaNotaDiaria,
  diasQueTienenNota,
  rutaDeLaCarpetaDelDiario,
} from "../../src/diario.ts";
import {
  CAMARA_DE_ENTRADA,
  cambiosParaElegirHormiguero,
  carpetaDeLaCamaraAbierta,
  esLaEntrada,
  laCamaraAbiertaExiste,
  nombreVisibleDeLaCamara,
  rutaDeLaCamara,
} from "../../src/hormigueros/hormigueros.ts";
import {
  datosParaGuardar,
  datosParaUsar,
  datosQueQuedabanEnLosAjustes,
  rutaCompletaEnLaCamara,
  rutaRelativaALaCamara,
  sonDatosVacios,
  type DatosDeLaCamara,
} from "../../src/hormigueros/datosDeLaCamara.ts";
import { AJUSTES_POR_DEFECTO, type OpcionesDeCompilacion } from "../../src/ajustes.ts";
import { COLORES_POR_DEFECTO, TEMAS, esColorClaro } from "../../src/colores.ts";

const nota = (ruta: string): EntradaDelArbol => ({ nombre: ruta.split("/").pop()!, ruta, esCarpeta: false, hijos: [] });
const carpeta = (ruta: string, hijos: EntradaDelArbol[]): EntradaDelArbol => ({ nombre: ruta.split("/").pop()!, ruta, esCarpeta: true, hijos });

test("sabe si una ruta está dentro de una carpeta (sin confundir prefijos)", () => {
  assert.ok(estaDentroDe("/n/Libro/a.md", "/n"));
  assert.ok(estaDentroDe("/n", "/n/"));
  assert.ok(estaDentroDe("C:\\n\\a.md", "C:\\n"));
  assert.ok(!estaDentroDe("/novela/a.md", "/n"));
});

test("lista las carpetas que contienen una nota, de la más honda a la más alta", () => {
  assert.deepEqual(carpetasQueContienenA("/n/Libro/Parte 1/a.md", "/n"), ["/n/Libro/Parte 1", "/n/Libro"]);
  assert.deepEqual(carpetasQueContienenA("/n/a.md", "/n"), []);
});

test("busca entradas en el árbol a cualquier profundidad", () => {
  const arbol = [carpeta("/n/Libro", [carpeta("/n/Libro/Parte", [nota("/n/Libro/Parte/a.md")])]), nota("/n/b.md")];
  assert.equal(buscarEntradaPorRuta(arbol, "/n/Libro/Parte/a.md")?.nombre, "a.md");
  assert.equal(buscarEntradaPorRuta(arbol, "/n/b.md")?.nombre, "b.md");
  assert.equal(buscarEntradaPorRuta(arbol, "/n/c.md"), undefined);
});

test("marca las rutas como texto de izquierda a derecha", () => {
  assert.equal(marcarComoTextoDeIzquierdaADerecha("/a"), "\u200e/a\u200e");
});

test("modo diario: claves de días, la carpeta Daily y los días con nota", () => {
  assert.equal(claveDelDia(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(rutaDeLaCarpetaDelDiario("/n/"), "/n/Daily");
  assert.equal(rutaDeLaCarpetaDelDiario("C:\\n"), "C:\\n\\Daily");
  const arbol = [carpeta("/n/daily", [nota("/n/daily/2026-11-20.md"), nota("/n/daily/ideas.md")]), nota("/n/a.md")];
  assert.equal(buscarCarpetaDelDiario(arbol)?.ruta, "/n/daily");
  assert.deepEqual([...diasQueTienenNota(arbol)], ["2026-11-20"]);
  assert.equal(diaDeLaNotaDiaria("/n/Daily/2026-11-20.md"), "2026-11-20");
  assert.equal(diaDeLaNotaDiaria("/n/a.md"), null);
  assert.equal(diaDeLaNotaDiaria(null), null);
});

test("la ruta de una cámara usa el separador del hormiguero", () => {
  assert.equal(rutaDeLaCamara("/Users/yo/Hormiguero", "Novela"), "/Users/yo/Hormiguero/Novela");
  assert.equal(rutaDeLaCamara("/Users/yo/Hormiguero/", "Novela"), "/Users/yo/Hormiguero/Novela");
  assert.equal(rutaDeLaCamara("C:\\Hormiguero", "Novela"), "C:\\Hormiguero\\Novela");
});

test("la cámara abierta: se da por buena mientras se leen las cámaras, y falta si ya no está", () => {
  const conCamara = { ...AJUSTES_POR_DEFECTO, hormiguero: "/h", camara_abierta: "Novela" };
  assert.equal(carpetaDeLaCamaraAbierta(conCamara, null), "/h/Novela");
  assert.equal(carpetaDeLaCamaraAbierta(conCamara, ["Novela", "Trabajo"]), "/h/Novela");
  assert.equal(carpetaDeLaCamaraAbierta(conCamara, ["Trabajo"]), null, "se borró o renombró su carpeta");
  assert.ok(!laCamaraAbiertaExiste({ ...conCamara, camara_abierta: null }, ["Novela"]));
  assert.equal(carpetaDeLaCamaraAbierta({ ...conCamara, hormiguero: null }, null), null);
});

test("la «Entrada» es la raíz del hormiguero y solo son suyas las notas sueltas", () => {
  assert.equal(rutaDeLaCamara("/h/", CAMARA_DE_ENTRADA), "/h");
  assert.ok(esLaEntrada(CAMARA_DE_ENTRADA) && !esLaEntrada("Novela") && !esLaEntrada(null));
  assert.equal(nombreVisibleDeLaCamara(CAMARA_DE_ENTRADA, "Entrada"), "Entrada");
  assert.equal(nombreVisibleDeLaCamara("Novela", "Entrada"), "Novela");
  const enLaEntrada = { ...AJUSTES_POR_DEFECTO, hormiguero: "/h", camara_abierta: CAMARA_DE_ENTRADA };
  assert.equal(carpetaDeLaCamaraAbierta(enLaEntrada, [CAMARA_DE_ENTRADA, "Novela"]), "/h");
  assert.equal(carpetaDeLaCamaraAbierta(enLaEntrada, ["Novela"]), null, "sin notas sueltas, la Entrada desaparece");
  assert.ok(estaEnLaCamara("/h/suelta.md", "/h", true));
  assert.ok(!estaEnLaCamara("/h/Novela/a.md", "/h", true), "lo de las subcarpetas es de otras cámaras");
  assert.ok(estaEnLaCamara("/h/Novela/Libro/a.md", "/h/Novela", false));
  assert.ok(!estaEnLaCamara("/h/suelta.md", "/h/Novela", false));
  assert.equal(carpetaQueContieneA("/h/Novela/a.md"), "/h/Novela");
  assert.equal(carpetaQueContieneA("C:\\h\\a.md"), "C:\\h");
});

test("los datos de la cámara en .ant/ usan rutas relativas con /", () => {
  assert.equal(rutaRelativaALaCamara("/h/Novela/Libro I/01.md", "/h/Novela/"), "Libro I/01.md");
  assert.equal(rutaRelativaALaCamara("/h/Novela", "/h/Novela"), ".");
  assert.equal(rutaRelativaALaCamara("C:\\h\\Novela\\Libro\\a.md", "C:\\h\\Novela"), "Libro/a.md");
  assert.equal(rutaCompletaEnLaCamara("Libro/a.md", "C:\\h\\Novela"), "C:\\h\\Novela\\Libro\\a.md");
  assert.equal(rutaCompletaEnLaCamara(".", "/h/Novela/"), "/h/Novela");

  const opciones = { orden: ["/h/Novela/Libro/b.md", "/h/Novela/Libro/a.md"], excluidas: ["/h/Novela/Libro/a.md"], titulo: "La colonia" } as OpcionesDeCompilacion;
  const datosEnLaApp: DatosDeLaCamara = {
    fijados: ["/h/Novela/Libro", "/h/Novela/Libro/a.md#Parte 1/2"],
    iconos_de_fijados: { "/h/Novela/Libro": "book" },
    opciones_de_compilacion_por_carpeta: { "/h/Novela/Libro": opciones },
  };
  const datosEnElArchivo = datosParaGuardar(datosEnLaApp, "/h/Novela");
  assert.deepEqual(datosEnElArchivo.fijados, ["Libro", "Libro/a.md#Parte 1/2"], "el título de un capítulo no se toca");
  assert.deepEqual(datosEnElArchivo.iconos_de_fijados, { Libro: "book" });
  assert.deepEqual(datosEnElArchivo.opciones_de_compilacion_por_carpeta.Libro.orden, ["Libro/b.md", "Libro/a.md"]);
  assert.deepEqual(datosParaUsar(datosEnElArchivo, "/h/Novela"), datosEnLaApp, "ida y vuelta");
  // En otro computador, el mismo archivo sirve con otra ruta del hormiguero.
  assert.deepEqual(datosParaUsar(datosEnElArchivo, "/otro/Novela").fijados, ["/otro/Novela/Libro", "/otro/Novela/Libro/a.md#Parte 1/2"]);
});

test("lo que una cámara tenía en los ajustes pasa a su archivo, y lo de las otras se queda", () => {
  const ajustes = {
    ...AJUSTES_POR_DEFECTO,
    fijados: ["/h/Novela/a.md", "/h/Trabajo/b.md", "/h/suelta.md#Idea"],
    iconos_de_fijados: { "/h/Novela/a.md": "book", "/h/Trabajo/b.md": "code" },
    opciones_de_compilacion_por_carpeta: { "/h/Novela": { orden: [], excluidas: [] } as unknown as OpcionesDeCompilacion },
  };
  const deLaNovela = datosQueQuedabanEnLosAjustes(ajustes, "/h/Novela", false);
  assert.deepEqual(deLaNovela.datosDeLaCamara.fijados, ["/h/Novela/a.md"]);
  assert.deepEqual(Object.keys(deLaNovela.datosDeLaCamara.opciones_de_compilacion_por_carpeta), ["/h/Novela"]);
  assert.deepEqual(deLaNovela.ajustesSinEsosDatos.fijados, ["/h/Trabajo/b.md", "/h/suelta.md#Idea"]);
  assert.deepEqual(deLaNovela.ajustesSinEsosDatos.iconos_de_fijados, { "/h/Trabajo/b.md": "code" });
  assert.deepEqual(deLaNovela.ajustesSinEsosDatos.opciones_de_compilacion_por_carpeta, {});
  const deLaEntrada = datosQueQuedabanEnLosAjustes(ajustes, "/h", true);
  assert.deepEqual(deLaEntrada.datosDeLaCamara.fijados, ["/h/suelta.md#Idea"], "en la Entrada, solo lo suelto en la raíz");
  assert.ok(sonDatosVacios(datosQueQuedabanEnLosAjustes(ajustes, "/h/Personal", false).datosDeLaCamara));
});

test("el tema por defecto es «Ant», el primero", () => {
  assert.equal(TEMAS[0].id, "hormiga");
  assert.equal(COLORES_POR_DEFECTO.acento, "#e5ea15");
});

test("cambiar de hormiguero pide elegir otra vez la cámara", () => {
  assert.deepEqual(cambiosParaElegirHormiguero("/otro"), { hormiguero: "/otro", camara_abierta: null });
});

test("distingue colores claros y oscuros", () => {
  assert.ok(esColorClaro("#f6f3ec"));
  assert.ok(!esColorClaro("#1d1d20"));
  assert.ok(!esColorClaro("no es un color"));
});
