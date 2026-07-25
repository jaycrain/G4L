// Experience telemetry — the append-only event log (member_event) + the derivations that turn raw
// events into a read of how a member moves through the product: time-on-asset, furthest step,
// drop-off, re-engagement, and which surfaces they actually use. The write path never throws (it must
// never break a page or an action); the derivations are pure so they unit-test without a database.

import type { Db } from '../db/schema.ts';

export type EventKind =
  | 'session_open'
  | 'session_step'
  | 'session_close'
  | 'checkpoint_open'
  | 'checkpoint_cross'
  | 'beat_serve'
  | 'beat_close'
  | 'daily_beat_view'
  | 'idq_start'
  | 'idq_complete'
  | 'onboarding_confirmed' // member confirmed the summary card → IDQ; meta holds the card snapshot + cardReturns
  | 'play_rerun' // member hit "Run it again" on a Playbook play; ref = the Session id the Companion re-runs
  | 'page_view';

export type LogOpts = { surface?: string | null; ref?: string | null; step?: number | null; meta?: Record<string, unknown> };

// Fire-safe: a telemetry failure must never surface to the member or abort the caller.
export async function logEvent(db: Db, memberId: string, kind: EventKind, opts: LogOpts = {}): Promise<void> {
  try {
    await db.query(
      `insert into member_event (member_id, kind, surface, ref, step, meta)
       values ($1,$2,$3,$4,$5,$6::jsonb)`,
      [memberId, kind, opts.surface ?? null, opts.ref ?? null, opts.step ?? null, JSON.stringify(opts.meta ?? {})],
    );
  } catch (e) {
    console.warn('telemetry: logEvent failed —', (e as Error).message);
  }
}

export type MemberEvent = {
  kind: EventKind;
  surface: string | null;
  ref: string | null;
  step: number | null;
  meta: Record<string, unknown>;
  createdAt: string; // ISO
};

type RawEvent = { kind: string; surface: string | null; ref: string | null; step: unknown; meta: unknown; created_at: unknown };

const toIso = (v: unknown): string => {
  const d = v instanceof Date ? v : new Date(v as string);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
};

const mapRawEvent = (r: RawEvent): MemberEvent => ({
  kind: r.kind as EventKind,
  surface: r.surface,
  ref: r.ref,
  step: r.step == null ? null : Number(r.step),
  meta: typeof r.meta === 'object' && r.meta ? (r.meta as Record<string, unknown>) : {},
  createdAt: toIso(r.created_at),
});

export async function getMemberEvents(db: Db, memberId: string, limit = 2000): Promise<MemberEvent[]> {
  const { rows } = await db.query<RawEvent>(
    `select kind, surface, ref, step, meta, created_at from member_event
       where member_id = $1 order by created_at asc limit $2`,
    [memberId, limit],
  );
  return rows.map(mapRawEvent);
}

// Bulk read for the operator roster: every active member's events in one query, grouped by member.
// Members with no events simply don't appear in the map (callers default to []).
export async function getEventsForMembers(db: Db, memberIds: string[]): Promise<Map<string, MemberEvent[]>> {
  const out = new Map<string, MemberEvent[]>();
  if (memberIds.length === 0) return out;
  const { rows } = await db.query<RawEvent & { member_id: string }>(
    `select member_id, kind, surface, ref, step, meta, created_at from member_event
       where member_id = any($1) order by member_id, created_at asc`,
    [memberIds],
  );
  for (const r of rows) {
    (out.get(r.member_id) ?? out.set(r.member_id, []).get(r.member_id)!).push(mapRawEvent(r));
  }
  return out;
}

// --- Pure derivations -----------------------------------------------------------------------

export type SessionTelemetry = {
  sessionId: string;
  opens: number; // how many times they came back to it (re-engagement)
  firstOpenAt: string | null;
  lastActivityAt: string | null;
  furthestStep: number; // deepest step reached
  closed: boolean;
  closedAt: string | null;
  durationMs: number | null; // first open → close — an engaged-time proxy (only when closed)
  dropOffStep: number | null; // furthest step when NOT closed (where they stalled); null once closed
};

// Roll the session_open / session_step / session_close events up per Session.
export function deriveSessionTelemetry(events: MemberEvent[]): SessionTelemetry[] {
  const byRef = new Map<string, MemberEvent[]>();
  for (const e of events) {
    if (e.kind !== 'session_open' && e.kind !== 'session_step' && e.kind !== 'session_close') continue;
    if (!e.ref) continue;
    (byRef.get(e.ref) ?? byRef.set(e.ref, []).get(e.ref)!).push(e);
  }
  const out: SessionTelemetry[] = [];
  for (const [sessionId, evs] of byRef) {
    const opens = evs.filter((e) => e.kind === 'session_open');
    const closeEv = evs.filter((e) => e.kind === 'session_close').at(-1) ?? null;
    const firstOpenAt = opens[0]?.createdAt ?? evs[0]?.createdAt ?? null;
    const furthestStep = evs.reduce((m, e) => (e.step != null && e.step > m ? e.step : m), 0);
    const closed = !!closeEv;
    const closedAt = closeEv?.createdAt ?? null;
    const lastActivityAt = evs.at(-1)?.createdAt ?? null;
    const durationMs =
      closed && firstOpenAt && closedAt ? Math.max(0, new Date(closedAt).getTime() - new Date(firstOpenAt).getTime()) : null;
    out.push({
      sessionId,
      opens: opens.length,
      firstOpenAt,
      lastActivityAt,
      furthestStep,
      closed,
      closedAt,
      durationMs,
      dropOffStep: closed ? null : furthestStep || null,
    });
  }
  // Most recent activity first.
  out.sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''));
  return out;
}

