// Redesign scaffold (D-08) — the VENDOR-AGNOSTIC Movement layer. The aggregator (ROOK for Cycle 1, Terra back-pocket)
// is one implementation of `MovementProvider`; everything above this interface is ours and swap-safe. The blend —
// synced activity + Companion-logged-from-conversation entries, tagged by provenance — is G4L's own layer. Governance
// (YY): every number maps to an identity goal and is INTERPRETED; never shown raw. Dormant until wired. Strava = Cycle 1.

export type MovementSource = 'strava' | 'apple_health' | 'peloton' | 'hevy' | 'garmin' | 'companion';
export type Provenance = 'synced' | 'logged'; // teal = synced (from a source), bullseye = logged (Companion, from conversation)
export type ActivityKind = 'ride' | 'run' | 'walk' | 'workout' | 'weight' | 'other';

export interface Activity {
  id: string;
  source: MovementSource;
  provenance: Provenance;
  kind: ActivityKind;
  occurredAt: string; // ISO 8601
  // Normalized metrics — NEVER rendered raw to the member. The meaning-layer maps them to a Reclaim goal + interprets.
  metrics?: { distanceKm?: number; durationMin?: number; weightKg?: number };
  title?: string;
}

// The aggregator adapter. ROOK / Terra each satisfy this; our code only ever sees `Activity`. Swapping the vendor is
// swapping this impl — the blend, timeline, and meaning-layer above are untouched.
export interface MovementProvider {
  readonly vendor: string; // 'rook' | 'terra'
  /** Begin an OAuth connect for a source (Strava first). Returns the URL to send the member to. */
  connectUrl(memberId: string, source: MovementSource): Promise<string>;
  /** Pull recent activity for a member since an ISO instant, already normalized to `Activity` (provenance = 'synced'). */
  pullRecent(memberId: string, since: string): Promise<Activity[]>;
}

// A Companion-logged entry (from conversation) → an Activity, tagged bullseye. No source metrics required.
export function loggedActivity(input: { id: string; kind: ActivityKind; occurredAt: string; title?: string }): Activity {
  return { ...input, source: 'companion', provenance: 'logged' };
}

// Blend synced + logged into ONE provenance-tagged timeline, newest first. When a synced activity and a Companion-logged
// one describe the SAME session (same kind, within `windowMin`), keep the SYNCED one (it carries real metrics) — so a
// ride you logged in conversation and then Strava-synced doesn't show twice. Pure + deterministic.
export function blendTimeline(synced: Activity[], logged: Activity[], windowMin = 90): Activity[] {
  const all = [...synced, ...logged].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const kept: Activity[] = [];
  for (const act of all) {
    const dup = kept.find(
      (k) =>
        k.kind === act.kind &&
        Math.abs(new Date(k.occurredAt).getTime() - new Date(act.occurredAt).getTime()) <= windowMin * 60_000,
    );
    if (!dup) {
      kept.push(act);
    } else if (dup.provenance === 'logged' && act.provenance === 'synced') {
      // a synced record supersedes the logged placeholder for the same session
      kept[kept.indexOf(dup)] = act;
    }
  }
  return kept;
}

// A goal is trackable ONLY if it maps to a quantifiable Movement metric (Jay 7/13, D-07). Qualitative goals stay bare.
export type TrackableMetric = 'distanceKm' | 'durationMin' | 'weightKg' | 'sessions';
export function isTrackableGoal(metric: TrackableMetric | null | undefined): boolean {
  return metric != null;
}
