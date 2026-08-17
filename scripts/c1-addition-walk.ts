// C1 ADDITION WALK — can a member get a NEW goal onto their Reclaim List?
//
// Greg's C1 question 5, "which new priorities have emerged?", had no home: the refinement could re-rank and
// re-word what was already there but could not admit a goal that was not. The store path is unit-tested against
// pglite; what THAT cannot prove is whether the model actually offers the addition when a member names one, and
// whether it survives the propose→confirm gate to reach the list.
//
// Demo-only. Reads SMOKE_EMAIL / SMOKE_PASSWORD from env; never prints them.

import { chromium, type Page } from 'playwright';

const base = process.argv[2]?.replace(/\/$/, '') ?? 'http://localhost:3100';
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) { console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD.'); process.exit(2); }
if (!/\.test$/i.test(email)) { console.error(`Refusing: ${email} is not a demo (.test) account.`); process.exit(2); }

const NEW_GOAL = 'Get back on the water';
const fails: string[] = [];
const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => { fails.push(m); console.log(`  ✗ ${m}`); };
const finish = () => { console.log(fails.length ? `\n${fails.length} FAILED\n` : '\nall good\n'); process.exit(fails.length ? 1 : 0); };

// SILENTLY SKIPPING IS HOW SEVEN TURNS BECAME ZERO. The first version returned when the textarea was not yet
// enabled — which it is not while a turn is in flight — so every scripted line was dropped into nothing and the
// walk reported "the goal never appeared" about a conversation that had never started. Wait for the box, and say
// so when it never comes.
async function say(page: Page, text: string): Promise<boolean> {
  const box = page.locator('.chat-input textarea');
  const ready = await box.waitFor({ state: 'visible', timeout: 30000 })
    .then(() => page.waitForFunction(() => {
      const t = document.querySelector('.chat-input textarea') as HTMLTextAreaElement | null;
      return !!t && !t.disabled;
    }, null, { timeout: 60000 }))
    .then(() => true).catch(() => false);
  if (!ready) { console.log('      (input never became ready — skipping the rest)'); return false; }
  await box.fill(text);
  await page.locator('.chat-input button[type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector('.typing'), null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(300);
  return true;
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  console.log(`C1 ADDITION WALK — ${base}`);

  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const el = document.querySelector('button[type="submit"]');
    return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$'));
  }, null, { timeout: 15000 });
  await page.fill('#email', email!);
  await page.fill('#password', password!);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname.startsWith('/dashboard/'), null, { timeout: 20000 });
  const memberId = page.url().match(/[0-9a-f-]{36}/)?.[0]!;
  ok('logged in as the demo member');

  const reset = await page.request.post(`${base}/dev/reset-session?session=c1`);
  if (reset.ok()) ok('reset C1 to a clean start');
  else if (reset.status() === 404) console.log('  · no reset (dev-only route) — expected against prod');
  else bad(`could not reset C1 (${reset.status()})`);

  // The list BEFORE, so "it arrived" is a comparison rather than an assumption.
  await page.goto(`${base}/reclaim-list/${memberId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const before = await page.locator('body').innerText();
  if (before.includes(NEW_GOAL)) { bad(`"${NEW_GOAL}" is ALREADY on the list — the walk cannot prove an addition`); await browser.close(); return finish(); }
  ok(`"${NEW_GOAL}" is not on the list yet`);

  await page.goto(`${base}/workspace/${memberId}/c1`, { waitUntil: 'domcontentloaded' });
  // Wait for the OPENING TURN, not the container. `.chat` renders empty before the arc has said anything.
  const opened = await page.locator('.bubble.agent').first()
    .waitFor({ state: 'visible', timeout: 60000 }).then(() => true).catch(() => false);
  if (!opened) { bad('C1 never produced an opening turn — the arc did not start'); await browser.close(); return finish(); }
  ok('C1 opened');

  // Walk the refinement, then NAME SOMETHING NEW and confirm.
  // DRIVE TO THE PROPOSAL, don't guess a script length. C1 is a long coached walk — re-read, reflect, re-word,
  // tier, name the top three — and a fixed seven lines ran out before it ever reached record_refinement. The
  // opening lines carry the new goal; after that, keep answering until the confirm gate actually appears.
  const opening = [
    'That one still matters most to me.',
    'The others feel less urgent now.',
    `Actually there's something new — I want to ${NEW_GOAL.toLowerCase()}. It came up thinking about the summers.`,
  ];
  // SUBSTANTIVE ANSWERS, NOT AFFIRMATIVES. C1 coaches with specific asks — "The item that matters most to me is
  // ___" — and a driver that replies "That's right" to a fill-in-the-blank stalls forever while the Companion
  // patiently waits. That is the Companion behaving correctly and the robot behaving badly. Answer with real
  // content drawn from the member's actual list.
  const AFFIRM = [
    'Get back on the bike on weekends matters most to me.',
    `${NEW_GOAL} belongs near the top too.`,
    'Sleep well is important but not first.',
    'Reconnect with Dana is important but not first.',
    'Climb feels no longer central for now.',
    `The three I would move on next: get back on the bike on weekends, ${NEW_GOAL.toLowerCase()}, and sleep well.`,
    'That captures it — go ahead.',
  ];
  const PROPOSAL = /save this as your Reclaim List|Here's your list, refined/i;

  let turns = 0;
  for (const line of opening) { if (!(await say(page, line))) break; turns++; }
  while (turns < 26) {
    const thread = await page.locator('.chat').innerText();
    if (PROPOSAL.test(thread)) { console.log(`  · the proposal arrived after ${turns} turns`); break; }
    if (!(await say(page, AFFIRM[turns % AFFIRM.length]!))) break;
    turns++;
  }
  // Confirm it — the gate never closes on a non-confirm, so this has to be an unambiguous yes.
  if (PROPOSAL.test(await page.locator('.chat').innerText())) {
    await say(page, 'Yes — save it as my Reclaim List.');
    ok('confirmed the proposal at the gate');
  } else {
    bad(`the proposal never appeared after ${turns} turns — the refinement did not settle`);
    const turnsText = await page.locator('.bubble').allInnerTexts();
    console.log(`      ${turnsText.length} bubbles. Last two agent turns:`);
    for (const t of turnsText.slice(-3)) console.log(`      · ${t.replace(/\s+/g, ' ').slice(0, 220)}`);
  }

  const thread = await page.locator('.chat').innerText();
  if (new RegExp(NEW_GOAL, 'i').test(thread)) ok('the Companion carried the new goal into the conversation');
  else {
    bad('the new goal never appeared in the thread');
    // LEAVE EVIDENCE. A conversation that stalled and a conversation that ignored the addition look identical
    // from an assertion; the thread tail tells them apart in one glance.
    await page.screenshot({ path: 'docs/screenshots/c1-STUCK.png', fullPage: false });
    const turns = await page.locator('.bubble').allInnerTexts();
    console.log(`      ${turns.length} turns. Last three:`);
    for (const t of turns.slice(-3)) console.log(`      · ${t.replace(/\s+/g, ' ').slice(0, 150)}`);
  }
  if (/\(new\)/.test(thread)) ok('the proposal marked it (new) — the member saw what they were confirming');
  else {
    console.log('  · the proposal did not render a (new) marker');
    const m = thread.match(/Here's your list, refined[\s\S]{0,700}/);
    if (m) console.log('      PROPOSAL AS SHOWN:\n' + m[0].split('\n').map((l) => '      ' + l).join('\n'));
  }

  await page.goto(`${base}/reclaim-list/${memberId}`, { waitUntil: 'domcontentloaded' });
  const landed = await page.getByText(NEW_GOAL, { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
  if (landed) ok(`"${NEW_GOAL}" is on the Reclaim List — C1 can admit a new priority`);
  else bad(`"${NEW_GOAL}" never reached the list`);

  await page.screenshot({ path: 'docs/screenshots/c1-addition.png', fullPage: false });
  ok('screenshot → docs/screenshots/c1-addition.png');
  await browser.close();
  finish();
}

void main();
