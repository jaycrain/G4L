// The grounding layer (Governance §4 + §8). Proactive outreach may only reflect back what the member actually gave
// us — so `gatherSources` returns REAL provenance from three streams and nothing else: their own words (kept keepers),
// their Reclaim List, and their logged momentum pattern. Every candidate is a {stream, ref, quote} the message must be
// built from; if a member has none, the engine holds (never invents a reason to reach out). Ordering is trigger-biased
// (a reclaim_milestone leads with the list; a post_log leads with the pattern) but the set is always real data.

import type { Db } from '../db/schema.ts';
import type { Provenance, OutreachTrigger } from './config.ts';
import { activeCommitments } from '../commitments/store.ts';

const MAX_SOURCES = 6; // enough for the generator to pick a fitting anchor; not a data dump

// ── Stream: words — the member's OWN language, verbatim, from their kept "gathered" keepers (own-words first) ──
export async function memberWords(db: Db, memberId: string, limit = 4): Promise<Provenance[]> {
  const { rows } = await db.query<{ id: string; body: string }>(
    `select id, body from playbook_entry
      where member_id = $1 and authorship = 'gathered' and state = 'kept'
      order by (section = 'own_words') desc, created_at desc
      limit $2`,
    [memberId, limit],
  );
  return rows.map((r) => ({ stream: 'words', ref: `keeper:${r.id}`, quote: r.body }));
}

// ── Stream: reclaim — the member's Reclaim List (active items only; soft-deleted rows never resurface) ──
export async function reclaimSources(db: Db, memberId: string, limit = 4): Promise<Provenance[]> {
  const { rows } = await db.query<{ id: string; text: string }>(
    `select id, text from reclaim_item
      where member_id = $1 and removed_at is null
      order by sort_order asc
      limit $2`,
    [memberId, limit],
  );
  return rows.map((r) => ({ stream: 'reclaim', ref: `reclaim:${r.id}`, quote: r.text }));
}

const CALL_NOUN: Record<string, [string, string]> = {
  good_call: ['good call', 'good calls'],
  false_start: ['false start', 'false starts'],
  quiet_day: ['quiet day', 'quiet days'],
};

// Fixed canonical order so the summary reads the same regardless of group-by row order.
const CALL_ORDER = ['good_call', 'false_start', 'quiet_day'] as const;

function describeCalls(counts: Record<string, number>): string | null {
  const types = [...CALL_ORDER, ...Object.keys(counts).filter((t) => !CALL_ORDER.includes(t as never))];
  const parts = types
    .filter((type) => (counts[type] ?? 0) > 0)
    .map((type) => {
      const n = counts[type]!;
      const noun = CALL_NOUN[type] ?? [type, type];
      return `${n} ${n === 1 ? noun[0] : noun[1]}`;
    });
  if (parts.length === 0) return null;
  const list = parts.length === 1 ? parts[0]
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `${list} in the last 7 days`;
}

// ── Stream: pattern — a FACTUAL summary of the member's logged calls (not words put in their mouth) ──
// The quote is an observation the member can recognize; the generator must reflect it factually (§9 causal humility).
export async function momentumPattern(db: Db, memberId: string): Promise<Provenance[]> {
  const { rows } = await db.query<{ type: string; n: string }>(
    `select type, count(*)::text n from momentum_call
      where member_id = $1 and logged_on >= current_date - 7
      group by type`,
    [memberId],
  );
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.type] = Number(r.n);
  const quote = describeCalls(counts);
  if (!quote) return [];
  return [{ stream: 'pattern', ref: 'momentum:7d', quote }];
}

// ── Stream: commitment — the CHECK-IN (Slice 4). The member's standing commitment(s) + a FACTUAL 7-day observation of
// calls logged toward each (never words in their mouth). Grounds the accountability touch: reflect follow-through
// (normalize) or notice a lapse (invite) — the generator holds the posture, this just supplies the real data. Empty
// when the member has no active commitment → the engine falls through to the other streams (behavior unchanged).
export async function commitmentSources(db: Db, memberId: string): Promise<Provenance[]> {
  const commitments = await activeCommitments(db, memberId).catch(() => []);
  if (!commitments.length) return [];
  const { rows } = await db.query<{ domain: string; type: string; n: string }>(
    `select domain, type, count(*)::text n from momentum_call
      where member_id = $1 and logged_on >= current_date - 6 and domain in ('activity','diet') and type in ('good_call','false_start')
      group by domain, type`,
    [memberId],
  );
  const good: Record<string, number> = {}, bad: Record<string, number> = {};
  for (const r of rows) (r.type === 'good_call' ? good : bad)[r.domain] = Number(r.n);
  return commitments.map((c) => {
    const g = good[c.domain] ?? 0, b = bad[c.domain] ?? 0;
    const progress =
      g === 0 && b === 0
        ? 'nothing logged toward it this week'
        : [g ? `${g} good call${g === 1 ? '' : 's'}` : '', b ? `${b} false start${b === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ') + ' this week';
    const serves = c.reclaimItemText ? ` (toward ${c.reclaimItemText})` : '';
    return { stream: 'commitment' as const, ref: `commitment:${c.domain}`, quote: `${c.text}${serves} — ${progress}` };
  });
}

// Which stream leads, by trigger — the rest always follow (real data is never dropped, only reordered). The commitment
// check-in LEADS morning-presence + the behavior triggers (post_log/pattern) so the daily touch reflects what the member
// chose to hold themselves to; it falls through to nothing when they've set no commitment.
const LEAD: Record<OutreachTrigger, SourceStreamKey[]> = {
  morning_presence: ['commitment', 'words', 'reclaim', 'pattern'],
  post_log: ['commitment', 'pattern', 'words', 'reclaim'],
  pattern: ['commitment', 'pattern', 'reclaim', 'words'],
  reclaim_milestone: ['reclaim', 'words', 'pattern', 'commitment'],
  checkpoint_due: ['reclaim', 'words', 'pattern', 'commitment'],
  re_engagement: ['commitment', 'words', 'reclaim', 'pattern'],
  community_share: ['words', 'reclaim', 'pattern', 'commitment'],
};
type SourceStreamKey = 'reclaim' | 'words' | 'pattern' | 'commitment';

/**
 * The engine's grounding dependency: gather every real source for this member, ordered for the trigger, capped.
 * Empty result → the engine holds ("no groundable source"): we never reach out with nothing to reflect back.
 */
export async function gatherSources(db: Db, memberId: string, trigger: OutreachTrigger): Promise<Provenance[]> {
  const [words, reclaim, pattern, commitment] = await Promise.all([
    memberWords(db, memberId),
    reclaimSources(db, memberId),
    momentumPattern(db, memberId),
    commitmentSources(db, memberId),
  ]);
  const byStream = { words, reclaim, pattern, commitment };
  const order = LEAD[trigger] ?? ['commitment', 'words', 'reclaim', 'pattern'];
  return order.flatMap((s) => byStream[s]).slice(0, MAX_SOURCES);
}
