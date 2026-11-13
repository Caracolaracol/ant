# Ant

App de escritorio para tomar notas en Markdown, simple y rápida. Inspirada en
[Left](https://github.com/hundredrabbits/Left).

Hecha con Tauri 2, React, TypeScript, Vite y CodeMirror 6.

## Desarrollo

```sh
pnpm install
pnpm tauri dev     # abre la app con recarga en caliente
pnpm tauri build   # genera el .app y el .dmg en src-tauri/target/release/bundle/
```

## Atajos

| Atajo | Acción |
|---|---|
| Cmd+N | Nueva nota |
| Cmd+O | Abrir nota |
| Cmd+S | Guardar |
| Cmd+Shift+S | Guardar como |
| Cmd+Shift+] / Cmd+Shift+[ | Nota siguiente / anterior |
| `Cmd+\` | Mostrar u ocultar la barra lateral |
| Cmd+F | Buscar y reemplazar |
| Cmd+Z / Cmd+Shift+Z | Deshacer / rehacer |
