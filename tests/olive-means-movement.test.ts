// OLIVE MEANS A PRACTICE/MOVEMENT THING HAPPENED — everywhere, or it means nothing.
//
// Donna's ruling (2026-08-22, items 16/17; sharpened 2026-08-28): the "things you said are waiting" card is a
// queue of things the member SAID. An olive wash on it claims movement that did not happen. Her reasoning is the
// file's own rule — a colour that carries meaning cannot double as decoration.
//
// IT WAS APPLIED TO ONE OF THREE SITES. The 8/28 pass moved the Journal queue (.pb-jq) to --grey and left
// .pb-waiting — the card on the DASHBOARD, which is the one Jay was looking at — still olive, plus a dead
// `.tri-waiting` copy sitting directly above it that nothing rendered. Jay, hours later: "The olive wash in the
// Playbook panel is still there."
//
// A dead rule in the place a fixer would naturally look is worse than no rule: it absorbs the edit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const CSS = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const code = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

// The olive wash pair used by the practice surfaces. Anything wearing these is claiming movement.
const OLIVE_BG = /#fbfcf3/i;
const OLIVE_BORDER = /#d4d8b0/i;

test('the "waiting" cards carry no olive wash — both of them', () => {
  for (const sel of ['.pb-waiting', '.pb-jq']) {
    const rule = code.match(new RegExp(`\\${sel} \\{[^}]*\\}`))![0];
    assert.doesNotMatch(rule, OLIVE_BG, `${sel} still has the olive background`);
    assert.doesNotMatch(rule, OLIVE_BORDER, `${sel} still has the olive border`);
    assert.match(rule, /var\(--grey\)/, `${sel} must use the app's standard grey, not a near-neutral`);
  }
});

test('the count badge keeps its olive — the wash was the false claim, not the number', () => {
  // Narrowing her ruling to the BACKGROUND is the faithful reading: a tinted card says "this is a movement
  // surface"; an accent on a count is just the app's accent on a count.
  const badge = code.match(/\.pb-waiting-n \{[^}]*\}/)![0];
  assert.match(badge, /var\(--olive-text\)/, 'the badge is the pull and keeps the accent');
});

test('no dead .tri-waiting rule survives to absorb the next fix', () => {
  // It was styled, olive, and rendered by nothing — sitting immediately above the rule that DOES render.
  assert.doesNotMatch(code, /\.tri-waiting\s*[,{]/, 'a dead twin is where a colour fix goes to die');

  const app = new URL('../app/', import.meta.url).pathname;
  const tsx = readdirSync(app, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => readFileSync(app + f, 'utf8'))
    .join('\n');
  assert.match(tsx, /pb-waiting/, 'the class that actually renders is the one we styled');
});
