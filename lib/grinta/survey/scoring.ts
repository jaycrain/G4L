// Grinta survey scoring. Two levels:
//   strand score = mean of the strand's administered items          -> 1..5
//   composite    = mean of the (present) strand means               -> 1..5
// At the onboarding baseline all four strands are present (12 items → 4 strands × 3 items). The §2e Checkpoint
// re-administers only the grit strand (adding 6 items), so scoring is written to group WHATEVER codes it's given
// by strand — the composite recompute at the Checkpoint reuses the stored non-grit strand means (see step 3).
//
// No delta on a first reading. Movement is computed against a stored prior reading, signed up-positive:
//   change % = (current − prior) / prior × 100.

import { STRANDS, LIKERT_MIN, LIKERT_MAX, strandForCode, type Strand } from './instrument.ts';

export type StrandScores = Partial<Record<Strand, number>>; // per-strand mean, only strands that had items
export type GrintaScore = {
  strands: StrandScores;
  composite: number; // mean of the present strand means, 1..5
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

/** Validate a reading: codes and responses same length, each response an integer in Likert range, codes known. */
export function validateReading(codes: readonly string[], responses: readonly number[]): ValidationResult {
  const errors: string[] = [];
  if (codes.length !== responses.length) {
    errors.push(`codes/responses length mismatch (${codes.length} vs ${responses.length})`);
  }
  responses.forEach((r, i) => {
    if (typeof r !== 'number' || !Number.isInteger(r)) {
      errors.push(`item ${i}: must be an integer (got ${JSON.stringify(r)})`);
    } else if (r < LIKERT_MIN || r > LIKERT_MAX) {
      errors.push(`item ${i}: must be ${LIKERT_MIN}–${LIKERT_MAX} (got ${r})`);
    }
  });
  codes.forEach((c, i) => {
    try {
      strandForCode(c);
    } catch {
      errors.push(`item ${i}: unknown code ${JSON.stringify(c)}`);
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true };
}

/**
 * Score a reading: `codes[i]` is answered by `responses[i]`. Groups by strand, means each strand, then means the
 * present strand means into the composite. Throws on invalid input — validate upstream if you want soft handling.
 */
export function scoreGrinta(codes: readonly string[], responses: readonly number[]): GrintaScore {
  const v = validateReading(codes, responses);
  if (!v.ok) throw new Error(`invalid Grinta reading: ${v.errors.join('; ')}`);

  const byStrand: Partial<Record<Strand, number[]>> = {};
  codes.forEach((code, i) => {
    const s = strandForCode(code);
    (byStrand[s] ??= []).push(responses[i]!);
  });

  const strands: StrandScores = {};
  for (const s of STRANDS) {
    const items = byStrand[s];
    if (items && items.length) strands[s] = round2(mean(items));
  }
  const present = STRANDS.map((s) => strands[s]).filter((x): x is number => x != null);
  const composite = present.length ? round2(mean(present)) : 0;
  return { strands, composite };
}

// Checkpoint scoring — a Phase-close read where ONE strand (the "component") is re-read from NINE items (its 3
// baseline items + the 6 Checkpoint items); the other three strands are carried forward from their latest means; the
// composite re-averages the four. Generic over the target strand: §2e re-reads 'reconnect' (grit), R4 re-reads
// 'rewire' (commitment). The COMPONENT movement (component change = (Ave2 − Ave1)/Ave1 × 100, signed up-positive —
// Jay/Decision EE) is what the ceremony foregrounds; the composite change is the diluted background/dashboard trend.
export type CheckpointStrandScore = {
  score: GrintaScore; // the new composite + all four strand means (the target updated, others carried)
  baseline: number; // the component's Ave1 (its 3 baseline items)
  now: number; // the component's Ave2 (all 9 items)
  changePct: number | null; // the COMPONENT movement, signed up-positive; null if the baseline is unknown
};

export function scoreCheckpointStrand(params: {
  target: Strand; // which strand is re-read this Checkpoint ('reconnect' §2e, 'rewire' R4)
  baselineValues: number[]; // the 3 baseline item values of the target strand
  newValues: number[]; // the 6 Checkpoint item values, in item order
  carriedStrands: Partial<Record<Strand, number>>; // the OTHER strands' LATEST means (carried forward unchanged)
}): CheckpointStrandScore {
  const { target, baselineValues, newValues, carriedStrands } = params;
  const baseline = baselineValues.length ? round2(mean(baselineValues)) : 0;
  const now = round2(mean([...baselineValues, ...newValues]));
  const strands: StrandScores = { [target]: now };
  for (const s of STRANDS) {
    if (s !== target && carriedStrands[s] != null) strands[s] = carriedStrands[s]!;
  }
  const present = STRANDS.map((s) => strands[s]).filter((x): x is number => x != null);
  const composite = present.length ? round2(mean(present)) : 0;
  return { score: { strands, composite }, baseline, now, changePct: grintaChangePct(now, baselineValues.length ? baseline : null) };
}

// §2e Grit Checkpoint — the FIRST time grinta moves. Thin wrapper over scoreCheckpointStrand (target 'reconnect'),
// preserving the grit-named result shape for the existing Reconnect caller.
export type CheckpointScore = {
  score: GrintaScore;
  gritBaseline: number;
  gritNow: number;
  gritChangePct: number | null;
};
export function scoreCheckpointGrit(params: {
  baselineGritValues: number[];
  newGritValues: number[];
  carriedStrands: { rewire?: number; rebuild?: number; reclaim?: number };
}): CheckpointScore {
  const r = scoreCheckpointStrand({
    target: 'reconnect',
    baselineValues: params.baselineGritValues,
    newValues: params.newGritValues,
    carriedStrands: params.carriedStrands,
  });
  return { score: r.score, gritBaseline: r.baseline, gritNow: r.now, gritChangePct: r.changePct };
}

export type Direction = 'up' | 'down' | 'flat';

/**
 * Percent change of a value against a prior reading, signed up-positive: (current − prior) / prior × 100.
 * Returns null on a first reading (no prior). Rounded to 2dp.
 *
 * DO NOT "CORRECT" THIS TOWARD GREG'S WING DOCS. Both the Reconnect and Reclaim wing docs print the formula as
 * `[(Ave1/Ave2)/Ave1]*100`, which algebraically reduces to `100/Ave2` — it has no dependence on the current
 * reading at all, so it cannot express change. Greg has ACKNOWLEDGED the error (Jay, 2026-08-08); the intent is
 * and always was `[(Ave2−Ave1)/Ave1]*100`, which is what this computes.
 *
 * Flagged here because the failure mode is a future reader diffing this against the source doc and "fixing" the
 * mismatch in the wrong direction. The doc is wrong; this is right.
 */
export function grintaChangePct(current: number, prior: number | null): number | null {
  if (prior == null || prior === 0) return null;
  return round2(((current - prior) / prior) * 100);
}

/**
 * THE MOVE AS A MEMBER READS IT — whole percent, never two decimals.
 *
 * GREG OWNS THE FORMULA AND HAS RULED ON IT: V5 specifies the change as a percentage, and he confirmed the
 * corrected form (his doc's `[(A1/A2)/A1]*100` reduces to `100/A2` — the baseline cancels) in August. None of
 * that is ours to revisit, and the ratio-of-ordinals objection is answered by the measurement scientist whose
 * instrument it is.
 *
 * WHAT HE HAS NEVER SPECIFIED IS PRECISION. The two decimals came from our own round2 helper, so a member
 * finishing Rebuild met "+49.81%" — a hundredth of a percent claimed from six Likert items on a 1–5 scale. The
 * stored value keeps its precision for research; only the number on the ceremony changes, because that is the
 * one place a figure is being handed to a person rather than a dataset.
 */
export function changePctForDisplay(pct: number): number {
  return Math.round(pct);
}

export function directionOf(delta: number): Direction {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}
