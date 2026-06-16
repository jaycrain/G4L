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

export async function getMemberEvents(db: Db, memberId: string, limit = 2000): Promise<MemberEvent[]> {
  const { rows } = await db.query<RawEvent>(
    `select kind, surface, ref, step, meta, created_at from member_event
       where member_id = $1 order by created_at asc limit $2`,
    [memberId, limit],
  );
  return rows.map((r) => ({
    kind: r.kind as EventKind,
    surface: r.surface,
    ref: r.ref,
    step: r.step == null ? null : Number(r.step),
    meta: (typeof r.meta === 'object' && r.meta ? (r.meta as Record<string, unknown>) : {}),
    createdAt: toIso(r.created_at),
  }));
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

// Convenience: one call for the per-member read (admin panel + agent context).
export type MemberExperience = {
  sessions: SessionTelemetry[];
  surfaces: SurfaceUsage[];
  summary: string;
  totalEvents: number;
};

export async function getMemberExperience(
  db: Db,
  memberId: string,
  titleOf: (sessionId: string) => string,
): Promise<MemberExperience> {
  const events = await getMemberEvents(db, memberId);
  const sessions = deriveSessionTelemetry(events);
  const surfaces = deriveSurfaceUsage(events);
  return { sessions, surfaces, summary: experienceSummary(sessions, surfaces, titleOf), totalEvents: events.length };
}
