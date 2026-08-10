// Does a member's Quality Day survive the trip from the coach to the thing they tap every morning?
//
// C3 is the last Reclaim surface with no end-to-end coverage, and it is the one with the LONGEST chain: the member
// defines their Quality Day in a coached conversation, the engine proposes it back, they confirm, it is written to
// coaching_plan as a profile, and then — on a different page, a different day, a different request — that profile
// has to come back as the tappable elements of the daily log. Every offline test proves one link of that chain.
// None of them proves the chain.
//
//   node --experimental-strip-types scripts/c3-quality-walk.ts [baseUrl]
//
// Demo-only, like smoke.ts and walk:c2: reads SMOKE_EMAIL / SMOKE_PASSWORD, refuses any non-.test account.
// Re-runnable: it clears the in-flight session AND the durable profile + logs first (dev-only route). Without the
// durable half, a second run would find a profile already defined, render the log surface fully populated, and pass
// while never exercising the coach at all.
//
// WHAT THIS ASSERTS, AND WHY THOSE THINGS.
//   1. The proposal quotes the member's OWN words back. Not "a proposal appeared" — the specific non-negotiable
//      they typed. A summary that has lost the member's phrasing is the failure this feature exists to avoid.
//   2. The commit closes the session.
//   3. **The log surface offers the elements they just defined, as buttons.** This is the seam. A profile that
//      stored fine but doesn't reach the log leaves the member a page saying "define your Quality Day first" the
//      morning after they defined it.
//   4. A logged day is actually recorded — the page comes back reporting the score across one day.
//
// Deliberately NOT asserted against the database. The dev server holds PGlite open (docs/runbooks), and a row
// proves storage while leaving the member-facing half — the only half a member has — untested.

import { chromium, type Page } from 'playwright';

