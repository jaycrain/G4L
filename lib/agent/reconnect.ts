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
import { isConversationalMeta } from './conversational-meta.ts';
import { TOTAL_ITEMS, itemStem, DIMENSIONS, type Dimension } from '../idq/instrument.ts';
import { scoreIdq } from '../idq/scoring.ts';
import { identityLabel } from '../member/identity.ts';
import { nextFollowUp } from './follow-up.ts';
import { doorProvenance } from './door-provenance.ts';
import { boardShownSlugs } from './doors-board-expectation.ts';
import type { Db } from '../db/schema.ts';
import { MEMBER_AGENT_SYSTEM_PROMPT } from './system-prompt.ts';
import { resolveConfirmCorroborated, memberWantsToAdvance, memberSteppingAway } from './onboarding-intent.ts';
import { beatConfirmChoices, parseBeatConfirm, type BeatConfirmSet } from './beat-confirm.ts';
import { LEGACY_PROMPTS, letterDateFor } from '../reconnect/legacy-letter.ts';
import { parseBoardSubmission, boardIsEmpty, type BoardSubmission } from '../reconnect/doors-board-claim.ts';
import { runArcTurn, administeredStage, drawoutShouldReflect, receiveThen, isProcessMetaOrAssent, affirmsReflection, expectsForState, type ArcConfig, type StageDef } from './onboarding-staged.ts';
import { captureCreate } from './capture-model.ts';
import { CHECKPOINT_GRIT_ITEMS, grintaStem } from '../grinta/survey/instrument.ts';
import type { Collected, ConvMessage, ConvState, DoorRevision, Expectation, ModelTurn, ReplyIntent, Turn, Stage } from './onboarding.ts';

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
      // "LAST TIME" NO LONGER MEANS ONBOARDING. When the Doors were Reconnect's first Session this pointed
      // correctly at intake; the Mirror sits between them now, so a member arriving here was told "last time" about
      // something two Sessions back. Recall without dating it — the same fix this file already made for the
      // Reclaim List, where "Back at the start" was replaced by "You've named" for exactly this reason.
      `${identity ? `You've named who you're reclaiming — ${identity} — and it` : 'From what you have told me, it'} ` +
        `felt like the distance started with ${doorPhrase}. This time, we go deeper into all of it.`,
      ENTRANCE_ECHO,
      RECONNECT_FORECAST,
      `Does that still feel like where it began — or has something shifted since?`,
    ].join(BEAT_SEP);
  }
  if (gap) {
    // No Door tagged, but the gap story is in hand → open on the story, still revisable.
    return [
      `You started to tell me how the distance opened${identity ? ` from ${identity}` : ''}. I've been holding it, and I want to go deeper into it with you now.`,
      ENTRANCE_ECHO,
      RECONNECT_FORECAST,
      `Does it still feel the way it did — or has it moved?`,
    ].join(BEAT_SEP);
  }
  // Thin/null: don't fake continuity. A warm, honest cold-ish open into the deeper work.
  return [
    `Let's pick up where we left off${identity ? ` — ${identity} is who we're bringing back` : ''}. This time we go deeper into how the distance opened.`,
    ENTRANCE_ECHO,
    RECONNECT_FORECAST,
    `No rush — start wherever it feels true.`,
  ].join(BEAT_SEP);
}

// THE ENTRANCE ECHO (Jay, 2026-08-25; drafted with Cowork, approved as drawn).
//
// The product has exactly ONE line saying what Reconnect is FOR — "Reconnect — the seeing — is behind you. Rewire
// is next: it's where seeing turns into changing" — and it fires on the way OUT, to a member who no longer needs
// telling. At the entrance they got mechanics: four phases, Sessions, a Checkpoint opens the next. Across 1,141
// authored member-facing strings the precondition itself — you can't change what you haven't seen — scored ZERO.
//
// IT IS THE SECOND-PASS FRAMING, NOT THE JOLT. Cowork's draft opened "Reconnect is that jolt, on purpose… so
// first, we go find them", which would reach someone who has ALREADY been jolted: they named an identity, built a
// Reclaim List and signed up before they ever arrived here. That restarts a conversation they finished. The jolt
// language belongs at the front door and the onboarding ramp; only the precondition carries across, and it is
// aimed at why we are going BACK rather than at starting to look.
//
// Its own beat, immediately before the forecast, because it is the REASON for the shape the forecast describes.
// "because" dropped from the draft — it lands harder as two clauses than as an explanation.
const ENTRANCE_ECHO =
  "You looked once already. This is where we go back properly — you can't change what you haven't seen.";

// The forecast beat (Jay + Greg): the first Reconnect session must tell the member the SHAPE of the work up front —
// without it, the drawing-out feels pointless and endless. Maps honestly to the arc: Doors → a fresh measure (IDQ) →
// the cost + the future you're reclaiming (Drift/Window) → the Checkpoint that opens the next phase. Plain, no hype.
const RECONNECT_FORECAST =
  "Here's how it goes: we'll walk back through the Door — or Doors — the distance came in through, take a fresh " +
  'measure of where you are now, then look at what it cost and the life you\'re reclaiming. It ends where your ' +
  'next phase begins. One thing at a time, at your pace — you set the depth, and you can stop whenever you want.';

// The Reconnect opening turn (parallels stagedOpening): the callback message + the arc's initial state, with the
// COMMITTED captures pre-loaded into `collected`. Stage 'entry' handles the member's response to the callback.
/**
 * R2 — THE DOORS. Was the whole-phase opening; it is now one Session of four.
 *
 * Snapshot the Door set AS IT STANDS NOW, before this session can revise it. This is the only moment the
 * distinction is free — after §2b commits an add, `collected.doors` no longer remembers what they walked in with.
 */
