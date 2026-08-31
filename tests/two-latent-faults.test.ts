import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBeatConfirm, parseBeatConfirmSet, serializeBeatConfirm, beatConfirmChoices,
} from '../lib/agent/beat-confirm.ts';

// parseBeatConfirm looked its value up in the DEFAULT choice set regardless of which set the tap came from — while
// parseBeatConfirmSet, three lines above it, exists solely to read that. The legacy set survived on coincidence:
// both its values ('addition', 'done') also exist in the default set, so the wrong lookup returned the right
// answer. A set whose values did not overlap would return null, and an unrecognised tap is deliberately never
// guessed at — so the member's tap would vanish with no error anywhere.
//
// Found while diagnosing the Legacy double-tap and correctly ruled OUT as its cause. Fixed as a latent fault, not
// a live one. [[test-the-seam-not-the-halves]]

test('EVERY value of EVERY set round-trips — no set may depend on overlapping the default', () => {
  for (const set of ['default', 'legacy'] as const) {
    for (const choice of beatConfirmChoices(set)) {
      const wire = serializeBeatConfirm(choice.value, set);
      assert.equal(parseBeatConfirmSet(wire), set, `${set}/${choice.value}: the set survives the wire`);
      assert.equal(parseBeatConfirm(wire), choice.value, `${set}/${choice.value}: and so does the intent`);
    }
  }
});

test('a value belonging to ANOTHER set is refused, not silently accepted', () => {
  // 'dispute' is the default set's third chip and is deliberately absent from legacy (on a letter, "not quite
  // right" and "there's more" are the same act). A legacy tap claiming it is malformed and must not be honoured.
  const legacyValues = beatConfirmChoices('legacy').map((c) => c.value);
  assert.ok(!legacyValues.includes('dispute'), 'precondition: legacy has no dispute chip');
  assert.equal(parseBeatConfirm('[beat-confirm] dispute set:legacy'), null,
    'a tap we cannot place must not become one we can');
});

test('typed prose still reaches the classifier untouched', () => {
  for (const typed of ["That's mine", 'yes', 'change the second line', '']) {
    assert.equal(parseBeatConfirm(typed), null, `"${typed}" is not a tap`);
  }
});

// ── B2's CLOSE HOLDS ONCE ─────────────────────────────────────────────────────────────────────────────────────
//
// It closed unconditionally, so a member saying "I don't understand what you mean" at the last beat had her
// question answered by the Session ending. Caught by the session eval (B2 turn 37, skills-close → complete) and
// the shape Donna named at the False Start Protocol: "It answers my question then moves on without allowing me to
// close out. I feel left hanging."
//
// The hold is bounded at ONE on purpose. A close whose exit depends on answering correctly is a trap, and the
// eval's probe fires on a cadence — unbounded, it would keep a finished Session open forever.
import { applyRebuildB2Turn } from '../lib/agent/rebuild.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

const atClose = (): ConvState =>
  ({ stage: 'skills-close', collected: {}, administeredResponses: Array(24).fill(3) }) as unknown as ConvState;

test('B2 close: a member who says she is lost is answered, not ended on', () => {
  const t = applyRebuildB2Turn(atClose(), [], "I don't understand what you mean", { text: 'Let me put it plainly.' });
  assert.equal(t.complete, false, 'the Session does not end on her question');
  assert.equal(t.state.stage, 'skills-close', 'and stays where she can answer');
});

test('B2 close: the hold is ONE turn — the next one closes whatever she says', () => {
  let s = applyRebuildB2Turn(atClose(), [], 'Sorry, what?', { text: 'Plainly, then.' }).state;
  const second = applyRebuildB2Turn(s, [], "I still don't understand", { text: 'Understood.' });
  assert.equal(second.complete, true, 'a close must never become a trap');
});

test('B2 close: a real answer still closes on the first turn', () => {
  const t = applyRebuildB2Turn(atClose(), [], 'Planning, probably. Follow-through is the thin one.', { text: 'That tracks.' });
  assert.equal(t.complete, true);
});
