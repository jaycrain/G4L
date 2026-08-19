import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// THREE SWEEPS, each one a rule that kept being rediscovered per-component instead of held in one place.
// All of them are Jay's, 2026-08-12, from walking his own account.

// COMMENTS ARE STRIPPED BEFORE ANY ASSERTION RUNS.
//
// Four times in one night an assertion here matched the PROSE DESCRIBING a fix rather than the code doing it —
// the "never hardcode navy back into the global hover" check went red against a comment three thousand lines down
// that quotes the old rule to explain why it was replaced. A stylesheet that documents its own history will always
// contain the strings its guards are looking for. Anchoring each regex harder is a patch; reading only the code is
// the fix. Replaced with spaces, not removed, so any line/offset reported stays honest.
const CSS_RAW = readFileSync('app/globals.css', 'utf8');
const CSS = CSS_RAW.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walkFiles(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}
const SOURCES = [...walkFiles('app'), ...walkFiles('lib')];

// ── 1 · ONE NAME ────────────────────────────────────────────────────────────────────────────────────────────
//
// The same place was called three things on three screens: "Your Playbook" in the dashboard panel, "G4L Playbook"
// on the subpage hero, "The Playbook" on the back link out of a Revisit. Jay: "Make them all 'Your Playbook'."
// A member should not have to work out that those are the same room.

