// Copia el icono de la app (`marca/ant-icono.svg`, la fuente única) a `public/` antes de
// `dev` y `build`, para que el sitio siempre use el mismo icono que la app.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(aqui, '..', 'public'), { recursive: true });
copyFileSync(join(aqui, '..', '..', 'marca', 'ant-icono.svg'), join(aqui, '..', 'public', 'ant-icono.svg'));
