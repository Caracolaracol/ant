# Ant · identidad

## Icono

La cara de una hormiga vista de frente, con la misma simpleza que el icono de Mantis
(`~/Code/meeting-recorder/Resources/Brand/mantis-head.svg`): una figura plana de un solo color,
sin degradados, sombras ni filtros.

- Antenas acodadas (lo más reconocible de una hormiga), en trazo grueso de puntas redondas.
- Cabeza redondeada con el borde de arriba curvo, como la de Mantis.
- Ojos: puntos del color del fondo a los lados de la cabeza.
- Dos mandíbulas curvas que se cierran abajo.
- Figura amarilla `#e5ea15` sobre fondo liso `#1d1d20`, sin sombra detrás.
- Mismo encuadre que Mantis: lienzo 64×64, radio 14, figura escalada ×1,8 al centro.

Historia (ver el historial de git): primero fueron dos antenas doradas y después el abdomen
(gáster) de *Camponotus chilensis*, con sombreado y difuminado hechos con Core Image. Ninguno
convenció; se volvió a algo plano y simple, al estilo de Mantis.

- `ant-icono.svg`: fuente vectorial, escrita a mano.
- `ant-icono-1024.png`: rasterización para generar los iconos. Igual que Mantis, el diseño se
  reduce a 824×824 px, centrado con 100 px de margen transparente, para que en el Dock se vea
  del mismo tamaño que los iconos de macOS.
- `generar-icono.swift`: crea el PNG anterior desde el SVG.

## Regenerar los iconos de la app

```sh
swift marca/generar-icono.swift marca/ant-icono.svg marca/ant-icono-1024.png
pnpm tauri icon marca/ant-icono-1024.png
rm -rf src-tauri/icons/android src-tauri/icons/ios              # la app es solo de escritorio
```

Para una vista previa más chica: `swift marca/generar-icono.swift marca/ant-icono.svg vista.png 512`.
