# Ant · identidad

## Icono

Dos antenas de hormiga acodadas, protagonistas del icono, que salen en diagonal hacia arriba
desde la parte superior de la cabeza. De la cabeza solo se ve una franja: es más oscura (café
dorado) y se corta con un borde recto dentro del icono, sin desvanecerse ni tocar el borde del
icono. Las antenas nacen en el borde de la cabeza, sin separación. Mantienen su grosor casi todo
el largo y se angostan hacia la punta; su codo es curvo (sin esquina en el lado interior) y
tienen sombreado difuminado de cilindro con luz desde arriba a la izquierda y degradado dorado.
Sin sombra sobre el fondo; el fondo es siempre de un solo color, `#232031`.
Versiones descartadas: recta (demasiado simple), con maza redonda en la punta, con bandas de luz
marcadas, con la cabeza cortada por el borde inferior del icono, con la cabeza completa, con un
borde oscuro entre cabeza y antenas y con la cabeza desvanecida.

Nota técnica: el renderizador de SVG de macOS (con el que se genera el PNG) no respeta
`clip-rule="evenodd"`; para restar figuras se usan máscaras.

- `generar-svg.py`: genera `ant-icono.svg`. Las antenas son figuras rellenas (no trazos) para
  poder afinarlas; la forma se ajusta con `PUNTOS`, `REDONDEO` (curva del codo), `CABEZA` (forma de la cabeza), `CORTE` (altura del corte recto de la cabeza), `GRUESO`, `FINO` y `CURVA`
  (afinado suave, no lineal), `FRANJAS` (suavidad del sombreado), y los colores con las constantes de arriba del script.
- `ant-icono.svg`: fuente vectorial. Sigue el mismo sistema que Mantis (`~/Code/meeting-recorder/Resources/Brand`):
  lienzo de 64×64, radio 14 y el mismo fondo liso `#232031`. A diferencia de Mantis (plano), las
  antenas de Ant llevan sombreado; no usa filtros, para que cualquier visor lo dibuje igual.
  Antenas en dorado (color provisional).
- `ant-icono-1024.png`: rasterización para generar los iconos. Igual que Mantis, el diseño se
  reduce a 824×824 px, centrado con 100 px de margen transparente, para que en el Dock se vea
  del mismo tamaño que los iconos de macOS.
- `generar-icono.swift`: crea el PNG anterior desde el SVG.

## Regenerar los iconos de la app

```sh
python3 marca/generar-svg.py
swift marca/generar-icono.swift marca/ant-icono.svg marca/ant-icono-1024.png
pnpm tauri icon marca/ant-icono-1024.png
rm -rf src-tauri/icons/android src-tauri/icons/ios   # la app es solo de escritorio
```
