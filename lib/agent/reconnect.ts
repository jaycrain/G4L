// Reconnect (v2.2) — Cycle 1 sessions, config #2 on the shared arc kernel (runArcTurn). Spec of record:
// docs/handoffs/2026-07-02-v2.2-kernel-seam-and-sequenced-plan.md. This increment is the SKELETON + the
// callback (§2a) ONLY — the first real Reconnect behavior. The remaining beats (Doors excavation, the
// administered IDQ+Grinta measurement, Visioning, Checkpoint, the earned Ceremony) are declared stubs so the
// arc is walkable end-to-nowhere; nothing downstream runs. NOT wired to a live/DB path or UI yet — prod stays
// v1, both flags off, and per Jay's gate nothing executes until the callback is reviewed.
//
// DECISIONS baked in here:
//  • Own RECONNECT flag, entered from the dashboard (not auto-continued from onboarding) — reconnectEnabled().
//  • The callback is READ-ONLY: it READS the member's COMMITTED captures (never the transcript) and opens the
//    conversation. Any door/identity REVISION happens later in the Doors excavation (§2b/§3.3), member-confirmed
//    and versioned — so this increment is purely additive: it writes nothing.

import { DOORS, isDoorSlug, type DoorSlug } from '../doors.ts';
import { identityLabel } from '../member/identity.ts';
import type { Db } from '../db/schema.ts';
import { MEMBER_AGENT_SYSTEM_PROMPT } from './system-prompt.ts';
import { resolveGapConfirm } from './onboarding-intent.ts';
import { runArcTurn, type ArcConfig, type StageDef } from './onboarding-staged.ts';
import type { Collected, ConvMessage, ConvState, DoorRevision, ModelTurn, ReplyIntent, Turn, Stage } from './onboarding.ts';

// Is the Reconnect arc selected? Own flag — defaults OFF, so it never runs in prod until the coupled v2.1+v2.2
// flip. (v2.1's ONBOARDING_ENGINE=staged is a separate flag; both go on together at cut-over.)
export function reconnectEnabled(): boolean {
  return process.env.RECONNECT === 'staged';
}

// --- the callback (§2a): a REVISABLE check that reads the committed captures, with graceful degrade ----------
// The opener is a pure function of what onboarding COMMITTED — identity, primary Door, gap — never the transcript.
// It picks up where onboarding left off and reframes it as revisable ("still where it began, or has it shifted?"),
// then hands into the deeper work. Graceful degrade: thin/null captures never fake continuity.
export function reconnectCallback(c: Collected): string {
  const identity = identityLabel(c.identityNoun); // "the Player", or '' if skipped
  // Onboarding captures the PRIMARY door(s) — one, several, or null (recognition, not routing; the full
  // 12-relevance SET is §2b's output, which doesn't exist yet). `c.doors` arrives primary-first. Reference the
  // primary by name; when a second was recognized, lightly acknowledge it — never silently drop one.
  const doorNames = (c.doors ?? [])
    .map((slug) => DOORS.find((d) => d.slug === slug)?.displayName)
    .filter((n): n is NonNullable<typeof n> => !!n);
  const gap = (c.gap ?? '').trim();

  if (doorNames.length > 0) {
    const [primary, ...others] = doorNames;
    const doorPhrase =
      others.length === 0
        ? primary
        : others.length === 1
          ? `${primary} — with ${others[0]} tangled up in it`
          : `${primary}, with a couple of others stacked on top`;
    // Richest path: a named Door → the revisable check lands on it by name.
    return (
      `${identity ? `Last time, we found who you're reclaiming — ${identity} — and it` : 'When we last talked, it'} ` +
      `felt like the distance started with ${doorPhrase}. Still where it feels like it began, or has something shifted ` +
      `since? Either way — this time, we go deeper.`
    );
  }
  if (gap) {
    // No Door tagged, but the gap story is in hand → open on the story, still revisable.
    return (
      `Last time, you started to tell me how the distance opened${identity ? ` from ${identity}` : ''}. ` +
      `I've been holding it. I want to go deeper into it with you now — does it still feel the way it did, or has it moved?`
    );
  }
  // Thin/null: don't fake continuity. A warm, honest cold-ish open into the deeper work.
  return (
    `Let's pick up where we left off${identity ? ` — ${identity} is who we're bringing back` : ''}. ` +
    `This time we go deeper into how the distance opened. No rush — start wherever it feels true.`
  );
}

