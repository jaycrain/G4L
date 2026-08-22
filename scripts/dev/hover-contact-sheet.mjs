// A CONTACT SHEET OF THE HOVER BUG — every affected button, at rest and under the cursor.
//
//   node scripts/dev/hover-contact-sheet.mjs [cssUrl]
//
// Built from the LIVE stylesheet fetched off production, rendered on a synthetic page so every button can be put
// in the same picture. The hover is a REAL pointer hover, not a simulated class — the whole point is what the
// browser actually computes.
//
// TWO GROUNDS, on purpose. These buttons do not all sit on the same background, and guessing an element's ground
// is how a contrast fix gets made in the wrong direction. So each is shown on white and on the hero navy, and the
// reader can see which case applies rather than take my word for the ground.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const CSS_URL = process.argv[2]
  ?? 'https://g4l-ten.vercel.app/_next/static/css/3774d8013d40300d.css';
const OUT = 'dist/button-shots';

/** label → the class under test. The fourteen that go fully transparent, then three controls that hold.
 *
 *  THE CONTROLS EARNED THEIR PLACE. An earlier pass had .hero-talk and .onbwel-cta in this section, on a probe
 *  that read background-color immediately after hover(). Both transition their background, so the reading caught
 *  them mid-fade at alpha ~0.03 and scored them as unaffected. They are in the broken list now, where they
 *  belong. Anything asserting "this one is fine" has to be measured after the transition, not during it. */
const BUTTONS = [
  ['Reclaim List · Done', 'rlb-done', 'onboarding'],
  ['Identity · coin your own', 'idp-coin-btn', 'onboarding'],
  ['Welcome CTA', 'onbwel-cta', 'onboarding'],
  ['Welcome CTA (desktop)', 'onbwel-d-cta', 'onboarding'],
  ['Talk', 'hero-talk', 'dashboard'],
  ['Ceremony', 'cer-btn', 'ceremony'],
  ['Checkpoint · declare', 'ckpt-declare', 'rewire'],
  ['Rhythm · confirm', 'rhythm-confirm', 'rebuild'],
  ['Movement · Log it', 'mv-log-btn', 'movement'],
  ['Momentum · commit', 'momentum-log-commit', 'momentum'],
  ['Teaching · CTA', 'teach-cta', 'session'],
  ['Pill button', 'btn-pill', 'various'],
  ['Companion rail · send', 'rrail-send', 'rail'],
  ['Founder Console · send', 'fc-send', 'admin'],
  ['— Sync (holds)', 'mv-sync-btn', 'movement'],
  ['— Add (holds)', 'rlb-addbtn', 'onboarding'],
  ['— Keeper (tints, by design)', 'keeper-offer-btn', 'session'],
];

const GROUNDS = [['white', '#ffffff'], ['navy', '#374F63']];

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
const css = await (await fetch(CSS_URL)).text();
await mkdir(OUT, { recursive: true });

// Render every button twice per ground — the left copy stays at rest, the right copy gets hovered — so a single
// screenshot per ground holds both states for all of them and nothing has to be stitched afterwards.
const rows = BUTTONS.map(([label, cls, where]) => `
  <div class="row">
    <div class="lbl"><b>${label}</b><span>${where}</span></div>
    <div class="cell"><button class="${cls}" data-k="${cls}-rest">${label.replace(/^— /, '')}</button></div>
    <div class="cell"><button class="${cls}" data-k="${cls}-hov">${label.replace(/^— /, '')}</button></div>
  </div>`).join('');

for (const [name, bg] of GROUNDS) {
  await page.setContent(`<style>${css}
    body { margin:0; font-family: system-ui, sans-serif; background:${bg}; }
    .sheet { padding: 18px 22px; }
    .head { display:grid; grid-template-columns: 230px 1fr 1fr; gap:14px; padding:0 0 10px;
            font:700 12px/1.2 system-ui; letter-spacing:.08em; text-transform:uppercase;
            color:${name === 'navy' ? 'rgba(255,255,255,.75)' : '#6B7680'}; }
    .row { display:grid; grid-template-columns: 230px 1fr 1fr; gap:14px; align-items:center;
           padding:9px 0; border-top:1px solid ${name === 'navy' ? 'rgba(255,255,255,.14)' : '#E8E6E6'}; }
    .lbl { font:600 13px/1.3 system-ui; color:${name === 'navy' ? '#fff' : '#2A2A2A'}; }
    .lbl span { display:block; font-weight:400; font-size:11px; opacity:.6; }
    .cell { display:flex; }
  </style>
  <div class="sheet">
    <div class="head"><div></div><div>at rest</div><div>hovered</div></div>
    ${rows}
  </div>`);

  // FORCE :hover THROUGH CDP, not through synthetic events. My first pass dispatched pointerover/mouseover to
  // each right-hand copy and produced a sheet whose "hovered" column was pixel-identical to "at rest" — because
  // `:hover` is driven by the browser's real pointer position and is completely untouched by dispatched
  // MouseEvents. It looked like a clean bill of health and was actually a broken instrument.
  // CSS.forcePseudoState is what DevTools' own :hov toggle uses, and it holds on every element at once, which a
  // real pointer cannot.
  const client = await page.context().newCDPSession(page);
  await client.send('DOM.enable');
  await client.send('CSS.enable');
  const { root } = await client.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await client.send('DOM.querySelectorAll', {
    nodeId: root.nodeId,
    selector: '[data-k$="-hov"]',
  });
  for (const nodeId of nodeIds) {
    await client.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
  }
  // LET THE TRANSITIONS FINISH. Several of these animate background-color, and a screenshot taken at 200ms
  // catches them part-way — which is exactly how two broken buttons got recorded as healthy.
  await page.waitForTimeout(1200);

  // PROVE THE INSTRUMENT BEFORE TRUSTING THE PICTURE. If forcing worked, the hovered copies differ from the
  // resting ones; if it silently did nothing again, this says so instead of shipping another clean-looking sheet.
  const changed = await page.evaluate(() => {
    let n = 0;
    for (const hov of document.querySelectorAll('[data-k$="-hov"]')) {
      const rest = document.querySelector(`[data-k="${hov.dataset.k.replace(/-hov$/, '-rest')}"]`);
      if (rest && getComputedStyle(rest).backgroundColor !== getComputedStyle(hov).backgroundColor) n++;
    }
    return n;
  });
  if (changed === 0) throw new Error('force-hover did nothing — the sheet would be meaningless');
  console.log(`    (${changed} of ${BUTTONS.length} differ under forced hover)`);
  await page.screenshot({ path: `${OUT}/sheet-${name}.png`, fullPage: true });
  console.log(`  ✓ sheet-${name}.png`);
}

await b.close();
