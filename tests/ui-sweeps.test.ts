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
  assert.match(CSS, /button:hover,\s*\.btn:hover\s*\{\s*background:\s*var\(--btn-hover-bg\)/, 'and the hover reads it');
  assert.doesNotMatch(
    CSS,
    /button:hover,\s*\.btn:hover\s*\{\s*background:\s*var\(--navy\)/,
    'never hardcode navy back into the global hover — that is the bug, four times over',
  );
});

test('EVERY DARK-TEXT CHIP DECLARES ITS OWN HOVER BACKGROUND', () => {
  // The specific shape that made the Quality Days chips disappear: navy text, no background of its own, and a
  // :hover rule that only touched the border — so the global filled it navy and the label went navy-on-navy.
  for (const sel of ['.qd-score-btn', '.qd-el-btn']) {
    const rule = CSS.match(new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
    assert.ok(rule, `${sel} exists`);
    assert.match(rule, /--btn-hover-bg:/, `${sel} must say what its hover background is, not inherit navy`);
  }
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
