// OPTICAL ALIGNMENT, AS A CHECK THAT CAN FAIL.
//
// Jay, 2026-08-11: "Vertical centering got worse, I think." He was right, and nothing in the codebase could have
// told him — the row is `align-items: center`, every box was centred to the pixel, and the CSS looked correct.
// Flexbox centres BOXES; the eye centres INK. A ▾ and a ↗ carry their ink in different places within their em box
// than Barlow's letterforms do, so three perfectly-centred boxes still read as three things at three heights.
//
// So this measures PAINTED PIXELS, not layout: it renders the header at 8x, finds the first and last inked row
// inside each element's x-band, and compares the centres. That is the only measurement that corresponds to what a
// member actually sees. Layout assertions here would pass while the row looked wrong — the exact failure this
// replaces.
//
//   SMOKE_EMAIL=… SMOKE_PASSWORD=… node --experimental-strip-types scripts/head-ink-walk.ts [baseUrl]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:3100';
const email = process.env.SMOKE_EMAIL, password = process.env.SMOKE_PASSWORD;
if (!email || !password) { console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD.'); process.exit(2); }

// How far the glyph ink centres may sit from the labels' ink centre before it reads as misaligned. The bug Jay
// caught measured 1.19px, and the fix brought it to 0.19px — so half a pixel separates "fine" from "he noticed".
const TOLERANCE_PX = 0.5;
const SCALE = 8;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: SCALE });
await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
// Hydration guard — filling a form React hasn't claimed submits nothing (same guard smoke.ts uses).
await page.waitForFunction(() => {
  const el = document.querySelector('#email');
  return el && Object.keys(el).some((k) => k.startsWith('__reactProps'));
});
await page.fill('#email', email); await page.fill('#password', password);
await page.click('button[type=submit]');
await page.waitForFunction(() => location.pathname.startsWith('/dashboard'), null, { timeout: 20000 });
const memberId = new URL(page.url()).pathname.split('/')[2];

await page.goto(`${base}/workspace/${memberId}/reconnect`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ws-col-head .ws-why-row');
await page.waitForTimeout(400);

// x-bands per element, relative to the row, so each can be measured without its neighbours bleeding in.
const bands = await page.evaluate(() => {
  const row = document.querySelector('.ws-col-head .ws-why-row')!.getBoundingClientRect();
  const rel = (el: Element | null) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x0: r.left - row.left, x1: r.right - row.left };
  };
  // The label text isolated from its glyph sibling — otherwise the glyph's ink is what we'd be measuring against.
  const textBand = (el: Element) => {
    const rg = document.createRange(); rg.selectNode(el.childNodes[0]);
    const r = rg.getBoundingClientRect();
    return { x0: r.left - row.left, x1: r.right - row.left };
  };
  const why = document.querySelector('.ws-col-head .ws-why-toggle')!;
  const exp = document.querySelector('.ws-col-head .ws-explore-open');
  return {
    whyLabel: textBand(why),
    caret: rel(document.querySelector('.ws-col-head .ws-why-caret')),
    expLabel: exp ? textBand(exp) : null,
    arrow: exp ? rel(exp.querySelector('span')) : null,
  };
});

const buf = await page.locator('.ws-col-head .ws-why-row').screenshot();

// Decode with the BROWSER's PNG decoder rather than adding an image library to the project for one script: hand the
// shot back in as a data URL, draw it to a canvas, read the pixels. The page is already open; this costs nothing.
const centre = await page.evaluate(async ({ dataUrl, bands, SCALE }) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
  /** First and last inked scanline within an x-band, in CSS px. Ink = visible and not near-white. */
  const inkCentre = (band: { x0: number; x1: number } | null) => {
    if (!band) return null;
    let lo: number | null = null, hi = 0;
    for (let y = 0; y < height; y++) {
      for (let x = Math.floor(band.x0 * SCALE); x < Math.min(Math.floor(band.x1 * SCALE), width); x++) {
        const i = (width * y + x) << 2;
        if (data[i + 3] > 40 && (data[i] < 220 || data[i + 1] < 220 || data[i + 2] < 220)) {
          if (lo === null) lo = y;
          hi = y; break;
        }
      }
    }
    return lo === null ? null : (lo + hi) / 2 / SCALE;
  };
  return {
    whyLabel: inkCentre(bands.whyLabel), caret: inkCentre(bands.caret),
    expLabel: inkCentre(bands.expLabel), arrow: inkCentre(bands.arrow),
  };
}, { dataUrl: `data:image/png;base64,${buf.toString('base64')}`, bands, SCALE });

await browser.close();

// If the header didn't render its parts, that is a failure too — a silent absence would otherwise pass by
// having nothing to disagree with.
const missing = Object.entries(centre).filter(([, v]) => v === null).map(([k]) => k);
if (missing.length) { console.error(`✖  header parts never rendered: ${missing.join(', ')}`); process.exit(1); }

const labels = [centre.whyLabel!, centre.expLabel!];
const target = labels.reduce((a, b) => a + b, 0) / labels.length;
let worst = 0;
console.log(`Header glyph alignment — ink centres vs the labels' ${target.toFixed(2)}px`);
for (const [name, v] of Object.entries(centre)) {
  const off = v! - target;
  worst = Math.max(worst, Math.abs(off));
  console.log(`  ${name.padEnd(10)} ${v!.toFixed(2)}  ${off >= 0 ? '+' : ''}${off.toFixed(2)}px`);
}
if (worst > TOLERANCE_PX) {
  console.error(`\n✖  worst offset ${worst.toFixed(2)}px exceeds ${TOLERANCE_PX}px — the row will read as misaligned.`);
  process.exit(1);
}
console.log(`\n✓  worst offset ${worst.toFixed(2)}px, within ${TOLERANCE_PX}px.`);
