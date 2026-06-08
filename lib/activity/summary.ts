// Pure presentation/framing helpers for the Activity Panel. Reflective, never a grade.

import type { ActivityType, WeekStats } from './types.ts';

/** The one reflective line on the panel — witnesses the identity, never scores it. */
export function framingLine(identityNoun: string | null, thisWeek: WeekStats): string {
  if (thisWeek.count === 0) return 'A quiet week — that is part of it too.';
  const noun = identityNoun ? `THE ${identityNoun.toUpperCase()}` : 'You';
  return `${noun} has been showing up.`;
}

export function formatDistance(m: number | null): string | null {
  if (!m || m <= 0) return null;
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
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
