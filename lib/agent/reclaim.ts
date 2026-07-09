// Reclaim (v2.5, Phase 4 — Challenge / "the bigger world"). Config #5 on the shared arc kernel. Spec of record:
// G4L_Reclaim_Build_Approach_v0.2 + Greg's RECLAIM Gated Assets V4. The Cycle-1 capstone — closes the loop, hands to
// Community. Almost entirely REUSE (coaching mode, administered factory, Momentum, the checkpoint+ceremony pattern).
// SLICE 1 = C1 · Readiness Assessment: Step 1 (evidence) → Step 2 (refine). Step 1 = the 15-item evidence self-check,
// administered + FORMATIVE (RC-2: not scored, not persisted). Step 2 = the Reclaim List refinement, COACH mode: the
// model coaches the re-read/reflect/refine/re-prioritize, the engine proposes the refined list, and only the member's
// confirm commits it back to the live list (propose→confirm→commit, Decision L — never silent mutation). Flag-gated by
// RECLAIM (Decision JJ) — OFF by default; prod stays v2.4.

import { runArcTurn, administeredStage, type ArcConfig, type StageDef } from './onboarding-staged.ts';
import { BEAT_SEP, type Collected, type ConvMessage, type ConvState, type ModelTurn, type Turn } from './onboarding.ts';
import { EVIDENCE_ITEMS, EVIDENCE_ITEM_COUNT, EVIDENCE_PART_STARTS, EVIDENCE_PART_LABEL } from '../reclaim/evidence-instrument.ts';
import { TIER_LABEL, REFINE_TIERS, isTier, type Tier } from '../reclaim/refinement-store.ts';
import { AUDIT_ITEMS, AUDIT_ITEM_COUNT, AUDIT_SCALE_MAX, AUDIT_DOMAIN_STARTS, AUDIT_DOMAIN_LABEL, AUDIT_DOMAIN_INTRO } from '../reclaim/bigger-world-instrument.ts';
import { scoreAudit } from '../reclaim/bigger-world-scoring.ts';

export function reclaimEnabled(): boolean {
  return process.env.RECLAIM === 'staged';
}

// ══ C1 · Readiness Assessment · Step 1 — Reflecting on Progress ═══════════════════════════════════════════════
const C1_OPEN =
  "Reclaim isn't something someone else declares for you — it's something you recognize in yourself. This is a look at " +
  "whether the work you've done through Reconnect, Rewire, and Rebuild is showing up in how you live, not just how you " +
  "feel. Rate each one 1 (strongly disagree) to 5 (strongly agree). There's no score here — just an honest read. We'll " +
  "go in three parts: your body, your relationships, and who you are.";
// The close (Greg's verbatim "Guide to Member after Step 1") — reflective, all-or-nothing explicitly rejected.
const C1_STEP1_CLOSE =
  "That's the read. If you rated yourself a 4 or 5 on most of these, the work has landed — you're in Reclaim. Not " +
  "because someone told you, but because the evidence is there. And if it's more mixed, that's honest too: Reclaim " +
  "isn't all-or-nothing. You can be in Reclaim in your body and still in Rebuild in your relationships. The Rs are a " +
  "cycle, not a checklist.";

function evidenceDeliver(index: number): string {
  const item = EVIDENCE_ITEMS[index]!;
  const partStart = EVIDENCE_PART_STARTS[index];
  if (partStart) return `${EVIDENCE_PART_LABEL[partStart]}\n\n${item.stem}`;
  return item.stem;
}
function evidenceOpener(): string {
  return `${C1_OPEN}\n\n${evidenceDeliver(0)}`;
}

const evidenceStage: StageDef = administeredStage({
  id: 'evidence',
  itemCount: EVIDENCE_ITEM_COUNT, // 15 (scaleMax defaults to 5)
  opener: () => evidenceOpener(),
  deliverItem: (n) => evidenceDeliver(n),
  reprompt: (n) => `Just a number, 1 to 5 — how true does that feel?\n\n${evidenceDeliver(n)}`,
  onComplete: (b) => {
    // FORMATIVE (RC-2): the 15 responses are NOT scored or persisted — nothing reads b.administeredResponses. Close on
    // the reflective mirror, then hand into Step 2 (the refinement), presenting the member's current Reclaim List.
    b.stage = 'refine';
    b.reply = `${C1_STEP1_CLOSE}${BEAT_SEP}${refineOpener(b.collected)}`;
  },
});

