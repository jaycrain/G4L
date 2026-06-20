// Post-deploy smoke test. Logs into a DEMO account through the REAL /login form against a target URL,
// then asserts the member-facing pages render (no bypass, no new product endpoint — the actual user
// path). Demo-only: refuses any non-.test account. Reads SMOKE_EMAIL + SMOKE_PASSWORD from the env.
//
//   npm run smoke                         # defaults to the production alias
//   npm run smoke -- http://localhost:3100
//   npm run smoke -- https://g4l-git-<branch>-adjacent-lab-media.vercel.app
//
// Exit 0 = PASS, 1 = FAIL. Later this drops into CI as an automatic post-deploy gate.
import { chromium } from 'playwright';

const base = (process.argv[2] || 'https://g4l-ten.vercel.app').replace(/\/$/, '');
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) {
  console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD in the environment first.');
  process.exit(1);
}
if (!/\.test$/i.test(email)) {
  console.error(`Refusing: ${email} is not a demo (.test) account. Smoke login is demo-only.`);
  process.exit(1);
}

const fails: string[] = [];
const warns: string[] = [];
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails.push(`${label}${detail ? `: ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newContext().then((c) => c.newPage());
const serverErrors: string[] = [];
page.on('console', (m) => { if (m.type() === 'error') warns.push(`console: ${m.text()}`); });
page.on('response', (r) => { if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`); });

const open = async (path: string) => {
  const resp = await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  check((resp?.status() ?? 0) < 400, `GET ${path}`, `status ${resp?.status()}`);
  return resp;
};

try {
  console.log(`\nSMOKE → ${base}  (as ${email})\n`);

  // 1. Log in through the real form. Two subtleties handled here:
  //  - Hydration: a click landing before React attaches is silently swallowed (a native submit that
  //    reloads /login), so we wait until the submit button actually carries React's props before
  //    interacting — deterministic, no arbitrary sleeps.
  //  - Soft navigation: on success the form does a client-side router.push (no 'load' event fires),
  //    so we wait on the in-browser pathname. A rendered form error (e.g. bad credential) throws.
  await open('/login');
  await page.waitForFunction(
    () => {
      const el = document.querySelector('button[type="submit"]');
      return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$'));
    },
    null,
    { timeout: 15000 },
  );
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  try {
    await page.waitForFunction(() => location.pathname.startsWith('/dashboard/'), null, { timeout: 20000 });
  } catch {
    const err = (await page.locator('.error').first().textContent().catch(() => null))?.trim();
    throw new Error(
      `login did not reach dashboard (still at ${new URL(page.url()).pathname})${err ? ` — form error: "${err}"` : ''}`,
    );
  }
  const url = page.url();
  const memberId = url.match(/\/dashboard\/([0-9a-f-]+)/i)?.[1];
  check(!!memberId, 'login → dashboard', url);

  // 2. Dashboard renders with the renamed panel + the companion.
  const header = (await page.locator('[data-tour="program"] h3').first().textContent({ timeout: 15000 }))?.trim();
  check(header === 'The Program', 'dashboard "The Program" panel', header || 'missing');
  const companion = await page.locator('.companion-hero, .companion-rail, [class*="companion"]').count();
  check(companion > 0, 'companion present');

  // 3. Sub-pages render with the rename.
  if (memberId) {
    await open(`/program/${memberId}`);
    const h1 = (await page.locator('h1').first().textContent())?.trim();
    check(h1 === 'The Program', '/program heading', h1 || 'missing');

    await open(`/field-guide/${memberId}`);
    const fg = await page.locator('dt', { hasText: 'The Program' }).count();
    check(fg > 0, '/field-guide "The Program" entry');
  }

  // 4. No server errors anywhere in the run.
  check(serverErrors.length === 0, 'no 5xx responses', serverErrors.slice(0, 3).join(' | '));
} catch (e) {
  check(false, 'smoke run', (e as Error).message);
} finally {
  await browser.close();
}

if (warns.length) console.log(`\n${warns.length} warning(s) (non-failing):\n - ${warns.slice(0, 8).join('\n - ')}`);
if (fails.length) {
  console.error(`\nSMOKE FAILED (${fails.length}):\n - ${fails.join('\n - ')}`);
  process.exit(1);
}
console.log('\nSMOKE PASSED ✓');
process.exit(0);