// The Reconnect opening turn (parallels stagedOpening): the callback message + the arc's initial state, with the
// COMMITTED captures pre-loaded into `collected`. Stage 'entry' handles the member's response to the callback.
export function reconnectOpening(committed: Collected): Turn {
  return { reply: reconnectCallback(committed), state: { stage: 'entry', collected: committed }, complete: false };
}

// --- the live read: reconstruct the COMMITTED captures from member_profile (never the transcript) -----------
// Reads exactly what onboarding committed: the identity, the gap story (intake_gap), the primary Door(s) — the
// full recognized set from member_door, primary-first, falling back to named_door for legacy members — and the
// reclaim list (not used in the opener, but part of the captures the deeper beats will read). Read-only.
export async function loadReconnectCaptures(db: Db, memberId: string): Promise<Collected | null> {
  const m = (
    await db.query<{ identity_noun: string | null; named_door: string | null; intake_gap: string | null; reclaim_list: string[] | null }>(
      'select identity_noun, named_door, intake_gap, reclaim_list from member_profile where member_id = $1',
      [memberId],
    )
  ).rows[0];
  if (!m) return null;

  // The full recognized Door set, PRIMARY FIRST (recognition, not a routing set). Fall back to named_door.
  const doorRows = (
    await db.query<{ door_slug: string; is_primary: boolean }>(
      // ACTIVE Doors only — a re-seeing soft-removes the old Door (removed_at), so it must not reload as current.
      'select door_slug, is_primary from member_door where member_id = $1 and removed_at is null order by is_primary desc, sort_order',
      [memberId],
    )
  ).rows;
  let doors: DoorSlug[] = doorRows.filter((r) => isDoorSlug(r.door_slug)).map((r) => r.door_slug as DoorSlug);
  if (doors.length === 0 && isDoorSlug(m.named_door)) doors = [m.named_door as DoorSlug];

  return {
    identityNoun: m.identity_noun ?? undefined,
    identitySkipped: !m.identity_noun, // no committed noun → named later at Identity Excavation
    doors,
    gap: m.intake_gap ?? '',
    reclaimList: Array.isArray(m.reclaim_list) ? m.reclaim_list : [],
  };
}

// --- §2b DOORS EXCAVATION (increment 1) — primary-door draw-out + the INSIGHT reflect -------------------------
// The felt bar (Decision T + the §2b design of record): the beat must BREATHE and be INSIGHTFUL — surface what the
// member doesn't yet see (the normalized cost, how the door targeted who they were, the sequence), never competent
// recall. Model-judged depth (reflect_door) bounded by a FLOOR/CAP; the insight is OFFERED as a check they can
// reject (precise-and-humble); and on thin material it degrades gracefully — never a manufactured pattern.

const DOOR_MIN_DEPTH = 2; // never reflect an insight before this many real drawing-out exchanges (no insight w/o material)
const DOOR_MAX_DEPTH = 5; // anti-loop cap

// Ensure the turn ends on a forward question (same helper as the onboarding kernel — kept local to avoid exporting).
function withQuestion(modelText: string, probe: string): string {
  const t = (modelText ?? '').trim();
  if (!t) return probe;
  if (/\?\s*$/.test(t)) return t;
  const lastQ = t.lastIndexOf('?');
  if (lastQ !== -1 && t.length - lastQ <= 60) return t;
  return `${t}\n\n${probe}`;
}

