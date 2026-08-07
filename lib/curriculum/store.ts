// Member-state store for the curriculum slice. Framework-free (takes a Db). Writes session progress,
// facets, earned badges, and phase gates. The curriculum/badge definitions live in registry.ts (data).
import type { Db } from '../db/schema.ts';
import { logEvent } from '../telemetry/store.ts';

export type SessionStatus = 'locked' | 'in_progress' | 'closed';
export type SessionProgress = {
  sessionId: string;
  currentStep: number;
  answers: Record<string, string>;
  status: SessionStatus;
};

export async function getSessionProgress(db: Db, memberId: string, sessionId: string): Promise<SessionProgress | null> {
  const { rows } = await db.query<{ current_step: number; answers: unknown; status: string }>(
    'select current_step, answers, status from session_progress where member_id=$1 and session_id=$2',
    [memberId, sessionId],
  );
  const r = rows[0];
  if (!r) return null;
  const answers = typeof r.answers === 'string' ? safeParse(r.answers) : ((r.answers as Record<string, string>) ?? {});
  return { sessionId, currentStep: Number(r.current_step), answers, status: (r.status as SessionStatus) ?? 'in_progress' };
}

function safeParse(s: string): Record<string, string> {
  try {
    const o = JSON.parse(s);
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

/** Persist one step's answer (merges into the answers map) and mark where the member is. */
export async function saveAnswer(db: Db, memberId: string, sessionId: string, step: number, answer: string, nextStep?: number): Promise<void> {
  const cur = Number.isFinite(nextStep as number) ? (nextStep as number) : step;
  await db.query(
    `insert into session_progress (member_id, session_id, current_step, answers, status, updated_at)
     values ($1,$2,$3, jsonb_build_object($4::text, $5::text), 'in_progress', now())
     on conflict (member_id, session_id) do update set
       answers = session_progress.answers || excluded.answers,
       current_step = greatest(session_progress.current_step, excluded.current_step),
       status = case when session_progress.status = 'closed' then session_progress.status else 'in_progress' end,
       updated_at = now()`,
    [memberId, sessionId, cur, String(step), answer],
  );
}

/** Close a Session (one close at the end). Returns false if there's no progress row to close. */
export async function closeSession(db: Db, memberId: string, sessionId: string): Promise<boolean> {
  const { rows } = await db.query<{ session_id: string }>(
    `update session_progress set status='closed', closed_at=now(), updated_at=now()
     where member_id=$1 and session_id=$2 returning session_id`,
    [memberId, sessionId],
  );
  return rows.length > 0;
}

// Force a session CLOSED even when no in-flight progress row exists — for the v2.3 conversational Rewire Sessions,
// which complete via the kernel (turn.complete), not the step player. Idempotent; drives the forecast's isDone.
export async function markSessionClosed(db: Db, memberId: string, sessionId: string): Promise<void> {
  // Emit session_close only on the FIRST close (completed once) — an idempotent re-close must not double-count.
  const prior = await db.query<{ status: string }>(
    `select status from session_progress where member_id = $1 and session_id = $2`,
    [memberId, sessionId],
  );
  const alreadyClosed = prior.rows[0]?.status === 'closed';
  await db.query(
    `insert into session_progress (member_id, session_id, status, closed_at)
     values ($1, $2, 'closed', now())
     on conflict (member_id, session_id) do update set status = 'closed', closed_at = now(), updated_at = now()`,
    [memberId, sessionId],
  );
  // Central completion signal (data contract) — covers every phase's close site in one place. Fire-safe.
  if (!alreadyClosed) await logEvent(db, memberId, 'session_close', { surface: 'session', ref: sessionId });
}

// Close a CHECKPOINT — the sibling of markSessionClosed, and for a long time the missing one.
//
// Checkpoints were completed by five separate sites that each did `setGate` + an unguarded `logEvent`, and NONE of
// them recorded the completion in session_progress. Two consequences, both found in Greg's walk on 2026-08-07:
//   · He crossed four checkpoints and session_progress held ZERO rows for them, so four of his thirteen completions
//     were invisible — "sessions closed" undercounts by one per phase, and checkpoint completion can't be measured.
//   · Re-entering a completed checkpoint re-emitted checkpoint_cross. His Reclaim capstone fired TWICE, 35 minutes
//     apart. A capstone that happens twice is worse than one that isn't recorded — it's a false event in QI.
//
// The data contract in CLAUDE.md requires started / completed / time-on-asset / drop-off for every asset, and a
// checkpoint is an asset. So: one function, idempotent, mirroring markSessionClosed exactly.
// NOTE the two ids. A checkpoint is known by THREE different names in here and they do not agree:
//   · the curriculum asset id   RCN-CHK · RWR-CHK · RBLD-B4 · RCL-C4   ← what getForecast's isDone matches on
//   · the event ref             RCN-CHK · RWR-CHK · RBD-CHK · RCL-CHK  ← what's already in every member's event log
//   · the workspace session key reconnect · rewire-checkpoint · b4 · c4
// The progress row must use the ASSET id or `closed.has(a.id)` never sees it; the event must keep its existing REF or
// deriveCheckpointTelemetry splits one checkpoint's history across two group keys. So both are passed explicitly
// rather than derived. Unifying the namespaces is a data migration and a separate decision — this does not paper
// over it, it just refuses to make it worse.
//
// The PRODUCT is already right: isDone treats the phase gate as truth for a checkpoint, so nothing about a member's
// experience is broken today. What's broken is only our ability to SEE it.
export async function markCheckpointClosed(
  db: Db,
  memberId: string,
  { assetId, eventRef, phase }: { assetId: string; eventRef: string; phase: string },
): Promise<void> {
  const prior = await db.query<{ status: string }>(
    `select status from session_progress where member_id = $1 and session_id = $2`,
    [memberId, assetId],
  );
  const alreadyClosed = prior.rows[0]?.status === 'closed';
  await db.query(
    `insert into session_progress (member_id, session_id, status, closed_at)
     values ($1, $2, 'closed', now())
     on conflict (member_id, session_id) do update set status = 'closed', closed_at = now(), updated_at = now()`,
    [memberId, assetId],
  );
  await setGate(db, memberId, `${phase}_checkpoint_passed`);
  // FIRST crossing only. Crossing a gateway between the Rs is a once-per-cycle event; re-reading the ceremony is not
  // a second crossing.
  if (!alreadyClosed) {
    await logEvent(db, memberId, 'checkpoint_cross', { surface: 'checkpoint', ref: eventRef, meta: { phase } });
  }
}

export async function isSessionClosed(db: Db, memberId: string, sessionId: string): Promise<boolean> {
  const { rows } = await db.query<{ status: string }>(
    'select status from session_progress where member_id=$1 and session_id=$2',
    [memberId, sessionId],
  );
  return rows[0]?.status === 'closed';
}

export async function closedSessionIds(db: Db, memberId: string): Promise<string[]> {
  const { rows } = await db.query<{ session_id: string }>(
    "select session_id from session_progress where member_id=$1 and status='closed'",
    [memberId],
  );
  return rows.map((r) => r.session_id);
}

// The session closed most recently, if within the given window (minutes). Powers the resume-hero's "you just finished X"
// state on the very next dashboard view, which then gives way to the next step. Returns the id only; the caller maps it
// to a label off the forecast (so the hero and the path never disagree).
export async function recentlyClosedSession(
  db: Db,
  memberId: string,
  withinMinutes: number,
): Promise<{ sessionId: string; closedAt: string } | null> {
  const { rows } = await db.query<{ session_id: string; closed_at: string }>(
    `select session_id, closed_at from session_progress
      where member_id=$1 and status='closed' and closed_at is not null
        and closed_at > now() - ($2 || ' minutes')::interval
      order by closed_at desc limit 1`,
    [memberId, String(withinMinutes)],
  );
  const r = rows[0];
  return r ? { sessionId: r.session_id, closedAt: r.closed_at } : null;
}

// --- Facets (the identity strip) ---
export type Facet = { text: string; sourceSession: string | null };

export async function listFacets(db: Db, memberId: string): Promise<Facet[]> {
  const { rows } = await db.query<{ text: string; source_session: string | null }>(
    'select text, source_session from facet where member_id=$1 order by sort_order, created_at',
    [memberId],
  );
  return rows.map((r) => ({ text: r.text, sourceSession: r.source_session }));
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Append a reclaimed identity to the strip. Dedupes case-insensitively. */
export async function addFacet(
  db: Db,
  memberId: string,
  text: string,
  sourceSession?: string,
): Promise<{ ok: boolean; reason?: 'empty' | 'duplicate' }> {
  const t = (text ?? '').trim();
  if (!t) return { ok: false, reason: 'empty' };
  const existing = await listFacets(db, memberId);
  if (existing.some((f) => norm(f.text) === norm(t))) return { ok: false, reason: 'duplicate' };
  await db.query(
    `insert into facet (member_id, text, source_session, sort_order)
     values ($1,$2,$3, (select coalesce(max(sort_order),0)+1 from facet where member_id=$1))`,
    [memberId, t, sourceSession ?? null],
  );
  return { ok: true };
}

// --- Badges (the passport) ---
export async function earnedBadgeIds(db: Db, memberId: string): Promise<string[]> {
  const { rows } = await db.query<{ badge_id: string }>('select badge_id from badge_earned where member_id=$1', [memberId]);
  return rows.map((r) => r.badge_id);
}

/** Earn a badge idempotently. Returns true only when newly earned (so the UI/ceremony fires once). */
export async function earnBadge(db: Db, memberId: string, badgeId: string): Promise<boolean> {
  const { rows } = await db.query<{ badge_id: string }>(
    `insert into badge_earned (member_id, badge_id) values ($1,$2)
     on conflict (member_id, badge_id) do nothing returning badge_id`,
    [memberId, badgeId],
  );
  return rows.length > 0;
}

// --- Phase gates ---
export async function listGates(db: Db, memberId: string): Promise<string[]> {
  const { rows } = await db.query<{ gate: string }>('select gate from phase_gate where member_id=$1', [memberId]);
  return rows.map((r) => r.gate);
}

export async function setGate(db: Db, memberId: string, gate: string): Promise<void> {
  await db.query('insert into phase_gate (member_id, gate) values ($1,$2) on conflict do nothing', [memberId, gate]);
}

export async function hasGate(db: Db, memberId: string, gate: string): Promise<boolean> {
  const { rows } = await db.query<{ one: number }>('select 1 as one from phase_gate where member_id=$1 and gate=$2', [memberId, gate]);
  return rows.length > 0;
}
