# Genera marca/ant-icono.svg: dos antenas de hormiga acodadas que se afinan de la base a la punta.
# Un trazo SVG tiene grosor fijo, así que cada antena se dibuja como figura rellena: un trapecio
# por tramo (más ancho abajo) y un círculo en cada punto, que redondea la base, el codo y la punta.
# Para ajustar el diseño, cambiar PUNTOS (izquierda; la derecha es su espejo) y GROSORES.
# Uso: python3 marca/generar-svg.py

import math
from pathlib import Path

FONDO = "#232031"
DORADO = "#d9b45a"
# Antena izquierda, de la base a la punta, en un lienzo de 64×64.
PUNTOS = [(27.5, 52), (22, 31), (12.5, 19)]
# Grosor de la antena en cada punto: más gruesa abajo, más delgada arriba.
GROSORES = [7.0, 5.6, 3.2]


def n(x: float) -> str:
    """Número con dos decimales como máximo, sin ceros sobrantes."""
    return f"{x:.2f}".rstrip("0").rstrip(".")


def circulo(x: float, y: float, r: float) -> str:
    return f"M{n(x - r)} {n(y)}a{n(r)} {n(r)} 0 1 0 {n(2 * r)} 0a{n(r)} {n(r)} 0 1 0 {n(-2 * r)} 0Z"


def antena(puntos) -> str:
    """Figura rellena de una antena: trapecios entre puntos consecutivos y círculos en cada punto."""
    partes = []
    for (x1, y1), (x2, y2), g1, g2 in zip(puntos, puntos[1:], GROSORES, GROSORES[1:]):
        largo = math.hypot(x2 - x1, y2 - y1)
        # Vector perpendicular unitario al tramo, para abrir el trapecio a cada lado.
        px, py = -(y2 - y1) / largo, (x2 - x1) / largo
        r1, r2 = g1 / 2, g2 / 2
        partes.append(
            f"M{n(x1 + px * r1)} {n(y1 + py * r1)}L{n(x2 + px * r2)} {n(y2 + py * r2)}"
            f"L{n(x2 - px * r2)} {n(y2 - py * r2)}L{n(x1 - px * r1)} {n(y1 - py * r1)}Z"
        )
    partes += [circulo(x, y, g / 2) for (x, y), g in zip(puntos, GROSORES)]
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