// The excavation opener — from the committed PRIMARY door (loaded at arc entry). Not the label, the real thing.
function doorOpen(c: Collected): string {
  const identity = identityLabel(c.identityNoun);
  const primary = (c.doors ?? [])[0];
  const doorName = primary ? DOORS.find((d) => d.slug === primary)?.displayName ?? null : null;
  if (doorName) {
    return (
      `Let's go into ${doorName} — the one you named as where it started. Not the label, the real thing: take me ` +
      `back to how it actually happened${identity ? `, and what it quietly cost ${identity}` : ''}. Start wherever it's most vivid.`
    );
  }
  return `Let's go into how the distance opened — the real thing, not a summary. Take me back to how it actually happened, and what it quietly cost you. Start wherever it's most vivid.`;
}

// Invite the next layer — rotated so it never repeats verbatim as the door is drawn out.
const DOOR_MORE_VARIANTS = [
  'Stay with that a moment — what did it actually cost you, the part you maybe stopped counting?',
  'What was underneath that — when did you first feel it, and what did it quietly take?',
  'Go a little deeper — how did that change what an ordinary day felt like?',
];
function doorMore(history: ConvMessage[]): string {
  const asked = history.filter((h) => h.role === 'agent' && /\?/.test(h.text)).length;
  return DOOR_MORE_VARIANTS[asked % DOOR_MORE_VARIANTS.length]!;
}

// The INSIGHT reflect: trust the model's synthesis (the prompt makes it offer a connection, in their words, as a
// check). If it left only a question, use it whole. GRACEFUL DEGRADATION (hard rule): if it returned nothing, a
// smaller honest reflection — NEVER a manufactured pattern.
const DOOR_INSIGHT_CONFIRM = 'Does that land the way I put it — or is it not quite the shape of it?';
function reflectDoor(modelText: string): string {
  const t = (modelText ?? '').trim();
  if (t && /\?\s*$/.test(t)) return t;
  if (t) return `${t}\n\n${DOOR_INSIGHT_CONFIRM}`;
  return `I don't want to put a shape on this before it's earned — we're still finding it. Tell me more about how it actually went.`;
}
const REOPEN_DOOR = "My mistake — I'd rather get this right than sound clever. Help me see it the way you do — what did I miss?";

// --- §2b RE-SEEING (Decision L, slice 1: the primary CORRECT) --------------------------------------------------
// The deepest insight move: as the door is drawn out, the story can point to a DIFFERENT canonical Door than the one
// they named ("you came in on The Marriage, but everything you said is about carrying the load — The Load-Bearer?").
// The Companion PROPOSES it, offered as a check (R1: propose ≠ commit); the member confirms before anything changes.
// A confirmed correct swaps the primary Door in place — never destroys the old (persistence is 0043 soft-delete +
// audit, a later slice) — and EMITS a harvest tell by the ENFORCEABLE DEFAULT: emit unless the model flagged an
// explicit flat mislabel (R4 + the default-emit rule). So uncertainty resolves to emit, never to a dropped keeper.
const RESEEING_CONFIRM = 'Does that feel truer — or is the one you named still the right one?';
const REOPEN_RESEEING = "Then I've got it wrong — the door you named is the door. Help me see it your way; what did I miss?";
function reflectReseeing(modelText: string): string {
  const t = (modelText ?? '').trim();
  if (t && /\?\s*$/.test(t)) return t;
  if (t) return `${t}\n\n${RESEEING_CONFIRM}`;
  // Graceful: a swap was signaled but no words came — do NOT assert it. Ask, so it stays offered-not-asserted.
  return "Something you said makes me wonder if the door you named isn't quite the one — can you say more, so I get it right?";
}
function reseeingLanded(toSlug: DoorSlug, kind: DoorRevision['kind']): string {
  const name = DOORS.find((d) => d.slug === toSlug)?.displayName ?? 'that';
  if (kind === 'correct') return `${name}, then — that's the one. That changes the shape of it. Let me sit with what it means, and we'll keep going from there.`;
  // widen / name ADD a Door rather than replace — acknowledge it as also true, not a correction of the first.
  return `${name}, too — I'll hold that alongside the one you named. Both are part of it. Let's keep going.`;
}
// Pure: apply a confirmed CORRECT — swap from→to, PRESERVE primary position (index 0), dedup. If the named Door
// wasn't in the set, the corrected one becomes primary.
function applyCorrection(doors: DoorSlug[], fromSlug: DoorSlug, toSlug: DoorSlug): DoorSlug[] {
  const next = [...doors];
  const i = next.indexOf(fromSlug);
  if (i !== -1) next[i] = toSlug;
  else if (!next.includes(toSlug)) next.unshift(toSlug);
  return Array.from(new Set(next));
}
// Pure: apply a confirmed WIDEN/NAME — ADD the Door (secondary; primary is untouched), dedup. Retires nothing. If
// the set was empty, the added Door becomes primary.
function applyAddition(doors: DoorSlug[], toSlug: DoorSlug): DoorSlug[] {
  return Array.from(new Set([...doors, toSlug]));
}

