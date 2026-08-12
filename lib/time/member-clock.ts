// WHAT DAY IS IT FOR THIS MEMBER — one answer, in their timezone, for the whole product.
//
// THE BUG THIS EXISTS TO END. There was no timezone anywhere, so every date decision ran on UTC: `today` in the
// Companion's context (server local, which is UTC on Vercel), `current_date` in Postgres (which stamps a Quality
// Day, a W3 entry, a momentum call), and dateForDay (which column of the grid a tick lands on). For a member in
// Denver that means EVERYTHING AFTER 6PM LOCAL IS RECORDED AS TOMORROW. Nothing errors; the day is just wrong,
// their streak breaks in the wrong place, and "did I mark today" answers no when they did.
//
// Twenty-six scattered date decisions were the bug — not any one of them. So there is one helper and every caller
// reads it, the same shape as lib/db/jsonb.ts and the button-hover variable: a fact stated in N places is N-1
// wrong copies waiting.
//
// IANA NAMES, NEVER OFFSETS. Boulder is UTC-6 today and UTC-7 in December. A stored offset is correct for half
// the year, which is worse than no offset because it looks right when you check it in summer.
//
// A NULL ZONE IS "we have not detected it yet", and falls back to UTC — the pre-existing behaviour, so a member
// whose zone we never captured is no worse off than before rather than crashing.

/** An IANA zone name, e.g. 'America/Denver'. Null when we have not detected one for this member. */
export type Zone = string | null;

const UTC = 'UTC';

/** Guard against a stored zone the runtime does not know (a typo, a retired name) — never throw at a member. */
function safeZone(zone: Zone): string {
  if (!zone) return UTC;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zone });
    return zone;
  } catch {
    console.error(`member-clock: unknown timezone "${zone}" — falling back to UTC`);
    return UTC;
  }
}

/**
 * The member's local calendar date for an instant, as YYYY-MM-DD.
 *
 * 'en-CA' because it formats as YYYY-MM-DD natively — parsing a localised string back into parts is where this
 * kind of helper usually goes wrong.
 */
export function localDate(zone: Zone, at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: safeZone(zone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

// FORMATTING A CALENDAR DATE IS NOT FORMATTING AN INSTANT.
//
// Once we have "the member's local date" as YYYY-MM-DD, the zone has already been applied and its job is done.
// Formatting it must NOT apply a zone a second time — `new Date('2026-08-12').toLocaleDateString()` on a machine
// west of Greenwich renders August 11, which is how a date can be computed correctly and still display wrong.
// So both of these parse at UTC midnight and format in UTC: pure calendar arithmetic, no instants involved.

function fmt(date: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: UTC, ...opts }).format(new Date(`${date}T00:00:00Z`));
}

