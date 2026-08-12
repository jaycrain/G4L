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
//   5. **The tracker appears on the Playbook's "This week"** — the surface a member goes to for their trackers.
//      Added 2026-08-11 after Jay finished C3 and reported no tracker, with both the profile and the week sitting
//      in the database. Steps 3 and 4 were green throughout: proving the log page works is not proving the week
//      SHOWS UP, and this walk stopped one page short of the thing that got reported.
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
// WHAT WE ASSERT SURVIVES — the member's EXACT words.
//
// This started looser. The model tidies when left to itself — sentence-cases for a list, contracts "I have had" to
// "I've had", compresses "a walk with Rosie before the house wakes" into "Morning walk with Rosie" — and the first
// version of this walk accepted that, asserting only that a distinctive token ("Rosie") survived.
//
// Jay's call, 2026-08-09: "keep it verbatim, we're giving them their own words back." So the engine now grounds
// every recorded item to the span the member actually typed (lib/agent/member-words.ts), and this walk holds it to
// that — byte-exact, because a near-miss here means the grounding silently stopped working and the member is being
// handed a tidied version of their own life.
//
// These are the spans as the member types them below. Lowercase where they said it mid-sentence: their casing, not
// the model's list formatting.
const VERBATIM = {
  nonNegotiable: 'walk with Rosie before the house wakes',
  contributor: 'cooking something properly instead of grazing',
  contributor2: 'ten minutes on the piano',
  disruptor: 'opening email before I have had coffee',
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
  const missed: string[] = [];
  for (const [label, span] of Object.entries(VERBATIM)) {
    // EXACT. Not case-insensitive, not a token — the contract is the member's own words, unedited.
    if (said.includes(span)) ok(`the proposal gives back their ${label} verbatim`);
    else { bad(`the proposal EDITED their ${label} — expected "${span}"`); missed.push(label); }
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
  const elementMiss: string[] = [];
  for (const label of ['nonNegotiable', 'contributor', 'contributor2'] as const) {
    const span = VERBATIM[label];
    if (elementButtons.includes(span)) ok(`their ${label} is tappable, in their own words`);
    else { bad(`their ${label} reached the log EDITED — expected "${span}"`); elementMiss.push(label); }
  }
  // A disruptor appearing here would be a real bug — it would ask the member to tick the thing that ruined the day
  // as though it were something good.
  if (elementButtons.includes(VERBATIM.disruptor)) bad('a DISRUPTOR is offered as a tappable element — the log asks what showed up, not what went wrong');
  else ok('and the disruptor is correctly NOT tappable');
  // Printing turns a "missing" into "here is exactly what got stored" — a report rather than a hunt.
  if (elementMiss.length) console.log(`\n      THE ELEMENTS ACTUALLY OFFERED:\n      ${elementButtons.split(' | ').join('\n      ')}\n`);

  // ---- 4. LOG A DAY -------------------------------------------------------------------------------------------
  await page.locator('.qd-score-btn').filter({ hasText: new RegExp(`^${SCORE}$`) }).first().click();
  // Match the token, not the full sentence — the button carries the model's tidied label ("Morning walk with
  // Rosie"), so filtering on the phrase the member typed finds nothing and the walk dies on a 30s timeout.
  await page.locator('.qd-el-btn').filter({ hasText: VERBATIM.nonNegotiable }).first().click();
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

  // ---- 5. THE PLACE THE MEMBER ACTUALLY LOOKS ----------------------------------------------------------------
  //
  // Jay finished C3 on his own account and reported "no tracker was set up" (2026-08-11). The database had both the
  // profile and the week; steps 3 and 4 above were green. What none of them covered is the Playbook's "This week" —
  // the surface the member goes to for their trackers. Proving the log page works is not proving the tracker
  // APPEARS, and this walk stopped one page short of the thing that was reported.
  await page.goto(`${base}/playbook/${memberId}`, { waitUntil: 'domcontentloaded' });
  const onThisWeek = await page.locator('.pb-tab', { hasText: /^This week$/ }).first().click().then(() => true).catch(() => false);
  if (!onThisWeek) bad('the Playbook has no "This week" tab');
  await page.waitForSelector('.wk-grid, .pb-sec', { timeout: 15000 }).catch(() => {});

  const gridCount = await page.locator('.wk-grid').count();
  if (gridCount === 0) {
    bad('the Playbook shows NO week grids at all — the member just opened a week and cannot see it');
  } else {
    ok(`the Playbook renders ${gridCount} week grid${gridCount === 1 ? '' : 's'}`);
    // THE QUALITY DAYS GRID SPECIFICALLY. With several weeks running, "a grid rendered" is a check that cannot
    // fail — B2's or B3's would satisfy it while C3's is missing entirely.
    const labels = norm((await page.locator('.wk-lab').allTextContents()).join(' | '));
    if (labels.includes(VERBATIM.nonNegotiable)) {
      ok(`their Quality Day is a row on the grid, in their words — "${VERBATIM.nonNegotiable}"`);
    } else {
      bad('the Quality Days grid is NOT on the Playbook — their week opened somewhere they cannot see it');
      console.log(`\n      THE ROWS ACTUALLY SHOWN:\n      ${labels.split(' | ').join('\n      ')}\n`);
    }
    // And it must be NAMED. With more than one week running, an unlabelled grid is four tables the member has to
    // tell apart by their row text.
    const heads = norm((await page.locator('.pb-week-h').allTextContents()).join(' | '));
    if (gridCount > 1 && !/quality days/i.test(heads)) bad(`the grid is not named "Your Quality Days" — heads were: ${heads}`);
    else if (gridCount > 1) ok('and it is named, so it is tellable from the other weeks running');
  }

  await browser.close();
  return finish();
}

main().catch((e) => { console.error(e); process.exit(1); });
