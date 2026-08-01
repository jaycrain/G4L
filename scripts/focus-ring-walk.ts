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
type Field = { where: string; path: string; selector: string; what: string; optional?: boolean;
  /** A composer: must read as "type here" BEFORE anyone clicks it, so its border is teal at rest. */
  tealAtRest?: boolean };

// SIGNED-OUT fields must be checked BEFORE logging in — once you have a session, /login correctly
// redirects to the dashboard, so looking for #email there finds nothing and reports a false failure.
const SIGNED_OUT: Field[] = [
  { where: 'Log in', path: '/login', selector: '#email',    what: 'email' },
  { where: 'Log in', path: '/login', selector: '#password', what: 'password' },
];

const fieldsFor = (home: string): Field[] => [
  { where: 'Dashboard', path: home,     selector: '.tri-comp-composer textarea', what: 'the Companion composer', tealAtRest: true },
  // The docked rail belongs to the PRE-TRIPTYCH dashboard (RedesignShell). With DASH_TRIPTYCH on — which is
  // prod — the triptych replaces it entirely, so it is absent for a structural reason, not a width one.
  // The earlier "not rendered at this width" message was a plausible-sounding guess and it was wrong; it
  // would have sent someone hunting a responsive bug that doesn't exist. Kept in the walk because the rail
  // is the documented revert path if DASH_TRIPTYCH is ever turned off.
  { where: 'Dashboard', path: home,     selector: '.rrail-composer textarea',    what: 'the docked rail composer (pre-triptych dashboard)', optional: true, tealAtRest: true },
];

let failedRest = 0;

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
    if (f.optional) { console.log(`—  ${f.where}: ${f.what} — not on this build (allowed; see the field's note)`); return 0; }
    console.log(`✖  ${f.where}: ${f.what} NOT FOUND at ${f.path} — cannot be checked, so this is a failure`);
    return 1;
  }
  // RESTING STATE FIRST, before anything is clicked. A composer has to read as "this is where I type"
  // to someone who has not touched it yet — that is the whole point of the affordance, and measuring it
  // after a click would prove nothing.
  if (f.tealAtRest) {
    const rest = await el.evaluate((n) => getComputedStyle(n as Element).borderColor);
    const restOk = rest === TEAL;
    if (!restOk) failedRest++;
    console.log(`${restOk ? '✔' : '✖'}  ${f.where}: ${f.what} AT REST  →  border ${rest}${restOk ? '' : `   EXPECTED ${TEAL}`}`);
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

  // ── PASS 2: signed in, desktop ────────────────────────────────────────────────────────────────────────
  for (const f of fieldsFor(home)) failed += await checkField(page, f);

  // ── PASS 3: signed in, PHONE ──────────────────────────────────────────────────────────────────────────
  // With MOBILE unset, a phone gets the triptych's own responsive fold — the SAME .tri-comp-composer, just
  // laid out differently. "Should be the same component" is an assumption though, and the composer could
  // easily be swapped or hidden in the fold, so measure it rather than reason about it.
  //
  // Also checks the iOS ZOOM TRAP: Safari auto-zooms when you focus an input under 16px, which breaks fixed
  // full-screen panels. That rule is already written down for this codebase; a composer that silently drops
  // to 14.5px on the fold would reintroduce it.
  console.log('\n  — phone (390×844) —\n');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const f of fieldsFor(home)) failed += await checkField(page, f);

  const composer = page.locator('.tri-comp-composer textarea').first();
  if (await composer.count() > 0) {
    const px = await composer.evaluate((n) => parseFloat(getComputedStyle(n as Element).fontSize));
    const bigEnough = px >= 16;
    if (!bigEnough) failed++;
    console.log(`${bigEnough ? '✔' : '✖'}  Phone: composer font-size ${px}px${bigEnough ? '' : '   <16px — iOS Safari will zoom and break the fixed panel'}`);
    // A picture of the focused composer on a phone, so the teal is reviewable by eye and not only as a
    // computed value. Numbers prove the rule applied; a screenshot shows whether it LOOKS right.
    await composer.click().catch(() => {});
    await composer.scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: '/tmp/focus-phone-composer.png' });
    console.log('   → /tmp/focus-phone-composer.png');
  }

  await browser.close();
  const total = failed + failedRest;
  console.log(total === 0
    ? '\n✅ composers read as teal at rest; every member field rings teal on focus\n'
    : `\n❌ ${failedRest} resting-state and ${failed} focus-state problem(s)\n`);
  process.exit(total === 0 ? 0 : 1);
};

void run();
