// A REAL BROWSER WALK of the Founder Console and every one of its subpages.
//
// The console is admin-gated, so it cannot be checked the way member surfaces are. This mints a valid admin
// cookie locally from ADMIN_PASSWORD (never printed, never written anywhere) and drives a browser through
// each route, asserting the page actually RENDERED — a heading, its nav, no error boundary — rather than
// merely that the route compiled. "It built" is not "it works": a server component that throws still builds.
//
//   npm run dev            (in another terminal, or the preview server)
//   node --experimental-strip-types scripts/console-walk.ts [baseUrl]

import { chromium } from 'playwright';
import { signAdminToken } from '../lib/auth/admin-token.ts';

const BASE = process.argv[2] ?? 'http://localhost:3100';

/** Every console route, with a string that proves ITS OWN content rendered — not just the shared chrome. */
const ROUTES: Array<{ path: string; expect: string[] }> = [
  { path: '/admin', expect: ['Founder Console', 'Cohort', 'Needs you', 'What moved', 'Live ·', 'All members', 'Work the queue', 'All activity', 'Members', 'Attention', 'Feedback'] },
  { path: '/admin/members', expect: ['Members', 'Total rows', 'Attention', 'Review queue'] },
  { path: '/admin/attention', expect: ['Attention', 'Mid-Session, paused', "Haven't been back", 'Live ·', 'Console'] },
  { path: '/admin/activity', expect: ['Activity', 'Founder Console'] },
  { path: '/admin/review', expect: ['Review queue', 'send nothing until you approve'] },
  { path: '/admin/moderation', expect: ['Community moderation'] },
  { path: '/admin/health', expect: ['AI surfaces', 'Last 7 days'] },
  { path: '/admin/feedback', expect: ['Feedback'] },
  // The long page must still work — nothing may become unreachable because a new view shipped.
  { path: '/admin?view=roster', expect: ['Founder Agent', 'Members', 'Review queue', 'AI surfaces'] },
];

