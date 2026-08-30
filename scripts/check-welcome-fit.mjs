// DOES THE OPENING COPY STILL FIT ITS MEASURED BOX?
//
// The five opening screens share ONE fixed-height copy zone, so the button sits at the same y on every slide and
// tucks under the content instead of floating above the fold. That height is Donna's design ("sized to the tallest
// slide"; her ruling on the space it leaves under the short ones: "White space is ok") and it is a MEASURED
// NUMBER — which is exactly why the previous version of it was retired: "a number measured against particular
// content goes stale the moment the copy changes."
//
// It cannot go stale silently now. This renders all five slides at the worst width in each band and fails if any
// slide's content no longer fits. Jay's instruction, 2026-08-30: if we change the copy we remeasure — this is the
// thing that tells you that you have to.
//
// Run:  node scripts/check-welcome-fit.mjs [url]      (default: the local dev server on :3100)
// Exit 1 on any overflow, with the slide and the amount, so it can gate a release.

import { chromium } from 'playwright';

const URL = (process.argv[2] ?? 'http://localhost:3100') + '/onboarding';
// The worst width inside each band — where the column is narrowest and the copy wraps longest.
const BANDS = [
  { w: 375, h: 812, expect: 372 },
  { w: 481, h: 900, expect: 292 },
  { w: 575, h: 900, expect: 292 },   // last width inside the middle band
  { w: 576, h: 900, expect: 262 },   // first width where the copy stops wrapping longer
  { w: 600, h: 900, expect: 262 },   // Donna's own window
  { w: 1280, h: 800, expect: 262 },
];

const browser = await chromium.launch();
let failed = false;

for (const band of BANDS) {
  const page = await browser.newPage({ viewport: { width: band.w, height: band.h } });
  await page.goto(URL, { waitUntil: 'networkidle' });

  const rows = await page.evaluate(async () => {
    const vis = (s) => [...document.querySelectorAll(s)].filter((x) => x.offsetParent !== null);
    // The zone is a fixed height, so its content height has to be measured with the height released.
    const intrinsic = () => {
      const c = vis('.onbwel-copy')[0];
      if (!c) return null;
      const f = c.style.flex, h = c.style.height, o = c.style.overflow;
      c.style.flex = '0 0 auto'; c.style.height = 'auto'; c.style.overflow = 'visible';
      const v = Math.ceil(c.getBoundingClientRect().height);
      c.style.flex = f; c.style.height = h; c.style.overflow = o;
      return v;
    };
    const out = [];
    for (let i = 0; i < 6; i++) {
      const head = (vis('.onbwel-head')[0]?.innerText ?? '').replace(/\n/g, ' ').slice(0, 22);
      const content = intrinsic();
      if (content !== null) out.push({ head, content });
      const btns = vis('button.onbwel-cta');
      if (!btns.length) break;
      btns.forEach((b) => b.click());
      await new Promise((r) => setTimeout(r, 450));
    }
    return { rows: out, boxH: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--onbwel-copy-h'), 10) };
  });

  const tallest = rows.rows.reduce((a, b) => (b.content > a.content ? b : a), { content: 0, head: '—' });
  const fits = tallest.content <= rows.boxH;
  console.log(`${band.w}x${band.h}  box ${rows.boxH}px  tallest ${tallest.content}px ("${tallest.head}")  ${fits ? 'fits' : 'OVERFLOWS by ' + (tallest.content - rows.boxH) + 'px'}`);
  if (rows.boxH !== band.expect) {
    console.error(`  ! band expected --onbwel-copy-h: ${band.expect}px and got ${rows.boxH}px — a breakpoint moved.`);
    failed = true;
  }
  if (!fits) failed = true;
  await page.close();
}

await browser.close();
if (failed) {
  console.error('\nThe opening copy no longer fits its measured box. REMEASURE and update --onbwel-copy-h.');
  console.error('The numbers live in app/globals.css beside a comment explaining how they were taken.');
  process.exit(1);
}
console.log('\nAll five slides fit at every band.');
