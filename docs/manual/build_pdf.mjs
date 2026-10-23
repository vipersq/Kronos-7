// Składa docs/KRONOS-7-Instrukcja.pdf z docs/manual/instrukcja.html (Chromium przez Playwright).
// Użycie: node docs/manual/build_pdf.mjs   (wymaga: npm i -g playwright  albo  npx playwright)
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(dir, '..', 'KRONOS-7-Instrukcja.pdf');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://' + path.join(dir, 'instrukcja.html'), { waitUntil: 'load' });
await p.pdf({
  path: out, format: 'A4', printBackground: true, preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: '<div style="width:100%;font-size:7.5pt;color:#7a877f;font-family:Inter,sans-serif;padding:0 16mm;display:flex;justify-content:space-between"><span>KRONOS-7 · instrukcja obsługi · v3.21</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
});
await b.close();
console.log('OK', out);
