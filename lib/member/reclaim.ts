// Reconnect required outputs — data contract (docs/CONTRACTS.md §6).
// Every Reconnect variant must produce: the Reclaim List and the baseline ID Score, plus the member's
// fade story in their own words. The Door(s) are an OPTIONAL routing tag (Doors Taxonomy Spec v1.0 §1 —
// recognition is decoupled from routing; a null Door is valid for a real Fade). This module validates
// the Reclaim List and any Doors present.
//
// Reclaim List sizing (Decision Log, voice rewrite v1): a soft AIM of 3 (toward ~7), no maximum.
// The agent gently keeps drawing more out toward the target, but never forces a count.
// (Superseded the earlier "exactly 7" rule.)
//
// Gate-1 decision (Jay, Jun 26 2026): the ≥3 is no longer a HARD finalize floor — a member who names fewer
// and signals done completes anyway, and the confirmation card carries the shortfall (post-onboarding / MA
// editing reaches the aim). The hard floor for finalize is RECLAIM_LIST_FLOOR (≥1 real item); RECLAIM_LIST_MIN
// stays the AIM that drives the agent's single never-trap nudge. See docs/onboarding-staged-capture-shape.md
// §"Gate 1" + the Decision Log.

import { isDoorSlug, type DoorSlug } from '../doors.ts';

export const RECLAIM_LIST_MIN = 3; // soft aim — drives the agent's nudge; NOT a hard finalize floor (see above)
export const RECLAIM_LIST_FLOOR = 1; // hard floor to finalize — at least one real, member-stated want
export const RECLAIM_LIST_TARGET = 7; // soft aim — guides the agent, not enforced

// --- Reclaim List consolidation (Jay's walk: repetitive/sloppy lists) -----------------------------------
// Clean a Reclaim List into tidy, non-redundant wants — applied at every USER-FACING point (the confirm reflect,
// the card, the commit) so a list stored sloppily (a live model that under-refined, OR a session RESUMED from
// before per-item cleanup) still comes out clean. Pure + order-preserving. Three rules:
//   • drop a bare close/confirmation ("that's about it", "looks great") that got captured as a want;
//   • fold a bare cadence fragment ("every day", "2-3 times a week") into the PREVIOUS want (it's a drill of it);
//   • collapse a token-SUBSET near-dup ("Lose 50 lbs" ⊆ "My body, lose 50 lbs") to the more complete phrasing.
const RECLAIM_FILLER = new Set([
  'the', 'a', 'an', 'my', 'our', 'your', 'his', 'her', 'their', 'its', 'to', 'of', 'for', 'and', 'or', 'some',
  'just', 'more', 'get', 'getting', 'got', 'gets', 'want', 'wants', 'wanting', 'wanna', 'need', 'needs', 'needing',
  'i', 'im', 'be', 'being',
]);
function reclaimContentTokens(s: string): string[] {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w && !RECLAIM_FILLER.has(w));
}
const BARE_CADENCE_RE =
  /^(every\s+(day|morning|evening|night|week|weekend)s?|daily|weekly|nightly|on\s+weekends?|most\s+(days|mornings)|(a\s+few|once|twice|[1-9][0-9]?(\s*[-–to]+\s*[1-9][0-9]?)?)\s*(times?|x|days?)?\s*(a|per|each|\/)?\s*(day|week|morning|month)?)$/i;
// Anchored (^…$) whole-item drop: the ENTIRE item must BE a close phrase to drop it — strict on purpose so a real
// want that merely CONTAINS a close word is never dropped. Its vocabulary is locked to agree with the capture-side
// memberClosingReclaim via tests/reclaim-close-vocab.test.ts, so a close like "those are the highlights" can't slip
// capture AND survive consolidation onto the card / into the committed list.
const RECLAIM_CLOSE_RE =
  /^(that'?s (about )?(it|all|everything|the list)( for now)?|that'?s a (good|solid|great|decent) (start|list)|those are (the )?(real|only|main|biggest|big|top) ones|those are (the )?highlights|the highlights|(that|this) (looks|sounds) (great|good|right|perfect|spot on)|love (it|that)|perfect|good enough|sounds good|(i think )?that'?s (about )?(it|everything)|(i )?do(n'?t| not) think so|not that i can think of)$/i;