export function reconnectOpening(committed: Collected): Turn {
  return {
    reply: reconnectCallback(committed),
    state: { stage: 'entry', collected: committed, doorsAtEntry: [...(committed.doors ?? [])] },
    complete: false,
  };
}

/**
 * R1 — THE MIRROR. The first Session of the program, and now the first thing a member does after onboarding.
 *
 * `resetOnEntry` is NOT set on measurementStage, so a resumed R1 keeps its answered items; this opening is only
 * for a fresh start. The expectation (the 1–5 chips for item 1) is computed by the caller from the returned
 * state via expectsForState — the one owner, so resume and a live turn cannot disagree.
 */
export function reconnectR1Opening(committed: Collected): Turn {
  return { reply: idqOpen(), state: { stage: 'measurement', collected: committed }, complete: false };
}

/**
 * R3 — THE DRIFT QUIZ AND THE LEGACY LETTER. Greg designed these as ONE two-part activity ("the activity is now
 * a 2 part process: Part 1 (Drift Quiz) / Part 2 (Legacy Letter)"), which is also why R3 ends warmly: the letter
 * is the last thing a member makes in Reconnect, not a quiz result.
 */
// The two-part frame, said ONCE at the top of R3. R2's close already promises it — "Next comes the Drift Quiz,
// and then a letter you'll write to yourself a year out" — so this is the promise being kept, in the same words.
//
// It exists because R3 was the one Session that opened cold on a question. When Reconnect was a single
// conversation that was correct: the drift beat followed the measurement inside a thread the member was already
// inside, and a frame would have been an interruption. Entered from the dashboard it reads as being asked
// something before being told what you are doing — the same note Jay made about the identity chips arriving
// with no sentence in front of them.
const R3_FRAME =
  "This one comes in two parts — first what the Fade actually cost, then a letter you'll write to yourself a year out.";

export function reconnectR3Opening(committed: Collected): Turn {
  return {
    reply: `${R3_FRAME}${BEAT_SEP}${driftOpen(committed)}`,
    state: { stage: 'drift', collected: committed },
    complete: false,
  };
}

/** R4 — THE CHECKPOINT. Its own Session, exactly as RWR-CHK / RBLD-B4 / RCL-C4 are, with the ceremony after it. */
export function reconnectCheckpointOpening(committed: Collected): Turn {
  return { reply: checkpointOpener(), state: { stage: 'checkpoint', collected: committed }, complete: false };
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
/** The ruling a drawout beat needs, offered as chips instead of a question the engine writes into the model's
 *  turn. `prompt` is what the chips answer — shown with them, never appended to the Companion's words. */
function beatConfirmExpectation(prompt: string, set: BeatConfirmSet = 'default'): Expectation {
  return { kind: 'beat_confirm', choices: beatConfirmChoices(set).map((c) => ({ value: c.value, label: c.label })), prompt, set };
}

/**
 * The same offer, WITHHELD when the member has just said they are leaving (Donna, 2026-08-27: "the rote buttons
 * to click at the end which were out of context as I had just said I would step away").
 *
 * ONE HELPER because two stages offer these chips and both had the identical gap — drift and window. A guard
 * written at one call site is how this file already learned that Reconnect leaked the Doors board: two surfaces,
 * one of which knew the rule.
 *
 * Returns undefined rather than a different expectation: the Companion's reflection still lands, the member can
 * still type, and awaitingConfirm is left to the caller — this decides what is on screen, not where we are.
 */
function beatConfirmUnlessLeaving(memberMessage: string, prompt: string, set: BeatConfirmSet = 'default'): Expectation | undefined {
  return memberSteppingAway(memberMessage) ? undefined : beatConfirmExpectation(prompt, set);
}

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
      // NO SEQUENCING CLAIM (Donna, 2026-08-27). This opened "Before we go deeper," which asserts it is the next
      // thing said — and when a member dismisses Why-it-Works the MODEL has just written its own hand-in ("let's
      // go back through that first door properly"), so the two land together and contradict each other about
      // where we are. The board framing does not need to place itself in the sequence; it only needs to say what
      // the board is. Dropping four words removes the collision without touching either turn.
      'Here is the whole set — every Door we see people come through. ' +
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
      `back to how it actually happened, and what it cost you. Start wherever it's most vivid.`
    );
  }
  return `Let's go into how the distance opened — the real thing, not a summary. Take me back to how it actually happened, and what it cost you. Start wherever it's most vivid.`;
}

