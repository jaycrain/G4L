// PICTURES OF BATCH 1, because a commit message full of measurements is not showing someone their product.
//
//   node --env-file-if-exists=.env.local --experimental-strip-types scripts/dev/button-shots.ts [baseUrl]
//
// Batch 1 (4b3895f) changed three things a person can only judge by LOOKING: what a button does on hover, what
// "selected" looks like, and what "disabled" looks like. I verified all three by querying the DOM and reported
// the numbers. Numbers are the wrong artifact for a cosmetic change — they prove the code shipped, not that it
// reads right, which puts the founder in the position of taking my word for it.
//
// So: element-level crops at 2x, each state beside its neighbour, on the real surfaces.
//
// Demo-only, same gate as smoke.ts: SMOKE_EMAIL + SMOKE_PASSWORD from the env, .test accounts only.

import { chromium, type Page, type Locator } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = (process.argv[2] ?? 'http://localhost:3100').replace(/\/$/, '');
const OUT = 'dist/button-shots';
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) { console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD.'); process.exit(2); }
if (!/\.test$/i.test(email)) { console.error(`Refusing: ${email} is not a demo (.test) account.`); process.exit(2); }

/** Crop a bit wider than the element so the button has some ground around it and reads as a button. */
async function crop(page: Page, el: Locator, name: string, pad = 14): Promise<boolean> {
  const box = await el.boundingBox().catch(() => null);
  if (!box) { console.log(`  ✗ ${name} — no box`); return false; }
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    clip: {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    },
  });
  console.log(`  ✓ ${name}`);
  return true;
}

/** The computed values that ARE the claim — so the picture and the number agree, side by side. */
async function readState(el: Locator): Promise<Record<string, string>> {
  return el.evaluate((n) => {
    const s = getComputedStyle(n as Element);
    return {
      background: s.backgroundColor,
      color: s.color,
      filter: s.filter,
      opacity: s.opacity,
      ariaPressed: (n as Element).getAttribute('aria-pressed') ?? '—',
    };
  });
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });

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
  const id = page.url().match(/[0-9a-f-]{36}/)?.[0] ?? '';
  console.log(`logged in — member ${id.slice(0, 8)}\n`);

  // Dev scaffolding and the ceremony overlay are not product; they either cover the surface or invite someone to
  // describe a broken app. Re-injected per navigation — addStyleTag is per-document.
  const clean = async () => {
    await page.addStyleTag({
      content: `nextjs-portal, #__next-dev-tools-indicator, [data-nextjs-toast] { display: none !important; }
                .cer-overlay { display: none !important; }`,
    }).catch(() => {});
  };

  const report: string[] = [];

  // ── 1 · HOVER ────────────────────────────────────────────────────────────────────────────────────────────
  // The claim: nine buttons that each hand-picked their own teal now inherit ONE darkening, and the text stays
  // readable through it. Two different buttons on two surfaces, each at rest and hovered.
  const HOVERS: [string, string, string][] = [
    [`/quality-day/${id}`, '.qd-el-btn', '1a-hover-qd'],
    [`/movement/${id}`, '.mv-log-btn', '1b-hover-movement'],
    [`/dashboard/${id}`, '.tri-hero-cta', '1c-hover-hero'],
  ];
  for (const [path, sel, name] of HOVERS) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }).catch(() => null);
    await page.waitForTimeout(900);
    await clean();
    const el = page.locator(sel).first();
    if (!(await el.isVisible().catch(() => false))) { console.log(`  – ${name} — ${sel} not on ${path}`); continue; }
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);
    await crop(page, el, `${name}-rest`);
    const rest = await readState(el);
    await el.hover();
    await page.waitForTimeout(250);
    await crop(page, el, `${name}-hover`);
    const hov = await readState(el);
    report.push(`${name}: rest filter=${rest.filter} bg=${rest.background} → hover filter=${hov.filter} bg=${hov.background}`);
  }

  // ── 2 · SELECTED + aria-pressed ──────────────────────────────────────────────────────────────────────────
  // The claim: one hook (.on), and the announced state comes from the same condition as the visible one. So the
  // picture has to be paired with the aria-pressed value or it only proves half of it.
  await page.goto(`${base}/quality-day/${id}`, { waitUntil: 'networkidle' }).catch(() => null);
  await page.waitForTimeout(900);
  await clean();
  const chip = page.locator('.qd-score-btn').first();
  if (await chip.isVisible().catch(() => false)) {
    const row = page.locator('.qd-score-btn').first().locator('xpath=..');
    await crop(page, row, '2a-selected-before', 10);
    report.push(`selected before: aria-pressed=${(await readState(chip)).ariaPressed}`);
    await chip.click();
    await page.waitForTimeout(600);
    await crop(page, row, '2b-selected-after', 10);
    const after = await readState(chip);
    report.push(`selected after: bg=${after.background} aria-pressed=${after.ariaPressed}`);
  } else {
    console.log('  – selected — no .qd-score-btn on the Quality Day surface');
  }

  // ── 3 · DISABLED ─────────────────────────────────────────────────────────────────────────────────────────
  // Four opacities collapsed to one. The honest note: at 0.5 vs 0.55 this is nearly invisible in a still — what
  // the shot can actually show is a disabled button beside an enabled one, which is the thing a member reads.
  const DISABLED: [string, string][] = [
    [`/movement/${id}`, '.mv-sync-btn'],
    [`/quality-day/${id}`, '.rhythm-confirm'],
    [`/dashboard/${id}`, '.db-keep'],
  ];
  for (const [path, sel] of DISABLED) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }).catch(() => null);
    await page.waitForTimeout(900);
    await clean();
    const el = page.locator(`${sel}:disabled`).first();
    if (!(await el.isVisible().catch(() => false))) continue;
    await el.scrollIntoViewIfNeeded().catch(() => {});
    if (await crop(page, el, '3a-disabled')) {
      report.push(`disabled ${sel}: opacity=${(await readState(el)).opacity}`);
      break;
    }
  }

  console.log('\n— computed state —');
  for (const line of report) console.log('  ' + line);
  await browser.close();
}

await main();
