# Ant · identidad

## Icono

Dos antenas de hormiga acodadas (escapo largo y flagelo doblado hacia afuera) que salen en
diagonal desde abajo y se afinan suavemente hacia la punta. El codo es curvo, sin esquina en el
lado interior. Sombreado como cilindro con luz desde arriba a la izquierda (brillo, lado oscuro y
degradado dorado), sombra difusa sobre el fondo y fondo con un leve degradado radial.
Versiones descartadas: recta (demasiado simple) y con maza redonda en la punta.

- `generar-svg.py`: genera `ant-icono.svg`. Las antenas son figuras rellenas (no trazos) para
  poder afinarlas; la forma se ajusta con `PUNTOS`, `REDONDEO` (curva del codo), `GRUESO`, `FINO` y `CURVA`
  (afinado suave, no lineal), y los colores con las constantes de arriba del script.
- `ant-icono.svg`: fuente vectorial. Sigue el mismo sistema que Mantis (`~/Code/meeting-recorder/Resources/Brand`):
  lienzo de 64×64, radio 14 y fondo oscuro azulado. A diferencia de Mantis (plano), Ant lleva
  sombreado con degradados; no usa filtros, para que cualquier visor lo dibuje igual.
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
