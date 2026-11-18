# Ant

App de escritorio para tomar notas en Markdown, simple y rápida. Inspirada en
[Left](https://github.com/hundredrabbits/Left).

Sitio y documentación: **https://caracolaracol.github.io/ant/**

Hecha con Tauri 2, React, TypeScript, Vite y CodeMirror 6.

## Descargar

Para macOS (Apple Silicon e Intel), Windows y Linux en
[Releases](https://github.com/Caracolaracol/ant/releases/latest). Los cambios de cada versión
están en el [CHANGELOG](CHANGELOG.md).

La app no está firmada por Apple ni por Microsoft: la primera vez el sistema avisa. En macOS,
intenta abrirla y luego ve a Ajustes del Sistema → Privacidad y seguridad → Abrir igualmente.

## Desarrollo

```sh
pnpm install
pnpm tauri dev     # abre la app con recarga en caliente
pnpm tauri build   # genera los instaladores en src-tauri/target/release/bundle/
```

## Atajos

En Windows y Linux, Ctrl en lugar de Cmd.

| Atajo | Acción |
|---|---|
| Cmd+N | Nueva nota |
| Cmd+O | Abrir nota |
| Cmd+S | Guardar |
| Cmd+Shift+S | Guardar como |
| Cmd+Shift+] / Cmd+Shift+[ | Nota siguiente / anterior |
| `Cmd+\` | Mostrar u ocultar la barra lateral |
| Cmd+, | Ajustes (carpeta de trabajo) |
| Cmd+F | Buscar y reemplazar |
| Cmd+Z / Cmd+Shift+Z | Deshacer / rehacer |

## Licencia

[MIT](LICENSE) © 2026 Agustín Rojas