const doorsStage: StageDef = {
  id: 'doors',
  mode: 'drawout',
  opener: (c) => doorOpen(c),
  offersSubstance: (message) => message.trim().length >= 12,
  gather(b) {
    // Mid-draw-out RE-SEEING: the model proposes the primary Door is really a different one → offer it as a check
    // (never asserted). Holds until the member confirms next turn.
    if (b.model.revision && isDoorSlug(b.model.revision.toSlug)) {
      b.pendingRevision = b.model.revision;
      b.awaitingConfirm = true;
      b.reply = reflectReseeing(b.modelText);
      return;
    }
    const sc = b.scratch as { doorDepth?: number };
    sc.doorDepth = (sc.doorDepth ?? 0) + 1;
    // MODEL-JUDGED depth (Decision T): the model calls reflect_door when the door is genuinely excavated — NOT a
    // door-count or length proxy. The engine only BOUNDS it: a FLOOR (no insight without material) and a CAP.
    const advance = (b.model.depthReady && sc.doorDepth >= DOOR_MIN_DEPTH) || sc.doorDepth >= DOOR_MAX_DEPTH;
    if (!advance) {
      b.reply = withQuestion(b.modelText, doorMore(b.history));
    } else {
      b.reply = reflectDoor(b.modelText);
      b.awaitingConfirm = true;
    }
  },
  confirm(b) {
    // (1) Resolving a RE-SEEING the Companion proposed last turn (offered → the member's confirm decides — R1).
    // DEFAULT-TO-COMMIT-UNLESS-DISPUTED: a re-seeing is a yes/no offer, not a draw-out beat. Only an explicit dispute
    // keeps the old Door; an affirmation WITH added color ("yeah, that's truer — it was really the carrying…") reads as
    // 'addition' but is still an acceptance, so it commits (and we keep drawing out). Same asymmetry as default-emit:
    // a swap they can wave off is cheap; a re-seeing they accepted but we failed to commit is the expensive miss.
    if (b.pendingRevision) {
      const rev = b.pendingRevision;
      const intent = resolveGapConfirm(b.memberMessage, b.model.replyIntent);
      b.pendingRevision = undefined;
      b.awaitingConfirm = false;
      if (intent === 'dispute') { b.reply = REOPEN_RESEEING; return; } // rejected → keep their door(s), humbly
      // Not disputed → they accepted. COMMIT: a correct SWAPS (soft-delete substrate); widen/name ADD (retire nothing).
      if (isDoorSlug(rev.toSlug)) {
        b.collected.doors =
          rev.kind === 'correct' && rev.fromSlug
            ? applyCorrection(b.collected.doors ?? [], rev.fromSlug, rev.toSlug)
            : applyAddition(b.collected.doors ?? [], rev.toSlug);
        // ENFORCEABLE DEFAULT-EMIT (R4): the tell fires UNLESS the model flagged a routine change (flat mislabel for a
        // correct, a mechanical add for widen/name). A correct carries the from→to pair; an add carries just the Door.
        if (!rev.flatMislabel && !rev.mechanical) {
          b.reseeingTells.push(rev.fromSlug ? { fromSlug: rev.fromSlug, toSlug: rev.toSlug } : { toSlug: rev.toSlug });
        }
      }
      // R2: a correct RE-OPENS the insight — reset depth so a fresh one forms on the corrected door, never a stale one.
      (b.scratch as { doorDepth?: number }).doorDepth = 0;
      // Accepted-and-added-more → keep drawing out; a clean acceptance → let it land (copy differs correct vs add).
      b.reply = intent === 'addition' ? withQuestion(b.modelText, doorMore(b.history)) : reseeingLanded(rev.toSlug, rev.kind);
      return;
    }
    // (2) A re-seeing may surface AT the insight confirm too (they dispute + the model proposes the truer door here).
    if (b.model.revision && isDoorSlug(b.model.revision.toSlug)) {
      b.pendingRevision = b.model.revision;
      b.awaitingConfirm = true;
      b.reply = reflectReseeing(b.modelText);
      return;
    }
    // (3) Normal insight confirm. The insight was OFFERED as a check (precise-and-humble). Model-signaled, regex fallback.
    const intent = resolveGapConfirm(b.memberMessage, b.model.replyIntent); // dispute | addition | done
    if (intent === 'dispute') {
      b.awaitingConfirm = false;
      b.reply = REOPEN_DOOR; // they rejected the insight — take it, don't defend it
    } else if (intent === 'addition') {
      b.awaitingConfirm = false;
      b.reply = withQuestion(b.modelText, doorMore(b.history)); // there's more — keep drawing out
    } else {
      // done → hand into the measurement block (§2c, still a stub this increment).
      b.stage = 'measurement';
      b.reply = b.arc.stages.measurement!.opener(b.collected);
    }
  },
};