test('THE PLAYBOOK HAS ONE MEMBER-FACING NAME — "Your Playbook"', () => {
  const offenders: string[] = [];
  for (const f of SOURCES) {
    const src = readFileSync(f, 'utf8');
    for (const [i, line] of src.split('\n').entries()) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue; // prose in a comment may say "the Playbook" freely
      if (/G4L Playbook/.test(line)) offenders.push(`${f}:${i + 1} — ${line.trim().slice(0, 90)}`);
      // A back link or heading naming it "The Playbook" — the article is the tell, not the word.
      if (/["'>]\s*(←\s*)?The Playbook\s*["'<]/.test(line)) offenders.push(`${f}:${i + 1} — ${line.trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(offenders, [], `the Playbook is named something other than "Your Playbook":\n${offenders.join('\n')}`);
});

// ── 2 · THE HOVER BACKGROUND IS A VARIABLE ──────────────────────────────────────────────────────────────────
//
// `button:hover { background: var(--navy) }` painted a navy block behind any button with its own colouring, so
// dark text vanished under the cursor. It was patched four times with a central opt-out list whose own comment
// admitted the problem: a new button "only has to join this list rather than rediscover the bug". The list WAS
// the bug — the fix lived nowhere near the button. The default is now a variable each button can override in its
// own rule. See [[one-fact-many-sites]].

test('the global button hover reads a variable, so a button can override it where it is defined', () => {
  assert.match(CSS, /button,\s*\.btn\s*\{\s*--btn-hover-bg:/, 'the default is declared once');
  // THE LONGHAND IS LOAD-BEARING — a correctness rule, not a style preference.
  //
  // As the SHORTHAND `background: var(--btn-hover-bg)`, the default value `none` is VALID (it is a
  // background-image value) and the shorthand resets every background property — including background-color — to
  // `transparent`. So every teal-FILLED button whose fill was not re-declared on :hover went see-through against a
  // white page, at the exact moment the member moved to click it. Donna: "teal buttons turn white on hover,
  // causing them to visually disappear" (2026-08-19). The rule's own comment had asserted the opposite for weeks.
  //
  // `background-color: none` is genuinely invalid, so the browser drops the declaration and the button keeps its
  // own fill — which is what this rule always claimed to do. Measured in a live page, both directions: teal
  // rgb(59,148,149) survives the longhand and becomes rgba(0,0,0,0) under the shorthand.
  assert.match(
    CSS,
    /button:hover,\s*\.btn:hover\s*\{\s*background-color:\s*var\(--btn-hover-bg\)/,
    'the hover reads it via the LONGHAND — the shorthand wipes the fill to transparent',
  );
  assert.doesNotMatch(
    CSS,
    /button:hover,\s*\.btn:hover\s*\{\s*background:\s*var\(--btn-hover-bg\)/,
    'the shorthand is the disappearing-button bug — background-color, always',
  );
  assert.doesNotMatch(
    CSS,
    /button:hover,\s*\.btn:hover\s*\{\s*background(-color)?:\s*var\(--navy\)/,
    'never hardcode navy back into the global hover — that is the bug, four times over',
  );
});

// SUPERSEDED 2026-08-15. This used to assert that every dark-text chip DECLARES its own hover background — the
// right guard while the default was a navy fill, because each chip had to opt out of it by hand. It was the
// fourth patch of that shape, and Jay's Account Settings rows were the fifth site, waiting to be found.
//
// The default is no longer a colour. Hover now shifts a button relative to its OWN colour, so a chip that
// declares nothing is safe by construction. Keeping the old requirement would force every new button to perform
// a ritual that no longer protects anything — and rituals whose reason has gone are how a codebase gets heavy.
//
// The invariant below is what makes all of that true, so it is the one worth guarding.
test('the global hover CANNOT invert contrast — it shifts, it does not swap', () => {
  assert.match(
    CSS,
    /button:hover,\s*\.btn:hover\s*\{\s*filter:\s*brightness\(/,
    'hover must move the button relative to its own colour (filter), so text and ground move together',
  );
  // The failure mode this replaced: a fixed colour as the DEFAULT, which any dark-text button disappears under.
  const dflt = CSS.match(/button,\s*\.btn\s*\{\s*--btn-hover-bg:\s*([^;]+);/)?.[1]?.trim();
  assert.ok(dflt, 'the opt-in variable still has a declared default');
  assert.doesNotMatch(
    dflt!,
    /var\(--(navy|charcoal|indigo|teal|orange|olive|deep-red)\)|#[0-9a-f]{3,6}/i,
    `the default hover background must not be a colour — it was "${dflt}", and every button with dark text ` +
      'vanishes under it. A button that wants a colour swap opts in; the default stays inert.',
  );
});

// ── 3 · A NUMBER IN A FIXED BOX IS CENTRED ──────────────────────────────────────────────────────────────────
//
// A hard width/height square inherits the global button's inline-block + 0.7rem padding, which pushes the glyph
// off-centre — and off-centre differently for "1" than for "10". Jay: "center the numbers in the boxes (do a
// sweep on this, noticed somewhere else too)." This test IS the sweep, so it stays swept.

// A square that only OVERRIDES its size — a modifier class, or the same selector inside a media query — inherits
// centring from its base rule and must not restate it. The test cannot see that relationship, so it is written
// down here, with the base that does the centring. Adding to this list is fine; adding without a base that
// actually centres is not, and the second assertion below enforces exactly that.
const SIZE_ONLY_OVERRIDES: Record<string, string> = {
  '.avatar-lg': '.avatar-initials',
  '.avatar-sm': '.avatar-initials',
  '.wk-cell': '.wk-cell', // the base rule centres; the two media queries only shrink it
  '.wk-table-mini .wk-cell': '.wk-cell', // the read-only "first days" strip — smaller cells, same centred base
};

function centres(selector: string): boolean {
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1]!.trim().split('\n').pop()!.trim();
    if (sel !== selector) continue;
    if (/place-items|align-items|text-align|inline-grid|inline-flex|display:\s*(grid|flex)/.test(m[2]!)) return true;
  }
  return false;
}

test('every fixed-size square with text in it centres that text', () => {
  const missing: string[] = [];
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1]!.trim().split('\n').pop()!.trim();
    const body = m[2]!;
    const w = /(?<![-\w])width:\s*([\d.]+(?:px|rem))/.exec(body);
    const h = /(?<![-\w])height:\s*([\d.]+(?:px|rem))/.exec(body);
    if (!w || !h || w[1] !== h[1]) continue; // not a square
    if (!/font-size|font-weight|line-height/.test(body)) continue; // holds no text
    if (/place-items|align-items|text-align|inline-grid|inline-flex|display:\s*(grid|flex)/.test(body)) continue;
    if (sel in SIZE_ONLY_OVERRIDES) continue;
    missing.push(`${sel} (${w[1]})`);
  }
  assert.deepEqual(missing, [], `fixed-size boxes with text but no centring:\n${missing.join('\n')}`);
});

test('THE EXEMPTIONS ARE REAL — each one names a base rule that actually centres', () => {
  // Otherwise the allowlist becomes the place bugs go to be forgotten, which is the same failure as the button
  // hover opt-out list this file already replaced.
  for (const [sel, base] of Object.entries(SIZE_ONLY_OVERRIDES)) {
    assert.ok(centres(base), `${sel} is exempt because ${base} centres — but ${base} does not`);
  }
});

test('timezone detection is mounted GLOBALLY, not inside a dashboard branch', () => {
  // It shipped once mounted in app/dashboard/[memberId]/page.tsx, below the triptych's early return — dead code
  // for every member on prod. The feature looked shipped, the tests were green, and not one zone was ever
  // recorded. The dashboard has three render branches; anything that must run for every member belongs in the
  // one place they all pass through.
  const layout = readFileSync('app/layout.tsx', 'utf8');
  assert.match(layout, /<DetectZone\s*\/>/, 'DetectZone must be mounted in the root layout');

  const page = readFileSync('app/dashboard/[memberId]/page.tsx', 'utf8');
  assert.doesNotMatch(page, /DetectZone/, 'and NOT in the dashboard page, which returns early three ways');
});

test('the zone action takes no memberId — the session says who it is', () => {
  // A server action that accepted a memberId from the client would let anyone rewrite anyone else's dates.
  const actions = readFileSync('app/dashboard/zone-actions.ts', 'utf8');
  assert.match(actions, /export async function recordZone\(zone: string\)/, 'recordZone must not take a memberId');
});

test('the anchor survives the dashboard projection and reaches the agent', () => {
  // getDashboard read `tier`, used it to compute `released`, and then DROPPED it one line before building
  // reclaimItems — which is why the anchor was invisible on the Reclaim List subpage and to the Companion at the
  // same time. One projection, two symptoms.
  const flow = readFileSync('lib/gateway/flow.ts', 'utf8');
  assert.match(flow, /reclaimAnchor/, 'getDashboard must expose the anchor');
  assert.match(flow, /anchor: isAnchorTier\(r\.tier\)/, 'and carry it onto each item');

  // The standing rule: no data the member can see should be invisible to the agent. The member sees a star.
  const actions = readFileSync('app/dashboard/checkin-actions.ts', 'utf8');
  // Counted as LINES, not occurrences — `reclaimAnchor: dash.reclaimAnchor` is one site and two matches, and the
  // first version of this assertion got that wrong and failed against correct code.
  const sites = actions.split('\n').filter((l) => l.includes('reclaimAnchor')).length;
  assert.equal(sites, 2, 'both the full AND the degraded context must carry the anchor — it must not vanish when a read degrades');
});

test('the anchor rule lives in ONE place', () => {
  // The card and the subpage and the dashboard all need "which item is the anchor". Restated three times it is
  // one rule and two wrong copies waiting.
  const artifact = readFileSync('lib/workspace/artifact.ts', 'utf8');
  assert.match(artifact, /anchorFirst|isAnchorTier/, 'the C1 card must use the shared helper');
  assert.doesNotMatch(artifact, /tier === 'top'/, 'and not carry its own copy of the comparison');
});

// Ground-aware exemptions: a raw brand colour IS correct as text on a dark panel. Naming the ground is the price
// of the exemption, because guessing an element's background is exactly how this gets fixed in the wrong
// direction — lightening text that was already on navy.
const RAW_COLOR_ON_DARK: Record<string, string> = {};

test('brand colours are never used raw as TEXT — the -text twins exist for this', () => {
  // --orange #ec6233 is 2.9:1 on white and fails AA. Jay picked --orange-text #c35127 (4.64:1) on 2026-08-02 as
  // the closest passing colour to brand; --teal-text and --olive-text likewise. Reaching for the raw token for a
  // `color:` is always a mistake unless the ground is dark — I did it on the Reclaim List anchor star and caught
  // it only because a memory note said orange fails on white.
  const bad: string[] = [];
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1]!.trim().split('\n').pop()!.trim();
    if (sel in RAW_COLOR_ON_DARK) continue;
    // `(?<![-\w])color` so border-color / background-color / caret-color don't trip it.
    const hit = /(?<![-\w])color:\s*var\(--(orange|teal|olive)\)/.exec(m[2]!);
    if (hit) bad.push(`${sel} uses raw --${hit[1]} as text; use --${hit[1]}-text`);
  }
  assert.deepEqual(bad, [], `\n${bad.join('\n')}\n`);
});

test('every Opening Tour stop points at an anchor that actually exists', () => {
  // A stop whose anchor is missing is DROPPED SILENTLY — the tour filters by presence, and it runs once per
  // member, so the introduction is lost permanently rather than deferred (CAT-46). That is how the Playbook stop
  // went missing before Jay's 8/11 walk, and how the Companion had an anchor with no stop until 8/13.
  const tour = readFileSync('app/dashboard/post-ceremony-tour.tsx', 'utf8');
  const stops = [...tour.matchAll(/target:\s*'([a-z]+)'/g)].map((m) => m[1]!);
  assert.ok(stops.length >= 10, `expected the full stop list, found ${stops.length}`);

  const files: string[] = [];
  const walkApp = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.') || name === 'node_modules') continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walkApp(full);
      else if (full.endsWith('.tsx')) files.push(full);
    }
  };
  walkApp('app');
  const anchors = new Set<string>();
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/data-tour="([a-z]+)"/g)) anchors.add(m[1]!);
  }
  const orphans = stops.filter((s) => !anchors.has(s));
  assert.deepEqual(orphans, [], `tour stops with no anchor anywhere: ${orphans.join(', ')}`);
});

