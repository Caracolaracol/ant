# Ant · identidad

## Icono

Dos antenas de hormiga rectas y gruesas, con la maza redonda en la punta, saliendo en diagonal
desde abajo hacia arriba. Se probó una versión acodada, pero se prefirió la recta por simple.

- `ant-icono.svg`: fuente vectorial. Sigue el mismo sistema que Mantis (`~/Code/meeting-recorder/Resources/Brand`):
  lienzo de 64×64, radio 14, fondo `#232031`, figura plana sin filtros ni degradados.
  Antenas en dorado `#d9b45a` (color provisional).
- `ant-icono-1024.png`: rasterización para generar los iconos. Igual que Mantis, el diseño se
  reduce a 824×824 px, centrado con 100 px de margen transparente, para que en el Dock se vea
  del mismo tamaño que los iconos de macOS.
- `generar-icono.swift`: crea el PNG anterior desde el SVG.

## Regenerar los iconos de la app

```sh
swift marca/generar-icono.swift marca/ant-icono.svg marca/ant-icono-1024.png
pnpm tauri icon marca/ant-icono-1024.png
rm -rf src-tauri/icons/android src-tauri/icons/ios   # la app es solo de escritorio
```
