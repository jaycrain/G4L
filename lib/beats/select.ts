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

/** The next Beat to serve on the in-app surface, or null if nothing is currently eligible. */
export function selectNextBeat(s: MemberBeatState): Beat | null {
  return eligibleBeats(s, 'in_app')[0] ?? null;
}

/** Eligible cross-cutting Hardiness Beats (daily heartbeat; run across every gate). */
export function eligibleHardiness(s: MemberBeatState): Beat[] {
  return allBeats().filter((b) => b.source === 'hardiness_beat' && isReady(b, s));
}