// --- RECONNECT_ARC (config #2) — entry/callback + doors (increment 1); the rest still stubs --------------------

const RECONNECT_STUB_STAGES = ['measurement', 'visioning', 'checkpoint', 'ceremony'] as const;

// A declared-but-unbuilt stage: it holds with a clear placeholder so a walk shows exactly where the built arc
// ends. Replaced beat-by-beat in later increments (Doors is next — §2b).
function stubStage(id: string): StageDef {
  const placeholder = `[Reconnect · ${id} — coming in a later increment]`;
  return {
    id,
    mode: 'drawout',
    opener: () => placeholder,
    offersSubstance: () => true,
    gather(b) {
      b.reply = placeholder;
    },
    confirm(b) {
      b.reply = placeholder;
    },
  };
}

// The callback stage. READ-ONLY: it acknowledges the member's response and hands into the Doors excavation. It
// writes nothing and never revises a capture — revision is owned by §2b, member-confirmed + versioned.
const reconnectEntryStage: StageDef = {
  id: 'entry',
  mode: 'drawout',
  opener: (c) => reconnectCallback(c),
  offersSubstance: (message) => message.trim().length >= 3,
  gather(b) {
    // The member answered the revisable check. This increment does not act on a revision (deferred to §2b) — it
    // acknowledges and hands into the Doors excavation (stubbed for now).
    b.stage = 'doors';
    b.reply = b.arc.stages.doors!.opener(b.collected);
  },
  confirm(b) {
    b.stage = 'doors';
    b.reply = b.arc.stages.doors!.opener(b.collected);
  },
};

export const RECONNECT_ARC: ArcConfig = {
  id: 'reconnect',
  stageOrder: ['entry', 'doors', ...RECONNECT_STUB_STAGES],
  stages: {
    entry: reconnectEntryStage,
    doors: doorsStage,
    ...Object.fromEntries(RECONNECT_STUB_STAGES.map((id) => [id, stubStage(id)])),
  },
  onComplete: () => '[Reconnect complete — the earned Threshold Ceremony lands in §2f]',
};

