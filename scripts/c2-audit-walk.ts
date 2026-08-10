// Does a member's Bigger World Audit actually KEEP what they say?
//
// C2 is now a 37-turn conversation — four (ratings → reflection) pairs and a cross-domain sort — and it had no
// end-to-end coverage. The offline suite proves the engine: given state, it records every answer. That is not the
// same question. Between one turn and the next the state crosses a server-action boundary, and on 2026-08-09 a
// hand walk suggested answers were being lost there. Three eval-driven browser attempts produced three DIFFERENT
// partial results, because driving a React app with synthetic events and programmatic clicks is not a member —
// the page even navigated away mid-sequence, which silently sent answers to the dashboard composer. Hours went
// into debugging the harness rather than the product.
//
// So this is the harness the question deserved: a real browser, real typing, real clicks, real timing.
//
//   node --experimental-strip-types scripts/c2-audit-walk.ts [baseUrl]
//
// Demo-only, like smoke.ts: reads SMOKE_EMAIL / SMOKE_PASSWORD and refuses any non-.test account.
//
// THE ASSERTION IS THE CLOSE, NOT THE DATABASE. If the member's obstacle and first move come back to them in the
// summary, the whole chain worked — captured, carried across 30-odd turns, stored, and read back. Asserting on a
// table row would prove storage while leaving the member-facing half untested, and would need the dev DB (which
// the server holds open — see docs/runbooks). What a member SEES is the thing worth pinning.

import { chromium, type Page } from 'playwright';

