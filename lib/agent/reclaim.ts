// Reclaim (v2.5, Phase 4 — Challenge / "the bigger world"). Config #5 on the shared arc kernel. Spec of record:
// G4L_Reclaim_Build_Approach_v0.2 + Greg's RECLAIM Gated Assets V4. The Cycle-1 capstone — closes the loop, hands to
// Community. Almost entirely REUSE (coaching mode, administered factory, Momentum, the checkpoint+ceremony pattern).
// SLICE 1 = C1 · Looking Forward — one stage: the Reclaim List refinement, COACH mode. (Was two; Greg cut the opening
// evidence self-check on 2026-08-07 and held it for Cycle 2 — see the C1 section below.) COACH mode: the
// model coaches the re-read/reflect/refine/re-prioritize, the engine proposes the refined list, and only the member's
// confirm commits it back to the live list (propose→confirm→commit, Decision L — never silent mutation). Flag-gated by
// RECLAIM (Decision JJ) — gated; flipped to Production 2026-07-10 (v2.5, all four Rs live).

import { MEMBER_AGENT_GOVERNED_CORE } from './system-prompt.ts';
import { sentenceStart } from '../content/member-words.ts';
import { runArcTurn, administeredStage, engagementStage, engagementOpening, elicitationStage, checkpointEngagement, receiveThen, withQuestion, AGREEMENT_1_5, AGREEMENT_1_5_HINT, scaleExpects, type ArcConfig, type StageDef } from './onboarding-staged.ts';
import { BEAT_SEP, type Collected, type ConvMessage, type ConvState, type Expectation, type ModelTurn, type Stage, type Turn } from './onboarding.ts';
import { TIER_LABEL, REFINE_TIERS, isTier, type Tier } from '../reclaim/refinement-store.ts';
import {
  AUDIT_ITEMS, AUDIT_ITEM_COUNT, AUDIT_SCALE_MAX, AUDIT_DOMAIN_STARTS, AUDIT_DOMAIN_LABEL, AUDIT_DOMAIN_INTRO,
  AUDIT_DOMAINS, AUDIT_SUB_ISSUES, AUDIT_REFLECTION_PROMPTS, AUDIT_SUB_ISSUE_ASK, AUDIT_SORT_QUESTIONS, AUDIT_SORT_INTRO, domainList,
  type AuditDomain,
} from '../reclaim/bigger-world-instrument.ts';
import { scoreAudit, priorityBarsVisual } from '../reclaim/bigger-world-scoring.ts';
import type { SessionVisual } from './session-visual.ts';
import { grintaStem, CHECKPOINT_CHALLENGE_ITEMS } from '../grinta/survey/instrument.ts';
import { saysNothingToChange, memberDeflecting, confirmsProposal } from './onboarding-intent.ts';
import { groundToMemberWords } from './member-words.ts';
import { proposalSignature, shouldPropose, markProposed, confirmOutranksRerecord, markRevisionAsked, type CoachGate } from './coach-gate.ts';
import { SESSION_LIMITS } from './session-limits.ts';

export function reclaimEnabled(): boolean {
  return process.env.RECLAIM?.trim() === 'staged';
}

// ══ C1 · Looking Forward — revisiting the Reclaim List (COACH mode) ═══════════════════════════════════════════
//
// STEP 1 IS GONE (Greg, 2026-08-07). C1 used to open with a 15-item evidence self-check (Physical / Relational /
// Identity) before the refinement. He cut it and held it for Cycle 2: "the questions at the beginning of C1 may be
// hard for people to comment on in Cycle 1 (since it is intentionally short) … I had tried to retain the survey items
// and added on to it with a Step 2 component but I don't think they fit together." In the V4 doc C1's Type changes
// Assessment → Reflection and the asset is retitled "Looking Forward". Cheap to remove because RC-2 made those
// responses FORMATIVE — never scored, never persisted, nothing read them. His items are preserved verbatim in
// lib/reclaim/evidence-instrument.ts, unwired, waiting for Cycle 2.
//
// Deleted with it: "If you rated yourself a 4 or 5 on most of these … you're ready for the Reclaim phase." That was a
// verdict handed to the member about themselves, which we should not have been shipping regardless.
//
// The one line worth keeping from the old opener is Greg's own, and it now opens the asset.
const C1_OPEN =
  "Reclaim isn't something anyone else declares for you. It's something you recognize in yourself.";

// ══ Revisiting the Reclaim List ═══════════════════════════════════════════════════════════════════════════════
// The transition (Greg's member-facing copy) + the member's CURRENT list, presented for the re-read. The list is
// seeded into collected.reclaimList by the opening action, so the arc stays pure.
function currentList(c: Collected): string[] {
  return (c.reclaimList ?? []).map((s) => (s ?? '').trim()).filter(Boolean);
}
function refineOpener(c: Collected): string {
  const list = currentList(c);
  const shown = list.length ? list.map((t) => `• ${t}`).join('\n') : '(your list is empty — we can build it here)';
  return (
    `${C1_OPEN}${BEAT_SEP}` +
    "At the start, you built this Reclaim List from who you were then. But, you've done a lot of work since then. " +
    "You've reconnected with who you are, seen what pulls you off course, and learned how your habits work. Let's " +
    `revisit it now to make sure it still fits the person you're becoming.${BEAT_SEP}Here's your list as it stands:\n\n${shown}${BEAT_SEP}Before changing anything, ` +
    "just notice it. What still feels true, what feels different, and what feels newly important?"
  );
}

const REFINE_NUDGE = "Take your time. Which items still matter most, which feel different now, and what's newly important?";
// Said when the refined list is captured and UNCHANGED since we showed it — see coach-gate.ts. The engine has
// nothing new to put on screen, so it says so rather than reprinting the list.
const REFINE_HOLD_NUDGE = "That's your list as it stands. Change anything you want, or tell me to save it.";
const REFINE_COMMITTED_1 = "Done — your Reclaim List now reflects where you actually are, sorted by what matters most right now.";
const REFINE_COMMITTED_2 = "I've kept a snapshot of where it was, too — so you can always see how it's shifted. You can revisit it anytime by asking for your Reclaim List.";

// Order tiers top→bottom for the proposal display.
const TIER_DISPLAY_ORDER: Tier[] = [...REFINE_TIERS];
// The engine-owned proposal — reflect the refined list back, grouped by tier, with the top-3, then the confirm gate.
function proposeRefinement(ref: NonNullable<Collected['pendingRefinement']>): string {
  // ADDITIONS APPEAR IN THEIR TIER, marked as new. A member cannot confirm what they cannot see, and an addition
  // is the one change here that puts a line on their list which was never there — the exact thing that must not
  // arrive silently. Marked rather than listed separately, so the confirmation shows the list AS IT WILL BE.
  const added = ref.added ?? [];
  const byTier = TIER_DISPLAY_ORDER.map((tier) => {
    const items = ref.items.filter((i) => i.tier === tier).map((i) => `  • ${i.text}`);
    const news = added.filter((a) => a.tier === tier).map((a) => `  • ${a.text}  (new)`);
    const all = [...items, ...news];
    if (!all.length) return '';
    return `${TIER_LABEL[tier]}:\n${all.join('\n')}`;
  }).filter(Boolean).join('\n\n');
  // A TOP-3 THAT IS THE WHOLE LIST NARROWS NOTHING (Donna, 2026-08-27). The program tells a member to start with
  // three items, so plenty of lists have exactly three — and this line then re-printed all three, immediately under
  // the three we had just printed, as though it were a selection. Only show it when it actually picks a subset.
  //
  // The trailing '.' also doubled: these items are the member's own sentences and most already end in one.
  const top3 = ref.top3.filter(Boolean);
  const totalItems = ref.items.length + added.length;
  const narrows = top3.length > 0 && top3.length < totalItems;
  const top3Line = narrows ? `\n\nThe three you'd move on next: ${top3.join(' · ').replace(/\.\s*$/, '')}.` : '';
  return `Here's your list, refined:\n\n${byTier}${top3Line}${BEAT_SEP}Want me to save this as your Reclaim List, or tweak something first?`;
}

// Shared commit vocabulary — see confirmsProposal. This was a fork of Rebuild's B3 gate and had drifted from it,
// so the same ordinary reply confirmed at one gate and dead-ended at the other.
export function refineConfirms(msg: string): boolean {
  return confirmsProposal(msg);
}
// Keep only refined items with a valid tier — the sanitized snapshot the engine holds + the action commits.
export function sanitizeRefinement(r: ModelTurn['refinement']): Collected['pendingRefinement'] | undefined {
  if (!r || !Array.isArray(r.items)) return undefined;
  const items = r.items
    .filter((i) => i && typeof i.original === 'string' && typeof i.text === 'string' && isTier(i.tier))
    .map((i) => ({ original: i.original.trim(), text: i.text.trim(), tier: i.tier }));
  if (!items.length) return undefined;
  const top3 = (Array.isArray(r.top3) ? r.top3 : []).filter((t): t is string => typeof t === 'string' && !!t.trim()).map((t) => t.trim());
  // Additions are sanitised on the SAME terms as refinements — text plus a valid tier, or they do not survive.
  // Deliberately not required: most refinements add nothing, and an empty `added` must read as "nothing new came
  // up" rather than as a malformed call.
  const added = (Array.isArray(r.added) ? r.added : [])
    .filter((a) => a && typeof a.text === 'string' && !!a.text.trim() && isTier(a.tier))
    .map((a) => ({
      text: a.text.trim(),
      tier: a.tier,
      ...(typeof a.emergedFrom === 'string' && a.emergedFrom.trim() ? { emergedFrom: a.emergedFrom.trim() } : {}),
    }));
  // ── A TOP-3 NAME THAT IS ON NO TIER IS A DROPPED ADDITION ──────────────────────────────────────────────────
  // Observed on a live walk, 2026-08-17: the member named a goal that was not on their list, and the model put it
  // in `top3` while leaving it out of BOTH `items` and `added`. The proposal then showed a list where the member's
  // stated top three included a line that appeared in no tier, and commitRefinement silently skips a top-3 entry
  // it cannot resolve — so they confirmed a priority that quietly did not exist.
  //
  // Recovering it is not a guess: naming something among the three you would move on next is unambiguous evidence
  // you want it. And it is not a silent write either — it becomes an `added` item, which the proposal renders as
  // "(new)" in its tier, so the member SEES it before the confirm gate and can say no. Surface, never infer.
  const known = new Set([...items.map((i) => i.text.toLowerCase()), ...items.map((i) => i.original.toLowerCase()), ...added.map((a) => a.text.toLowerCase())]);
  for (const t of top3) {
    if (known.has(t.toLowerCase())) continue;
    added.push({ text: t, tier: 'top' }); // named in the top three, so 'top' is their own placement
    known.add(t.toLowerCase());
  }
  return added.length ? { items, top3, added } : { items, top3 };
}

// ══ C1 · GREG'S SIX REVISION PASSES ═══════════════════════════════════════════════════════════════════════════
//
// C1.md:495 and the AI Companion Guidance for [Reclaim] Science-Check Language document (13 July, found
// 2026-08-29) between them specify SEVEN stages: engagement, then six passes over the Reclaim List — enduring ·
// de-prioritised · borrowed-or-vague · concretised · emergent · reorder. We shipped ONE open coaching turn.
//
// ONE CHANGE AT A TIME (Jay, 2026-08-29). The old contract had the model hand back a WHOLE rewritten list which
// the engine then diffed. Across six passes that is six chances to silently drop an item the member never
// mentioned — and a lost Reclaim List is the one failure we cannot detect after the fact, because the evidence
// is the thing that went missing. So a pass records exactly one operation, and the operation names the item it
// touches in the member's CURRENT wording, which the engine then has to find. [[their-own-words-back]]
//
// COMMIT AS YOU GO (Jay). Each pass proposes → the member confirms → it is applied, then the next pass opens. A
// member who stops after pass three keeps those three. The alternative — one confirmation at the end — is fewer
// decisions and loses everything if they leave mid-Session, which is the likelier event in a 20-minute Session.
export type ListChange =
  | { op: 'drop'; target: string }
  | { op: 'reword'; target: string; text: string }
  | { op: 'add'; text: string }
  | { op: 'reorder'; order: string[] };

/**
 * A model-proposed change, GROUNDED against the live list — or nothing.
 *
 * The grounding is the whole safety property. `target` must match an item that is actually on the list right now,
 * so the model cannot drop or reword something it invented, half-remembered, or paraphrased into a different
 * goal. Matching is exact-then-trimmed-case-insensitive and nothing looser: a fuzzy match here would silently
 * retarget a deletion onto the wrong item, which is worse than refusing the change.
 */
