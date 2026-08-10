// Screenshots for the Cowork release bundle (part 4 of the Standing Sync Protocol).
//
//   node --experimental-strip-types scripts/bundle-screenshots.ts [baseUrl]
//
// Marketing and the book describe what a member SEES, so a stale screenshot of a surface that has since been
// rebuilt is worse than no screenshot — it is a confident picture of a product that no longer exists. Regenerate
// these at every version bump alongside the transcript, not selectively.
//
// Demo-only, same gate as smoke.ts: SMOKE_EMAIL / SMOKE_PASSWORD, .test accounts only. The login sequence
// (hydration wait, then watch location.pathname rather than a navigation) is borrowed from smoke.ts — an
// un-hydrated submit click silently does nothing, and login lands via a client-side router.push.

import { chromium, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = (process.argv[2] ?? 'http://localhost:3100').replace(/\/$/, '');
const OUT = 'dist/cowork-bundle/screenshots';
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) { console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD.'); process.exit(2); }
if (!/\.test$/i.test(email)) { console.error(`Refusing: ${email} is not a demo (.test) account.`); process.exit(2); }

/** Signed-out surfaces (path, filename). */
const PUBLIC_SHOTS: [string, string][] = [
  ['/', '01-front-door'],
  ['/login', '02-login'],
];
/** Member surfaces — `:id` is replaced with the signed-in member's id. */
const MEMBER_SHOTS: [string, string][] = [
  ['/dashboard/:id', '03-dashboard'],
  ['/program/:id', '04-program'],
  ['/playbook/:id', '05-playbook'],
  ['/reclaim-list/:id', '06-reclaim-list'],
  ['/momentum/:id', '07-momentum'],
  ['/quality-day/:id', '08-quality-days'],
  ['/badges/:id', '09-badges'],
  ['/connect/:id', '10-community'],
  ['/movement/:id', '11-movement'],
];

const failures: string[] = [];

async function shoot(page: Page, path: string, name: string): Promise<void> {
  // A FAILED navigation returns null, whose status is undefined — so a `status >= 400` guard alone skips right
  // past it and screenshots the browser's own error page, reported as a success. That is how a bundle ends up
  // shipping a picture of ERR_CONNECTION_REFUSED to marketing. Treat "no response" as the failure it is.
  const res = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }).catch(() => null);
  if (!res) { failures.push(`${name} — no response from ${path} (is the dev server up?)`); console.log(`  ✗ ${name} — no response`); return; }
  const status = res.status();
  if (status >= 400) { failures.push(`${name} — HTTP ${status}`); console.log(`  ✗ ${name} — HTTP ${status} at ${path}`); return; }
  // Let async panels settle; several surfaces stream their content in after first paint.
  await page.waitForTimeout(1200);
  // PRESENTATION ONLY — never changes what the product does, only what the picture shows:
  //  · Next's dev-tools badge is scaffolding, not product. Shipping a red "1 Issue" chip to marketing invites
  //    them to describe a broken app (and it is dev-only — a member never sees it).
  //  · the confidential footer is position:fixed, and a fullPage capture paints fixed elements at their VIEWPORT
  //    position — so it lands in the middle of a long page, on top of real content. Making it static for the
  //    shot puts it where a member actually sees it: the bottom.
  await page.addStyleTag({
    content: `
      nextjs-portal, #__next-dev-tools-indicator, [data-nextjs-toast] { display: none !important; }
      .confidential-footer { position: static !important; }
      /* The ceremony threshold beat (app/dashboard/ceremony-surface.tsx) covers the dashboard for a member who is
         mid-ceremony, and re-arms on every navigation. It is captured on its own as 03a; here we want the surface
         underneath. This MUST be injected per page — addStyleTag applies to the current document only, and an
         earlier version injected it once after login, where the very next navigation threw it away. */
      .cer-overlay { display: none !important; }
    `,
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, quality: 82, type: 'jpeg', fullPage: true });
  console.log(`  ✓ ${name}`);
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  console.log(`BUNDLE SCREENSHOTS — ${base} → ${OUT}`);
  for (const [path, name] of PUBLIC_SHOTS) await shoot(page, path, name);

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
  if (!landed) { console.error('  ✗ login failed — no member screenshots taken'); await browser.close(); process.exit(1); }
  const id = page.url().match(/[0-9a-f-]{36}/)?.[0] ?? '';
  console.log('  ✓ logged in');

  // THE OPENING TOUR SITS OVER THE DASHBOARD ON FIRST VISIT. It is real product — capture it — but it dims and
  // covers the triptych behind it, so every later shot would be of a modal rather than the surface. Capture it
  // once, then click through to the end so the rest of the run sees the app as a returning member does.
  const TOUR_BTN = /continue|got it|finish|done|start/i;
  await page.waitForTimeout(1500); // let the modal mount + finish animating before touching it
  if (await page.getByRole('button', { name: TOUR_BTN }).first().isVisible().catch(() => false)) {
    await page.addStyleTag({ content: '[data-nextjs-toast] { display: none !important; }' });
    await page.screenshot({ path: `${OUT}/03a-opening-tour.jpg`, quality: 82, type: 'jpeg' });
    console.log('  ✓ 03a-opening-tour');
  }
  // WHAT THIS MODAL ACTUALLY IS, because I got it wrong twice: not the Opening Tour but a CEREMONY THRESHOLD BEAT
  // (`.cer-overlay`, app/dashboard/ceremony-surface.tsx; the copy lives in lib/ceremony/threshold-beats.ts). That is
  // why the tour's `g4l-tour-seen-<id>` marker did nothing, and why clicking Continue never cleared it — the beat
  // is driven by server state for a member who is mid-ceremony, and it re-arms on every navigation.
  //
  // It covers ONLY the dashboard; every other surface photographs clean. It is captured above as its own
  // screenshot, so nothing is hidden from Cowork — but the dashboard shot has to show the dashboard, not a dialog
  // sitting on top of a dimmed one. Suppressed for the remaining captures, and called out in the MANIFEST.
  await page.addStyleTag({ content: '.cer-overlay { display: none !important; }' });
  console.log('  ✓ ceremony overlay captured, then set aside for the surface shots');

  for (const [path, name] of MEMBER_SHOTS) await shoot(page, path.replace(':id', id), name);
  await browser.close();

  // Exit non-zero on ANY miss. A bundle is pushed to Drive and quoted from; a silently short screenshot set is a
  // gap nobody notices until marketing describes a surface from the wrong picture.
  if (failures.length) {
    console.log(`\nFAILED — ${failures.length} surface${failures.length === 1 ? '' : 's'} not captured:`);
    for (const f of failures) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log(`\nAll ${PUBLIC_SHOTS.length + MEMBER_SHOTS.length} surfaces captured.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
