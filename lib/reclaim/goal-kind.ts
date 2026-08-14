// WHAT KIND OF GOAL IS THIS? — measure · cadence · outcome · none.
//
// THE BUG THIS EXISTS FOR (Jay's own Reclaim List, 2026-08-12). Five items; the "+ Track this" affordance was
// offered on exactly one of them, and it was the wrong one:
//
//   ★ Finish in top 20% of my age group at Big Sugar   -> OFFERED   (a one-time race result)
//     Yoga and kettlebell work 3 times per week        -> not offered
//     One sustained climb per weekend                  -> not offered
//
// Exactly backwards. `looksTrackable` tested a list of "digit + unit" patterns, so "top 20%" matched the percent
// rule while the two genuine recurring commitments matched nothing — "times" and "per week" are not units, and
// "One sustained climb" has no digit at all, the number is a WORD.
//
// THE FIX IS NOT ANOTHER PATTERN. Adding `times per week` to the unit list is the fourth-patch shape CLAUDE.md
// warns about, and it would attach the WRONG TOOL. These are two different kinds of goal wanting two different
// instruments:
//
//   MEASURE — a number you log and watch trend toward a target. Weight, VO2, dollars, miles.
//             Instrument: a Measure (lib/measure/store.ts) — a reading, a direction, a finish line.
//   CADENCE — a target COUNT OF DAYS inside a week. "3 times per week", "one climb per weekend".
//             Instrument: a practice week — `practice_commitment.target_days` already models exactly this.
//   OUTCOME — a one-time result, usually at a dated event. "Finish top 20% at Big Sugar."
//             Neither a trend line nor a weekly count. You either did it or you didn't.
//
// So the classifier is three-way, and it lives in its own module for the same reason `anchor.ts` does: the
// Companion, the Reclaim List subpage, the dashboard card and C1 must all give the same answer, and a rule
// restated at four call sites is one rule and three wrong copies waiting to happen.

export type GoalKind = 'measure' | 'cadence' | 'outcome' | 'none';

/** Numbers members actually write as words. "One sustained climb per weekend" is why this exists. */
const WORD_NUMBER = '(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
/**
 * The multiplier forms — "twice a week" carries its count INSIDE the word, so there is no separate number for
 * the count pattern to find. Caught by writing the tests from how people actually speak rather than from the
 * shape of the regex I had already written.
 */
const MULTIPLIER = '(?:once|twice|thrice)';
const COUNT = `(?:\\d+|${WORD_NUMBER}|${MULTIPLIER})`;
/** The period a cadence repeats over. "weekend" is separate from "week" on purpose — Jay writes both. */
const PERIOD = '(?:day|days|week|weeks|weekend|weekends|month|months|morning|mornings|evening|evenings|night|nights)';

const CADENCE_PATTERNS: RegExp[] = [
  // "3 times per week", "one climb per weekend", "two rides a week" — a count, then up to a few words of what
  // it is, then per/a/each/every + a period. The {0,4} window is what lets the noun phrase sit in the middle
  // ("One sustained climb per weekend", "Yoga and kettlebell work 3 times per week").
  new RegExp(`\\b${COUNT}\\s+(?:\\w+[\\s-]+){0,4}?(?:times?\\s+)?(?:per|a|each|every)\\s+${PERIOD}\\b`, 'i'),
  // "3x/week", "4x a week", "5 x week"
  new RegExp(`\\b\\d+\\s?x\\s?(?:/|\\s)?\\s?(?:${PERIOD}|wk)\\b`, 'i'),
  // Bare rhythms with no count at all — the count is implied as "every one of them".
  /\b(?:daily|nightly|weekly|every\s+(?:day|morning|evening|night|week|weekend)|each\s+(?:day|morning|week))\b/i,
];

const OUTCOME_PATTERNS: RegExp[] = [
  // A placing or ranking — "top 20%", "top 10", "top three". This is the one that used to be read as a percent
  // MEASURE, which is how a race result ended up as the only item offered a tracker.
  new RegExp(`\\btop\\s+(?:\\d+|${WORD_NUMBER})\\s?%?`, 'i'),
  // Result verbs — you either did it or you didn't. "Finish", "qualify for", "podium", "break 3 hours".
  /\b(?:finish|complete|qualify|podium|place)\b/i,
  /\b(?:win|won)\b/i,
];