export function groundListChange(raw: unknown, list: readonly string[]): ListChange | null {
  const c = raw as { op?: unknown; target?: unknown; text?: unknown; order?: unknown } | null;
  if (!c || typeof c.op !== 'string') return null;
  const find = (t: unknown): string | null => {
    if (typeof t !== 'string' || !t.trim()) return null;
    const needle = t.trim().toLowerCase();
    return list.find((i) => i.trim().toLowerCase() === needle) ?? null;
  };
  if (c.op === 'drop') {
    const target = find(c.target);
    return target ? { op: 'drop', target } : null;
  }
  if (c.op === 'reword') {
    const target = find(c.target);
    const text = typeof c.text === 'string' ? c.text.trim() : '';
    // A reword to the same words is not a change; proposing it would ask a member to confirm a no-op.
    return target && text && text.toLowerCase() !== target.toLowerCase() ? { op: 'reword', target, text } : null;
  }
  if (c.op === 'add') {
    const text = typeof c.text === 'string' ? c.text.trim() : '';
    if (!text) return null;
    // An "addition" already on the list is a duplicate, and duplicates are how a list quietly doubles.
    return list.some((i) => i.trim().toLowerCase() === text.toLowerCase()) ? null : { op: 'add', text };
  }
  if (c.op === 'reorder') {
    const order = Array.isArray(c.order) ? c.order.map((x) => find(x)).filter((x): x is string => !!x) : [];
    // A reorder must account for EVERY item. A partial one is indistinguishable from a reorder that drops the
    // items it forgot to mention — the exact silent loss this contract exists to make impossible.
    return order.length === list.length && new Set(order).size === list.length ? { op: 'reorder', order } : null;
  }
  return null;
}

/** Apply a grounded change. PURE, and returns a NEW array — an in-place mutation would not survive the wire. */
export function applyListChange(list: readonly string[], c: ListChange): string[] {
  if (c.op === 'drop') return list.filter((i) => i !== c.target);
  if (c.op === 'reword') return list.map((i) => (i === c.target ? c.text : i));
  if (c.op === 'add') return [...list, c.text];
  return [...c.order];
}

