// Datos compartidos del sitio (enlaces) y `ruta()`, que antepone la base `/ant/` de GitHub Pages
// a las rutas internas.

export const sitio = {
  nombre: 'Ant',
  repo: 'https://github.com/Caracolaracol/ant',
  left: 'https://github.com/hundredrabbits/Left',
  autor: 'Agustín Rojas',
  portafolio: 'https://agustinrojasm.vercel.app',
};

/** Ruta interna del sitio con la base de GitHub Pages delante. */
export function ruta(camino = '') {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${camino.replace(/^\//, '')}`;
}
