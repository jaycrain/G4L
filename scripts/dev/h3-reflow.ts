// WHAT DOES DECLARING h3 ACTUALLY MOVE? — measured on the running app, not reasoned from the stylesheet.
//
//   node --env-file-if-exists=.env.local --experimental-strip-types scripts/dev/h3-reflow.ts [baseUrl]
//
// 70 of 77 <h3> in app/ are bare, so `h3 { font-size: 20px }` moves every one of them. "A couple of dense panels
// will reflow slightly" was my guess; this replaces the guess.
//
// For each member surface, at desktop and phone width: measure every bare h3's rendered size before and after,
// and measure the page height. Then flag the two things that actually hurt —
//   · a heading that OVERFLOWS its box (the container clips or was sized for one line)
//   · a heading that now WRAPS to a second line where it did not before
// — because those are visible defects, where "the page got 40px taller" is not.
//
// Demo-only, same gate as smoke.ts: SMOKE_EMAIL + SMOKE_PASSWORD, .test accounts only.

import { chromium, type Page } from 'playwright';

const base = (process.argv[2] ?? 'https://g4l-ten.vercel.app').replace(/\/$/, '');
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) { console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD.'); process.exit(2); }
if (!/\.test$/i.test(email)) { console.error(`Refusing: ${email} is not a demo (.test) account.`); process.exit(2); }

const SURFACES = ['/dashboard/:id', '/account', '/journey/:id', '/connect/:id', '/score/:id', '/grinta/:id', '/momentum/:id', '/movement/:id'];
const WIDTHS: [string, number][] = [['desktop', 1440], ['phone', 390]];

/** Read every bare h3 — size, box height, whether its text overflows, and how many lines it occupies. */
async function probe(page: Page) {
  return page.evaluate(() => {
    const out: { text: string; px: number; lines: number; overflows: boolean }[] = [];
    for (const el of Array.from(document.querySelectorAll('h3'))) {
      if (el.className) continue; // classed h3s are unaffected by a bare-tag rule
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      const r = el.getBoundingClientRect();
      const parent = el.parentElement;
      const pr = parent?.getBoundingClientRect();
      out.push({
        text: (el.textContent ?? '').trim().slice(0, 34),
        px: parseFloat(cs.fontSize),
        lines: Math.max(1, Math.round(r.height / lh)),
        // Does the heading now stick out of whatever contains it?
        overflows: !!pr && (r.right > pr.right + 1 || r.bottom > pr.bottom + 1),
      });
    }
    return { heads: out, pageHeight: document.body.scrollHeight };
  });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => {
    const el = document.querySelector('button[type="submit"]');
    return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$'));
  },
  null,
  { timeout: 15000 },
);
await page.fill('#email', email!);
await page.fill('#password', password!);
await page.click('button[type="submit"]');
const landed = await page
  .waitForFunction(() => location.pathname.startsWith('/dashboard/'), null, { timeout: 20000 })
  .then(() => true).catch(() => false);
if (!landed) { console.error('login failed'); await browser.close(); process.exit(1); }
const id = page.url().match(/[0-9a-f-]{36}/)?.[0] ?? '';

const problems: string[] = [];
let moved = 0, unchanged = 0;

for (const [wname, width] of WIDTHS) {
  console.log(`\n═══ ${wname} (${width}px) ═══`);
  await page.setViewportSize({ width, height: 900 });

  for (const s of SURFACES) {
    const path = s.replace(':id', id);
    const res = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }).catch(() => null);
    if (!res || res.status() >= 400) { console.log(`  – ${path} — unreachable`); continue; }
    await page.waitForTimeout(700);
    await page.addStyleTag({ content: '.cer-overlay{display:none!important}' }).catch(() => {});

    const before = await probe(page);
    if (!before.heads.length) { console.log(`  · ${path} — no bare h3`); continue; }

    // THE PROPOSED RULE, injected exactly as it would ship.
    await page.addStyleTag({ content: 'h3 { font-size: 20px; }' });
    await page.waitForTimeout(250);
    const after = await probe(page);

    const grew = after.heads.filter((h, i) => before.heads[i] && h.px !== before.heads[i]!.px).length;
    const nowWraps = after.heads.filter((h, i) => before.heads[i] && h.lines > before.heads[i]!.lines);
    const nowOverflows = after.heads.filter((h, i) => h.overflows && !before.heads[i]?.overflows);
    moved += grew;
    unchanged += after.heads.length - grew;

    const dH = after.pageHeight - before.pageHeight;
    console.log(`  ${path.replace(id, ':id').padEnd(20)} ${String(after.heads.length).padStart(2)} bare h3 · ${String(grew).padStart(2)} resized · page ${dH >= 0 ? '+' : ''}${dH}px`);
    for (const h of nowWraps) { console.log(`      ⚠ now wraps: "${h.text}"`); problems.push(`${wname} ${path.replace(id, ':id')} — "${h.text}" wraps to ${h.lines} lines`); }
    for (const h of nowOverflows) { console.log(`      ✗ OVERFLOWS its container: "${h.text}"`); problems.push(`${wname} ${path.replace(id, ':id')} — "${h.text}" overflows`); }
  }
}

console.log(`\n${moved} headings resize · ${unchanged} unaffected`);
console.log(problems.length ? `\n${problems.length} to look at:\n  ` + problems.join('\n  ') : '\nNo heading wrapped or overflowed at either width.');
await browser.close();
