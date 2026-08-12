// Can a member actually tick their W3 week — and does the grid refuse to eat what they wrote?
//
// W3's grid shipped as a mirror: the Companion wrote the day, the cells were disabled. Jay tapped those boxes three
// times across two days on his own account and nothing happened. Going back to Greg's W3 Engineering Memo,
// "the Companion writes it" was ours, not his — his UX requirements lead with "Quick check-in interface —
// low-friction daily entry", and he asks the Companion to support the habit "through anchoring, FRICTION REDUCTION,
// and streak reinforcement". A checkbox that refuses is friction with nothing on the other side of it.
//
//   node --experimental-strip-types scripts/w3-grid-walk.ts [baseUrl]
//
// Demo-only, like the other walks: reads SMOKE_EMAIL / SMOKE_PASSWORD and refuses any non-.test account.
// Re-runnable: it re-seeds the week through a dev-only route first (the dev server holds PGlite open, so a script
// that reaches into the data dir from outside corrupts it — see app/dev/seed-w3).
//
// WHAT THIS ASSERTS, AND WHY THOSE:
//   1. A cell is actually enabled. The old failure mode was a disabled button, and "element is not enabled" is what
//      a walk saw for months.
//   2. The tick SURVIVES A RELOAD. An optimistic tick that vanishes on refresh is the worse bug — a successful
//      write rendering as a failure teaches the member the tool cannot be trusted.
//   3. Ticking a SECOND trigger moves the record rather than adding one. Greg's `trigger_fired` is singular, so
//      two ticks in one day would be the lie.
//   4. **Un-ticking a day the member WROTE into is refused, out loud.** This is the one that matters. It is why the
//      grid was read-only in the first place, and a refusal that happens silently is indistinguishable from a bug.

import { chromium, type Page } from 'playwright';

const base = (process.argv[2] ?? 'http://localhost:3100').replace(/\/$/, '');
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) { console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD.'); process.exit(2); }
if (!/\.test$/i.test(email)) { console.error(`Refusing: ${email} is not a demo (.test) account.`); process.exit(2); }

const fails: string[] = [];
const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => { fails.push(m); console.log(`  ✗ ${m}`); };

/** The W3 grid, found by its row labels rather than by position — the Playbook renders several weeks. */
function w3Grid(page: Page) {
  return page.locator('.pb-week', { hasText: 'Noticing your days' }).locator('.wk-grid');
}
const cell = (page: Page, row: string, day: number) =>
  w3Grid(page).locator('tbody tr', { hasText: row }).locator('.wk-cell').nth(day);

const isOn = async (page: Page, row: string, day: number) =>
  (await cell(page, row, day).getAttribute('class'))?.includes(' on') ?? false;

async function openThisWeek(page: Page, memberId: string): Promise<void> {
  await page.goto(`${base}/playbook/${memberId}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.pb-tab', { hasText: /^This week$/ }).first().click();
  await w3Grid(page).waitFor({ state: 'visible', timeout: 15000 });
}

/** Tap a cell and wait for the server round-trip to settle (the panel carries .wk-saving while in flight). */
async function tap(page: Page, row: string, day: number): Promise<void> {
  await cell(page, row, day).click();
  await page.waitForFunction(() => !document.querySelector('.wk-saving'), undefined, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(400); // the refresh re-seeds from the server; let it land before reading
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  console.log(`W3 GRID WALK — ${base}`);

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
    .then(() => true)
    .catch(() => false);
  if (!landed) { bad('login did not reach a dashboard'); await browser.close(); return finish(); }
  const memberId = page.url().match(/[0-9a-f-]{36}/)?.[0];
  if (!memberId) { bad('could not resolve the member id'); await browser.close(); return finish(); }
  ok('logged in as the demo member');

  const seed = await page.request.post(`${base}/dev/seed-w3`);
  if (!seed.ok()) { bad(`could not seed a W3 week (${seed.status()})`); await browser.close(); return finish(); }
  ok('seeded a W3 week with two triggers and one written day');

  // ---- 1 · THE CELL IS ENABLED ---------------------------------------------------------------------------------
  await openThisWeek(page, memberId);
  const today = 2; // the seed opens the week two days ago, so today is column index 2
  const enabled = await cell(page, 'Noticed the day', today).isEnabled().catch(() => false);
  if (enabled) ok('the cell is tappable — not a disabled box');
  else { bad('the W3 cell is still disabled'); await browser.close(); return finish(); }

  // ---- 2 · THE TICK SURVIVES A RELOAD ---------------------------------------------------------------------------
  await tap(page, 'Noticed the day', today);
  if (await isOn(page, 'Noticed the day', today)) ok('the day ticks');
  else bad('the tick did not register');

  await openThisWeek(page, memberId);
  if (await isOn(page, 'Noticed the day', today)) ok('and it is still there after a reload — the write landed');
  else bad('the tick vanished on reload — a successful write rendering as a failure');

  // ---- 3 · A SECOND TRIGGER MOVES THE RECORD --------------------------------------------------------------------
  await tap(page, 'A brutal week', today);
  if (await isOn(page, 'A brutal week', today)) ok('a trigger records');
  else bad('the trigger did not record');

  await tap(page, 'Late nights', today);
  const moved = (await isOn(page, 'Late nights', today)) && !(await isOn(page, 'A brutal week', today));
  if (moved) ok('ticking a second trigger MOVES it — one trigger a day, as Greg specified');
  else bad('both triggers read as ticked — trigger_fired is singular, so one of them is a lie');

  await openThisWeek(page, memberId);
  const stuck = (await isOn(page, 'Late nights', today)) && !(await isOn(page, 'A brutal week', today));
  if (stuck) ok('and the move survives a reload');
  else bad('the move did not persist');

  // ---- 4 · A TICK NEVER EATS WHAT THEY WROTE --------------------------------------------------------------------
  // Day 0 carries a reflection (planted by the seed). Un-ticking it must refuse, and must SAY SO.
  if (!(await isOn(page, 'Noticed the day', 0))) {
    bad('the written day is not showing as logged — the walk cannot test the refusal');
  } else {
    await tap(page, 'Noticed the day', 0);
    const refusal = ((await w3Grid(page).locator('.wk-refusal').textContent().catch(() => '')) ?? '').trim();
    if (/wrote something/i.test(refusal)) ok(`the refusal is spoken: "${refusal}"`);
    else bad(`un-ticking a written day said nothing to the member (saw: "${refusal}")`);
    if (await isOn(page, 'Noticed the day', 0)) ok('and the day stays ticked — their words are safe');
    else bad('THE DAY WAS UN-TICKED — a checkbox just deleted something the member wrote');
  }

  await browser.close();
  finish();
}

function finish(): void {
  console.log('');
  if (fails.length) { console.log(`W3 GRID WALK FAILED — ${fails.length} problem(s)`); fails.forEach((f) => console.log(`  · ${f}`)); process.exit(1); }
  console.log('W3 GRID WALK PASSED — the week is tickable, and a tick cannot eat what they wrote.');
}

main().catch((e) => { console.error('walk crashed:', e); process.exit(1); });
