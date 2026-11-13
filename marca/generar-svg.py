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
# - Hacia la cintura (el frente, en cúpula) el gáster se oscurece hasta casi negro (como en las
#   fotos) con un degradado parejo que se desvanece hacia atrás. Sin mancha concentrada en el
#   centro de arriba: hacía que se viera como una abertura. Sin borde claro: el frente queda negro.
# - Hacia la punta de atrás el gáster también se oscurece de a poco.
# - Adelante, separada del gáster, la cintura: un círculo casi negro.
# - Todo el conjunto se gira en diagonal (GIRO) para que se lea como parte de un insecto.
# - Todo el abdomen se difumina. El renderizador de SVG de macOS ignora los filtros en grupos y
#   los pixela en elementos, así que el desenfoque lo hace generar-icono.swift con Core Image.
#   Para eso este script escribe también, en marca/capas/, el fondo, el interior del abdomen (sin
#   recortar) y su silueta, y el valor de DIFUMINADO.
# Sin clip-rule evenodd ni máscaras (el renderizador de SVG de macOS no respeta el primero y
# pixela las segundas) y sin sombra sobre el fondo, que es de un solo color (FONDO).
#
# Uso: python3 marca/generar-svg.py

from pathlib import Path

# Colores. El gáster de C. chilensis es dorado con tonos anaranjados: claro dorado en los
# brillos (centro de cada segmento), ámbar hacia los bordes del segmento y naranja intenso en el
# halo difuminado de cada sutura.
FONDO = "#1d1d20"
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
ADELANTE = 12.5
ATRAS = 51.5
ANCHO = 35
# Alturas (en el centro) donde empieza cada segmento, de adelante hacia atrás, y cuánto se
# arquean hacia atrás los bordes de los segmentos.
SEGMENTOS = [12.5, 22.5, 32, 40.5]
ARCO = 4.5
# Giro del conjunto en grados (negativo = la cintura apunta arriba a la izquierda), alrededor del
# centro del lienzo.
GIRO = 0
# Qué se dibuja delante del gáster: la cintura (nudo oscuro) y, opcionalmente, el final del
# tórax (oscuro, casi negro como el cuerpo de C. chilensis).
CINTURA = False
TORAX = False
# Cintura: radio del círculo y espacio entre él y el frente del gáster.
CINTURA_RADIO = 3.2
CINTURA_SEPARACION = 1.8
# Desenfoque de todo el abdomen (desviación del desenfoque gaussiano, en unidades del lienzo).
# Lo aplica generar-icono.swift con Core Image (el desenfoque de SVG de macOS sale pixelado).
DIFUMINADO = 0.2
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
GROSOR_SUTURA = [1, 1, 1.9, 1]
# La franja central (la sutura más gruesa) se refuerza con una banda café de este ancho (en
# unidades del lienzo), de tono parejo y bordes apenas suavizados.
ANCHO_FRANJA_CENTRAL = 3.6



def n(x: float) -> str:
    """Número con dos decimales como máximo, sin ceros sobrantes."""
    return f"{x:.2f}".rstrip("0").rstrip(".")


