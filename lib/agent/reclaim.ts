// Reclaim (v2.5, Phase 4 — Challenge / "the bigger world"). Config #5 on the shared arc kernel. Spec of record:
// G4L_Reclaim_Build_Approach_v0.2 + Greg's RECLAIM Gated Assets V4. The Cycle-1 capstone — closes the loop, hands to
// Community. Almost entirely REUSE (coaching mode, administered factory, Momentum, the checkpoint+ceremony pattern).
// SLICE 1 = C1 · Looking Forward — one stage: the Reclaim List refinement, COACH mode. (Was two; Greg cut the opening
// evidence self-check on 2026-08-07 and held it for Cycle 2 — see the C1 section below.) COACH mode: the
// model coaches the re-read/reflect/refine/re-prioritize, the engine proposes the refined list, and only the member's
// confirm commits it back to the live list (propose→confirm→commit, Decision L — never silent mutation). Flag-gated by
// RECLAIM (Decision JJ) — gated; flipped to Production 2026-07-10 (v2.5, all four Rs live).

import { runArcTurn, administeredStage, scaleExpects, type ArcConfig, type StageDef } from './onboarding-staged.ts';
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
import { confirmsProposal } from './onboarding-intent.ts';
import { groundToMemberWords } from './member-words.ts';
import { proposalSignature, shouldPropose, markProposed, confirmOutranksRerecord, markRevisionAsked, type CoachGate } from './coach-gate.ts';

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
  const top3 = ref.top3.filter(Boolean);
  const top3Line = top3.length ? `\n\nThe three you'd move on next: ${top3.join(' · ')}.` : '';
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
export const RECLAIM_C1_ARC: ArcConfig = {
  id: 'reclaim-c1',
  stageOrder: ['refine'],
  stages: { refine: refineStage },
  onComplete: () => REFINE_COMMITTED_1,
};

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
  const collected: Collected = { reclaimList: listTexts.filter(Boolean) };
  return { reply: refineOpener(collected), state: { stage: 'refine', collected }, complete: false };
}

