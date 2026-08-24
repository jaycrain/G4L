// PEOPLE WHO STARTED AND DIDN'T FINISH — the population the console could not see.
//
// Every console read (roster.ts, console.ts) joins member_profile, and a member row exists only after the final
// "This is me" tap. So anyone still in the conversation, or who walked away mid-way, appeared NOWHERE. On
// 2026-08-15 a tester spent hours across three onboarding attempts and was invisible the entire time; we only
// knew because she was on the phone with Jay. Drop-off — the number that matters most before Charter — has been
// unobservable, and a person in distress mid-onboarding was unobservable with it.
//
// ── WHAT THIS DELIBERATELY DOES NOT RETURN ────────────────────────────────────────────────────────────────
// No transcript. No gap text. No Reclaim items. These people are NOT members: they never finished, never got an
// account, and some of them chose to walk away. A console that ambiently displays the private disclosures of
// people who declined to join is the kind of thing that is fine right up until the day it isn't.
//
// What comes back is SHAPE — how far they got, how long ago, whether they're stuck, whether they're in trouble.
// That answers every operational question Jay actually has. The words themselves stay behind a deliberate,
// logged reveal (see revealProspectTranscript), which is a stricter door than the one that already exists: the
// diagnostic API returns the whole transcript today with far less ceremony.
//
// ── WHY NOT SIMPLY "METADATA ONLY" ────────────────────────────────────────────────────────────────────────
// Because that would be theatre. The content is already reachable, so a rule that only removes the governed
// path pushes an operator to the ungoverned one. Break-glass makes the access rarer AND recorded.

import type { Db } from '../db/schema.ts';

/** How stale before a still-open conversation reads as abandoned rather than in progress. Deliberately short:
 *  onboarding is one sitting, so a gap of hours already means something interrupted them. */
export const STALLED_AFTER_HOURS = 6;

/** Matches purge_expired_auth() in migration 0064. The surface must never outlive the data it describes — a row
 *  older than this is already gone (or about to be), and listing it would promise an operator something to open
 *  that is not there. */
export const PROSPECT_WINDOW_DAYS = 30;

export type ProspectStatus =
  | 'crisis'    // distress detected — a human owes them a follow-up
  | 'ready'     // finished the whole conversation and did NOT commit; the costliest drop-off we have
  | 'active'    // mid-conversation, recently
  | 'stalled'   // mid-conversation, gone quiet
  | 'declined'; // the scope gate turned them away (a correct outcome, not a loss)

export type Prospect = {
  email: string;
  /** The name they typed at the gate (0090). Null for anyone who started before that shipped — there is nowhere
   *  to recover it from, so the surface says the email and does not guess. */
  name: string | null;
  stage: string | null;
  turns: number;
  updatedAt: string;
  hoursAgo: number;
  identityNoun: string | null;
  hasGap: boolean;
  reclaimCount: number;
  doorCount: number;
  crisisFlaggedAt: string | null;
  status: ProspectStatus;
};

/**
 * PURE, so the ranking that decides what an operator sees first is testable without a database.
 *
 * Order matters more than it looks. `crisis` outranks everything — it is the only status with a governance
 * clock attached. `ready` comes next because it is the most actionable and the most expensive: they did the
 * entire conversation and stopped one tap short, which is a bug or a moment of doubt, and either is worth
 * knowing today rather than in a weekly export.
 */
export function prospectStatus(
  row: { stage: string | null; crisisFlaggedAt: string | null },
  hoursAgo: number,
): ProspectStatus {
  if (row.crisisFlaggedAt) return 'crisis';
  if (row.stage === 'declined') return 'declined';
  if (row.stage === 'complete') return 'ready';
  return hoursAgo >= STALLED_AFTER_HOURS ? 'stalled' : 'active';
}

const RANK: Record<ProspectStatus, number> = { crisis: 0, ready: 1, stalled: 2, active: 3, declined: 4 };

/** Most urgent first, then most recent. */
export function sortProspects(list: Prospect[]): Prospect[] {
  return [...list].sort(
    (a, b) => RANK[a.status] - RANK[b.status] || b.updatedAt.localeCompare(a.updatedAt),
  );
}

/** A one-line read of where they stopped — computed, never model-written, so it cannot invent a step. */
export function dropOffLabel(p: Prospect): string {
  if (p.status === 'declined') return 'Turned away at the scope gate';
  if (p.status === 'ready') return 'Finished the conversation — never tapped “This is me”';
  if (!p.hasGap) return 'Early — before they named what changed';
  if (!p.reclaimCount) return 'Named the gap — no Reclaim List yet';
  return `Building the list — ${p.reclaimCount} so far`;
}

