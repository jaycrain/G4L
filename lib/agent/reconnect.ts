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

import { DOORS, matchDoors, isDoorSlug, type DoorSlug } from '../doors.ts';
import { TOTAL_ITEMS, itemStem, DIMENSIONS, type Dimension } from '../idq/instrument.ts';
import { scoreIdq } from '../idq/scoring.ts';
import { identityLabel } from '../member/identity.ts';
import { nextFollowUp } from './follow-up.ts';
import { doorProvenance } from './door-provenance.ts';
import type { Db } from '../db/schema.ts';
import { MEMBER_AGENT_SYSTEM_PROMPT } from './system-prompt.ts';
import { resolveConfirmCorroborated, memberWantsToAdvance } from './onboarding-intent.ts';
import { LEGACY_PROMPTS, letterDateFor } from '../reconnect/legacy-letter.ts';
import { parseBoardSubmission, boardIsEmpty, type BoardSubmission } from '../reconnect/doors-board-claim.ts';
import { runArcTurn, administeredStage, drawoutShouldReflect, receiveThen, isProcessMetaOrAssent, affirmsReflection, type ArcConfig, type StageDef } from './onboarding-staged.ts';
import { captureCreate } from './capture-model.ts';
import { CHECKPOINT_GRIT_ITEMS, grintaStem } from '../grinta/survey/instrument.ts';
import type { Collected, ConvMessage, ConvState, DoorRevision, ModelTurn, ReplyIntent, Turn, Stage } from './onboarding.ts';

import { BEAT_SEP } from './onboarding.ts';
export { BEAT_SEP }; // re-export so the reconnect action + chat keep importing it from here

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
    // Richest path: a named Door → the revisable check lands on it by name. Warm reframe → the forecast (what this
    // session will do) → the guiding question. Three beats so the member sees the shape before diving in.
    return [
      `${identity ? `Last time, we found who you're reclaiming — ${identity} — and it` : 'When we last talked, it'} ` +
        `felt like the distance started with ${doorPhrase}. This time, we go deeper into all of it.`,
      RECONNECT_FORECAST,
      `Does that still feel like where it began — or has something shifted since?`,
    ].join(BEAT_SEP);
  }
  if (gap) {
    // No Door tagged, but the gap story is in hand → open on the story, still revisable.
    return [
      `Last time, you started to tell me how the distance opened${identity ? ` from ${identity}` : ''}. I've been holding it, and I want to go deeper into it with you now.`,
      RECONNECT_FORECAST,
      `Does it still feel the way it did — or has it moved?`,
    ].join(BEAT_SEP);
  }
  // Thin/null: don't fake continuity. A warm, honest cold-ish open into the deeper work.
  return [
    `Let's pick up where we left off${identity ? ` — ${identity} is who we're bringing back` : ''}. This time we go deeper into how the distance opened.`,
    RECONNECT_FORECAST,
    `No rush — start wherever it feels true.`,
  ].join(BEAT_SEP);
}

// The forecast beat (Jay + Greg): the first Reconnect session must tell the member the SHAPE of the work up front —
// without it, the drawing-out feels pointless and endless. Maps honestly to the arc: Doors → a fresh measure (IDQ) →
// the cost + the future you're reclaiming (Drift/Window) → the Checkpoint that opens the next phase. Plain, no hype.
const RECONNECT_FORECAST =
  "Here's the shape of it: we'll walk back through the Door — or Doors — the distance came in through, take a fresh " +
  'measure of where you are now, then look at what it quietly cost and the life you\'re reclaiming. It ends where your ' +
  'next phase begins. One thing at a time, at your pace — you set the depth, and you can stop whenever you want.';

