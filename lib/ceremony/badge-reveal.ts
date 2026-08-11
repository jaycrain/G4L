// The earned-milestone badge reveal for a phase ceremony (Decision WW). At a checkpoint crossing the badge is already
// earned; this surfaces it as the ceremony's climax. Flag-gated to the redesign — returns null on prod so the current
// ceremonies are untouched — and reads the name off the flag-appropriate badge set (identity-framed under REDESIGN).
import { getBadge } from '../curriculum/registry.ts';
import { redesignEnabled } from '../dashboard/redesign.ts';

// Carries the badge ID, not only its name: the reveal draws the REAL badge, and it cannot do that from a string.
// It used to be name-only, so every ceremony climax rendered the same hardcoded medal while the Badges panel showed
// distinct art — the milestone that is supposed to feel earned looked identical to every other one (Jay, 2026-08-11:
// "All the badges look the same in the mini-ceremony. Not like the actual in the panel.").
export type BadgeRevealData = { name: string; badgeId: string };

// The badge each phase ceremony awards.
export const CEREMONY_BADGE: Record<'reconnect' | 'rewire' | 'rebuild' | 'reclaim', string> = {
  reconnect: 'reconnect-milestone',
  rewire: 'rewire-milestone',
  rebuild: 'rebuild-milestone',
  reclaim: 'reclaim-capstone',
};

export function earnedBadgeReveal(phase: keyof typeof CEREMONY_BADGE): BadgeRevealData | null {
  if (!redesignEnabled()) return null;
  const b = getBadge(CEREMONY_BADGE[phase]);
  return b ? { name: b.name, badgeId: b.id } : null;
}

// The spoken line that introduces the reveal — kept generic so all four ceremonies share it.
export const BADGE_BEAT_COPY = 'And this one is yours now — earned, not given. It marks who you’re becoming.';
