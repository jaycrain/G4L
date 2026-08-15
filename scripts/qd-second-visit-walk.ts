// Does a SECOND Quality Day log on the same day keep the first one's elements?
//
// Jay, on his own account, 2026-08-14: "the only box that will stay checked is the last one you've entered data
// for." A fix shipped that evening (264708c) and he reported it still broken. Every existing test passed against
// the broken product, because they all call the store directly with explicit arguments — none of them is a member
// opening a page twice. THAT is the whole point of this walk: it does nothing a member could not do.
//
//   node --experimental-strip-types scripts/qd-second-visit-walk.ts [baseUrl]
//
// Demo-only (refuses any non-.test account). Needs a Quality Day profile already defined — run `npm run walk:c3`
// first if it reports there is none.
//
// WHAT IT ASSERTS, in the order a member would hit it:
//   1. After logging ONE element and coming back, that element renders ALREADY TICKED. This is the seeding fix.
//      If this fails, the form is still arriving blank and the replace-on-write silently eats the earlier entry.
//   2. After ticking a SECOND element and coming back, BOTH are ticked. This is the bug as Jay described it.
//   3. The score survives too — it is part of the same seeded record and would fail the same way.
//
// Deliberately navigates AWAY and BACK between logs rather than reloading. A reload is not what a member does,
// and it would paper over a stale client-side router cache — a live suspect when this was written.

import { chromium, type Page } from 'playwright';

