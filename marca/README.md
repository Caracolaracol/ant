# Ant · identidad

## Icono

El abdomen (gáster) de la hormiga *Camponotus chilensis* visto desde arriba, vertical y
centrado en el icono, sin cintura. Referencia: fotos de la especie en
iNaturalist (gáster ovalado de pelo dorado con tonos anaranjados y anillos marcados entre
segmentos; cuerpo negro).

- Segmentos de color parejo (ámbar dorado) y halo naranja en cada sutura. Sin degradado propio
  por segmento: si cada uno se aclara al centro, parecen tubos inflados (neumáticos).
- Franjas oscuras en las suturas, difuminadas hacia ambos lados. La del centro es más ancha
  (`ANCHO_FRANJA_CENTRAL`): una banda café de tono parejo, bordes apenas suavizados y debajo de
  la luz, para que se lea como pigmento de la superficie. Descartado: negra sólida encima del
  brillo (parecía un hueco o ranura) y oscura al centro aclarándose a los bordes (hendidura).
- El frente se oscurece hasta el negro al llegar a la cintura, sin borde claro.
- Volumen: la zona central recibe bastante más luz (brillo dorado) que los costados, que se
  oscurecen con una sombra interior que sigue el contorno y se desvanece suave hacia el centro;
  más sombra hacia la punta de atrás. La opacidad de cada capa de sombra se calcula
  multiplicando (no sumando), para que la sombra llegue de verdad a la oscuridad buscada.
- Sin borde en el contorno: el renderizador dejaba un hilo dorado en la orilla, así que el dorado
  de base se recorta una fracción de píxel más adentro (`ORILLA`) que las sombras. Máscaras no:
  macOS las dibuja pixeladas.
- Fondo siempre liso `#232031` (el de Mantis) y sin sombra detrás.

Historia: antes el icono eran dos antenas de hormiga (ver el historial de git); se cambió al
abdomen. Del abdomen se descartaron la versión en diagonal y las que tenían cintura (pegada o
como círculo separado).

- `generar-svg.py`: genera `ant-icono.svg`. Forma con `ADELANTE`, `ATRAS`, `ANCHO` y
  `SEGMENTOS`; cintura (desactivada) con `CINTURA`, `CINTURA_RADIO` y `CINTURA_SEPARACION`; suturas con `GROSOR_SUTURA`,
  `HALO_PASOS` y `BANDA_PASOS`; profundidad con `SOMBRA_INTERIOR_*`; colores con las constantes
  del principio. `GIRO` y `TORAX` quedan para probar variantes.
- `ant-icono.svg`: fuente vectorial (lienzo 64×64, radio 14, como Mantis). Sin filtros ni
  `clip-rule="evenodd"`, que el renderizador de SVG de macOS no respeta.
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
