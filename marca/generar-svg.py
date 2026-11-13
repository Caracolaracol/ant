# Genera marca/ant-icono.svg: el abdomen (gáster) de la hormiga Camponotus chilensis visto desde
# arriba, en dorado sobre fondo oscuro.
#
# Referencia: fotos de iNaturalist de C. chilensis. Su gáster es ovalado, cubierto de pelo dorado
# con tonos anaranjados,
# con anillos transversales marcados donde un segmento se superpone al siguiente, y se une al
# resto del cuerpo (negro) por una cintura angosta (el pecíolo).
#
# Cómo se dibuja:
# - El gáster tiene el frente ancho y casi recto (arriba, donde se une la cintura), es más ancho
#   en su primer tercio y termina redondeado atrás (abajo).
# - Cada segmento es una franja entre dos curvas que se arquean hacia atrás (como placas vistas
#   desde arriba), recortada con la forma del gáster, de color parejo (sin degradado propio, para
#   que no parezcan tubos). Sobre cada sutura va una banda oscura angosta con un halo naranja algo
#   más ancho, ambos difuminados hacia los dos lados y siguiendo la curva de la sutura.
# - Encima, la profundidad: una sombra interior que sigue el contorno (más oscura junto al borde
#   y aclarándose hacia el centro, como un objeto abombado), más una sombra suave hacia atrás y
#   un brillo suave arriba a la izquierda.
# - Hacia la cintura el gáster se oscurece hasta llegar al negro (como en las fotos): un degradado
#   que oscurece todo el frente y otro radial, más intenso, centrado en la unión con la cintura;
#   ambos se desvanecen hacia atrás. Sin borde claro: el frente queda negro.
# - Hacia la punta de atrás el gáster también se oscurece de a poco.
# - Adelante, separada del gáster, la cintura: un círculo casi negro.
# - Todo el conjunto se gira en diagonal (GIRO) para que se lea como parte de un insecto.
# Sin filtros ni clip-rule evenodd (el renderizador de SVG de macOS no los respeta) y sin sombra
# sobre el fondo, que es de un solo color (el mismo de Mantis).
#
# Uso: python3 marca/generar-svg.py

from pathlib import Path

# Colores. El gáster de C. chilensis es dorado con tonos anaranjados: claro dorado en los
# brillos (centro de cada segmento), ámbar hacia los bordes del segmento y naranja intenso en el
# halo difuminado de cada sutura.
FONDO = "#232031"
DORADO_CLARO = "#f4c862"
DORADO = "#e9922f"
NARANJA = "#d9631a"
SUTURA = "#4a260c"
CINTURA_CLARA = "#2b221a"
CINTURA_OSCURA = "#0b0806"
# Negro del cuerpo: el frente del gáster se oscurece hasta este color al llegar a la cintura.
NEGRO = "#0b0806"
BANDA = "#47240a"

# Gáster: centro horizontal, borde de adelante (arriba) y de atrás (abajo), y ancho máximo.
CENTRO_X = 32
ADELANTE = 16
ATRAS = 55
ANCHO = 35
# Alturas (en el centro) donde empieza cada segmento, de adelante hacia atrás, y cuánto se
# arquean hacia atrás los bordes de los segmentos.
SEGMENTOS = [16, 26, 35.5, 44]
ARCO = 4.5
# Giro del conjunto en grados (negativo = la cintura apunta arriba a la izquierda), alrededor del
# centro del lienzo.
GIRO = 0
# Qué se dibuja delante del gáster: la cintura (nudo oscuro) y, opcionalmente, el final del
# tórax (oscuro, casi negro como el cuerpo de C. chilensis).
CINTURA = True
TORAX = False
# Cintura: radio del círculo y espacio entre él y el frente del gáster.
CINTURA_RADIO = 3.2
CINTURA_SEPARACION = 1.8
# Cuánto más adentro se recorta el dorado de base respecto de las sombras (evita el borde claro).
ORILLA = 0.1
# Sombra interior que da profundidad: hasta qué distancia del borde llega (en unidades del
# lienzo), en cuántos pasos, qué tan oscura es junto al borde y qué tan suave se desvanece hacia
# el centro (mayor CURVA = se aclara antes y termina más suave, sin corte visible).
SOMBRA_INTERIOR_ANCHO = 17
SOMBRA_INTERIOR_PASOS = 40
SOMBRA_INTERIOR_MAX = 0.85
SOMBRA_INTERIOR_CURVA = 1.7
# Pasos de las bandas difuminadas de cada sutura (más pasos, banda más ancha): el halo naranja
# y la banda oscura, encima.
HALO_PASOS = 9
BANDA_PASOS = 5
# Grosor relativo de cada sutura (una por segmento, la primera es el frente): la del centro es
# más gruesa, como se ve en las fotos.
GROSOR_SUTURA = [1, 1, 3.2, 1]