/** What the member is being asked to confirm, in their own words and ours. */
export function describeListChange(c: ListChange): string {
  if (c.op === 'drop') return `Take “${c.target}” off the list?`;
  if (c.op === 'reword') return `Change “${c.target}” to “${c.text}”?`;
  if (c.op === 'add') return `Add “${c.text}” to your list?`;
  return `Put them in this order?\n\n${c.order.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
}

// C1's ENGAGEMENT BEAT — Greg's stage 1 (C1.md:495): "present opening frame, acknowledge prior module work,
// display the original [Reclaim] List, set the stance of refinement not correction." (His camel case normalised.)
//
// The stance line is the load-bearing one, and it is his: "The Companion should treat this as a process of
// refinement, not correction… The Member is revisiting their goals through a more informed, more experienced,
// and possibly more honest version of themselves." Without it a member reads six passes over their own list as
// a test they are failing.
const C1_OPEN_FRAME =
  // NOT "This is the list…" — claimsGateOutcome reads that as the model ANNOUNCING a list into existence,
  // which is the exact fault it was built for (Donna, 2026-08-20: a Reclaim List declared that did not
  // exist). Here the list is real and on screen, but the guard cannot know that, and weakening a guard to
  // fit new copy is how the next real claim gets through. Reworded instead. The walk harness caught it.
  'Your Reclaim List, from Reconnect — the things you said you wanted back.' + BEAT_SEP +
  'You have been through three phases since you wrote it. The point now is not to check whether you stuck to ' +
  'it. It is to read it again as the person you are now, and let it change where it should.' + BEAT_SEP +
  'Some items will still be exactly right. Some will have quietly stopped mattering. Some were never really ' +
  'yours. All of that is ordinary, and all of it is useful.';
const C1_OPEN_ASK = 'Reading it now — what feels different about this list than when you wrote it?';

/** The close. Their most-owned item, in their words, and what the refined list is for. */
function c1CloseAsk(_c: Collected): string {
  return 'Last one: of everything on there now, which single item feels most like yours?';
}
const C1_CLOSE =
  'That is your list, refined — not corrected. It is what the rest of Reclaim works from, and it is on your ' +
  'Playbook whenever you want to look at it.';

// GREG'S SIX PASSES, with his own "Better Companion prompts" and follow-ups from the AI Companion Guidance for
// [Reclaim] Science-Check Language document (13 July). His wording, not a paraphrase — he wrote these as the
// scientifically grounded version of the six blunter questions, and the difference is the whole point of the doc.
const C1_PASSES: readonly RevisionPass[] = [
  {
    id: 'c1-enduring', next: 'c1-deprioritise',
    ask: 'When you read your original list now, which items still feel most alive or most important?',
    followUps: [
      'What makes that item still feel important?',
      'Has its meaning changed, or just its priority?',
      'Does it feel more personal now than it did before?',
    ],
  },
  {
    id: 'c1-deprioritise', next: 'c1-borrowed',
    ask: 'Which items no longer feel as central as they once did?',
    followUps: [
      'What changed?',
      'Did this goal lose meaning, or did something else become more important?',
      'Does this feel like a pause, a release, or just a lower priority?',
    ],
  },
  {
    id: 'c1-borrowed', next: 'c1-concrete',
    ask: 'Are there goals on the list that sound right, but do not feel fully owned?',
    followUps: [
      'If you rewrote that goal in your own language, what would change?',
      'Would this still matter if nobody else expected it from you?',
      'Is the problem that the goal is wrong, or that it was never defined clearly enough?',
    ],
  },
  {
    id: 'c1-concrete', next: 'c1-emergent',
    ask: 'Which goals feel clearer or more tangible now than they did at the beginning?',
    followUps: [
      'What made it more concrete?',
      'Did the clarity come from understanding yourself better, or from seeing your habits more clearly?',
      'What would that goal look like in ordinary life now?',
    ],
  },
  {
    id: 'c1-emergent', next: 'c1-reorder',
    ask: 'Has anything become important that was not fully visible to you at the beginning?',
    followUps: [
      'What brought that into focus?',
      'Did this emerge from identity work, habit awareness, or seeing your health decisions more clearly?',
      'Does this new priority feel durable, or newly fragile?',
    ],
  },
  {
    id: 'c1-reorder', next: 'c1-close',
    ask: 'If you had to reorder the list now, what belongs near the top?',
    followUps: [
      'Why this one?',
      'What makes it more central than the others right now?',
      'Does it feel important because it is urgent, meaningful, achievable, or identity-linked?',
    ],
  },
];

/** The ask a pass hands ON to. The close is not a pass, so it carries its own line. */
function nextPassAsk(next: string, c: Collected): string {
  const p = C1_PASSES.find((x) => x.id === next);
  if (p) return p.ask;
  return c1CloseAsk(c);
}

/**
 * ONE REVISION PASS — the builder, used six times.
 *
 * Each pass asks Greg's question for that pass, lets the model draw the member out, and accepts AT MOST ONE
 * grounded change before handing on. The gate is propose → confirm → commit, in that order and never collapsed:
 * a change is applied only after the member has seen it written out and said yes. [[reclaim-c1-step2-data-contract]]
 *
 * A PASS CAN LEGITIMATELY CHANGE NOTHING. "No, they all still matter" is a complete answer to pass one, and the
 * beat has to hear it as one — otherwise the member learns that the way out is to invent an edit.
 */
type RevisionPass = {
  id: Stage;
  next: Stage;
  ask: string; // Greg's better prompt for this pass
  followUps: readonly string[]; // his follow-ups, used when the model trails into a statement
};

const PASS_MAX_TURNS = 6; // a pass is a question, not a beat to be held in

function revisionPassStage(cfg: RevisionPass): StageDef {
  type B = Parameters<NonNullable<StageDef['gather']>>[0];
  const handOn = (b: B): void => {
    b.stage = cfg.next;
    b.awaitingConfirm = false;
    b.reply = receiveThen(b.modelText, nextPassAsk(cfg.next, b.collected));
  };
  const gather: StageDef['gather'] = (b) => {
    const sc = b.scratch as { turns?: number; pending?: ListChange };
    sc.turns = (sc.turns ?? 0) + 1;
    const list = b.collected.reclaimList ?? [];

    // A grounded change from the model → PROPOSE it. Never applied on the turn it is recorded.
    const change = groundListChange((b.model as { listChange?: unknown }).listChange, list);
    if (change) {
      sc.pending = change;
      b.awaitingConfirm = true;
      b.reply = receiveThen(b.modelText, describeListChange(change));
      return;
    }
    // Nothing to change, and they have said so → move on. "Nothing" is an answer, not a failure to answer.
    //
    // saysNothingToChange IS THE HALF THAT WAS MISSING. This line read `memberDeflecting(...)` alone, and that
    // signal detects REFUSAL — "stop asking", "we're done" — not the answer these passes invite. So "list holds"
    // and "nothing to change" were treated as dodges and each pass held the member to PASS_MAX_TURNS. Donna said
    // it six times in one Session and counted. The comment above already stated the rule; the code did not run it.
    if (saysNothingToChange(b.memberMessage) || memberDeflecting(b.memberMessage) || sc.turns >= PASS_MAX_TURNS) {
      return handOn(b);
    }
    b.reply = withQuestion(b.modelText, cfg.followUps[Math.min(sc.turns - 1, cfg.followUps.length - 1)] ?? null);
  };
  const confirm: StageDef['confirm'] = (b) => {
    const sc = b.scratch as { turns?: number; pending?: ListChange };
    const pending = sc.pending;
    if (pending && confirmsProposal(b.memberMessage)) {
      // COMMITTED. A NEW array — mutating in place does not survive the wire, which cost a whole beat once.
      // [[mutating-state-vanishes-over-the-wire]]
      b.collected.reclaimList = applyListChange(b.collected.reclaimList ?? [], pending);
      // AND HAND IT TO THE ACTION TO PERSIST. Updating `collected` alone changes the conversation's copy of the
      // list and nothing else — which is precisely why this arc was built and left switched off overnight.
      b.pendingListChange = pending;
      sc.pending = undefined;
      return handOn(b);
    }
    // Not a yes. The change is DROPPED rather than held — a member who did not say yes to removing something from
    // their own list must not find it removed two turns later because the proposal was still sitting there.
    sc.pending = undefined;
    b.awaitingConfirm = false;
    b.reply = withQuestion(b.modelText, cfg.followUps[0] ?? null);
  };
  return { id: cfg.id, mode: 'drawout', opener: () => cfg.ask, offersSubstance: () => true, gather, confirm,
    forceProgress: (b) => handOn(b) };
}

const refineStage: StageDef = {
  id: 'refine',
  mode: 'coach',
  opener: (c) => refineOpener(c),
  offersSubstance: () => true,
  gather() {},
  confirm() {},
  coach(b) {
    const sc = b.scratch as CoachGate;
    // Capture the model's refined list (the whole result) into the snapshot — no live-list mutation here.
    const captured = sanitizeRefinement(b.model.refinement);
    if (captured) b.collected.pendingRefinement = captured;
    const ref = b.collected.pendingRefinement;
    // CAT-36(a) — top3 was a HARD precondition for proposing, but sanitizeRefinement happily lets an empty top3
    // through. That combination is a dead state: `ready` never fires, `proposed` is never set, the confirm branch
    // is unreachable, and every later "yes, save it" just re-emits model text. The member is stuck saying yes to
    // something that will never save. The refined ITEMS are the substance; a top-3 ordering is a nicety, and a
    // nicety must never be able to trap someone.
    const ready = !!ref && ref.items.length > 0;

    // CONFIRM FIRST — a member's plain "save it" outranks a model re-record on the same turn (see
    // confirmOutranksRerecord; found in B3's live walk, fixed across all three coach stages at once).
    const sig = proposalSignature(ref);
    if (confirmOutranksRerecord(sc, refineConfirms(b.memberMessage), sig)) {
      b.stage = 'complete';
      b.complete = true;
      b.reply = `${REFINE_COMMITTED_1}${BEAT_SEP}${REFINE_COMMITTED_2}`;
      return;
    }

    // THEN the change-check, then the hold. A list they have already seen is never printed again; only a genuinely
    // different one earns a fresh proposal.
    if (shouldPropose(sc, ready, sig)) {
      // The refined list is captured and DIFFERENT from anything already shown → PROPOSE it (engine-owned
      // reflection), then the confirm gate.
      markProposed(sc, sig);
      b.reply = proposeRefinement(ref!);
      return;
    }

    if (sc.proposed) {
      if (refineConfirms(b.memberMessage)) {
        // Member confirmed → COMPLETE. The ACTION commits the snapshot to the live list (member-authorized).
        b.stage = 'complete';
        b.complete = true;
        b.reply = `${REFINE_COMMITTED_1}${BEAT_SEP}${REFINE_COMMITTED_2}`;
        return;
      }
      // Not a confirm — a tweak the model hasn't recorded yet, or a question. Carry the turn and KEEP THE GATE
      // OPEN. (Caught by the C1 persona harness, scripts/c1-refine-walk.ts: "the duplicate keeps coming back no
      // matter what we agree on." A scripted member, not a real one — the harness found it, nobody suffered it.)
      // An ASK for a change is remembered, so the revised list is put back to them rather than saved unseen.
      markRevisionAsked(sc);
      b.reply = (b.modelText || REFINE_HOLD_NUDGE).trim();
      return;
    }

    // Still coaching — the model's turn IS the reply (its next question). Fallback only if the model is empty.
    b.reply = (b.modelText || REFINE_NUDGE).trim();
  },
};

// One stage now. The arc kernel still owns the turn (crisis routing, no-repeat, persistence) — see runArcTurn.
// C1's CLOSE — one turn. They name the item that feels most theirs; the engine closes on it.
const c1CloseStage: StageDef = {
  id: 'c1-close',
  mode: 'drawout',
  opener: (c) => c1CloseAsk(c),
  offersSubstance: () => true,
  gather: (b) => {
    b.stage = 'complete';
    b.complete = true;
    b.reply = receiveThen(b.modelText, C1_CLOSE);
  },
  confirm: (b) => {
    b.stage = 'complete';
    b.complete = true;
    b.reply = receiveThen(b.modelText, C1_CLOSE);
  },
};

const c1EngageConfig = {
  id: 'c1-open',
  next: 'c1-enduring',
  frame: () => C1_OPEN_FRAME,
  question: () => C1_OPEN_ASK,
  handIn: () => C1_PASSES[0]!.ask,
};

// GREG'S SEVEN STAGES, plus the close (C1.md:495). The old single 'refine' coach turn is RETIRED — it asked the
// model to settle the whole refinement in conversation and hand back a rewritten list, which is the contract Jay
// replaced on 2026-08-29 ("one change at a time"). Nothing is lost: every job it did is now a named pass.
// C1 · GREG'S SEVEN STAGES — LIVE (2026-08-30). Built 8/29 and deliberately held one night: a confirmed pass
// updated `collected.reclaimList` and nothing reached the member's actual list, which would not have errored —
// it would have told a member their list was refined while losing the change. commitListChange() in
// lib/reclaim/refinement-store.ts is the seam that was missing; the engine now emits each confirmed pass as
// `pendingListChange` and the action drains it on the same turn.
export const RECLAIM_C1_ARC: ArcConfig = {
  id: 'reclaim-c1',
  stageOrder: ['c1-open', ...C1_PASSES.map((p) => p.id), 'c1-close'],
  stages: {
    'c1-open': engagementStage(c1EngageConfig),
    ...Object.fromEntries(C1_PASSES.map((p) => [p.id, revisionPassStage(p)])),
    'c1-close': c1CloseStage,
  },
  onComplete: () => C1_CLOSE,
};

/** C1's opening under Greg's seven stages — the frame, the list, the stance, then the first pass. */
export function reclaimC1PassesOpening(listTexts: string[] = []): Turn {
  const collected: Collected = { reclaimList: listTexts.filter(Boolean) };
  return { reply: engagementOpening(c1EngageConfig, collected), state: { stage: 'c1-open', collected }, complete: false };
}

/** @deprecated alias kept for the tests written before the flip — same arc. */
export const RECLAIM_C1_PASSES_ARC = RECLAIM_C1_ARC;

export function applyReclaimC1PassesTurn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn = { text: '' }): Turn {
  return runArcTurn(RECLAIM_C1_PASSES_ARC, state, history, memberMessage, model);
}



// A session persisted mid-'evidence' when Step 1 was removed. `arc.stages['evidence']` is now undefined, so the kernel
// would run the turn with no stage definition — a stranded member on a page that answers nothing. Anyone part-way
// through the retired instrument is moved to the activity that replaced it and re-opened there, with their list shown.
// Cheap and lossless: RC-2 never persisted those responses, so there is nothing to carry across.
const RETIRED_C1_STAGES = new Set(['evidence']);

export function applyReclaimC1Turn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn = { text: '' }): Turn {
  if (RETIRED_C1_STAGES.has(state.stage)) {
    const collected = state.collected ?? {};
    return { reply: refineOpener(collected), state: { ...state, stage: 'refine', collected }, complete: false };
  }
  return runArcTurn(RECLAIM_C1_ARC, state, history, memberMessage, model);
}

// The opening seeds the member's CURRENT Reclaim List into collected (loaded by the action) so the coach can present it.
export function reclaimC1Opening(listTexts: string[] = []): Turn {
  return reclaimC1PassesOpening(listTexts);
}

// ── The live surface — the model COACHES the refinement and records the result via record_refinement ──
export const REFINE_SYSTEM =
  `${MEMBER_AGENT_GOVERNED_CORE}\n\n` +
  "YOU ARE RUNNING C1 — \"Looking Forward\", the first Session of Reclaim.\n\n" +
  "WHAT THIS IS. The member wrote a Reclaim List in Reconnect — the things they wanted back. They have since " +
  "come through three phases. They are re-reading that list as the person they are now.\n\n" +
  "GREG'S FRAME, AND IT IS THE WHOLE POSTURE: this is REFINEMENT, NOT CORRECTION. The earlier list was not " +
  "wrong; it reflected a different stage of understanding. Never imply they failed to stick to it, never praise " +
  "them for consistency, and never treat a dropped goal as a loss. Some items get stronger, some fade, some turn " +
  "out to have belonged to pressure or an earlier self. All of that is ordinary and useful.\n\n" +
  "THE ENGINE OWNS THE STRUCTURE. It walks six passes — what still matters, what has faded, what was borrowed or " +
  "vague, what has become concrete, what is newly important, and what belongs at the top. You do not announce " +
  "them, count them, or move between them. Answer what is in front of you and draw them out.\n\n" +
  "ONE CHANGE AT A TIME. When the member clearly asks for a change to their list, call record_list_change ONCE " +
  "with that single change. Never a rewritten list. `target` must be an item's exact current wording — if you " +
  "cannot quote it exactly, do not call the tool. The app shows them the change and applies it only if they " +
  "confirm; you are not the one saving it, so do not say it is saved.\n\n" +
  "DO NOT PROPOSE CHANGES THEY HAVE NOT ASKED FOR. A pass where nothing changes is a complete pass. \"They all " +
  "still matter\" is an answer, and treating it as a failure to answer teaches them to invent edits to their own " +
  "list.\n\n" +
  "NEVER LEAD THEM TO A PREFERRED ANSWER. Not \"so clearly health should be at the top now?\" — ask what feels " +
  "most central and let them say it. Do not overinterpret: a goal that faded does not mean it was never authentic.\n\n" +
  "SPEAK PROBABILISTICALLY. This exercise CAN help clarify what feels meaningful; it does not reveal their true " +
  "self, prove what really matters, or show who they are. Use: can help · may be showing you · often supports · " +
  "it would make sense if.\n\n" +
  "ONE QUESTION PER TURN. Reflect what they actually said before you ask." + SESSION_LIMITS;

const RECORD_LIST_CHANGE_TOOL = {
  name: 'record_list_change',
  description:
    "Record ONE change the member has clearly asked for to their Reclaim List. One call per change, never a " +
    "rewritten list. Only call when they have actually asked for it in their own words — not when you think an " +
    "item could be better. `target` MUST be an item's exact current wording from the list you were given; if you " +
    "cannot quote it exactly, do not call this. The app shows them the change and only applies it if they confirm.",
  input_schema: {
    type: 'object' as const,
    properties: {
      op: { type: 'string', enum: ['drop', 'reword', 'add', 'reorder'], description: 'what kind of change' },
      target: { type: 'string', description: "for drop/reword: the item's EXACT current wording" },
      text: { type: 'string', description: 'for reword: the new wording. for add: the new item, in their words' },
      order: { type: 'array', items: { type: 'string' }, description: 'for reorder: EVERY item, in the new order' },
    },
    required: ['op'],
  },
};

const RECORD_REFINEMENT_TOOL = {
  name: 'record_refinement',
  description:
    "Record the member's settled, refined Reclaim List so the app can show it back for confirmation. Pass every item " +
    "as {original, text, tier} and the top3 refined texts. Only call once the refinement is settled in conversation.",
  input_schema: {
    type: 'object' as const,
    properties: {
      items: {
        type: 'array',
        description: 'the refined list — one entry per current item',
        items: {
          type: 'object',
          properties: {
            original: { type: 'string', description: "the item's CURRENT wording (to match the live list)" },
            text: { type: 'string', description: 'the refined wording (or the same if unchanged)' },
            tier: { type: 'string', enum: [...REFINE_TIERS], description: 'the tier the member placed it in' },
          },
          required: ['original', 'text', 'tier'],
        },
      },
      added: {
        type: 'array',
        description:
          // Same reason as C3_SYSTEM below: a tool description is model-visible, so a name in one can reach the
          // member. The provenance belongs in a comment, not in the string. (This is question 5 of Greg's C1.)
          "goals the member named that were NOT already on their list — what has newly emerged. " +
          'Only include something they actually said they want; never invent one to fill this out. Omit entirely if nothing new came up, which is the common case.',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: "the new goal in the MEMBER'S OWN words" },
            tier: { type: 'string', enum: [...REFINE_TIERS], description: 'where they placed it' },
            emergedFrom: { type: 'string', description: 'what brought it into view, if they said — their words. Optional.' },
          },
          required: ['text', 'tier'],
        },
      },
      top3: { type: 'array', items: { type: 'string' }, description: 'the three refined texts the member would move on next' },
    },
    required: ['items', 'top3'],
  },
};

function refineStageNote(state: ConvState): string {
  const list = currentList(state.collected ?? {});
  return `\n\nRIGHT NOW: the member's current Reclaim List is:\n${list.map((t) => `• ${t}`).join('\n') || '(empty)'}\n\nCoach the refinement one step at a time; when it's settled, call record_refinement with the whole refined list.`;
}

function parseRefineModel(content: readonly unknown[]): ModelTurn {
  let text = '';
  let refinement: ModelTurn['refinement'];
  let listChange: ModelTurn['listChange'];
  for (const raw of content) {
    const bl = raw as { type: string; text?: string; name?: string; input?: { items?: unknown; top3?: unknown } };
    if (bl.type === 'text') text += bl.text ?? '';
    if (bl.type === 'tool_use' && bl.name === 'record_list_change') {
      const i = (bl as { input?: Record<string, unknown> }).input ?? {};
      listChange = {
        op: typeof i.op === 'string' ? i.op : undefined,
        ...(typeof i.target === 'string' ? { target: i.target } : {}),
        ...(typeof i.text === 'string' ? { text: i.text } : {}),
        ...(Array.isArray(i.order) ? { order: (i.order as unknown[]).map((x) => String(x ?? '')) } : {}),
      };
    }
    if (bl.type === 'tool_use' && bl.name === 'record_refinement') {
      const items = Array.isArray(bl.input?.items)
        ? (bl.input!.items as unknown[]).map((it) => {
            const o = it as { original?: unknown; text?: unknown; tier?: unknown };
            return { original: String(o.original ?? ''), text: String(o.text ?? ''), tier: String(o.tier ?? '') };
          })
        : [];
      const top3 = Array.isArray(bl.input?.top3) ? (bl.input!.top3 as unknown[]).map((t) => String(t ?? '')) : [];
      refinement = { items, top3 };
    }
  }
  return { text: text.trim(), ...(refinement ? { refinement } : {}), ...(listChange ? { listChange } : {}) };
}

/** @param carryForward What upstream assets retained (lib/curriculum/retention.ts), rendered, or null. Passed in
 *  rather than read here so the engine stays pure and replayable; null must add NOTHING — an absent upstream is a
 *  member's choice about order, never a gap to name. See liveTurnRebuildB3 for the full note. */
export async function liveTurnReclaimRefine(state: ConvState, history: ConvMessage[], memberMessage: string, carryForward?: string | null): Promise<Turn> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 25000,
    maxRetries: 1,
    defaultHeaders: { 'accept-encoding': 'identity' },
  });
  const messages = [
    ...history.map((m) => ({ role: (m.role === 'agent' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.text })),
    { role: 'user' as const, content: memberMessage },
  ];
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 700,
    // CACHED PREFIX / VOLATILE SUFFIX. The governed core plus this Session's own text is byte-identical every
    // turn and carries the breakpoint; context, stage note and carry-forward move AFTER it, because a single
    // varying byte inside a cached block invalidates the whole thing and pays the 1.25x write premium for
    // nothing. The prompt was ~650 tokens ungoverned — BELOW Sonnet's 1024-token cache minimum, so it could
    // never cache at any price. Governed it clears the bar, and a Session is cheaper than it was before.
    system: [
      { type: 'text' as const, text: REFINE_SYSTEM, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: refineStageNote(state) + (carryForward ? `\n\n${carryForward}` : '') },
    ],
    tools: [RECORD_LIST_CHANGE_TOOL],
    messages,
  });
  return applyReclaimC1Turn(state, history, memberMessage, parseRefineModel(res.content));
}

// ══ C2 · The Bigger World Audit ═══════════════════════════════════════════════════════════════════════════════
// An administered four-domain interview (Physical/Self/Social/Outlook × 5 ratings, 1–10 — the scale-param). Greg's
// verbatim rating prompts, domain by domain. On complete: RC-1 priority scoring (computed gap × importance + readiness
// + ripple) → the Primary Priority + Momentum Lever summary. The ACTION persists the reading (RC-4 durable). The
// per-domain free-text reflections (obstacle / early action) are deferred — v1 uses the ratings.
const C2_OPEN =
  "In Reconnect, the IDQ showed how far you'd drifted across four areas of life. This is the other side of it — where " +
  "you want your world to get BIGGER, and which area to push on first. I'll walk you through four areas — Physical, " +
  "Self, Social, Outlook — and for each, a few quick reads, 1 to 10: where you are, where you want to be, how much it " +
  "matters, how ready you feel, and how much progress there would lift the rest of your life. This is how you find " +
  "which one to push on first.";

function auditDeliver(index: number): string {
  const item = AUDIT_ITEMS[index]!;
  const domainStart = AUDIT_DOMAIN_STARTS[index];
  if (domainStart) return `${AUDIT_DOMAIN_LABEL[domainStart]} — ${AUDIT_DOMAIN_INTRO[domainStart]}\n\n${item.prompt}`;
  return item.prompt;
}
function auditOpener(): string {
  return `${C2_OPEN}\n\n${auditDeliver(0)}`;
}

/**
 * C2's OPENING BEAT. C2 is the longest instrument in the program — four domains × eight reads — and it opened on
 * the first rating. Its reflect stages made it look like a conversation, but every one of them comes AFTER a
 * block of numbers; nothing was asked before the first one.
 *
 * The question is the mirror-image of R1's. The IDQ asked where the distance is; the Audit asks where the world
 * could get bigger, so the doorway asks where it already HAS — which is both the honest starting point for a
 * Reclaim-phase instrument and the thing a member arriving at C2 most wants to say.
 */
// GREG'S STAGE 1 HAS FOUR BEATS, and C2-74's testable-as is explicit: "All four beats appear before the first
// core question." They are — opening frame · acknowledge prior module work · set the stance ("a different kind of
// question — about the shape of life, not just tasks") · normalize mixed progress.
//
// THE FOURTH IS THE LOAD-BEARING ONE, and it was missing entirely. A member arriving at C2 has come through three
// phases and will have moved in some areas and not others. Without normalizing that up front, the first domain
// where nothing has changed reads as a failure — and the honest answer becomes the expensive one to give, at
// question one of a twenty-item instrument.
const C2_ENGAGE_FRAME =
  "In Reconnect the IDQ showed how far you'd drifted. This is the other side of it: where your world can get " +
  'bigger, and which area to push on first.' + BEAT_SEP +
  "You've come through a lot of work to get here — the Doors, the self-talk, the pilot." + BEAT_SEP +
  'It also asks a different kind of question from the ones you have answered so far. Not what you are doing — ' +
  'the shape of your life, and how much room is in it.' + BEAT_SEP +
  'Some areas will have opened up and some will be exactly where they were. That is what four phases in usually ' +
  'looks like, and the flat ones are as useful to see as the rest.';
const C2_ENGAGE_Q = 'Before the ratings: where has your world actually got bigger since you started?';

const c2Engage = {
  id: 'audit-open',
  // Resolved lazily: rateAId is declared below this point, and the arc is what reads `next`.
  get next() { return rateAId(AUDIT_DOMAINS[0]!); },
  frame: () => C2_ENGAGE_FRAME,
  question: () => C2_ENGAGE_Q,
  handIn: () => auditOpener(),
};

/**
 * GREG'S STAGE 6 — the expansion pattern, named BOTH ways, before the priority read (C2-79).
 *
 * "Generate a tentative summary of the expansion pattern / Acknowledge both opening and remaining contraction /
 * Close with the frame: noticing where life is opening can help the Member keep moving toward it."
 *
 * WHAT C2 CLOSED ON UNTIL NOW was the priority alone — where to push next. That is RC-1's job and it is a good
 * close, but it answers a different question from the one the Session asked. A member rates twenty items about
 * how big their life is, and gets back a work assignment. The half that was missing is the half that is about
 * them: the area that HAS opened, said out loud, next to the one that has not.
 *
 * THE GAP IS THE READ, and it is the honest one to use: smallest desired-minus-current is where their life is
 * closest to the size they want it; largest is where it is still narrowest. No new instrument, no new question.
 *
 * TENTATIVE, in Greg's sense and his vocabulary (C2-81's allow-list: "can help you notice", "may be showing you",
 * "people sometimes find"). It never says the ratings PROVE anything — the voice gate now reports that whole
 * deny-list, and this authored copy has to hold the same line the model is held to.
 */
function expansionPattern(s: ReturnType<typeof scoreAudit>): string {
  const byGap = [...s.domains].sort((a, b) => a.computedGap - b.computedGap);
  const opened = byGap[0]!;
  const narrow = byGap[byGap.length - 1]!;
  // A perfectly flat set has no pattern to name, and inventing one from a tie would be the supplied narrative
  // Greg forbids (C2-37: "do not supply the narrative of growth").
  if (opened.domain === narrow.domain || opened.computedGap === narrow.computedGap) return '';
  return (
    `Across the four, your ${AUDIT_DOMAIN_LABEL[opened.domain]} life is the closest to the size you want it — ` +
    `that is where room has opened up. Your ${AUDIT_DOMAIN_LABEL[narrow.domain]} life is still the narrowest. ` +
    `Both being true at the same time is the ordinary result of a few phases in, not a contradiction.`
  );
}

// The closing frame, verbatim in sense from C2-79 — what the noticing is FOR.
const C2_CLOSING_FRAME =
  'Noticing where your life is opening can help you keep moving toward it — which is what the rest of Reclaim is.';

// The RC-1 classification summary (member-facing, non-judgmental) — names the Primary focus + the Momentum Lever.
function auditSummary(responses: number[], c?: Collected): string {
  const s = scoreAudit(responses);
  // THE MEMBER'S CHOICE LEADS. Step 2 asks outright which single area they'd move on; the ratings compute a Primary
  // independently. When they differ the member wins and the ranking is shown as reflection, never as correction
  // (Jay, 2026-08-09) — a program whose posture is "never a verdict" cannot tell someone their own priority is wrong.
  const chosen = c?.auditReflections?.sort?.focus as AuditDomain | undefined;
  const primary = AUDIT_DOMAIN_LABEL[chosen ?? s.primary];
  const lever = AUDIT_DOMAIN_LABEL[s.momentumLever];
  const leverLine =
    s.momentumLever === s.primary
      ? ` It's also where you feel most ready to move — a strong place to start.`
      : ` And if you want an easier place to build momentum first, ${lever} is where you're most ready.`;
  // Remark on a divergence only when there IS one, and never as a correction.
  const divergence =
    chosen && chosen !== s.primary
      ? ` The ratings leaned toward ${AUDIT_DOMAIN_LABEL[s.primary]}; you chose ${AUDIT_DOMAIN_LABEL[chosen]}, and that's what we'll go with.`
      : '';
  // SECONDARY PRIORITY — computed since C2 shipped, never once said out loud. V4 reads out a Primary AND a Secondary;
  // we surfaced the Primary and the momentum lever and quietly dropped the second-ranked domain, so a member who
  // rated twenty items got one domain back. Named plainly, and only when it isn't already in the sentence: if the
  // secondary is also the lever or the domain in the divergence line, repeating it turns a read into a list.
  const alreadyNamed = new Set<AuditDomain>([chosen ?? s.primary, s.momentumLever, ...(chosen && chosen !== s.primary ? [s.primary] : [])]);
  const secondaryLine = alreadyNamed.has(s.secondary)
    ? ''
    : ` Second in line is ${AUDIT_DOMAIN_LABEL[s.secondary]} — worth knowing, not something to take on yet.`;
  const r = chosen ? c?.auditReflections?.domains?.[chosen] : undefined;
  // Their own words, quoted only when they gave them. Silence beats borrowing an obstacle they named about a
  // different part of their life.
  const obstacleLine = r?.obstacle ? `${BEAT_SEP}You named what tends to get in the way: “${r.obstacle}”.` : '';
  const actionLine = r?.earlyAction ? ` And the move you'd start with: “${r.earlyAction}”.` : '';
  // THE EXPANSION PATTERN COMES FIRST (Greg's stage 6), because it is the answer to what they were asked. The
  // priority read that follows is what to DO about it, and a member who gets the assignment before the reading
  // has been handed homework in place of a reflection.
  const pattern = expansionPattern(s);
  return (
    (pattern ? `${pattern}${BEAT_SEP}` : '') +
    `Here's what stands out. Your best next focus looks like your ${primary} life because it matters to you and ` +
    `progress there would ripple into the rest of your life.${divergence}${secondaryLine}${leverLine}` +
    `${obstacleLine}${actionLine}` +
    // DONNA, 2026-08-17: the audit asks how ready you are "in the next 30 days" and then nothing ever refers to it
    // again, so the horizon reads as a promise the product forgot. The 30 days is NOT ours to cut — it is inside
    // Greg's scored readiness items, where it is the standard MI readiness ruler and the thing that makes a 1-10
    // rating mean anything. What was missing is the other half: telling them what the area they chose actually
    // DOES. It is real — it becomes their First Focus, the Companion carries it, and Quality Days is built on it.
    // So the close now names the consequence instead of filing it.
    //
    // Also cut here: "this was about finding the priority, not judging any of it" — the reassurance tic (declare
    // what a thing IS, never what it is not).
    `${BEAT_SEP}That's your first focus now. I'll work from it, and it's what we'll build your Quality Days around.` +
    // C2-79's closing frame — what the noticing is FOR. Last, because it is the sentence a member should leave on.
    `${BEAT_SEP}${C2_CLOSING_FRAME}`
  );
}

