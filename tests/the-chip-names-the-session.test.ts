// THE KEPT-READ CHIP CALLS A SESSION WHAT THE MEMBER CALLS IT.
//
// The provenance chip reads "from ___ · Rewire" under something a member chose to keep. It used to be a
// hand-written table of twelve names, and on the day it was replaced SIX of the twelve named something the member
// never sees:
//
//   Mindful Monitoring          → the member's Session is the False Start Protocol
//   Monitoring Health Decisions → the member's Session is The Lifestyle Pilot
//   What Is Your Why?           → What's Your Why?
//   Strengths and Weaknesses    → Strengths & Weaknesses
//   the Bigger World Audit      → Bigger World Audit
//   the Doors                   → Excavation (this one is deliberate — see below)
//
// The first two are Greg's document titles. His names are real and they belong in his Science Check and his memos;
// they are not what a member is shown, and crediting their own kept words to a phrase they have never read makes
// the product look like it is quoting someone else's homework.
//
// WHY A TEST AND NOT JUST THE FIX. The table had already been corrected three times — C1's retitle in August (the
// registry followed, this file did not, and the chip credited a retired title for three weeks), then R1, then R3.
// Every fix was right and every fix left the duplication that caused it, so there was always a seventh. The names
// now derive from SESSION_REGISTRY; this holds that seam shut.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teachingSourceLabel } from '../lib/content/teaching.ts';
import { SESSION_REGISTRY } from '../lib/workspace/session-registry.ts';
import type { SessionKey } from '../lib/workspace/session-key.ts';

// The single deliberate divergence, restated here so the test fails if it is ever widened quietly. The Session's
// title is Excavation; the board and the conversation both call it the Doors, so that is the name the member
// holds. An alias is honest about that — a drifting table was not.
const ALLOWED_ALIASES: Record<string, string> = { r2: 'the Doors' };

test('every chip names the Session by the name the member is shown', () => {
  const wrong: string[] = [];
  for (const entry of SESSION_REGISTRY.filter((d) => d.kind === 'session')) {
    const expected = ALLOWED_ALIASES[entry.id] ?? entry.label;
    const shown = teachingSourceLabel(entry.id as SessionKey).split(' · ')[0];
    if (shown !== expected) wrong.push(`${entry.id}: chip says "${shown}", member sees "${expected}"`);
  }
  assert.deepEqual(wrong, [], wrong.join('\n'));
});

test("Greg's instrument names never reach the chip", () => {
  // The two-layer split, asserted rather than remembered: his instrument names stay in his documents. Named
  // explicitly because both of these were live on this surface — the IDQ until this morning, the Drift Quiz
  // until this afternoon.
  const HIS = [/\bIDQ\b/i, /Drift Quiz/i, /Mindful Monitoring/i, /Monitoring Health Decisions/i];
  for (const entry of SESSION_REGISTRY.filter((d) => d.kind === 'session')) {
    const shown = teachingSourceLabel(entry.id as SessionKey);
    for (const re of HIS) {
      assert.ok(!re.test(shown), `${entry.id} chip "${shown}" carries an instrument name (${re})`);
    }
  }
});

test('a rename in the registry reaches the chip with no second edit', () => {
  // The actual property being bought. If this ever fails, someone has reintroduced a local copy of the names.
  const r3 = SESSION_REGISTRY.find((d) => d.id === 'r3')!;
  assert.equal(teachingSourceLabel('r3' as SessionKey).split(' · ')[0], r3.label);
  const b3 = SESSION_REGISTRY.find((d) => d.id === 'b3')!;
  assert.equal(teachingSourceLabel('b3' as SessionKey).split(' · ')[0], b3.label);
});
