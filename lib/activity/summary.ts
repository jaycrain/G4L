// Pure presentation/framing helpers for the Activity Panel. Reflective, never a grade.

import type { ActivityType, WeekStats } from './types.ts';

/**
 * The one reflective line on the panel — witnesses the member, never scores them.
 *
 * ALWAYS "you" (Cowork + Jay, 2026-08-14). This read "The Runner has been showing up" — the member talked ABOUT
 * in the third person on their own dashboard. Their claimed Identity is something they ARE, not a category the
 * system files them under, and routine third-person use is what turns the one into the other. `identityNoun` is
 * no longer read; the parameter stays so callers don't change and so the reason sits next to the code.
 */
export function framingLine(_identityNoun: string | null, thisWeek: WeekStats): string {
  if (thisWeek.count === 0) return 'A quiet week — that is part of it too.';
  return 'You have been showing up.';
}

// Imperial (US) — miles over ~a tenth of a mile, else feet. (Charter audience is US; a per-member unit
// preference is a later add if we go metric-market.)
const METERS_PER_MILE = 1609.344;
export function formatDistance(m: number | null): string | null {
  if (!m || m <= 0) return null;
  return m >= 160 ? `${(m / METERS_PER_MILE).toFixed(1)} mi` : `${Math.round(m * 3.28084)} ft`;
}

// Week-over-week direction (this Mon–Sun vs last), on distance — reflective, never a grade. Null when there's no
// prior week to compare or nothing this week yet. "More/less than last week", not "ahead/behind".
export function weekTrend(thisWeek: WeekStats, lastWeek: WeekStats): string | null {
  if (thisWeek.distanceM <= 0 || lastWeek.distanceM <= 0) return null;
  const diffMi = Math.abs(thisWeek.distanceM - lastWeek.distanceM) / 1609.344;
  if (diffMi < 1) return 'About the same as last week.';
  return thisWeek.distanceM > lastWeek.distanceM
    ? `${diffMi.toFixed(0)} mi more than last week.`
    : `${diffMi.toFixed(0)} mi less than last week.`;
}

// C-1 — read a weekly-mileage goal straight from the member's Reclaim List ("Ride 115 miles per week"), so the
// synced Strava distance means something against their own words. No tracker needed — Strava IS the meter here.
// Matches "N miles per week", "N mi/week", "N miles a week", "N mi each week". Returns the miles, or null.
export function weeklyMileageGoalMiles(reclaimTexts: string[]): number | null {
  const re = /(\d+(?:\.\d+)?)\s*(?:mi|miles?)\s*(?:\/|per|a|each)\s*week/i;
  for (const t of reclaimTexts) {
    const m = (t ?? '').match(re);
    if (m) {
      const n = parseFloat(m[1]!);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

/** The reflective progress line: this week's synced miles against the weekly goal — witnessed, never graded. */
export function weeklyGoalLine(distanceM: number, goalMi: number): string {
  const twMi = distanceM / 1609.344;
  return twMi >= goalMi
    ? `${twMi.toFixed(0)} mi this week — past your ${goalMi}.`
    : `${twMi.toFixed(0)} of your ${goalMi} mi this week.`;
}

export function formatDuration(s: number): string | null {
  if (!s || s <= 0) return null;
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function typeLabel(t: ActivityType): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function relativeDay(daysAgo: number): string {
  if (daysAgo <= 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  return `${daysAgo}d ago`;
}

// A short "how long ago did we last pull from the provider" label for the Sync-now line (e.g. "just now", "8m ago",
// "3h ago", "2d ago"). Pure; `now` is injectable for tests. Returns null for a missing/invalid timestamp.
export function syncedAgo(iso: string | null, now: number = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const mins = Math.max(0, Math.floor((now - t) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
