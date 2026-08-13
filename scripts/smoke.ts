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

  // 2. Dashboard renders: the program hero + a session title + the centered Companion (triptych, v3.2).
  check((await page.locator('[data-tour="program"]').count()) > 0, 'dashboard program hero present');
  const heroTitle = (await page.locator('.tri-hero-title').first().textContent({ timeout: 15000 }).catch(() => null))?.trim();
  check(!!heroTitle, 'dashboard hero session title', heroTitle || 'missing');
  const companion = await page.locator('[data-tour="companion"], [class*="companion"]').count();
  check(companion > 0, 'companion present');

  // 3. Sub-pages render. The headings now carry the messaging ladder's header rung (2026-08-13): a title that
  //    names the PURPOSE, plus a sub line under it. This assertion previously required the bare label "Program"
  //    and caught the change the day it shipped — which is the point of it, so it is updated rather than relaxed.
  //    Both halves are asserted: a title with no sub is the old bare label wearing a longer name.
  if (memberId) {
    await open(`/program/${memberId}`);
    const h1 = (await page.locator('h1').first().textContent())?.trim();
    check(h1 === 'The Program — your way back.', '/program heading', h1 || 'missing');
    const sub = (await page.locator('.hero-sub').first().textContent())?.trim() ?? '';
    check(sub.startsWith('Four phases, your pace.'), '/program sub line', sub || 'missing');
    // Live state, not copy: the header tells the member which phase they are actually in.
    check(/You’re in \w+\./.test(sub), '/program names the current phase', sub || 'missing');
    // The lead (Cowork copy, placed 2026-08-08). Three assertions, each for a different failure:
    //   · the heading — the page leads with the WHY, not a utility list;
    //   · the AI disclosure — a governance line, and the one Cowork's placement note told me to cut. If a future
    //     copy pass drops it again, this is what catches it, because nothing else on the page says it;
    //   · the shared vocabulary — "a tracked week" has to read the same here as on the Playbook cards. Two
    //     surfaces teaching one vocabulary is only true while both actually say it.
    const prog = (await page.locator('body').textContent())?.replace(/\s+/g, ' ') ?? '';
    check(prog.includes('Midlife Identity Loss — and the Comeback'), '/program leads with the why');
    check(prog.includes('guided conversation with your AI G4L Companion'), '/program discloses the AI (governance)');
    check(prog.includes('A read, a tool, a tracked week'), '/program teaches the same vocabulary as the cards');

    // The Field Guide was RETIRED (Jay, 2026-08-08) — every surface explains itself in context now. The route
    // survives only as a redirect, for members holding a bookmark, so what this asserts is the REDIRECT: land on
    // the dashboard, not a 404 and not the old page. This check earned its keep the day of the change: it was
    // still asserting the old heading and went red against a healthy prod, which is exactly its job.
    await open(`/field-guide/${memberId}`);
    const fgPath = new URL(page.url()).pathname;
    check(fgPath.startsWith('/dashboard/'), '/field-guide redirects to the dashboard', fgPath);

    // The first-class subpages the triptych elevated — each must render for a logged-in member (open() asserts <400).
    for (const sub of ['score', 'grinta', 'reclaim-list', 'movement', 'badges', 'playbook']) {
      await open(`/${sub}/${memberId}`);
    }

    // /playbook — the three outcome cards. A 200 here proves the ROUTE, not the FEATURE: outcomes() catches its own
    // read failure and returns [], which renders nothing at all. That degrade is deliberate (better silence than a
    // wrong claim about someone's work) but it means a drifted practice_week table on prod would take the cards
    // away and every status code would stay green. So assert the words. Heading AND a product name, because the
    // heading alone would survive an empty grid.
    await open(`/playbook/${memberId}`);
    const pb = (await page.locator('body').textContent())?.replace(/\s+/g, ' ') ?? '';
    check(pb.includes('What you’re building'), '/playbook shows the outcome strip');
    check(/Mindfulness/.test(pb) && /Fitness/.test(pb) && /Wellness/.test(pb), '/playbook names all three outcomes');
    // The honesty rule, checked where a member can actually read it: the cards may never tally themselves.
    // NO LEADING \b. It was there, and it let a real tally through: the strip's screen-reader text rendered as
    // "Mindfulness0 of 3 built", and there is no word boundary between "s" and "0", so the check passed while a
    // score was being read aloud to the one audience that cannot see we never show one. The rule is about the
    // WORDS, not about how they happen to be concatenated in the DOM.
    check(!/\d\s*(of|\/)\s*3\b/.test(pb), '/playbook outcome cards are not a score', pb.match(/.{0,40}\d\s*(of|\/)\s*3.{0,40}/)?.[0] ?? '');

    // /momentum — never smoke-checked before, and it is the one surface where a member VOCABULARY change lands in
    // three places at once (the log buttons, the history chips, the pulse legend). This asserts the WORD, not just
    // a 200, because the "Quiet Day" → "On Track" rename nearly shipped half done: the prose changed while the
    // enum→label maps still said Quiet Day, which no status code would ever have caught.
    await open(`/momentum/${memberId}`);
    const momentum = (await page.locator('body').textContent())?.replace(/\s+/g, ' ') ?? '';
    check(momentum.includes('On Track'), '/momentum says "On Track"');
    check(!/Quiet Day/i.test(momentum), '/momentum has no "Quiet Day" left', momentum.match(/.{0,40}Quiet Day.{0,40}/i)?.[0] ?? '');
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
