// CONTRAST SCAN — "is any text on the operator surface too faint to read?"
//
// WHY THIS EXISTS. The console's dark theme repainted text colours globally while individual components kept
// their own hardcoded LIGHT backgrounds. The worst case reached prod: the draft message Jay is about to send
// in his own name rendered white-on-light-grey at about 1.1:1 — present, unreadable, and invisible to every
// check we had. Tests assert behaviour, the console walk asserts structure; neither can see "this is beige on
// beige". Jay caught it by eye, which is exactly the job I keep saying shouldn't be his.
//
// ALPHA IS THE WHOLE PROBLEM. The dark theme is built from translucent whites over charcoal
// (rgba(255,255,255,.03) cards, rgba(255,255,255,.58) labels). My first version of this scan read those as
// opaque white, reported a 1.00 ratio for every element on every page, and would have had me "fixing" a
// screen that was fine. It now composites the full ancestor chain — and `opacity`, which multiplies text
// against its ground and is how .trend-flat had become genuinely invisible.
//
// Usage:  ADMIN_PASSWORD=… node --experimental-strip-types scripts/contrast-scan.ts [baseUrl]
// Exits 1 if anything falls below the threshold, so it can gate a deploy if we ever want it to.

import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3100';
const PASSWORD = process.env.ADMIN_PASSWORD;
/** WCAG AA for normal text. Large/bold text is allowed 3:1, which is why findings are reported with their
 *  font size rather than just failed — the number is the input to a judgement, not the judgement. */
const AA_NORMAL = 4.5;

const ROUTES = [
  '/admin', '/admin/members', '/admin/attention', '/admin/activity',
  '/admin/review', '/admin/moderation', '/admin/health', '/admin/feedback',
];

type Finding = { ratio: number; size: number; weight: string; cls: string; tag: string; text: string };

function scan(): Finding[] {
  const parse = (c: string) => {
    const m = (c || '').match(/[\d.]+/g);
    if (!m) return null;
    return { r: +m[0]!, g: +m[1]!, b: +m[2]!, a: m[3] === undefined ? 1 : +m[3] };
  };
  type C = { r: number; g: number; b: number; a: number };
  const over = (f: C, g: C): C => ({
    r: f.r * f.a + g.r * (1 - f.a), g: f.g * f.a + g.g * (1 - f.a), b: f.b * f.a + g.b * (1 - f.a), a: 1,
  });
  const lum = (c: C) => {
    const t = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * t(c.r) + 0.7152 * t(c.g) + 0.0722 * t(c.b);
  };
  // Paint the ancestor backgrounds outermost-first, so a stack of translucent fills resolves to what the eye
  // actually sees rather than to the innermost declaration.
  const effBg = (el: Element): C => {
    const chain: C[] = [];
    for (let n: Element | null = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) chain.push(c);
    }
    let base: C = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = chain.length - 1; i >= 0; i--) base = over(chain[i]!, base);
    return base;
  };

  const out: Finding[] = [];
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    const text = (el.textContent || '').trim();
    if (!text || el.children.length > 0) continue; // leaf text only — a wrapper's text is its children's
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue; // not rendered
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    const fgRaw = parse(cs.color);
    if (!fgRaw || fgRaw.a === 0) continue;
    const op = parseFloat(cs.opacity);
    const bg = effBg(el);
    const fg = over({ ...fgRaw, a: fgRaw.a * (isNaN(op) ? 1 : op) }, bg);
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < 4.5) {
      out.push({
        ratio: +ratio.toFixed(2), size: parseFloat(cs.fontSize), weight: cs.fontWeight,
        cls: (el.className || '').toString().slice(0, 40), tag: el.tagName, text: text.slice(0, 40),
      });
    }
  }
  return out.sort((a, b) => a.ratio - b.ratio);
}

async function main() {
  if (!PASSWORD) { console.error('ADMIN_PASSWORD not set — source .env.local first.'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type=password]', PASSWORD);
  // WAIT FOR THE REDIRECT, don't just click. The login posts through a server action, so navigating straight
  // after the click races the session cookie and every later page silently 307s back to /admin/login — which
  // looks exactly like "no findings" rather than like "scanned nothing".
  await Promise.all([
    page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 20_000 }),
    page.click('button[type=submit]'),
  ]);

  // The member record is the densest page in the console — the telemetry panel, the Reclaim List in the
  // member's own words, the draft. It has no fixed URL, so it has to be discovered or it never gets scanned.
  await page.goto(`${BASE}/admin/members`, { waitUntil: 'networkidle' });
  const memberHref = await page.locator('a[href^="/admin/member/"]').first()
    .getAttribute('href').catch(() => null);
  const routes = memberHref ? [...ROUTES, memberHref] : ROUTES;
  if (!memberHref) console.log('(no member rows — the record page was NOT scanned)');

  let worst = 99;
  let total = 0;
  // ROLLED UP BY ELEMENT, because 37 findings are rarely 37 problems — they are usually one CSS rule seen
  // 37 times, and a per-route list makes you fix the same thing repeatedly without noticing.
  const byElement = new Map<string, { worst: number; size: number; count: number; example: string }>();

  console.log(`CONTRAST — ${BASE} (threshold ${AA_NORMAL}:1 for normal text)`);
  for (const route of routes) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    const bad = await page.evaluate(scan);
    total += bad.length;
    for (const f of bad) {
      const key = `${f.tag.toLowerCase()}${f.cls ? `.${f.cls.split(' ').join('.')}` : ''}`;
      const cur = byElement.get(key);
      if (!cur) byElement.set(key, { worst: f.ratio, size: f.size, count: 1, example: f.text });
      else { cur.count++; cur.worst = Math.min(cur.worst, f.ratio); }
    }
    if (bad.length) {
      // Say how many were withheld. A list that quietly stops at 8 reads as "that's all of them".
      console.log(`\n${route}  (${bad.length})`);
      for (const f of bad.slice(0, 6)) {
        // Large text (>=24px, or >=18.66px bold) only needs 3:1 — flag it differently rather than crying wolf.
        const large = f.size >= 24 || (f.size >= 18.66 && +f.weight >= 700);
        const mark = f.ratio < (large ? 3 : AA_NORMAL) ? '✖' : '·';
        console.log(`   ${mark} ${f.ratio}:1  ${Math.round(f.size)}px  ${f.tag}.${f.cls}  → ${JSON.stringify(f.text)}`);
      }
      if (bad.length > 6) console.log(`   … and ${bad.length - 6} more on this page (all counted in the rollup)`);
      worst = Math.min(worst, bad[0]!.ratio);
    }
  }
  await browser.close();

  console.log(`\nBY ELEMENT — ${byElement.size} distinct rules behind ${total} findings`);
  for (const [k, v] of [...byElement.entries()].sort((a, b) => a[1].worst - b[1].worst)) {
    console.log(`   ${String(v.worst).padStart(5)}:1  ${String(Math.round(v.size)).padStart(2)}px  ×${String(v.count).padStart(3)}  ${k}  → ${JSON.stringify(v.example.slice(0, 34))}`);
  }
  console.log(`\n${total} below ${AA_NORMAL}:1 · worst ${worst === 99 ? 'n/a' : `${worst}:1`}`);
  // Below 3:1 is the "can't read it" band and is treated as a failure; 3–4.5 is reported for judgement.
  process.exit(worst < 3 ? 1 : 0);
}

void main();
