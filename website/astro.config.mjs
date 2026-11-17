// Configuración de Astro para el sitio de Ant, publicado en GitHub Pages en
// https://caracolaracol.github.io/ant/ (por eso `base` es `/ant`).
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://caracolaracol.github.io',
  base: '/ant',
  trailingSlash: 'always',
  output: 'static',
});
