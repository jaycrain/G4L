// THE LONG VIEW — Momentum across time, at four zooms.
//
// Momentum and the practice week are both daily trackers at different scales: the week is where you DO it (7 days,
// rotates, belongs to the current Session), Momentum is where you watch it ADD UP (continuous, spans every phase,
// never resets). A 7-day grid structurally cannot show a phase-long trend; this is what can.
//
// GOVERNANCE, and it constrains the whole shape of this file: Momentum is a MIRROR, not a grade. So there is no
// score, no streak, no target, and no "you're doing well" anywhere in here. A false start is logged as honest —
// Greg's framing — and it is drawn beside a good call rather than against it. The member is looking at their own
// record, not a report card. If a future change makes a bucket produce a single number that reads as a verdict,
// that is the line, and it should not be crossed here.
//
// Days with NO calls stay absent rather than becoming zeros. A day someone did not log is not a day they failed,
// and zero-filling would draw months of flatline through the middle of a real pattern.

export type DayCount = { day: string; good: number; missed: number; quiet: number };

export type Range = '7' | '14' | '30' | '365';
export const RANGES: { key: Range; days: number; label: string }[] = [
  { key: '7', days: 7, label: 'Week' },
  { key: '14', days: 14, label: '2 weeks' },
  { key: '30', days: 30, label: 'Month' },
  { key: '365', days: 365, label: 'Year' },
];
export const isRange = (v: unknown): v is Range => RANGES.some((r) => r.key === v);

/** One column of the long view. `label` is what sits under it; `logged` is how many days in the bucket had any call. */
export type Bucket = { label: string; good: number; missed: number; quiet: number; logged: number };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Group dated days into the columns a given zoom should draw.
 *
 * Week and 2-week keep one column per DAY — at that scale the individual days are the point, and averaging them
 * would destroy the only thing the member came to see.
 * Month groups into weeks, year into months, because ~30 and ~365 columns are not a shape anyone can read.
 *
 * Bucketing is done on the date STRING (YYYY-MM-DD), never a Date object: this runs on the server, the member's
 * days were recorded in their own local dates, and reconstructing Dates here would shift a late-evening call into
 * the wrong bucket for anyone east or west of the server.
 */
export function bucketize(days: DayCount[], range: Range): Bucket[] {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));
  if (range === '7' || range === '14') {
    return sorted.map((d) => ({
      label: d.day.slice(8), // day-of-month
      good: d.good,
      missed: d.missed,
      quiet: d.quiet,
      logged: 1,
    }));
  }

  const key = range === '365' ? (d: string) => d.slice(0, 7) : (d: string) => isoWeekKey(d);
  const out = new Map<string, Bucket>();
  for (const d of sorted) {
    const k = key(d.day);
    const b = out.get(k) ?? { label: bucketLabel(k, range), good: 0, missed: 0, quiet: 0, logged: 0 };
    b.good += d.good;
    b.missed += d.missed;
    b.quiet += d.quiet;
    b.logged += 1;
    out.set(k, b);
  }
  return [...out.values()];
}

/** Year-week key from a date string, without constructing a Date (see bucketize). Weeks start Monday. */
function isoWeekKey(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  // Days since epoch via a pure civil-date algorithm — no timezone, no Date.
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  const week = Math.floor((jdn - 1721425) / 7); // absolute week index; Monday-aligned by construction
  return String(week);
}

function bucketLabel(k: string, range: Range): string {
  if (range === '365') {
    const [, m] = k.split('-');
    return MONTHS[Number(m) - 1] ?? k;
  }
  return 'wk';
}

/**
 * The one sentence above the chart. Plain, countable, and deliberately NOT an assessment — it says what is in the
 * record, never how the member is doing. "12 good calls, 3 false starts, across 15 days you logged."
 */
export function trendSummary(buckets: Bucket[], range: Range): string {
  const good = buckets.reduce((a, b) => a + b.good, 0);
  const missed = buckets.reduce((a, b) => a + b.missed, 0);
  const quiet = buckets.reduce((a, b) => a + b.quiet, 0);
  const logged = buckets.reduce((a, b) => a + b.logged, 0);
  // No window name in the empty line: "Nothing logged this 2 weeks" and "this year" both read wrong, and the
  // range is already on screen in the selected pill. Say the plain thing instead.
  if (!logged) return 'Nothing logged in this stretch yet — it fills in as you go.';
  const parts = [
    `${good} good call${good === 1 ? '' : 's'}`,
    missed ? `${missed} false start${missed === 1 ? '' : 's'}` : '',
    // "On Track" is the canonical member-facing label for a quiet_day (the stored enum is unchanged). Phrased as
    // "on-track DAYS" on purpose: bare "3 on track" reads as a verdict on the member, "3 on-track days" is a count
    // of what is in the record — which is the only thing this sentence is allowed to be.
    quiet ? `${quiet} on-track day${quiet === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  return `${parts.join(' · ')} — across ${logged} day${logged === 1 ? '' : 's'} you logged.`;
}