// The Reconnect opening turn (parallels stagedOpening): the callback message + the arc's initial state, with the
// COMMITTED captures pre-loaded into `collected`. Stage 'entry' handles the member's response to the callback.
export function reconnectOpening(committed: Collected): Turn {
  // Snapshot the Door set AS IT STANDS NOW, before this session can revise it. This is the only moment the
  // distinction is free — after §2b commits an add, `collected.doors` no longer remembers what they walked in with.
  return {
    reply: reconnectCallback(committed),
    state: { stage: 'entry', collected: committed, doorsAtEntry: [...(committed.doors ?? [])] },
    complete: false,
  };
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
  // Degrade-not-crash: this read is SUPPLEMENTARY (the named_door fallback below carries the primary) and uses
  // removed_at (migration 0043) — a column a drifted DB may lack. On any read failure, degrade to [] so the arc
  // still opens on the named_door primary instead of throwing out of the (unguarded) arc-entry callers.
  const doorRows = await db
    .query<{ door_slug: string; is_primary: boolean }>(
      // ACTIVE Doors only — a re-seeing soft-removes the old Door (removed_at), so it must not reload as current.
      'select door_slug, is_primary from member_door where member_id = $1 and removed_at is null order by is_primary desc, sort_order',
      [memberId],
    )
    .then((r) => r.rows)
    .catch((e) => {
      console.warn('member_door read failed (0043 removed_at unapplied?) — degrading to named_door:', (e as Error).message);
      return [] as { door_slug: string; is_primary: boolean }[];
    });
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
// `probe` is NULL once every follow-up for this beat has been said — see nextFollowUp. Then the model's own text
// is the whole reply, which is where the draw-out's questions are meant to come from anyway. The terminal line
// exists for the one case that would otherwise emit nothing: no model text AND no probe left.
const NOTHING_LEFT_TO_ASK = 'Take your time — say more whenever you\'re ready.';
function withQuestion(modelText: string, probe: string | null): string {
  const t = (modelText ?? '').trim();
  if (!t) return probe ?? NOTHING_LEFT_TO_ASK;
  if (!probe) return t;
  if (/\?\s*$/.test(t)) return t;
  const lastQ = t.lastIndexOf('?');
  if (lastQ !== -1 && t.length - lastQ <= 60) return t;
  return `${t}\n\n${probe}`;
}

// SHARED draw-out advance rule (fixes the systematic "reflect but re-ask" tic across every draw-out beat — Doors,
// Drift, Window, and the future Rs). A draw-out beat advances to its reflect-confirm when:
//   • the model SIGNALS depth (reflect_x) past the floor — the explicit path; OR
//   • the model has WRAPPED UP with a declarative reflection past the floor — a substantive statement that does NOT
//     end on a question. When the model is still drawing out it asks a probe (ends on "?"); when it reflects, it
//     STATES. So a statement-without-a-question past the floor IS the reflection — recognize it from the text instead
//     of appending a redundant draw-out probe and re-asking; OR
//   • the CAP is hit (anti-loop).
// This means the engine stops circling once the Companion has reflected, whether or not it remembered the tool call.

// The excavation opener — from the committed PRIMARY door (loaded at arc entry). Not the name, the real thing.
//
// TWO FIXES FROM JAY'S WALK (Cowork, 2026-08-14), both about who we sound like we are talking to:
//   "label" → "name". The member GAVE this Door its name; "label" is our insider word for it, and calling their
//   word a label puts a filing-system between them and their own story.
//   "what it quietly cost {the Player}" → "cost you". Addressing a member in the third person by their claimed
//   Identity is the voice break Jay could always feel but not place. See addressTheMember() below.
function doorOpen(c: Collected): string {
  // WHEN THE BOARD IS COMING, THIS IS FRAMING ONLY — it must not pick a Door or start the excavation.
  //
  // Found on the first live walk (2026-08-18): the opener said "Let's start with The Grind" and the board arrived
  // underneath it, asking her to mark whichever were hers. She was told where we were starting and asked to
  // choose, in the same breath — and then told a SECOND time after she chose, with a different Door. Two
  // "let's start with"s around one decision is the shape that makes a member ask whether we were listening.
  //
  // The excavation opener is not deleted; it moves to boardReceipt, where it can name the Door SHE said weighs
  // most instead of the one our matcher put first.
  if (!c.boardDone) {
    return (
      'Before we go deeper, here is the whole set — every Door we see people come through. ' +
      'Mark the ones that are yours. There is no wrong answer here, and most people mark more than one.'
    );
  }
  const doors = c.doors ?? [];
  const primary = doors[0];
  const doorName = primary ? DOORS.find((d) => d.slug === primary)?.displayName ?? null : null;
  const others = Math.max(0, doors.length - 1);
  if (doorName) {
    // Start with one Door, but HOLD the others (Jay + Greg: rarely one Door — never imply it was the only one).
    const held = others > 0 ? ` We'll get to the other${others > 1 ? 's' : ''} — this is just where we start.` : '';
    return (
      `Let's start with ${doorName} — ${others > 0 ? 'one of the ones you named' : 'the one you named'}.${held} Not the name — the real thing: take me ` +
      `back to how it actually happened, and what it quietly cost you. Start wherever it's most vivid.`
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
// Rotate on how many times WE have spoken, not on how many of our lines contained a '?'. The question-mark count
// freezes the moment a reply without one is emitted (the reflect fallbacks have none), so the same variant came
// back forever — Jennifer's walk saw one line three times running. An agent-message count can only ever grow.
function doorMore(history: ConvMessage[]): string | null {
  return nextFollowUp(DOOR_MORE_VARIANTS, history);
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
// A door REVISION must be GROUNDED in something the member actually said this turn. A bare affirmation ("Yes") is the
// member AGREEING with the reflection — it is not evidence their door is wrong — yet the model sometimes signals a
// revision on exactly that turn, so the Companion answered "Yes" with "maybe the door you named isn't quite the one"
// (twice, on Jay's walk: an unearned, repeated challenge to something he'd just confirmed). Propose-never-assert
// requires substance: no bare assent, and enough words to actually carry a redirect. Same class as the gap-confirm
// corroboration gate — a model guess must never outrank what the member plainly said.
function revisionIsGrounded(memberMessage: string): boolean {
  const t = (memberMessage ?? '').trim();
  return t.length >= 12 && !isProcessMetaOrAssent(t);
}
// A KEEPER is the member's own material about their life — never their reaction to our reflection. The turn a
// draw-out advances on is exactly where a member says "Perfectly depicted!" or "that's it exactly", because the
// reflection just landed — and taking that turn's message wholesale wrote those two words into the Playbook under
// "The drift", a keeper that says nothing about them. (Greg's walk, then Jennifer's — same shape twice, so it's the
// pattern that gets fixed, not the instance.) Same family as revisionIsGrounded: agreement is not material.
const PRAISE_REACTION_RE =
  /^\s*(?:(?:that|this|it|you)(?:'?s| is| are| were)?\s+)?(?:so\s+|very\s+|really\s+|pretty\s+|absolutely\s+|exactly\s+)*(?:perfect(?:ly)?|great|beautiful(?:ly)?|wonderful(?:ly)?|nice(?:ly)?|well)?\s*(?:said|put|depicted|described|captured|nailed|right|true|it|spot\s*on|correct|accurate)?[\s.!,]*$/i;
export function isKeeperMaterial(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  if (isProcessMetaOrAssent(t) || affirmsReflection(t)) return false;
  // A drift declaration or a Tuesday worth keeping is a sentence about their life. "Perfectly depicted!" is two words.
  if (t.split(/\s+/).length < 5) return false;
  return !PRAISE_REACTION_RE.test(t);
}
/** Hold the latest member line that carried real material; leave the previous one in place when this turn didn't. */
function keepIfMaterial(b: { memberMessage: string; driftPayload?: string }): void {
  if (isKeeperMaterial(b.memberMessage)) b.driftPayload = b.memberMessage.trim();
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

// --- W-34 DETERMINISTIC REDIRECT DETECTOR (2nd occurrence → fix the abstraction, not the prompt) ----------------
// The redirect-honor rule lives in the prompt (FOLLOW A REDIRECT), but the model can railroad past it — it opened on
// the primary Door, the member pivoted to a DIFFERENT one of their OWN doors as the real origin, and the model walked
// on into the first door anyway (the founder's live symptom). So the ENGINE detects the redirect deterministically
// and PROPOSES the primacy correction (offered as a check, propose→confirm via the same §2b path) instead of trusting
// the model to notice. Scope, kept tight because a false swap-proposal mid-excavation would itself be a capture bug:
//   • OPENER-ANCHORED — only the first excavation reply, where a redirect semantically lands; a later Door mention is
//     context/sequence, not a redirect, and stays the model's call.
//   • COMMITTED-ONLY — the member pivots among the doors they already named (a primacy correction). A brand-new Door
//     surfacing stays the model's job (propose_door_add / propose_correction).
//   • REQUIRES AN ORIGIN CUE — a passing "the marriage got hard around the diagnosis" (sequence) never trips it; only
//     "really / it goes back to / before the / led to" (reassignment) does.
//   • PROPOSE-NOT-COMMIT + ONCE per excavation — an over-read costs one waved-off check, never a data change or a loop.
// NOTE: this fires only when matchDoors RECOGNIZES the member's word for the door (canonical name or a mapped alias);
// an un-aliased redirect (e.g. a bare "the job" for The Grind) still falls to the model — a deliberate matcher-precision
// tradeoff (forcing "job"→grind would collide with career_cliff's "lost my job"), not an oversight.
const REDIRECT_CUE =
  /\b(really|actually|the real|goes back to|led to|lead to|started (with|it)|came (first|before)|before (the|that|my|his|her|our|it|any)|it was (the|really)|more than the)\b/;

export function detectDoorRedirect(message: string, doors: DoorSlug[]): { from: DoorSlug; to: DoorSlug } | null {
  const from = doors[0];
  if (!from) return null;
  if (!REDIRECT_CUE.test((message || '').toLowerCase())) return null;
  // A committed Door named in this message that ISN'T the one we opened on = the redirect target.
  const to = matchDoors(message).find((d) => d !== from && doors.includes(d));
  return to ? { from, to } : null;
}

function proposeRedirect(fromSlug: DoorSlug, toSlug: DoorSlug): string {
  const from = DOORS.find((d) => d.slug === fromSlug)?.displayName ?? 'that';
  const to = DOORS.find((d) => d.slug === toSlug)?.displayName ?? 'that';
  return `Hold on — it sounds like you're taking me to ${to}, more than ${from}. Should we start there instead — is ${to} closer to where it really began?`;
}

// WHAT SHE READS BACK after the board. R2-07: Greg asks for a WRITTEN response to each reflection, not a tap —
// "after marking your doors, write a brief response to each of these". The taps capture the FIELDS six Sessions
// read; the writing was the reflective work, and dropping it would leave us with her data and none of her meaning.
// So the tap records and the conversation reflects: the Companion opens on what she marked, by name, and draws it
// out from there. That is also what stops the excavation being a fishing expedition — it now starts from three
// specific things she just told us.
const BOARD_EMPTY_REPLY =
  "Nothing there felt like yours — that's an answer, and a useful one. Then let's find it in your words instead. " +
  'Take me back to when the distance started opening. What was going on?';

function boardReceipt(board: BoardSubmission, c: Collected, askOpen: boolean): string {
  const name = (slug: string) => DOORS.find((d) => d.slug === slug)?.displayName ?? slug;
  const marked = board.doors.map((d) => name(d.slug));
  const list = marked.length === 1 ? marked[0]! : `${marked.slice(0, -1).join(', ')} and ${marked[marked.length - 1]}`;

  const parts: string[] = [];
  parts.push(board.quietDrift && marked.length === 0
    ? "You marked the quiet one — no single event, just years of it."
    : board.quietDrift
      ? `${list} — and the quiet one alongside them.`
      : `${list}.`);

  // Lead the conversation with the one she says WEIGHS MOST, not the one that came first. The heaviest is where
  // the excavation has something to find; chronology is context, not the subject.
  const lead = board.biggest ?? board.doors[0]?.slug;
  if (lead) parts.push(`Let's start with ${name(lead)}${board.biggest ? ' — the one you said weighs most today' : ''}. Not the label, the real thing: take me back to how it actually went.`);

  if (askOpen) {
    // ONE ask, then it is let go. Never a second time, and never as a correction of what she did on the board.
    parts.push(`And one thing I skipped past: is any of them still open — one you're walking through right now, not looking back at?`);
  }
  return parts.join(BEAT_SEP);
}

const doorsStage: StageDef = {
  id: 'doors',
  mode: 'drawout',
  opener: (c) => doorOpen(c),
  offersSubstance: (message) => message.trim().length >= 12,
  gather(b) {
    // THE BOARD CAME BACK. Her taps arrive as a machine-readable line, parsed by the one shared format —
    // never interpreted as prose, and never mistaken for something she typed.
    //
    // The engine stays PURE: it records what she chose onto the turn and the ACTION writes it, the same split the
    // Legacy Letter uses. A db call in here would make the whole arc untestable offline.
    const board = parseBoardSubmission(b.memberMessage);
    if (board) {
      b.collected.boardDone = true;
      b.boardSubmission = board;
      // Her claims are Doors now, so the rest of the excavation talks about the set she just confirmed.
      const marked = board.doors.map((d) => d.slug);
      const union = Array.from(new Set([...(b.collected.doors ?? []), ...marked]));
      // `c.doors` arrives PRIMARY-FIRST by convention, so ruling #8 — biggest-impact becomes primary — is
      // expressed here as ordering, not a second field. The DB half (is_primary + named_door) is the action's.
      b.collected.doors = board.biggest ? [board.biggest, ...union.filter((d) => d !== board.biggest)] : union;

      // MARKING NOTHING IS AN ANSWER, and it must not read as a failed step. She gets the ordinary excavation.
      if (boardIsEmpty(board)) {
        b.reply = BOARD_EMPTY_REPLY;
        return;
      }
      // RULING #7 — still-open is the one field six Sessions read, so it earns ONE ask if she skipped it. Asked
      // here, in conversation, rather than blocking the board.
      const askOpen = board.stillOpen.length === 0 && board.doors.length > 0;
      b.reply = boardReceipt(board, b.collected, askOpen);
      return;
    }

    // Mid-draw-out RE-SEEING: the model proposes the primary Door is really a different one → offer it as a check
    // (never asserted). Holds until the member confirms next turn.
    if (b.model.revision && isDoorSlug(b.model.revision.toSlug) && revisionIsGrounded(b.memberMessage)) {
      b.pendingRevision = b.model.revision;
      b.awaitingConfirm = true;
      b.reply = reflectReseeing(b.modelText);
      return;
    }
    const sc = b.scratch as { doorDepth?: number; redirectChecked?: boolean };
    // W-34: the model didn't propose a re-seeing — check the OPENER RESPONSE ourselves (once). If the member pivoted
    // to a different committed Door as the origin, propose the primacy correction through the same §2b confirm path.
    if (!sc.redirectChecked && (sc.doorDepth ?? 0) === 0) {
      sc.redirectChecked = true; // one engine redirect-check per excavation → a dispute can't loop it
      const rd = detectDoorRedirect(b.memberMessage, b.collected.doors ?? []);
      if (rd) {
        b.pendingRevision = { kind: 'correct', fromSlug: rd.from, toSlug: rd.to };
        b.awaitingConfirm = true;
        b.reply = proposeRedirect(rd.from, rd.to);
        return;
      }
    }
    sc.doorDepth = (sc.doorDepth ?? 0) + 1;
    // MODEL-JUDGED depth (Decision T): the model calls reflect_door when the door is genuinely excavated — NOT a
    // door-count or length proxy. The engine only BOUNDS it: a FLOOR (no insight without material) and a CAP.
    const advance = drawoutShouldReflect(b.modelText, b.model.depthReady, sc.doorDepth, DOOR_MIN_DEPTH, DOOR_MAX_DEPTH, memberWantsToAdvance(b.memberMessage));
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
      const intent = resolveConfirmCorroborated(b.memberMessage, b.model.replyIntent, isKeeperMaterial, 'is_this_right');
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
    if (b.model.revision && isDoorSlug(b.model.revision.toSlug) && revisionIsGrounded(b.memberMessage)) {
      b.pendingRevision = b.model.revision;
      b.awaitingConfirm = true;
      b.reply = reflectReseeing(b.modelText);
      return;
    }
    // (3) Normal insight confirm. The insight was OFFERED as a check (precise-and-humble). Model-signaled, regex fallback.
    const intent = resolveConfirmCorroborated(b.memberMessage, b.model.replyIntent, isKeeperMaterial, 'is_this_right'); // dispute | addition | done
    if (intent === 'dispute') {
      b.awaitingConfirm = false;
      b.reply = REOPEN_DOOR; // they rejected the insight — take it, don't defend it
    } else if (intent === 'addition') {
      b.awaitingConfirm = false;
      b.reply = withQuestion(b.modelText, doorMore(b.history)); // there's more — keep drawing out
    } else {
      // done → hand into the measurement block. W-35 (receive-before-you-move): lead with the model's in-voice
      // acknowledgment of the member's final answer BEFORE the scripted IDQ frame — the deterministic opener must not
      // clobber what they just said (the founder answered a weighty question and got the cold "let's shift" frame).
      b.stage = 'measurement';
      const idqOpener = b.arc.stages.measurement!.opener(b.collected);
      // Contract 1: receive (keep the reflection, drop the model's trailing question), then the single IDQ opener (#4).
      b.reply = receiveThen(b.modelText, idqOpener);
    }
  },
};

// --- §2d VISIONING · beat 1: the DRIFT beat (draw-out, back on the depth kernel) ------------------------------
// After the administered §2c detour, Visioning RETURNS to draw-out. The Drift beat surfaces the PATTERN of the drift
// (what the Fade cost, how far it ran) — reflective, formative (stored not scored). Reuses the doorsStage machinery
// (floor/cap + model-judged depth + graceful degradation). On confirm, the drift RECOGNITION is a KEEPER (V4:
// keeperType 'tell' — a self-recognition/warning-sign, not a positive rule), queued for the action to emit. Copy is
// reused from the authored RCN-DFT asset. The beat ENDS on the turn-toward-hope BRIDGE into Legacy (V3).
const DRIFT_MIN_DEPTH = 2;
const DRIFT_MAX_DEPTH = 4;
// Serve a short list back in the member's own words: "a", "a and b", "a, b, and c".
function serveReclaim(items: string[]): string {
  const xs = items.map((s) => s.trim()).filter(Boolean).slice(0, 3);
  if (xs.length <= 1) return xs[0] ?? '';
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`;
}
// The opener — the RCN-DFT step-1 frame + prompt (a hoisted fn so the measurement close can append it on hand-in).
// W-37 + W-36 (stateless-arcs / honor-the-member): RECALL, don't re-collect. The member already named what they want
// back (their Reclaim List) at onboarding — so serve it BACK and DEEPEN (which loss do they feel most), instead of
// asking cold for "a few things the Fade cost you" with INVENTED examples ("the deep friendships" — a loss the member
// never named, W-36). Grounds every example in their own words; never fabricates a loss category, even on the degrade.
export function driftOpen(c: Collected): string {
  const wants = (c.reclaimList ?? []).map((s) => s.trim()).filter(Boolean);
  if (wants.length >= 2) {
    return (
      // "Back at the start" was a temporal claim over a REVISABLE list — items can be added or set aside from the
      // rail at any time, so an item added last week was being dated to onboarding. "You've named" keeps the recall
      // warmth and the ownership ("these are yours, I remember them") without dating them.
      `You've named what you want back — ${serveReclaim(wants)}. Let's stay with those a moment — ` +
      `not a new list, the real weight of it. Of the things you named, which do you feel the distance from most right now?`
    );
  }
  // Graceful degrade — nothing to recall: a grounded take-stock that STILL never invents a specific loss (W-36).
  return (
    "So let's take stock — what has the Fade quietly cost you? Not a checklist — the ones you actually feel. " +
    "Start wherever it's heaviest."
  );
}
const DRIFT_MORE_VARIANTS = [
  "Past the obvious — what's the quiet one you don't usually let yourself miss?",
  'And how far are you from that version of you right now — a little dusty, or a stranger? Don\'t soften it to feel better.',
  // "the Fade", not "the drift" (Cowork, 2026-08-14). The Fade is the protected term for exactly this thing, and
  // the take-stock opener four lines up already says "what has the Fade quietly cost you" — so a member met both
  // names for one idea inside a single beat. Also unstacks the doubled clause Jay flagged on his walk: "stopped
  // even noticing is gone" made you parse a negation and an absence at once.
  "What did the Fade take that you've stopped even missing?",
];
// Rotate on how many times WE have spoken, not on how many of our lines contained a '?'. The question-mark count
// freezes the moment a reply without one is emitted (the reflect fallbacks have none), so the same variant came
// back forever — Jennifer's walk saw one line three times running. An agent-message count can only ever grow.
function driftMore(history: ConvMessage[]): string | null {
  return nextFollowUp(DRIFT_MORE_VARIANTS, history);
}
const DRIFT_CONFIRM = 'Does that name the shape of it — or is it different?';
// NULL means "the model gave us nothing to reflect". Returning a fixed sentence here instead was the bug: the caller
// then had a constant to emit, and a constant re-emits VERBATIM for as long as the model keeps coming back empty.
function reflectDrift(modelText: string): string | null {
  const t = (modelText ?? '').trim();
  if (!t) return null;
  if (/\?\s*$/.test(t)) return t;
  return `${t}\n\n${DRIFT_CONFIRM}`;
}
const REOPEN_DRIFT = "Then I've not got it yet — say it your way. What's the real shape of what the Fade cost you?";
// The BRIDGE (V3): the turn toward hope, at the drift→window seam. LIFT starts HERE — the bridge hands straight into
// The Window's opener (so it's one motion: push off from the drift, look through the window).
function driftToWindowBridge(c: Collected): string {
  return (
    // "the drift" as a NOUN was the Fade under a second name (Jay, 2026-08-15). This is the LIVE line — the
    // twin in lib/curriculum/content/reconnect.ts is read only by Explore the Science. Verb uses and the Drift
    // Quiz are untouched; see the function name above, which describes a seam rather than addressing a member.
    "That's your inventory — what it cost, how far the Fade ran. Not to sit in — to push off from; I've kept it for " +
    "you.\n\nNow we look the other way — at the version of you that's still in there.\n\n" +
    windowOpen(c)
  );
}

const driftStage: StageDef = {
  id: 'drift',
  mode: 'drawout',
  opener: (c) => driftOpen(c),
  offersSubstance: (message) => message.trim().length >= 12,
  gather(b) {
    const sc = b.scratch as { driftDepth?: number };
    sc.driftDepth = (sc.driftDepth ?? 0) + 1;
    // Model-judged depth (reflect_drift → depthReady), bounded by a FLOOR (no pattern on thin material) and CAP.
    const advance = drawoutShouldReflect(b.modelText, b.model.depthReady, sc.driftDepth, DRIFT_MIN_DEPTH, DRIFT_MAX_DEPTH, memberWantsToAdvance(b.memberMessage));
    // Capture the member's drift DECLARATION (their own words — preserve declarations) for the keeper; carry it to
    // the confirm turn, where the keeper is queued once they affirm the pattern. Runs on EVERY gather turn so the
    // last SUBSTANTIVE line is what we hold — see keepIfMaterial.
    keepIfMaterial(b);
    if (!advance) {
      b.reply = withQuestion(b.modelText, driftMore(b.history));
    } else {
      // Only wait for a confirm if we actually REFLECTED. With no model text there is no shape to check — entering
      // the confirm state behind a "tell me more" leaves the engine listening for the answer to a question it never
      // asked. And when there is nothing to reflect we fall back to the ROTATING probe, never a fixed line: a
      // constant here is how the identical sentence came back three turns running in Jennifer's walk (2026-08-09),
      // with the member telling us four times that she was done.
      const reflected = reflectDrift(b.modelText);
      const probe = reflected ? null : driftMore(b.history);
      if (reflected) {
        b.reply = reflected;
        b.awaitingConfirm = true;
      } else if (probe) {
        b.reply = probe;
        b.awaitingConfirm = false;
      } else {
        // NOTHING TO REFLECT AND NOTHING LEFT TO ASK. Speaking again here is what trapped Jennifer — she said she
        // was finished three times and got the same sentence back. So the beat STOPS drawing out and hands
        // forward with what it has, rather than inventing another prompt or repeating a terminal line forever.
        b.stage = 'window';
        b.reply = driftToWindowBridge(b.collected);
        b.awaitingConfirm = false;
      }
    }
  },
  confirm(b) {
    const intent = resolveConfirmCorroborated(b.memberMessage, b.model.replyIntent, isKeeperMaterial, 'is_this_right');
    if (intent === 'dispute') {
      b.awaitingConfirm = false;
      b.reply = REOPEN_DRIFT; // they rejected the pattern — take it, don't defend
    } else if (intent === 'addition') {
      b.awaitingConfirm = false;
      b.reply = withQuestion(b.modelText, driftMore(b.history)); // more inventory first
    } else {
      // done → the drift RECOGNITION is a KEEPER (default-emit; the action drains pendingHarvest → emitHarvestMoment).
      const payload = (b.driftPayload ?? '').trim();
      if (payload) {
        // LABEL, not kind: 'drift' stays as the internal keeper kind (it keys the §2d harvest and a stored
        // source_ref); only the words the member reads in their Playbook change to the protected term.
        b.pendingHarvest.push({ kind: 'drift', keeperType: 'tell', destinationIntent: 'keeper', payloadRef: payload, label: 'The Fade' });
      }
      b.driftPayload = undefined;
      b.stage = 'window'; // hand into The Window (beat 2) via the turn-toward-hope BRIDGE (which opens the window)
      b.reply = driftToWindowBridge(b.collected);
    }
  },
};

// --- §2d VISIONING · beat 2: THE WINDOW (draw-out) — the future Tuesday, the spark, the LIFT ---------------------
// "The Window": picture an ordinary Tuesday a year out where you've DONE the work and the things on your Reclaim List
// are real. That reclaimed ordinary day is the spark. (Donna, 2026-07-28: the old "first Tuesday where nothing
// changes" beat was cut — we only walk the member through the OTHER Tuesday, the one worth chasing.) Draw-out (reuses
// the machinery), ends on HOPE. On confirm the vision is a KEEPER (keeperType 'lights_you_up'). WIN-LIST is skipped —
// the Reclaim List already exists from onboarding.
const WINDOW_MIN_DEPTH = 2;
const WINDOW_MAX_DEPTH = 4;
// The opener — go straight to the reclaimed Tuesday (no "nothing changes" version first).
function windowOpen(_c: Collected): string {
  return (
    "There's a window between who you are today and who you keep saying you'll be — most people never look through " +
    "it. Today you look. Picture an ordinary Tuesday a year from now — but you've done the work, and the things on " +
    'your Reclaim List are real. How do you wake up, what do you reach for? Not the highlight reel — the ordinary ' +
    'morning. Sit with that Tuesday for a second, and tell me what you see.'
  );
}
const WINDOW_MORE_VARIANTS = [
  "What else is different by 7am? Not the medal — the ordinary stuff: how you wake, what you reach for, how you move.",
  'Make it ordinary and real — the morning, not the highlight. What does that day actually feel like?',
  "What's the smallest piece of that Tuesday you'd feel if it were already here?",
];
// Rotate on how many times WE have spoken, not on how many of our lines contained a '?'. The question-mark count
// freezes the moment a reply without one is emitted (the reflect fallbacks have none), so the same variant came
// back forever — Jennifer's walk saw one line three times running. An agent-message count can only ever grow.
function windowMore(history: ConvMessage[]): string | null {
  return nextFollowUp(WINDOW_MORE_VARIANTS, history);
}
const WINDOW_CONFIRM = 'Is that the one worth chasing — or not quite it yet?';
// NULL means nothing to reflect — see reflectDrift. Same contract, same reason.
function reflectWindow(modelText: string): string | null {
  const t = (modelText ?? '').trim();
  if (!t) return null;
  if (/\?\s*$/.test(t)) return t;
  return `${t}\n\n${WINDOW_CONFIRM}`;
}
const REOPEN_WINDOW = "Then it's not quite the one yet — say more. What would the Tuesday worth chasing actually look like?";
// The close — name that Tuesday as the spark, and hold onto it. Ends on HOPE; hands to the Checkpoint.
function windowClose(): string {
  return (
    "That Tuesday — that's the spark. Hold onto it; everything from here is about making it the real one. " +
    "I've kept it for you."
  );
}

const windowStage: StageDef = {
  id: 'window',
  mode: 'drawout',
  opener: (c) => windowOpen(c),
  offersSubstance: (message) => message.trim().length >= 12,
  gather(b) {
    const sc = b.scratch as { windowDepth?: number };
    sc.windowDepth = (sc.windowDepth ?? 0) + 1;
    const advance = drawoutShouldReflect(b.modelText, b.model.depthReady, sc.windowDepth, WINDOW_MIN_DEPTH, WINDOW_MAX_DEPTH, memberWantsToAdvance(b.memberMessage));
    // Capture the member's Tuesday vision (their words) for the keeper; carried to the confirm turn. Same rule as
    // the drift: hold the last line that carried real material, not their reaction to the reflection.
    keepIfMaterial(b);
    if (!advance) {
      b.reply = withQuestion(b.modelText, windowMore(b.history));
    } else {
      // See driftStage — no reflection means nothing to confirm, and the fallback rotates rather than repeating.
      const reflected = reflectWindow(b.modelText);
      const probe = reflected ? null : windowMore(b.history);
      if (reflected) {
        b.reply = reflected;
        b.awaitingConfirm = true;
      } else if (probe) {
        b.reply = probe;
        b.awaitingConfirm = false;
      } else {
        // Same contract as the drift beat: out of probes and nothing to reflect → close the beat rather than
        // keep asking. The Window hands into the Checkpoint.
        b.stage = 'legacy';
        b.reply = `${windowClose()}\n\n${legacyOpener(b.collected)}`;
        b.awaitingConfirm = false;
      }
    }
  },
  confirm(b) {
    const intent = resolveConfirmCorroborated(b.memberMessage, b.model.replyIntent, isKeeperMaterial, 'is_this_right');
    if (intent === 'dispute') {
      b.awaitingConfirm = false;
      b.reply = REOPEN_WINDOW; // not the right vision yet — keep looking, don't force it
    } else if (intent === 'addition') {
      b.awaitingConfirm = false;
      b.reply = withQuestion(b.modelText, windowMore(b.history));
    } else {
      // done → the VISION (the spark) is a KEEPER (V-harvest: 'lights_you_up'). Queue it (default-emit); action commits.
      const payload = (b.driftPayload ?? '').trim();
      if (payload) {
        b.pendingHarvest.push({ kind: 'window', keeperType: 'lights_you_up', destinationIntent: 'keeper', payloadRef: payload, label: 'The spark' });
      }
      // CARRY THE TUESDAY. Their Window answer IS the letter's first prompt, so it moves across with them —
      // asking a member to describe the same ordinary Tuesday twice in one session is the product not listening
      // the first time. Stashed before driftPayload is cleared, or it is gone.
      if (payload) b.legacyTuesday = payload;
      b.driftPayload = undefined;
      b.stage = 'legacy'; // hand into R3's Legacy Letter — the last thing they MAKE before the Checkpoint
      b.reply = `${windowClose()}\n\n${legacyOpener(b.collected)}`;
    }
  },
};

// --- RECONNECT_ARC (config #2) — entry/callback + doors + measurement + drift + window; checkpoint/ceremony stubs ---

// All Reconnect stages are built now (checkpoint is a parked pass-through; ceremony is the terminal overlay).

// --- §2c MEASUREMENT (the administered beat, slice 1: IDQ delivery) --------------------------------------------
// The FIRST beat OFF the depth kernel. The IDQ is a validated instrument — 24 fixed items, a 1–5 scale, deterministic
// scoring. Items are delivered VERBATIM (never drawn out or rephrased); the warmth is the Companion's AUTHORED frame,
// threaded from the Doors excavation so it reads as "a check-in with someone who knows me", not a survey. Deterministic
// (no model call per item). Scoring + the baseline write (submitIdq) happen in the ACTION when the 24 land. The score
// is a mirror — movement, never a bare number/verdict (governance).
const IDQ_SCALE_HINT = '1 to 5 — 1 for not at all, 5 for completely';
function idqOpen(): string {
  return (
    "We've gone deep into what created the distance. Now, we're going to go through questions that determine your " +
    "Identity Distance (ID) Score. This will establish a baseline and allow us to watch it close that gap as you " +
    "progress through G4L. For the following short statements, just tell me how true each feels right now. 1 for not " +
    `at all. 5 for completely.\n\nFirst a few about your body.\n\n${itemStem(0)}`
  );
}
// Authored cluster transitions at the four dimension boundaries (items 6/12/18) — the only warmth between items, so it
// stays a check-in, not a form. Non-boundary items deliver the verbatim stem alone.
const IDQ_CLUSTER_LEAD: Record<number, string> = {
  6: "That's the body. Now a few about how you see yourself.\n\n",
  12: 'Good. Now the people around you.\n\n',
  18: "Last stretch — how you're looking at what's ahead.\n\n",
};
const deliverIdqItem = (i: number): string => `${IDQ_CLUSTER_LEAD[i] ?? ''}${itemStem(i)}`;
const IDQ_REPROMPT = `Just a number for this one, ${IDQ_SCALE_HINT} — how true does it feel?`;
function idqClose(): string {
  return (
    "That's the whole check-in — thank you for staying with it. I've got your baseline now. You'll see it take shape " +
    "on your dashboard, and it's something we'll watch move together over time — never a grade."
  );
}
// M3 — the personalized close. Ties the baseline SHAPE (relative highs/lows, NEVER the raw number) back to the Door(s)
// they named. The mirror posture: a beginning, not a grade; graceful if the lowest area doesn't obviously map to a
// door (never manufacture the link). Best-effort — returns null on no-key/failure/number-leak, so the engine's generic
// close stands.
const DIM_FRIENDLY: Record<Dimension, string> = {
  physical: 'the physical — body, movement, sleep',
  self: 'the self — who you are',
  social: 'the social — the people around you',
  outlook: 'the outlook — how you see what lies ahead',
};
export function idqShape(responses: number[]): { lowest: Dimension; highest: Dimension } {
  const { dimensions } = scoreIdq(responses);
  const ranked = [...DIMENSIONS].sort((a, b) => dimensions[a] - dimensions[b]);
  return { lowest: ranked[0]!, highest: ranked[ranked.length - 1]! };
}
export async function reconnectMeasurementClose(c: Collected, responses: number[]): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const shape = idqShape(responses);
    const identity = identityLabel(c.identityNoun);
    const doorNames = (c.doors ?? []).map((s) => DOORS.find((d) => d.slug === s)?.displayName).filter(Boolean);
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 16000,
      maxRetries: 1,
      defaultHeaders: { 'accept-encoding': 'identity' }, // sidestep the node-fetch gzip "Premature close" bug
    });
    const sys = `${MEMBER_AGENT_SYSTEM_PROMPT}

OPERATING MOMENT: Reconnect — the CLOSE of the baseline check-in (the IDQ just completed, right after the Doors work).
You are reflecting their BASELINE back — the starting picture. This is the mirror: it won't flatter and it won't lie,
but it NEVER grades or pathologizes. Hard rules:
- NEVER state a number, a band, or "low/high". Reflect the SHAPE in plain words only.
- Reflect where they're STARTING FROM, a beginning — not a verdict. IF the area sitting lowest connects to a Door they
  named, name that gently (the Fade had a target — that's meaningful, not a failing). If it does NOT obviously connect,
  do NOT force a link — just reflect the starting shape warmly.
- Warm, brief (2–3 sentences), one thought. Never diagnose. It is safe for them to be honest with themselves.
- Do NOT end with a question, and do NOT editorialize about what the number means or that it "matters more than it might feel." Reflect the starting shape, then STOP — a separate beat asks the next question. This beat has ONE job: the mirror.`;
    const idLine = identity ? `Who they're reclaiming: ${identity}.` : '';
    const doorLine = doorNames.length ? `Door(s) they named: ${doorNames.join(', ')}.` : 'They named no specific Door.';
    const user = `${idLine}\n${doorLine}\nBaseline shape: lowest area is ${DIM_FRIENDLY[shape.lowest]}; highest is ${DIM_FRIENDLY[shape.highest]}. Reflect this as their starting picture, tie the lowest to their Door(s) ONLY if it genuinely fits, and close warmly. No numbers, no grades.`;
    const res = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 220,
      system: sys,
      messages: [{ role: 'user', content: user }],
    });
    const text = (res.content as Array<{ type: string; text?: string }>).filter((b) => b.type === 'text').map((b) => b.text ?? '').join(' ').trim();
    // Structural governance guard: a baseline close has NO reason to contain a digit — a number leak → fall back.
    if (!text || /\d/.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}

// §2c IDQ — the reconnect baseline instrument, built on the SHARED administered-beat factory. Everything here is
// instrument config; the parse→accumulate→deliver→complete loop lives in administeredStage(). On the last item it
// hands into Visioning's first beat (Drift); the ACTION scores + writes the baseline (submitIdq) on that crossing,
// and may UPGRADE this generic close to a personalized one (M3) — appending the Drift opener.

// --- R3 · THE LEGACY LETTER ------------------------------------------------------------------------------------
// WHY IT SITS HERE. Greg moved the letter out of Reclaim and into Reconnect: "it helps to end the activity on a
// positive and to provide the vision early on", so the Success Story in Reclaim becomes a reflection on what was
// accomplished. A member should leave the first R holding a destination, not just a diagnosis.
//
// WHY BETWEEN WINDOW AND CHECKPOINT, and not last. The Window beat draws out the ordinary Tuesday a year out —
// which is the letter's own first prompt — so the letter composes from an answer still live in the thread rather
// than re-asking for it. The alternative (after the Checkpoint, so it is literally the final beat) would have the
// member write a first-person letter to themselves immediately after twelve Likert items, flattening the exact
// lift the Window exists to create. This still "closes out Reconnect" in Greg's sense: it is the last thing they
// MAKE. The ceremony then celebrates it instead of competing with it.
//
// THE DIVISION OF LABOUR. The MODEL asks the prompts (one per turn, its own rhythm) and writes the draft; the
// ENGINE owns the gate, the revision cap, and the commit. That is the arc's standing split, and it is why there is
// no per-prompt answer tracking here — the model has the conversation, and attributing each reply to a prompt key
// would be brittle bookkeeping for no gain.
//
// THE CAP IS DELIBERATE. Greg's note says "prompt revisions until each Member has a structured half-page
// manifesto" — "until" has no terminator, and an uncapped propose/revise loop is how B3, C1 and C3 each earned an
// infinite re-proposal bug. Two rounds, then the letter is offered for saving with an explicit promise that it
// stays editable. That promise is load-bearing: a member who accepts a draft to end a long session must be able to
// fix it when they reread it cold, or we have shipped OUR letter with their name on it.
const LEGACY_MAX_REVISIONS = 2;

const LEGACY_OPEN =
  // The "yours to ___" clause was cut here 2026-08-17 (Donna's voice rules). The next beat already tells them
  // where the letter lives and that they can change it, so the clause was doing no work — which is her own point
  // about these: deleting is usually stronger than substituting.
  "One last thing.${SEP}I'd like you to write a letter — to yourself, a year from today. " +
  "Not a plan and not a pep talk. The letter you'd want to be handed in a year by the version of you who kept going.${SEP}" +
  "I'll ask you a few things and then draft it in your words, and you can change anything that isn't right.";

const LEGACY_SAVED_1 = "Saved — dated a year from today, and addressed to you.";
const LEGACY_SAVED_2 =
  "It lives in your Playbook, under Who you are — you can read it whenever you want, and change it whenever it stops being true.";
const LEGACY_CAP_REACHED =
  "That's yours now. You can keep shaping it any time from your Playbook — for now, want me to save it?";

function legacyOpener(c: Collected): string {
  return LEGACY_OPEN.split('${SEP}').join(BEAT_SEP);
}

/** Shown with the draft. Never "is this good?" — an appraisal question invites a polite yes on the one artifact
 *  that has to be theirs. */
const LEGACY_ASK_REVISION = "Read it back. What's not right — a line that isn't how you'd say it, or something missing?";

const legacyStage: StageDef = {
  id: 'legacy',
  mode: 'drawout',
  opener: (c) => legacyOpener(c),
  offersSubstance: (message) => message.trim().length >= 3,
  gather(b) {
    // The model drafted this turn → hold it and hand it to them. The draft is a PROPOSAL; nothing is stored until
    // they confirm, so a draft they hate costs them one sentence and never reaches their record.
    if (b.model.legacyBody) {
      b.legacyDraft = b.model.legacyBody;
      b.reply = `${b.model.legacyBody}${BEAT_SEP}${LEGACY_ASK_REVISION}`;
      b.awaitingConfirm = true;
      return;
    }
    // Otherwise the model is still asking its prompts — let its question stand. The engine never appends one of
    // its own here (drawout rhythm: the model owns the single question per turn).
    b.reply = b.modelText;
  },
  confirm(b) {
    const intent = resolveConfirmCorroborated(b.memberMessage, b.model.replyIntent, () => false, 'is_this_right');
    const rounds = b.legacyRevisions ?? 0;

    // A REDRAFT arriving this turn supersedes everything — the member asked for a change and the model made it.
    if (b.model.legacyBody) {
      b.legacyDraft = b.model.legacyBody;
      b.legacyRevisions = rounds + 1;
      b.reply =
        rounds + 1 >= LEGACY_MAX_REVISIONS
          ? `${b.model.legacyBody}${BEAT_SEP}${LEGACY_CAP_REACHED}`
          : `${b.model.legacyBody}${BEAT_SEP}${LEGACY_ASK_REVISION}`;
      b.awaitingConfirm = true;
      return;
    }

    if ((intent === 'dispute' || intent === 'addition') && rounds < LEGACY_MAX_REVISIONS) {
      // They want a change and the model has not produced one yet — stay on the draft and let it ask what.
      b.awaitingConfirm = true;
      b.reply = b.modelText || LEGACY_ASK_REVISION;
      return;
    }

    // COMMIT. Set the letter for the action to persist; nothing else in the engine writes to a member's records.
    const body = (b.legacyDraft ?? '').trim();
    if (body) {
      // NO DATE IS COMPUTED HERE. The letter is dated one year from the MEMBER'S today, and this engine is pure —
      // a `new Date()` fallback would stamp it in server time, which is how a Boulder evening lands on tomorrow
      // (see lib/time, the one authority). The action stamps it via memberToday when it persists; the reply says
      // "a year from today", which is true in every timezone.
      b.legacyLetter = { body, datedFor: '' };
      b.reply = `${LEGACY_SAVED_1}${BEAT_SEP}${LEGACY_SAVED_2}${BEAT_SEP}${checkpointOpener()}`;
    } else {
      // No draft ever landed (the model never called the tool). Do not strand them in the beat and do not claim a
      // letter exists — move on quietly. A missing letter is recoverable; a false claim of one is not.
      b.reply = checkpointOpener();
    }
    b.legacyDraft = undefined;
    b.stage = 'checkpoint';
    b.administeredResponses = [];
    b.awaitingConfirm = false;
  },
};

const measurementStage: StageDef = administeredStage({
  id: 'measurement',
  itemCount: TOTAL_ITEMS,
  minLabel: 'not at all', // W-24: chip anchors — the frozen IDQ 1–5 poles (IDQ_SCALE_HINT)
  maxLabel: 'completely',
  opener: () => idqOpen(), // the warm open + item 0, delivered when Doors hands in
  deliverItem: (n) => deliverIdqItem(n),
  reprompt: (n) => `${IDQ_REPROMPT}\n\n${itemStem(n)}`,
  onComplete: (b) => {
    b.stage = 'drift';
    b.reply = `${idqClose()}${BEAT_SEP}${driftOpen(b.collected)}`; // two beats → two bubbles (score read | take-stock ask)
  },
});

// §2e CHECKPOINT — an administered beat (six GRIT items) at the end of the Reconnect arc. The items map to the three
// beats they just walked (Recognition→the Doors, Excavation→the Drift, Spark→the Window), so this reads their grit AS
// BUILT BY the work. Combined with the three onboarding baseline grit items, it's a 9-item grit read — the FIRST time
// grinta moves (the ACTION scores + persists the Checkpoint reading, then the Ceremony reveals the movement). Off the
// depth kernel (administered mode), on the SHARED factory. Grinta is NOT named to the member here — this reads as a
// check-in; the number surfaces in the Ceremony. DIRECTIONAL copy (for Jay's wordsmithing).
// This used to say "No score here, and it won't show up on your dashboard." Both halves were false. The action
// scores and PERSISTS this reading, the Ceremony reveals the movement it produced, and the Grinta Index sits on the
// dashboard's left flank. We were buying an honest answer with a promise we break sixty seconds later — the worst
// possible trade on the one surface whose whole value is that it is safe to be honest.
//
// Jay, 2026-08-11: "It's absolutely a score we give them, and it absolutely shows up on their Dashboard. Gotta
// soften this language and not be so afraid of scores. They are scoring themselves, we're just reporting it."
//
// So keep the JOB the old line was doing — lower the stakes so the answers are true rather than performed — and do
// it with something that stays true. Ownership does that work better than denial: it is their read, we only report
// it back. Note this also brings the copy in line with our own voice rule, which already bans exactly this
// reassurance-tic ("no grade here", "not a test") in checkpoint-guide.ts — declare what a thing IS.
// Grinta is still deliberately NOT named here; the number surfaces in the Ceremony, which follows immediately.
const CHECKPOINT_OPEN =
  'A quick check-in before we close. Six short statements about what this work is making you think about. ' +
  "You're the one scoring these — it's your read on yourself, and I'll show you where it lands in a moment. " +
  'Same as before: just tell me how true each feels right now. 1—not at all. 5—completely.';
function checkpointDeliver(index: number): string {
  return grintaStem(CHECKPOINT_GRIT_ITEMS[index]!);
}
function checkpointReprompt(index: number): string {
  return `Just a number, 1 to 5 — how true does that feel right now?\n\n${checkpointDeliver(index)}`;
}
function checkpointOpener(): string {
  return `${CHECKPOINT_OPEN}\n\n${checkpointDeliver(0)}`;
}
const CHECKPOINT_CLOSE =
  "That's it — you named what this stirred in you. Hold on, don't go anywhere yet.";
// CAT-32 — the accumulator is reset on the way OUT of the window stage (reconnect.ts, windowStage.confirm). That
// is one branch away from a missed reset scoring IDQ answers as grit. `resetOnEntry` makes the Checkpoint clear it
// on the way IN as well: an instrument owns its own response bag, so it cannot inherit the previous one's answers
// no matter which path reached it. Belt to that suspenders, plus the exact-length guard in persistCheckpoint.
const checkpointStage: StageDef = administeredStage({
  id: 'checkpoint',
  resetOnEntry: true,
  itemCount: CHECKPOINT_GRIT_ITEMS.length, // 6
  minLabel: 'not at all', // W-24: chip anchors — the frozen Grinta 1–5 poles
  maxLabel: 'completely',
  opener: () => checkpointOpener(),
  deliverItem: (n) => checkpointDeliver(n),
  reprompt: (n) => checkpointReprompt(n),
  onComplete: (b) => {
    // The six grit items are in (b.administeredResponses). Hand into the Ceremony; the ACTION reads the baseline
    // reading, recomputes the 9-item grit + composite, and writes the Checkpoint reading (grinta_reading seq 1).
    b.stage = 'ceremony';
    b.reply = `${CHECKPOINT_CLOSE}\n\n${CEREMONY_LEAD}`;
  },
});

// §2f CEREMONY — the terminal. The conversational engine only LANDS here; the reveal itself is a full-screen overlay
// (ReconnectCeremony), which the reconnect-chat fires when it sees stage === 'ceremony'. This stage just carries the
// warm lead-in and holds (defensive) if anything sends another turn.
const CEREMONY_LEAD = 'Before you go anywhere — stop for a second. I want to show you what you just did.';
const reconnectCeremonyStage: StageDef = {
  id: 'ceremony',
  mode: 'drawout',
  opener: () => CEREMONY_LEAD,
  offersSubstance: () => true,
  gather(b) {
    b.reply = CEREMONY_LEAD;
  },
  confirm(b) {
    b.reply = CEREMONY_LEAD;
  },
};

// The callback stage. READ-ONLY: it acknowledges the member's response and hands into the Doors excavation. It
// writes nothing and never revises a capture — revision is owned by §2b, member-confirmed + versioned.
const reconnectEntryStage: StageDef = {
  id: 'entry',
  mode: 'drawout',
  opener: (c) => reconnectCallback(c),
  offersSubstance: (message) => message.trim().length >= 3,
  gather(b) {
    // The member answered the revisable check. LISTEN FIRST: the model's warm acknowledgment of what they just said
    // is the first beat; only THEN do we open the Doors excavation (second beat). Never discard their reply and jump
    // straight to the Door work — that reads as not listening. (Revision is still deferred to §2b, member-confirmed.)
    b.stage = 'doors';
    b.reply = handIntoDoors(b.modelText, b.collected);
  },
  confirm(b) {
    b.stage = 'doors';
    b.reply = handIntoDoors(b.modelText, b.collected);
  },
};

// Acknowledge the member's opener answer (the model's warm receive), THEN open the Doors excavation as its own beat.
// Falls back to the door opener alone if the model returned nothing usable.
function handIntoDoors(modelText: string | undefined, c: Collected): string {
  // Contract 1: the model's warm receive (question stripped) + the single Doors opener — not two stacked asks (#1).
  return receiveThen(modelText, doorOpen(c));
}

export const RECONNECT_ARC: ArcConfig = {
  id: 'reconnect',
  stageOrder: ['entry', 'doors', 'measurement', 'drift', 'window', 'legacy', 'checkpoint', 'ceremony'],
  stages: {
    entry: reconnectEntryStage,
    doors: doorsStage,
    measurement: measurementStage,
    drift: driftStage,
    window: windowStage,
    legacy: legacyStage,
    checkpoint: checkpointStage,
    ceremony: reconnectCeremonyStage,
  },
  onComplete: () => CEREMONY_LEAD,
};

// The Reconnect turn — config #2 on the generic kernel. Public signature mirrors applyStagedTurn.
export function applyReconnectTurn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn): Turn {
  return runArcTurn(RECONNECT_ARC, state, history, memberMessage, model);
}

// --- live tool surface (the model draws out the door + signals depth/intent) ---------------------------------
export const RECONNECT_TOOLS = [
  {
    // R3's Legacy Letter. Its own tool for the same reason B3's plan and C1's refinement have one: this is a
    // member-voiced ARTIFACT, not conversational text, and the engine must be able to tell a draft from a reply
    // deterministically rather than by guessing at prose.
    name: 'record_legacy_letter',
    description:
      "Call this ONLY when you are writing the member's Legacy Letter — after they have answered enough of the " +
      "prompts (four of the six is plenty; four honest answers beat six forced ones). Put the whole letter in " +
      "`body` and NOTHING else in your reply — the engine shows it to them and asks what they want changed. " +
      "Do not call it while you are still asking questions, and do not call it twice in a turn.",
    input_schema: {
      type: 'object' as const,
      properties: { body: { type: 'string', description: "the letter itself, in the member's own first-person voice" } },
      required: ['body'],
    },
  },
  {
    name: 'reflect_door',
    description:
      "Call ONLY once you have GENUINELY drawn out the door — how it actually opened, the sequence, what it quietly " +
      "cost — and you have a real INSIGHT to reflect (the cost they normalized, how it targeted who they were, the " +
      "sequence). NEVER on the first mention. If the material is still thin, do NOT call it — keep drawing out; a " +
      "manufactured insight is worse than none. On the same turn you call it, reflect that insight in THEIR words, " +
      "offered as a yes/no check they can simply affirm or wave off — do NOT stack another open question onto the " +
      "reflect. The point is to let them land it, not to keep drawing once it's landed.",
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'reflect_drift',
    description:
      "§2d Drift beat: call ONLY once the member has genuinely drawn out the DRIFT — what the Fade cost, and how far " +
      "it has run — and you can reflect the PATTERN of it (the recurring shape, the quiet thing they've stopped " +
      "noticing is gone), offered as a check they can reject. NEVER on the first mention; if it's still thin, keep " +
      "drawing out. On the same turn you call it, reflect that pattern in THEIR words, ending on a yes/no check they " +
      "can simply affirm or wave off — do NOT stack another open question onto it. (Same depth signal as reflect_door.)",
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'reflect_window',
    description:
      "§2d The Window beat: call ONLY once the member has pictured the future Tuesday — a year out, where they've done " +
      "the work and their Reclaim List is real — and you can reflect the SPARK (that ordinary, reclaimed day) back in " +
      "THEIR words, offered as a check. NEVER before it's drawn out; if thin, keep drawing out. This beat LIFTS — the " +
      "spark is the reclaimed ordinary day worth chasing. (Same depth signal as reflect_door.)",
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'member_reply',
    description:
      "At an insight reflect-confirm, classify the member's reply. 'done' — they CONFIRMED it: any clear yes ('yeah, " +
      "that's exactly it', 'that's the shape of it', 'you nailed it'), INCLUDING a warm or emphatic agreement, even " +
      "one that echoes the insight back in their own words. A confirmation is 'done' — do NOT read agreement as an " +
      "invitation to keep drawing. 'more' — ONLY when they add genuinely NEW material still to draw out, not mere " +
      "agreement or a restatement of the same point. 'dispute' — the insight was off / they're correcting it. When " +
      "they've clearly landed it, choose 'done' and let the beat move on.",
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
  let legacyBody: string | undefined;
  for (const b of content as Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }>) {
    if (b.type === 'text' && typeof b.text === 'string') text += b.text;
    if (b.type === 'tool_use') {
      if (b.name === 'reflect_door' || b.name === 'reflect_drift' || b.name === 'reflect_window') depthReady = true; // shared depth signal (drawout)
      if (b.name === 'record_legacy_letter' && typeof b.input?.body === 'string' && b.input.body.trim()) {
        legacyBody = b.input.body.trim();
      }
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
  return { text, depthReady, replyIntent, revision, legacyBody };
}

// What the model already KNOWS about the member (committed captures, loaded at arc entry) — so recall is precise
// and it never says "no record". Never the transcript.
export function reconnectContext(c: Collected, doorsAtEntry?: readonly DoorSlug[]): string {
  const identity = identityLabel(c.identityNoun);
  const name = (s: DoorSlug) => DOORS.find((d) => d.slug === s)?.displayName;
  const names = (ds: readonly DoorSlug[]) => ds.map(name).filter(Boolean).join(', ');
  const doors = (c.doors ?? []) as DoorSlug[];
  const reclaim = (c.reclaimList ?? []).map((s) => (s ?? '').trim()).filter(Boolean);

  // PROVENANCE, EARNED NOT ASSUMED (see door-provenance.ts). This block used to be one line reading
  // "The Door(s) they named at onboarding: …" built from the CURRENT set — which §2b mutates the instant a
  // re-seeing commits. Jay named three and the Session drew out a fourth, and the close then told him he had named
  // all four "at the start". We put that sentence in the model's mouth. So: state what is true now, and only
  // attribute a Door to onboarding when the entry snapshot proves it.
  const { carried, surfacedHere, provable } = doorProvenance(doors, doorsAtEntry);
  const doorLines = !doors.length
    ? []
    : !provable
      ? // A session resumed from before the snapshot existed. Say what they have; claim nothing about when.
        [`Their Door(s) right now: ${names(doors)} (you do NOT know which of these were named at onboarding versus surfaced later — never say "you named these at the start")`]
      : [
          `Their Door(s) right now: ${names(doors)}`,
          carried.length ? `Named at onboarding: ${names(carried)}` : `They named no Door at onboarding.`,
          // The Session's actual work. Naming it lets the close CREDIT the member for going deeper, which is the
          // whole point of the beat — rather than flattening it into "you knew this already".
          surfacedHere.length
            ? `Surfaced in THIS conversation, NOT named at onboarding: ${names(surfacedHere)}. They did not walk in with this one — it came out of the work you just did together. Never say they named it at the start; if you summarise, credit it as something this conversation drew out.`
            : '',
        ].filter(Boolean);

  const lines = [
    identity ? `Who they're reclaiming: ${identity}` : '',
    ...doorLines,
    // `intake_gap` is written once at intake and never updated, so this provenance claim is one the engine can
    // actually keep. It is the counter-example that makes the rule concrete — not every "first" is a lie.
    (c.gap ?? '').trim() ? `How they first described the gap opening: ${c.gap!.trim()}` : '',
    // Their Reclaim List — the thing the whole program works toward. It MUST be in context: without it the model
    // truthfully told a member "I can't pull it directly" when asked about their own list (backbone violation).
    // Stated WITHOUT a "back at the start" framing: the list is revisable from the rail, so its contents today are
    // not necessarily what they first wrote.
    reclaim.length ? `Their Reclaim List as it stands today (what they're taking back — you HAVE this; never say you can't see it): ${reclaim.join('; ')}` : '',
  ].filter(Boolean);
  return lines.length ? `\n\nMEMBER CONTEXT (what you already know — never say you don't):\n${lines.join('\n')}` : '';
}

// The canonical Door catalog (slug + descriptor) — given to the model so it can map the member's OWN language to a
// canonical Door and propose a re-seeing with a valid to_slug (the engine only commits canonical, distinct swaps).
const DOOR_CATALOG = DOORS.map((d) => `  - ${d.displayName} (${d.slug}): ${d.descriptor}`).join('\n');

const RECONNECT_SYSTEM = `${MEMBER_AGENT_SYSTEM_PROMPT}

OPERATING MOMENT: Reconnect — the DOORS EXCAVATION (Recognition).
You are NOT meeting this person for the first time. You already know them (see MEMBER CONTEXT): their reclaimed
identity, their current Door(s) — MEMBER CONTEXT tells you which were named at onboarding and which surfaced later,
and you must never blur the two — and how they first described the gap opening. This beat goes DEEPER
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

FOLLOW A REDIRECT (honor the member, W-14): you open on the door they first named and ask if it's still where it began
or has shifted. If they answer by pivoting to a DIFFERENT door — "the issues in my marriage have caused a tailspin"
when you asked about the career — that redirect IS the signal. Go where they went; do NOT return to your prior
question or railroad back to the door you opened on. "It sounds like the marriage is where the real weight is right
now — let's go there." (This is different from a re-seeing below: they're not saying the label was wrong, they're
telling you which door to work.)

ACCEPT THE LANDING (hard rule): the insight reflect is a CHECK, not a new door. Reflect it and end on something they
can simply affirm or wave off ("does that land — or is it not quite it?") — never a second open question ("…and how
long has it been running?") tacked onto it. The MOMENT they confirm it ("yeah, that's exactly the shape of it"), you
are DONE with this beat: call member_reply(intent='done') and let it move on — do NOT reflect it back to them again,
and do NOT ask another question. Once they've landed it, drawing MORE is over-circling: it makes them re-do work they
already finished and reads as not having heard them. Keep going ONLY if they genuinely add NEW material ('more') or
push back ('dispute'); a warm agreement is not new material.

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

function stageInstructionReconnect(stage?: Stage, st?: ConvState): string {
  // Their Window answer, handed to the model so prompt 1 is never re-asked. Lives on ConvState (like driftPayload),
  // not Collected — it is conversation state being threaded, not captured member data.
  const tuesday = (st?.legacyTuesday ?? '').trim();
  if (stage === 'doors')
    return (
      '\n\nCURRENT STAGE: the Doors excavation. Draw out the primary Door over a few exchanges, then reflect an ' +
      'INSIGHT (the normalized cost / how it targeted who they were / the sequence) IN THEIR WORDS, offered as a ' +
      'check they can reject. Call reflect_door ONLY once it is genuinely drawn out and the insight is earned. If the ' +
      'story points to a truer Door than the one they named, you may propose that re-seeing (propose_correction), ' +
      'offered — never asserted — and only when the material earns it. Once they confirm the insight, accept it and ' +
      'let the beat move — do not reflect it again or ask a further question.'
    );
  if (stage === 'drift')
    return (
      '\n\nCURRENT STAGE: the Drift beat (§2d Visioning). Draw out what the Fade COST and how far it has run — their ' +
      'inventory, in their words. This is formative and reflective, never scored. After a couple of exchanges, reflect ' +
      // Was "the PATTERN of the drift", which contradicted its own instruction two lines up ("what the Fade
      // COST"). The Fade is the noun; drifting is what it does to you. `reflect_drift` stays as-is — a wire
      // identifier, same call as keeping connect_*/lib/connect after the Community rename.
      'the PATTERN of the Fade (the recurring shape, the quiet thing they stopped noticing) IN THEIR WORDS, offered as ' +
      'a check — call reflect_drift ONLY once it is genuinely drawn out; if thin, keep drawing out (never manufacture a ' +
      'pattern). Name it to push OFF from, not to sit in. Once they confirm the pattern, accept it and let the beat ' +
      'move — do not reflect it again or ask a further question. Do not diagnose.'
    );
  if (stage === 'legacy')
    return (
      '\n\nCURRENT STAGE: THE LEGACY LETTER — the last thing they make in Reconnect. They are writing a letter to ' +
      'THEMSELVES, dated one year from today. Ask these, ONE PER TURN, in this order, skipping any already answered ' +
      'in this conversation:\n' +
      (tuesday ? `(They ALREADY answered 1 in the Window beat: "${tuesday}" — do not ask it again; use it.)\n` : '') +
      LEGACY_PROMPTS.map((p, i) => `${i + 1}. ${p.prompt}`).join('\n') +
      '\nFOUR OF THE SIX IS PLENTY — four honest answers beat six forced ones. Once you have four, or once they ' +
      'signal they are done answering, WRITE THE LETTER and call record_legacy_letter with it as `body`, with no ' +
      'other text in that turn.\n' +
      'THE FORM: first person, from them to the version of them who kept going, half a page. Not a summary of ' +
      'their answers and not a plan — the letter that person would want to read.\n' +
      'VOICE IS THE WHOLE POINT: it must sound like THEM, not like us. Use their own words and images wherever ' +
      'they gave them, and keep their phrasing even where it is plain or awkward. Do not upgrade their vocabulary, ' +
      'do not add inspirational cadence, do not write a sentence they would not say out loud. NEVER praise them, ' +
      'grade an answer, promise an outcome, or add anything they did not say — no "you\'ve got this", no "imagine ' +
      'the possibilities". If they left something unanswered, leave that ground alone rather than inventing it. ' +
      'End on the unfinished business if they named one; it is meant to stay open.\n' +
      'AFTER THE DRAFT: they will tell you what to change. Redraft in full and call the tool again — do not argue ' +
      'for your wording, and do not ask whether they like it. It is theirs.'
    );
  if (stage === 'window')
    return (
      '\n\nCURRENT STAGE: The Window (§2d Visioning, beat 2) — the turn toward HOPE. Draw out ONE day: an ordinary ' +
      'Tuesday a year out where they have DONE the work and the things on their Reclaim List are real (ordinary and ' +
      'real — the morning, not the medal). Do NOT ask them to picture a "nothing changes" version first. Then reflect ' +
      'the SPARK — that reclaimed ordinary day — IN THEIR WORDS, offered as a check; call reflect_window ONLY once it ' +
      'is drawn out. This beat should LIFT: leave them feeling the reclaimed day is reachable. Grounded in their real ' +
      'life, never over-promised fantasy.'
    );
  return (
    '\n\nCURRENT STAGE: entry — the callback asked whether the distance still feels like it began where they named, ' +
    'or whether something has shifted. RECEIVE their answer: in one or two sentences, reflect back specifically what ' +
    'they just said — if they named a shift, name it; if they confirmed, affirm it. Do NOT ask a question and do NOT ' +
    'start excavating a Door — the next beat opens that work. Just land their answer so they feel heard.'
  );
}

// The live Reconnect turn — the model draws out the door + signals depth/intent; the kernel disposes.
export async function liveTurnReconnect(state: ConvState, history: ConvMessage[], memberMessage: string): Promise<Turn> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // THE LEGACY TURN IS NOT A CONVERSATIONAL TURN. It has to produce half a page of first-person prose, which is
  // ~500-600 tokens of letter BEFORE the model's spoken text or any other tool call — so on the shared 600-token
  // budget it was at or over the cap every time, and slow enough to be killed. Donna's walk: the Companion stalled
  // with no sign of life, errored, and needed a refresh; the letter only arrived when she prodded it a second time.
  //
  // ONE ATTEMPT, generously timed, rather than two short ones. Retrying a generation this long inside a 60s
  // function is how you turn a slow turn into a dead one — the retry cannot finish either, and the member waits
  // twice as long to be told it failed.
  const writingLetter = state.stage === 'legacy';
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: writingLetter ? 45000 : 25000,
    maxRetries: writingLetter ? 0 : 2,
    defaultHeaders: { 'accept-encoding': 'identity' },
  });
  const messages = [
    ...history.map((m) => ({ role: (m.role === 'agent' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.text })),
    { role: 'user' as const, content: memberMessage },
  ];
  // Reconnect gateway (Doors excavation) → Opus by default, Sonnet fail-safe if Opus errors. See capture-model.ts.
  const res = await captureCreate((model) => client.messages.create({
    model,
    max_tokens: writingLetter ? 1800 : 600,
    system: RECONNECT_SYSTEM + reconnectContext(state.collected, state.doorsAtEntry) + stageInstructionReconnect(state.stage, state),
    tools: RECONNECT_TOOLS,
    messages,
  }));
  return applyReconnectTurn(state, history, memberMessage, parseReconnectTurn(res.content));
}