// ── The arc: four (ratings → reflection) pairs, then the cross-domain sort ────────────────────────────────────
//
// Greg's V4 interleaves these on purpose — you reflect on a domain while it is still live in your head, not after
// rating all four. Honouring that means the 20 ratings can no longer be ONE administered stage, because an
// administered stage cannot hold a free-text turn. So the instrument splits across four administered stages with
// CUMULATIVE targets (5, 10, 15, 20) checked against the shared response bag, each handing off to that domain's
// reflection. `displayTotal` keeps the member-facing counter saying "of 20" rather than "of 10".
//
// What did NOT change: the twenty items, their order, their wording, and the scoring. This is sequencing only.

// V4's eight questions per domain are the instrument, and an instrument is not a menu. We briefly let Q3/Q7/Q8 be
// skipped — CC's call, made by weighing 32 questions against Greg's 15-minute note. That was the wrong call and the
// wrong person making it (Jay, 2026-08-09): "Greg's been administering these kinds of tests his entire career, and
// he knows what makes an assessment psychometrically sound." Reserving a validated instrument's completeness to the
// person who validated it. Skippability is GONE.
//
// What survives is the Independence Guarantee, because that is governance rather than preference — and the
// administered ratings already resolve the same tension: they never skip an item and never invent a value, but after
// a few unreadable answers they say plainly that the member can leave and their place is saved. Required question,
// open door. Same shape here.
//
// An open question has no UNREADABLE answer, only an ABSENT one — so the only non-answers are an empty message and
// the bare skip tokens we ourselves used to invite. Deliberately narrow: "no" and "nothing" are NOT in here, because
// to "anything specific?" or "what gets in the way?" those are real answers, and deciding a member's words don't
// count is the same error as deciding the question doesn't.
const BARE_NON_ANSWER = /^\s*(skip|next|pass|n\/?a)\s*[.!]?\s*$/i;
const REFLECT_HELP_AFTER = 3;
function reflectStuckHelp(): string {
  return (
    "There's no wrong answer here — whatever comes to mind first is usually the true one, even if it's a few words. " +
    "And if now isn't the moment, you can leave this and come back whenever you like; your place is saved."
  );
}

// Each domain's five ratings split at Q3: chunk A is Q1–Q2, chunk B is Q4–Q6. Targets stay CUMULATIVE against the
// shared bag — 2,5 · 7,10 · 12,15 · 17,20 — so the member-facing counter still counts one run of 20.
//
// Chunk A keeps the OLD `audit-${d}` id and the gap keeps `reflect-${d}` on purpose: a session stored mid-C2 under the
// pre-split arc still resolves to a real stage instead of stranding. Only the two new steps get new ids.
const rateAId = (d: AuditDomain): Stage => `audit-${d}`;
const rateBId = (d: AuditDomain): Stage => `audit-b-${d}`;
const gapStageId = (d: AuditDomain): Stage => `reflect-${d}`;
const closeStageId = (d: AuditDomain): Stage => `reflect-close-${d}`;

