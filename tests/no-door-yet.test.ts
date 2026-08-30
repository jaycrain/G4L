// HE COMES IN WITH NO DOOR — admitted, not refused, and never given a Fade he did not describe.
//
// Jay's ruling, 2026-08-29, on being shown that a man with no Fade could neither finish onboarding nor be turned
// away: "Let him in with no Door."
//
// What actually happened to him before was NEITHER admission NOR refusal. The decline branch needed him to declare
// himself thriving in so many words; a man who simply had no story fell between the two, and the gap stage kept
// asking for an event he did not have. Theo wrote "four times!" and never got an account. Nobody chose that — it is
// what the code did when it could not find what it was looking for.
//
// This supersedes CLAUDE.md's "a member with no Fade stalling at intake is the system correctly declining a
// non-member". Stalling was never declining. It was the absence of a decision.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
import { contractGaps } from '../lib/agent/onboarding-contract.ts';
import type { Collected, ConvState } from '../lib/agent/onboarding.ts';

const atGap = (): ConvState => ({ stage: 'gap', collected: { athleticPast: 'a founder', identitySkipped: true } }) as never;

test('he is admitted, and the absence is recorded rather than argued with', () => {
  const t = applyStagedTurn(atGap(), [], 'Nothing is missing — life is great and I just want more.', { text: '' } as never);
  assert.equal(t.state.collected.noDoorYet, true);
  assert.equal(t.state.stage, 'reclaim', 'he continues onto the ordinary path');
  assert.notEqual(t.declined, true, 'nobody is turned away at the scope gate');
  assert.equal(t.complete, false);
});

test('NOTHING the model tagged along the way becomes his Fade story', () => {
  // The harm this ruling could have introduced. While the decline was terminal the record was never used; admitting
  // him made it matter completely — the model had tagged "career, marriage, kids all genuinely great" as his `gap`,
  // and that would have been filed as the story of what he lost.
  const t = applyStagedTurn(atGap(), [], "There's no distance at all — career, marriage and kids are genuinely great, I just want more.", {
    text: 'Sounds like things are good.',
    record: { gap: 'career, marriage, kids all genuinely great' },
    noFade: true,
  } as never);
  assert.equal(t.state.collected.noDoorYet, true);
  assert.ok(!t.state.collected.gap, 'no fabricated fade on his record');
  assert.deepEqual(t.state.collected.doors ?? [], [], 'and no fabricated Door');
});

test('the completion contract stops demanding a story he does not have', () => {
  // The gap requirement is what stranded him: the only way to satisfy it would be to invent one.
  const base: Collected = { athleticPast: 'a founder', identitySkipped: true, identityNoun: 'Climber', reclaimList: ['run a faster marathon', 'scale the company', 'more time outdoors'] };
  assert.ok(contractGaps(base).includes('gap'), 'everyone else must still give the narrative');
  assert.deepEqual(contractGaps({ ...base, noDoorYet: true }), [], 'he can finish without one');
});

test('a real Fade is untouched by any of this', () => {
  // The asymmetry that protects the members we are actually for. He must never be reached by a member who simply
  // answers in fragments — "never turn away a real one" (CAT-01/05).
  const t = applyStagedTurn(atGap(), [], 'Knee went. Then the divorce. I stopped running after that.', { text: '' } as never);
  assert.notEqual(t.state.collected.noDoorYet, true, 'a terse real Fade is not mistaken for an absent one');
});

test('a session parked in the OLD decline is let in when he comes back', () => {
  const t = applyStagedTurn({ stage: 'declined', collected: {} } as never, [], 'actually wait', { text: '' } as never);
  assert.equal(t.state.collected.noDoorYet, true, 'migrated onto the ordinary path');
  assert.notEqual(t.declined, true, 'the refusal is not re-asserted a week later');
  assert.equal(t.complete, false, 'CAT-26 holds: never force-complete an empty session');
});

test('the Companion is TOLD, and told not to go hunting', () => {
  // No data the member has may be invisible to the agent. Without this the Companion does exactly what intake used
  // to: goes looking for a story he does not have.
  const src = readFileSync(new URL('../lib/agent/checkin.ts', import.meta.url), 'utf8');
  assert.match(src, /NO DOOR on their record yet/, 'the state reaches the model');
  assert.match(src, /never say 'no Door yet' back to them as a label/, 'and is never said back to him as a label');
});
