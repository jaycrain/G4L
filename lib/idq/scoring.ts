// ID Score scoring — docs/CONTRACTS.md §2 (May 2026 cascade math).
//   per-dimension raw  = sum of its 6 items            -> 6..30
//   id_score_raw       = sum of the four dimensions    -> 24..120
//   id_score (headline)= normalized to 0..100 = (raw / 120) * 100, rounded to 2dp
//   BANDS ARE RETIRED  -> movement = direction + signed delta + the number (never a bare number)
//
// Open nuance (CONTRACTS §2, Authoring Brief Q5): the true floor is 24 raw (~20 normalized),
// not 0, because Likert starts at 1. The normalization is isolated in `normalizeIdScore` so a
// re-base after Greg's sign-off is a one-line change with no schema impact.

import {
  DIMENSIONS,
  DIMENSION_ITEM_INDICES,
  validateResponses,
  type Dimension,
  type IdqResponses,
} from './instrument.ts';

export const ID_SCORE_RAW_MAX = 120;

export type DimensionScores = Record<Dimension, number>;

export type IdqScore = {
  dimensions: DimensionScores; // each 6..30
  idScoreRaw: number; // 24..120
  idScore: number; // 0..100 normalized headline
};

export type Direction = 'up' | 'down' | 'flat';

export type Movement = {
  deltaFromBaseline: number | null; // null on baseline
  deltaFromPrevious: number | null; // null on baseline / first retake
  direction: Direction | null; // null on baseline
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function normalizeIdScore(raw: number): number {
  return round2((raw / ID_SCORE_RAW_MAX) * 100);
}

function dimensionRaw(responses: IdqResponses, dimension: Dimension): number {
  return DIMENSION_ITEM_INDICES[dimension].reduce((sum, idx) => sum + (responses[idx] ?? 0), 0);
}

/** Score a validated 24-item response set. Throws on invalid input — validate upstream. */
export function scoreIdq(responses: IdqResponses): IdqScore {
  const v = validateResponses(responses);
  if (!v.ok) throw new Error(`invalid IDQ responses: ${v.errors.join('; ')}`);

  const dimensions = Object.fromEntries(
    DIMENSIONS.map((d) => [d, dimensionRaw(responses, d)]),
  ) as DimensionScores;

  const idScoreRaw = DIMENSIONS.reduce((sum, d) => sum + dimensions[d], 0);
  return { dimensions, idScoreRaw, idScore: normalizeIdScore(idScoreRaw) };
}

function directionOf(delta: number): Direction {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

/**
 * Compute movement for the current normalized ID Score against baseline / previous.
 * Pass `baseline`/`previous` as normalized (0..100) ID Scores, or null when not applicable.
 */
export function computeMovement(
  current: number,
  baseline: number | null,
  previous: number | null,
): Movement {
  const deltaFromBaseline = baseline === null ? null : round2(current - baseline);
  const deltaFromPrevious = previous === null ? null : round2(current - previous);
  // Direction reflects the most recent change: prefer vs previous, else vs baseline.
  const ref = deltaFromPrevious ?? deltaFromBaseline;
  return {
    deltaFromBaseline,
    deltaFromPrevious,
    direction: ref === null ? null : directionOf(ref),
  };
}
