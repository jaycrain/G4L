// B2 MAP WALK — the self-management read, on a real page.
//
// What this catches that the unit tests cannot: whether the map RENDERS for a member who has completed B2, whether
// the lead line names the thin family on screen, and — the one that matters most — whether any number leaked into
// the DOM. skills-map.ts is tested to emit none; a template can still print one.
//
// Demo-only. Reads SMOKE_EMAIL / SMOKE_PASSWORD from env; never prints them.

import { chromium } from 'playwright';

const base = process.argv[2]?.replace(/\/$/, '') ?? 'http://localhost:3100';
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) { console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD.'); process.exit(2); }
if (!/\.test$/i.test(email)) { console.error(`Refusing: ${email} is not a demo (.test) account.`); process.exit(2); }

const fails: string[] = [];
const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => { fails.push(m); console.log(`  ✗ ${m}`); };

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  console.log(`B2 MAP WALK — ${base}`);

  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const el = document.querySelector('button[type="submit"]');
    return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$'));
  }, null, { timeout: 15000 });
  await page.fill('#email', email!);
  await page.fill('#password', password!);
  await page.click('button[type="submit"]');
  const landed = await page.waitForFunction(() => location.pathname.startsWith('/dashboard/'), null, { timeout: 20000 })
    .then(() => true).catch(() => false);
  if (!landed) { bad('login did not reach a dashboard'); await browser.close(); return finish(); }
  const memberId = page.url().match(/[0-9a-f-]{36}/)?.[0]!;
  ok('logged in as the demo member');

  const seed = await page.request.post(`${base}/dev/seed-b2`);
  if (seed.ok()) ok('seeded a B2 reading with an uneven family spread');
  else if (seed.status() === 404) console.log('  · no seed (dev-only route) — expected against prod');
  else { bad(`could not seed B2 (${seed.status()})`); await browser.close(); return finish(); }

  await page.goto(`${base}/playbook/${memberId}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.pb-tab').filter({ hasText: "What you've learned" }).first().click();
  const map = page.locator('.pb-map');
  const shown = await map.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
  if (!shown) {
    // DISTINGUISH "no reading" FROM "broken". The map renders only for a member who has completed B2, and against
    // prod there is no seed route (correctly — it is dev-only). Reporting that as a failure is a FALSE RED, and a
    // walk that cries wolf on every prod run is one whose reds stop being read. Say what is actually true.
    const hasMapCard = await page.locator('.pb-read', { hasText: 'your map' }).count();
    if (!hasMapCard) {
      console.log('  · this member has no B2 reading, so there is no map to render — NOT VERIFIED here.');
      console.log('    Against prod that is expected: /dev/seed-b2 is dev-only. To verify on prod, walk an account');
      console.log('    that has actually completed Strengths & Weaknesses.');
      await browser.close();
      return finish();
    }
    bad('the member HAS a "your map" read but the map did not render — this is a real break');
    await browser.close();
    return finish();
  }
  ok('the map renders in "What you\'ve learned"');

  const fams = await page.locator('.pb-map-fam-n').allInnerTexts();
  if (fams.join('|') === 'Predisposing|Enabling|Reinforcing') ok(`three families, in Greg's order — ${fams.join(' → ')}`);
  else bad(`families wrong or out of order: ${JSON.stringify(fams)}`);

  // THIS USED TO ASSERT "no digit anywhere in the map", and that decision was REVERSED on 2026-08-26. Greg had
  // asked twice for the member to see their profile; Jay ruled the no-numbers rule was being applied too widely
  // ("on a macro level we don't do it. On a micro level, I think it's ok to pick our spots. This is one").
  //
  // Inverted rather than deleted, so what replaced it is pinned: the ROWS stay wordless — steady / worth
  // practicing, no per-skill figure — and the numbers live only in the profile block above them. A percentage
  // beside an individual skill is the report card we still do not want.
  const rowsText = (await map.innerText().catch(() => '')) || '';
  const rowDigits = rowsText.match(/\d/g);
  if (!rowDigits) ok('the twelve rows carry no number — steady / worth practicing only');
  else bad(`a number leaked into the skill rows: ${rowsText.match(/.{0,40}\d.{0,40}/)?.[0]}`);

  const prof = page.locator('.pb-profile'); // sibling of .pb-map, not a child — it sits ABOVE the rows
  if (await prof.count()) {
    const t = (await prof.innerText()).replace(/\s+/g, ' ');
    const pcts = t.match(/\d+%/g) ?? [];
    // COUNT IS NOT ENOUGH, and this walk proved it: the first version asserted "at least five figures" and
    // passed while printing 125%. A percentage is only meaningful if it is one.
    const nums = pcts.map((x) => parseInt(x, 10));
    const impossible = nums.filter((n) => n < 0 || n > 100);
    if (pcts.length >= 5) ok(`the profile shows the three categories + the domain split — ${pcts.join(' ')}`);
    else bad(`the profile is missing figures (saw ${pcts.length}): ${t.slice(0, 90)}`);
    if (!impossible.length) ok('every figure is a real percentage');
    else bad(`IMPOSSIBLE PERCENTAGE on the member's profile: ${impossible.join(', ')}`);
    if (/against its own maximum/i.test(t)) ok('and it says what the numbers are measured against');
    else bad('the profile prints figures with nothing to read them against');
  } else bad('the profile block did not render');

  const b2 = page.locator('.pb-read').filter({ has: page.locator('.pb-map') });
  const lead = await b2.locator('.pb-read-line').first().innerText();
  if (/reinforcing/i.test(lead)) ok(`the lead names the thin family — "${lead.slice(0, 96)}…"`);
  else bad(`the lead should name Reinforcing as thinnest — got: ${lead}`);
  if (!/not a (score|grade|test|verdict)|no wrong answers/i.test(lead)) ok('the lead declares rather than disclaims');
  else bad(`the lead still reassures: ${lead}`);

  const split = await page.locator('.pb-map-split').allInnerTexts();
  if (split.length === 1 && /movement more than eating/.test(split[0]!)) ok(`exactly one domain split, where it is real — "${split[0]!.trim()}"`);
  else bad(`expected one movement/eating split, got ${split.length}: ${JSON.stringify(split)}`);

  // NOTHING IS HIDDEN (Jay, 2026-08-26: "display all the rows"). This used to assert the OPPOSITE — that a
  // six-skill family collapsed its tail behind a labelled disclosure. Inverted rather than deleted, so the
  // control cannot quietly come back: twelve rows, all visible, no <details> anywhere in the map.
  const hidden = await page.locator('.pb-map details').count();
  if (hidden === 0) ok('nothing in the map is behind a disclosure');
  else bad(`${hidden} part(s) of the map are still collapsed`);
  const rowCount = await page.locator('.pb-map-row').count();
  if (rowCount === 12) ok('all twelve skills render');
  else bad(`expected twelve skill rows, saw ${rowCount}`);

  await page.screenshot({ path: 'docs/screenshots/b2-map.png', fullPage: false });
  ok('screenshot → docs/screenshots/b2-map.png');
  await browser.close();
  finish();
}

function finish() {
  console.log(fails.length ? `\n${fails.length} FAILED\n` : '\nall good\n');
  process.exit(fails.length ? 1 : 0);
}

void main();
