# Genera marca/ant-icono.svg: dos antenas de hormiga acodadas, en dorado sobre fondo oscuro.
#
# Cómo se dibuja cada antena:
# - Su línea central es una polilínea (PUNTOS) cuyo codo se redondea con una curva (REDONDEO), así
#   el lado interior del codo («la axila») queda curvo y no en esquina.
# - Un trazo SVG tiene grosor fijo, así que la antena es una figura rellena: se recorre la línea
#   central en pasos cortos y a cada lado se desplaza medio grosor. El grosor sigue una curva:
#   casi igual en casi toda la antena y afinándose suavemente hacia la punta (GRUESO, FINO, CURVA).
# - Sombreado difuminado como un cilindro con luz desde arriba a la izquierda: la antena se cubre
#   con muchas franjas finas a lo largo, cada una con un brillo o una sombra semitransparente
#   cuya intensidad cambia de a poco a lo ancho (funciones `brillo_en` y `sombra_en`). Las franjas
#   se recortan con la forma de la antena, así el sombreado llega también a las puntas
#   redondeadas. Encima va un degradado dorado de arriba (más claro) hacia abajo. Sin filtros,
#   para que cualquier visor lo dibuje igual, y sin sombra sobre el fondo, que es de un solo
#   color (el mismo de Mantis).
# - La cabeza de la hormiga está completa en la parte de abajo, dibujada encima de las bases de
#   las antenas para que se vea que salen de ella. Un borde fino del color del fondo la separa
#   de las antenas.
#
# Uso: python3 marca/generar-svg.py

import math
from pathlib import Path

# Antena izquierda, de la base a la punta, en un lienzo de 64×64 (la derecha es su espejo).
PUNTOS = [(28, 42), (22, 25), (12.5, 13)]
# Cabeza de hormiga vista de frente, completa en la parte de abajo del icono: ancha arriba y más
# angosta hacia abajo (donde irían las mandíbulas). Las bases de las antenas quedan escondidas
# bajo su borde superior. CABEZA_LUZ_EN es el punto más iluminado de su degradado.
CABEZA = "M32 35C41.5 35 46 39.5 46 45.5C46 51.5 39.5 57 32 57C24.5 57 18 51.5 18 45.5C18 39.5 22.5 35 32 35Z"
CABEZA_LUZ_EN = (27, 40)
# Franjas para el sombreado difuminado: más franjas, transición más suave.
FRANJAS = 28
# Cuánto se adelanta la curva del codo, a cada lado del vértice (en unidades del lienzo).
REDONDEO = 4.5
# Grosor en la base y en la punta, y forma del afinado (1 = lineal; mayor = se afina más tarde).
GRUESO = 6.6
FINO = 4.4
CURVA = 2.2
# Pasos por unidad de largo al recorrer la antena: más pasos, borde más liso.
PASOS_POR_UNIDAD = 4

# Colores.
FONDO = "#232031"
DORADO_ARRIBA = "#e8c876"
DORADO_ABAJO = "#c39a41"
BRILLO = "#fbe7a8"
SOMBRA_LATERAL = "#8f6d27"
CABEZA_LUZ = "#d6b261"
CABEZA_SOMBRA = "#8a6624"


def n(x: float) -> str:
    """Número con dos decimales como máximo, sin ceros sobrantes."""
    return f"{x:.2f}".rstrip("0").rstrip(".")


def grosor(t: float) -> float:
    """Grosor a la fracción `t` del largo de la antena (0 = base, 1 = punta)."""
    return GRUESO - (GRUESO - FINO) * t**CURVA