const base = (process.argv[2] ?? 'http://localhost:3100').replace(/\/$/, '');
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) { console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD.'); process.exit(2); }
if (!/\.test$/i.test(email)) { console.error(`Refusing: ${email} is not a demo (.test) account.`); process.exit(2); }

// The deciding sort answer, chosen to DIFFER from the computed primary (which the ratings below make Physical).
const FOCUS = 'social';
// The answers we look for coming back MUST be the FOCUS domain's — the close quotes the obstacle and first move
// from whichever area the member chose, not from the one the ratings ranked first. An earlier version of this
// walk asserted on PHYSICAL's answers while choosing Social, so it reported a product failure that was really a
// test that had misread its own feature. Distinctive strings, so a match cannot be a coincidence of copy.
const OBSTACLE = 'I keep cancelling on the people I miss';
const ACTION = 'Ring my brother on Sunday';
// Physical's answers are deliberately DIFFERENT and must NOT appear — that is the check that the close pulls
// from the chosen domain rather than simply from the last thing typed.
const DECOY_OBSTACLE = 'I let the evening disappear';

const fails: string[] = [];
const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => { fails.push(m); console.log(`  ✗ ${m}`); };

/** The agent's newest question — the last bubble, not the whole accumulated transcript. Reading the transcript is
 *  what made the earlier eval-driven attempts answer the wrong prompt twice. */
async function currentQuestion(page: Page): Promise<string> {
  // `.bubble.agent` — read from the component, not guessed (app/reclaim/reclaim-chat.tsx). The earlier
  // eval-driven attempts scraped the whole page text, which is why they answered a stale prompt twice.
  const bubbles = page.locator('.chat .bubble.agent');
  const n = await bubbles.count();
  if (n === 0) return '';
  return ((await bubbles.nth(n - 1).textContent()) ?? '').trim();
}

/** The conversation's full text — the chat column only, never the page (there are two <main> elements). */
const transcript = (page: Page): Promise<string> => page.locator('.reconnect-chat').innerText();

async function isRatingTurn(page: Page): Promise<boolean> {
  // Settle first: mid-transition the chips are gone but the composer has not enabled yet, and asking in that
  // window gives a false answer either way.
  await page.waitForFunction(
    () => {
      const chip = document.querySelector('.scale-chip:not([disabled])');
      const box = document.querySelector('textarea') as HTMLTextAreaElement | null;
      return !!chip || (!!box && !box.disabled);
    },
    undefined,
    { timeout: 25000 },
  ).catch(() => {});
  return page.locator('.scale-chip:not([disabled])').first().isVisible().catch(() => false);
}

/**
 * Tap a rating chip.
 *
 * NOT getByRole(name) — the pole chips are labelled "1 — low" and "10 — high" for screen readers, so an exact
 * name match silently never finds them and the walk dies on the first item. Match the rendered digit instead.
 * Every chip disables once one is picked, so the click is inherently one-shot; wait for the agent's reply.
 */
async function rate(page: Page, value: number): Promise<void> {
  const before = await page.locator('.chat .bubble.agent').count();
  await page.locator('.scale-chip').filter({ hasText: new RegExp(`^${value}$`) }).first().click();
  await page.waitForFunction(
    (n) => document.querySelectorAll('.chat .bubble.agent').length > (n as number),
    before,
    { timeout: 25000 },
  );
}

/**
 * Type like a person and press the real button.
 *
 * The composer is DISABLED on rating turns (W-32 hides the text box when chips are up) and while a turn is in
 * flight — so waiting for `textarea:not([disabled])` is not politeness, it is the only way to be sure the app is
 * ready for a typed answer. Clicking a disabled box just times out.
 *
 * Completion is detected by the agent REPLYING (one more bubble), not by the input clearing. The input clears
 * optimistically the moment you submit, so watching it says "the click registered", never "the turn landed" —
 * and answering the next question before the previous one has landed is precisely how the earlier attempts sent
 * the same answer to two different prompts.
 */
async function answer(page: Page, text: string): Promise<void> {
  const box = page.locator('textarea:not([disabled])').first();
  await box.waitFor({ state: 'visible', timeout: 25000 });
  const before = await page.locator('.chat .bubble.agent').count();
  await box.fill(text);
  await page.getByRole('button', { name: /^send$/i }).click();
  await page.waitForFunction(
    (n) => document.querySelectorAll('.chat .bubble.agent').length > (n as number),
    before,
    { timeout: 25000 },
  );
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // A page that navigates mid-walk invalidates everything after it — that is exactly what poisoned the earlier
  // attempts, so make it LOUD rather than something to notice later in a diff.
  let navigatedAway = false;
  const navLog: string[] = [];
  page.on('framenavigated', (f) => {
    if (f !== page.mainFrame()) return;
    const path = new URL(f.url()).pathname;
    navLog.push(path);
    // Ignore the walk's own steps to /login, the dashboard it lands on, and /c2 itself.
    if (!/\/c2$/.test(path) && !/^\/login/.test(path) && !/^\/dashboard\//.test(path)) navigatedAway = true;
  });

  console.log(`C2 AUDIT WALK — ${base}`);
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  // WAIT FOR HYDRATION BEFORE TOUCHING THE FORM, and watch the in-browser pathname rather than a navigation.
  // Both borrowed from scripts/smoke.ts, and both load-bearing: clicking an un-hydrated submit does nothing at
  // all (the page simply stays on /login with no error, which reads exactly like a wrong password), and the
  // login succeeds via a client-side router.push, so no 'load' event ever fires for waitForURL to catch.
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
  if (!landed) {
    // Say WHY. A bare timeout sends you hunting a walk bug when the answer is on screen — a wrong password, or
    // the auth rate limiter (0062 auth_attempt) after several rapid runs.
    const msg = (await page.locator('.error').first().textContent().catch(() => null))?.trim();
    bad(`login did not reach a dashboard${msg ? ` — the form says: "${msg}"` : ` (still on ${new URL(page.url()).pathname})`}`);
    await browser.close();
    return finish();
  }
  const memberId = page.url().match(/[0-9a-f-]{36}/)?.[0];
  if (!memberId) { bad('could not resolve the member id after login'); await browser.close(); return finish(); }
  ok('logged in as the demo member');

  await page.goto(`${base}/reclaim/${memberId}/c2`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.scale-chip, textarea', { timeout: 20000 });

  // MUST START AT THE OPENER. A crashed earlier run leaves an arc_session mid-audit, and C2 correctly resumes it
  // — so the walk would begin at whatever question it left off on and every "expected a rating turn" assertion
  // would fire for a reason that has nothing to do with the code. Fail loudly with the fix rather than produce a
  // confusing red.
  // "Fresh" = the MEMBER has not spoken yet. Checking the opening COPY instead was wrong: the opener is delivered
  // as several bubbles (the engine splits on BEAT_SEP), so the last one is the first rating item and the frame
  // sits above it — the guard fired on a perfectly fresh audit.
  const memberSaid = await page.locator('.chat .bubble.member').count();
  if (memberSaid > 0) {
    bad('C2 resumed an in-flight session — this walk needs a fresh audit. Stop the dev server, run `npm run db:seed-demo`, restart, and try again.');
    await browser.close();
    return finish();
  }
  ok('started at the opening frame, not mid-audit');

  // Ratings chosen so PHYSICAL is the runaway computed primary (big gap × high importance) while SOCIAL is where
  // they say they're most ready. Then the member CHOOSES social — so the close has to lead with their choice and
  // name the divergence. A walk where the two agree would pass without testing the rule.
  const RATINGS: Record<string, number[]> = {
    physical: [2, 10, 10, 3, 8],
    self: [7, 8, 4, 6, 4],
    social: [6, 8, 7, 9, 7],
    outlook: [7, 8, 4, 5, 4],
  };
  const REFLECT: Record<string, [string, string, string]> = {
    physical: ['Sleep slid and I stopped cooking', DECOY_OBSTACLE, 'Walk at lunch three days'],
    self: ['I drift when tired', 'Saying yes to everything', 'One no this week'],
    social: ['People drifted away', OBSTACLE, ACTION], // the FOCUS domain — these are what the close must quote
    outlook: ['Hard to picture next year', 'Too much day-to-day', 'Write one page'],
  };

  let turns = 0;
  const trail: string[] = [];
  let derailed = false;
  for (const domain of ['physical', 'self', 'social', 'outlook']) {
    if (derailed) break;
    const before = fails.length;
    for (const v of RATINGS[domain]!) {
      if (!(await isRatingTurn(page))) {
        bad(`expected a rating turn in ${domain}, got: "${(await currentQuestion(page)).slice(0, 70)}"`);
        derailed = true; break;
      }
      trail.push(`${domain}/rate ${v}`);
      await rate(page, v);
      turns++;
    }
    if (derailed) break;
    for (const text of REFLECT[domain]!) {
      if (await isRatingTurn(page)) { bad(`expected a reflection turn in ${domain}, still on chips`); derailed = true; break; }
      trail.push(`${domain}/reflect → "${(await currentQuestion(page)).slice(0, 46)}"`);
      await answer(page, text);
      turns++;
    }
    if (navigatedAway) { bad(`the page navigated away during ${domain} (nav: ${navLog.join(' → ')})`); derailed = true; break; }
    // Only claim the domain if nothing went wrong IN it — an unconditional ok() after a bad() is the same
    // dishonesty as a test that cannot fail.
    if (fails.length === before) ok(`${domain}: 5 ratings + 3 reflections`);
  }
  if (derailed) { console.log('  turn trail:'); trail.slice(-8).forEach((t) => console.log(`    · ${t}`)); }

  // The cross-domain sort. The LAST answer is the deciding focus.
  if (!derailed) {
    for (let q = 0; q < 5; q++) {
      const question = await currentQuestion(page);
      const isDecider = /only one area/i.test(question);
      await answer(page, isDecider ? FOCUS : 'physical');
      turns++;
    }
    ok(`cross-domain sort answered (${turns} turns total)`);
  }

  // THE ASSERTION READS THE AGENT'S CLOSE, NOT THE TRANSCRIPT.
  //
  // The first version of this walk checked `transcript.includes(OBSTACLE)` — and passed while simultaneously
  // reporting that the audit never reached its close, which is impossible. The transcript contains the MEMBER'S
  // OWN bubbles, so it matched the answer they had just typed. The check could not fail. Reading the agent's
  // bubbles only is the difference between proving the close gives their words back and proving they said them.
  // ALL the agent's bubbles, not a trailing window. The first version took the last four — a number tuned, by
  // accident, to how long the close was WHILE IT WAS BROKEN. The moment the fix landed and the close grew (it now
  // quotes the member's obstacle and first move), the window slid past "best next focus" and three assertions went
  // red on working code. Every string checked below appears only in the close, so the whole agent side is both
  // safer and honest. A window sized to today's output is a trap for tomorrow's.
  const close = await page
    .locator('.chat .bubble.agent')
    .allTextContents()
    .then((all) => all.join('\n'))
    .catch(() => '');
  if (navigatedAway) bad('page navigated away mid-walk — treat every assertion below as unproven');

  if (/best next focus/i.test(close)) ok('the audit reached its close');
  else bad('the audit never reached its close');

  // THE POINT OF THE WHOLE WALK.
  if (close.includes(OBSTACLE)) ok(`the close gives back their obstacle, in their words: "${OBSTACLE}"`);
  else bad('the close does NOT give back their obstacle — captured during the audit, then lost by the close');
  if (close.includes(ACTION)) ok(`the close gives back their first move: "${ACTION}"`);
  else bad('the close does NOT give back their first move');
  // And it must take them from the domain they CHOSE, not from another one they happened to answer.
  if (!close.includes(DECOY_OBSTACLE)) ok('and it does not borrow an obstacle from a domain they did not choose');
  else bad(`the close quoted PHYSICAL's obstacle while the member chose ${FOCUS}`);

  // The member's choice must lead, and the divergence must read as reflection rather than correction.
  if (/Social life/i.test(close)) ok('the close leads with the domain the MEMBER chose, not the computed one');
  else bad('the close did not lead with the member’s chosen focus');
  if (/ratings leaned toward Physical/i.test(close)) ok('the divergence is named plainly');
  else bad('the divergence between ratings and choice was not named');

  await browser.close();
  finish();
}

function finish(): void {
  console.log('');
  if (fails.length) { console.log(`C2 WALK FAILED — ${fails.length} problem(s)`); fails.forEach((f) => console.log(`  · ${f}`)); process.exit(1); }
  console.log('C2 WALK PASSED — the member’s own words survive the audit and come back to them.');
}

main().catch((e) => { console.error('walk crashed:', e); process.exit(1); });
