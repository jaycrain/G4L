// Beat selection — "given where this member is right now, what's the next right thing to serve?"
// For the slice: filter to eligible (readiness met, not already completed), then serve the first
// in authored registry order — which is sequenced Reconnect → Rewire → Rebuild → Reclaim and
// within-asset, so the frontier Beat is a coherent "next." Ranking sophistication (dose/fit to
// recent signals) is a deliberate later layer.

import { allBeats, type Beat, type Channel } from './registry.ts';
import { isReady } from './readiness.ts';
import type { MemberBeatState } from './types.ts';

// A `once` Beat already completed is done. (Rhythm-based re-serving of daily/weekly Beats is a
// scheduler concern deferred past the slice; here a completed Beat is simply not re-selected.)
function notYetDone(beat: Beat, s: MemberBeatState): boolean {
  return !s.completedBeatIds.has(beat.beat_id);
}

const channelOk = (beat: Beat, want: Channel) =>
  want === 'either' || beat.channel === 'either' || beat.channel === want;

export function eligibleBeats(s: MemberBeatState, channel: Channel = 'in_app'): Beat[] {
  return allBeats().filter(
    (b) => b.source === 'asset_beat' && channelOk(b, channel) && isReady(b, s) && notYetDone(b, s),
  );
}

const R_ORDER: Record<string, number> = { reconnect: 0, rewire: 1, rebuild: 2, reclaim: 3, cross_cutting: 4 };
const DOSE_ORDER: Record<string, number> = { light: 0, medium: 1, heavy: 2 };

// Rank eligible Beats: don't skip ahead (earlier R first); within an R, dose toward the member's
// weakest IDQ dimension (the Strategy's "subscores tune which Beats are served"); then lighter
// first. Array.sort is stable, so equal Beats keep authored registry order.
export function rankBeats(beats: Beat[], s: MemberBeatState): Beat[] {
  return [...beats].sort((a, b) => {
    const r = (R_ORDER[a.position.r] ?? 9) - (R_ORDER[b.position.r] ?? 9);
    if (r !== 0) return r;
    const aLow = s.lowestDimension && a.serves.includes(s.lowestDimension) ? 0 : 1;
    const bLow = s.lowestDimension && b.serves.includes(s.lowestDimension) ? 0 : 1;
    if (aLow !== bLow) return aLow - bLow;
    return (DOSE_ORDER[a.dose] ?? 1) - (DOSE_ORDER[b.dose] ?? 1);
  });
}

/** The next Beat to serve on the in-app surface, or null if nothing is currently eligible. */
export function selectNextBeat(s: MemberBeatState): Beat | null {
  return rankBeats(eligibleBeats(s, 'in_app'), s)[0] ?? null;
}