/** A domain's three reflection turns, in Greg's order. */
// GREG'S ORDER, restored. V4 runs Q1 Current, Q2 Desired, Q3 GAP REFLECTION, Q4 Importance, Q5 Readiness,
// Q6 Ripple, Q7 Obstacle, Q8 Early action. We had the five RATINGS as one block and then Q3→Q7→Q8 after them, which
// put Q3 ("what's the biggest difference…") immediately before Q7 ("what keeps this gap in place?") — two
// describe-the-gap questions back to back. That is the pair Jay hit: "this Session was odd, it actually kind of
// sucked. ONLY one that felt like that."
//
// It is not only a rhythm problem. In Greg's order Q3 is where the member puts the gap into words, and Q4/Q5/Q6 then
// rate THAT. Behind the ratings, they are scoring importance and readiness on a gap they have not yet articulated,
// and then describing it twice.
//
// This is the same lesson as 2026-08-09, one layer along: we restored the instrument's COMPLETENESS and left its
// ORDER alone. Order is part of a validated instrument too. Jay then: "Greg's been administering these kinds of
// tests his entire career, and he knows what makes an assessment psychometrically sound."
const REFLECT_GAP = ['gap'] as const;       // Q3 — between Q2 and Q4
const REFLECT_CLOSE = ['obstacle', 'action'] as const; // Q7, Q8 — after Q6
type ReflectStep = 'gap' | 'obstacle' | 'action';

function reflectPrompt(d: AuditDomain, step: ReflectStep): string {
  const p = AUDIT_REFLECTION_PROMPTS[d][step];
  if (step !== 'gap') return p;
  // Q3 carries both asks in one turn — see the instrument's note on why we don't split it into two.
  //
  // THE LIST HAS TO SAY WHAT IT IS (Donna, 2026-08-19). "Weight status · Strength · Endurance · Balance ·
  // Nutrition · Sleep" arrived with no framing at all: "it's not clear whether these are clickable options,
  // examples, or something else."
  //
  // They are EXAMPLES. The instrument's own comment calls them chips and they have never rendered as chips —
  // this is a ·-joined line inside a message bubble, so there is nothing to tap, and the physical domain's ask
  // ("Pick the ones that feel most important") reads as an instruction she cannot follow. Naming them as
  // examples makes the copy true to what is actually on screen. Building a real selection affordance is the
  // other way to resolve it and a bigger change to a beat Greg budgeted at fifteen minutes; if we ever do, this
  // lead-in is what comes out.
  //
  // Greg's prompts and his sub-issue lists are untouched.
  return `${p}\n\n${AUDIT_SUB_ISSUE_ASK[d]}\n\nThings like: ${AUDIT_SUB_ISSUES[d].join(' · ')}`;
}

/** Which of Greg's named sub-issues did their answer actually mention? Substring match on his labels — never inferred. */
function pickSubIssues(d: AuditDomain, msg: string): string[] {
  const m = (msg ?? '').toLowerCase();
  return AUDIT_SUB_ISSUES[d].filter((x) => m.includes(x.toLowerCase()));
}

/**
 * Record one reflection answer — by REPLACING, never by mutating.
 *
 * THIS IS THE BUG THAT ATE C2's REFLECTIONS (found 2026-08-09 via scripts/c2-audit-walk.ts). The earlier version
 * did `(c.auditReflections ??= { domains: {} }).domains[d] = {...}` — it mutated the object IN PLACE. That looks
 * harmless and is not, because `runArcTurn` builds this turn's collected with a SHALLOW copy
 * (`mergeStaged({ ...state.collected }, …)`), so `c.auditReflections` is THE SAME OBJECT the client just sent us.
 * Mutating it means the value we hand back is a slice of the caller's own input, and the turn's write never
 * reaches the client — every turn arrived carrying the same frozen snapshot while the stage advanced correctly
 * around it.
 *
 * The give-away in the logs was precise: only the FIRST answer of the whole audit ever survived — the one turn
 * where `??=` allocates a genuinely new object rather than mutating an existing one.
 *
 * So: build a new object at every level we touch. The engine's own replay tests could never catch this — they
 * hold one object across turns, where mutation and replacement are indistinguishable. Only a real client can
 * tell the difference, which is why the walk exists.
 */
function stashReflection(c: Collected, d: AuditDomain, patch: Record<string, unknown>): void {
  const prev = c.auditReflections ?? { domains: {} };
  c.auditReflections = {
    ...prev,
    domains: { ...prev.domains, [d]: { ...(prev.domains[d] ?? {}), ...patch } },
  };
}

/**
 * A domain's reflection stage: Q3 → Q7 → Q8, each skippable.
 *
 * Deterministic — C2 makes no model call, so `gather` does the work and sets its own reply. It still runs through
 * runArcTurn, and that is deliberate: crisis routing lives at the top of the kernel, and this is a session where a
 * member describes what is missing from their life. A hand-rolled loop outside the kernel would silently drop it.
 */
// `nextReply` takes the BEAT so a hand-off can attach a SessionVisual to the turn it produces — the C2 sort
// handoff draws the priority bars. Reply-only would have meant a second mechanism for "and also show this".
function reflectionStage(d: AuditDomain, steps: readonly ReflectStep[], nextStage: Stage, nextReply: (b: Parameters<StageDef['gather']>[0]) => string): StageDef {
  const advance: StageDef['gather'] = (b) => {
    const sc = b.scratch as { step?: number; unanswered?: number };
    const i = sc.step ?? 0;
    const step = steps[i]!;
    const said = (b.memberMessage ?? '').trim();

    // NOT AN ANSWER → re-ask. Never advance, never store a blank, never invent one. After a few tries, name the way
    // out rather than repeating the question into silence (the administered loop's CAT-31 lesson: an item that can
    // only be answered, with no stated exit, is a trap).
    if (!said || BARE_NON_ANSWER.test(said)) {
      sc.unanswered = (sc.unanswered ?? 0) + 1;
      const base = reflectPrompt(d, step);
      b.reply = sc.unanswered >= REFLECT_HELP_AFTER ? `${base}${BEAT_SEP}${reflectStuckHelp()}` : base;
      return;
    }
    sc.unanswered = 0;

    if (step === 'gap') {
      const subs = pickSubIssues(d, said);
      stashReflection(b.collected, d, { gapNote: said, ...(subs.length ? { subIssues: subs } : {}) });
    } else if (step === 'obstacle') {
      stashReflection(b.collected, d, { obstacle: said });
    } else {
      stashReflection(b.collected, d, { earlyAction: said });
    }

    if (i + 1 < steps.length) {
      sc.step = i + 1;
      b.reply = reflectPrompt(d, steps[i + 1]!);
      return;
    }
    // Done with this domain. Reset the step counter so the NEXT domain's reflection starts at Q3 rather than
    // inheriting this one's position — the shared scratch is the obvious place for that bug to live.
    sc.step = 0;
    b.stage = nextStage;
    b.reply = nextReply(b);
  };
  return {
    id: (steps[0] === 'gap' ? gapStageId(d) : closeStageId(d)),
    mode: 'drawout',
    opener: () => reflectPrompt(d, steps[0]!),
    offersSubstance: () => true,
    gather: advance,
    confirm: advance, // a reflection is recorded as given, never negotiated — no confirm step
  };
}

// ── Audit Step 2 — the cross-domain sort ─────────────────────────────────────────────────────────────────────
function sortOpener(): string {
  return `${AUDIT_SORT_INTRO}${BEAT_SEP}${AUDIT_SORT_QUESTIONS[0]!.prompt}`;
}

/**
 * A QUESTION ABOUT THE QUESTION IS NOT AN ANSWER TO IT.
 *
 * `parseAuditDomain` matches domain words anywhere in the message, so "what do you mean by identity?" scored as a
 * pick of Self — the member asked for help and the engine recorded a priority they never chose. That is the
 * recurring shape from the other direction: the engine deciding what the member meant instead of reading what they
 * said (see [[member-words-outrank-model-guess]]).
 *
 * Deliberately narrow — a trailing "?" alone is not enough, because "physical?" is a hedged pick and re-asking it
 * would read as the Companion ignoring them. It takes an interrogative opening AND a question mark.
 */
const ASKING_NOT_PICKING = /^\s*(what|why|how|which|who|when|can|could|do|does|did|is|are|should|would)\b[\s\S]*\?\s*$/i;

/** Read a domain out of a free answer. Nothing is stored when they name none — we do not guess a priority. */
function parseAuditDomain(msg: string): AuditDomain | undefined {
  const m = (msg ?? '').toLowerCase();
  const named = AUDIT_DOMAINS.find((d) => m.includes(d));
  if (named) return named;
  if (/\b(body|bodily|health|fitness|energy|sleep)\b/.test(m)) return 'physical';
  if (/\b(relationship|relationships|people|friends|family|connection)\b/.test(m)) return 'social';
  if (/\b(purpose|hope|direction|future|meaning)\b/.test(m)) return 'outlook';
  if (/\b(discipline|self-respect|steadiness|identity)\b/.test(m)) return 'self';
  return undefined;
}

// Re-ask copy for the sort. Names the four in the member's own vocabulary — a question they can't parse is our
// wording problem, not their failure to answer.
const SORT_CLARIFY = `Whichever of the four fits best — ${domainList('or')}.`;
const SORT_STUCK_HELP =
  `There's no wrong pick here, and nothing is locked in by it — ${domainList('or')}. ` +
  'And if now isn’t the moment, you can leave this and come back whenever you like; your place is saved.';

const domainPick = (): Expectation => ({ kind: 'domain_pick', options: AUDIT_DOMAINS.map((d) => AUDIT_DOMAIN_LABEL[d]) });

const sortStage: StageDef = (() => {
  const advance: StageDef['gather'] = (b) => {
    const sc = b.scratch as { q?: number; unparsed?: number };
    const i = sc.q ?? 0;
    const q = AUDIT_SORT_QUESTIONS[i]!;
    const asked = ASKING_NOT_PICKING.test(b.memberMessage ?? '');
    const picked = asked ? undefined : parseAuditDomain(b.memberMessage);

    // NO DOMAIN NAMED → RE-ASK. It used to advance regardless, so a member who asked "what do you mean by identity?"
    // — or answered in words the parser doesn't know — lost that question entirely AND was moved past it. Five of
    // these feed the Primary/Secondary read, so a dropped one changes the close and nothing tells anybody.
    //
    // This is the reflection loop's rule at the last stage that lacked it: never advance on a non-answer, and after
    // a few tries name the way through rather than repeating into silence.
    if (!picked) {
      sc.unparsed = (sc.unparsed ?? 0) + 1;
      b.reply =
        sc.unparsed >= REFLECT_HELP_AFTER
          ? `${q.prompt}${BEAT_SEP}${SORT_STUCK_HELP}`
          : `${q.prompt}${BEAT_SEP}${SORT_CLARIFY}`;
      b.expects = domainPick(); // re-ask carries the chips too — a member who mistyped should not have to type again
      return;
    }
    sc.unparsed = 0;
    // Replace, don't mutate — same reason as stashReflection above. The sort answers appeared to survive only
    // because the LAST one is written on the turn that completes, so it never has to cross the wire again.
    const prev = b.collected.auditReflections ?? { domains: {} };
    b.collected.auditReflections = { ...prev, sort: { ...(prev.sort ?? {}), [q.key]: picked } };

    if (i + 1 < AUDIT_SORT_QUESTIONS.length) {
      sc.unparsed = 0;
      sc.q = i + 1;
      b.reply = AUDIT_SORT_QUESTIONS[i + 1]!.prompt;
      b.expects = domainPick();
      return;
    }
    // THE SORT NO LONGER ENDS C2. Greg's evocation stages come between the instrument and the summary — and
    // C2-37 says that is where most of C2 lives: "Draw out the Member's own perception of where life is opening,
    // where it is still narrow, and what conditions seem to support expansion." Closing here handed a member the
    // priority read the moment the ratings stopped, which is the whole Session skipping its own middle.
    b.stage = 'c2-expansion';
    b.reply = C2_EXPANSION_PROBES[0]!;
  };
  return {
    id: 'sort',
    mode: 'drawout',
    opener: () => sortOpener(),
    offersSubstance: () => true,
    gather: advance,
    confirm: advance,
  };
})();