// The Reconnect turn — config #2 on the generic kernel. Public signature mirrors applyStagedTurn.
export function applyReconnectTurn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn): Turn {
  return runArcTurn(RECONNECT_ARC, state, history, memberMessage, model);
}

// --- live tool surface (the model draws out the door + signals depth/intent) ---------------------------------
export const RECONNECT_TOOLS = [
  {
    name: 'reflect_door',
    description:
      "Call ONLY once you have GENUINELY drawn out the door — how it actually opened, the sequence, what it quietly " +
      "cost — and you have a real INSIGHT to reflect (the cost they normalized, how it targeted who they were, the " +
      "sequence). NEVER on the first mention. If the material is still thin, do NOT call it — keep drawing out; a " +
      "manufactured insight is worse than none. On the same turn you call it, reflect that insight in THEIR words, " +
      "offered as a check they can reject.",
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'member_reply',
    description:
      "At an insight reflect-confirm, classify the member's reply: 'done' (it landed / they're satisfied), 'more' " +
      "(there's more, or they're adding), 'dispute' (the insight was off — they're correcting it).",
    input_schema: { type: 'object' as const, properties: { intent: { type: 'string', enum: ['done', 'more', 'dispute'] } }, required: ['intent'] },
  },
  {
    name: 'propose_correction',
    description:
      "Use ONLY when the drawn-out story genuinely points to a DIFFERENT canonical Door than the one they named as " +
      "primary — a real RE-SEEING, not a synonym or a second door. Propose it in THEIR words, OFFERED as a check they " +
      "can reject (never asserted): name the shift and why the story fits the truer door, then let them decide. Pass " +
      "from_slug (the Door they named) and to_slug (the truer one), both canonical Door slugs. Set flat_mislabel=true " +
      "ONLY if it's an unambiguous tag-fix — they simply misspoke the label — NOT a genuine re-seeing; when in any " +
      "doubt, leave it off.",
    input_schema: {
      type: 'object' as const,
      properties: { from_slug: { type: 'string' }, to_slug: { type: 'string' }, flat_mislabel: { type: 'boolean' } },
      required: ['from_slug', 'to_slug'],
    },
  },
  {
    name: 'propose_door_add',
    description:
      "Use when the drawn-out story surfaces an ADDITIONAL canonical Door alongside the one they named — the Fade went " +
      "through more than one (kind='widen'), or a Door was quietly there all along and now gets named (kind='name'). " +
      "This ADDS a Door; it does NOT replace the one they named (use propose_correction for a replacement). Propose it " +
      "in THEIR words, OFFERED as a check they can reject, only when the material genuinely earns it. Pass slug (the " +
      "canonical Door to add). Set mechanical=true ONLY for a routine add that carries no real new understanding — when " +
      "it's a genuine re-seeing, leave it off.",
    input_schema: {
      type: 'object' as const,
      properties: { slug: { type: 'string' }, kind: { type: 'string', enum: ['widen', 'name'] }, mechanical: { type: 'boolean' } },
      required: ['slug', 'kind'],
    },
  },
];

