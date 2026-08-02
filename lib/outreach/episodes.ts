// AWAY EPISODES — the shape a member's absences take, so the Companion can remember them.
//
// Jay, 2026-08-02, and it is the most structural thing in the nudge design: a nudge is not a send, it is an
// EVENT in the member's history. "This happened last April and you came back" is only sayable if going quiet
// and being reached for are things the program KEEPS, not things it did.
//
// WHY THIS EXISTS SEPARATELY FROM outreach_log. That table records one row per MESSAGE. A member does not
// experience four messages; they experience one stretch where they were away. The episode is the unit a
// person would recognise, and the unit the Playbook needs for the Loop ("how did I handle this before?").
// Folding is done here, in a pure function, because the interesting part is the edge cases and not the SQL.
//
// PURE ON PURPOSE. Takes rows and activity timestamps, returns episodes. No database, no clock beyond what is
// passed in — so every boundary below is testable offline rather than discovered in a live run.

/** One recorded reach-out. Only rows that actually WENT somewhere count — see isReach. */
export type AwayRow = { trigger: string; status: string; createdAt: string };

export type AwayEpisode = {
  /** When we first reached during this stretch. NOT when they went quiet — we only know when we noticed. */
  firstReachedAt: string;
  lastReachedAt: string;
  /** How many times the Companion reached during this one stretch. */
  attempts: number;
  /** First sign of life after the last reach. Null while they are still away. */
  returnedAt: string | null;
  /** Whole days from first reach to return. Null while open. */
  daysToReturn: number | null;
};

const DAY = 86_400_000;
const t = (iso: string) => new Date(iso).getTime();

/**
 * A row counts as a REACH only if it left the building.
 *
 * 'held' means the validator or the cadence stopped it, and 'ready' means it was generated and never
 * surfaced. Counting either would have the Companion "remember" reaching out when the member's phone never
 * moved — a false memory, and about the one subject where being wrong is worst: whether we showed up.
 */
export const isReach = (r: AwayRow): boolean =>
  r.trigger === 're_engagement' && (r.status === 'sent' || r.status === 'replied' || r.status === 'dismissed');

/**
 * Fold reach-out rows and member activity into the stretches a person would recognise.
 *
 * A new episode begins whenever the member showed signs of life between two reaches — that is what makes them
 * two separate absences rather than one long one. Everything else is one stretch, however many times we tried.
 */
export function foldAwayEpisodes(rows: AwayRow[], activityAt: string[], now = Date.now()): AwayEpisode[] {
  const reaches = rows.filter(isReach).sort((a, b) => t(a.createdAt) - t(b.createdAt));
  if (!reaches.length) return [];
  const activity = [...activityAt].map(t).sort((a, b) => a - b);
  const firstActivityAfter = (ms: number): number | null => activity.find((a) => a > ms) ?? null;

  const episodes: AwayEpisode[] = [];
  let current: AwayRow[] = [reaches[0]!];

  for (let i = 1; i < reaches.length; i++) {
    const prev = t(reaches[i - 1]!.createdAt);
    const here = t(reaches[i]!.createdAt);
    // Signs of life BETWEEN two reaches → they came back and went away again. Two episodes, not one.
    const cameBack = activity.some((a) => a > prev && a < here);
    if (cameBack) { episodes.push(build(current, firstActivityAfter)); current = []; }
    current.push(reaches[i]!);
  }
  episodes.push(build(current, firstActivityAfter));
  void now; // reserved: an "still away, N days" read for the escalation card
  return episodes;
}

function build(rows: AwayRow[], firstActivityAfter: (ms: number) => number | null): AwayEpisode {
  const first = rows[0]!.createdAt;
  const last = rows[rows.length - 1]!.createdAt;
  const back = firstActivityAfter(t(last));
  return {
    firstReachedAt: first,
    lastReachedAt: last,
    attempts: rows.length,
    returnedAt: back ? new Date(back).toISOString() : null,
    // Whole days, floored: "9 days" is what a person says, not "9.4".
    daysToReturn: back ? Math.max(0, Math.floor((back - t(first)) / DAY)) : null,
  };
}

/**
 * The line the Companion gets — and the voice rules that keep it from becoming a scoreboard.
 *
 * Jay's own example was "this happened last April and you came roaring back, let's do it again!" The MEMORY is
 * exactly right; the phrasing grades the member's past and reaches for pep, both of which the voice rules cut.
 * The Companion holds evidence of what someone did, and evidence is very easy to turn into a scoreboard — so
 * the facts go in flat and the instruction says what not to do with them.
 *
 * Returns null when there is nothing to remember, so the caller adds no line at all rather than an empty one.
 */
export function awayRecallLine(episodes: AwayEpisode[], now = Date.now()): string | null {
  const closed = episodes.filter((e) => e.returnedAt && e.daysToReturn != null);
  if (!closed.length) return null;
  const month = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  // Most recent first, and only a few: this is a thing to recall in passing, not a history to recite.
  const recent = closed.slice(-3).reverse();
  const lines = recent.map((e) => {
    const reached = e.attempts === 1 ? 'reached out once' : `reached out ${e.attempts} times`;
    return `  • ${month(e.firstReachedAt)} — away about ${e.daysToReturn} day${e.daysToReturn === 1 ? '' : 's'}; you ${reached}; they came back`;
  });
  void now;
  return (
    'TIMES THEY HAVE BEEN AWAY BEFORE (they came back each time):\n' +
    lines.join('\n') +
    '\nUse this ONLY if it is genuinely useful to them right now — most often it is not. It is not a record ' +
    'to produce, and never a streak, a count, or evidence about their character. If you do mention it, state ' +
    'it plainly and let them make of it what they will: "You were away around this time last April. You came ' +
    'back on your own." Do NOT praise the return, do NOT call it a comeback, and do NOT use it to argue they ' +
    'should do something now. Going quiet is a hundred reasonable decisions, not a failing — and that is as ' +
    'true of the ones already in this list as of today.'
  );
}
