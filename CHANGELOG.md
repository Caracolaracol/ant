# Changelog

Todos los cambios importantes de Ant quedan anotados aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones siguen
[Semantic Versioning](https://semver.org/lang/es/).

Para publicar una versión nueva: subir la versión en `package.json`,
`src-tauri/tauri.conf.json` y `src-tauri/Cargo.toml`, agregar su sección aquí y empujar la
etiqueta `vX.Y.Z`. El workflow `.github/workflows/release.yml` compila para macOS, Windows y
Linux y publica la versión con esta sección como notas.

## [Sin publicar]

## [0.1.0] - 2026-11-18

Primera versión pública.

### Agregado

- Editor de Markdown con CodeMirror 6: el texto se guarda tal cual se escribe, como archivos
  `.md` en disco, sin base de datos ni cuentas.
- Resaltado de Markdown y de los bloques de código.
- Buscar y reemplazar (Cmd+F), deshacer y rehacer con historial por nota.
- Barra lateral (`Cmd+\`) con:
  - «Fijados»: notas y carpetas fijadas arriba con clic derecho;
  - «Abiertas»: notas fuera de la carpeta o sin guardar;
  - el árbol de la carpeta de trabajo, con carpetas plegables;
  - los títulos de la nota activa, para saltar entre secciones.
- Varias notas abiertas a la vez; se pasa de una a otra con Cmd+Shift+] y Cmd+Shift+[.
- Barra de estado con palabras, líneas y caracteres.
- Ventana de Ajustes (Cmd+,) para elegir la carpeta de trabajo.
- Guardado atómico: la nota se escribe en un archivo temporal y se renombra, así nunca queda a
  medio guardar.
- Menú propio en español. Cmd+W no cierra la ventana principal, para no perder una nota sin
  guardar.
- Seleccionar arrastrando hasta el borde desplaza el texto en cada cuadro de pantalla, más
  rápido y sin saltos (parche a CodeMirror en `patches/`).
- Icono: cara de hormiga amarilla (`#e5ea15`) sobre fondo oscuro (`#1d1d20`).
- Descargas para macOS (universal: Apple Silicon e Intel), Windows y Linux.
- Sitio y documentación en inglés y español: https://caracolaracol.github.io/ant/
- Licencia MIT.

[Sin publicar]: https://github.com/Caracolaracol/ant/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Caracolaracol/ant/releases/tag/v0.1.0
