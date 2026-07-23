// Cadence gate — Governance §7b + Impl Plan Dial 1 (Decision EEE): relatedness protection so the Companion is a
// presence, never surveillance. PURE + testable; produces the `cadenceOk` the pre-send validator (§10) consumes.
// Model (per the EEE delta): a member-SET rhythm + generous default + AUTO-BACK-OFF toward a floor when ignored —
// not a fixed ceiling. In-app-on-open is NOT "reaching out" (the member came to us), so it's exempt from the
// ceiling + quiet hours; the only rule that still applies in-app is no-double-nudge (one open thread at a time).

import { RHYTHM_WEEKLY_MAX, BACKOFF_AFTER_IGNORED, BACKOFF_FLOOR, DEFAULT_QUIET, IN_APP_COOLDOWN_HOURS, type Rhythm } from './config.ts';

// Rhythm ordered by increasing quietness; 'on_ask' is separate (never proactive). Back-off walks DOWN this list.
const RHYTHM_ORDER: Exclude<Rhythm, 'on_ask'>[] = ['daily', 'few_week', 'weekly'];

/** The rhythm actually in force after back-off: consecutive ignored outreaches decay it one step per threshold,
 *  floored at BACKOFF_FLOOR. 'on_ask' never becomes proactive. Pure. */
export function effectiveRhythm(set: Rhythm, ignoredStreak: number): Rhythm {
  if (set === 'on_ask') return 'on_ask';
  const steps = Math.floor(Math.max(0, ignoredStreak) / BACKOFF_AFTER_IGNORED);
  const floorIdx = RHYTHM_ORDER.indexOf(BACKOFF_FLOOR as Exclude<Rhythm, 'on_ask'>);
  const idx = Math.min(RHYTHM_ORDER.indexOf(set as Exclude<Rhythm, 'on_ask'>) + steps, floorIdx);
  return RHYTHM_ORDER[idx]!;
}

// Quiet window may wrap midnight (default 21→7). Hour is the member's LOCAL hour (timezone resolved upstream).
export function inQuietHours(localHour: number, quiet = DEFAULT_QUIET): boolean {
  const { startHour: s, endHour: e } = quiet;
  return s > e ? localHour >= s || localHour < e : localHour >= s && localHour < e;
}

export type CadenceInput = {
  channel: 'in_app' | 'outbound'; // in-app = shown when the member opens the app; outbound = email/SMS/push
  rhythm: Rhythm;
  ignoredStreak: number; // consecutive ignored/dismissed outreaches → drives back-off
  outboundLast7d: number; // outbound touches in the rolling 7 days → checked against the rhythm ceiling
  hasOpenThread: boolean; // a proactive message is already out + unanswered (§7b no double-nudge)
  hoursSinceLastInApp: number | null; // since we last SURFACED an in-app nudge — enforces the in-app cooldown floor
  localHour: number; // 0–23, member local
  quiet?: { startHour: number; endHour: number };
};

export type CadenceResult = { ok: boolean; reason: string | null; effectiveRhythm: Rhythm };

/** Is it OK, cadence-wise, to surface an outreach right now? The validator turns `ok` into its CADENCE-LEGAL check. */
export function cadenceCheck(i: CadenceInput): CadenceResult {
  const eff = effectiveRhythm(i.rhythm, i.ignoredStreak);
  const hold = (reason: string): CadenceResult => ({ ok: false, reason, effectiveRhythm: eff });

  // No double-nudge applies everywhere — one open thread at a time.
  if (i.hasOpenThread) return hold('double-nudge: an open thread is already out');

  // In-app cooldown floor — even in-app can't surface/regenerate more than ~once a day. This is what stops the
  // dismiss→regenerate treadmill (dismiss clears the open thread, but the cooldown still holds).
  if (i.channel === 'in_app') {
    if (i.hoursSinceLastInApp !== null && i.hoursSinceLastInApp < IN_APP_COOLDOWN_HOURS) return hold('in-app cooldown');
    // In-app doesn't count against the weekly ceiling and isn't a reach-out, so past the cooldown it's clear.
    return { ok: true, reason: null, effectiveRhythm: eff };
  }

  // Outbound: honor only-when-asked, quiet hours, and the (back-off-adjusted) weekly rhythm ceiling.
  if (eff === 'on_ask') return hold('rhythm: only when asked');
  if (inQuietHours(i.localHour, i.quiet)) return hold('quiet hours');
  if (i.outboundLast7d >= RHYTHM_WEEKLY_MAX[eff]) return hold('over the weekly rhythm ceiling');

  return { ok: true, reason: null, effectiveRhythm: eff };
}