// Invite the next layer — rotated so it never repeats verbatim as the door is drawn out.
const DOOR_MORE_VARIANTS = [
  'Stay with that a moment — what did it actually cost you, the part you maybe stopped counting?',
  'What was underneath that — when did you first feel it, and what did it take?',
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
const DOOR_INSIGHT_CONFIRM = 'Does that land the way it happened — or is it not quite right?';
function reflectDoor(modelText: string): string {
  const t = (modelText ?? '').trim();
  if (t && /\?\s*$/.test(t)) return t;
  if (t) return `${t}\n\n${DOOR_INSIGHT_CONFIRM}`;
  return `Tell me more about how it actually went.`;
}
// GREG'S FOURTH REFLECTION QUESTION, finally built (2026-08-27).
//
// His R1 spec asks for FOUR responses after the Doors board: which came first, which weighs most, which is still
// open — and then this one. We shipped the first three as chip-pickers and never built the fourth, so a member
// tapped three answers and nothing came back. Donna, on her walk: "this info is taken down but you don't know
// where it goes. For me, there's no personal value in identifying which one happened first."
//
// She was right, and the missing question is why. The first three COLLECT; this one is where it means something.
//
// A WRITTEN ANSWER, NOT A CHIP, because that is what he asked for ("write a brief response to each of these") and
// because a tap cannot answer it. It sits here, after the Door has been drawn out and confirmed — the last beat
// of the Doors work — so it lands on everything she has just said rather than on a board she has half forgotten.
/**
 * THE BREAK BEFORE THE QUIZ — the doors→measurement seam, named.
 *
 * THREE INDEPENDENT SOURCES, none of whom compared notes:
 *   · Greg, "Refinements and Comments": "build in some pacing … restrict a person to only 10-15 minutes before
 *     pausing for the day", and "a soft daily cap on foundational sessions in Cycle 1 (~10–15 min or one
 *     session/day), framed as intentional pacing, not a lockout".
 *   · Jay, 2026-08-25: Reconnect ran 65 minutes as one unbroken arc with no landmark anywhere. He ruled the
 *     CONTENT stays ("I wouldn't cut ANY of it") — so it was never a length problem, it was an expectations one.
 *   · Donna, 2026-08-27: "This would be a good place for a break. Going directly into this here is too much in
 *     one sitting."
 *
 * AND IT IS NOT IN GREG'S SPEC EITHER. His Gated Assets V4 never describes Reconnect as one continuous session;
 * it specifies four separately-placed assets, and it marks every other seam with words of its own ("First take a
 * quick step through the Transition Activity"). His R1 copy even builds in the pause: "Sit with that for a
 * moment before you move on." The unbroken run is ours, not his.
 *
 * WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT. It is a BEAT plus a real choice — not a lockout, which is
 * Greg's own word for what to avoid. Nothing is gated: "keep going" continues immediately, and the Session
 * already persists per turn, so leaving here loses nothing and always did. What was missing was anyone SAYING
 * so at the one seam where the work changes shape — from remembering, to being measured.
 *
 * The wording names the change rather than praising the effort: "that was the hard part" is a verdict on her
 * work, and this beat must not grade it.
 */
/** What the Doors insight-confirm chips answer. Phrased as the member would, like DRIFT_CONFIRM and WINDOW_CONFIRM. */
const DOOR_CONFIRM = 'Have I got that right?';

const DOORS_CLOSE = (
  // TWO CORRECTIONS, both from Jay's R2 walk (2026-08-28).
  //
  // "the excavation" is the ASSET's name (RCN-EXC, Identity Excavation), not the Session's. The member has been
  // in a Session called The Doors for forty minutes and had never seen this word — he asked "Is this the
  // excavation?", which is the question a member asks when the product calls one thing two names.
  //
  // And the Doors are NOT on the dashboard. redesign-dashboard.tsx keeps them off it deliberately — "privacy:
  // sensitive if someone's looking over the member's shoulder" — so this sent him to look somewhere they were
  // designed not to be. They live in the Playbook, under "Who you are".
  "That's the Door work done — the part that asks you to remember. Your Doors are in your Playbook now, under " +
  "Who you are, and you can change them any time. Next comes the Drift Quiz, and then a letter you'll write to " +
  "yourself a year out."
);

const DOORS_MEANING_Q =
  `Last thing on this, and it's the one that matters most: what does recognizing these Doors change about how ` +
  `you see your own Fade?`;

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
  // MEASURED AS SUBSTANCE, NOT AS LENGTH. This read `t.length >= 12 && !isProcessMetaOrAssent(t)`, which only
  // ever caught SHORT assent: "Yes" failed on the character count rather than on its meaning, and anything
  // longer walked through. Jay answered "Does that sound right, or not quite?" with "That's correct" — fourteen
  // characters, which cleared the floor — and was immediately asked whether the door he named was wrong. The
  // guard's own comment says "no bare assent"; two words of pure agreement are exactly that, and it let them by.
  // ("That's right" is twelve, "Yep that's it" thirteen — the floor was never a test of anything.)
  //
  // isKeeperMaterial is already the file's answer to "did the member say something about their LIFE, or react to
  // our reflection?" — it knows assent, praise, process-talk and brevity, and it sits four lines below this. One
  // definition of substance, used by the keeper capture and by this gate, so they cannot disagree about the same
  // sentence. [[member-words-outrank-model-guess]] [[one-fact-many-sites]]
  return isKeeperMaterial(memberMessage);
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
  // TALKING ABOUT THE CONVERSATION IS NOT TALKING ABOUT HER LIFE — the third occurrence of that shape, and the
  // reason it now lives in one predicate. Every other check here reads a SURFACE feature (length, praise,
  // assent), and a protest has none of their tells: Donna's was thirteen words, fluent, first person and
  // squarely on topic. It became both "The spark" and the Legacy Letter's carried-forward Tuesday, from one
  // stored value. See lib/agent/conversational-meta.ts.
  if (isConversationalMeta(t)) return false;
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
  if (kind === 'correct') return `${name}, then — that's the one. That changes it. Let me take in what it means, and we'll keep going from there.`;
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
  // AUTOPILOT IS NAMED ONCE, BY `list`, LIKE EVERY OTHER DOOR.
  //
  // This used to append "— and the quiet one alongside them" whenever board.quietDrift was set, from when quiet
  // drift was a SEPARATE card sitting beside the Doors. It stopped being separate on 2026-08-22: Autopilot became
  // the twelfth Door, and `quietDrift` is now DERIVED from it (doors-board.tsx: `mine.some(c => c.slug ===
  // 'autopilot')`). So the flag can only be true when Autopilot is already in `board.doors` — and the receipt read
  // "The Body, Career Cliff and Autopilot — and the quiet one alongside them", naming one Door twice in one
  // sentence. The `marked.length === 0` branch became unreachable for the same reason.
  //
  // Donna reported the visible half (item 15, the Playbook listing Autopilot twice). This half is worse: it is the
  // Companion speaking, and appending "the quiet one" to a list that already contains it reads as the product
  // having lost track of what she just told it.
  //
  // `quietDrift` STAYS ON THE WIRE. It still drives `quiet_drift_claimed_at`, which six Sessions read. Nothing
  // stops being recorded here — it just stops being narrated a second time.
  parts.push(`${list}.`);

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
      // THE BOARD IS A RULING ON THE WHOLE SET, NOT AN ADD-ONLY FORM.
      //
      // This unioned her marks onto the Doors she already held, so a pre-lit Door she rated "not relevant" came
      // straight back. The board client promises the opposite in its own comment — "She can still take one off:
      // rating a pre-lit Door 'not relevant' removes it, because that is her correcting our matcher, which is the
      // whole point of letting her claim them" — and the engine quietly discarded it. That made R2 the one place
      // a wrong Door was supposed to be fixable, and the one place it could not be fixed (Donna, 2026-08-20: The
      // Full House on her card over a story with no partner and no children in it).
      //
      // BOUNDED BY WHAT SHE WAS SHOWN. Removal only applies to the slugs the board actually rendered; a Door held
      // but not on the board (no recognition copy) never reached her eyes, so her submission says nothing about
      // it and it is kept. Same intersect-with-shown rule as the onboarding gap confirm — these are the only two
      // surfaces where a member unmakes a Door, and neither may act on a card she never saw.
      //
      // THE DATABASE HALF IS ALREADY WRITTEN, and deliberately not duplicated here: persistRevision runs on this
      // same turn and hands the new set to softSetMemberDoors, which soft-removes every active Door not in it.
      // The removal rule therefore has ONE implementation. Adding a second write in the board's own action would
      // be the same fact at two sites, which is how the two ever come to disagree.
      const held = b.collected.doors ?? [];
      const marked = new Set(board.doors.map((d) => d.slug));
      const shown = new Set(boardShownSlugs());
      const ruled = Array.from(new Set([...held.filter((d) => marked.has(d) || !shown.has(d)), ...marked]));
      // MARKING NOTHING AT ALL is "none of these land for me" — NOT "delete my Doors". softSetMemberDoors REFUSES
      // an empty set (the ≥1-Door contract), so zeroing her out here would leave the engine and her record
      // disagreeing about her own life: the arc talking about no Doors while the Companion still reads three.
      // She takes one off by marking the others, or in the excavation that follows.
      const next = ruled.length ? ruled : held;
      // `c.doors` arrives PRIMARY-FIRST by convention, so ruling #8 — biggest-impact becomes primary — is
      // expressed here as ordering, not a second field. The DB half (is_primary + named_door) is the action's.
      b.collected.doors = board.biggest ? [board.biggest, ...next.filter((d) => d !== board.biggest)] : next;

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
    // HER ANSWER TO THE MEANING QUESTION ENDS THE DOOR WORK. Without this the reply would fall into the draw-out
    // below, doorDepth would tick, and the Companion would ask for more about a Door she has already closed —
    // which is the "didn't take yes for an answer" shape, rebuilt by hand one beat later.
    if ((sc as { meaningAsked?: boolean }).meaningAsked) {
      // R2 ENDS HERE. This morning's in-conversation break lived at this seam and is SUPERSEDED — it was standing
      // in for a Session boundary, and now there is a real one. Keeping both would ask "want to keep going?"
      // immediately before closing the Session and returning her to the dashboard.
      b.awaitingConfirm = false;
      b.complete = true;
      b.reply = receiveThen(b.modelText, DOORS_CLOSE);
      return;
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
      // THE DOORS CONFIRM GETS THE SAME TAP DRIFT AND WINDOW ALREADY HAD (Donna, 2026-08-27: "didn't take yes for
      // an answer and it only went through one of the Doors") — her count elided; the guard forbids hardcoding it.
      //
      // This was the one drawout confirm in Reconnect still classified from free text — the exact arrangement
      // that produced five patches in two days on the gap gate before it became a board. English has unlimited
      // ways to say yes, the list cannot be finished, and a better classifier is a better guess. A tap is a fact.
      //
      // It is the DEEPEST beat to leave guessing, too: this confirm sits on the Door she has just excavated, so a
      // misread "yes" reopens the most vulnerable thing she has said. The chips are an easy path, never a gate —
      // resolveConfirmCorroborated still handles anything she types, exactly as it does for drift and window.
      b.expects = beatConfirmUnlessLeaving(b.memberMessage, DOOR_CONFIRM);
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
      // Accepted-and-added-more → keep drawing out; a clean acceptance → land it AND hand forward.
      //
      // THE LANDING USED TO BE THE WHOLE TURN, AND IT WAS A DEAD END (Jay, 2026-08-25 — he hit it twice in one
      // Session). Both variants of reseeingLanded end "Let's keep going" / "we'll keep going from there" and then
      // stop: no question, empty box, nothing to answer. The stage does not advance here either — doorDepth is
      // reset just above so the draw-out continues on the corrected Door — so the member is left holding a turn
      // that promised to continue and didn't. It fires once per Door accepted, so a member who surfaces three
      // Doors in conversation hits three dead ends, at exactly the beats meant to open them up.
      //
      // withQuestion (not a rewrite of the landing): the deliberate copy stays, and the SAME forward probe the
      // addition branch uses is appended. It is also a no-op when the text already ends on a question, so this
      // cannot double-ask.
      b.reply = intent === 'addition'
        ? withQuestion(b.modelText, doorMore(b.history))
        : withQuestion(reseeingLanded(rev.toSlug, rev.kind), doorMore(b.history));
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
    } else if (!(b.scratch as { meaningAsked?: boolean }).meaningAsked) {
      // done → ask Greg's fourth question BEFORE handing to the IDQ, once per excavation. The Door work is
      // finished and confirmed; this is the beat that turns three recorded taps into something she has actually
      // thought about. Her answer lands in the transcript like any other turn, so no new storage and no migration.
      (b.scratch as { meaningAsked?: boolean }).meaningAsked = true;
      b.awaitingConfirm = false;
      b.reply = receiveThen(b.modelText, DOORS_MEANING_Q);
    } else {
      // done, and the meaning question is already answered → hand into the measurement block. W-35
      // (receive-before-you-move): lead with the model's in-voice acknowledgment of the member's final answer
      // BEFORE the scripted IDQ frame — the deterministic opener must not clobber what they just said.
      // Same seam, the confirm path. Both routes out of the Doors work now land on the same landmark rather than
      // one of them dropping her straight into the instrument — the two-sites gap this file keeps relearning.
      // Same seam, the confirm path — R2 closes here too.
      b.complete = true;
      b.reply = receiveThen(b.modelText, DOORS_CLOSE);
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
    "So let's take stock — what has the Fade cost you? Not a checklist — the ones you actually feel. " +
    "Start wherever it's heaviest."
  );
}
const DRIFT_MORE_VARIANTS = [
  "Past the obvious — what's the one you don't usually let yourself miss?",
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
const DRIFT_CONFIRM = 'Does that name it — or is it different?';
// NULL means "the model gave us nothing to reflect". Returning a fixed sentence here instead was the bug: the caller
// then had a constant to emit, and a constant re-emits VERBATIM for as long as the model keeps coming back empty.
function reflectDrift(modelText: string): string | null {
  // Decision B — see reflectWindow. Same shape, same fault: appending a confirm to a model turn that has no
  // question mark fires hardest on the turns that are COMPLETE. The ruling moves to chips.
  const t = (modelText ?? '').trim();
  return t || null;
}
const REOPEN_DRIFT = "Then I've not got it yet — say it your way. What's the real shape of what the Fade cost you?";
// The BRIDGE (V3): the turn toward hope, at the drift→window seam. LIFT starts HERE — the bridge hands straight into
// The Window's opener (so it's one motion: push off from the drift, look through the window).
function driftToWindowBridge(c: Collected): string {
  return (
    // "the drift" as a NOUN was the Fade under a second name (Jay, 2026-08-15). This is the LIVE line — the
    // twin in lib/curriculum/content/reconnect.ts is read only by Explore the Science. Verb uses and the Drift
    // Quiz are untouched; see the function name above, which describes a seam rather than addressing a member.
    // NO SAVE CLAIM — this is a harvest OFFER, not a commit. See windowClose below for the full note.
    "That's your inventory — what it cost, how far the Fade ran. Not to sit in — to push off from." +
    "\n\nNow we look the other way — at the version of you that's still in there.\n\n" +
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
        b.expects = beatConfirmUnlessLeaving(b.memberMessage, DRIFT_CONFIRM);
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
    // A tap resolves before the classifier is consulted (see the window confirm). Typed replies fall
    // through untouched.
    const intent = parseBeatConfirm(b.memberMessage)
      ?? resolveConfirmCorroborated(b.memberMessage, b.model.replyIntent, isKeeperMaterial, 'is_this_right');
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
    'morning. Give that Tuesday a second, and tell me what you see.'
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
/**
 * THE ENGINE NO LONGER MANUFACTURES THE QUESTION (Jay, 2026-08-25 — Decision B).
 *
 * This used to staple WINDOW_CONFIRM onto any model turn that did not end in "?". It fired on the one thing it
 * most needed to recognize: a CLOSE is a complete turn precisely BECAUSE it has no question. Jay's model wrote
 * "We'll leave it there for today. When you're ready, the next phase starts turning that morning into a plan."
 * — and the engine appended "Is that the one worth chasing?", which he had answered two turns earlier with
 * "Absolutely". `drawoutShouldReflect` had advanced BECAUSE it read the model as wrapped up; appending a question
 * un-wrapped the very signal it acted on.
 *
 * The ruling is still needed — the reflection has to be rulable. It is offered as CHIPS instead, with
 * WINDOW_CONFIRM as their prompt. The model owns the words, the engine owns the gate.
 *
 * NULL still means nothing to reflect — see reflectDrift. Same contract, same reason.
 */
function reflectWindow(modelText: string): string | null {
  const t = (modelText ?? '').trim();
  return t || null;
}
const REOPEN_WINDOW = "Then it's not quite the one yet — say more. What would the Tuesday worth chasing actually look like?";
// The close — name that Tuesday as the spark, and hold onto it. Ends on HOPE; hands to the Checkpoint.
//
// IT CLAIMS NO SAVE, because there is none to claim yet. This said "I've kept it for you", and the drift bridge
// above said the same thing — both untrue at the moment they were read. app/reconnect/actions.ts is explicit about
// why: "Nothing is committed here any more — these come back as OFFERS the member keeps inline." The drift and the
// window are harvest CANDIDATES; the keeper card the member taps is the write path, and `state='kept'` is what the
// Playbook query actually selects on.
//
// FOUND BY GENERALISING DONNA'S ITEM 19, not by her. She reported the Rewire W2 close ("I've saved your picture to
// your Playbook", immediately followed by a keep/discard card for that picture). Writing the guard for that one
// shape turned up three more instances of it — here, the drift bridge, and two Session closes in
// lib/curriculum/content. Four sites, one fault, and the two she never saw were in Reconnect: the first arc a new
// member meets.
//
// The member is told what she now HAS. Where it lives is the engine's to state, once it is true.
function windowClose(): string {
  return "That Tuesday — that's the spark. Hold onto it; everything from here is about making it the real one.";
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
        // THE RULING, AS A TAP. The prompt rides on the chips rather than being written into the Companion's turn,
        // so a model that closed its own beat is not contradicted by a question it did not ask.
        b.expects = beatConfirmUnlessLeaving(b.memberMessage, WINDOW_CONFIRM);
      } else if (probe) {
        b.reply = probe;
        b.awaitingConfirm = false;
      } else {
        // Same contract as the drift beat: out of probes and nothing to reflect → close the beat rather than
        // keep asking. The Window hands into the Checkpoint.
        b.stage = 'legacy';
        b.reply = `${windowClose()}\n\n${legacyOpener(b.collected, !!b.legacyTuesday)}`;
        b.awaitingConfirm = false;
      }
    }
  },
  confirm(b) {
    // A TAP IS A FACT — it resolves before the classifier is consulted at all. Typed replies still fall through to
    // resolveConfirmCorroborated untouched, so the chips are an easy path rather than a gate.
    const intent = parseBeatConfirm(b.memberMessage)
      ?? resolveConfirmCorroborated(b.memberMessage, b.model.replyIntent, isKeeperMaterial, 'is_this_right');
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
      b.reply = `${windowClose()}\n\n${legacyOpener(b.collected, !!b.legacyTuesday)}`;
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
/**
 * R1 IS THE FIRST SESSION IN THE PROGRAM NOW, so this is the first thing a member ever does here — and it opens
 * the phase, not just the instrument.
 *
 * IT USED TO OPEN "We've gone deep into what created the distance", which assumed the Doors had already happened.
 * With the IDQ moved first (Greg's spec: R1 is "the first assessment", R2 "works well after") that sentence was
 * simply false, so it could not survive the reorder regardless.
 *
 * GREG'S OWN INTRO, MINUS ONE CLAUSE. His V4 member-facing intro for R1 reads: "This is a mirror, not a test.
 * There are no right answers and no scores to worry about." The mirror is his image and it is a good one; the
 * discomfort line below is the best sentence in his intro and is kept close to verbatim. What is dropped is the
 * reassurance — "not a test", "no right answers", "no scores" — which our own rule forbids anywhere near an
 * instrument: telling accomplished adults they are not being graded implies they feared it, and it makes the
 * reading sound defensive. Say what the thing IS and move. (Jay, 2026-08-28: "your version, don't think he'll
 * mind that at all.")
 */
function idqOpen(): string {
  return (
    "Let's start with the mirror.\n\n" +
    'These are short statements about where you are right now. Tell me how true each one feels — 1 for not at ' +
    'all, 5 for completely. Some of them will be uncomfortable. That is the point: it means you are being ' +
    'honest.\n\nWhat comes out is your Identity Distance Score — the starting line we measure everything else ' +
    `against.\n\nFirst a few about your body.\n\n${itemStem(0)}`
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
// WHAT COMES NEXT, at the end of R1 — the third part of a Session close, matching DOORS_CLOSE's shape (what you
// did · where it lives · what's next). EXPORTED and used by BOTH close paths, because the bug this replaces was
// exactly that: two sites each appended `driftOpen(...)` and only one of them was ever looked at.
// R3's equivalent. Greg's own R3 closure names it — "First take a quick step through the Transition Activity."
export const LEGACY_CLOSE_NEXT =
  "Next is the Reconnect Checkpoint — a short read on what this work has built, and the close of the Phase.";

export const MIRROR_CLOSE_NEXT =
  "Next are your Doors — the events that opened the distance — and after that the Drift Quiz.";

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

/**
 * THE OPENER ENDS ON THE FIRST QUESTION, not on a promise to ask one.
 *
 * DONNA, 2026-08-22, item 12: the flow "stalls on a declarative statement with no clear next step, requiring the
 * user to prompt it forward". Her transcript shows her typing "Ok, what questions do you have?" to unblock it.
 *
 * It stalled BY CONSTRUCTION. LEGACY_OPEN ended "I'll ask you a few things and then draft it in your words" and
 * then stopped. The model does not get a turn until the member speaks, so the beat announced an intention and
 * waited for her to act on OUR promise. Asking the first thing immediately is what the sentence already claims we
 * are about to do, and it removes a dead turn rather than adding a "ready?".
 *
 * WHICH question depends on what she has already given us. The Window beat draws out the ordinary Tuesday a year
 * out, which IS prompt one — so when it has been carried across we open on prompt two instead. Asking a member to
 * describe the same Tuesday twice in one session is the product not listening the first time (the reason the
 * carry exists at all, see the Window handoff).
 *
 * THIS DOES NOT BREAK THE DRAW-OUT RHYTHM. That rule — the model owns the one question per turn, the engine never
 * appends its own — governs gather(), where an engine question would race a model that has just asked one. An
 * OPENER is engine copy that starts the beat before the model has spoken, and every other draw-out stage here
 * opens with a question (the Door, the Window, the check-in cue).
 */
function legacyOpener(_c: Collected, tuesdayCarried = false): string {
  const first = tuesdayCarried ? LEGACY_PROMPTS[1] : LEGACY_PROMPTS[0];
  const opener = LEGACY_OPEN.split('${SEP}').join(BEAT_SEP);
  return first ? `${opener}${BEAT_SEP}${first.prompt}` : opener;
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
      // TWO chips, and "That's mine" rather than "That's it" — see LEGACY_CONFIRM_CHOICES.
      b.expects = beatConfirmExpectation(LEGACY_ASK_REVISION, 'legacy');
      return;
    }
    // Otherwise the model is still asking its prompts — let its question stand. The engine never appends one of
    // its own here (drawout rhythm: the model owns the single question per turn).
    b.reply = b.modelText;
  },
  confirm(b) {
    // A tap is a fact. Typed replies still fall through to the classifier untouched.
    const intent = parseBeatConfirm(b.memberMessage)
      ?? resolveConfirmCorroborated(b.memberMessage, b.model.replyIntent, () => false, 'is_this_right');
    const rounds = b.legacyRevisions ?? 0;
    // Set only on the capped-redraft path, so her final version is shown in the same turn it is saved.
    let capPreamble = '';

    // A REDRAFT arriving this turn supersedes everything — the member asked for a change and the model made it.
    //
    // THE CAP BINDS BOTH SIDES. It used to bind only the member: the dispute/addition branch below checks
    // `rounds < LEGACY_MAX_REVISIONS`, while this branch was unconditional and the cap changed nothing but the
    // COPY. So a member who kept asking for changes was stopped, and a model that kept calling the tool was not —
    // every redraft re-opened the confirm, and the beat could not end. Found by tests/reconnect-walk.test.ts
    // before it went green (a model stub that drafted every turn walked straight into it).
    //
    // Past the cap we KEEP HER NEWEST DRAFT and commit it rather than asking again. Losing the latest revision to
    // enforce a limit would be the wrong trade — she asked for that change, and it is her letter.
    if (b.model.legacyBody) {
      b.legacyDraft = b.model.legacyBody;
      b.legacyRevisions = rounds + 1;
      if (rounds + 1 < LEGACY_MAX_REVISIONS) {
        b.reply = `${b.model.legacyBody}${BEAT_SEP}${LEGACY_ASK_REVISION}`;
        b.awaitingConfirm = true;
        // TWO chips, and "That's mine" rather than "That's it" — see LEGACY_CONFIRM_CHOICES.
        b.expects = beatConfirmExpectation(LEGACY_ASK_REVISION, 'legacy');
        return;
      }
      // At the cap: fall through to COMMIT below, carrying the new draft with it. Held in a local rather than
      // written to b.reply, because the commit path REPLACES b.reply — assigning here would show her the letter
      // for one line of code and then throw it away before the turn was emitted.
      capPreamble = `${b.model.legacyBody}${BEAT_SEP}${LEGACY_CAP_REACHED}${BEAT_SEP}`;
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
      // NAMES THE CHECKPOINT, DOES NOT OPEN IT. Both branches here ended on `checkpointOpener()` — the hand-in
      // from when the Checkpoint was another beat in the same conversation. R3 completes on this turn, so the
      // member is returned to the dashboard holding the Checkpoint's first instrument question, with the Session
      // that would have taken the answer already closed. Identical to what R1 was doing with the Drift Quiz.
      b.reply = `${capPreamble}${LEGACY_SAVED_1}${BEAT_SEP}${LEGACY_SAVED_2}${BEAT_SEP}${LEGACY_CLOSE_NEXT}`;
    } else {
      // No draft ever landed (the model never called the tool). Do not strand them in the beat and do not claim a
      // letter exists — move on quietly. A missing letter is recoverable; a false claim of one is not.
      b.reply = LEGACY_CLOSE_NEXT;
    }
    b.legacyDraft = undefined;
    // R3 ENDS HERE. The Checkpoint is its own Session, exactly as RWR-CHK / RBLD-B4 / RCL-C4 are — and Greg's
    // R3 closure already says so in his own words: "First take a quick step through the Transition Activity."
    b.complete = true;
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
    // R1 ENDS HERE (2026-08-28). This handed straight into the Drift Quiz, which is what made Reconnect one
    // 65-minute conversation instead of the three Sessions the summaries canon has always declared. The IDQ is
    // its own Session now — it closes, the member returns to the dashboard, the ring moves, R2 is teed up.
    b.complete = true;
    // AND IT ENDS ON A CLOSE, NOT ON THE NEXT SESSION'S QUESTION.
    //
    // This line still read `${idqClose()}${BEAT_SEP}${driftOpen(b.collected)}` — the hand-in from when the
    // measurement ran straight into the Drift Quiz inside one continuous arc. So R1 set complete, the ring moved,
    // the member was returned to the dashboard, and the last thing the Companion said to them was the Drift
    // Quiz's opening question: "Of the things you named, which do you feel the distance from most right now?"
    // A question nobody was going to be there to answer. Jay: "Should be responding to the question first."
    //
    // The comment directly above this said "R1 ENDS HERE" when the flag was added. The flag moved and the words
    // did not, and the test I wrote for it asserted `complete` and the stage — never the reply. Checking that a
    // Session ends is not the same as checking what it says on its way out. [[existence-is-not-the-assertion]]
    b.reply = `${idqClose()}${BEAT_SEP}${MIRROR_CLOSE_NEXT}`; // two beats → two bubbles (score read | what's next)
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

/**
 * RECONNECT IS THREE SESSIONS AND A CHECKPOINT — like every other phase (2026-08-28, Jay).
 *
 * It used to be ONE arc of eight stages: a single 65-minute conversation with no boundary anywhere in it. Every
 * other phase runs one arc PER Session, entered from the dashboard, closing back to it with the ring advanced and
 * the next teed up. Reconnect alone did not, and it is the rawest experience in the product — the phase that most
 * needs the member to be able to stop.
 *
 * THREE SOURCES ALREADY SAID SO and we had not noticed they agreed:
 *   · Greg's Gated Assets V4 — four separately-placed assets, R1 IDQ / R2 Doors / R3 Drift+Legacy / R4 Checkpoint,
 *     each with its own Placement, and his own pacing notes ("restrict a person to 10-15 minutes before pausing
 *     for the day", "a soft daily cap … or one session/day"). He never describes Reconnect as one sitting.
 *   · lib/content/summaries.ts, in its own header: "Reconnect holds three (R1 IDQ · R2 Doors · R3 Drift+Legacy)."
 *     The canon has been right the whole time; the runtime was the outlier.
 *   · Two testers hitting the same seam independently in the same week.
 *
 * THE IDQ COMES FIRST NOW, per Greg's spec — R1 is "the first assessment", and R2 "works well after the Identity
 * Distance Questionnaire". We had it second. As one continuous arc that ordering barely showed; as discrete
 * Sessions it IS the spine of the phase, and it means a member's very first Session hands them their baseline.
 */
export const RECONNECT_R1_ARC: ArcConfig = {
  id: 'reconnect-r1',
  stageOrder: ['measurement'],
  stages: { measurement: measurementStage },
  onComplete: () => '',
};
export const RECONNECT_R2_ARC: ArcConfig = {
  id: 'reconnect-r2',
  stageOrder: ['entry', 'doors'],
  stages: { entry: reconnectEntryStage, doors: doorsStage },
  onComplete: () => '',
};
export const RECONNECT_R3_ARC: ArcConfig = {
  id: 'reconnect-r3',
  stageOrder: ['drift', 'window', 'legacy'],
  stages: { drift: driftStage, window: windowStage, legacy: legacyStage },
  onComplete: () => '',
};
export const RECONNECT_CHECKPOINT_ARC: ArcConfig = {
  id: 'reconnect-checkpoint',
  stageOrder: ['checkpoint', 'ceremony'],
  stages: { checkpoint: checkpointStage, ceremony: reconnectCeremonyStage },
  onComplete: () => CEREMONY_LEAD,
};

/**
 * THE WHOLE-PHASE ARC — every stage, original order. It is NOT how a member walks Reconnect any more (that is the
 * four Session arcs above); it is the default for `applyReconnectTurn` so that callers and fixtures which drive a
 * single stage in isolation keep working, and so the stage machine can still be reasoned about as one map.
 *
 * Pointing this at the checkpoint arc instead — the first thing I tried — silently removed six stages from every
 * existing caller and turned 67 tests red for the wrong reason. Back-compat has to mean the stages are still
 * THERE; what changed is where the Sessions END, which is a property of the seams, not of this map.
 */
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
/** The Reconnect turn. `arc` is the SESSION's arc — see reconnectArcFor in app/reconnect/actions.ts. */
export function applyReconnectTurn(
  state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn,
  arc: ArcConfig = RECONNECT_ARC,
): Turn {
  return runArcTurn(arc, state, history, memberMessage, model);
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

export function stageInstructionReconnect(stage?: Stage, st?: ConvState): string {
  // Their Window answer, handed to the model so prompt 1 is never re-asked. Lives on ConvState (like driftPayload),
  // not Collected — it is conversation state being threaded, not captured member data.
  //
  // HEAL ON READ, not only on write. isKeeperMaterial now stops a protest ever BECOMING the Tuesday — but a
  // member mid-Reconnect is already carrying whatever the old rule stored, and state does not fix itself when
  // code ships. Donna's session held legacyTuesday = "I think we already did that and you were writing a letter
  // for me?", so shipping the write-side fix alone would have left her looping exactly as before, and made the
  // fix look like a lie to the one person who reported it.
  //
  // Checking at the point of USE costs one call and makes a refresh genuinely sufficient: a poisoned value is
  // treated as absent, the "they already answered" line drops out of the prompt, and the model asks the question
  // properly instead of being handed nonsense and instructed to use it.
  const storedTuesday = (st?.legacyTuesday ?? '').trim();
  const tuesday = isConversationalMeta(storedTuesday) ? '' : storedTuesday;
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
      'move — do not reflect it again or ask a further question. Do not diagnose.\n' +
      // THE RULE ONBOARDING HAS AND THIS ARC DID NOT (Donna, 2026-08-20). Her worst moment in the product started
      // here, one beat before anyone was looking.
      //
      // The model, mid-drift, ran ahead and asked the Window's question — picture an ordinary Tuesday a year out.
      // She answered it properly: the pedicure, peace and optimism as the default. Then she confirmed the drift
      // reflection, the ENGINE advanced to the Window beat, and its opener asked the same question as though it
      // were new. From where she sat the product had simply stopped listening.
      //
      // Everything after that was consequence. She protested; the protest was stored as her vision, became a
      // keeper card offering her own complaint back, and became the letter's carried-forward answer, so the
      // Legacy beat re-asked too. By the time she wrote "This is fucked up" she had been asked the same question
      // three times by a Companion that kept agreeing with her and then doing it again.
      //
      // Onboarding's reclaim stage has carried this rule for a while, with the cost spelled out — "they answer
      // into a beat that is not running, and get asked for the same thing twice". It was never copied here.
      'THE ENGINE OPENS EVERY BEAT — NOT YOU. Do NOT ask them to picture a Tuesday a year from now, do not ask ' +
      'them to imagine the version of themselves who did the work, and do not mention or promise a letter. Those ' +
      'belong to the beats AFTER this one and the engine opens each with its own words. If you ask early they ' +
      'will answer you, and then the real beat will ask them the same thing again — which reads as the product ' +
      'not listening, and is the single most damaging thing that can happen in this conversation.'
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
export async function liveTurnReconnect(
  state: ConvState, history: ConvMessage[], memberMessage: string,
  arc: ArcConfig = RECONNECT_ARC,
): Promise<Turn> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // THE LEGACY TURN IS NOT A CONVERSATIONAL TURN. It has to produce half a page of first-person prose, which is
  // ~500-600 tokens of letter BEFORE the model's spoken text or any other tool call — so on the shared 600-token
  // budget it was at or over the cap every time, and slow enough to be killed. Donna's walk: the Companion stalled
  // with no sign of life, errored, and needed a refresh; the letter only arrived when she prodded it a second time.
  //
  // ONE ATTEMPT, generously timed, rather than two short ones. Retrying a generation this long inside a 60s
  // function is how you turn a slow turn into a dead one — the retry cannot finish either, and the member waits
  // twice as long to be told it failed.
  //
  // THE SAME ARITHMETIC APPLIES TO THE ORDINARY BRANCH, which had maxRetries: 2 — three attempts at 25s is 75s
  // against a 60s ceiling, so the third could never run and the second could not finish. The reasoning above was
  // written for the letter and never carried across to the line beneath it. One retry (50s) fits.
  const writingLetter = state.stage === 'legacy';
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: writingLetter ? 45000 : 25000,
    maxRetries: writingLetter ? 0 : 1,
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
  return applyReconnectTurn(state, history, memberMessage, parseReconnectTurn(res.content), arc);
}
