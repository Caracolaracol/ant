// Configuración de Astro para el sitio de Ant, publicado en GitHub Pages en
// https://caracolaracol.github.io/ant/ (por eso `base` es `/ant`). Inglés en la raíz y
// español bajo /es/.
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://caracolaracol.github.io',
  base: '/ant',
  trailingSlash: 'always',
  output: 'static',
  // La documentación en español estuvo un tiempo en /documentacion/; ahora vive en /es/.
  redirects: { '/documentacion': '/ant/es/documentacion/' },
});
