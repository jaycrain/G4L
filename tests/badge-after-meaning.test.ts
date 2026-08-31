import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// JAY'S RULING, 2026-08-31: MEANING BEFORE REWARD.
//
// Donna: "The note about earning a badge should come up AFTER Why it Works, and this should be the case across
// the entire app experience."
//
// NOBODY CHOSE THE OLD ORDER. The badge was a MESSAGE appended at the close; "Why it works" is a CARD rendered
// after the stream — so the badge landed first because two rendering mechanisms happened to sit that way, not
// because anyone decided it. Four surfaces each hand-rolled the same two lines, which is why it was also
// inconsistent: a Session's ending was authored nowhere. [[one-fact-many-sites]]
//
// The governance reasoning behind Jay's call: a badge arriving before the member is told what she did reads as a
// prize for compliance rather than a marker of work. This program never grades, and a reward that precedes its
// own meaning is the closest thing to a grade we would ship.

const SURFACES = ['rewire', 'rebuild', 'reclaim'] as const;
const src = (p: string) => readFileSync(new URL(`../app/${p}`, import.meta.url), 'utf8');

test('NO surface appends the badge at the close any more', () => {
  for (const phase of SURFACES) {
    const s = src(`${phase}/${phase}-chat.tsx`);
    assert.ok(!/badgeBeat/.test(s), `${phase}: the close must not append the badge itself`);
    assert.match(s, /deferBadge\(r\.earnedBadge\?\.name\)/, `${phase}: it hands the badge to the hook`);
  }
});

test('the badge WORDS exist once, in the hook — not four times in four surfaces', () => {
  const hook = src('workspace/use-teaching.ts');
  assert.match(hook, /export const badgeBeatText/, 'one copy of the words');
  for (const phase of SURFACES) {
    assert.ok(!/You earned another badge/.test(src(`${phase}/${phase}-chat.tsx`)),
      `${phase}: must not carry its own copy of the badge copy`);
  }
});

test('a Session that teaches NOTHING still gets its badge — the rule must not swallow one', () => {
  // Checkpoints and B4/C4 have no Understand card, so holding for an acknowledgment that never comes would drop
  // the badge silently. The most dangerous shape of this fix, and the reason it is asserted rather than assumed.
  const hook = src('workspace/use-teaching.ts');
  assert.match(hook, /if \(teaches\) setHeldBadge\(name\);\s*\n\s*else setReleasedBadge/,
    'no card to wait behind → release immediately');
});

test('the release happens on ACKNOWLEDGE, which is the moment meaning has landed', () => {
  const hook = src('workspace/use-teaching.ts');
  const ack = /const acknowledge = \(\) => \{[\s\S]*?\n  \};/.exec(hook)?.[0] ?? '';
  assert.ok(ack, 'acknowledge must still be findable');
  assert.match(ack, /setReleasedBadge\(badgeBeatText\(heldBadge\)\)/, 'the badge lands when she taps Got it');
});