const base = (process.argv[2] ?? 'http://localhost:3100').replace(/\/$/, '');
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) { console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD.'); process.exit(2); }
if (!/\.test$/i.test(email)) { console.error(`Refusing: ${email} is not a demo (.test) account.`); process.exit(2); }

// The instrument asks for THREE non-negotiables, THREE contributors and TWO disruptors (see RECORD_QUALITY_DAY_TOOL).
// Feed it less and the coach correctly keeps drawing out instead of proposing — the first run of this walk gave it
// 2/1/1 and then reported a product failure that was really the walk starving the instrument.
const NON_NEGOTIABLES = [
  'walk with Rosie before the house wakes',
  'seven hours of sleep',
  'eating lunch away from my desk',
];
const CONTRIBUTORS = [
  'cooking something properly instead of grazing',
  'ten minutes on the piano',
  'a real conversation with Marcus',
];
const DISRUPTORS = ['opening email before I have had coffee', 'saying yes to a late meeting'];
// WHAT WE ASSERT SURVIVES — the distinctive CONTENT, not the exact string.
//
// The model renders these as list items and legitimately tidies them: it sentence-cases ("seven" → "Seven"),
// contracts ("I have had" → "I've had"), and compresses for a button label ("walk with Rosie before the house
// wakes" → "Morning walk with Rosie"). A byte-exact assertion fails on every one of those and would make this walk
// cry wolf — which is how a walk stops being run.
//
// So each item carries the token that CANNOT be lost without the member's own life going with it. "Rosie",
// "piano", "Marcus", "grazing" are irreplaceable; a paraphrase that keeps them is fine, one that turns "walk with
// Rosie" into "morning movement" is the real failure this is here to catch. Matched case-insensitively.
const SURVIVES = {
  nonNegotiable: 'Rosie',
  contributor: 'grazing',
  contributor2: 'piano',
  disruptor: 'coffee',
} as const;
// The score we log, and the reflections. The page reports the week's average, so with exactly one logged day the
// average IS this number — which makes the assertion exact rather than "some number appeared".
const SCORE = 8;
const MOST_VALUABLE = 'the walk set the whole day up';

const fails: string[] = [];
const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => { fails.push(m); console.log(`  ✗ ${m}`); };
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The agent's newest bubble — never the whole transcript. Asserting on the transcript is what made an earlier
 *  walk unable to fail: it contains the MEMBER'S bubbles, so it matches the text just typed. */
async function currentReply(page: Page): Promise<string> {
  const bubbles = page.locator('.chat .bubble.agent');
  const n = await bubbles.count();
  return n === 0 ? '' : norm((await bubbles.nth(n - 1).textContent()) ?? '');
}

/** Every agent bubble, joined — for "did this EVER come back" questions. Still excludes member bubbles. */
async function agentSaid(page: Page): Promise<string> {
  return norm((await page.locator('.chat .bubble.agent').allTextContents()).join('\n'));
}

/**
 * Type like a person and press the real button.
 *
 * Completion is the agent REPLYING (one more bubble), not the input clearing — the input clears optimistically the
 * moment you submit, so watching it tells you the click registered, never that the turn landed. C3 is a coach arc,
 * so every turn is typed; there are no chips to worry about.
 */
async function say(page: Page, text: string): Promise<void> {
  const box = page.locator('textarea:not([disabled])').first();
  await box.waitFor({ state: 'visible', timeout: 30000 });
  const before = await page.locator('.chat .bubble.agent').count();
  await box.fill(text);
  await page.getByRole('button', { name: /^send$/i }).click();
  await page.waitForFunction(
    (n) => document.querySelectorAll('.chat .bubble.agent').length > (n as number),
    before,
    { timeout: 40000 },
  );
}

function finish(): void {
  console.log('');
  if (fails.length) {
    console.log(`FAILED — ${fails.length} problem${fails.length === 1 ? '' : 's'}:`);
    for (const f of fails) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log('C3 QUALITY DAYS WALK PASSED');
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  console.log(`C3 QUALITY DAYS WALK — ${base}`);
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  // Wait for HYDRATION before touching the form, and watch the in-browser pathname rather than a navigation —
  // both borrowed from smoke.ts. Clicking an un-hydrated submit does nothing at all (looks exactly like a wrong
  // password), and login succeeds via a client-side router.push, so no load event fires for waitForURL.
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
    const msg = (await page.locator('.error').first().textContent().catch(() => null))?.trim();
    bad(`login did not reach a dashboard${msg ? ` — the form says: "${msg}"` : ` (still on ${new URL(page.url()).pathname})`}`);
    await browser.close();
    return finish();
  }
  const memberId = page.url().match(/[0-9a-f-]{36}/)?.[0];
  if (!memberId) { bad('could not resolve the member id after login'); await browser.close(); return finish(); }
  ok('logged in as the demo member');

  // Clear the in-flight session AND the durable profile/logs, so the coach half actually runs. The SERVER does it
  // (app/dev/reset-session) because the dev server holds the PGlite directory open and a script reaching in from
  // outside corrupts the data dir. page.request shares the browser's cookies, so this runs as this member.
  const reset = await page.request.post(`${base}/dev/reset-session?session=c3`);
  if (reset.ok()) ok('cleared the in-flight session + any existing Quality Day profile');
  else bad(`reset-session returned ${reset.status()} — a second run would silently skip the coach`);

  // ---- 1. DEFINE THE QUALITY DAY -----------------------------------------------------------------------------
  await page.goto(`${base}/reclaim/${memberId}/c3`, { waitUntil: 'domcontentloaded' });
  const opener = await page.locator('.chat .bubble.agent').first().textContent({ timeout: 20000 }).catch(() => null);
  if (!opener) { bad('the C3 session did not open (no agent bubble)'); await browser.close(); return finish(); }
  ok('C3 session opened');

  // Give the coach the full 3/3/2 the instrument asks for. It draws out before it proposes, so this is a
  // conversation, not a form — each turn adds one layer.
  await say(page, `Honestly the days that feel good all start the same way — a ${NON_NEGOTIABLES[0]}. I also need ${NON_NEGOTIABLES[1]}, no negotiating on that one, and ${NON_NEGOTIABLES[2]}. Without those three it's not a good day.`);
  await say(page, `On top of that, what really helps is ${CONTRIBUTORS[0]}, ${CONTRIBUTORS[1]}, and ${CONTRIBUTORS[2]}. Not essential, but they lift a day.`);
  await say(page, `What wrecks a day is ${DISRUPTORS[0]} — I'm behind before I've started — and ${DISRUPTORS[1]}.`);

  // THE PROPOSAL IS AN ENGINE STRING, so anchor on it. Matching /quality day/i instead — the first version of this
  // walk — matches the OPENER ("let's start by defining your quality day"), so the assertion passed before the
  // coach had said anything and could not fail. proposeQualityDay() emits this exact heading.
  const PROPOSAL = /Here's your Quality Day:/i;
  let proposal = await currentReply(page);
  for (let i = 0; i < 4 && !PROPOSAL.test(proposal); i++) {
    await say(page, "That's the whole picture — that's what a quality day is for me.");
    proposal = await currentReply(page);
  }

  const said = await agentSaid(page);
  if (PROPOSAL.test(said)) ok('the coach proposed the Quality Day back');
  else { bad('the coach never proposed a Quality Day after 7 turns'); console.log(`      last: "${proposal.slice(0, 200)}"`); }

  // THE REAL CHECK: their own words, not a paraphrase. A proposal that has lost the member's phrasing is the
  // failure this beat exists to prevent.
  // Print the proposal on ANY miss. A bare "never came back" sends you hunting the engine when the answer — the
  // model's paraphrase — is right there on screen.
  const proposalText = said.match(/Here's your Quality Day:[\s\S]*?(?:adjust it first\?|$)/i)?.[0] ?? '';
  const lower = said.toLowerCase();
  const missed: string[] = [];
  for (const [label, token] of Object.entries(SURVIVES)) {
    if (lower.includes(token.toLowerCase())) ok(`the proposal keeps their ${label} ("${token}")`);
    else { bad(`the proposal lost their ${label} — "${token}" never came back`); missed.push(label); }
  }
  if (missed.length) console.log(`\n      THE PROPOSAL AS SHOWN:\n${proposalText.replace(/^/gm, '      ')}\n`);

  // ---- 2. CONFIRM AND COMMIT ---------------------------------------------------------------------------------
  await say(page, 'Yes, save that and start the week.');
  const closed = await agentSaid(page);
  if (/log each day|noticing what actually makes your days yours/i.test(closed)) ok('committed — the session closed into the week of logging');
  else bad(`the confirm did not close the session (last line: "${(await currentReply(page)).slice(0, 120)}…")`);

  // ---- 3. THE SEAM: does the profile reach the log surface? ---------------------------------------------------
  // A different page, a different request. This is where a profile that stored fine can still fail to arrive.
  await page.goto(`${base}/quality-day/${memberId}`, { waitUntil: 'domcontentloaded' });
  const notDefined = await page.getByText(/define your quality day first/i).count();
  if (notDefined > 0) {
    bad('the log surface says "define your Quality Day first" — the profile never reached it');
    await browser.close();
    return finish();
  }
  ok('the log surface found their profile');

  const elementButtons = norm((await page.locator('.qd-el-btn').allTextContents()).join(' | '));
  // profileElements() = nonNegotiables + contributors (disruptors are deliberately NOT tappable — you log what
  // showed UP, not what dragged the day down). So these two tokens are the ones that must be here.
  const elementsLower = elementButtons.toLowerCase();
  const elementMiss: string[] = [];
  for (const label of ['nonNegotiable', 'contributor', 'contributor2'] as const) {
    const token = SURVIVES[label];
    if (elementsLower.includes(token.toLowerCase())) ok(`their ${label} ("${token}") is offered as a tappable element`);
    else { bad(`their ${label} ("${token}") is not among the log's elements`); elementMiss.push(label); }
  }
  // A disruptor appearing here would be a real bug — it would ask the member to tick the thing that ruined the day
  // as though it were something good.
  if (elementsLower.includes(SURVIVES.disruptor.toLowerCase())) bad('a DISRUPTOR is offered as a tappable element — the log asks what showed up, not what went wrong');
  else ok('and the disruptor is correctly NOT tappable');
  // Printing turns a "missing" into "here is exactly what got stored" — a report rather than a hunt.
  if (elementMiss.length) console.log(`\n      THE ELEMENTS ACTUALLY OFFERED:\n      ${elementButtons.split(' | ').join('\n      ')}\n`);

  // ---- 4. LOG A DAY -------------------------------------------------------------------------------------------
  await page.locator('.qd-score-btn').filter({ hasText: new RegExp(`^${SCORE}$`) }).first().click();
  // Match the token, not the full sentence — the button carries the model's tidied label ("Morning walk with
  // Rosie"), so filtering on the phrase the member typed finds nothing and the walk dies on a 30s timeout.
  await page.locator('.qd-el-btn').filter({ hasText: new RegExp(SURVIVES.nonNegotiable, 'i') }).first().click();
  await page.locator('textarea.momentum-log-note').first().fill(MOST_VALUABLE);
  await page.locator('.momentum-log-btn').first().click();

  const logged = await page
    .waitForSelector('.momentum-log-done', { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (logged) ok('logged today');
  else bad('logging the day did not confirm (no done state)');

  // And it PERSISTED — reload, and the page reports the week from stored rows. With exactly one logged day the
  // average is the score we picked, so this is exact rather than "a number appeared".
  await page.reload({ waitUntil: 'domcontentloaded' });
  const summary = norm(await page.locator('.card-subtitle').first().textContent() ?? '');
  if (new RegExp(`This week so far: ${SCORE}(\\.0)? / 10 across 1 day\\b`).test(summary)) {
    ok(`the day survived a reload — "${summary.match(/This week so far:[^.]*day/)?.[0]}"`);
  } else {
    bad(`the logged day did not come back after reload — the page says: "${summary.slice(0, 160)}"`);
  }

  await browser.close();
  return finish();
}

main().catch((e) => { console.error(e); process.exit(1); });
