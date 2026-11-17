// Datos compartidos del sitio (enlaces), los idiomas y las rutas de cada página en cada idioma.
// El sitio está en inglés por defecto (`/ant/`) y en español bajo `/ant/es/`.

export const sitio = {
  nombre: 'Ant',
  repo: 'https://github.com/Caracolaracol/ant',
  licencia: 'https://github.com/Caracolaracol/ant/blob/main/LICENSE',
  left: 'https://github.com/hundredrabbits/Left',
  hundredRabbits: 'https://100r.co',
  autor: 'Agustín Rojas',
  portafolio: 'https://agustinrojasm.vercel.app',
};

export type Idioma = 'en' | 'es';
export type Seccion = 'inicio' | 'docs';

/** Ruta interna del sitio con la base de GitHub Pages delante. */
export function ruta(camino = '') {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${camino.replace(/^\//, '')}`;
}

/** Ruta de una sección en un idioma (la portada o la documentación). */
export function rutaDe(idioma: Idioma, seccion: Seccion = 'inicio') {
  const rutas = {
    en: { inicio: '', docs: 'documentation/' },
    es: { inicio: 'es/', docs: 'es/documentacion/' },
  };
  return ruta(rutas[idioma][seccion]);
}

/** Devuelve el texto en el idioma pedido: `t('Hello', 'Hola')`. */
export const traductor = (idioma: Idioma) => (en: string, es: string) => (idioma === 'es' ? es : en);
