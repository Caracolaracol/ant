// Pruebas automáticas de los hormigueros, el árbol de carpetas, el modo diario y los colores. Se
// corren con `pnpm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buscarEntradaPorRuta,
  carpetasQueContienenA,
  estaDentroDe,
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
import { cambiosParaAbrirHormiguero, cambiosParaQuitarHormigueroDeLaLista } from "../../src/hormigueros/hormigueros.ts";
import { AJUSTES_POR_DEFECTO } from "../../src/ajustes.ts";
import { esColorClaro } from "../../src/colores.ts";

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

test("abrir un hormiguero lo suma a la lista una sola vez", () => {
  const conUno = { ...AJUSTES_POR_DEFECTO, ...cambiosParaAbrirHormiguero(AJUSTES_POR_DEFECTO, "/novela") };
  assert.equal(conUno.hormiguero_abierto, "/novela");
  assert.deepEqual(conUno.hormigueros, ["/novela"]);
  const otraVez = { ...conUno, ...cambiosParaAbrirHormiguero(conUno, "/novela") };
  assert.deepEqual(otraVez.hormigueros, ["/novela"]);
});

test("quitar el hormiguero abierto abre el siguiente; quitar el último deja ninguno", () => {
  const conDos = { ...AJUSTES_POR_DEFECTO, hormigueros: ["/novela", "/diario"], hormiguero_abierto: "/novela" };
  const sinNovela = { ...conDos, ...cambiosParaQuitarHormigueroDeLaLista(conDos, "/novela") };
  assert.deepEqual(sinNovela.hormigueros, ["/diario"]);
  assert.equal(sinNovela.hormiguero_abierto, "/diario");
  const sinNinguno = { ...sinNovela, ...cambiosParaQuitarHormigueroDeLaLista(sinNovela, "/diario") };
  assert.deepEqual(sinNinguno.hormigueros, []);
  assert.equal(sinNinguno.hormiguero_abierto, null);
  // Quitar uno que no está abierto no cambia el abierto.
  assert.equal(cambiosParaQuitarHormigueroDeLaLista(conDos, "/diario").hormiguero_abierto, "/novela");
});

test("distingue colores claros y oscuros", () => {
  assert.ok(esColorClaro("#f6f3ec"));
  assert.ok(!esColorClaro("#1d1d20"));
  assert.ok(!esColorClaro("no es un color"));
});