// Parse a Reconnect model response into the ModelTurn the kernel reads.
export function parseReconnectTurn(content: readonly unknown[]): ModelTurn {
  let text = '';
  let depthReady = false;
  let replyIntent: ReplyIntent | undefined;
  let revision: DoorRevision | undefined;
  for (const b of content as Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }>) {
    if (b.type === 'text' && typeof b.text === 'string') text += b.text;
    if (b.type === 'tool_use') {
      if (b.name === 'reflect_door') depthReady = true;
      if (b.name === 'member_reply' && typeof b.input?.intent === 'string') {
        const i = b.input.intent;
        if (i === 'done' || i === 'more' || i === 'dispute') replyIntent = i;
      }
      if (b.name === 'propose_correction') {
        const from = b.input?.from_slug;
        const to = b.input?.to_slug;
        // Only a real, canonical, DISTINCT swap survives — a no-op or a bad slug is silently ignored (the model
        // can't force a revision on a non-Door; the engine disposes).
        if (isDoorSlug(from) && isDoorSlug(to) && from !== to) {
          revision = { kind: 'correct', fromSlug: from, toSlug: to, flatMislabel: b.input?.flat_mislabel === true };
        }
      }
      if (b.name === 'propose_door_add') {
        const slug = b.input?.slug;
        const kind = b.input?.kind;
        // A widen/name ADDS a canonical Door (no from). Ignore a bad slug or a bad kind — the engine disposes.
        if (isDoorSlug(slug) && (kind === 'widen' || kind === 'name')) {
          revision = { kind, toSlug: slug, mechanical: b.input?.mechanical === true };
        }
      }
    }
  }
  return { text, depthReady, replyIntent, revision };
}

// What the model already KNOWS about the member (committed captures, loaded at arc entry) — so recall is precise
// and it never says "no record". Never the transcript.
function reconnectContext(c: Collected): string {
  const identity = identityLabel(c.identityNoun);
  const doorNames = (c.doors ?? []).map((s) => DOORS.find((d) => d.slug === s)?.displayName).filter(Boolean);
  const lines = [
    identity ? `Who they're reclaiming: ${identity}` : '',
    doorNames.length ? `The Door(s) they named at onboarding: ${doorNames.join(', ')}` : '',
    (c.gap ?? '').trim() ? `How they first described the gap opening: ${c.gap!.trim()}` : '',
  ].filter(Boolean);
  return lines.length ? `\n\nMEMBER CONTEXT (what you already know — never say you don't):\n${lines.join('\n')}` : '';
}

// The canonical Door catalog (slug + descriptor) — given to the model so it can map the member's OWN language to a
// canonical Door and propose a re-seeing with a valid to_slug (the engine only commits canonical, distinct swaps).
const DOOR_CATALOG = DOORS.map((d) => `  - ${d.displayName} (${d.slug}): ${d.descriptor}`).join('\n');