test('the metric pages say so when the member has no number yet', () => {
  // Both pages gate their headline number on a bare `&&`, which renders NOTHING when it is absent — so a member
  // before their first IDQ read a page describing a 0–100 score they did not have, under a heading promising a
  // "shape" with no shape beneath it.
  //
  // WHAT THIS PROVES AND WHAT IT DOESN'T: it catches the empty-state copy being deleted or the branch being
  // "simplified" back to `&&`. It does NOT prove the page renders — these are auth-gated server components, and
  // the only thing that sees them for real is the post-deploy smoke.
  const score = readFileSync('app/score/[memberId]/page.tsx', 'utf8');
  assert.match(score, /don’t have an ID Score yet/, 'the ID Score page must say when there is no score');
  assert.match(score, /dash\?\.score \? \(/, 'and branch on it, rather than rendering nothing');

  const grinta = readFileSync('app/grinta/[memberId]/page.tsx', 'utf8');
  assert.match(grinta, /\{!reading &&/, 'the Grinta page must have a no-reading branch');
});

test('the footer version is a real string, and only lives in one place', () => {
  // Added for Charter: a member reporting a problem can read this back. A version that lags a flip is worse than
  // none — it tells the member, and the founder reading their report, something confidently false. So there is
  // exactly one definition and the footer reads it rather than restating it.
  const version = readFileSync('lib/version.ts', 'utf8');
  assert.match(version, /export const APP_VERSION = 'v\d+\.\d+(\.\d+)?'/, 'APP_VERSION must be a vN.N string');

  const layout = readFileSync('app/layout.tsx', 'utf8');
  // The footer sets the two halves separately now — the version in Barlow, the build ref in mono — so it reads
  // the pieces rather than the joined helper. The invariant is unchanged: it must READ them, never restate them.
  assert.match(layout, /\{APP_VERSION\}/, 'the footer must read APP_VERSION, not its own copy');
  assert.match(layout, /\{buildRef\(\)\}/, 'and call buildRef() for the exact build');
  assert.doesNotMatch(layout, /v\d+\.\d+/, 'and must not hardcode a version of its own');

  // ONLY the hash is monospace. Setting the whole line in mono made the version read as a foreign object in the
  // footer; setting NONE of it loses the reason mono is there at all (0/O and 1/l in a string read back to us).
  const css = readFileSync('app/globals.css', 'utf8');
  assert.match(css, /\.app-build\s*\{[^}]*--font-mono/, '.app-build carries the mono face');
  assert.doesNotMatch(
    css.match(/\.app-version\s*\{([^}]*)\}/)?.[1] ?? '',
    /font-family/,
    '.app-version must inherit the page face — the version is chrome, not a diagnostic string',
  );
});
