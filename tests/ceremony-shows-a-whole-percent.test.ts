// A MEMBER READS A WHOLE PERCENT. THE RECORD KEEPS ITS PRECISION.
//
// Jay finished Rebuild and met "+49.81%" — a hundredth of a percent claimed from six Likert items on a 1–5 scale.
//
// WHAT IS GREG'S AND WHAT IS OURS, because the distinction is the whole reason this is a display helper and not a
// change to the formula. He specifies the move as a PERCENTAGE in the V5 canvas and confirmed the corrected form
// by email in August (his doc's `[(A1/A2)/A1]*100` reduces to `100/A2` — the baseline cancels). That is settled
// and not ours to revisit; the ratio-of-ordinals objection is answered by the measurement scientist whose
// instrument it is.
//
// He has never once specified PRECISION. The two decimals came from our own round2, so rounding for the ceremony
// touches nothing he ruled on — and the stored change_pct is untouched, so research keeps every digit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grintaChangePct, changePctForDisplay } from '../lib/grinta/survey/scoring.ts';

test('Jay’s own move renders as a whole percent', () => {
  const stored = grintaChangePct(4, 2.67);
  assert.equal(stored, 49.81, 'the stored value keeps its precision');
  assert.equal(changePctForDisplay(stored!), 50, 'the member reads 50%');
});

test('a downward move rounds too, and keeps its sign', () => {
  const stored = grintaChangePct(2.67, 4)!;
  assert.ok(stored < 0);
  assert.equal(changePctForDisplay(stored), Math.round(stored));
});

test('the formula itself is UNCHANGED — this is display only', () => {
  // If someone ever "simplifies" by rounding inside grintaChangePct, the research record silently loses
  // precision. Pinning the stored value is what keeps this a display decision.
  assert.equal(grintaChangePct(3.34, 3.09), 8.09);
  assert.equal(grintaChangePct(5, 4), 25);
  assert.equal(grintaChangePct(4, null), null, 'no prior → no percentage, not a zero');
  assert.equal(grintaChangePct(4, 0), null, 'a zero baseline is not divisible, and never renders as infinite');
});

test('every ceremony rounds — none of the four was left behind', async () => {
  const { readFileSync } = await import('node:fs');
  const missing: string[] = [];
  for (const f of [
    'app/reconnect/reconnect-ceremony.tsx',
    'app/rewire/rewire-ceremony.tsx',
    'app/rebuild/rebuild-ceremony.tsx',
    'app/reclaim/reclaim-ceremony.tsx',
  ]) {
    const src = readFileSync(f, 'utf8');
    // A raw `{r.<something>ChangePct}%` means that ceremony still prints two decimals.
    if (/\{r\.\w*[Cc]hangePct\}%/.test(src)) missing.push(f);
  }
  assert.deepEqual(missing, [], `still printing an unrounded percentage:\n${missing.join('\n')}`);
});
