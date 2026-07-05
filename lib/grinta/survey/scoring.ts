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

// §2e Checkpoint scoring — the FIRST time grinta moves. Grit is re-read from NINE items (the 3 baseline + the 6
// Checkpoint items); the other three strands are carried forward from the baseline unchanged; the composite is the
// mean of the four. Returns the new score plus the grit-strand movement (Jay: grit change = (Ave2 − Ave1)/Ave1 × 100).
export type CheckpointScore = {
  score: GrintaScore; // the new composite + all four strand means (grit updated, others carried)
  gritBaseline: number; // grit Ave1 (the 3 baseline grit items)
  gritNow: number; // grit Ave2 (all 9 grit items)
  gritChangePct: number | null; // signed up-positive; null if the baseline grit is unknown
};

export function scoreCheckpointGrit(params: {
  baselineGritValues: number[]; // the 3 baseline grit item values (G1Q1, G2Q1, G3Q1)
  newGritValues: number[]; // the 6 Checkpoint grit item values, in CHECKPOINT_GRIT_ITEMS order
  carriedStrands: { rewire?: number; rebuild?: number; reclaim?: number }; // the baseline non-grit strand means
}): CheckpointScore {
  const { baselineGritValues, newGritValues, carriedStrands } = params;
  const gritBaseline = baselineGritValues.length ? round2(mean(baselineGritValues)) : 0;
  const gritNow = round2(mean([...baselineGritValues, ...newGritValues]));
  const strands: StrandScores = { reconnect: gritNow };
  if (carriedStrands.rewire != null) strands.rewire = carriedStrands.rewire;
  if (carriedStrands.rebuild != null) strands.rebuild = carriedStrands.rebuild;
  if (carriedStrands.reclaim != null) strands.reclaim = carriedStrands.reclaim;
  const present = STRANDS.map((s) => strands[s]).filter((x): x is number => x != null);
  const composite = present.length ? round2(mean(present)) : 0;
  return { score: { strands, composite }, gritBaseline, gritNow, gritChangePct: grintaChangePct(gritNow, baselineGritValues.length ? gritBaseline : null) };
}

export type Direction = 'up' | 'down' | 'flat';

/**
 * Percent change of a value against a prior reading, signed up-positive: (current − prior) / prior × 100.
 * Returns null on a first reading (no prior). Rounded to 2dp.
 */
export function grintaChangePct(current: number, prior: number | null): number | null {
  if (prior == null || prior === 0) return null;
  return round2(((current - prior) / prior) * 100);
}

export function directionOf(delta: number): Direction {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}