def n(x: float) -> str:
    """Número con dos decimales como máximo, sin ceros sobrantes."""
    return f"{x:.2f}".rstrip("0").rstrip(".")


def gaster(adentro: float = 0.0) -> str:
    """
    Contorno del gáster: frente ancho y casi recto (donde se une la cintura), costados que se
    abren hasta el punto más ancho en el primer tercio, y la parte de atrás redondeada.
    `adentro` lo achica esa distancia por todos lados (para el recorte del dorado de base).
    """
    cx, a, b, r = CENTRO_X, ADELANTE + adentro, ATRAS - adentro, ANCHO / 2 - adentro
    ancho_en = a + (b - a) * 0.36  # altura del punto más ancho
    frente = r * 0.62  # medio ancho del frente
    return (
        f"M{n(cx - frente)} {n(a + 1.5)}"
        f"Q{n(cx)} {n(a - 1.5)} {n(cx + frente)} {n(a + 1.5)}"
        f"C{n(cx + r * 0.92)} {n(a + 3)} {n(cx + r)} {n(ancho_en - 4)} {n(cx + r)} {n(ancho_en)}"
        f"C{n(cx + r)} {n(ancho_en + 13)} {n(cx + r * 0.62)} {n(b)} {n(cx)} {n(b)}"
        f"C{n(cx - r * 0.62)} {n(b)} {n(cx - r)} {n(ancho_en + 13)} {n(cx - r)} {n(ancho_en)}"
        f"C{n(cx - r)} {n(ancho_en - 4)} {n(cx - r * 0.92)} {n(a + 3)} {n(cx - frente)} {n(a + 1.5)}Z"
    )


def franja(y1: float, y2: float) -> str:
    """Zona entre dos bordes de segmento (curvas arqueadas hacia atrás), más ancha que el gáster."""
    izq, der = CENTRO_X - 24, CENTRO_X + 24
    return (
        f"M{n(izq)} {n(y1 - ARCO)}Q{n(CENTRO_X)} {n(y1 + ARCO)} {n(der)} {n(y1 - ARCO)}"
        f"L{n(der)} {n(y2 - ARCO)}Q{n(CENTRO_X)} {n(y2 + ARCO)} {n(izq)} {n(y2 - ARCO)}Z"
    )


def borde(y: float) -> str:
    """Curva del borde de atrás de un segmento, para marcar la sutura."""
    return f"M{n(CENTRO_X - 24)} {n(y - ARCO)}Q{n(CENTRO_X)} {n(y + ARCO)} {n(CENTRO_X + 24)} {n(y - ARCO)}"


contorno = gaster()
# El dorado de base se recorta un poco más adentro que las sombras: así la orilla queda solo con
# el tono oscuro de las sombras y no aparece un hilo dorado (borde) en el contorno.
contorno_base = gaster(ORILLA)
limites = SEGMENTOS + [ATRAS + 8]

def halo(y: float, color: str, pasos: int, paso: float, opacidad_max: float) -> list[str]:
    """
    Banda difuminada que sigue la curva de la sutura `y` y se funde hacia ambos lados: curvas
    paralelas a la sutura, hacia adelante y hacia atrás, cada vez más tenues.
    """
    trazos = []
    for k in range(pasos):
        opacidad = opacidad_max * (1 - k / pasos) ** 1.5
        for lado in ((1,) if k == 0 else (-1, 1)):
            trazos.append(
                f'    <path fill="none" stroke="{color}" stroke-width="{n(paso * 1.5)}" '
                f'stroke-opacity="{n(opacidad)}" d="{borde(y + lado * k * paso)}"/>'
            )
    return trazos


