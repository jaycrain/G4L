// Does the teal focus ring actually reach every field a MEMBER touches?
//
// The global rule in globals.css covers plain inputs, but the composers — the fields members use most —
// each set `outline: none` for their own reasons, so the global rule never reached them. The member's own
// Companion composer had NO focus indication at all. That is invisible in a screenshot of an unfocused page
// and invisible to the offline suite, so it needs a browser and a real focus.
//
//   node --experimental-strip-types scripts/focus-ring-walk.ts [baseUrl]
//
// Logs in as the demo (.test) member from SMOKE_EMAIL / SMOKE_PASSWORD, same posture as smoke.ts.

import { chromium } from 'playwright';

const base = (process.argv[2] ?? 'http://localhost:3100').replace(/\/$/, '');
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) { console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD.'); process.exit(2); }
if (!/\.test$/i.test(email)) { console.error(`Refusing: ${email} is not a demo (.test) account.`); process.exit(2); }

const TEAL = 'rgb(59, 148, 149)';

/** Every field a member can put a cursor in, and where to find it. */
type Field = { where: string; path: string; selector: string; what: string; optional?: boolean };

// SIGNED-OUT fields must be checked BEFORE logging in — once you have a session, /login correctly
// redirects to the dashboard, so looking for #email there finds nothing and reports a false failure.
const SIGNED_OUT: Field[] = [
  { where: 'Log in', path: '/login', selector: '#email',    what: 'email' },
  { where: 'Log in', path: '/login', selector: '#password', what: 'password' },
];

const fieldsFor = (home: string): Field[] => [
  { where: 'Dashboard', path: home,     selector: '.tri-comp-composer textarea', what: 'the Companion composer' },
  // The docked rail lives behind a toggle on narrower widths, so its absence is legitimate — but only this
  // one is allowed to be absent, and it still has to be SAID.
  { where: 'Dashboard', path: home,     selector: '.rrail-composer textarea',    what: 'the docked rail composer', optional: true },
];

/** Click into a field for real and read what the member would see. Returns 1 on failure, 0 on pass. */
async function checkField(page: import('playwright').Page, f: Field): Promise<number> {
  await page.goto(`${base}${f.path}`, { waitUntil: 'networkidle' });

  // A member can land mid-CEREMONY, and its overlay swallows every click — which is indistinguishable from
  // "the field isn't there". The ceremony is a SEQUENCE of beats advanced by clicking the card, so one click
  // isn't enough; step through it the way a member would, then measure what's underneath.
  const overlay = page.locator('.cer-overlay');
  for (let beat = 0; beat < 25 && await overlay.isVisible().catch(() => false); beat++) {
    // Drive the real control (.cer-btn), not the card: the card only advances once the beat's typewriter
    // has finished, and the LAST beat runs a server action that leaves the button briefly disabled.
    const btn = page.locator('.cer-btn');
    await btn.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    if (await btn.isEnabled().catch(() => false)) await btn.click({ timeout: 3000 }).catch(() => {});
    else await page.locator('.cer-card').click({ timeout: 2000, force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }
  await overlay.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  if (await overlay.count() > 0 && await overlay.isVisible().catch(() => false)) {
    console.log(`   (a ceremony overlay is still up after 20 beats — measuring anyway, may fail)`);
  }

  const el = page.locator(f.selector).first();
  if (await el.count() === 0) {
    // A SKIP IS NOT A PASS. The first version of this walk printed "✅ every member field shows the teal
    // ring" while silently skipping the two composers that were the whole reason it existed — it had the
    // wrong route. A harness that counts a missing field as success is worse than no harness.
    if (f.optional) { console.log(`—  ${f.where}: ${f.what} — not rendered at this width (allowed)`); return 0; }
    console.log(`✖  ${f.where}: ${f.what} NOT FOUND at ${f.path} — cannot be checked, so this is a failure`);
    return 1;
  }
  // A real click, not el.focus() — programmatic focus does not always satisfy :focus-visible, and what
  // matters is what a person sees when they click into the field.
  await el.click();
  const got = await el.evaluate((n) => {
    const s = getComputedStyle(n as Element);
    return { outline: s.outlineColor, width: s.outlineWidth };
  });
  const ok = got.outline === TEAL && parseFloat(got.width) >= 2;
  console.log(`${ok ? '✔' : '✖'}  ${f.where}: ${f.what}  →  ${got.outline} ${got.width}${ok ? '' : `   EXPECTED ${TEAL} 2px`}`);
  return ok ? 0 : 1;
}

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let failed = 0;

  // ── PASS 1: signed out ────────────────────────────────────────────────────────────────────────────────
  console.log(`\nFOCUS RINGS → ${base}\n`);
  for (const f of SIGNED_OUT) failed += await checkField(page, f);

  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  // Wait for React to hydrate before typing — filling a form the client hasn't claimed yet submits nothing.
  // (Same guard smoke.ts uses; without it the click is swallowed and the walk sits on /login.)
  await page.waitForFunction(() => {
    const el = document.querySelector('button[type="submit"]');
    return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$'));
  }, null, { timeout: 15000 });
  await page.fill('#email', email!);
  await page.fill('#password', password!);
  await page.click('button[type="submit"]');
  // Login is a CLIENT-side transition, so waitForNavigation never fires. Watch the pathname instead.
  await page.waitForFunction(() => location.pathname.startsWith('/dashboard/'), null, { timeout: 20000 })
    .catch(() => {});

  // The member's home is /dashboard/<memberId> — take it from where login actually landed rather than
  // guessing '/', which is the signed-out welcome page and has none of these fields on it.
  const home = new URL(page.url()).pathname;
  console.log(`\n  signed in as ${email} → ${home}\n`);
  if (!/^\/dashboard\//.test(home)) {
    console.log(`✖  login did not land on a dashboard (got ${home}) — cannot check the composers`);
    await browser.close();
    process.exit(1);
  }

  // ── PASS 2: signed in ─────────────────────────────────────────────────────────────────────────────────
  for (const f of fieldsFor(home)) failed += await checkField(page, f);

  await browser.close();
  console.log(failed === 0
    ? '\n✅ every member field shows the teal ring\n'
    : `\n❌ ${failed} field(s) with no ring or the wrong colour\n`);
  process.exit(failed === 0 ? 0 : 1);
};

void run();