export type SurfaceUsage = { surface: string; views: number; lastAt: string };

// Page-view counts per surface (which panels a member actually opens).
export function deriveSurfaceUsage(events: MemberEvent[]): SurfaceUsage[] {
  const map = new Map<string, { views: number; lastAt: string }>();
  for (const e of events) {
    if (e.kind !== 'page_view' || !e.surface) continue;
    const cur = map.get(e.surface);
    if (cur) {
      cur.views += 1;
      if (e.createdAt > cur.lastAt) cur.lastAt = e.createdAt;
    } else {
      map.set(e.surface, { views: 1, lastAt: e.createdAt });
    }
  }
  return [...map.entries()]
    .map(([surface, v]) => ({ surface, views: v.views, lastAt: v.lastAt }))
    .sort((a, b) => b.views - a.views);
}

export type CheckpointTelemetry = {
  checkpointId: string;
  opens: number; // times they arrived at the gate
  crossed: boolean;
  firstOpenAt: string | null;
  crossedAt: string | null;
  timeToCrossMs: number | null; // first arrival → crossing (how long they sat at the gate)
};

// Roll checkpoint_open / checkpoint_cross up per checkpoint.
export function deriveCheckpointTelemetry(events: MemberEvent[]): CheckpointTelemetry[] {
  const byRef = new Map<string, MemberEvent[]>();
  for (const e of events) {
    if (e.kind !== 'checkpoint_open' && e.kind !== 'checkpoint_cross') continue;
    if (!e.ref) continue;
    (byRef.get(e.ref) ?? byRef.set(e.ref, []).get(e.ref)!).push(e);
  }
  const out: CheckpointTelemetry[] = [];
  for (const [checkpointId, evs] of byRef) {
    const opens = evs.filter((e) => e.kind === 'checkpoint_open');
    const crossEv = evs.filter((e) => e.kind === 'checkpoint_cross').at(-1) ?? null;
    const firstOpenAt = opens[0]?.createdAt ?? evs[0]?.createdAt ?? null;
    const crossedAt = crossEv?.createdAt ?? null;
    out.push({
      checkpointId,
      opens: opens.length,
      crossed: !!crossEv,
      firstOpenAt,
      crossedAt,
      timeToCrossMs:
        firstOpenAt && crossedAt ? Math.max(0, new Date(crossedAt).getTime() - new Date(firstOpenAt).getTime()) : null,
    });
  }
  out.sort((a, b) => (b.crossedAt ?? b.firstOpenAt ?? '').localeCompare(a.crossedAt ?? a.firstOpenAt ?? ''));
  return out;
}

export type BeatActivity = {
  total: number; // Beats closed
  lastAt: string | null;
  recent: { beatId: string | null; response: string | null; at: string }[]; // newest first, capped
};

export function deriveBeatActivity(events: MemberEvent[]): BeatActivity {
  const closes = events.filter((e) => e.kind === 'beat_close');
  const recent = closes
    .slice()
    .reverse()
    .slice(0, 8)
    .map((e) => ({ beatId: e.ref, response: (e.meta?.response as string) ?? null, at: e.createdAt }));
  return { total: closes.length, lastAt: closes.at(-1)?.createdAt ?? null, recent };
}

export type DailyBeatActivity = {
  days: number; // distinct days a Daily Beat was surfaced (one event per day)
  lastAt: string | null;
  recent: { reflectionId: string | null; at: string }[];
};

export function deriveDailyBeatActivity(events: MemberEvent[]): DailyBeatActivity {
  const views = events.filter((e) => e.kind === 'daily_beat_view');
  const recent = views
    .slice()
    .reverse()
    .slice(0, 8)
    .map((e) => ({ reflectionId: e.ref, at: e.createdAt }));
  return { days: views.length, lastAt: views.at(-1)?.createdAt ?? null, recent };
}

export type IdqActivity = {
  count: number; // completed IDQs (baseline + retakes)
  lastAt: string | null;
  latestScore: number | null;
};

export function deriveIdqActivity(events: MemberEvent[]): IdqActivity {
  const done = events.filter((e) => e.kind === 'idq_complete');
  const last = done.at(-1);
  return { count: done.length, lastAt: last?.createdAt ?? null, latestScore: (last?.meta?.idScore as number) ?? null };
}

