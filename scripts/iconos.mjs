/* Regenera la lista de iconos que cada app le pide a Google Fonts.
 *
 *   node scripts/iconos.mjs
 *
 * Por qué existe: la fuente completa de Material Symbols pesa 372 KB y
 * cada app usa unos ochenta iconos. Pidiéndolos por nombre, Google
 * devuelve una fuente recortada de 9 a 15 KB. En un celular con datos
 * lentos en Buenaventura, esa diferencia es que la app abra o no.
 *
 * El riesgo de recortar es que un icono que quedó fuera se ve como una
 * caja vacía — o peor, como su nombre en texto crudo encima de otra
 * cosa (pasó con el reloj falso del marco de teléfono: los iconos de
 * señal/wifi/batería van como texto plano entre etiquetas, no entre
 * comillas, y la primera versión de este script solo miraba cadenas
 * con comillas). Por eso ahora se recoge CUALQUIER palabra del código
 * con forma de nombre de icono — entre comillas o no — y se cruza con
 * la lista oficial de Google. Sobran muchas (nombres de variables,
 * palabras sueltas), y está bien: cada icono de más cuesta unos cien
 * bytes, y un nombre de icono roto en pantalla cuesta la cara de la
 * app.
 *
 * Hay que volver a correrlo cuando se agreguen iconos nuevos.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const APPS = ['cliente-app', 'repartidor-app', 'admin-app'];

/* La lista oficial de nombres vive en el repositorio y no se descarga:
   así el script corre sin red y da el mismo resultado siempre. Para
   actualizarla cuando Google publique iconos nuevos:

     curl -sL "https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsRounded%5BFILL,GRAD,opsz,wght%5D.codepoints"        | awk '{print $1}' | sort -u > scripts/material-symbols.txt
*/
const LISTA_OFICIAL = join(RAIZ, 'scripts', 'material-symbols.txt');

function archivosJs(dir, acc = []) {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) archivosJs(ruta, acc);
    else if (ruta.endsWith('.js')) acc.push(ruta);
  }
  return acc;
}

const oficiales = new Set(
  readFileSync(LISTA_OFICIAL, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean),
);

for (const app of APPS) {
  const candidatas = new Set();
  for (const archivo of archivosJs(join(RAIZ, app, 'src'))) {
    const texto = readFileSync(archivo, 'utf8');
    for (const m of texto.matchAll(/[a-z][a-z0-9_]{2,}/g)) candidatas.add(m[0]);
  }

  const iconos = [...candidatas].filter((c) => oficiales.has(c)).sort();
  const destino = join(RAIZ, app, 'src', 'lib', 'iconos.js');

  writeFileSync(destino, `/* Generado por scripts/iconos.mjs — no editar a mano.
   Los iconos que esta app realmente usa, para pedirle a Google Fonts
   una fuente recortada en vez de los 372 KB completos. */

export const ICONOS = '${iconos.join(',')}';
`, 'utf8');

  console.log(`${app}: ${iconos.length} iconos`);
}
