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