// ── The live surface — the model COACHES the refinement and records the result via record_refinement ──
const REFINE_SYSTEM =
  "You are the G4L Companion running C1 Step 2 — revisiting the member's Reclaim List in Reclaim (Phase 4). The list " +
  "was built at the very start; now, after Reconnect/Rewire/Rebuild, you help them re-read it THROUGH A CHANGED SELF " +
  "and refine it. This is coaching, warm and member-owned — not a survey, not therapy. Walk them, one question at a " +
  "time, through: (1) re-read the list and notice it; (2) reflect on what still feels true, what feels different, " +
  "what's newly important; (3) refine the wording — help vague items ('be healthier') become specific and personal " +
  "('feel physically capable and steady again'), and merge items that belong together; (4) re-prioritize into four " +
  "tiers — Top Priorities Now, Important but Not First, Emerging Priorities, No Longer Central — then name the three " +
  "they'd move on next. Play their own words back; never impose. Do NOT rewrite their list yourself — you propose, " +
  "they decide.\n\n" +
  "RECORDING: once you've walked the refinement and the member has settled it, call record_refinement with the WHOLE " +
  "refined list — every item as {original (their current wording, to match), text (the refined wording, or the same " +
  "if unchanged), tier} — plus top3 (the three refined texts they'd move on next). " +
  // ADDED 2026-08-17. `added` existed in the tool schema and nothing here mentioned it, so the model never used
  // it — a live walk named a new goal and it vanished. Same failure as B3's eating day-target on 8/7: an
  // instruction that lives only in a tool description is one the model skips at the moment it matters.
  "IF THEY NAMED SOMETHING THAT IS NOT ALREADY ON THE LIST — a goal that has newly emerged, which is step (2) — pass " +
  "it in `added` as {text (their own words), tier, emergedFrom (what brought it into view, if they said)}. Do NOT put " +
  "a new goal in `items`: `original` there must match a line already on their list, so a new one silently matches " +
  "nothing and is lost. Only what they actually said they want; never invent one, and omit `added` entirely when " +
  "nothing new came up, which is the common case. " +
  "Only call it when the refinement is " +
  "settled; the app then shows them the result to confirm before anything is saved. 'No Longer Central' just means " +
  "lowest priority for this season — it does NOT delete the item. If a distress or crisis signal appears, drop the " +
  "exercise and route to support (988 US / local) and a human — always on.";

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
  for (const raw of content) {
    const bl = raw as { type: string; text?: string; name?: string; input?: { items?: unknown; top3?: unknown } };
    if (bl.type === 'text') text += bl.text ?? '';
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
  return { text: text.trim(), ...(refinement ? { refinement } : {}) };
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
    system: REFINE_SYSTEM + refineStageNote(state) + (carryForward ? `\n\n${carryForward}` : ''),
    tools: [RECORD_REFINEMENT_TOOL],
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
  return (
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
    `${BEAT_SEP}That's your first focus now. I'll work from it, and it's what we'll build your Quality Days around.`
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
    b.stage = 'complete';
    b.complete = true;
    b.reply = auditSummary(b.administeredResponses.slice(0, AUDIT_ITEM_COUNT), b.collected);
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
  ...AUDIT_DOMAINS.flatMap((d) => [rateAId(d), gapStageId(d), rateBId(d), closeStageId(d)]),
  'sort',
];

export const RECLAIM_C2_ARC: ArcConfig = {
  id: 'reclaim-c2',
  stageOrder: C2_STAGE_ORDER,
  stages: Object.fromEntries([
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
  ]),
  onComplete: () => 'Here’s what stands out from the audit.',
};

export function applyReclaimC2Turn(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  // C2 is ADMINISTERED (deterministic 1–10 parse) — no model call needed; the action passes empty text.
  return runArcTurn(RECLAIM_C2_ARC, state, history, memberMessage, { text: '' });
}

export function reclaimC2Opening(): Turn {
  const first = rateAId(AUDIT_DOMAINS[0]!);
  return { reply: auditOpener(), state: { stage: first, collected: {} }, complete: false, expects: scaleExpects(RECLAIM_C2_ARC, first, false) };
}

export function liveTurnReclaimC2(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  return applyReclaimC2Turn(state, history, memberMessage);
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
  const list = (xs: string[]) => xs.map((x) => `  • ${x}`).join('\n');
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
      b.stage = 'complete';
      b.complete = true;
      b.reply = `${C3_COMMITTED_1}${BEAT_SEP}${C3_COMMITTED_2}`;
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
        b.stage = 'complete';
        b.complete = true;
        b.reply = `${C3_COMMITTED_1}${BEAT_SEP}${C3_COMMITTED_2}`;
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

export const RECLAIM_C3_ARC: ArcConfig = {
  id: 'reclaim-c3',
  stageOrder: ['quality'],
  stages: { quality: qualityStage },
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
  return { reply: c3Opening(), state: { stage: 'quality', collected: {} }, complete: false };
}

const C3_SYSTEM =
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
  "(988 US / local) and a human — always on.";

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
    system: C3_SYSTEM + (carryForward ? `\n\n${carryForward}` : ''),
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
const C4_CHECKPOINT_OPEN =
  "You did the real work of Reclaim — you revisited your list with clearer eyes, mapped where your world can get " +
  "bigger, and defined what makes a day yours. Before we close the cycle, a quick read on where your challenge sits " +
  "now — the pull toward what's possible. Six of these, one to five. They set your Reclaim read — you'll see how it " +
  "moved your Grinta Index at the close.";
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
  minLabel: 'not at all', // W-24: chip anchors — the frozen Grinta 1–5 poles
  maxLabel: 'completely',
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

export const RECLAIM_CHECKPOINT_ARC: ArcConfig = {
  id: 'reclaim-checkpoint',
  stageOrder: ['checkpoint', 'ceremony'],
  stages: { checkpoint: reclaimCheckpointStage, ceremony: reclaimCeremonyStage },
  onComplete: () => RECLAIM_CEREMONY_LEAD,
};

export function applyReclaimCheckpointTurn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn = { text: '' }): Turn {
  return runArcTurn(RECLAIM_CHECKPOINT_ARC, state, history, memberMessage, model);
}
export function reclaimCheckpointOpening(): Turn {
  return { reply: reclaimCheckpointOpener(), state: { stage: 'checkpoint', collected: {} }, complete: false, expects: scaleExpects(RECLAIM_CHECKPOINT_ARC, 'checkpoint', false) };
}
// The Checkpoint is ADMINISTERED (deterministic Likert) — no model call needed; the action passes empty text.
export function liveTurnReclaimCheckpoint(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  return applyReclaimCheckpointTurn(state, history, memberMessage, { text: '' });
}
