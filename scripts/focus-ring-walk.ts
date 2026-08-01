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
const fieldsFor = (home: string): Field[] => [
  { where: 'Log in',    path: '/login', selector: '#email',                      what: 'email' },
  { where: 'Log in',    path: '/login', selector: '#password',                   what: 'password' },
  { where: 'Dashboard', path: home,     selector: '.tri-comp-composer textarea', what: 'the Companion composer' },
  // The docked rail lives behind a toggle on narrower widths, so its absence is legitimate — but only this
  // one is allowed to be absent, and it still has to be SAID.
  { where: 'Dashboard', path: home,     selector: '.rrail-composer textarea',    what: 'the docked rail composer', optional: true },
];

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let failed = 0;

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
  console.log(`\nFOCUS RINGS → ${base}  (as ${email}, home ${home})\n`);
  if (!/^\/dashboard\//.test(home)) {
    console.log(`✖  login did not land on a dashboard (got ${home}) — cannot check the composers`);
    await browser.close();
    process.exit(1);
  }

  for (const f of fieldsFor(home)) {
    await page.goto(`${base}${f.path}`, { waitUntil: 'networkidle' });
    const el = page.locator(f.selector).first();
    if (await el.count() === 0) {
      // A SKIP IS NOT A PASS. The first version of this walk printed "✅ every member field shows the teal
      // ring" while silently skipping the two composers that were the whole reason it existed — it had the
      // wrong route. A harness that counts a missing field as success is worse than no harness.
      if (f.optional) { console.log(`—  ${f.where}: ${f.what} — not rendered at this width (allowed)`); continue; }
      failed++;
      console.log(`✖  ${f.where}: ${f.what} NOT FOUND at ${f.path} — cannot be checked, so this is a failure`);
      continue;
    }

    // A real click, not el.focus() — programmatic focus does not always satisfy :focus-visible, and what
    // matters is what a person sees when they click into the field.
    await el.click();
    const got = await el.evaluate((n) => {
      const s = getComputedStyle(n as Element);
      return { outline: s.outlineColor, width: s.outlineWidth, fv: (n as Element).matches(':focus-visible') };
    });
    const ok = got.outline === TEAL && parseFloat(got.width) >= 2;
    if (!ok) failed++;
    console.log(`${ok ? '✔' : '✖'}  ${f.where}: ${f.what}  →  ${got.outline} ${got.width}${ok ? '' : `   EXPECTED ${TEAL} 2px`}`);
  }

  await browser.close();
  console.log(failed === 0
    ? '\n✅ every member field shows the teal ring\n'
    : `\n❌ ${failed} field(s) with no ring or the wrong colour\n`);
  process.exit(failed === 0 ? 0 : 1);
};

void run();
