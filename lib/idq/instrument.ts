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

// IDQ item stems — G4L voice rewrite v1 (second-person, spoken). Each maps 1:1 to the original
// validated item (original item number in the trailing comment); the construct, the four
// dimensions, and the 1–5 scale are UNCHANGED. The reworded items ship for the live onboarding
// check and carry Greg's validation pass (the science underneath is untouched — this is the
// voice layer on top). Array order matches DIMENSION_ITEM_INDICES.
export const ITEM_STEMS: Record<Dimension, readonly string[]> = {
  physical: [
    'Your body feels like it belongs to you — you know it, you trust it, you’re at home in it.', // item 1
    'You could ask something hard of your body today without bracing for it to hurt.', // item 2
    'You know your numbers — weight, blood pressure, resting heart rate — and you can look at them without looking away.', // item 3
    'You’re as physically capable today as you were five years ago.', // item 4
    'The way you eat is something you actually decide — not something running on autopilot.', // item 5
    'You sleep well, and you wake up with the day in front of you as something to show up for.', // item 6
  ],
  self: [
    'If your twenty-five-year-old self walked in right now, they’d recognize the person you’ve become.', // item 7
    'You regularly make time for things you care about that have nothing to do with work or anyone else’s needs.', // item 8
    'Asked “who are you?”, you’ve got an answer that isn’t your job title or your role in the family.', // item 9
    'You’ve held onto what you love — not quietly traded it away for something you don’t.', // item 10
    'The life you’re in right now is one you chose, on purpose — eyes open.', // item 11
    'You’re the main character in your own story, not the supporting cast in everyone else’s.', // item 12
  ],
  social: [
    'There’s at least one person in your life who sees the real you and tells you the truth.', // item 13
    'You show up all the way for the people you love — actually present, not just in the room.', // item 14
    'You’re the one who calls, who plans, who says yes — the one who shows up, not the one who bails.', // item 15
    'Your closest relationships have gotten deeper this past year, not thinner.', // item 16
    'You belong somewhere — a group, a community — really belong, not just attend.', // item 17
    'When someone asks how you’re doing, you tell them the truth.', // item 18
  ],
  outlook: [
    'You’ve got a clear picture of what you want your next chapter to be, past what you’re obligated to do.', // item 19
    'In the last six months you’ve set a goal that genuinely excites you — yours, not one handed to you.', // item 20
    'You’re willing to do hard things on purpose, because of who they’re turning you into.', // item 21
    'Picture the next ten years — you can see specific moments you want to be inside of.', // item 22
    'In the last month you did something because the person you’re becoming would do it.', // item 23
    'You believe your best chapters are still ahead — and you’re willing to bet on it.', // item 24
  ],
};

export function dimensionForIndex(i: number): Dimension {
  return DIMENSIONS[Math.floor(i / ITEMS_PER_DIMENSION)]!;
}

export function itemStem(i: number): string {
  return ITEM_STEMS[dimensionForIndex(i)]![i % ITEMS_PER_DIMENSION]!;
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
