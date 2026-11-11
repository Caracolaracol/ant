# Note Taking App

App de escritorio para tomar notas: simple, rápida y centrada en el texto.

## Referencia

El punto de partida es **Left** (`/Applications/Left.app`, de Hundred Rabbits, código en
`Contents/Resources/app/`). De Left tomamos la idea, no el código:

- Una sola ventana con un área de texto a pantalla completa y una barra lateral de navegación
  (archivos abiertos y marcadores `#`/`##` del documento).
- Las notas son archivos de texto plano en disco, sin base de datos.
- Barra de estado con conteo de palabras, líneas y caracteres.
- Todo se maneja con atajos de teclado (nuevo, abrir, guardar, buscar, reemplazar, ir a línea,
  siguiente/anterior archivo o marcador, tamaño de letra, modo lectura).
- Temas de color definidos con pocas variables.

Left está hecho con Electron 7 y pesa ~150 MB; esta app debe ser bastante más liviana y rápida.

## Stack

Por decidir. Cuando se elija, documentar aquí el stack, cómo instalar dependencias, cómo correr
la app en desarrollo y cómo compilarla.

## Estructura del proyecto

Por definir junto con el stack. Mantener esta sección al día cuando se agreguen carpetas o
módulos.

## Comentarios en el código

- Al inicio de cada archivo, un comentario que diga qué hace ese archivo y qué papel cumple en la app.
- Sobre cada función, componente y bloque no trivial, un comentario que explique qué hace y,
  cuando no sea obvio, por qué lo hace así.
- Escribe los comentarios en español.
- Cuando modifiques código, actualiza sus comentarios para que sigan describiendo lo que el
  código hace realmente.

## Git

- No agregar líneas `Co-Authored-By` de asistentes de IA en los commits ni en los PR.