const base = (process.argv[2] ?? 'http://localhost:3100').replace(/\/$/, '');
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) { console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD.'); process.exit(2); }
if (!/\.test$/i.test(email)) { console.error(`Refusing: ${email} is not a demo (.test) account.`); process.exit(2); }

const fails: string[] = [];
const ok = (m: string) => console.log(`  ok   ${m}`);
const bad = (m: string) => { fails.push(m); console.log(`  FAIL ${m}`); };
/** Neither pass nor fail — a condition the fixture put us in, said out loud so a skipped check is never silent. */
const log = (m: string) => console.log(`  --   ${m}`);

/** The element labels currently rendered as ON. This is the whole measurement. */
async function tickedNow(page: Page): Promise<string[]> {
  return (await page.locator('.qd-el-btn.is-on').allTextContents()).map((s) => s.trim()).filter(Boolean);
}

async function openLog(page: Page, memberId: string): Promise<void> {
  // Away and back, like a member tapping through the grid — never a reload.
  await page.goto(`${base}/dashboard/${memberId}`, { waitUntil: 'domcontentloaded' });
  await page.goto(`${base}/quality-day/${memberId}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.qd-log, .card-subtitle').first().waitFor({ timeout: 20000 });
  // WAIT FOR HYDRATION BEFORE TOUCHING ANYTHING. A click on an un-hydrated button does nothing at all, and the
  // page then reports "Pick a score from 1 to 10" — which reads exactly like a broken feature. Prod hydrates
  // slower than local, so the first version of this walk passed locally and produced a false failure on prod.
  await page.waitForFunction(
    () => {
      const el = document.querySelector('.qd-score-btn');
      return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$'));
    },
    null,
    { timeout: 20000 },
  ).catch(() => {});
}

/** Each tap is ASSERTED to have registered before we rely on it — an unregistered tap is the failure mode above. */
async function submitLog(page: Page, score: number, element: string): Promise<void> {
  await page.locator('.qd-score-btn').filter({ hasText: new RegExp(`^${score}$`) }).first().click();
  const scoreOn = (await page.locator('.qd-score-btn.is-on').first().textContent().catch(() => null))?.trim();
  if (scoreOn !== String(score)) throw new Error(`score tap did not register (shows ${scoreOn ?? 'nothing'})`);
  // Tap only if it is not ALREADY on — these buttons toggle, so tapping a seeded element would turn it OFF and
  // quietly invert the thing this walk exists to measure.
  if (!(await tickedNow(page)).includes(element)) {
    await page.locator('.qd-el-btn').filter({ hasText: element }).first().click();
    if (!(await tickedNow(page)).includes(element)) throw new Error(`element tap did not register for "${element}"`);
  }
  await page.getByRole('button', { name: /^log today$/i }).click();
  await page.locator('.momentum-log-done').waitFor({ timeout: 20000 });
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  console.log(`QUALITY DAY · SECOND VISIT — ${base}`);

  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
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
    .then(() => true).catch(() => false);
  if (!landed) { bad('login did not reach a dashboard'); await browser.close(); return finish(); }
  const memberId = page.url().match(/[0-9a-f-]{36}/)?.[0];
  if (!memberId) { bad('could not resolve the member id'); await browser.close(); return finish(); }
  ok('logged in as the demo member');

  await openLog(page, memberId);
  const elements = (await page.locator('.qd-el-btn').allTextContents()).map((s) => s.trim()).filter(Boolean);
  if (elements.length < 2) {
    bad(`need at least 2 Quality Day elements to test this, found ${elements.length} — run \`npm run walk:c3\` first`);
    await browser.close();
    return finish();
  }
  const [first, second] = elements;
  ok(`profile offers ${elements.length} elements`);

  // ---- Visit 1: log ONE element.
  await submitLog(page, 8, first);
  ok(`visit 1: logged score 8 + "${first}"`);

  // ---- Visit 2: does it come back seeded?
  await openLog(page, memberId);
  const afterFirst = await tickedNow(page);
  if (afterFirst.includes(first)) ok(`visit 2: "${first}" came back ALREADY TICKED — seeding works`);
  else bad(`visit 2: "${first}" came back UNTICKED (ticked: ${JSON.stringify(afterFirst)}) — the form is still arriving blank`);

  const scoreOn = await page.locator('.qd-score-btn.is-on').first().textContent().catch(() => null);
  if (scoreOn?.trim() === '8') ok('visit 2: the score came back seeded too');
  else bad(`visit 2: score came back as ${scoreOn?.trim() ?? 'nothing'}, expected 8`);

  // ---- Visit 2: add a SECOND element. This is Jay's exact sequence.
  await submitLog(page, 8, second);
  ok(`visit 2: added "${second}"`);

  // ---- Visit 3: THE ASSERTION. Both must survive.
  await openLog(page, memberId);
  const afterSecond = await tickedNow(page);
  const kept = [first, second].filter((e) => afterSecond.includes(e));
  if (kept.length === 2) ok(`visit 3: BOTH elements survived — ${JSON.stringify(afterSecond)}`);
  else bad(`visit 3: only ${kept.length}/2 survived — ticked now: ${JSON.stringify(afterSecond)}. THIS IS JAY'S BUG.`);

  // ---- A SECOND DAY. The other half of what Jay reported, and the half no test covered: every grid cell used to
  // link to the same dateless URL, so tapping yesterday wrote TODAY and yesterday stayed blank.
  const yesterday = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.goto(`${base}/quality-day/${memberId}?on=${yesterday}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.qd-log').waitFor({ timeout: 20000 });
  const dayName = (await page.locator('.qd-dayname').first().textContent().catch(() => ''))?.trim() ?? '';
  if (/yesterday/i.test(dayName)) ok(`yesterday: the form says "${dayName}"`);
  else bad(`yesterday: the day bar reads "${dayName}" — it should name yesterday`);
  const btn = (await page.getByRole('button', { name: /^log /i }).first().textContent().catch(() => ''))?.trim();
  if (btn && !/log today/i.test(btn)) ok(`yesterday: the button says "${btn}", not "Log today"`);
  else bad(`yesterday: the button still says "${btn}" — a member cannot tell which day they are writing`);

  await page.waitForFunction(() => {
    const el = document.querySelector('.qd-score-btn');
    return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$'));
  }, null, { timeout: 20000 }).catch(() => {});
  await page.locator('.qd-score-btn').filter({ hasText: /^4$/ }).first().click();
  if (!(await tickedNow(page)).includes(first)) await page.locator('.qd-el-btn').filter({ hasText: first }).first().click();
  await page.getByRole('button', { name: /^log /i }).first().click();
  await page.locator('.momentum-log-done').waitFor({ timeout: 20000 });
  ok('yesterday: logged score 4');

  // ---- THE ASSERTION THAT MATTERS: two days, two different scores, both standing.
  await page.goto(`${base}/quality-day/${memberId}?on=${yesterday}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.qd-log').waitFor({ timeout: 20000 });
  const yScore = (await page.locator('.qd-score-btn.is-on').first().textContent().catch(() => null))?.trim();
  await openLog(page, memberId);
  const tScore = (await page.locator('.qd-score-btn.is-on').first().textContent().catch(() => null))?.trim();
  if (yScore === '4' && tScore === '8') ok(`two days stand apart — yesterday ${yScore}, today ${tScore}`);
  else bad(`two days did NOT stand apart — yesterday ${yScore ?? 'nothing'}, today ${tScore ?? 'nothing'} (expected 4 and 8). Writing one day overwrote the other.`);

  // ---- AND THE SCORE REACHES THE GRID — the whole point of the redesign.
  await page.goto(`${base}/playbook/${memberId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  const scoreCells = (await page.locator('.wk-score').allTextContents()).map((s) => s.trim());
  // TODAY'S score must be on the grid — that is the change this walk exists to prove.
  if (scoreCells.includes('8')) ok(`the score reaches the grid — ${JSON.stringify(scoreCells)}`);
  else bad(`today's score is missing from the grid — found ${JSON.stringify(scoreCells)}, expected an 8`);
  // YESTERDAY'S only if yesterday is INSIDE the tracking week. A week that opened today legitimately has no
  // column for yesterday, and the first version of this check called that a product failure — it is the fixture.
  // The row is still written and still correct; the grid simply does not draw days before its own window.
  const dayHead = (await page.locator('.wk-day').first().textContent().catch(() => ''))?.trim() ?? '';
  const startedToday = /Day 1 of/i.test(dayHead);
  if (startedToday) log(`yesterday is before this week's window (${dayHead}) — not expecting a column for it`);
  else if (scoreCells.includes('4')) ok('and yesterday\'s back-filled score sits in its own column');
  else bad(`yesterday is inside the window (${dayHead}) but its score is missing — found ${JSON.stringify(scoreCells)}`);
  const dots = await page.locator('.wk-dot').count();
  if (dots > 0) ok(`elements render as ${dots} dots, not tappable boxes`);
  else bad('no .wk-dot found — the C3 grid is still drawing switch-like cells');

  await browser.close();
  finish();
}

function finish(): void {
  console.log('');
  if (fails.length) {
    console.log(`FAILED — ${fails.length} problem${fails.length === 1 ? '' : 's'}:`);
    for (const f of fails) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log('QUALITY DAY SECOND-VISIT WALK PASSED');
}

main().catch((e) => { console.error(e); process.exit(1); });
