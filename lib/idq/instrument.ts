// IDQ instrument structure — docs/CONTRACTS.md §1.
// 24 items, 4 dimensions (Physical/Self/Social/Outlook), 6 items each, Likert 1–5.
// The 24 item *stems* are G4L-native (authored from self-discrepancy theory, finalized
// with Greg + Legal). We build to the locked structure now; stems drop in when they land.

export const DIMENSIONS = ['physical', 'self', 'social', 'outlook'] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const ITEMS_PER_DIMENSION = 6;
export const TOTAL_ITEMS = DIMENSIONS.length * ITEMS_PER_DIMENSION; // 24
export const LIKERT_MIN = 1;
export const LIKERT_MAX = 5;

// Which item indices (0-based) belong to each dimension. Default: contiguous blocks of 6.
// The real instrument may interleave items; when Greg's ordering lands, update this map only —
// scoring reads from it, so nothing downstream changes.
export const DIMENSION_ITEM_INDICES: Record<Dimension, readonly number[]> = {
  physical: [0, 1, 2, 3, 4, 5],
  self: [6, 7, 8, 9, 10, 11],
  social: [12, 13, 14, 15, 16, 17],
  outlook: [18, 19, 20, 21, 22, 23],
};

export type LikertValue = 1 | 2 | 3 | 4 | 5;
export type IdqResponses = number[]; // length 24, each LIKERT_MIN..LIKERT_MAX

// PLACEHOLDER item stems — readable draft wording so the conversational IDQ has something to
// present. The real G4L-native instrument (authored from self-discrepancy theory, finalized
// with Greg + Legal — CONTRACTS §1) drops in here; the structure/scoring around it is locked.
export const PLACEHOLDER_ITEM_STEMS: Record<Dimension, readonly string[]> = {
  physical: [
    'I have the energy to do the physical things that matter to me.',
    'My body can keep up with what my day asks of it.',
    "I take care of my physical health in ways I'm glad about.",
    'I feel strong enough for the life I want.',
    'I trust my body to show up when I need it.',
    'I recover well after physical effort.',
  ],
  self: [
    'I recognize myself in how I spend my days.',
    'My choices reflect who I actually am.',
    'I feel like the author of my own life.',
    'I know what I stand for right now.',
    'I act in line with what matters to me.',
    'I feel like myself most of the time.',
  ],
  social: [
    'I feel genuinely connected to the people who matter to me.',
    'There are people I can be fully honest with.',
    'I feel like I belong somewhere.',
    'I feel seen by the people around me.',
    'I have relationships that give as much as they take.',
    "I don't feel alone in what I'm going through.",
  ],
  outlook: [
    "I'm hopeful about what's ahead.",
    'I believe I can grow from where I am.',
    "I have things I'm genuinely looking forward to.",
    'I feel capable of meeting what comes.',
    'I have a sense of purpose right now.',
    'I expect good things from the months ahead.',
  ],
};

export function dimensionForIndex(i: number): Dimension {
  return DIMENSIONS[Math.floor(i / ITEMS_PER_DIMENSION)]!;
}

export function itemStem(i: number): string {
  return PLACEHOLDER_ITEM_STEMS[dimensionForIndex(i)]![i % ITEMS_PER_DIMENSION]!;
}

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

/** Validate a raw 24-item IDQ response set: correct length, integers within Likert range. */
export function validateResponses(responses: unknown): ValidationResult {
  const errors: string[] = [];
  if (!Array.isArray(responses)) {
    return { ok: false, errors: ['responses must be an array'] };
  }
  if (responses.length !== TOTAL_ITEMS) {
    errors.push(`expected ${TOTAL_ITEMS} items, got ${responses.length}`);
  }
  responses.forEach((r, i) => {
    if (typeof r !== 'number' || !Number.isInteger(r)) {
      errors.push(`item ${i}: must be an integer (got ${JSON.stringify(r)})`);
    } else if (r < LIKERT_MIN || r > LIKERT_MAX) {
      errors.push(`item ${i}: must be ${LIKERT_MIN}–${LIKERT_MAX} (got ${r})`);
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true };
}
