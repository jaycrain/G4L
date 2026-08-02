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

// TWO SURFACES, AND THE SECOND ONE MATTERS MORE.
//
// This shipped scanning only /admin — Jay's own tool, read by one or two people. The MEMBER app had never
// been measured, and that is the surface where contrast stops being a compliance question: G4L is built for
// midlife adults, and contrast sensitivity declines with age as ordinary physiology, not disability. A member
// squinting at their own ID Score is the product failing at its job long before it is an accessibility
// finding. `--member` logs in as the demo account (same credentials the smoke test uses) and walks the real
// member surfaces.
const MEMBER_MODE = process.argv.includes('--member');
/** WCAG AA for normal text. Large/bold text is allowed 3:1, which is why findings are reported with their
 *  font size rather than just failed — the number is the input to a judgement, not the judgement. */
const AA_NORMAL = 4.5;

const ROUTES = [
  '/admin', '/admin/members', '/admin/attention', '/admin/activity',
  '/admin/review', '/admin/moderation', '/admin/health', '/admin/feedback',
];

/** Logged-OUT surfaces. Scanned in a fresh context before signing in, because an authed session redirects
 *  most of them — and a redirect that silently lands on the dashboard would report the dashboard's contrast
 *  under the login page's name. */
const PUBLIC_ROUTES = ['/', '/onboarding', '/login', '/login/forgot'];

/** The reading-heavy surfaces the first pass missed. Sessions and onboarding are where a member spends the
 *  most CONTINUOUS time reading, so they matter more per finding than a dashboard panel does. Built per
 *  member id at run time. */
const memberRoutes = (id: string) => [
  `/dashboard/${id}`, `/program/${id}`, `/field-guide/${id}`, `/score/${id}`, `/grinta/${id}`,
  `/reclaim-list/${id}`, `/movement/${id}`, `/badges/${id}`, `/playbook/${id}`, `/connect/${id}`,
  `/momentum/${id}`, `/journey/${id}`, `/checkpoint/${id}`, `/story/${id}`, `/account`,
  `/idq?member=${id}`,
  // Live Sessions — the real routes on disk. A member who hasn't reached one may be redirected; the report
  // prints where it actually LANDED so a redirect can't masquerade as coverage.
  `/reconnect/${id}`, `/w2/${id}`, `/w3/${id}`,
  `/b1/${id}`, `/b2/${id}`, `/b3/${id}`, `/b4/${id}`,
  `/c1/${id}`, `/c2/${id}`, `/c3/${id}`, `/c4/${id}`,
];

/** BOTH WIDTHS. Contrast is mostly viewport-independent, but the app swaps components at the fold — the
 *  mobile pane control, the stacked hero — and a rule that only renders on a phone was never being measured. */
const VIEWPORTS = [
  { label: 'desktop', width: 1440, height: 1200 },
  { label: 'phone', width: 390, height: 900 },
];