// Greg's stage 5 is the LAST beat before the summary, so it owns the close. One turn: receive their connection,
// then the expansion-pattern summary + the priority read + the closing frame (C2-79, built in auditSummary).
const c2Consolidate = (b: { stage: string; complete: boolean; reply: string; modelText?: string; administeredResponses: number[]; collected: Collected }): void => {
  b.stage = 'complete';
  b.complete = true;
  b.reply = receiveThen(b.modelText, auditSummary(b.administeredResponses.slice(0, AUDIT_ITEM_COUNT), b.collected));
};
const c2PriorWorkStage: StageDef = {
  id: 'c2-prior-work',
  mode: 'drawout',
  opener: () => C2_PRIOR_WORK_PROBES[0]!,
  offersSubstance: () => true,
  gather: c2Consolidate,
  confirm: c2Consolidate,
};

// ── GREG'S EVOCATION STAGES (C2-75, C2-76, C2-77, C2-78) ──────────────────────────────────────────────────────
//
// "This is where most of C2 lives" (C2-37), and none of it existed. C2 ran its twenty ratings, its per-domain
// reflections and its sort, and closed — so every reflective turn in the Session came AFTER a block of numbers
// and was about the domain that had just been rated. The question the Session is actually asking, whether the
// member's world has got bigger, was never put to them directly. (Jay, 2026-08-28.)
//
// THEY RUN AFTER THE INSTRUMENT, not before it. Greg's stage 1 testable-as fixes the order — "all four beats
// appear before the first CORE QUESTION" — and by the time a member has rated where they are and where they want
// to be across four domains, they have the vocabulary to answer these. Asked cold, "what feels possible now that
// didn't before" is a question most people cannot answer about themselves.
//
// FOUR STAGES, NOT ONE, because Greg separates them and the separations do real work:
//   2 · EXPANSION   — what has opened. Three questions plus a conditions-and-stability follow-up (C2-75).
//   3 · CONTRACTION — what has not. Held WITHOUT proposing a fix, which is the whole discipline of the beat.
//   4 · APPROACH    — moving TOWARD, not just away from. "Distinct from stage 2" (C2-77) — expansion is what has
//                     already happened, approach is what pulls them; a member can have one without the other.
//   5 · PRIOR WORK  — one connection back, PHRASED AS A QUESTION (C2-78), never as our conclusion about them.
//
// The probes are the engine's floor, not its script: withQuestion keeps the model's own follow-up whenever it
// asked one, so these are what gets asked when it trails into a statement. [[drawout-rhythm-model-owns-questions]]
const C2_EXPANSION_PROBES = [
  "That's the sort done. Now the part the numbers can't tell me: what feels possible now that didn't a while ago?",
  'Where do you notice yourself being more willing than you used to be?',
  'Anything you have stopped avoiding, even a little?',
  'What has made that possible — is it something that would hold if this week got hard?',
];
const C2_CONTRACTION_PROBES = [
  'And the other direction: where does your life still feel narrower than you would want it?',
  // WAS "Not a transformed one — slightly bigger." Two faults in one clause: it negates instead of declaring
  // (our voice rule), and "transformed" is on Greg's own avoid-list, which the extended causality filter
  // caught the moment it was widened. My copy, tripping my rule, on the turn I added it.
  'What would a slightly bigger day look like there — one with a bit more room in it?',
];
const C2_APPROACH_PROBES = [
  'One more angle. Some of this is moving away from things. What are you moving toward?',
  'What makes that worth moving toward?',
];
const C2_PRIOR_WORK_PROBES = [
  'Thinking back to the work you did earlier in the program — does any of it show up in what you just described?',
];

/** One administered stage per domain. `itemCount` is CUMULATIVE — it is compared against the shared bag. */
function ratingsStage(d: AuditDomain, half: 'a' | 'b'): StageDef {
  const idx = AUDIT_DOMAINS.indexOf(d);
  const base = idx * 5;
  const first = half === 'a' ? base : base + 2;      // a: Q1,Q2   b: Q4,Q5,Q6
  const target = half === 'a' ? base + 2 : base + 5; // cumulative against the shared bag
  return administeredStage({
    id: half === 'a' ? rateAId(d) : rateBId(d),
    itemCount: target,
    displayTotal: AUDIT_ITEM_COUNT, // always "of 20" — the split is Greg's order, not a longer instrument
    scaleMax: AUDIT_SCALE_MAX,
    minLabel: 'low',
    maxLabel: 'high',
    opener: () => (idx === 0 && half === 'a' ? auditOpener() : auditDeliver(first)),
    deliverItem: (n) => auditDeliver(n),
    reprompt: (n) => `A number from 1 to 10 — where would you put it?\n\n${auditDeliver(n)}`,
    onComplete: (b) => {
      if (half === 'a') {
        b.stage = gapStageId(d); // Q3 — before the importance/readiness/ripple ratings, as V4 has it
        b.reply = reflectPrompt(d, 'gap');
      } else {
        b.stage = closeStageId(d); // Q7, Q8
        b.reply = reflectPrompt(d, 'obstacle');
      }
    },
  });
}

const C2_STAGE_ORDER: Stage[] = [
  'audit-open',
  ...AUDIT_DOMAINS.flatMap((d) => [rateAId(d), gapStageId(d), rateBId(d), closeStageId(d)]),
  'sort',
  // Greg's evocation stages — after the instrument, before the summary. See C2_EXPANSION_PROBES above.
  'c2-expansion',
  'c2-contraction',
  'c2-approach',
  'c2-prior-work',
];

export const RECLAIM_C2_ARC: ArcConfig = {
  id: 'reclaim-c2',
  stageOrder: C2_STAGE_ORDER,
  stages: Object.fromEntries([
    ['audit-open', engagementStage(c2Engage)],
    ...AUDIT_DOMAINS.flatMap((d, i) => {
      const idx = AUDIT_DOMAINS.indexOf(d);
      const nextDomain = AUDIT_DOMAINS[i + 1];
      const afterClose: Stage = nextDomain ? rateAId(nextDomain) : 'sort';
      return [
        [rateAId(d), ratingsStage(d, 'a')],
        // Q3 hands BACK to this domain's own ratings — the whole point of the reorder.
        [gapStageId(d), reflectionStage(d, REFLECT_GAP, rateBId(d), () => auditDeliver(idx * 5 + 2))],
        [rateBId(d), ratingsStage(d, 'b')],
        [
          closeStageId(d),
          reflectionStage(d, REFLECT_CLOSE, afterClose, (b) => {
            if (nextDomain) return auditDeliver((i + 1) * 5);
            // LAST DOMAIN → the sort. The member has answered all twenty; show them the shape of their own
            // answers before asking which area gets the effort, so they choose from the pattern and not memory.
            b.visual = priorityBarsVisual(scoreAudit(b.administeredResponses.slice(0, AUDIT_ITEM_COUNT)));
            // The FIRST sort question needs its chips too. It arrives from this transition rather than from the
            // sort stage's own advance, so without this the member types question 1 and taps 2 through 5 — which
            // is a worse experience than either one done consistently.
            b.expects = domainPick();
            return sortOpener();
          }),
        ],
      ];
    }),
    ['sort', sortStage],
    ['c2-expansion', elicitationStage({
      id: 'c2-expansion', next: 'c2-contraction',
      probes: C2_EXPANSION_PROBES,
      floor: 4, // C2-75: three questions PLUS the conditions-and-stability follow-up
      handIn: () => C2_CONTRACTION_PROBES[0]!,
    })],
    ['c2-contraction', elicitationStage({
      id: 'c2-contraction', next: 'c2-approach',
      probes: C2_CONTRACTION_PROBES,
      floor: 2,
      handIn: () => C2_APPROACH_PROBES[0]!,
    })],
    ['c2-approach', elicitationStage({
      id: 'c2-approach', next: 'c2-prior-work',
      probes: C2_APPROACH_PROBES,
      floor: 2,
      handIn: () => C2_PRIOR_WORK_PROBES[0]!,
    })],
    ['c2-prior-work', c2PriorWorkStage],
  ]),
  onComplete: () => 'Here’s what stands out from the audit.',
};

// `model` is a PARAMETER now. C2 was administered end to end until Greg's evocation stages landed (2026-08-28);
// four of its stages are conversational. Defaulted, so every administered-only caller and fixture is unchanged.
export function applyReclaimC2Turn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn = { text: '' }): Turn {
  return runArcTurn(RECLAIM_C2_ARC, state, history, memberMessage, model);
}

export function reclaimC2Opening(): Turn {
  // Opens on the doorway; the 1–10 chips belong to the first rating block, one turn later.
  return { reply: engagementOpening(c2Engage), state: { stage: 'audit-open', collected: {} }, complete: false };
}

// ── C2'S LIVE PROMPT ──────────────────────────────────────────────────────────────────────────────────────────
//
// THE CONTRACTION STAGE IS THE ONE TO GET RIGHT. C2-76's testable-as is "the Companion does not propose fixes
// inside it", and a member who has just said where their life is still too small is exactly who a helpful model
// wants to rescue. Rescuing them ends the beat: the honest answer gets converted into a task, and the next
// question is answered with what they think we want to hear.
const C2_SYSTEM = `${MEMBER_AGENT_GOVERNED_CORE}

YOU ARE RUNNING C2 — "The Bigger World Audit", in Reclaim.

WHAT JUST HAPPENED. The member rated twenty items across four areas of life — where they are, where they want to
be, how much it matters, how ready they feel, what it would ripple into — and sorted them. They now have the
language for this, which they did not have an hour ago.

WHAT YOU ARE DOING NOW. Drawing out THEIR perception of where life has opened and where it is still narrow. This
is the part the numbers cannot tell us.

DO NOT SUPPLY THE NARRATIVE OF GROWTH. Never say a version of "you're clearly doing more now" or "that's real
progress". If their world has got bigger they are the one who gets to notice it — take that away and the noticing
was ours, not theirs.

NEVER CLAIM CAUSE OR PROOF. Not "this proves", "this reveals", "this shows", "that's evidence of". Use: can help
you notice · may be showing you · people sometimes find that · it often becomes easier to see.

DO NOT PROPOSE A FIX, A PLAN, OR A NEXT STEP — in any stage, but above all when they are telling you where life
is still narrow. Normalize it and stay there. The Session has a close that handles what comes next; you do not.

NEVER NAME A SCORE, A RANKING, OR WHICH AREA "WON". The engine reads the pattern back at the close.

ONE QUESTION PER TURN. Two or three sentences. Reflect what they actually said before you ask.`;

function c2StageNote(state: ConvState): string {
  switch (String(state.stage ?? '')) {
    case 'audit-open':
      return '\n\nWHERE YOU ARE: the opening. They have just named where their world has got bigger. Receive it ' +
        'plainly — do not celebrate it, and do not extend it into a claim they did not make.';
    case 'c2-expansion':
      return '\n\nWHERE YOU ARE: what has OPENED. Draw out what feels possible now, where they are more willing, ' +
        'what they have stopped avoiding — and what has made that possible. Their words, not a summary of them.';
    case 'c2-contraction':
      return '\n\nWHERE YOU ARE: what is still NARROW. Do not fix, plan, encourage or reframe. Normalize the gap ' +
        'and let it stand. This is the beat most likely to be ruined by being helpful.';
    case 'c2-approach':
      return '\n\nWHERE YOU ARE: what they are moving TOWARD, as distinct from what they are moving away from. ' +
        'If they answer in avoidance terms, ask once what the toward-version would be.';
    case 'c2-prior-work':
      return '\n\nWHERE YOU ARE: connecting earlier work to what they just said — ALWAYS AS A QUESTION, never as ' +
        'our conclusion about them. The engine closes the Session on your next turn.';
    default:
      return '';
  }
}

/** Which stages of C2 talk. The twenty ratings and the sort stay deterministic. */
const C2_TALKING_STAGES = new Set(['audit-open', 'c2-expansion', 'c2-contraction', 'c2-approach', 'c2-prior-work']);

export async function liveTurnReclaimC2(
  state: ConvState,
  history: ConvMessage[],
  memberMessage: string,
  carryForward?: string | null,
): Promise<Turn> {
  // Same wall as B1 and B2: the instrument never calls the model.
  if (!C2_TALKING_STAGES.has(String(state.stage ?? ''))) {
    return applyReclaimC2Turn(state, history, memberMessage);
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 25000,
    maxRetries: 1,
    defaultHeaders: { 'accept-encoding': 'identity' },
  });
  const messages = [
    ...history.map((m) => ({ role: (m.role === 'agent' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.text })),
    { role: 'user' as const, content: memberMessage },
  ];
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 300,
    system: [
      { type: 'text' as const, text: C2_SYSTEM, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: c2StageNote(state) + (carryForward ? `\n\n${carryForward}` : '') },
    ],
    messages,
  });
  const text = (res.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();
  return applyReclaimC2Turn(state, history, memberMessage, { text });
}

