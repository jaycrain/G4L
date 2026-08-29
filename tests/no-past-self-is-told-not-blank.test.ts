// A MISSING CAPTURE IS TOLD TO THE MODEL, NEVER LEFT BLANK.
//
// Found in the onboarding sweep, 2026-08-30, by walking the live engine rather than reading it.
//
// THE PATH: a member who deflects the identity beat five times is SKIPPED by the runaway backstop with nothing
// captured — no athleticPast, no identityNoun — and can then complete onboarding normally. That is the backstop
// working (nobody may be trapped in a beat), and the v1 contract would have refused to complete, but the staged
// engine does not call that contract. So this member is real and reachable.
//
// THE HARM: the intake prompt then rendered "Past self: " — blank — and asked the model to write the member's
// identity paragraph from it. The identity line directly above it handles its own absence explicitly; this one
// said nothing. A blank field under an instruction to describe someone is an invitation to invent them, and the
// paragraph becomes the "true north" every later surface points at. One fact, two sites, guarded at one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyStagedTurn, stagedOpening } from '../lib/agent/onboarding-staged.ts';
import type { ConvState, Turn } from '../lib/agent/onboarding.ts';

const PROVIDER = readFileSync(new URL('../lib/agent/provider.ts', import.meta.url), 'utf8');

test('the member this protects is reachable — the backstop skips them with nothing captured', () => {
  let t: Turn = stagedOpening();
  const say = (m: string) => { t = applyStagedTurn(t.state as ConvState, [], m, { text: 'Take your time.' } as never); };
  for (let i = 0; i < 5; i++) say("I don't really know");
  const c = (t.state as ConvState).collected;
  assert.equal((t.state as ConvState).stage, 'gap', 'the backstop advanced them rather than trapping them');
  assert.equal(c.athleticPast, undefined, 'and nothing was captured about who they were');
  assert.equal(c.identitySkipped, true, 'they are marked skipped, which is the documented off-ramp');
});

test('an absent past self is DESCRIBED to the model, with an explicit do-not-invent', () => {
  assert.match(PROVIDER, /Past self: they did not describe one/,
    'a blank "Past self:" line tells the model nothing about why it is blank');
  assert.match(PROVIDER, /Do NOT invent a past self/, 'and inventing one is the failure to forbid by name');
  assert.match(PROVIDER, /or infer one from the gap/,
    'inferring from the gap is the specific way it would invent one — the gap is right underneath it');
});

test('the guarded and unguarded cases are symmetric now', () => {
  // The bug was asymmetry, not absence: identityNoun had this treatment and athleticPast did not, in adjacent
  // lines of one template. Asserting BOTH keeps them from drifting apart again.
  assert.match(PROVIDER, /They haven't named the identity yet/, 'the identity absence is still handled');
  assert.match(PROVIDER, /i\.athleticPast\?\.trim\(\)/, 'and the past-self absence is handled the same way');
});

test('a member who DID describe their past still gets their own words, unchanged', () => {
  // The fix must not cost the ordinary case. The verbatim capture is the whole point of the field.
  assert.match(PROVIDER, /Past self: \$\{i\.athleticPast\}/, 'their words go through verbatim when present');
});

test('skipping the identity beat skips BOTH its outputs, not just one', async () => {
  // Jay, 2026-08-30, on a member finishing with neither a past self nor a handle: "gives a prospect some
  // flexibility and room to get comfortable, not turning them away. We should expect cases like that."
  //
  // `identitySkipped` already satisfied the identity slot. It did not satisfy athleticPast — the OTHER output of
  // the same beat — so a member deliberately let past that question was recorded as permanently incomplete on
  // it. Expecting a case means representing it as a supported state, not a gap in the record.
  const { contractGaps, contractMet } = await import('../lib/agent/onboarding-contract.ts');
  const skipped = {
    identitySkipped: true,
    gap: 'My dad got sick in 2019 and everything I did for myself just stopped for three years.',
    reclaimList: ['ride my bike again', 'sleep properly', 'see friends monthly'],
  } as never;
  assert.deepEqual(contractGaps(skipped), [], 'a skipped member is complete, not perpetually missing a slot');
  assert.equal(contractMet(skipped), true);
});

test('but a member who did NOT skip still owes a past self', async () => {
  const { contractGaps } = await import('../lib/agent/onboarding-contract.ts');
  // The ruling is scoped to the member who was let past the beat. Someone still IN it has not been excused
  // anything — dropping the requirement for everyone would be relaxing the bar, which is not what was asked.
  const stillGoing = {
    identityNoun: 'Racer',
    gap: 'My dad got sick in 2019 and everything I did for myself just stopped for three years.',
    reclaimList: ['ride my bike again', 'sleep properly', 'see friends monthly'],
  } as never;
  assert.deepEqual(contractGaps(stillGoing), ['athleticPast'], 'named an identity but described no past self');
});