def linea_central(puntos):
    """
    Recorre la polilínea en pasos cortos, reemplazando cada codo por una curva cuadrática que
    empieza REDONDEO antes del vértice y termina REDONDEO después. Devuelve los puntos (x, y).
    """
    def hacia(a, b, d):
        """Punto a distancia `d` de `a` en dirección a `b`."""
        largo = math.hypot(b[0] - a[0], b[1] - a[1])
        return (a[0] + (b[0] - a[0]) * d / largo, a[1] + (b[1] - a[1]) * d / largo)

    def recta(a, b):
        pasos = max(1, round(math.hypot(b[0] - a[0], b[1] - a[1]) * PASOS_POR_UNIDAD))
        return [(a[0] + (b[0] - a[0]) * i / pasos, a[1] + (b[1] - a[1]) * i / pasos) for i in range(pasos)]

    def curva(a, c, b):
        pasos = max(4, round(2 * REDONDEO * PASOS_POR_UNIDAD))
        return [
            ((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t**2 * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t**2 * b[1])
            for t in (i / pasos for i in range(pasos))
        ]

    resultado, inicio = [], puntos[0]
    for previo, vertice, siguiente in zip(puntos, puntos[1:], puntos[2:]):
        entrada, salida = hacia(vertice, previo, REDONDEO), hacia(vertice, siguiente, REDONDEO)
        resultado += recta(inicio, entrada) + curva(entrada, vertice, salida)
        inicio = salida
    return resultado + recta(inicio, puntos[-1]) + [puntos[-1]]


def extender(centro, d: float = 4.0):
    """Prolonga la línea central `d` unidades por cada extremo, siguiendo su dirección."""
    def punta(a, b):
        largo = math.hypot(a[0] - b[0], a[1] - b[1])
        return (a[0] + (a[0] - b[0]) * d / largo, a[1] + (a[1] - b[1]) * d / largo)
    return [punta(centro[0], centro[1])] + centro + [punta(centro[-1], centro[-2])]


def brillo_en(u: float) -> float:
    """Opacidad del brillo a la posición `u` del ancho (-1 = lado iluminado, 1 = lado contrario)."""
    return 0.6 * math.exp(-(((u + 0.38) / 0.36) ** 2))


def sombra_en(u: float) -> float:
    """Opacidad de la sombra a la posición `u` del ancho: nula en el centro, crece hacia el lado contrario."""
    return 0.6 * max(0.0, (u + 0.05) / 1.05) ** 1.6


def banda(centro, desde: float, hasta: float, redondear: bool = True) -> str:
    """
    Figura entre dos desplazamientos laterales de la línea central, expresados como fracción del
    medio grosor (-1 = borde izquierdo, 1 = borde derecho). `banda(c, -1, 1)` es la antena entera,
    con extremos redondeados si `redondear` es verdadero.
    """
    largos = [0.0]
    for (x1, y1), (x2, y2) in zip(centro, centro[1:]):
        largos.append(largos[-1] + math.hypot(x2 - x1, y2 - y1))
    total = largos[-1]
    lado_a, lado_b = [], []
    for i, (x, y) in enumerate(centro):
        # Tangente promediando los vecinos, y su perpendicular unitaria.
        ax, ay = centro[max(i - 1, 0)]
        bx, by = centro[min(i + 1, len(centro) - 1)]
        largo = math.hypot(bx - ax, by - ay)
        px, py = -(by - ay) / largo, (bx - ax) / largo
        r = grosor(largos[i] / total) / 2
        lado_a.append((x + px * r * desde, y + py * r * desde))
        lado_b.append((x + px * r * hasta, y + py * r * hasta))
    contorno = lado_a + lado_b[::-1]
    d = "M" + "L".join(f"{n(x)} {n(y)}" for x, y in contorno) + "Z"
    if redondear:
        # Círculo en la base y en la punta. Debe girar en el mismo sentido que el contorno: con la
        # regla de relleno por defecto (nonzero), un círculo en sentido contrario se restaría y
        # dejaría un agujero. El signo del área (fórmula del cordón) dice el sentido del contorno.
        area = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(contorno, contorno[1:] + contorno[:1]))
        giro = 1 if area > 0 else 0
        for (x, y), t in ((centro[0], 0.0), (centro[-1], 1.0)):
            r = grosor(t) / 2
            d += f"M{n(x - r)} {n(y)}a{n(r)} {n(r)} 0 1 {giro} {n(2 * r)} 0a{n(r)} {n(r)} 0 1 {giro} {n(-2 * r)} 0Z"
    return d


antenas = [linea_central(PUNTOS), linea_central([(64 - x, y) for x, y in PUNTOS])]
entera = "".join(banda(c, -1, 1) for c in antenas)
# Franjas a lo largo de las antenas, de un borde al otro, con su brillo y su sombra. Las líneas
# centrales se prolongan para que, al recortarlas con la forma de la antena, cubran las puntas.
# El grosor de las franjas sigue al de la antena porque `banda` usa fracciones del medio grosor.
extendidas = [extender(c) for c in antenas]
franjas = []
for i in range(FRANJAS):
    desde, hasta = -1.15 + 2.3 * i / FRANJAS, -1.15 + 2.3 * (i + 1) / FRANJAS
    u = max(-1.0, min(1.0, (desde + hasta) / 2))
    d = "".join(banda(c, desde, hasta, redondear=False) for c in extendidas)
    if brillo_en(u) > 0.01:
        franjas.append(f'    <path fill="{BRILLO}" fill-opacity="{n(brillo_en(u))}" d="{d}"/>')
    if sombra_en(u) > 0.01:
        franjas.append(f'    <path fill="{SOMBRA_LATERAL}" fill-opacity="{n(sombra_en(u))}" d="{d}"/>')
franjas = "\n".join(franjas)

svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title desc">
  <title id="title">Ant · antenas</title>
  <desc id="desc">Dos antenas de hormiga acodadas y sombreadas que salen de la cabeza, en dorado sobre fondo oscuro. Generado por generar-svg.py.</desc>
  <defs>
    <!-- Volumen de la cabeza: más clara arriba a la izquierda, donde pega la luz. -->
    <radialGradient id="cabeza" cx="{n(CABEZA_LUZ_EN[0])}" cy="{n(CABEZA_LUZ_EN[1])}" r="20" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{CABEZA_LUZ}"/>
      <stop offset="1" stop-color="{CABEZA_SOMBRA}"/>
    </radialGradient>
    <!-- Las franjas del sombreado se recortan con la forma de las antenas. -->
    <clipPath id="antenas">
      <path d="{entera}"/>
    </clipPath>
    <linearGradient id="dorado" x1="0" y1="8" x2="0" y2="44" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{DORADO_ARRIBA}"/>
      <stop offset="1" stop-color="{DORADO_ABAJO}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="{FONDO}"/>
  <path fill="url(#dorado)" d="{entera}"/>
  <g clip-path="url(#antenas)">
{franjas}
  </g>
  <path d="{CABEZA}" fill="url(#cabeza)" stroke="{FONDO}" stroke-width="1.2"/>
</svg>
"""
Path(__file__).with_name("ant-icono.svg").write_text(svg)
print("SVG creado: marca/ant-icono.svg")