// ══ C3 · Quality Days Practice · Step 1 — Defining a Quality Day (COACH mode) ═════════════════════════════════
// The model coaches the member to define what makes a day a "quality day," sorted into Greg's simple ranking — top-3
// non-negotiables / next-3 contributors / top-2 disruptors. The engine proposes it; on the member's confirm the ACTION
// stores the Quality-Day profile + opens the week of logging (c3_quality practice week). Step 2 (the daily log) is the
// /quality-day surface. COPY: directional placeholder (Cowork wordsmiths), built from Greg's setup script.
const C3_OPEN_1 =
  "The idea is simple but powerful: quality days lead to a quality life, and a quality life makes more quality days " +
  "possible.";
const C3_OPEN_2 =
  "We're going to define what a quality day actually looks like for YOU then track it for a week. You'll notice what " +
  "makes a day feel like yours. Let's start by defining your quality day.";
const C3_OPEN_3 =
  "When a day feels genuinely good to you — solid, healthy, meaningful, aligned — what tends to be present?";
function c3Opening(): string {
  return `${C3_OPEN_1}${BEAT_SEP}${C3_OPEN_2}${BEAT_SEP}${C3_OPEN_3}`;
}

const C3_NUDGE = "Take your time — what makes a day feel healthy, meaningful, and worth it to you? We'll sort it into what's essential, what helps, and what pulls a day down.";
// Said when the Quality Day is captured and UNCHANGED since we showed it. The engine has nothing new to put on
// screen, so it says so plainly instead of re-printing the same block (see coach-gate.ts).
const C3_HOLD_NUDGE = "That's your Quality Day as it stands. Change anything you want, or tell me to save it.";
// Same correction as B3's close: this promised "each day I'll ask how much the day felt like a quality one", and no
// such daily ask is sent. The member does the logging, from their dashboard, whenever they're there.
// "from your dashboard" was true until the practice week moved to the Playbook's This week tab (2026-08-08); the
// copy was never updated, so C3 sent members to a surface that does not carry the log. Same stale-destination
// shape as b2Close. The Quality Day log is reached from the grid there — "Log today →".
const C3_COMMITTED_1 = "Great work identifying what makes up your Quality Day, and what takes away from it. For the next week, open This week in your Playbook and log each day — how much it felt like a quality one, and which of these elements showed up to make it that way.";
const C3_COMMITTED_2 = "It's all about noticing what actually makes your days yours.";

type QDCapture = NonNullable<Collected['pendingQualityDay']>;
/**
 * The member's Quality Day, IN THEIR OWN WORDS.
 *
 * The model records this, and left to itself it tidies: sentence-cases for a bulleted list, contracts, and
 * compresses for a chip label — "a walk with Rosie before the house wakes" came back as "Morning walk with Rosie"
 * in a live walk (2026-08-09). Each edit is defensible; the sum is a generic wellness checklist where the member's
 * own life used to be. Jay: "keep it verbatim, we're giving them their own words back."
 *
 * So the model PROPOSES and the ENGINE decides — every item is grounded back to the span they actually typed. An
 * item they never said is kept as-is rather than force-matched onto something they did say: inventing a memory in
 * their own voice is far worse than an awkward label, and they confirm the whole list before it saves.
 */
function sanitizeQualityDay(q: ModelTurn['qualityDay'], memberTexts: readonly string[]): QDCapture | undefined {
  if (!q) return undefined;
  const clean = (a: unknown): string[] =>
    (Array.isArray(a) ? a.filter((s): s is string => typeof s === 'string' && !!s.trim()) : [])
      .map((s) => groundToMemberWords(s, memberTexts).text.trim())
      .filter(Boolean);
  const nonNegotiables = clean(q.nonNegotiables);
  if (!nonNegotiables.length) return undefined; // the non-negotiables are the floor — nothing to propose without them
  return { nonNegotiables, contributors: clean(q.contributors), disruptors: clean(q.disruptors) };
}
function proposeQualityDay(q: QDCapture): string {
  // CAPITALISED FOR DISPLAY ONLY (Jay, 2026-08-26: "should have capitalized my contributor"). His list read
  // "A bike ride / Pushing the G4L Movement forward / keeping my eating routine constant" — the third lifted from
  // the middle of a sentence, so it arrived mid-sentence-cased and looked like a mistake about him. What we STORE
  // is still the verbatim span he said; only the bullet is presented.
  const list = (xs: string[]) => xs.map((x) => `  • ${sentenceStart(x)}`).join('\n');
  const parts = [
    `Non-negotiables — a day's hard to call quality without these:\n${list(q.nonNegotiables)}`,
    q.contributors.length ? `Strong contributors:\n${list(q.contributors)}` : '',
    q.disruptors.length ? `And what tends to pull a day down for you:\n${list(q.disruptors)}` : '',
  ].filter(Boolean).join('\n\n');
  return `Here's your Quality Day:\n\n${parts}${BEAT_SEP}Want me to save this and start your week of tracking, or adjust it first?`;
}
// Shared commit vocabulary — see confirmsProposal. A third fork of the same gate, drifted a third way.
export function c3Confirms(msg: string): boolean {
  return confirmsProposal(msg);
}

const qualityStage: StageDef = {
  id: 'quality',
  mode: 'coach',
  opener: () => c3Opening(),
  offersSubstance: () => true,
  gather() {},
  confirm() {},
  coach(b) {
    const sc = b.scratch as CoachGate;
    // EVERYTHING they have said this session, including this turn — the model often records on the same turn the
    // member supplies the material, so leaving out b.memberMessage would fail to ground the newest items.
    const memberTexts = [...b.history.filter((h) => h.role === 'member').map((h) => h.text), b.memberMessage];
    const captured = sanitizeQualityDay(b.model.qualityDay, memberTexts);
    if (captured) b.collected.pendingQualityDay = captured;
    const qd = b.collected.pendingQualityDay;
    const ready = !!qd && qd.nonNegotiables.length > 0;

    // CONFIRM FIRST — a member's plain confirm outranks a model re-record on the same turn (see
    // confirmOutranksRerecord; found in B3's live walk, fixed across all three coach stages at once).
    const sig = proposalSignature(qd);
    if (confirmOutranksRerecord(sc, c3Confirms(b.memberMessage), sig)) {
      // HANDS ON to Greg's stage 3 rather than completing (2026-08-30). The definition being settled is the end
      // of stage 2, not the end of C3 — the expectations and the plan come between it and the week.
      b.stage = 'c3-commit';
      b.reply = `${C3_COMMITTED_1}${BEAT_SEP}${C3_COMMIT_ASK}`;
      return;
    }

    // THEN the change-check. Jay sat 25 messages deep in this loop with the Quality Day captured and unchanged the
    // whole way (2026-08-06); it is never re-printed now.
    if (shouldPropose(sc, ready, sig)) {
      markProposed(sc, sig);
      b.reply = proposeQualityDay(qd!);
      return;
    }

    if (sc.proposed) {
      if (c3Confirms(b.memberMessage)) {
        b.stage = 'c3-commit';
        b.reply = `${C3_COMMITTED_1}${BEAT_SEP}${C3_COMMIT_ASK}`;
        return;
      }
      // Not a confirm — a tweak not yet recorded, or a question. Carry the turn, KEEP THE GATE OPEN.
      // An ASK for a change is remembered, so the revised Quality Day is re-proposed rather than saved unseen.
      markRevisionAsked(sc);
      b.reply = (b.modelText || C3_HOLD_NUDGE).trim();
      return;
    }
    b.reply = (b.modelText || C3_NUDGE).trim();
  },
};

// ══ C3 · GREG'S SETUP STAGES ══════════════════════════════════════════════════════════════════════════════════
//
// C3 is specified in THREE PHASES (C3.md:573, 584, 586): setup (stages 1–4), the tracked week (5), then a review
// (6–8). We shipped stage 2 — one coach turn that elicits the definition — and the week. Stages 1, 3 and 4 were
// never built, and they are the ones that decide whether the week actually happens.
//
// STAGE 1's STANCE IS THE LOAD-BEARING ONE (C3-79): "this is a different kind of activity — tracking over time,
// not reflecting once." Every other Session in the program is a conversation that ends. This one ends and then
// asks for seven days. A member who does not know that at the start reads the week as the app nagging them.
//
// STAGE 3 SETS THE EXPECTATIONS BEFORE MONITORING STARTS (C3-81): consistency over completeness, and forgetting
// is normal. Said afterwards it is consolation; said first it is permission, and it is the difference between a
// missed day ending the week and a missed day being part of it. Greg is explicit elsewhere: never penalise a
// missed day.
//
// STAGE 4 IS LIGHT PLANNING (C3-82): the tracking cue anchored to an existing routine, a backup for missed days,
// and a readiness confirm. HIS DOCS NEVER DEFINE "backup for missed days" — flagged for him — so the member
// defines it, which is the right answer anyway: a backup they chose is one they might use.
const C3_STANCE_FRAME =
  'Quality Days is a different shape from everything you have done so far.' + BEAT_SEP +
  'The other Sessions were a conversation that ended. This one ends and then asks you for about a week — a ' +
  'short check-in a day, tracking over time rather than reflecting once.' + BEAT_SEP +
  'That is the point of it. What a good day is made of is not something you can work out in one sitting; it ' +
  'shows up across days, in the ones that went well and the ones that did not.';
const C3_STANCE_ASK = 'Before we define anything: what does a good day look like for you right now?';

// Stage 3 — the expectations, before monitoring starts. His words, ours.
const C3_COMMIT_ASK =
  'Two things about the week, and then we set it up.' + BEAT_SEP +
  'Consistency matters more than completeness — four honest days beat seven tidy ones. And you will forget a ' +
  'day. That is normal, it is not a failure, and a missed day never counts against you.' + BEAT_SEP +
  // THE CUE IS FOLDED INTO THE WHEN. Greg lists "establish when the Member will check in" (stage 3) and
  // "identify the tracking cue — existing routine anchor" (stage 4) as separate items, and asked back to back
  // they are the same question twice: "when would you do this?" then "what would it hang off?". His two items,
  // one ask, with the anchor as the guidance it always was.
  'When in the day would you do it? Hang it off something you already do, so it has somewhere to live.';

// Stage 4 — light planning. Cue, backup, readiness.
const C3_BACKUP_ASK =
  'And on a day you forget until it is too late — what do you want to do then? Skip it, or catch it up the next morning?';
const C3_PLAN_READY = 'That is the setup. Ready to start tomorrow?';

// Stage 3 — one turn: they say when they will check in, and the week's expectations have been set.
const c3CommitStage: StageDef = {
  id: 'c3-commit',
  mode: 'drawout',
  opener: () => C3_COMMIT_ASK,
  offersSubstance: () => true,
  gather: (b) => { b.stage = 'c3-backup'; b.reply = receiveThen(b.modelText, C3_BACKUP_ASK); },
  confirm: (b) => { b.stage = 'c3-backup'; b.reply = receiveThen(b.modelText, C3_BACKUP_ASK); },
};

// Stage 4 — the backup for a missed day. ONE turn, then the week opens.
//
// GREG NEVER DEFINES "backup for missed days" — flagged for him. So the member defines it, which is the better
// answer regardless: a backup they chose is one they might actually use. It also does the work of his "never
// penalise a missed day" rule at the moment it matters, by planning for the miss before it happens.
const c3BackupStage: StageDef = {
  id: 'c3-backup',
  mode: 'drawout',
  opener: () => C3_BACKUP_ASK,
  offersSubstance: () => true,
  // The ACTION opens the c3_quality week off this completing turn, as it always has.
  gather: (b) => { b.stage = 'complete'; b.complete = true; b.reply = receiveThen(b.modelText, `${C3_PLAN_READY}${BEAT_SEP}${C3_COMMITTED_2}`); },
  confirm: (b) => { b.stage = 'complete'; b.complete = true; b.reply = receiveThen(b.modelText, `${C3_PLAN_READY}${BEAT_SEP}${C3_COMMITTED_2}`); },
};

const c3EngageConfig = {
  id: 'c3-open',
  next: 'quality',
  frame: () => C3_STANCE_FRAME,
  question: () => C3_STANCE_ASK,
  handIn: () => c3Opening(),
};

export const RECLAIM_C3_ARC: ArcConfig = {
  id: 'reclaim-c3',
  stageOrder: ['c3-open', 'quality', 'c3-commit', 'c3-backup'],
  stages: {
    'c3-open': engagementStage(c3EngageConfig),
    quality: qualityStage,
    'c3-commit': c3CommitStage,
    'c3-backup': c3BackupStage,
  },
  onComplete: () => C3_COMMITTED_1,
};