async function main() {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) { console.error('ADMIN_PASSWORD not set — source .env.local first.'); process.exit(2); }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{
    name: 'g4l_admin',
    value: signAdminToken(secret, Date.now() + 3600_000),
    domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax',
  }]);
  const page = await ctx.newPage();

  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  let failed = 0;
  for (const r of ROUTES) {
    const consoleErrsBefore = errors.length;
    const res = await page.goto(BASE + r.path, { waitUntil: 'networkidle' });
    const status = res?.status() ?? 0;
    const body = await page.locator('body').innerText();

    const missing = r.expect.filter((e) => !body.includes(e));
    // Next renders a digest page on a server-component throw — catch that explicitly rather than letting a
    // missing-string assertion report it as a content problem.
    const crashed = /Application error|Internal Server Error|This page could not be found/i.test(body);
    const ok = status === 200 && !crashed && missing.length === 0;
    if (!ok) failed++;

    console.log(`${ok ? '✔' : '✖'} ${r.path}  [${status}]${crashed ? '  CRASHED' : ''}${missing.length ? `  missing: ${missing.join(' | ')}` : ''}`);
    const fresh = errors.slice(consoleErrsBefore).filter((e) => !/favicon|DevTools/i.test(e));
    if (fresh.length) console.log(`   console: ${fresh.slice(0, 3).join(' · ')}`);

    await page.screenshot({ path: `/tmp/console-walk${r.path.replace(/[/?=]/g, '_')}.png`, fullPage: true });
  }

  // THE LINKS HAVE TO GO SOMEWHERE. A subpage nobody can reach is a subpage that does not exist, and the
  // console's whole promise is that nothing became unreachable.
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
  const hrefs = await page.locator('a[href^="/admin"]').evaluateAll((as) =>
    [...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!))]);
  // Its OWN counter. The first cut reused `failed`, so an unrelated content-assertion failure made this
  // report "all reachable: NO" while printing no dead link at all — a harness lying about its own subject.
  let dead = 0;
  for (const h of hrefs) {
    const res = await page.goto(BASE + h, { waitUntil: 'domcontentloaded' });
    if ((res?.status() ?? 0) !== 200) { dead++; console.log(`✖ dead console link: ${h} [${res?.status()}]`); }
  }
  failed += dead;
  console.log(`\n${hrefs.length} links out of the console, all reachable: ${dead === 0 ? 'yes' : `NO (${dead} dead)`}`);

  // ── THE REFRESH TICK MUST NOT EAT THE CONVERSATION ─────────────────────────────────────────────────────
  // The console auto-refreshes every 30s via router.refresh(). The Companion thread is CLIENT state, and the
  // documented behaviour is that router.refresh() re-pulls server data while preserving it — but "documented"
  // is not "true on this page", and silently wiping a conversation mid-sentence would be far worse than a
  // stale panel. So: type something, force a tick, and check it is still there.
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
  const composer = page.locator('input[aria-label="Ask the Founder Companion"]');
  await composer.fill('a half-typed question I have not sent yet');
  await page.getByRole('button', { name: 'Refresh now' }).click();
  await page.waitForTimeout(1500);
  const survived = await composer.inputValue();
  const kept = survived === 'a half-typed question I have not sent yet';
  if (!kept) failed++;
  console.log(`${kept ? '✔' : '✖'} the refresh tick preserves the Companion's client state${kept ? '' : `  (got: "${survived}")`}`);

  // ── DARK IS SCOPED, AND IT MUST NOT LEAK ───────────────────────────────────────────────────────────────
  // Every dark rule hangs off .fc-dark, set only by app/admin/layout.tsx. The property worth guarding is the
  // BOUNDARY: an operator colour must never reach a member surface, and vice versa. A wholesale re-skin is
  // only safe to do because that line is checkable.
  for (const p of ['/admin', '/admin/members', '/admin/activity']) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    const bg = await page.evaluate(() => {
      const el = document.querySelector('.fc-dark');
      return el ? getComputedStyle(el).backgroundColor : null;
    });
    const dark = bg === 'rgb(42, 42, 42)';
    if (!dark) failed++;
    console.log(`${dark ? '✔' : '✖'} ${p} sits on charcoal${dark ? '' : `   got ${bg ?? 'no .fc-dark scope'}`}`);
  }
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  const leaked = await page.evaluate(() => document.querySelectorAll('.fc-dark').length > 0);
  if (leaked) failed++;
  console.log(`${leaked ? '✖' : '✔'} the member app is untouched by the console theme`);

  // ── THE TOGGLE ACTUALLY TOGGLES, AND IT STICKS ─────────────────────────────────────────────────────────
  // Dark is the default and the intent; light is the escape hatch. The property worth proving is that the
  // choice SURVIVES a navigation — a theme that resets when you open a subpage isn't a preference, it's a
  // button. Restored to dark afterwards so the run leaves no state behind.
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Light' }).click();
  await page.waitForTimeout(1200);
  const afterClick = !(await page.evaluate(() => document.querySelectorAll('.fc-dark').length > 0));
  // Reload before judging: a server action that WROTE but whose revalidation didn't reach this tab is a very
  // different bug from one that didn't write at all, and only a reload separates them.
  await page.reload({ waitUntil: 'networkidle' });
  const wentLight = !(await page.evaluate(() => document.querySelectorAll('.fc-dark').length > 0));
  if (wentLight && !afterClick) console.log('   (needed a reload — the write landed, the revalidation did not)');
  if (!wentLight) failed++;
  console.log(`${wentLight ? '✔' : '✖'} the toggle switches the console to light`);

  await page.goto(BASE + '/admin/members', { waitUntil: 'networkidle' });
  const stuck = !(await page.evaluate(() => document.querySelectorAll('.fc-dark').length > 0));
  if (!stuck) failed++;
  console.log(`${stuck ? '✔' : '✖'} and it holds across a navigation — a preference, not a button`);

  await page.getByRole('button', { name: 'Dark' }).click();
  await page.waitForTimeout(900);
  const backToDark = await page.evaluate(() => document.querySelectorAll('.fc-dark').length > 0);
  if (!backToDark) failed++;
  console.log(`${backToDark ? '✔' : '✖'} and back to dark, leaving no state behind`);

  // ── AN OPERATOR IS NOT A COLD VISITOR ──────────────────────────────────────────────────────────────────
  // Signed in as admin, "/" used to fall through to the marketing welcome ("Welcome midlifer, your comeback
  // begins today") — the wrong thing to show the person running the program. It should land on the console.
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  const landed = new URL(page.url()).pathname;
  const routed = landed === '/admin';
  if (!routed) failed++;
  console.log(`${routed ? '✔' : '✖'} "/" as an admin → ${landed}${routed ? '' : '   EXPECTED /admin'}`);

  // ── THE LOGO GOES HOME, NOT OUT ────────────────────────────────────────────────────────────────────────
  // It was hard-wired to '/', so tapping the wordmark inside the console threw the operator into the MEMBER
  // app. Check on a SUBPAGE, not just /admin, because that's where you actually reach for it.
  for (const p of ['/admin', '/admin/members', '/admin/attention']) {
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    const href = await page.locator('a.brand-home').first().getAttribute('href');
    const ok = href === '/admin';
    if (!ok) failed++;
    console.log(`${ok ? '✔' : '✖'} logo on ${p} → ${href}${ok ? '' : '   EXPECTED /admin'}`);
  }
  // And it must NOT have changed for members — the same component serves both.
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  const memberHref = await page.locator('a.brand-home').first().getAttribute('href');
  const memberOk = memberHref === '/';
  if (!memberOk) failed++;
  console.log(`${memberOk ? '✔' : '✖'} logo on /login (member side) → ${memberHref}${memberOk ? '' : '   EXPECTED /'}`);

  // ── THE THREAD SURVIVES A RELOAD ───────────────────────────────────────────────────────────────────────
  // The point of persisting it. Seed a thread through the real sessionStorage key, reload, and check the
  // turns are rendered — then Clear, reload again, and check they are GONE (so "clear" is not cosmetic).
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.sessionStorage.setItem('g4l.founder.thread', JSON.stringify([
    { role: 'jay', text: 'a question from before the reload' },
    { role: 'companion', text: 'an answer from before the reload', looked: ['cohort_stats'] },
  ])));
  await page.reload({ waitUntil: 'networkidle' });
  const threadKept = await page.getByText('an answer from before the reload').count() > 0;
  if (!threadKept) failed++;
  console.log(`${threadKept ? '✔' : '✖'} the Companion thread survives a reload`);

  if (threadKept) {
    await page.getByRole('button', { name: 'Clear this conversation' }).click();
    await page.reload({ waitUntil: 'networkidle' });
    const gone = await page.getByText('an answer from before the reload').count() === 0;
    const emptied = await page.evaluate(() => window.sessionStorage.getItem('g4l.founder.thread'));
    const cleared = gone && (emptied === null || emptied === '[]');
    if (!cleared) failed++;
    console.log(`${cleared ? '✔' : '✖'} clearing it really empties the store, not just the screen`);
  }

  await browser.close();
  console.log(failed === 0 ? '\n✅ every console surface rendered' : `\n❌ ${failed} problem(s)`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