// A whole-item META / conversational-repair fragment the model sometimes mis-captures as a want — confusion,
// "I don't understand", "wait/what", "never mind". Same family as a bare close: zero want-content, so it's dropped
// deterministically (never a correction of member intent — there's nothing to correct). Anchored ^…$ + whole-item
// ONLY, strict on purpose: a real want that merely CONTAINS one of these words (e.g. "Make sense of my finances")
// must never match. (Donna's walk: "This isn't making sense" landed on her list. Identity statements are handled
// separately — they carry real content, so they route out via the propose-confirm shape gate, never a silent drop.)
const RECLAIM_META_RE =
  /^(?:(?:this|that|it|none of (?:this|that|it))\s+(?:is\s?n['’]?t|does\s?n['’]?t|do(?:es)? not)\s+(?:really\s+)?(?:mak(?:e|ing))\s+sense|makes?\s+no\s+sense|i\s+(?:do\s?n['’]?t|do not)\s+(?:understand|get\s+(?:it|this)|know what (?:you|this|that) mean(?:s)?)|(?:wait|hmm+|huh|um+|uh+|what|sorry)|never\s?mind|nvm|not\s+sure(?:\s+(?:what|i\s+understand))?|(?:i'?m\s+)?confused)$/i;

/** True if the whole item is a confusion/meta-repair fragment, never a want. Shared by the capture guard (reject
 *  before it's appended) and consolidation (backstop for a resumed/legacy sloppy list) — one source of truth. */
export function isReclaimMetaFragment(item: string): boolean {
  const bare = (item ?? '').trim().replace(/[.,!?]+$/, '');
  return !!bare && RECLAIM_META_RE.test(bare);
}

// Consolidate the Reclaim List AND its parallel categories in LOCKSTEP, so the two arrays never drift out of
// alignment when items are dropped/folded/merged. This is the single source of truth for consolidation; the
// items-only `consolidateReclaimList` below delegates to it. Category rule follows the item's fate: a close/dup
// that's dropped drops its category too; a cadence fold keeps the previous item's category; an "existing ⊆ new"
// replace adopts the more-complete new item's category. (Fixes: finalize consolidated the list but index-matched the
// STALE categories → an item could inherit the wrong category, which drives its coaching path — persisted at commit.)
export function consolidateReclaim(items: string[], categories: string[] = []): { items: string[]; categories: string[] } {
  const kept: string[] = [];
  const keptTokens: Set<string>[] = [];
  const keptCats: string[] = [];
  (items ?? []).forEach((raw, idx) => {
    const item = (raw ?? '').trim();
    const cat = categories[idx] ?? '';
    const bare = item.replace(/[.,!?]+$/, '');
    if (!item) return;
    if (RECLAIM_CLOSE_RE.test(bare)) return; // a close/confirmation, not a want (category dropped with it)
    if (RECLAIM_META_RE.test(bare)) return; // a confusion/meta fragment ("this isn't making sense"), not a want
    if (BARE_CADENCE_RE.test(bare) && kept.length > 0) {
      kept[kept.length - 1] = `${kept[kept.length - 1]}, ${item}`; // fold the cadence into the previous want (its category stays)
      reclaimContentTokens(item).forEach((t) => keptTokens[keptTokens.length - 1]!.add(t));
      return;
    }
    const toks = reclaimContentTokens(item);
    const tokSet = new Set(toks);
    let dup = false;
    for (let i = 0; i < kept.length; i++) {
      const ex = keptTokens[i]!;
      if (toks.length > 0 && toks.every((t) => ex.has(t))) { dup = true; break; } // new ⊆ existing → skip (drop this category)
      if (ex.size > 0 && [...ex].every((t) => tokSet.has(t))) { kept[i] = item; keptTokens[i] = tokSet; keptCats[i] = cat; dup = true; break; } // existing ⊆ new → replace (adopt the new item's category)
    }
    if (dup) return;
    kept.push(item);
    keptTokens.push(tokSet);
    keptCats.push(cat);
  });
  return { items: kept, categories: keptCats };
}

export function consolidateReclaimList(items: string[]): string[] {
  return consolidateReclaim(items).items;
}

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

/** A Reclaim List is valid with at least RECLAIM_LIST_FLOOR non-empty, member-stated items (no max). */
export function validateReclaimList(items: unknown): ValidationResult {
  if (!Array.isArray(items)) return { ok: false, errors: ['reclaim list must be an array'] };
  const errors: string[] = [];
  if (items.length < RECLAIM_LIST_FLOOR) {
    errors.push(`reclaim list must have at least ${RECLAIM_LIST_FLOOR} item (got ${items.length})`);
  }
  items.forEach((it, i) => {
    if (typeof it !== 'string' || it.trim().length === 0) {
      errors.push(`reclaim item ${i}: must be a non-empty string`);
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true };
}

/**
 * Validate the member's Door(s). Routing is OPTIONAL (Doors Taxonomy Spec v1.0 §1): a real-Fade member
 * whose story maps to no canonical Door is still served — recognition lives in their own words (the gap
 * narrative), not in the routing tag. So an EMPTY set is valid (null routing). Any slugs present must be
 * canonical.
 */
export function validateDoors(slugs: unknown): ValidationResult {
  if (!Array.isArray(slugs)) {
    return { ok: false, errors: ['doors must be an array'] };
  }
  const errors: string[] = [];
  slugs.forEach((s) => {
    if (!isDoorSlug(s)) errors.push(`unknown door: ${JSON.stringify(s)}`);
  });
  return errors.length ? { ok: false, errors } : { ok: true };
}

/** The complete Reconnect output, ready to persist to member_profile + member_door + idq_retake. */
export type ReconnectOutput = {
  reclaimList: string[]; // >= 3
  doors: DoorSlug[]; // zero or more — empty = null routing (valid for a real Fade), see §1
  baselineIdScore: number; // 0..100
};

export function validateReconnectOutput(o: {
  reclaimList: unknown;
  doors: unknown;
  baselineIdScore: unknown;
}): ValidationResult {
  const errors: string[] = [];
  const rl = validateReclaimList(o.reclaimList);
  if (!rl.ok) errors.push(...rl.errors);
  const d = validateDoors(o.doors);
  if (!d.ok) errors.push(...d.errors);
  if (typeof o.baselineIdScore !== 'number' || o.baselineIdScore < 0 || o.baselineIdScore > 100) {
    errors.push('baselineIdScore must be a number 0–100');
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

// The RAIL engine-guard (#6): does the member CLEARLY ask to ADD a want to their Reclaim List — and if so, what's
// the want, with the add-request wrapper stripped? Returns the want, or null. The rail (check-in) relies on the
// model calling add_reclaim_item; when the model chit-chats the ack instead ("that's a good one — anything else?"),
// the add is silently lost. This lets the engine catch that unfulfilled add-intent and backstop-capture it.
// CONSERVATIVE ON PURPOSE — only an EXPLICIT add cue fires, so a want merely mentioned in conversation is never
// auto-captured ("never assume past what they said"). The downstream addReclaimItemForMember still validates (fog
// rejected, dups folded), so a borderline match can't write junk. Positional "put X at the top" is a reorder, not
// an add — excluded. Pure + testable.
const RECLAIM_ADD_PREAMBLE_RE =
  /^\s*(?:i(?:['’]d| would)?\s+(?:like|want|love|need)\s+to\s+add\b[^.!?]*|(?:can|could|would)\s+you\s+(?:please\s+)?add\b[^.!?]*|please\s+add\b[^.!?]*)\s*[.!?]\s+/i;
const RECLAIM_ADD_LEAD_RE =
  /^\s*(?:i(?:['’]d| would)?\s+(?:want|like|love|need)\s+to\s+add|(?:can|could|would)\s+you\s+(?:please\s+)?add|please\s+add|add|put)\s+(.+?)(?:\s+(?:to|on|onto)\s+(?:my|the)\s+(?:reclaim\s+)?list)?\s*[.!?]*$/i;
export function reclaimAddIntent(message: string): string | null {
  const raw = (message ?? '').trim();
  if (!raw) return null;
  // A) "I'd like to add to the list. <want>" — the request is its own sentence; the want follows.
  const afterPreamble = raw.replace(RECLAIM_ADD_PREAMBLE_RE, '').trim();
  if (afterPreamble !== raw && afterPreamble.length >= 3) return afterPreamble;
  // B) "add <want> [to my list]" / "put <want> on my list" / "I want to add <want>".
  const m = raw.match(RECLAIM_ADD_LEAD_RE);
  if (m?.[1]) {
    const want = m[1].trim();
    // "put X at the top / first / up" is a REORDER, not an add — never treat it as one.
    if (want.length >= 3 && !/\b(?:at the top|to the top|first|last|up|down|above|below|before|after)\b/i.test(want)) {
      return want;
    }
  }
  return null;
}