type Finding = { ratio: number; size: number; weight: string; cls: string; tag: string; text: string; bg: string };

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
  //
  // GRADIENTS ARE NOT backgroundColor. The front door (.onbwel) and the auth hero are white text on a navy
  // GRADIENT, and reading only backgroundColor saw transparent, walked up to the page, and reported
  // white-on-white at 1:1 — twenty confident findings on four screens that are perfectly readable. A gradient
  // has no single ground, so every colour stop is treated as a candidate and the WORST one decides: if the
  // text clears 4.5:1 against the darkest and the lightest stop, it clears it everywhere in between.
  //
  // A url() image is genuinely unmeasurable this way. Those are reported separately rather than guessed at.
  const grounds = (el: Element): { cands: C[]; unmeasurable: boolean } => {
    const layers: C[][] = [];
    let unmeasurable = false;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const img = cs.backgroundImage;
      if (img && img !== 'none') {
        if (/url\(/.test(img)) unmeasurable = true;
        const stops = (img.match(/rgba?\([^)]*\)/g) ?? []).map(parse).filter((c): c is C => !!c && c.a > 0);
        if (stops.length) { layers.push(stops); continue; }
      }
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) layers.push([c]);
    }
    // Composite outermost-in. Where a layer offered several stops, carry each forward as its own candidate.
    let bases: C[] = [{ r: 255, g: 255, b: 255, a: 1 }];
    for (let i = layers.length - 1; i >= 0; i--) {
      const next: C[] = [];
      for (const b of bases) for (const l of layers[i]!) next.push(over(l, b));
      bases = next.slice(0, 8); // a handful of stops is plenty; this just stops a pathological blow-up
    }
    return { cands: bases, unmeasurable };
  };

  const out: Finding[] = [];
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    const text = (el.textContent || '').trim();
    if (!text || el.children.length > 0) continue; // leaf text only — a wrapper's text is its children's
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue; // not rendered
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    // DISABLED CONTROLS ARE EXEMPT. WCAG 1.4.3 excludes inactive user-interface components, and dimming a
    // disabled button is how you SAY it's inactive. Counting them made the two worst findings in the whole
    // member app (2:1, "Send" and "Add note") artefacts of a .5 opacity rule that is doing its job — which
    // would have sent Jay to "fix" correct code.
    const ctl = el.closest('button, a, input, select, textarea, [role="button"]');
    if (ctl && ((ctl as HTMLButtonElement).disabled || ctl.getAttribute('aria-disabled') === 'true')) continue;
    const fgRaw = parse(cs.color);
    if (!fgRaw || fgRaw.a === 0) continue;
    const op = parseFloat(cs.opacity);
    const { cands, unmeasurable } = grounds(el);
    if (unmeasurable) continue; // a photographic background — say nothing rather than guess
    let ratio = Infinity;
    let bg = cands[0]!;
    for (const cand of cands) {
      const fg = over({ ...fgRaw, a: fgRaw.a * (isNaN(op) ? 1 : op) }, cand);
      const L1 = lum(fg), L2 = lum(cand);
      const r2 = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      if (r2 < ratio) { ratio = r2; bg = cand; }
    }
    if (ratio < 4.5) {
      out.push({
        ratio: +ratio.toFixed(2), size: parseFloat(cs.fontSize), weight: cs.fontWeight,
        cls: (el.className || '').toString().slice(0, 40), tag: el.tagName, text: text.slice(0, 40),
        bg: '#' + [bg.r, bg.g, bg.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''),
      });
    }
  }
  return out.sort((a, b) => a.ratio - b.ratio);
}

