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
  if (!shown) { bad('the map never rendered'); await browser.close(); return finish(); }
  ok('the map renders in "What you\'ve learned"');

  const fams = await page.locator('.pb-map-fam-n').allInnerTexts();
  if (fams.join('|') === 'Getting ready|Taking action|Staying with it') ok(`three families, in Greg's order — ${fams.join(' → ')}`);
  else bad(`families wrong or out of order: ${JSON.stringify(fams)}`);

  // THE ONE THAT MATTERS. A number on this surface turns a development map into a report card.
  const mapText = await map.innerText();
  const digits = mapText.match(/\d/g);
  if (!digits) ok('no digit anywhere in the map');
  else if (mapText.match(/Show the other \d/)) {
    const withoutControl = mapText.replace(/Show the other \d/g, '');
    if (!/\d/.test(withoutControl)) ok('the only digit is the disclosure count ("Show the other 3")');
    else bad(`a number leaked into the map: ${withoutControl.match(/.{0,40}\d.{0,40}/)?.[0]}`);
  } else bad(`a number leaked into the map: ${mapText.match(/.{0,40}\d.{0,40}/)?.[0]}`);

  const b2 = page.locator('.pb-read').filter({ has: page.locator('.pb-map') });
  const lead = await b2.locator('.pb-read-line').first().innerText();
  if (/staying with it/i.test(lead)) ok(`the lead names the thin family — "${lead.slice(0, 96)}…"`);
  else bad(`the lead should name Staying with it as thinnest — got: ${lead}`);
  if (!/not a (score|grade|test|verdict)|no wrong answers/i.test(lead)) ok('the lead declares rather than disclaims');
  else bad(`the lead still reassures: ${lead}`);

  const split = await page.locator('.pb-map-split').allInnerTexts();
  if (split.length === 1 && /movement more than eating/.test(split[0]!)) ok(`exactly one domain split, where it is real — "${split[0]!.trim()}"`);
  else bad(`expected one movement/eating split, got ${split.length}: ${JSON.stringify(split)}`);

  const more = page.locator('.pb-map-more > summary');
  if (await more.count()) {
    const t = (await more.first().innerText()).replace(/\s+/g, ' ');
    if (/making a plan|finding good information|practical know-how/i.test(t)) ok(`the disclosure names what is behind it — "${t.slice(0, 78)}…"`);
    else bad(`the disclosure is unlabelled: ${t}`);
  } else bad('Taking action has six skills — it should collapse the tail');

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