/** "Wednesday, August 12, 2026" — what the Companion is told the date is. */
export function longDate(date: string): string {
  return fmt(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/** "Aug 12" — for labelling a logged entry that is neither today nor yesterday. */
export function shortDate(date: string): string {
  return fmt(date, { month: 'short', day: 'numeric' });
}

/** Day of week for a YYYY-MM-DD, Monday = 0 … Sunday = 6. Weeks run Monday–Sunday (Jay, 2026-08-12). */
export function mondayIndex(date: string): number {
  // Parsed as UTC midnight deliberately: `date` is ALREADY a local calendar date, so re-interpreting it in a zone
  // would shift it a second time. This is arithmetic on a calendar date, not on an instant.
  const d = new Date(`${date}T00:00:00Z`);
  return (d.getUTCDay() + 6) % 7;
}

/** Shift a YYYY-MM-DD by N calendar days. Pure date arithmetic — no zone, no DST, no instants. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Monday of the week containing `date`. */
export function weekStart(date: string): string {
  return addDays(date, -mondayIndex(date));
}

/** The Sunday of the week containing `date`. */
export function weekEnd(date: string): string {
  return addDays(weekStart(date), 6);
}

export type MemberWeek = {
  /** First day shown. The Session's close date for a partial first week, else a Monday. */
  start: string;
  /** Last day shown — always a Sunday. */
  end: string;
  /** How many columns the grid draws: 7 normally, fewer for a partial first week. */
  days: number;
  /**
   * TRUE when this is the stub between a Session close and the first Monday.
   *
   * It exists because Jay wanted the member tracking from the moment they commit rather than waiting up to six
   * days for a Monday — but a 1-to-6-day stub is not a week, and treating it as one would fire an end-of-week
   * review over a single Saturday. Callers use this to show the days and withhold the review.
   */
  partial: boolean;
};

/**
 * The whole life of one tracker, fixed the moment its Session closes.
 *
 * THE SHAPE (Jay, 2026-08-12): "show the partial week for the first week then immediately roll to Mon-Sun". So a
 * Session closed on Thursday draws Thu–Sun, then one full Monday–Sunday.
 *
 * IT IS TWO WINDOWS, NOT A ROLLING ONE. The first version of this answered "what week is it now", which meant a
 * tracker never ended — every Monday it silently produced a fresh week and the thing would have run forever. A
 * practice week is BOUNDED; that is the whole point of it. So the run is computed once from the start date and
 * has a last day.
 */
export type TrackerRun = {
  /** The partial first week, or null when the Session closed on a Monday and there is nothing to stub. */
  stub: MemberWeek | null;
  /** The full Monday–Sunday week that carries the review. Always seven days. */
  main: MemberWeek;
};

export function trackerRun(startedOn: string): TrackerRun {
  if (mondayIndex(startedOn) === 0) {
    return { stub: null, main: { start: startedOn, end: addDays(startedOn, 6), days: 7, partial: false } };
  }
  const firstMonday = addDays(weekStart(startedOn), 7);
  const stubEnd = addDays(firstMonday, -1); // the Sunday before the first full week
  return {
    stub: { start: startedOn, end: stubEnd, days: daysBetween(startedOn, stubEnd) + 1, partial: true },
    main: { start: firstMonday, end: addDays(firstMonday, 6), days: 7, partial: false },
  };
}

/** The window the member is ticking TODAY. */
export function currentWindow(run: TrackerRun, today: string): MemberWeek {
  return run.stub && today < run.main.start ? run.stub : run.main;
}

/**
 * The finished stub, once the run has rolled past it — null while it is still the current window.
 *
 * Jay's call (2026-08-12) when shown that a member who ticked four days Thu–Sun would open the grid on Monday to
 * an empty one: keep it visible above the new week. Ticks a member made must never appear to vanish.
 */
export function priorWindow(run: TrackerRun, today: string): MemberWeek | null {
  return run.stub && today >= run.main.start ? run.stub : null;
}

/** Whole days from `a` to `b`, both YYYY-MM-DD. Negative when b is before a. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Which column of this week a date falls in, or null when it is outside.
 * Callers must not assume index 0 is Monday — for a partial first week it is the day they started.
 */
export function columnFor(week: MemberWeek, date: string): number | null {
  const i = daysBetween(week.start, date);
  return i >= 0 && i < week.days ? i : null;
}

/**
 * Is the whole run finished — i.e. has the member's local date passed the main week's Sunday?
 *
 * THE STUB NEVER CARRIES THE REVIEW. A Session closed on Sunday afternoon would otherwise produce a one-day week
 * and immediately review it. The full Monday–Sunday carries it, so every review lands on a Sunday.
 *
 * THE CONSEQUENCE, STATED PLAINLY: a tracker now lives longer than seven days. Close on a Monday and it is the
 * seven days it always was; close on a Tuesday and it is six stub days plus a full week — thirteen. That is the
 * price of "partial first week, then Mon–Sun", and it is a deliberate trade, not an oversight.
 */
export function runIsOver(run: TrackerRun, today: string): boolean {
  return today > run.main.end;
}