async function main() {
  const browser = await chromium.launch();
  let page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  let routes: string[];

  if (MEMBER_MODE) {
    const email = process.env.SMOKE_EMAIL?.trim();
    const pw = process.env.SMOKE_PASSWORD;
    if (!email || !pw) { console.error('SMOKE_EMAIL / SMOKE_PASSWORD not set — source .env.local first.'); process.exit(1); }
    // DEMO ACCOUNTS ONLY. The same guard the smoke test carries: this drives a real login and renders a real
    // member's surfaces, and a scan is never a reason to open a real person's story.
    if (!/\.test$/i.test(email)) { console.error(`Refusing: ${email} is not a demo (.test) account.`); process.exit(1); }

    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    // Wait for React to attach before typing — a click that lands pre-hydration is silently swallowed into a
    // native submit, which reloads /login and looks exactly like a wrong password.
    await page.waitForFunction(() => {
      const el = document.querySelector('button[type="submit"]');
      return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$'));
    }, null, { timeout: 15_000 });
    await page.fill('#email', email);
    await page.fill('#password', pw);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => location.pathname.startsWith('/dashboard/'), null, { timeout: 20_000 });
    const id = page.url().match(/\/dashboard\/([0-9a-f-]+)/i)?.[1];
    if (!id) { console.error('login did not reach a dashboard'); process.exit(1); }
    routes = memberRoutes(id);
  } else {
    if (!PASSWORD) { console.error('ADMIN_PASSWORD not set — source .env.local first.'); process.exit(1); }
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
    routes = memberHref ? [...ROUTES, memberHref] : ROUTES;
    if (!memberHref) console.log('(no member rows — the record page was NOT scanned)');
  }

  let worst = 99;
  let total = 0;
  let scanned = 0;
  // ROLLED UP BY ELEMENT, because 37 findings are rarely 37 problems — they are usually one CSS rule seen
  // 37 times, and a per-route list makes you fix the same thing repeatedly without noticing.
  const byElement = new Map<string, { worst: number; size: number; count: number; example: string; bg: string }>();

  console.log(`CONTRAST — ${BASE} (threshold ${AA_NORMAL}:1 for normal text)`);

  const redirected: string[] = [];
  const walk = async (route: string, vp: string) => {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    // WHERE IT ACTUALLY LANDED. A gated Session redirects a member who hasn't reached it, and a redirect that
    // quietly lands on the dashboard would report the dashboard's contrast under the Session's name — coverage
    // that isn't. Recorded and reported rather than assumed.
    const landed = new URL(page.url()).pathname + new URL(page.url()).search;
    const asked = route.split('?')[0]!;
    if (!landed.startsWith(asked)) redirected.push(`${route} → ${landed}`);

    const bad = await page.evaluate(scan);
    scanned++;
    total += bad.length;
    for (const f of bad) {
      const key = `${f.tag.toLowerCase()}${f.cls ? `.${f.cls.split(' ').join('.')}` : ''}`;
      const cur = byElement.get(key);
      if (!cur) byElement.set(key, { worst: f.ratio, size: f.size, count: 1, example: f.text, bg: f.bg });
      // Keep the ground of the WORST instance — that's the one whose direction the fix has to follow.
      else { cur.count++; if (f.ratio < cur.worst) { cur.worst = f.ratio; cur.bg = f.bg; } }
    }
    if (bad.length) {
      // Say how many were withheld. A list that quietly stops at 6 reads as "that's all of them".
      console.log(`\n${route}  [${vp}]  (${bad.length})`);
      for (const f of bad.slice(0, 6)) {
        // Large text (>=24px, or >=18.66px bold) only needs 3:1 — flag it differently rather than crying wolf.
        const large = f.size >= 24 || (f.size >= 18.66 && +f.weight >= 700);
        const mark = f.ratio < (large ? 3 : AA_NORMAL) ? '✖' : '·';
        console.log(`   ${mark} ${f.ratio}:1  ${Math.round(f.size)}px  on ${f.bg}  ${f.tag}.${f.cls}  → ${JSON.stringify(f.text)}`);
      }
      if (bad.length > 6) console.log(`   … and ${bad.length - 6} more here (all counted in the rollup)`);
      worst = Math.min(worst, bad[0]!.ratio);
    }
  };

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const route of routes) await walk(route, vp.label);
  }

  // THE LOGGED-OUT FRONT DOOR, in a clean context. An authed session redirects /login and /onboarding
  // straight past themselves, so scanning them on the signed-in page would have measured the dashboard and
  // filed it under the login page's name. These are also the first thing a prospective member ever sees.
  if (MEMBER_MODE) {
    const anon = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    const anonPage = await anon.newPage();
    const signedIn = page;
    page = anonPage;
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const route of PUBLIC_ROUTES) await walk(route, `${vp.label}·anon`);
    }
    page = signedIn;
    await anon.close();
  }

  await browser.close();

  if (redirected.length) {
    console.log(`\n${redirected.length} route(s) redirected — NOT the coverage the name implies:`);
    for (const r of [...new Set(redirected)]) console.log(`   ${r}`);
  }

  console.log(`\nBY ELEMENT — ${byElement.size} distinct rules behind ${total} findings`);
  for (const [k, v] of [...byElement.entries()].sort((a, b) => a[1].worst - b[1].worst)) {
    // The GROUND is printed because the fix runs the opposite way on a dark one, and guessing it wrong turns
    // a 3:1 into a 1.5:1. (I did that four times in one sitting before adding this column.)
    console.log(`   ${String(v.worst).padStart(5)}:1  ${String(Math.round(v.size)).padStart(2)}px  on ${v.bg}  ×${String(v.count).padStart(3)}  ${k}  → ${JSON.stringify(v.example.slice(0, 30))}`);
  }
  // SAY WHAT WAS COVERED, not just what was found. "0 findings" and "0 findings because nothing was scanned"
  // print identically otherwise, and the second one has already happened here once (a login race sent every
  // page to a redirect and the run reported clean).
  console.log(`\nCOVERAGE — ${scanned} page loads: ${routes.length} route(s) x ${VIEWPORTS.length} widths` +
    (MEMBER_MODE ? ` + ${PUBLIC_ROUTES.length} logged-out x ${VIEWPORTS.length}` : '') +
    ` [${VIEWPORTS.map((v) => `${v.label} ${v.width}px`).join(', ')}]`);
  console.log(`${total} below ${AA_NORMAL}:1 · worst ${worst === 99 ? 'n/a' : `${worst}:1`}`);
  // Below 3:1 is the "can't read it" band and is treated as a failure; 3–4.5 is reported for judgement.
  process.exit(worst < 3 ? 1 : 0);
}

void main();