def gaster(adentro: float = 0.0) -> str:
    """
    Contorno del gáster: frente en cúpula redondeada (hacia la cintura), costados que se abren
    hasta el punto más ancho en el primer tercio, y la parte de atrás redondeada.
    `adentro` lo achica esa distancia por todos lados (para el recorte del dorado de base).
    """
    cx, a, b, r = CENTRO_X, ADELANTE + adentro, ATRAS - adentro, ANCHO / 2 - adentro
    ancho_en = a + (b - a) * 0.36  # altura del punto más ancho
    frente = r * 0.78  # medio ancho donde termina la cúpula del frente
    alto = 3.5  # cuánto baja la cúpula desde su punto más alto hasta donde empiezan los costados
    # El frente es una cúpula amplia y redondeada (no un borde casi recto, que con el
    # oscurecimiento se veía como la boca de un frasco). El primer punto de control de cada
    # costado sigue la tangente de la cúpula, para que la unión sea suave y sin «hombros».
    tx, ty = frente * 0.25, 2 * alto * 0.25  # prolongación de la tangente al final de la cúpula
    return (
        f"M{n(cx - frente)} {n(a + alto)}"
        f"Q{n(cx)} {n(a - alto)} {n(cx + frente)} {n(a + alto)}"
        f"C{n(cx + frente + tx)} {n(a + alto + ty)} {n(cx + r)} {n(ancho_en - 4)} {n(cx + r)} {n(ancho_en)}"
        f"C{n(cx + r)} {n(ancho_en + 13)} {n(cx + r * 0.62)} {n(b)} {n(cx)} {n(b)}"
        f"C{n(cx - r * 0.62)} {n(b)} {n(cx - r)} {n(ancho_en + 13)} {n(cx - r)} {n(ancho_en)}"
        f"C{n(cx - r)} {n(ancho_en - 4)} {n(cx - frente - tx)} {n(a + alto + ty)} {n(cx - frente)} {n(a + alto)}Z"
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
# Rectángulo más grande que el gáster, para pintar los degradados antes del recorte.
GRANDE = "M-8 -8H72V72H-8Z"
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
    suturas += halo(y1, BANDA, round(BANDA_PASOS * g), 0.225, min(0.85, 0.6 * g))
    suturas.append(f'    <path fill="none" stroke="{SUTURA}" stroke-width="{n(0.6 * g)}" stroke-opacity="0.9" d="{borde(y1)}"/>')

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
# Refuerzo de la franja central: una banda café de tono parejo en todo su ancho, con los bordes
# apenas suavizados (unos pocos trazos un poco más anchos y tenues). Si se oscureciera desde el
# centro hacia los bordes se leería como hendidura. Va debajo del brillo y de las sombras, para
# que reciba la misma luz que el resto de la superficie y se lea como pigmento, no como hueco.
central = SEGMENTOS[GROSOR_SUTURA.index(max(GROSOR_SUTURA))]
franja_central = "\n".join(
    [f'    <path fill="none" stroke="{BANDA}" stroke-opacity="0.7" stroke-width="{n(ANCHO_FRANJA_CENTRAL)}" d="{borde(central)}"/>']
    + [
        f'    <path fill="none" stroke="{BANDA}" stroke-opacity="0.12" '
        f'stroke-width="{n(ANCHO_FRANJA_CENTRAL + 0.35 * (k + 1))}" d="{borde(central)}"/>'
        for k in range(3)
    ]
)

cintura = (
    f'<circle fill="url(#cintura)" cx="{n(CENTRO_X)}" cy="{n(ADELANTE - CINTURA_SEPARACION - CINTURA_RADIO)}" '
    f'r="{n(CINTURA_RADIO)}"/>'
)

# Contenido de base del abdomen (dorado, suturas y franja central) y sus capas de luz y sombra.
interior_base = "\n".join([*franjas, *suturas, franja_central])
interior_luz = f"""    <path fill="url(#brillo)" d="{GRANDE}"/>
    <path fill="url(#sombra)" d="{GRANDE}"/>
{sombra_interior}
    <path fill="url(#hacia-punta)" d="{GRANDE}"/>
    <path fill="url(#frente)" d="{GRANDE}"/>"""

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
    <linearGradient id="frente" x1="0" y1="{n(ADELANTE - 1)}" x2="0" y2="{n(ADELANTE + 13)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{NEGRO}" stop-opacity="0.92"/>
      <stop offset="0.5" stop-color="{NEGRO}" stop-opacity="0.5"/>
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
  <!-- Cada capa del abdomen se difumina (DIFUMINADO) y después todo se recorta una sola vez con
       su contorno, así el interior queda suave y la silueta nítida. Las capas no se recortan
       antes del desenfoque (el dorado y las franjas son más anchos que el gáster y los degradados
       van en un rectángulo grande), para que el desenfoque no aclare ni transparente la orilla. -->
  <g clip-path="url(#gaster)">
{interior_base}
{interior_luz}
  </g>
  </g>
</svg>
"""
Path(__file__).with_name("ant-icono.svg").write_text(svg)
print("SVG creado: marca/ant-icono.svg")

# Capas para generar-icono.swift: fondo, interior del abdomen sin recortar (para difuminarlo sin
# que la orilla se aclare) y silueta (blanca, para recortar el interior ya difuminado).
defs = svg[svg.index("<defs>"):svg.index("</defs>") + len("</defs>")]
abrir = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
capas = Path(__file__).with_name("capas")
capas.mkdir(exist_ok=True)
(capas / "fondo.svg").write_text(f'{abrir}<rect width="64" height="64" rx="14" fill="{FONDO}"/></svg>\n')
(capas / "interior.svg").write_text(f"{abrir}\n  {defs}\n  <g transform=\"rotate({n(GIRO)} 32 32)\">\n{interior_base}\n{interior_luz}\n  </g>\n</svg>\n")
(capas / "silueta.svg").write_text(f'{abrir}<g transform="rotate({n(GIRO)} 32 32)"><path fill="#fff" d="{contorno}"/></g></svg>\n')
(capas / "difuminado.txt").write_text(f"{DIFUMINADO}\n")
print("Capas creadas: marca/capas/")
