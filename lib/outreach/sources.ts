// The grounding layer (Governance §4 + §8). Proactive outreach may only reflect back what the member actually gave
// us — so `gatherSources` returns REAL provenance from three streams and nothing else: their own words (kept keepers),
// their Reclaim List, and their logged momentum pattern. Every candidate is a {stream, ref, quote} the message must be
// built from; if a member has none, the engine holds (never invents a reason to reach out). Ordering is trigger-biased
// (a reclaim_milestone leads with the list; a post_log leads with the pattern) but the set is always real data.

import type { Db } from '../db/schema.ts';
import type { Provenance, OutreachTrigger } from './config.ts';

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

// Which stream leads, by trigger — the rest always follow (real data is never dropped, only reordered).
const LEAD: Record<OutreachTrigger, ('reclaim' | 'words' | 'pattern')[]> = {
  morning_presence: ['words', 'reclaim', 'pattern'],
  post_log: ['pattern', 'words', 'reclaim'],
  pattern: ['pattern', 'reclaim', 'words'],
  reclaim_milestone: ['reclaim', 'words', 'pattern'],
  checkpoint_due: ['reclaim', 'words', 'pattern'],
  re_engagement: ['words', 'reclaim', 'pattern'],
  community_share: ['words', 'reclaim', 'pattern'],
};

/**
 * The engine's grounding dependency: gather every real source for this member, ordered for the trigger, capped.
 * Empty result → the engine holds ("no groundable source"): we never reach out with nothing to reflect back.
 */
export async function gatherSources(db: Db, memberId: string, trigger: OutreachTrigger): Promise<Provenance[]> {
  const [words, reclaim, pattern] = await Promise.all([
    memberWords(db, memberId),
    reclaimSources(db, memberId),
    momentumPattern(db, memberId),
  ]);
  const byStream = { words, reclaim, pattern };
  const order = LEAD[trigger] ?? ['words', 'reclaim', 'pattern'];
  return order.flatMap((s) => byStream[s]).slice(0, MAX_SOURCES);
}
