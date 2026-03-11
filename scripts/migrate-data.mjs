/**
 * One-time migration script: converts old CRA project's JS data files to JSON.
 * Run from the bamble-app-v2 root:
 *   node scripts/migrate-data.mjs
 */
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NEW_ROOT = resolve(__dirname, '..');
const OLD_SRC = resolve(__dirname, '../../bamble-app/src');
const OLD_PUBLIC = resolve(__dirname, '../../bamble-app/public');
const DATA_OUT = join(NEW_ROOT, 'public/data');
const ICONS_OUT = join(NEW_ROOT, 'public/icons');

mkdirSync(DATA_OUT, { recursive: true });
mkdirSync(ICONS_OUT, { recursive: true });

console.log('Importing old data files...');

const toUrl = (p) => pathToFileURL(p).href;

const [grunnkretser, data2017, skoler, barnehager] = await Promise.all([
  import(toUrl(join(OLD_SRC, 'grunnkretser.js'))).then(m => m.default),
  import(toUrl(join(OLD_SRC, 'data2017.js'))).then(m => m.default),
  import(toUrl(join(OLD_SRC, 'skoler.js'))).then(m => m.default),
  import(toUrl(join(OLD_SRC, 'barnehager.js'))).then(m => m.default),
]);

writeFileSync(join(DATA_OUT, 'grunnkretser.geojson'), JSON.stringify(grunnkretser));
console.log('✓ grunnkretser.geojson');

writeFileSync(join(DATA_OUT, 'population-2017.json'), JSON.stringify(data2017));
console.log('✓ population-2017.json');

writeFileSync(join(DATA_OUT, 'skoler.geojson'), JSON.stringify(skoler));
console.log('✓ skoler.geojson');

writeFileSync(join(DATA_OUT, 'barnehager.geojson'), JSON.stringify(barnehager));
console.log('✓ barnehager.geojson');

// Copy icons
for (const icon of ['school-bag.png', 'playground.png']) {
  const src = join(OLD_PUBLIC, 'icons', icon);
  if (existsSync(src)) {
    copyFileSync(src, join(ICONS_OUT, icon));
    console.log(`✓ icons/${icon}`);
  }
}

console.log('\nData migration complete!');
