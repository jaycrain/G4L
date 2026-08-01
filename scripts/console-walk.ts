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
  { path: '/admin', expect: ['Founder Console', 'Cohort', 'Needs you', 'What moved', 'Everyone', 'Last active', 'Full member view'] },
  { path: '/admin/members', expect: ['Members', 'Total rows', 'Attention', 'Review queue'] },
  { path: '/admin/attention', expect: ['Attention', 'Mid-Session, paused', "Haven't been back"] },
  { path: '/admin/activity', expect: ['Activity', 'Founder Console'] },
  { path: '/admin/review', expect: ['Review queue', 'send nothing until you approve'] },
  { path: '/admin/moderation', expect: ['Community moderation'] },
  { path: '/admin/health', expect: ['AI surfaces'] },
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

  await browser.close();
  console.log(failed === 0 ? '\n✅ every console surface rendered' : `\n❌ ${failed} problem(s)`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