export async function listProspects(db: Db, now: Date = new Date()): Promise<Prospect[]> {
  // `.test` addresses are excluded to match every other console read — seeded demo members must never be
  // mistaken for real drop-off, which is exactly the kind of thing that quietly corrupts a funnel number.
  const { rows } = await db.query<{
    email: string;
    display_name: string | null;
    stage: string | null;
    turns: number;
    updated_at: string;
    identity_noun: string | null;
    has_gap: boolean;
    reclaim_count: number;
    door_count: number;
    crisis_flagged_at: string | null;
  }>(
    `select s.email,
            s.display_name,
            s.state->>'stage'                                                  as stage,
            coalesce(jsonb_array_length(s.messages), 0)                        as turns,
            s.updated_at,
            s.state->'collected'->>'identityNoun'                              as identity_noun,
            coalesce(length(s.state->'collected'->>'gap') > 0, false)           as has_gap,
            coalesce(jsonb_array_length(s.state->'collected'->'reclaimList'),0) as reclaim_count,
            coalesce(jsonb_array_length(s.state->'collected'->'doors'), 0)      as door_count,
            s.crisis_flagged_at
       from onboarding_session s
      where s.email not like '%.test'
        and s.updated_at > now() - ($1 || ' days')::interval
        -- A committed signup deletes its session, so anything still here has NOT become a member. The guard is
        -- belt-and-braces for the window where a delete failed but the member exists.
        and not exists (select 1 from member_profile m where lower(m.email) = lower(s.email) and m.active)
      order by s.updated_at desc`,
    [String(PROSPECT_WINDOW_DAYS)],
  );

  const list = rows.map((r) => {
    const updatedAt = new Date(r.updated_at).toISOString();
    const hoursAgo = Math.max(0, (now.getTime() - new Date(r.updated_at).getTime()) / 3_600_000);
    const base = {
      email: r.email,
      name: r.display_name?.trim() || null,
      stage: r.stage,
      turns: Number(r.turns) || 0,
      updatedAt,
      hoursAgo,
      identityNoun: r.identity_noun,
      hasGap: Boolean(r.has_gap),
      reclaimCount: Number(r.reclaim_count) || 0,
      doorCount: Number(r.door_count) || 0,
      crisisFlaggedAt: r.crisis_flagged_at ? new Date(r.crisis_flagged_at).toISOString() : null,
    };
    return { ...base, status: prospectStatus(base, hoursAgo) };
  });

  return sortProspects(list);
}

/**
 * The one "Needs you" row for prospects — PURE, so what counts as needing him is testable.
 *
 * ONLY THE STATUSES WITH SOMETHING TO DO. `active` is someone typing right now: they do not need the founder,
 * they need ten more minutes. `stalled` is ambiguous — a lunch break looks identical to walking away — and a
 * queue that fills with maybes is a queue he stops reading. What is left is the three he can act on today:
 * a person in distress, a person who did the whole conversation and stopped one tap short, and a person we
 * turned away who may have been turned away wrongly (which is exactly what happened on 2026-08-14).
 */
export function prospectAttention(
  s: Record<ProspectStatus, number>,
): { kind: 'prospect'; label: string; count: number; href: string } {
  const parts: string[] = [];
  if (s.crisis) parts.push(`${s.crisis} needing a human`);
  if (s.ready) parts.push(`${s.ready} finished without signing up`);
  if (s.declined) parts.push(`${s.declined} turned away at the gate`);
  return {
    kind: 'prospect',
    label: parts.length ? parts.join(' · ') : 'nobody waiting at the door',
    count: s.crisis + s.ready + s.declined,
    href: '/admin/prospects',
  };
}

/** The counts the console header needs, without a second query. */
export function summarizeProspects(list: Prospect[]): Record<ProspectStatus, number> & { total: number } {
  const out = { crisis: 0, ready: 0, active: 0, stalled: 0, declined: 0, total: list.length };
  for (const p of list) out[p.status] += 1;
  return out;
}

// ── BREAK-GLASS ───────────────────────────────────────────────────────────────────────────────────────────

export type ProspectTranscript = { email: string; turns: Array<{ role: string; text: string }> };

/**
 * Reveal what a prospect actually wrote. The deliberate, recorded exception to everything above.
 *
 * THE LOG COMES FIRST, AND ITS FAILURE STOPS THE REVEAL. That ordering is the entire control. If the write
 * were best-effort — or worse, fired after the read — then a logging outage would silently downgrade this to
 * the ungoverned access it was built to replace, and it would look identical from the outside. The one thing
 * that must never happen here is reading a non-member's story with no record that anyone did.
 *
 * Deliberately NOT wrapped in a try/catch: the caller surfaces the failure to the operator. "Couldn't open it"
 * is a fine outcome; "opened it, didn't record it" is not.
 */
export async function revealProspectTranscript(
  db: Db,
  email: string,
  operator: { id: string | null; label: string },
): Promise<ProspectTranscript> {
  const { recordProspectAccess } = await import('./access-log.ts');
  await recordProspectAccess(db, {
    operatorId: operator.id,
    operatorLabel: operator.label,
    email,
    note: 'revealed the onboarding transcript from the console',
  });

  const { rows } = await db.query<{ email: string; messages: unknown }>(
    'select email, messages from onboarding_session where lower(email) = lower($1)',
    [email.trim()],
  );
  const row = rows[0];
  if (!row) return { email, turns: [] };

  // Defensive re-parse: prod has historically stored jsonb double-encoded (migration 0077 unwrapped it), and a
  // legacy row that comes back as a STRING would otherwise render as characters-in-a-list rather than turns.
  const raw = typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages;
  const turns = Array.isArray(raw)
    ? raw.map((m) => ({ role: String((m as { role?: string })?.role ?? 'member'), text: String((m as { text?: string })?.text ?? '') }))
    : [];
  return { email: row.email, turns };
}
