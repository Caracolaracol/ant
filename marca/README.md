# Ant · identidad

## Icono

El abdomen (gáster) de la hormiga *Camponotus chilensis* visto desde arriba, vertical, con la
cintura como un círculo oscuro separado, un poco más arriba. Referencia: fotos de la especie en
iNaturalist (gáster ovalado de pelo dorado con tonos anaranjados y anillos marcados entre
segmentos; cuerpo negro).

- Dorado claro al centro de cada segmento, ámbar hacia sus bordes y halo naranja en cada sutura.
- Franjas oscuras en las suturas, difuminadas hacia ambos lados; la del centro es más gruesa.
- El frente se oscurece hasta el negro al llegar a la cintura, sin borde claro.
- Profundidad: sombra interior que sigue el contorno y se desvanece suave hacia el centro, y más
  sombra hacia la punta de atrás. Brillo suave arriba a la izquierda.
- Sin borde en el contorno (el renderizador dejaba un hilo dorado en la orilla; se tapa con un
  trazo finísimo del mismo tono oscuro de la sombra). Máscaras no: macOS las dibuja pixeladas.
- Fondo siempre liso `#232031` (el de Mantis) y sin sombra detrás.

Historia: antes el icono eran dos antenas de hormiga (ver el historial de git); se cambió al
abdomen. Del abdomen se descartaron la versión en diagonal y la vertical sin cintura.

- `generar-svg.py`: genera `ant-icono.svg`. Forma con `ADELANTE`, `ATRAS`, `ANCHO` y
  `SEGMENTOS`; cintura con `CINTURA_RADIO` y `CINTURA_SEPARACION`; suturas con `GROSOR_SUTURA`,
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
