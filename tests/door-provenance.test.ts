import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doorProvenance } from '../lib/agent/door-provenance.ts';

// THE CASE THAT SHIPPED. Jay named three at onboarding; the Reconnect Session drew out The Vanishing. The close
// then told him he had named all four "yourself at the start". Anything that lets us say that again must fail here.
test('a Door surfaced in-session is never counted as one the member named at onboarding', () => {
  const atEntry = ['career_cliff', 'marriage', 'load_bearer'] as const;
  const now = ['career_cliff', 'marriage', 'load_bearer', 'vanishing'] as const;

  const p = doorProvenance(now as never, atEntry as never);

  assert.deepEqual(p.carried, ['career_cliff', 'marriage', 'load_bearer']);
  assert.deepEqual(p.surfacedHere, ['vanishing'], 'The Vanishing came out of the Session, not out of onboarding');
  assert.ok(p.provable);
  assert.ok(!p.carried.includes('vanishing' as never), 'the exact false claim Jay was shown');
});

// A correct SWAPS: the old Door leaves the set, the new one arrives. The arrival is still this session's work.
test('a corrected Door counts as surfaced here, and the retired one disappears from both', () => {
  const p = doorProvenance(['career_cliff', 'empty_nest'] as never, ['career_cliff', 'marriage'] as never);
  assert.deepEqual(p.carried, ['career_cliff']);
  assert.deepEqual(p.surfacedHere, ['empty_nest']);
});

// The quiet case tells would MISS. A 'mechanical' add suppresses the re-seeing tell, so deriving provenance from
// tells would silently file this Door under onboarding. Provenance asks what CHANGED, not what was remarkable.
test('a Door added without a re-seeing tell is still surfaced here', () => {
  const p = doorProvenance(['marriage', 'caregiving'] as never, ['marriage'] as never);
  assert.deepEqual(p.surfacedHere, ['caregiving']);
});

// A resumed pre-fix session has no entry snapshot. The engine must then claim NOTHING about when a Door was named —
// a confident wrong statement about a member's own life is worse than a vague one.
test('with no entry snapshot nothing is provable, and nothing is attributed', () => {
  const p = doorProvenance(['marriage', 'vanishing'] as never, undefined);
  assert.equal(p.provable, false);
  assert.deepEqual(p.carried, []);
  assert.deepEqual(p.surfacedHere, []);
});

test('an unchanged set surfaces nothing', () => {
  const p = doorProvenance(['marriage'] as never, ['marriage'] as never);
  assert.deepEqual(p.surfacedHere, []);
  assert.deepEqual(p.carried, ['marriage']);
});

// ── THE SEAM ────────────────────────────────────────────────────────────────────────────────────────────────────
// A correct helper wired to nothing is a bug that unit-tests green. These assert on the STRING THE MODEL ACTUALLY
// RECEIVES, which is where the false claim lived.
import { reconnectContext } from '../lib/agent/reconnect.ts';

const JAY = {
  identityNoun: 'Racer',
  doors: ['career_cliff', 'marriage', 'load_bearer', 'vanishing'],
  gap: 'the miles stayed high but the racing stopped',
  reclaimList: ['race again', 'ride with the group'],
} as never;

test('SEAM: the context never tells the model a session-surfaced Door was named at onboarding', () => {
  const ctx = reconnectContext(JAY, ['career_cliff', 'marriage', 'load_bearer'] as never);

  const namedLine = ctx.split('\n').find((l) => l.startsWith('Named at onboarding:')) ?? '';
  assert.ok(namedLine, 'the context must still say which Doors WERE named at onboarding');
  assert.ok(!/Vanishing/i.test(namedLine), `"${namedLine}" must not contain the Door the Session drew out`);

  assert.match(ctx, /Surfaced in THIS conversation[^\n]*Vanishing/i, 'and it must credit the Session for it');
  // LINE-ANCHORED on purpose. The unanchored version of this matched the "…NOT named at onboarding: The Vanishing"
  // line and failed on CORRECT output — a check that fails for the wrong reason is as useless as one that passes
  // for the wrong reason.
  assert.ok(
    !ctx.split('\n').some((l) => /^Named at onboarding:/.test(l) && /Vanishing/i.test(l)),
    'no attribution line may list the Door the Session drew out',
  );
});

test('SEAM: with no entry snapshot the context refuses to attribute rather than guessing', () => {
  const ctx = reconnectContext(JAY, undefined);
  assert.ok(!/Named at onboarding:/.test(ctx), 'nothing may be attributed without proof');
  assert.match(ctx, /do NOT know which of these were named at onboarding/);
  assert.match(ctx, /Vanishing/, 'but the Doors themselves are still served — recall must not degrade');
});

test('SEAM: an unrevised session still reports the Doors as onboarding-named', () => {
  const ctx = reconnectContext(JAY, ['career_cliff', 'marriage', 'load_bearer', 'vanishing'] as never);
  assert.match(ctx, /Named at onboarding: [^\n]*Vanishing/i, 'no revision happened — the claim is true here');
  assert.ok(!/Surfaced in THIS conversation/.test(ctx));
});

test('SEAM: the Reclaim List is served without dating it to onboarding', () => {
  const ctx = reconnectContext(JAY, ['career_cliff'] as never);
  assert.match(ctx, /Reclaim List as it stands today/);
  assert.match(ctx, /race again/, 'the list itself must still reach the model (backbone)');
});

// The counter-example that keeps the rule honest: intake_gap really is written once, so its claim survives.
test('SEAM: the gap keeps its "first described" provenance, because that field never changes', () => {
  const ctx = reconnectContext(JAY, ['career_cliff'] as never);
  assert.match(ctx, /How they first described the gap opening: the miles stayed high/);
});
