// Writes the tracker's no-JavaScript version into index.html, between <!-- tracker:start --> and <!-- tracker:end -->,
// from the same appHtml() the page uses. Run after changing src/tracker/data.js or ui.js: node tools/render_tracker_static.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { appHtml } from '../src/tracker/ui.js';

const file = new URL('../index.html', import.meta.url);
const html = await readFile(file, 'utf8');
const a = '<!-- tracker:start -->'; const b = '<!-- tracker:end -->';
if (!html.includes(a) || !html.includes(b)) throw new Error('markers not found');
await writeFile(file, html.slice(0, html.indexOf(a) + a.length) + appHtml() + html.slice(html.indexOf(b)));
console.log('index.html updated');