export function applyReclaimC3Turn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn = { text: '' }): Turn {
  return runArcTurn(RECLAIM_C3_ARC, state, history, memberMessage, model);
}
/**
 * Compose the Quality-Day profile into ONE Playbook play — the member's own words, nothing added.
 *
 * Reclaim was writing NOTHING to the Playbook. A member could finish C1, C2, C3 and C4 and their play count would
 * not move (Jay, 2026-08-12: "even though things are being added, I've been stuck on 14 for awhile"). Rewire and
 * Rebuild each commit a keeper at their close; Reclaim's arc route committed none. This is the first of them, and
 * it is deliberately the SAME shape as composePilotPlan rather than a new idea — a Quality Day is the Reclaim-phase
 * sibling of the Lifestyle Pilot, and it should read like one on the page.
 *
 * THEIR WORDS, JOINED — never summarised, never re-phrased. The labels are ours; every element between them is
 * exactly what they typed at the C3 coach ([[their-own-words-back]]). Disruptors are included because a member who
 * named what wrecks a day is telling you as much as one who named what makes it.
 *
 * A section with nothing in it is OMITTED rather than rendered as an empty heading — the profile is theirs to fill
 * as far as they wanted to, and a blank "What gets in the way —" reads as something they failed to do.
 */
export function composeQualityDay(p: { nonNegotiables: string[]; contributors: string[]; disruptors: string[] }): string {
  const line = (label: string, xs: string[]): string | null =>
    xs.filter((x) => x && x.trim()).length ? `${label} — ${xs.filter((x) => x && x.trim()).map((x) => x.trim()).join(' · ')}` : null;
  return [
    line('Non-negotiable', p.nonNegotiables),
    line('Helps', p.contributors),
    line('Gets in the way', p.disruptors),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Compose C1's refined Reclaim List into ONE Playbook play — what they said they are taking back.
 *
 * `top3` is the member's OWN ordering of their own refined wording (RefinementResult), so the anchor leads by
 * construction — which is the whole point of Looking Forward (Jay, 2026-08-11: "Shouldn't the starred item be on
 * top. That was the whole point"). Nothing is re-sorted here; re-deciding their order in a second place is how
 * two surfaces start disagreeing about which item matters most.
 *
 * ONLY the top tier. The refined list holds four tiers and the full list already lives on the Reclaim List page —
 * a play that reprinted all of it would be a duplicate of a surface that is always current, which is the mistake
 * we removed from Momentum this morning. What earns a kept play is the SHORT answer to "what am I taking back".
 */
export function composeRefinedList(top3: readonly string[]): string | null {
  const kept = top3.map((t) => (t ?? '').trim()).filter(Boolean);
  if (!kept.length) return null; // nothing confirmed → no play, never an empty heading
  return `Taking back — ${kept.join(' · ')}`;
}

export function reclaimC3Opening(): Turn {
  // OPENS ON GREG'S STAGE 1 — the stance (tracking over time, not reflecting once) before the definition work.
  return { reply: engagementOpening(c3EngageConfig), state: { stage: 'c3-open', collected: {} }, complete: false };
}

export const C3_SYSTEM =
  // GOVERNED (2026-08-27). This prompt was a standalone string, so the Companion ran this Session with none of the
  // shared rules — privacy, never-name-a-real-person, never-infer-gender, the AI-tell word list, the locked
  // vocabulary, identity-is-not-an-address, what-you-are, reflect-and-route, never-narrate-the-machinery. Each was
  // written because it had already reached a real member once, and the costliest is privacy: the block's own
  // header records a member being assured "this is between us" by something with no knowledge of how her data is
  // held. Rewire was governed on 8/26 and verified live — asked the privacy question, it refused the between-us
  // promise, named the Founders and offered to escalate.
  //
  // The AI-disclosure trailer is excluded by MEMBER_AGENT_GOVERNED_CORE, deliberately: it reads "first line of a
  // member's first conversation, verbatim", and dropped here it would re-disclose forty minutes into a Session.
  MEMBER_AGENT_GOVERNED_CORE + '\n\n' +
  "You are the G4L Companion running C3, Quality Days, in Reclaim (Phase 4). You help the member DEFINE what makes a " +
  "day a 'quality day' for them — a warm, member-owned coaching conversation (not a survey). Walk them: (1) elicit " +
  "what's present when a day feels genuinely good — solid, healthy, meaningful, aligned (offer examples only if they're " +
  "stuck — movement, eating well, rest, connection, calm, focus, time outside, creativity, progress); (2) help them " +
  // NO NAME HERE. This said "Greg's simple ranking" and the Companion passed it straight to the member — "Greg's
  // framework has three layers" (Donna, 2026-08-19), a stranger appearing mid-sentence in Quality Days. The model
  // did not invent it; we told it. The ranking IS his and the credit belongs on the Why-it-works card, where she
  // can go and look — not dropped into the conversation as an aside to someone she has never met.
  "sort it into a simple ranking — the TOP 3 non-negotiables (a day is hard to call quality without these), the " +
  "NEXT 3 contributors (they strongly help), and the TOP 2 disruptors (what most often pulls a day down); (3) play " +
  "their own words back. Anchor elements (movement, eating, rest) usually belong in the non-negotiables, but it's " +
  "theirs to decide — never impose.\n\n" +
  "RECORDING: once the definition is settled, call record_quality_day with nonNegotiables (up to 3), contributors (up " +
  "to 3), and disruptors (up to 2) — THEIR EXACT WORDS, COPIED. Do not tidy them: do not capitalise, do not shorten " +
  "for neatness, do not turn 'a walk with Rosie before the house wakes' into 'Morning walk with Rosie'. The detail " +
  "you would trim is the part that makes it theirs, and they are going to read this back as their own. Copy the span " +
  "they said and nothing else. Only call it when it's settled; the app then shows them " +
  "the profile to confirm before saving. If a distress or crisis signal appears, drop the exercise and route to support " +
  "(988 US / local) and a human — always on." + SESSION_LIMITS;

const RECORD_QUALITY_DAY_TOOL = {
  name: 'record_quality_day',
  description: "Record the member's settled Quality-Day definition so the app can show it back to confirm. Their own words.",
  input_schema: {
    type: 'object' as const,
    properties: {
      nonNegotiables: { type: 'array', items: { type: 'string' }, description: 'top 3 — a day is hard to call quality without these' },
      contributors: { type: 'array', items: { type: 'string' }, description: 'next 3 — strongly improve the day' },
      disruptors: { type: 'array', items: { type: 'string' }, description: 'top 2 — most often pull the day down' },
    },
    required: ['nonNegotiables'],
  },
};

function parseQualityDayModel(content: readonly unknown[]): ModelTurn {
  let text = '';
  let qualityDay: ModelTurn['qualityDay'];
  for (const raw of content) {
    const bl = raw as { type: string; text?: string; name?: string; input?: { nonNegotiables?: unknown; contributors?: unknown; disruptors?: unknown } };
    if (bl.type === 'text') text += bl.text ?? '';
    if (bl.type === 'tool_use' && bl.name === 'record_quality_day') {
      const arr = (a: unknown): string[] => (Array.isArray(a) ? a.map((s) => String(s ?? '')) : []);
      qualityDay = { nonNegotiables: arr(bl.input?.nonNegotiables), contributors: arr(bl.input?.contributors), disruptors: arr(bl.input?.disruptors) };
    }
  }
  return { text: text.trim(), ...(qualityDay ? { qualityDay } : {}) };
}

/** @param carryForward What B3 and C2 retained (lib/curriculum/retention.ts), rendered, or null. See the note on
 *  liveTurnRebuildB3 — passed in to keep the engine pure, and null must add nothing at all. */
export async function liveTurnReclaimC3(state: ConvState, history: ConvMessage[], memberMessage: string, carryForward?: string | null): Promise<Turn> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 25000, maxRetries: 1, defaultHeaders: { 'accept-encoding': 'identity' } });
  const messages = [
    ...history.map((mm) => ({ role: (mm.role === 'agent' ? 'assistant' : 'user') as 'assistant' | 'user', content: mm.text })),
    { role: 'user' as const, content: memberMessage },
  ];
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 600,
    // CACHED PREFIX / VOLATILE SUFFIX. The governed core plus this Session's own text is byte-identical every
    // turn and carries the breakpoint; context, stage note and carry-forward move AFTER it, because a single
    // varying byte inside a cached block invalidates the whole thing and pays the 1.25x write premium for
    // nothing. The prompt was ~650 tokens ungoverned — BELOW Sonnet's 1024-token cache minimum, so it could
    // never cache at any price. Governed it clears the bar, and a Session is cheaper than it was before.
    system: [
      { type: 'text' as const, text: C3_SYSTEM, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: carryForward ? `\n\n${carryForward}` : '' },
    ],
    tools: [RECORD_QUALITY_DAY_TOOL],
    messages,
  });
  return applyReclaimC3Turn(state, history, memberMessage, parseQualityDayModel(res.content));
}

// ══ C4 · The Reclaim Checkpoint (the capstone — closes Cycle 1) ═══════════════════════════════════════════════
// The Phase-4 close: an ADMINISTERED beat (6 current-state Challenge items, 1–5, deterministic — a clean 6, no
// pairwise) → a hold into the ceremony. The ACTION scores the Challenge component (Ave1→Ave2), writes the Checkpoint
// grinta_reading, and sets reclaim_checkpoint_passed. The ceremony revisits the Legacy + invites the Community Success
// Story → closes Cycle 1 (the Loop). No new migration — reuses grinta_reading. Items VERBATIM (RC-7 C-labels).
// Split into recap (the doorway's frame) + the instrument's own framing on 2026-08-28, so CHECKPOINT_ENGAGE_Q
// sits between them and the member closes the phase in their words before it closes in ours.
const C4_CHECKPOINT_RECAP =
  "You did the real work of Reclaim — you revisited your list with clearer eyes, mapped where your world can get " +
  "bigger, and defined what makes a day yours.";
const C4_CHECKPOINT_OPEN =
  "Now a quick read on where your challenge sits — the pull toward what's possible. Six of these, one to five. " +
  "They set your Reclaim read — you'll see how it moved your Grinta Index at the close.";
const C4_CHECKPOINT_CLOSE = "That's the read. Hold on — let me show you what you just built.";
function reclaimCheckpointDeliver(index: number): string {
  return grintaStem(CHECKPOINT_CHALLENGE_ITEMS[index]!);
}
function reclaimCheckpointOpener(): string {
  return `${C4_CHECKPOINT_OPEN}\n\n${reclaimCheckpointDeliver(0)}`;
}

const reclaimCheckpointStage: StageDef = administeredStage({
  id: 'checkpoint',
  itemCount: CHECKPOINT_CHALLENGE_ITEMS.length, // 6 (scaleMax defaults to 5)
  ...AGREEMENT_1_5, // Greg's verbatim 1–5 anchors, one definition (onboarding-staged.ts)
  opener: () => reclaimCheckpointOpener(),
  deliverItem: (n) => reclaimCheckpointDeliver(n),
  reprompt: (n) => `Just a number, 1 to 5 — how true does that feel right now?\n\n${reclaimCheckpointDeliver(n)}`,
  onComplete: (b) => {
    // The 6 challenge responses are in b.administeredResponses. Hand into the ceremony; the ACTION scores the Challenge
    // component (Ave1→Ave2), persists the Checkpoint reading, and sets the capstone gate.
    b.stage = 'ceremony';
    b.reply = C4_CHECKPOINT_CLOSE;
  },
});

const RECLAIM_CEREMONY_LEAD = 'Hold on — let me show you what you just built.';
const reclaimCeremonyStage: StageDef = {
  id: 'ceremony',
  mode: 'drawout',
  opener: () => RECLAIM_CEREMONY_LEAD,
  offersSubstance: () => true,
  gather(b) {
    b.reply = RECLAIM_CEREMONY_LEAD;
  },
  confirm(b) {
    b.reply = RECLAIM_CEREMONY_LEAD;
  },
};

const reclaimCheckpointEngage = checkpointEngagement({
  next: 'checkpoint',
  recap: C4_CHECKPOINT_RECAP,
  handIn: () => reclaimCheckpointOpener(),
});

export const RECLAIM_CHECKPOINT_ARC: ArcConfig = {
  id: 'reclaim-checkpoint',
  stageOrder: ['checkpoint-open', 'checkpoint', 'ceremony'],
  stages: {
    'checkpoint-open': engagementStage(reclaimCheckpointEngage),
    checkpoint: reclaimCheckpointStage,
    ceremony: reclaimCeremonyStage,
  },
  onComplete: () => RECLAIM_CEREMONY_LEAD,
};

export function applyReclaimCheckpointTurn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn = { text: '' }): Turn {
  return runArcTurn(RECLAIM_CHECKPOINT_ARC, state, history, memberMessage, model);
}
export function reclaimCheckpointOpening(): Turn {
  // Opens on the doorway; the 1–5 chips belong to the instrument, one turn later.
  return { reply: engagementOpening(reclaimCheckpointEngage), state: { stage: 'checkpoint-open', collected: {} }, complete: false };
}
// The Checkpoint is ADMINISTERED (deterministic Likert) — no model call needed; the action passes empty text.
export function liveTurnReclaimCheckpoint(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  return applyReclaimCheckpointTurn(state, history, memberMessage, { text: '' });
}