const mins = (ms: number) => Math.max(1, Math.round(ms / 60000));

// A compact, governance-safe read of the member's experience for BOTH agents. Facts only —
// reflect, never grade. titleOf maps a session_id to its human title (registry lookup, injected
// so this stays DB- and registry-free and unit-testable).
export function experienceSummary(
  sessions: SessionTelemetry[],
  surfaces: SurfaceUsage[],
  titleOf: (sessionId: string) => string,
): string {
  const lines: string[] = [];
  for (const s of sessions.slice(0, 6)) {
    const title = titleOf(s.sessionId);
    if (s.closed) {
      const dur = s.durationMs != null ? `, ~${mins(s.durationMs)} min` : '';
      const repeat = s.opens > 1 ? `, opened ${s.opens}×` : '';
      lines.push(`Closed ${title}${dur}${repeat}.`);
    } else {
      const repeat = s.opens > 1 ? `opened ${s.opens}× but ` : '';
      const where = s.dropOffStep ? `stalled at step ${s.dropOffStep}` : 'just opened, no steps yet';
      lines.push(`Started ${title} — ${repeat}${where}.`);
    }
  }
  if (surfaces.length) {
    const top = surfaces.slice(0, 3).map((u) => `${u.surface} (${u.views})`).join(', ');
    lines.push(`Most-used surfaces: ${top}.`);
  }
  return lines.join(' ');
}

// Convenience: one call for the per-member read (admin panel + agent context). Each program
// surface gets its OWN readout (sessions / checkpoints / Beats / Daily Beat / IDQ) alongside the
// blended summary the agents read.
export type MemberExperience = {
  sessions: SessionTelemetry[];
  checkpoints: CheckpointTelemetry[];
  beats: BeatActivity;
  dailyBeat: DailyBeatActivity;
  idq: IdqActivity;
  surfaces: SurfaceUsage[];
  summary: string;
  totalEvents: number;
};

// --- Onboarding confirmation card (the saved snapshot + "keep talking" health metric) ------------

export type ConfirmationRecord = {
  cardReturns: number; // times the member sent the card back to fix/add before confirming
  card: Record<string, unknown> | null; // the SummaryCard snapshot as confirmed (immutable)
  at: string | null;
};

// The card a member confirmed at the end of onboarding, for /admin/member. Latest wins.
export async function getOnboardingConfirmation(db: Db, memberId: string): Promise<ConfirmationRecord | null> {
  const { rows } = await db.query<{ meta: unknown; created_at: unknown }>(
    `select meta, created_at from member_event
       where member_id = $1 and kind = 'onboarding_confirmed' order by created_at desc limit 1`,
    [memberId],
  );
  const r = rows[0];
  if (!r) return null;
  const meta = typeof r.meta === 'object' && r.meta ? (r.meta as Record<string, unknown>) : {};
  return {
    cardReturns: Number(meta.cardReturns ?? 0),
    card: (meta.card as Record<string, unknown>) ?? null,
    at: toIso(r.created_at),
  };
}

// Every onboarding's return count, for the roster-wide rate.
export async function getOnboardingReturns(db: Db): Promise<number[]> {
  const { rows } = await db.query<{ meta: unknown }>(
    `select meta from member_event where kind = 'onboarding_confirmed'`,
  );
  return rows.map((r) => {
    const m = typeof r.meta === 'object' && r.meta ? (r.meta as Record<string, unknown>) : {};
    return Number(m.cardReturns ?? 0);
  });
}

export type KeepTalkingStats = {
  confirmed: number; // onboardings that reached the card + confirmed
  withCorrections: number; // …that the member had to send back at least once
  ratePct: number; // withCorrections / confirmed — the capture-quality signal (lower is better)
  avgReturns: number; // mean corrections per onboarding
};

// Pure: roll return counts into the "keep talking" rate (the capture-quality health metric).
export function keepTalkingStats(returns: number[]): KeepTalkingStats {
  const confirmed = returns.length;
  const withCorrections = returns.filter((n) => n > 0).length;
  const total = returns.reduce((a, b) => a + b, 0);
  return {
    confirmed,
    withCorrections,
    ratePct: confirmed ? Math.round((withCorrections / confirmed) * 100) : 0,
    avgReturns: confirmed ? Math.round((total / confirmed) * 10) / 10 : 0,
  };
}

export async function getMemberExperience(
  db: Db,
  memberId: string,
  titleOf: (sessionId: string) => string,
): Promise<MemberExperience> {
  const events = await getMemberEvents(db, memberId);
  const sessions = deriveSessionTelemetry(events);
  const surfaces = deriveSurfaceUsage(events);
  return {
    sessions,
    checkpoints: deriveCheckpointTelemetry(events),
    beats: deriveBeatActivity(events),
    dailyBeat: deriveDailyBeatActivity(events),
    idq: deriveIdqActivity(events),
    surfaces,
    summary: experienceSummary(sessions, surfaces, titleOf),
    totalEvents: events.length,
  };
}
