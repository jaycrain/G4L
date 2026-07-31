// Dashboard change-detection (Pillar 2). Snapshot the member's key signals each interaction; on the
// next one, diff against the last snapshot so the companion can notice what MOVED and reflect it —
// the "watched over" feeling that underpins trust. Pure + framework-free; the agent does the phrasing.

export type DashboardSnapshot = {
  idScore: number | null;
  grinta: number | null;
  beatsDone: number;
  reclaimedItems: string[]; // texts of items in the reclaimed state
  measures: Record<string, number | null>; // latest reading per measure label
  closedSessions?: string[]; // titles of completed curriculum Sessions (Identity Excavation, …)
  namedSelves?: string[]; // reclaimed identity facets the member has named
  activePhase?: string | null; // the R they're currently in (Reconnect/Rewire/…) — changes when a Checkpoint is crossed
};

const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Coerce a stored jsonb blob into a snapshot (tolerant of older/missing shapes). */
export function asSnapshot(raw: unknown): DashboardSnapshot | null {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    idScore: n(o.idScore),
    grinta: n(o.grinta),
    beatsDone: typeof o.beatsDone === 'number' ? o.beatsDone : 0,
    reclaimedItems: Array.isArray(o.reclaimedItems) ? (o.reclaimedItems as string[]) : [],
    measures: o.measures && typeof o.measures === 'object' ? (o.measures as Record<string, number | null>) : {},
    closedSessions: Array.isArray(o.closedSessions) ? (o.closedSessions as string[]) : [],
    namedSelves: Array.isArray(o.namedSelves) ? (o.namedSelves as string[]) : [],
    activePhase: typeof o.activePhase === 'string' ? o.activePhase : null,
  };
}

/**
 * Pure: human-readable list of what changed from the last snapshot to now. Empty when there's no
 * prior snapshot (first interaction — nothing to compare) or nothing moved. The agent rephrases these.
 */
export function diffSnapshot(prev: DashboardSnapshot | null, curr: DashboardSnapshot): string[] {
  if (!prev) return [];
  const out: string[] = [];

  if (prev.idScore != null && curr.idScore != null && curr.idScore !== prev.idScore) {
    out.push(`ID Score: ${prev.idScore} → ${curr.idScore}`);
  }
  if (prev.grinta != null && curr.grinta != null && curr.grinta !== prev.grinta) {
    out.push(`Grinta Index: ${prev.grinta} → ${curr.grinta}`);
  }
  if (curr.beatsDone > prev.beatsDone) {
    const d = curr.beatsDone - prev.beatsDone;
    // "Beat" is retired member-facing vocabulary (Jay, 2026-07-31) and no member on production can close one.
    // The count is now filtered to real closes, so this line effectively cannot fire — but if the surface ever
    // returns, it must not reintroduce the word to a member.
    out.push(`${d} new program rep${d === 1 ? '' : 's'} completed (now ${curr.beatsDone})`);
  }
  const wasReclaimed = new Set(prev.reclaimedItems);
  for (const t of curr.reclaimedItems) if (!wasReclaimed.has(t)) out.push(`Newly reclaimed: "${t}"`);

  // Curriculum Sessions they've finished (Identity Excavation, …) since last time.
  const wasClosed = new Set(prev.closedSessions ?? []);
  for (const t of curr.closedSessions ?? []) if (!wasClosed.has(t)) out.push(`Finished ${t}`);

  // New reclaimed selves they named (the identity strip got a facet).
  const wasNamed = new Set((prev.namedSelves ?? []).map((s) => s.toLowerCase()));
  for (const s of curr.namedSelves ?? []) if (!wasNamed.has(s.toLowerCase())) out.push(`Named a self they're reclaiming: ${s}`);

  // Crossed a Checkpoint into a new R — a real milestone the companion should witness.
  if (prev.activePhase && curr.activePhase && curr.activePhase !== prev.activePhase) {
    out.push(`Crossed into ${curr.activePhase} (${prev.activePhase} complete)`);
  }

  for (const [label, cv] of Object.entries(curr.measures)) {
    if (!(label in prev.measures)) {
      if (cv != null) out.push(`New tracker started: ${label} (${cv})`);
      continue;
    }
    const pv = prev.measures[label];
    if (pv != null && cv != null && pv !== cv) out.push(`${label}: ${pv} → ${cv}`);
  }
  return out;
}
