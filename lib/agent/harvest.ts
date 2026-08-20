// The harvest surface (v2.1 Increment 4) — realizes the frozen Harvest Event Contract v1.0 in the repo's
// two-layer shape: an immutable EVENT (member_event, kind='harvest_moment') for the SIGNAL, and stateful
// ARTIFACT commits (a keeper → playbook_entry), joined by a momentId. Onboarding harvest is deliberately LIGHT
// and opportunistic (restraint — never a running "keep this?" overlay); the single v2.1 detector is the
// member-confirmed identity phrase → a `definition` keeper. Community/share surfaces are deferred (v2.2).
import { randomUUID } from 'node:crypto';
import type { Db } from '../db/schema.ts';
import type { Collected } from './onboarding.ts';
import { identityLabel } from '../member/identity.ts';
import { isConversationalMeta } from './conversational-meta.ts';

// The keeper taxonomy lives in CONFIG here (never a DB check-constraint — the 0019/0024 tax); the artifact's
// keeper_type is authoritative, the event's meta.keeperType is intent-at-capture.
export const KEEPER_TYPES = ['lights_you_up', 'tell', 'recovery_move', 'definition', 'principle', 'plan'] as const;
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
             jsonb_set($3::text::jsonb, '{momentId}', to_jsonb(gen_random_uuid()::text)))
     returning meta->>'momentId' as moment_id`,
    [memberId, m.sourceRef.ref ?? null, JSON.stringify(meta), m.surface ?? 'onboarding'],
  );
  return rows[0]!.moment_id;
}

/**
 * A keeper the Companion is OFFERING. Nothing is in the Playbook yet — this crosses to the client, the member
 * taps Keep, and only then does it commit.
 *
 * WHY THIS TYPE EXISTS (Donna, 2026-08-19). Her Visualization "picture" was stored as "Can you remind me what is
 * on my Reclaim List?" — her own housekeeping question, filed as an insight about her. Most of what appeared
 * under "What Lights You Up" was that kind of text. Her words: it "signals the app isn't actually working."
 *
 * The cause was not the model's judgement. `state: 'proposed' | 'kept' | 'dismissed'` already existed, this
 * module's own doc already said the default was propose-then-confirm, and the store already knew how to promote a
 * proposal rather than duplicate it. The arc path simply hardcoded `state: 'kept'` and walked around the gate we
 * had built. So a member's aside became a permanent claim about her, and when she asked the Companion to fix it,
 * it could only say no — the entry was already committed.
 *
 * Jay's ruling, 2026-08-19: "Let the member decide inline before it gets posted." NOTHING is written until she
 * taps — not even a 'proposed' row. An ignored offer evaporates, which is the honest default: proposals that pile
 * up in a curation queue reproduce the same full-of-junk panel one step removed.
 *
 * The QI moment still fires when the offer is MADE, best-effort and outside the write path. That is deliberate:
 * it makes the decline rate measurable, which is the capture-quality signal we otherwise have no read on.
 */
export type KeeperProposal = {
  /** Correlates the offer's QI moment with the entry, if she keeps it. */
  momentId: string;
  keeperType?: string;
  /** The exact line being offered — shown to her verbatim, because she is ruling on these words. */
  body: string;
  /** What it IS ("Your picture", "Your true line") — the chip she sees. */
  label: string;
  ref: string;
};

/** Commit a keeper → playbook_entry (the stateful artifact). keeper_type is authoritative; moment_id links the
 *  event. Defaults to 'proposed' (propose-then-confirm); the caller passes 'kept' when it's already confirmed. */
export async function commitKeeper(
  db: Db,
  memberId: string,
  k: {
    momentId: string;
    /** Optional BY DESIGN. `keeper_type` is nullable, and chapterKey() switches on it FIRST — so a science read,
     *  which must reach the `why` chapter via section 'why_works' alone, has to commit WITHOUT one. Typing this as
     *  required forced an `as never` cast at that call site, which hid the intent behind a smell. */
    keeperType?: KeeperType;
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
    // `?? null` IS LOAD-BEARING, not defensive noise. keeperType became optional on 2026-08-17 so a science read
    // could commit WITHOUT one (the only way to reach the `why` chapter — see lib/content/teaching-keep.ts). Every
    // other caller passes a value, so this was the first `undefined` ever handed to this query — and undefined is
    // not a parameter value: PGlite coerced it locally, prod's driver did not, and the insert failed on prod only.
    // The card had already told the member "we'll keep the takeaway in your Playbook". Same family as the 7/27
    // silent drop: worked everywhere except where it mattered. Pass an explicit null.
    [memberId, k.section, k.body.trim(), k.state ?? 'proposed', k.keeperType ?? null, k.momentId,
     k.source?.kind ?? null, k.source?.ref ?? null, k.source?.label ?? null],
  );
}

/** Emit the QI moment AND commit the Playbook keeper as INDEPENDENT best-effort steps. The keeper is what the member
 *  actually SEES in their Playbook; the moment is only the QI correlation log. They must not share a fate: prod
 *  (2026-07-27) had `emitHarvestMoment` throwing on a `member_event` drift, and because every arc ran emit-then-commit
 *  inside ONE swallowed try, the throw silently dropped EVERY session keeper — Millie completed 6 sessions and
 *  harvested nothing. Here each step has its own guard and LOGS on failure (never a blind swallow); if the moment
 *  can't be written, the keeper still commits with a locally-generated correlation id. Use this for every arc harvest
 *  drain instead of hand-rolling emit+commit. */
export async function harvestSignal(
  db: Db,
  memberId: string,
  s: { kind: string; ref?: string; keeperType?: string; destinationIntent: 'keeper' | 'share' | 'both'; payloadRef: string; label?: string; private?: boolean; confirmed?: boolean },
  surface: string,
): Promise<KeeperProposal | null> {
  const ref = s.ref ?? s.kind;
  let momentId: string;
  try {
    momentId = await emitHarvestMoment(db, memberId, {
      destinationIntent: s.destinationIntent,
      keeperType: s.keeperType as KeeperType,
      surface,
      sourceRef: { kind: s.kind, ref, label: s.label ?? s.kind },
      payloadRef: s.payloadRef,
      private: s.private,
    });
  } catch (e) {
    console.error(`[harvest] moment emit failed (${surface}/${s.kind}) — offering the keeper anyway:`, e);
    momentId = randomUUID(); // the proposal still carries a valid correlation id; only the QI moment row is lost
  }
  // A keeper-intent signal is now OFFERED, not committed. Share-only and private signals never were.
  if (s.destinationIntent === 'share' || s.private) return null;

  // ALREADY CONFIRMED → commit, don't ask again.
  //
  // The line is whether the member EXPLICITLY AUTHORED this as the exercise's product and already signed off on
  // it: her Quality Days profile, her refined Reclaim List, her Lifestyle Pilot. Re-asking "keep this?" about a
  // thing she just deliberately built is friction that teaches her to tap past the question — which would blunt
  // the offer exactly where it matters, on the conversational captures that produced Donna's report.
  //
  // The DEFAULT IS TO ASK. A new harvest site that forgets this flag offers rather than commits, so the failure
  // mode of forgetting is a redundant question, not a silent claim about her.
  if (s.confirmed) {
    try {
      await commitKeeper(db, memberId, {
        momentId,
        keeperType: s.keeperType as KeeperType,
        section: 'own_words',
        body: s.payloadRef,
        state: 'kept',
        source: { kind: 'own', ref, label: s.label ?? s.kind },
      });
    } catch (e) {
      console.error(`[harvest] keeper commit failed (${surface}/${s.kind}):`, e);
    }
    return null;
  }

  return {
    momentId,
    keeperType: s.keeperType,
    body: s.payloadRef,
    label: s.label ?? s.kind,
    ref,
  };
}

/** Drain the harvest signals produced THIS turn — those the arc pushed beyond what the prior (client-sent) state
 *  already carried — each through harvestSignal. `pendingHarvest` ACCUMULATES in the arc state across turns, so the
 *  priorN offset is what stops earlier turns' signals from re-committing. This is the exact drain every arc action
 *  runs; it was previously hand-rolled per action (and untested end-to-end). Prev/next are the incoming state and the
 *  turn's resulting state. */
export async function drainHarvest(
  db: Db,
  memberId: string,
  prev: { pendingHarvest?: readonly unknown[] },
  next: { pendingHarvest?: readonly { kind: string; ref?: string; keeperType?: string; destinationIntent: 'keeper' | 'share' | 'both'; payloadRef: string; label?: string; private?: boolean }[] },
  surface: string,
): Promise<KeeperProposal[]> {
  const priorN = prev.pendingHarvest?.length ?? 0;
  const out: KeeperProposal[] = [];
  for (const s of (next.pendingHarvest ?? []).slice(priorN)) {
    // THE LAST GATE BEFORE A CARD IS PUT IN FRONT OF HER — and the one that has to hold for a member already
    // mid-arc. The producers upstream now refuse to queue a protest, but a queue is STATE: Donna's session was
    // carrying {label: "The spark", payloadRef: "I think we already did that and you were writing a letter for
    // me?"} at the moment this shipped, so the write-side fix alone would still have shown her that card.
    //
    // Checked HERE rather than at each producer for the usual reason — a rule restated at N sites has N-1 copies
    // waiting to drift apart — and because this is the single seam every arc's keepers cross on the way to a
    // member's screen. Nothing is destroyed: the signal stays in the queue and in the QI event log. It simply is
    // not OFFERED to her as an insight about her life.
    if (isConversationalMeta(s.payloadRef)) continue;
    const p = await harvestSignal(db, memberId, s, surface);
    if (p) out.push(p);
  }
  return out;
}

/**
 * She tapped Keep. NOW it lands.
 *
 * The one place a conversational keeper becomes a Playbook entry, so there is exactly one answer to "how did this
 * get in here?" — she put it there.
 */
export async function keepProposal(db: Db, memberId: string, p: KeeperProposal): Promise<void> {
  await commitKeeper(db, memberId, {
    momentId: p.momentId,
    keeperType: p.keeperType as KeeperType,
    section: 'own_words',
    body: p.body,
    state: 'kept',
    source: { kind: 'own', ref: p.ref, label: p.label },
  });
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