/**
 * The MEASURE patterns, unchanged from the original `looksTrackable` — a number carrying a unit or a target.
 * Kept verbatim rather than rewritten: they were correct for what they were FOR, and the bug was never that
 * they matched too little, it was that nothing else matched at all.
 */
const MEASURE_PATTERNS: RegExp[] = [
  /\$\s?\d/, // currency: $250, $10k
  /\d[\d,.]*\s?%/, // percent: 20%
  /\b(?:to|under|over|below|above|reach|hit)\s+\$?\d/i, // "down to 190", "under 200"
  /\b\d[\d,.]*\s?\+?\s?(?:lbs?|kg|kgs|miles?|mi|km|bpm|reps?|hrs?|hours?|min|mins?|minutes?|words?|steps?|k)\b/i,
  /\b\d[\d,.]*\s?\+/, // 115+
];

/**
 * Classify a goal by the instrument it wants.
 *
 * ORDER IS LOAD-BEARING — this is the whole fix, not an implementation detail:
 *
 *   1. CADENCE first. "Run 5 miles 3 times per week" carries both a unit (miles) and a rhythm. The rhythm is
 *      the thing a member actually keeps, and the week grid is the instrument that helps them keep it, so the
 *      recurring commitment wins over the number inside it.
 *   2. OUTCOME before MEASURE. "top 20%" matches the percent MEASURE pattern. Testing measure first is exactly
 *      how a one-time race placing became the only item on Jay's list offered a trend tracker.
 *   3. MEASURE last of the three.
 *
 * Same lesson as the coach gate: when two matchers can both fire, the order between them IS the behaviour.
 */
export function classifyGoal(text: string): GoalKind {
  const t = (text ?? '').trim();
  if (!t) return 'none';
  if (CADENCE_PATTERNS.some((re) => re.test(t))) return 'cadence';
  if (OUTCOME_PATTERNS.some((re) => re.test(t))) return 'outcome';
  if (MEASURE_PATTERNS.some((re) => re.test(t))) return 'measure';
  return 'none';
}

const WORD_VALUE: Record<string, number> = {
  a: 1, an: 1, one: 1, once: 1, two: 2, twice: 2, three: 3, thrice: 3, four: 4,
  five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

/**
 * How many days a week the member is aiming for — `practice_commitment.target_days`.
 *
 * NULL is a real and correct answer, not a failure: a commitment with no target renders as a row you tick with
 * no "3/7" beside it, which is exactly what C3's Quality-Day rows already do. Showing a quota a member never set
 * would invent a standard and then grade them against it.
 *
 * Two deliberate nulls:
 *   · MONTHLY cadences ("two long rides a month"). The grid is a WEEK. Forcing a monthly count into seven days
 *     would either overstate the aim or silently divide it; better to track the rhythm without a number.
 *   · Anything over 7 — a week has seven days, so a bigger number is a misparse, not an ambition.
 */
export function cadenceTarget(text: string): number | null {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return null;
  // A bare daily rhythm means every day — the member said "every", so the target is the whole week.
  if (/\b(?:daily|nightly|every\s+(?:day|morning|evening|night)|each\s+(?:day|morning))\b/.test(t)) return 7;
  // A weekly rhythm with no count ("every week", "weekly") is once.
  if (/\b(?:weekly|every\s+(?:week|weekend)|each\s+week)\b/.test(t) && !new RegExp(`\\b${COUNT}\\b`).test(t)) return 1;

  const per = new RegExp(`\\b(\\d+|${WORD_NUMBER}|${MULTIPLIER})\\s+(?:\\w+[\\s-]+){0,4}?(?:times?\\s+)?(?:per|a|each|every)\\s+(${PERIOD})\\b`, 'i');
  const x = /\b(\d+)\s?x\s?(?:\/|\s)?\s?(day|week|weekend|month|wk)\b/i;
  const m = per.exec(t) ?? x.exec(t);
  if (!m) return null;

  const rawCount = (m[1] ?? '').toLowerCase();
  const period = (m[2] ?? '').toLowerCase();
  if (/^month/.test(period)) return null; // the grid is a week — see above
  const n = /^\d+$/.test(rawCount) ? Number(rawCount) : WORD_VALUE[rawCount];
  if (!n || n < 1 || n > 7) return null;
  return n;
}
