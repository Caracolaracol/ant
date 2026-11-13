# Ant · identidad

## Icono

La cabeza de una hormiga vista de frente, completa en la parte de abajo del icono (ancha arriba,
más angosta hacia abajo), y dos antenas acodadas que salen de ella en diagonal hacia arriba. Las
antenas se afinan suavemente hacia la punta y su codo es curvo, sin esquina en el lado interior.
Sombreado difuminado como cilindro, con luz desde arriba a la izquierda, y degradado dorado; la
cabeza lleva un degradado radial con la misma luz y un borde fino del color del fondo que la
separa de las antenas. Sin sombra sobre el fondo; el fondo es siempre de un solo color, `#232031`.
Versiones descartadas: recta (demasiado simple), con maza redonda en la punta, con bandas de luz
marcadas y con la cabeza cortada por el borde inferior.

- `generar-svg.py`: genera `ant-icono.svg`. Las antenas son figuras rellenas (no trazos) para
  poder afinarlas; la forma se ajusta con `PUNTOS`, `REDONDEO` (curva del codo), `CABEZA` (forma de la cabeza), `GRUESO`, `FINO` y `CURVA`
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
