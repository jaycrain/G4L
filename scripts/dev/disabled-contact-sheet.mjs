// THE THIRD BATCH-1 ITEM, PHOTOGRAPHED — four disabled opacities collapsed to one.
//
//   node scripts/dev/disabled-contact-sheet.mjs <cssUrl>
//
// SYNTHESISED, AND SAYING SO. The other two items were shot on the real app; this one could not be, because
// reaching a genuinely disabled button needs a member in a specific state (mid-submit, nothing typed, a week
// already logged) and the demo account was in none of them. Rather than report "no picture available" a third
// time, each button is rendered here from the LIVE stylesheet and disabled directly.
//
// What that costs: this proves the VALUE and the rendered result, not that a given button ever reaches the state
// on a real surface. The rest column is the same button enabled, so the pair shows what a member would compare.
//
// The BEFORE column applies each class's historical opacity inline — recovered from the batch-1 diff (4b3895f),
// not from memory.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const CSS_URL = process.argv[2];
if (!CSS_URL) { console.error('Pass the stylesheet URL.'); process.exit(2); }
const OUT = 'dist/button-shots';

/** [label, class, the opacity it used BEFORE batch 1, an ancestor class the rule is scoped to].
 *
 *  THE ANCESTOR IS NOT OPTIONAL DRESSING. `.db-keep:disabled` is written as `.daily-beat-panel .db-keep:disabled`,
 *  so a bare button rendered on its own does not match it and reports opacity 1 — which the instrument check
 *  caught and which I would otherwise have read as a real bug in the product. Any button whose rule is scoped
 *  needs its scope reproduced here or this sheet lies about it. */
const BUTTONS = [
  ['Connect CTA', 'connect-cta', 0.45],
  ['Pill button', 'btn-pill', 0.45],
  ['Momentum · commit', 'momentum-log-commit', 0.45],
  ['Keeper · keep it', 'keeper-offer-btn', 0.55],
  ['Keeper · no thanks', 'keeper-offer-skip', 0.55],
  ['Ceremony', 'cer-btn', 0.6],
  ['Daily Beat · keep', 'db-keep', 0.6, 'daily-beat-panel'],
  ['Movement · Log it', 'mv-log-btn', 0.6],
  ['Movement · Sync', 'mv-sync-btn', 0.6],
  ['Rhythm · confirm', 'rhythm-confirm', 0.6],
  ['Cadence', 'rr-cadence-btn', 0.6],
];

const css = await (await fetch(CSS_URL)).text();
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
await mkdir(OUT, { recursive: true });

const wrap = (anc, html) => (anc ? `<div class="${anc}">${html}</div>` : html);
const rows = BUTTONS.map(([label, cls, was, anc]) => `
  <div class="row">
    <div class="lbl"><b>${label}</b><span>was ${was} → now 0.5</span></div>
    <div class="cell">${wrap(anc, `<button class="${cls}">${label}</button>`)}</div>
    <div class="cell">${wrap(anc, `<button class="${cls}" disabled style="opacity:${was} !important">${label}</button>`)}</div>
    <div class="cell">${wrap(anc, `<button class="${cls}" disabled>${label}</button>`)}</div>
  </div>`).join('');

await page.setContent(`<style>${css}
  body { margin:0; background:#fff; font-family: system-ui, sans-serif; }
  .sheet { padding: 18px 22px; }
  .head, .row { display:grid; grid-template-columns: 200px 1fr 1fr 1fr; gap:14px; align-items:center; }
  .head { padding:0 0 10px; font:700 11px/1.2 system-ui; letter-spacing:.08em; text-transform:uppercase; color:#6B7680; }
  .row { padding:9px 0; border-top:1px solid #E8E6E6; }
  .lbl { font:600 12.5px/1.3 system-ui; color:#2A2A2A; }
  .lbl span { display:block; font-weight:400; font-size:10.5px; color:#8a8f96; }
  .cell { display:flex; }
</style>
<div class="sheet">
  <div class="head"><div></div><div>enabled</div><div>disabled — before</div><div>disabled — after</div></div>
  ${rows}
</div>`);

// PROVE THE INSTRUMENT: the after column must actually be 0.5 everywhere, and the before column must NOT be —
// otherwise the sheet is three identical columns and proves nothing. Same guard as the hover sheet, which caught
// a completely inert version of that one.
const check = await page.evaluate(() => {
  const after = [...document.querySelectorAll(".cell:nth-child(4) button")].map((n) => getComputedStyle(n).opacity);
  const before = [...document.querySelectorAll(".cell:nth-child(3) button")].map((n) => getComputedStyle(n).opacity);
  return { after: [...new Set(after)], before: [...new Set(before)] };
});
if (check.after.length !== 1 || check.after[0] !== '0.5') {
  throw new Error(`the "after" column is not a single 0.5 — got ${check.after.join(', ')}`);
}
if (check.before.length < 2) {
  throw new Error(`the "before" column should show several values — got ${check.before.join(', ')}`);
}
console.log(`  before: ${check.before.sort().join(' · ')}   after: ${check.after.join('')}`);

await page.screenshot({ path: `${OUT}/disabled-before-after.png`, fullPage: true });
console.log('  ✓ disabled-before-after.png');
await b.close();
