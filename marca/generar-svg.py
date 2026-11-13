# Genera marca/ant-icono.svg: dos antenas de hormiga acodadas que se afinan de la base a la punta.
# Un trazo SVG tiene grosor fijo, así que cada antena se dibuja como figura rellena: se recorre
# la antena en muchos pasos cortos y cada paso es un trapecio con círculos en sus extremos (que
# redondean la base, el codo y la punta). El grosor sigue una curva: casi igual en la mayor parte
# de la antena y afinándose suavemente hacia la punta.
# Para ajustar el diseño, cambiar PUNTOS (izquierda; la derecha es su espejo), GRUESO, FINO y CURVA.
# Uso: python3 marca/generar-svg.py

import math
from pathlib import Path

FONDO = "#232031"
DORADO = "#d9b45a"
# Antena izquierda, de la base a la punta, en un lienzo de 64×64.
PUNTOS = [(27.5, 52), (22, 31), (12.5, 19)]
# Grosor en la base y en la punta.
GRUESO = 6.6
FINO = 4.4
# Forma del afinado: 1 sería lineal; con valores mayores el grosor se mantiene más tiempo y
# baja recién cerca de la punta.
CURVA = 2.2
# Pasos por unidad de largo: más pasos, borde más liso.
PASOS_POR_UNIDAD = 3


def n(x: float) -> str:
    """Número con dos decimales como máximo, sin ceros sobrantes."""
    return f"{x:.2f}".rstrip("0").rstrip(".")


def circulo(x: float, y: float, r: float) -> str:
    return f"M{n(x - r)} {n(y)}a{n(r)} {n(r)} 0 1 0 {n(2 * r)} 0a{n(r)} {n(r)} 0 1 0 {n(-2 * r)} 0Z"


def grosor(t: float) -> float:
    """Grosor a la fracción `t` del largo de la antena (0 = base, 1 = punta)."""
    return GRUESO - (GRUESO - FINO) * t**CURVA


def muestrear(puntos):
    """Divide la antena en pasos cortos; devuelve (x, y, grosor) para cada paso, de la base a la punta."""
    tramos = list(zip(puntos, puntos[1:]))
    largos = [math.hypot(x2 - x1, y2 - y1) for (x1, y1), (x2, y2) in tramos]
    total = sum(largos)
    muestras, recorrido = [], 0.0
    for ((x1, y1), (x2, y2)), largo in zip(tramos, largos):
        pasos = max(1, round(largo * PASOS_POR_UNIDAD))
        for i in range(pasos):
            f = i / pasos
            muestras.append((x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, grosor((recorrido + largo * f) / total)))
        recorrido += largo
    x, y = puntos[-1]
    muestras.append((x, y, grosor(1)))
    return muestras


def antena(puntos) -> str:
    """Figura rellena de una antena: trapecios entre muestras consecutivas y círculos en cada muestra."""
    muestras = muestrear(puntos)
    partes = []
    for (x1, y1, g1), (x2, y2, g2) in zip(muestras, muestras[1:]):
        largo = math.hypot(x2 - x1, y2 - y1)
        # Vector perpendicular unitario al paso, para abrir el trapecio a cada lado.
        px, py = -(y2 - y1) / largo, (x2 - x1) / largo
        r1, r2 = g1 / 2, g2 / 2
        partes.append(
            f"M{n(x1 + px * r1)} {n(y1 + py * r1)}L{n(x2 + px * r2)} {n(y2 + py * r2)}"
            f"L{n(x2 - px * r2)} {n(y2 - py * r2)}L{n(x1 - px * r1)} {n(y1 - py * r1)}Z"
        )
    # Círculos solo en la base, el codo y la punta: en los tramos rectos los trapecios ya calzan.
    for x, y in puntos:
        g = next(g for mx, my, g in muestras if abs(mx - x) < 1e-9 and abs(my - y) < 1e-9)
        partes.append(circulo(x, y, g / 2))
    return "".join(partes)


izquierda = antena(PUNTOS)
derecha = antena([(64 - x, y) for x, y in PUNTOS])
svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title desc">
  <title id="title">Ant · antenas</title>
  <desc id="desc">Dos antenas de hormiga acodadas que se afinan hacia la punta, en dorado sobre fondo oscuro. Generado por generar-svg.py.</desc>
  <rect width="64" height="64" rx="14" fill="{FONDO}"/>
  <path fill="{DORADO}" d="{izquierda}{derecha}"/>
</svg>
"""
Path(__file__).with_name("ant-icono.svg").write_text(svg)
print("SVG creado: marca/ant-icono.svg")
