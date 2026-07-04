// The harvest surface (v2.1 Increment 4) — realizes the frozen Harvest Event Contract v1.0 in the repo's
// two-layer shape: an immutable EVENT (member_event, kind='harvest_moment') for the SIGNAL, and stateful
// ARTIFACT commits (a keeper → playbook_entry), joined by a momentId. Onboarding harvest is deliberately LIGHT
// and opportunistic (restraint — never a running "keep this?" overlay); the single v2.1 detector is the
// member-confirmed identity phrase → a `definition` keeper. Community/share surfaces are deferred (v2.2).
import type { Db } from '../db/schema.ts';
import type { Collected } from './onboarding.ts';
import { identityLabel } from '../member/identity.ts';

// The keeper taxonomy lives in CONFIG here (never a DB check-constraint — the 0019/0024 tax); the artifact's
// keeper_type is authoritative, the event's meta.keeperType is intent-at-capture.
export const KEEPER_TYPES = ['lights_you_up', 'tell', 'recovery_move', 'definition', 'principle'] as const;
export type KeeperType = (typeof KEEPER_TYPES)[number];

const SCHEMA_VERSION = 1;

export type HarvestMoment = {
  destinationIntent: 'keeper' | 'share' | 'both';
  keeperType?: KeeperType;
  shareCategory?: string;
  sourceRef: { kind: string; ref?: string; label?: string }; // reuses playbook_entry's source_kind/ref/label trio
  payloadRef: string; // the member's committed verbatim words — NEVER the transcript
  private?: boolean; // a private-by-default source (e.g. Legacy Letter) → the event carries a reference, not the body
  surface?: string; // which operating surface emitted it (default 'onboarding'; 'reconnect' for a Doors re-seeing)
  pair?: { fromSlug?: string; toSlug: string }; // §2b R5: a re-seeing tell — from→to for a correct; toSlug only for an add
};

/** Emit the immutable harvest_moment event → member_event. Returns the momentId (the correlation id). */
export async function emitHarvestMoment(db: Db, memberId: string, m: HarvestMoment): Promise<string> {
  const meta = {
    destinationIntent: m.destinationIntent,
    keeperType: m.keeperType ?? null,
    shareCategory: m.shareCategory ?? null,
    sourceRef: m.sourceRef,
    pair: m.pair ?? null, // §2b R5: the from→to link a re-seeing tell carries; null for every other harvest
    schemaVersion: SCHEMA_VERSION,
    // Private sources never put the body in the QI log — a reference/flag instead.
    payloadRef: m.private ? `[private:${m.sourceRef.kind}]` : m.payloadRef,
  };
  const { rows } = await db.query<{ moment_id: string }>(
    `insert into member_event (member_id, kind, surface, ref, meta)
     values ($1, 'harvest_moment', $4, $2,
             jsonb_set($3::jsonb, '{momentId}', to_jsonb(gen_random_uuid()::text)))
     returning meta->>'momentId' as moment_id`,
    [memberId, m.sourceRef.ref ?? null, JSON.stringify(meta), m.surface ?? 'onboarding'],
  );
  return rows[0]!.moment_id;
}

/** Commit a keeper → playbook_entry (the stateful artifact). keeper_type is authoritative; moment_id links the
 *  event. Defaults to 'proposed' (propose-then-confirm); the caller passes 'kept' when it's already confirmed. */
export async function commitKeeper(
  db: Db,
  memberId: string,
  k: {
    momentId: string;
    keeperType: KeeperType;
    section: string;
    body: string;
    state?: 'proposed' | 'kept';
    source?: { kind: string; ref?: string; label?: string };
  },
): Promise<void> {
  await db.query(
    `insert into playbook_entry
       (member_id, section, body, authorship, state, keeper_type, moment_id, source_kind, source_ref, source_label, sort_order)
     values ($1,$2,$3,'gathered',$4,$5,$6,$7,$8,$9,
       (select coalesce(max(sort_order), -1) + 1 from playbook_entry where member_id = $1 and section = $2))`,
    [memberId, k.section, k.body.trim(), k.state ?? 'proposed', k.keeperType, k.momentId,
     k.source?.kind ?? null, k.source?.ref ?? null, k.source?.label ?? null],
  );
}

/** The ONE v2.1 detector (Decision R, minimal): a member-CONFIRMED identity phrase → a `definition` keeper,
 *  harvested once at onboarding commit. A skipped/unnamed identity harvests NOTHING (restraint). The identity
 *  was confirmed at the card, so the keeper lands 'kept' — immediately recall-ready via forCompanionContext
 *  (own_words / kept). Best-effort: the caller guards it so a harvest failure never fails the signup. */
export async function harvestIdentityKeeper(db: Db, memberId: string, c: Collected): Promise<string | null> {
  if (!c.identityNoun || c.identitySkipped) return null; // restraint: only a genuinely named + confirmed identity
  const label = identityLabel(c.identityNoun) || c.identityNoun;
  const phrase = (c.athleticPast ?? '').trim() || label; // the member's own words (the verbatim-locked capture)
  const momentId = await emitHarvestMoment(db, memberId, {
    destinationIntent: 'keeper',
    keeperType: 'definition',
    sourceRef: { kind: 'onboarding', ref: 'identity', label: `Identity · ${label}` },
    payloadRef: phrase,
  });
  await commitKeeper(db, memberId, {
    momentId,
    keeperType: 'definition',
    section: 'own_words',
    body: phrase,
    state: 'kept',
    source: { kind: 'own', ref: 'identity', label: `Identity · ${label}` },
  });
  return momentId;
}