// ══ C1 · Step 2 — Revisiting the Reclaim List (COACH mode) ════════════════════════════════════════════════════
// The transition (Greg's member-facing copy) + the member's CURRENT list, presented for the re-read. The list is
// seeded into collected.reclaimList by the opening action, so the arc stays pure.
function currentList(c: Collected): string[] {
  return (c.reclaimList ?? []).map((s) => (s ?? '').trim()).filter(Boolean);
}
function refineOpener(c: Collected): string {
  const list = currentList(c);
  const shown = list.length ? list.map((t) => `• ${t}`).join('\n') : '(your list is empty — we can build it here)';
  return (
    "At the start, you built this Reclaim List from who you were then. You're not standing in the same place now — " +
    "you've reconnected with who you are, seen what pulls you off course, and learned how your habits actually work. " +
    "Let's revisit it with clearer eyes. Not to prove the old list right or wrong — just to make sure it still fits the " +
    `person you're becoming.${BEAT_SEP}Here's your list as it stands:\n\n${shown}${BEAT_SEP}Before changing anything, ` +
    "just notice it. What still feels true, what feels different, and what feels newly important?"
  );
}

const REFINE_REVISE_NUDGE = "No problem — tell me what you'd change, and we'll adjust it.";
const REFINE_NUDGE = "Take your time. Which items still matter most, which feel different now, and what's newly important?";
const REFINE_COMMITTED_1 = "Done — your Reclaim List now reflects where you actually are, sorted by what matters most right now.";
const REFINE_COMMITTED_2 = "I've kept a snapshot of where it was, too — so you can always see how it's shifted. You can revisit it anytime by asking for your Reclaim List.";

// Order tiers top→bottom for the proposal display.
const TIER_DISPLAY_ORDER: Tier[] = [...REFINE_TIERS];
// The engine-owned proposal — reflect the refined list back, grouped by tier, with the top-3, then the confirm gate.
function proposeRefinement(ref: NonNullable<Collected['pendingRefinement']>): string {
  const byTier = TIER_DISPLAY_ORDER.map((tier) => {
    const items = ref.items.filter((i) => i.tier === tier);
    if (!items.length) return '';
    return `${TIER_LABEL[tier]}:\n${items.map((i) => `  • ${i.text}`).join('\n')}`;
  }).filter(Boolean).join('\n\n');
  const top3 = ref.top3.filter(Boolean);
  const top3Line = top3.length ? `\n\nThe three you'd move on next: ${top3.join(' · ')}.` : '';
  return `Here's your list, refined:\n\n${byTier}${top3Line}${BEAT_SEP}Want me to save this as your Reclaim List, or tweak something first?`;
}

const REFINE_CONFIRM_RE =
  /^(yes|yeah|yep|yup|save it|save that|lock it in|lock it|that'?s it|that works|perfect|good|sounds good|do it|looks good|keep it|commit|confirm(ed)?)\b/i;
function refineConfirms(msg: string): boolean {
  return REFINE_CONFIRM_RE.test(msg.trim().replace(/[.,!?]+$/, ''));
}
// Keep only refined items with a valid tier — the sanitized snapshot the engine holds + the action commits.
function sanitizeRefinement(r: ModelTurn['refinement']): Collected['pendingRefinement'] | undefined {
  if (!r || !Array.isArray(r.items)) return undefined;
  const items = r.items
    .filter((i) => i && typeof i.original === 'string' && typeof i.text === 'string' && isTier(i.tier))
    .map((i) => ({ original: i.original.trim(), text: i.text.trim(), tier: i.tier }));
  if (!items.length) return undefined;
  const top3 = (Array.isArray(r.top3) ? r.top3 : []).filter((t): t is string => typeof t === 'string' && !!t.trim()).map((t) => t.trim());
  return { items, top3 };
}

const refineStage: StageDef = {
  id: 'refine',
  mode: 'coach',
  opener: (c) => refineOpener(c),
  offersSubstance: () => true,
  gather() {},
  confirm() {},
  coach(b) {
    const sc = b.scratch as { proposed?: boolean };
    // Capture the model's refined list (the whole result) into the snapshot — no live-list mutation here.
    const captured = sanitizeRefinement(b.model.refinement);
    if (captured) b.collected.pendingRefinement = captured;
    const ref = b.collected.pendingRefinement;
    const ready = !!ref && ref.items.length > 0 && ref.top3.length > 0;

    if (sc.proposed) {
      if (refineConfirms(b.memberMessage)) {
        // Member confirmed → COMPLETE. The ACTION commits the snapshot to the live list (member-authorized).
        b.stage = 'complete';
        b.complete = true;
        b.reply = `${REFINE_COMMITTED_1}${BEAT_SEP}${REFINE_COMMITTED_2}`;
        return;
      }
      // Not a confirm → the member is tweaking; re-open coaching (the model re-records the adjusted result).
      sc.proposed = false;
      b.reply = (b.modelText || REFINE_REVISE_NUDGE).trim();
      return;
    }

    if (ready) {
      // The refined list is captured → PROPOSE it (engine-owned reflection), then the confirm gate.
      sc.proposed = true;
      b.reply = proposeRefinement(ref!);
      return;
    }

    // Still coaching — the model's turn IS the reply (its next question). Fallback only if the model is empty.
    b.reply = (b.modelText || REFINE_NUDGE).trim();
  },
};

export const RECLAIM_C1_ARC: ArcConfig = {
  id: 'reclaim-c1',
  stageOrder: ['evidence', 'refine'],
  stages: { evidence: evidenceStage, refine: refineStage },
  onComplete: () => REFINE_COMMITTED_1,
};

export function applyReclaimC1Turn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn = { text: '' }): Turn {
  // Evidence turns pass the default empty model (administered ignores it); refine turns pass the parsed model turn.
  return runArcTurn(RECLAIM_C1_ARC, state, history, memberMessage, model);
}