# Una franja por segmento, de color parejo: el volumen lo da la luz del abdomen entero (brillo y
# sombras de encima), no cada segmento por separado; si cada segmento tuviera su propio
# degradado claro al centro, se verían como tubos inflados (neumáticos).
degradados, franjas, suturas = [], [], []
for i, (y1, y2) in enumerate(zip(limites, limites[1:])):
    degradados.append(
        f'    <linearGradient id="segmento{i}" x1="0" y1="{n(y1)}" x2="0" y2="{n(y2)}" gradientUnits="userSpaceOnUse">\n'
        f'      <stop offset="0" stop-color="{DORADO}"/>\n'
        f'      <stop offset="1" stop-color="{DORADO}"/>\n'
        f"    </linearGradient>"
    )
    franjas.append(f'    <path fill="url(#segmento{i})" d="{franja(y1, y2)}"/>')
    # Cada sutura: un halo naranja ancho, encima una banda oscura más angosta (ambos difuminados
    # hacia los dos lados) y al centro la línea de la sutura.
    # GROSOR_SUTURA ensancha la banda oscura y la línea (la del centro es más gruesa).
    # El frente (i = 0) no lleva halo ni banda: ahí el gáster se oscurece hasta el negro.
    if i == 0:
        continue
    g = GROSOR_SUTURA[i]
    # Pasos cortos (0.3 y 0.225) para que las bandas se vean lisas y no rayadas.
    suturas += halo(y1, NARANJA, HALO_PASOS, 0.3, 0.45)
    suturas += halo(y1, BANDA, round(BANDA_PASOS * g), 0.225, min(0.95, 0.6 * g))
    # Núcleo de la banda: oscuro y sólido, más ancho cuanto mayor es GROSOR_SUTURA. Va en el
    # tono de la banda (no en el café de SUTURA, que aclaraba el centro de las franjas anchas).
    suturas.append(f'    <path fill="none" stroke="{BANDA}" stroke-width="{n(0.45 * g)}" stroke-opacity="0.9" d="{borde(y1)}"/>')
    suturas.append(f'    <path fill="none" stroke="{SUTURA}" stroke-width="0.5" stroke-opacity="0.9" d="{borde(y1)}"/>')

# Sombra interior que sigue la forma del gáster: el contorno trazado varias veces, cada vez más
# ancho y muy tenue. Como el recorte deja solo la mitad interior de cada trazo, la sombra se
# acumula junto al borde y se aclara hacia el centro, copiando la curva del abdomen.
# La oscuridad buscada a una distancia d del borde es MAX·(1 − d/ANCHO)^CURVA: se desvanece de
# a poco y llega a cero sin corte. Las capas semitransparentes no se suman sino que se multiplican
# (cada una deja pasar 1 − opacidad), así que la opacidad de cada trazo se calcula para que el
# producto dé exactamente esa oscuridad en cada tramo.
def oscuridad(d: float) -> float:
    return SOMBRA_INTERIOR_MAX * max(0.0, 1 - d / SOMBRA_INTERIOR_ANCHO) ** SOMBRA_INTERIOR_CURVA


sombra_interior = []
for k in range(SOMBRA_INTERIOR_PASOS):
    dentro = SOMBRA_INTERIOR_ANCHO * k / SOMBRA_INTERIOR_PASOS
    fuera = SOMBRA_INTERIOR_ANCHO * (k + 1) / SOMBRA_INTERIOR_PASOS
    opacidad = 1 - (1 - oscuridad(dentro)) / (1 - oscuridad(fuera))
    sombra_interior.append(
        f'    <path fill="none" stroke="{NEGRO}" stroke-opacity="{opacidad:.4f}" '
        f'stroke-width="{n(2 * fuera)}" d="{contorno}"/>'
    )
sombra_interior = "\n".join(sombra_interior)

# Cintura: un círculo oscuro separado del gáster, un poco más arriba.
cintura = (
    f'<circle fill="url(#cintura)" cx="{n(CENTRO_X)}" cy="{n(ADELANTE - CINTURA_SEPARACION - CINTURA_RADIO)}" '
    f'r="{n(CINTURA_RADIO)}"/>'
)

svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title desc">
  <title id="title">Ant · abdomen</title>
  <desc id="desc">Abdomen dorado y segmentado de la hormiga Camponotus chilensis visto desde arriba, sobre fondo oscuro. Generado por generar-svg.py.</desc>
  <defs>
{chr(10).join(degradados)}
    <!-- Todo lo del gáster se recorta con su contorno. (Una máscara evitaría el borde claro de la
         orilla, pero el renderizador de macOS dibuja las máscaras en baja resolución.) -->
    <clipPath id="gaster">
      <path d="{contorno}"/>
    </clipPath>
    <clipPath id="gaster-base">
      <path d="{contorno_base}"/>
    </clipPath>
    <!-- Brillo: la zona que recibe más luz, en el centro un poco hacia arriba a la izquierda, bien
         más clara que los costados para que se lea el volumen. -->
    <radialGradient id="brillo" cx="{n(CENTRO_X - 3)}" cy="{n(ADELANTE + 16)}" r="15" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffe089" stop-opacity="0.7"/>
      <stop offset="0.5" stop-color="#ffd476" stop-opacity="0.3"/>
      <stop offset="1" stop-color="#ffd476" stop-opacity="0"/>
    </radialGradient>
    <!-- Sombra difuminada en el costado derecho y hacia atrás, el lado contrario a la luz. -->
    <radialGradient id="sombra" cx="{n(CENTRO_X - 7)}" cy="{n(ADELANTE + 12)}" r="30" gradientUnits="userSpaceOnUse">
      <stop offset="0.45" stop-color="#2e1404" stop-opacity="0"/>
      <stop offset="1" stop-color="#2e1404" stop-opacity="0.6"/>
    </radialGradient>
    <!-- Oscurecimiento hacia la cintura: negro en la unión, transparente hacia atrás. -->
    <radialGradient id="hacia-cintura" cx="{n(CENTRO_X)}" cy="{n(ADELANTE - 2)}" r="14" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{NEGRO}" stop-opacity="1"/>
      <stop offset="0.35" stop-color="{NEGRO}" stop-opacity="0.85"/>
      <stop offset="0.7" stop-color="{NEGRO}" stop-opacity="0.3"/>
      <stop offset="1" stop-color="{NEGRO}" stop-opacity="0"/>
    </radialGradient>
    <!-- Oscurecimiento de todo el frente: negro adelante, transparente hacia atrás. -->
    <linearGradient id="frente" x1="0" y1="{n(ADELANTE - 1)}" x2="0" y2="{n(ADELANTE + 12)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{NEGRO}" stop-opacity="1"/>
      <stop offset="0.45" stop-color="{NEGRO}" stop-opacity="0.6"/>
      <stop offset="1" stop-color="{NEGRO}" stop-opacity="0"/>
    </linearGradient>
    <!-- Sombra hacia la punta de atrás: transparente a media altura, oscura en la punta. -->
    <linearGradient id="hacia-punta" x1="0" y1="{n(ATRAS - 18)}" x2="0" y2="{n(ATRAS)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{NEGRO}" stop-opacity="0"/>
      <stop offset="0.6" stop-color="{NEGRO}" stop-opacity="0.4"/>
      <stop offset="1" stop-color="{NEGRO}" stop-opacity="0.85"/>
    </linearGradient>
    <!-- Cintura (pecíolo): oscura, algo más clara a la izquierda por la luz. -->
    <linearGradient id="cintura" x1="{n(CENTRO_X - 5)}" y1="0" x2="{n(CENTRO_X + 5)}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{CINTURA_CLARA}"/>
      <stop offset="1" stop-color="{CINTURA_OSCURA}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="{FONDO}"/>
  <g transform="rotate({n(GIRO)} 32 32)">
  <!-- Final del tórax, delante de la cintura (solo si TORAX). -->
  {f'<path fill="url(#cintura)" d="M{n(CENTRO_X - 6)} {n(ADELANTE - 6)}C{n(CENTRO_X - 7)} {n(ADELANTE - 11)} {n(CENTRO_X - 4)} {n(ADELANTE - 14)} {n(CENTRO_X)} {n(ADELANTE - 14)}C{n(CENTRO_X + 4)} {n(ADELANTE - 14)} {n(CENTRO_X + 7)} {n(ADELANTE - 11)} {n(CENTRO_X + 6)} {n(ADELANTE - 6)}Z"/>' if TORAX else ""}
  <!-- Cintura: un nudo corto y oscuro que asoma por delante del gáster (solo si CINTURA). -->
  {cintura if CINTURA else ""}
  <!-- Orden de capas: dorado de base, su brillo, las franjas de las suturas (encima del brillo
       para que no las aclare) y al final las sombras, que oscurecen los costados de todo. -->
  <g clip-path="url(#gaster-base)">
{chr(10).join(franjas)}
    <path fill="url(#brillo)" d="{contorno}"/>
{chr(10).join(suturas)}
  </g>
  <g clip-path="url(#gaster)">
    <path fill="url(#sombra)" d="{contorno}"/>
{sombra_interior}
    <path fill="url(#hacia-punta)" d="{contorno}"/>
    <path fill="url(#frente)" d="{contorno}"/>
    <path fill="url(#hacia-cintura)" d="{contorno}"/>

  </g>
  </g>
</svg>
"""
Path(__file__).with_name("ant-icono.svg").write_text(svg)
print("SVG creado: marca/ant-icono.svg")