const RECONNECT_SYSTEM = `${MEMBER_AGENT_SYSTEM_PROMPT}

OPERATING MOMENT: Reconnect — the DOORS EXCAVATION (Recognition).
You are NOT meeting this person for the first time. You already know them (see MEMBER CONTEXT): their reclaimed
identity, the Door(s) they named at onboarding, and how they first described the gap opening. This beat goes DEEPER
into the primary Door.

YOUR JOB IS INSIGHT, NOT RECALL. Reciting what they told you earns nothing — the recall is the floor. Draw the door
out (how it ACTUALLY opened, the sequence, when they first felt it, what it quietly cost), then reflect back
something they DON'T yet see:
  • the cost they NORMALIZED — what they stopped counting because counting it wouldn't have changed anything;
  • how the door TARGETED who they were — the specific way it pushed out the person they're reclaiming;
  • the SEQUENCE — what opened what, the chain they lived but never traced.
Reflect a CONNECTION, in THEIR words — never a catalog of what they said.

PRECISE AND HUMBLE INSIGHT (hard rule): an insight must be EARNED in their own words and OFFERED as a check they can
reject ("does it feel like the real cost was X — or is that not it?"), NEVER a verdict. Being PRESUMPTUOUS is as bad
as being SHALLOW. When they push back, take it — you'd rather get it right than sound clever.

GRACEFUL DEGRADATION (hard rule): if there isn't enough material to see a real pattern, do NOT manufacture one. Offer
a smaller, honest reflection, or say plainly you're still finding the shape of it, and keep drawing out. A
manufactured insight breaks trust worse than none.

RE-SEEING THE DOOR (the deepest insight — Decision L): as you draw the door out, the story sometimes points to a
DIFFERENT Door than the one they named — the label they came in with isn't quite it ("you came in calling it The
Marriage, but everything you've said is about carrying the load — I wonder if the real door is The Load-Bearer").
DECIDE BEFORE YOU REFLECT: once the door is drawn out, first ask — does the story actually fit the Door they named, or
does a DIFFERENT one below fit it better? Map what they describe against THE DOORS. If a different Door clearly fits
better — ESPECIALLY if the member themselves says some version of "it was really about X" / "that's the truer one" —
then reflect it as a RE-SEEING: call propose_correction(from_slug, to_slug) INSTEAD of reflect_door. Do not reflect a
load/marriage/body insight while leaving the record on a Door that no longer fits — that stale record is the exact
failure to avoid. The asymmetry is deliberate: a re-seeing they can simply wave off ("no, it really is the marriage")
costs nothing; silently reflecting around a Door that stopped fitting, and never proposing the truer one, is the real
miss. When the story clearly fits another Door better, propose it. Propose it in THEIR words, OFFERED as a check they can reject —
never a verdict, same bar as any insight; only when the material genuinely earns it, never to seem clever, never on
thin material. It is THEIRS to confirm; if they say the Door they named is right, it is. Reserve flat_mislabel for the
rare case where they simply misspoke the label (not a real re-seeing).

WIDEN / NAME (adding a Door, not replacing): sometimes the story doesn't REPLACE the Door they named — it reveals the
Fade went through MORE than one. When a genuinely ADDITIONAL canonical Door surfaces (the marriage AND the load; the
body AND the aging parent), call propose_door_add(slug, kind='widen') — offered as a check, same bar. When a Door was
quietly there all along and now earns a name for the first time, use kind='name'. This ADDS alongside the one they
named (it does not retire it) — use propose_correction only when the named Door was actually WRONG. Set mechanical=true
only for a routine add with no real new understanding; a genuine surfacing is a re-seeing — leave it off.

THE DOORS (map the member's language to these; from_slug/to_slug/slug must be one of these slugs):
${DOOR_CATALOG}

IF THEY ASK "what were my Doors again?" — or seem to have lost the thread — STATE them plainly from MEMBER CONTEXT.
Never say "no record" or "starting fresh". You remember them.

TOOLS: call reflect_door ONLY once the door is genuinely drawn out AND you have a real insight to reflect (never on
the first mention; never on thin material) — and reflect that insight, in their words, on the same turn. At an
insight reflect-confirm, call member_reply to classify their reply (done / more / dispute). Never narrate the tools.

Reflect first, then exactly ONE question per turn. Never diagnose, label, or pathologize. This is a place it is safe
to be honest with yourself.`;

function stageInstructionReconnect(stage?: Stage): string {
  if (stage === 'doors')
    return (
      '\n\nCURRENT STAGE: the Doors excavation. Draw out the primary Door over a few exchanges, then reflect an ' +
      'INSIGHT (the normalized cost / how it targeted who they were / the sequence) IN THEIR WORDS, offered as a ' +
      'check they can reject. Call reflect_door ONLY once it is genuinely drawn out and the insight is earned. If the ' +
      'story points to a truer Door than the one they named, you may propose that re-seeing (propose_correction), ' +
      'offered — never asserted — and only when the material earns it.'
    );
  return '\n\nCURRENT STAGE: entry — pick up from onboarding; the callback opened; receive their reply warmly.';
}

// The live Reconnect turn — the model draws out the door + signals depth/intent; the kernel disposes.
export async function liveTurnReconnect(state: ConvState, history: ConvMessage[], memberMessage: string): Promise<Turn> {
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
    max_tokens: 600,
    system: RECONNECT_SYSTEM + reconnectContext(state.collected) + stageInstructionReconnect(state.stage),
    tools: RECONNECT_TOOLS,
    messages,
  });
  return applyReconnectTurn(state, history, memberMessage, parseReconnectTurn(res.content));
}