// The opening seeds the member's CURRENT Reclaim List into collected (loaded by the action) so Step 2 can present it.
export function reclaimC1Opening(listTexts: string[] = []): Turn {
  return { reply: evidenceOpener(), state: { stage: 'evidence', collected: { reclaimList: listTexts.filter(Boolean) } }, complete: false };
}

// Step 1 (evidence) is administered → deterministic, no model call.
export function liveTurnReclaimC1(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  return applyReclaimC1Turn(state, history, memberMessage);
}

// ── Step 2 (refine) live surface — the model COACHES the refinement and records the result via record_refinement ──
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
  "if unchanged), tier} — plus top3 (the three refined texts they'd move on next). Only call it when the refinement is " +
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

export async function liveTurnReclaimRefine(state: ConvState, history: ConvMessage[], memberMessage: string): Promise<Turn> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 25000,
    maxRetries: 2,
    defaultHeaders: { 'accept-encoding': 'identity' },
  });
  const messages = [
    ...history.map((m) => ({ role: (m.role === 'agent' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.text })),
    { role: 'user' as const, content: memberMessage },
  ];
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 700,
    system: REFINE_SYSTEM + refineStageNote(state),
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
  "matters, how ready you feel, and how much progress there would lift the rest of your life. No wrong answers — this " +
  "is about finding priorities, not judging yourself.";

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
function auditSummary(responses: number[]): string {
  const s = scoreAudit(responses);
  const primary = AUDIT_DOMAIN_LABEL[s.primary];
  const lever = AUDIT_DOMAIN_LABEL[s.momentumLever];
  const leverLine =
    s.momentumLever === s.primary
      ? ` It's also where you feel most ready to move — a strong place to start.`
      : ` And if you want an easier place to build momentum first, ${lever} is where you're most ready.`;
  return (
    `Here's what stands out. Your best next focus looks like your ${primary} life — not just because there's distance ` +
    `there, but because it matters to you and progress there would ripple into the rest of your life.${leverLine}` +
    `${BEAT_SEP}This was about finding the priority, not judging any of it. It's saved — you can come back to it anytime.`
  );
}

const auditStage: StageDef = administeredStage({
  id: 'audit',
  itemCount: AUDIT_ITEM_COUNT, // 20
  scaleMax: AUDIT_SCALE_MAX, // 10 (the scale-param)
  opener: () => auditOpener(),
  deliverItem: (n) => auditDeliver(n),
  reprompt: (n) => `A number from 1 to 10 — where would you put it?\n\n${auditDeliver(n)}`,
  onComplete: (b) => {
    // All 20 ratings are in b.administeredResponses. Summarize the RC-1 priorities in-engine (pure); the ACTION scores
    // + persists the durable reading (RC-4).
    b.stage = 'complete';
    b.complete = true;
    b.reply = auditSummary(b.administeredResponses.slice(0, AUDIT_ITEM_COUNT));
  },
});

export const RECLAIM_C2_ARC: ArcConfig = {
  id: 'reclaim-c2',
  stageOrder: ['audit'],
  stages: { audit: auditStage },
  onComplete: () => 'Here’s what stands out from the audit.',
};

export function applyReclaimC2Turn(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  // C2 is ADMINISTERED (deterministic 1–10 parse) — no model call needed; the action passes empty text.
  return runArcTurn(RECLAIM_C2_ARC, state, history, memberMessage, { text: '' });
}

export function reclaimC2Opening(): Turn {
  return { reply: auditOpener(), state: { stage: 'audit', collected: {} }, complete: false };
}

export function liveTurnReclaimC2(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  return applyReclaimC2Turn(state, history, memberMessage);
}
