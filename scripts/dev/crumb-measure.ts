// DOES THE HERO BREADCRUMB STILL WRAP ON A PHONE? — a throwaway measurement for Donna's mobile 10→11px ask.
//
//   node --env-file-if-exists=.env.local --experimental-strip-types scripts/dev/crumb-measure.ts [baseUrl]
//
// WHY MEASURE INSTEAD OF JUST APPLYING IT. The 10px in globals.css is not a taste call — it is a FIX, dated
// 2026-07-28, for a crumb that wrapped to an orphan "of 3" beside the ring. Donna cannot see that from a
// screenshot and asked for 11px. Raising it blind either ignores a real constraint or preserves a dead one.
//
// The catch is that the constraint was written against content that no longer exists: it cites
// "Phase 4 · Reclaim · Session 3 of 3", and the hero has since become a breadcrumb ("Program › Reclaim › …").
// Shorter string, same box. So the honest question is not "who is right" but "is the 7/28 constraint still
// binding on today's content" — which is a measurement, and this is it.
//
// Reports the crumb's rendered height at both sizes. One line of Barlow at 10px boxes ~12px; a wrap roughly
// doubles it, so a height jump IS the wrap, with no eyeballing required.
//
// Demo-only, same gate as smoke.ts / bundle-screenshots.ts: SMOKE_EMAIL + SMOKE_PASSWORD from the env, .test
// accounts only, never inlined here.

import { chromium } from 'playwright';

const base = (process.argv[2] ?? 'http://localhost:3100').replace(/\/$/, '');
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) { console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD.'); process.exit(2); }
if (!/\.test$/i.test(email)) { console.error(`Refusing: ${email} is not a demo (.test) account.`); process.exit(2); }

/** The widths that actually matter: the media query fires at 1000px, and 375 is the narrowest phone we support. */
const WIDTHS = [375, 414, 768, 999];

async function main(): Promise<void> {
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
    .then(() => true)
    .catch(() => false);
  if (!landed) { console.error('login failed'); await browser.close(); process.exit(1); }

  console.log(`\nCRUMB WRAP CHECK — ${base}\n`);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 850 });
    await page.waitForTimeout(400);

    const row: string[] = [];
    const lines: number[] = [];
    for (const size of ['10px', '11px']) {
      const m = await page.evaluate((px) => {
        const el = document.querySelector('.tri-hero-crumb, .tri-hero-eyebrow') as HTMLElement | null;
        if (!el) return null;
        // Override at the ELEMENT level so it beats the media query's rule regardless of specificity, then put
        // it back — this only measures, it never leaves a style behind.
        const before = el.style.fontSize;
        el.style.setProperty('font-size', px, 'important');
        const h = el.getBoundingClientRect().height;
        // LINES, NOT A HEIGHT RATIO. The first version compared the 11px height against 1.5x the 10px height and
        // called anything under that "still one line". On a phone this crumb ALREADY wraps to three lines at
        // 10px, so both heights were large, the ratio stayed near 1.0, and the probe cheerfully reported "one
        // line" about a three-line element. Ask the element how tall one line is and divide.
        const lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.2;
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        el.style.fontSize = before;
        return { h: Math.round(h * 10) / 10, lines: Math.max(1, Math.round(h / lh)), text };
      }, size);
      if (!m) { console.log(`  ${width}px — no .tri-hero-crumb on this surface`); row.length = 0; break; }
      row.push(`${size} → ${String(m.lines)} line${m.lines === 1 ? ' ' : 's'} (${m.h}px)${row.length === 0 ? `   "${m.text}"` : ''}`);
      lines.push(m.lines);
    }
    if (row.length === 2) {
      // The only question that matters: does 11px cost a line that 10px did not?
      const worse = lines[1]! > lines[0]!;
      console.log(`  ${String(width).padStart(4)}px   ${row[0]}`);
      console.log(`           ${row[1]}   ${worse ? '✗ 11px ADDS a line' : 'no new wrap at 11px'}`);
    }
  }

  await browser.close();
}

await main();
