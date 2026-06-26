// Onboarding engine v2.0 — STAGED CAPTURE.  Shape: docs/onboarding-staged-capture-shape.md.
// Built ALONGSIDE the v1 engine (lib/agent/onboarding.ts), selected by the ONBOARDING_ENGINE=staged flag;
// v1 serves prod until the eval clears the cut-over bar (≥87% rita vs the ~50% v1 baseline).
//
// The principle, made structural: the STAGE is the capture context. The agent asks about ONE field per
// stage; the model TAGS each piece via per-field tools (no narrative-shape guessing); the engine sequences
// the stages and gates each transition on a warm member confirmation. That makes the v1 reclaim-as-gap
// (37%) impossible — reclaim can't land in the gap slot because we aren't collecting wants in the gap stage.
//
// Arc:  Stage 0 gate → identity → gap (how it opened) → reclaim → confirmation card.  Ends on hope.
//
// SLICE a built: the stage machine (authoritative `stage` + `awaitingConfirm`), the confirmed-transition
// engine, and the IDENTITY stage in full (gather → reflect-confirm → advance; skip path; correction re-opens).
// SLICE b built: the GAP stage — set_gap/note_door tools, lighter Door posture (receive, don't excavate;
// 0/1/several Doors all valid, never gated on count), the Doors-session forecast, and the stage-scoped gap
// backstop (capture the member's own message as the gap only in-stage when the model failed to tag it).
// SLICE c builds: the RECLAIM stage — add_reclaim_item gather to RECLAIM_LIST_MIN, re-surfacing of parked
// front-loader items at stage entry ("earlier you said X — let's start there"), the never-trap nudge
// (nudge once below the minimum, never loop, never complete below the frozen floor), the stage-scoped
// reclaim BACKSTOP (the live eval proved the model under-tags wants and strands the list at 0 — so this is
// load-bearing, not deferrable), and the handoff into the confirmation card. The flow is now END-TO-END
// behind the flag — the first live-eval gate.

import { cleanIdentityNoun, displayIdentityNoun, identityLabel } from '../member/identity.ts';
import { isDoorSlug, matchDoors, type DoorSlug } from '../doors.ts';
import { RECLAIM_LIST_MIN, RECLAIM_LIST_TARGET } from '../member/reclaim.ts';
import { gapIsNarrative } from './onboarding-contract.ts';
import { MEMBER_AGENT_SYSTEM_PROMPT } from './system-prompt.ts';
import {
  augmentDoors,
  confirmsWhole,
  isAffirmation,
  memberWantsToWrap,
  stripLeadingDisclosure,
  type Collected,
  type ConvMessage,
  type ConvState,
  type Ctx,
  type ModelTurn,
  type Stage,
  type Turn,
} from './onboarding.ts';

const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// --- stage sequencing ----------------------------------------------------------------------------------
type StagedStage = 'identity' | 'gap' | 'reclaim' | 'complete';
const STAGE_ORDER: StagedStage[] = ['identity', 'gap', 'reclaim', 'complete'];
function nextStagedStage(s: StagedStage): StagedStage {
  return STAGE_ORDER[Math.min(STAGE_ORDER.indexOf(s) + 1, STAGE_ORDER.length - 1)]!;
}

// After this many identity gather-turns without a word, offer the explicit "find it later" skip.
const IDENTITY_SKIP_OFFER_AFTER = 2;

// --- copy (engine-owned forwards; the model leads when it asks a real question) -------------------------
export const STAGED_OPENING =
  "Before we get to any numbers or plans, I want to understand who I'm helping you reclaim — the fullest version of you. " +
  "Let's start by taking a minute to think about who you were back when you felt most like yourself — not the job title, " +
  'the version underneath all that.';

const NAME_PROMPT =
  'If you put that person in a single word — the Runner, the Writer, the Builder, the Friend — what would it be? ' +
  "It's a handle to hold onto, not a label set in stone, and we can change it.";

const SKIP_OFFER =
  "No rush on the perfect word — and you don't have to land it today. If one comes — the Runner, the Builder, the " +
  "Friend — say it. If not, that's completely fine; we'll find it together as you go. Want to leave it for now?";

const SKIP_ACK = "That's completely fine — you'll find her through the work, no rush.";

const REOPEN_IDENTITY = "My mistake — let's get it right. What word feels truer for who she was?";

// The reframe into Stage 2 (gap), used the moment we advance out of identity.
const GAP_OPEN =
  'Now, the harder part — and it might matter most. Somewhere, the distance started to open. Sometimes it’s one clear ' +
  'thing — a loss, a diagnosis, a move, a job that swallowed you. More often it’s slower. Tell me how it went for you.';

// Reflect-confirm copy for the gap. We lead with the model's OWN warm reflection of what they just told us
// (it just heard the whole story); the forecast sets the expectation that the specific Doors get a dedicated
// session later (lighter Door posture — receive, don't excavate); one confirm question, never a Y/N gate.
const GAP_REFLECT_LEAD = "Thank you for trusting me with that — that kind of distance rarely opens all at once.";
const GAP_FORECAST_CONFIRM =
  "We'll come back to the specific doors that opened it — there's a session built for exactly that a little " +
  'further on. For now: did I understand the shape of how it went?';
const REOPEN_GAP = "I want to get this right — tell me how it really went, in your own words.";

// Said when the engine recognizes there is NO Fade — a forward-looking member with no loss or drift. We do
// NOT manufacture a gap or push them to completion (locked scope: this person isn't our member). Honest and
// non-pathologizing; holds rather than completing. PLACEHOLDER COPY — the real decline message/UX is the
// flagged Jay+Greg decision (docs/onboarding-open-issues.md Issue 2).
const NO_FADE_REFLECTION =
  "It sounds like you're genuinely in a good place — moving forward, not trying to get something back. That's " +
  'real, and worth saying plainly: this program is built for people feeling a distance from who they used to ' +
  "be, and that may just not be where you are right now. If that ever changes, we'll be here. Is there anything " +
  'about that I have wrong?';

// The reframe into Stage 3 (reclaim) — the conversation turns toward hope.
const RECLAIM_OPEN =
  'Now the good part — the reason any of this matters. When you picture closing that distance, what do you ' +
  'want back? The things that were yours. Name whatever comes — big or small, there are no wrong answers.';

const RECLAIM_MORE = 'What else? Anything that comes — big or small.';

// Never-trap nudge: said ONCE when the member signals done below the minimum. It does not re-ask the same
// way — it lowers the bar (small things count) to unlock one more, then the engine stops nudging.
const RECLAIM_NUDGE =
  "Even one or two more — and they can be small: sleeping through the night, an old hobby, a friend you've " +
  'lost touch with, ten quiet minutes that are yours. What comes to mind?';

// The handoff into the confirmation card (the card itself is rendered client-side from `collected`).
const COMPLETE_HANDOFF =
  "That's everything I need to get you started. Let me show you what I captured — take a look and tell me if " +
  "it's right. Nothing's saved yet.";

// Said when the member has been nudged once and is still closing BELOW the minimum: honor them (Independence
// Guarantee) — never fabricate, never re-ask identically. A warm, non-looping hold that leaves the door open
// for one more without pressure. (The frozen ≥3 floor means we still can't finalize here — see the engine
// note; whether a determined sub-min member can complete is a pending data-contract decision.)
const RECLAIM_SOFT_HOLD =
  "That's a real start, and there's no rush — your list is never locked, and you can add to it any time as " +
  'more comes back to you. If even one more surfaces right now, tell me; if not, that\'s completely okay.';

function reflectIdentity(c: Collected): string {
  const label = capFirst(identityLabel(c.identityNoun) || 'that person');
  return `So — ${label} is who we're bringing back, the one who felt most like you. Did I get her right?`;
}

// The model's same-turn text is its natural reflection of the story it just heard — use it as the lead when
// it isn't itself a question (one-question-per-turn); otherwise fall back to the warm canned lead.
function reflectGap(modelText: string): string {
  const lead = modelText && !modelText.includes('?') ? modelText.trim() : GAP_REFLECT_LEAD;
  return `${lead}\n\n${GAP_FORECAST_CONFIRM}`;
}

// The reclaim-stage opener. If the member ALREADY parked wants earlier (front-loader), read them back —
// "earlier you said X — let's start there." True by construction, and the single best trust moment in the
// flow: it proves nothing was dropped. With nothing parked, it's the clean RECLAIM_OPEN.
function reclaimOpening(c: Collected): string {
  const parked = c.reclaimList ?? [];
  if (parked.length === 0) return RECLAIM_OPEN;
  const items = parked.map((x) => `“${x.trim()}”`).join(parked.length === 2 ? ' and ' : ', ');
  return (
    `Now the good part — and you've already started. Earlier you told me you want ${items} back, so ` +
    `${parked.length === 1 ? "that's" : "those are"} on your list. What else? Big or small, there are no wrong answers.`
  );
}

// Reflect the Reclaim List back before the card — the member hears their own list, one confirm question.
function reflectReclaim(c: Collected): string {
  const items = (c.reclaimList ?? []).map((x) => `• ${x.trim()}`).join('\n');
  return `So here's your Reclaim List — what you want back:\n\n${items}\n\nIs that the heart of it, or is there something we're still missing?`;
}

// --- confirmed-transition detection --------------------------------------------------------------------
// The ONLY signal we need: did the member CORRECT the reflection? Everything else (an affirmation, or an
// ambiguous reply) advances — a reflection with no dispute moves on, so the transition can never trap.
const CORRECTION_RE =
  /\b(no|nope|not (quite|really|it|her|him|that|right)|that'?s not|that wasn'?t|wrong|isn'?t (it|her|right)|actually|what do you mean|doesn'?t (fit|feel|sound|seem))\b/i;
// A correction re-opens the stage. The isAffirmation guard lets the colloquial "yeah no, that's her" (a yes)
// through as NOT a correction, so it advances.
export function correctsReflection(message: string): boolean {
  const m = (message ?? '').replace(/[‘’]/g, "'");
  return CORRECTION_RE.test(m) && !isAffirmation(m);
}

function identityTargetMet(c: Collected): boolean {
  return !!c.athleticPast && (!!c.identityNoun || !!c.identitySkipped);
}

// --- fade recognition (the Stage-0 gate, enforced in the gap stage) -------------------------------------
// Our member feels a REAL Fade — a felt distance from who they were (loss/decline/drift). A forward-looking
// optimizer with no loss ("nothing went wrong, I just want more") is NOT our member; the system must DECLINE
// them, never fabricate a fade to force completion (locked scope, Jun 2026; onboarding-open-issues Issue 2).
const AMBITION_RE =
  /\b(optimi[sz]e|level[ -]?up|next (level|challenge|chapter|thing)|bigger|faster|scale|start[- ]?up|peak|keep (leveling|growing|building|pushing)|doing (great|well|amazing)|thriving|just want more|want to keep)\b/i;
// EXPLICIT no-fade declarations. These contain loss WORDS ("no loss", "no drift") but assert the OPPOSITE —
// so we test them first and strip them before reading LOSS_RE, or the negation flips the result.
const NO_LOSS_RE =
  /\b(no (real )?(loss|drift|regret|hardship|crisis)( or (loss|drift|regret|hardship))?|nothing (ever |really )?(went |is )?wrong|haven'?t (drifted|lost|fallen)|don'?t feel (a |any )?(loss|drift|gap))\b/i;
const LOSS_RE =
  /\b(lost|loss|losing|died|death|passed|sick|illness|diagnos|divorce|laid off|layoff|let go|left me|gone|stopped|gave up|drift|faded|fading|disappear|alone|lonely|empty|caregiver|caring for|injur|grief|grieving|miss(ed|ing)?|used to|no longer|slipped away|fell apart|burned out|breakdown)\b/i;
function hasGenuineLoss(text: string): boolean {
  const stripped = (text ?? '').replace(NO_LOSS_RE, ' '); // remove "no loss / nothing wrong" before reading loss
  return LOSS_RE.test(stripped) || matchDoors(text ?? '').length > 0;
}
function isForwardAmbition(text: string): boolean {
  const t = text ?? '';
  if (hasGenuineLoss(t)) return false; // genuine loss present wins — a real fade can still say "no crisis"
  return NO_LOSS_RE.test(t) || AMBITION_RE.test(t); // explicit no-fade declaration, or pure forward ambition
}
function hasLossSignal(text: string): boolean {
  return hasGenuineLoss(text);
}
// A captured gap is a REAL fade (not ambition). The model's explicit set_gap is trusted unless it's clearly
// ambition; the BACKSTOP is stricter (requires a loss signal) since it's inferring from an untagged message.
function isRealFade(text: string): boolean {
  return gapIsNarrative(text, []) && !isForwardAmbition(text);
}

// One shared "member is deflecting / closing / refusing" signal, used by BOTH backstops so neither captures a
// refusal as content (front-loader's "I'm not going to answer that again" became the gap — this kills that).
const DEFLECT_RE =
  /\b(i'?m not (going to |gonna )?(answer|engage|doing this)|not answering|i'?ve (answered|already)|already (said|told|answered)|stop asking|we'?re (good|done|fine)|that'?s (all|it|enough)|let'?s (move|keep going|proceed)|move (on|forward|along)|moving on)\b/i;
function memberDeflecting(message: string): boolean {
  const m = (message ?? '').replace(/[‘’]/g, "'");
  return memberWantsToWrap(m) || DEFLECT_RE.test(m);
}

// --- capture merge (the per-field tools' result, merged into Collected) ---------------------------------
// The model's turn carries the per-field captures already merged into a Partial<Collected> (parseStagedTurn
// does this on the live path; fixtures provide it directly). Only the early-beat fields exist in slice a.
function mergeStaged(prev: Collected, rec?: Partial<Collected>): Collected {
  if (!rec) return prev;
  return {
    ...prev,
    ...(rec.athleticPast !== undefined && { athleticPast: rec.athleticPast }),
    ...(rec.identityNoun !== undefined && rec.identityNoun !== '' && { identityNoun: displayIdentityNoun(rec.identityNoun) }),
    ...(rec.identitySkipped === true && { identitySkipped: true }),
    ...(rec.gap !== undefined && rec.gap !== '' && { gap: rec.gap }),
    // Doors accumulate — one note_door call per Door; union with what we already have (never drop one).
    ...(rec.doors !== undefined && { doors: Array.from(new Set<DoorSlug>([...(prev.doors ?? []), ...rec.doors])) }),
    // Reclaim items accumulate in lockstep with their categories. Tools are stage-agnostic for CAPTURE, so an
    // item volunteered early (front-loader) parks here in the moment — never lost, re-surfaced at its stage.
    ...(rec.reclaimList !== undefined && {
      reclaimList: [...(prev.reclaimList ?? []), ...rec.reclaimList],
      reclaimCategories: [
        ...(prev.reclaimCategories ?? []),
        ...rec.reclaimList.map((_, i) => rec.reclaimCategories?.[i] ?? ''),
      ],
    }),
  };
}

// Stage-scoped gap backstop: if the model conversed but never called set_gap, capture the member's OWN
// gap-stage message as the gap — but ONLY while we're in the gap stage and ONLY if it reads as a real fade
// narrative (not a wrap/affirm or a one-liner). Safe by construction: in the gap stage there is no reclaim
// list being collected, so the v1 reclaim-as-gap contamination simply cannot occur here.
const STAGED_GAP_MIN_CHARS = 80;
function shouldCaptureStagedGap(message: string): boolean {
  const m = (message ?? '').trim();
  if (memberDeflecting(m) || isAffirmation(m)) return false; // never grab a wrap OR a refusal as the gap
  if (m.length < STAGED_GAP_MIN_CHARS) return false;
  // Stricter than the model's tag: an inferred gap must read as a real fade AND carry a loss signal. This is
  // what stops a no-fade optimizer's ambition ("pressure-test my SaaS idea") from being backstopped as a fade.
  return isRealFade(m) && hasLossSignal(m);
}

// Stage-scoped RECLAIM backstop. Same discipline as the gap backstop, and just as load-bearing: the live
// model frequently reflects a member's wants WITHOUT calling add_reclaim_item (the #1 real failure), which
// would strand the list at 0 forever. In the reclaim stage every substantive member message IS a want, so
// capturing it is safe — there's no other field to contaminate. We reject wraps/affirms/uncertainty/stage-
// directions so refusals and "that's all" don't become list items. Lossy-but-recoverable: the card is the
// seatbelt for any mis-grab.
const UNCERTAIN_RE = /\b(i (don'?t|do not) know|not sure|no idea|i'?m not sure|dunno|can'?t think of)\b/i;
function shouldCaptureStagedReclaim(message: string): boolean {
  const m = (message ?? '').replace(/\*[^*]*\*/g, '').replace(/[‘’]/g, "'").trim(); // drop *stage directions*
  if (m.length < 6) return false;
  if (memberWantsToWrap(m) || isAffirmation(m) || correctsReflection(m)) return false;
  if (UNCERTAIN_RE.test(m) && m.length < 40) return false;
  return true;
}

// ONE "the member is closing the Reclaim List" signal — consolidates the three close shapes (wrap, whole,
// and the reclaim-specific "that's the list / those are the real ones" closings) per the capture-quality
// rule: when a close-detection shape recurs, unify the detectors rather than widen a regex elsewhere. This
// is what makes the warm nudge fire at the RIGHT moment (when they soft-close below the minimum) instead of
// a bare "what else?" that reads as not-listening — and it keeps the backstop from grabbing a close/refusal
// as a fabricated item.
const RECLAIM_CLOSE_RE =
  /\b(that'?s (actually |really |pretty much |honestly )?(it|all|everything|the list)|those are (the )?(real|only|main|biggest) ones|that'?s (my|the) (real )?list|the (real )?list( is)?( complete| done| it)?|i'?m (good|done|ready)|i'?ve (answered|said|told you)|(let'?s |can we )?(move on|moving on|move forward|keep going)|i'?m (stepping away|not answering|done answering))\b/i;
function memberClosingReclaim(message: string): boolean {
  const m = (message ?? '').replace(/[‘’]/g, "'");
  return memberDeflecting(m) || confirmsWhole(m) || RECLAIM_CLOSE_RE.test(m);
}

// --- THE STAGED ENGINE (pure, replayable) --------------------------------------------------------------
export function applyStagedTurn(
  state: ConvState,
  _history: ConvMessage[],
  memberMessage: string,
  model: ModelTurn,
): Turn {
  const collected = mergeStaged({ ...state.collected }, model.record);
  let stage = (state.stage ?? 'identity') as StagedStage;
  let awaitingConfirm = state.awaitingConfirm ?? false;
  let identityTurns = state.identityTurns ?? 0;
  let reclaimNudged = state.reclaimNudged ?? false;
  let gapTurns = state.gapTurns ?? 0;
  let noFade = state.noFade ?? false;
  const modelText = stripLeadingDisclosure(model.text).trim();

  let finalReply: string;
  let complete = false;

  if (awaitingConfirm) {
    // Resolving a reflect-confirm: a correction re-opens the stage; anything else advances.
    if (correctsReflection(memberMessage)) {
      awaitingConfirm = false;
      if (stage === 'identity') {
        finalReply = REOPEN_IDENTITY;
      } else if (stage === 'gap') {
        // Re-open the gap: clear the captured story (and the Doors derived from it) so the next gather
        // re-captures the corrected account. Non-trapping — they retell, the card is the final seatbelt.
        collected.gap = undefined;
        collected.doors = [];
        finalReply = REOPEN_GAP;
      } else {
        // Reclaim correction — they want to change the list; stay in reclaim and keep gathering.
        finalReply = modelText && /\?/.test(modelText) ? modelText : RECLAIM_MORE;
      }
    } else {
      stage = nextStagedStage(stage);
      awaitingConfirm = false;
      if (stage === 'gap') finalReply = GAP_OPEN;
      else if (stage === 'reclaim') finalReply = reclaimOpening(collected);
      else {
        // reclaim → complete: hand off to the confirmation card (rendered client-side from `collected`).
        finalReply = COMPLETE_HANDOFF;
        complete = true;
      }
    }
  } else if (stage === 'identity') {
    if (collected.identitySkipped) {
      // Skipped — nothing to confirm; acknowledge and advance straight into the gap stage.
      stage = 'gap';
      finalReply = `${SKIP_ACK}\n\n${GAP_OPEN}`;
    } else if (collected.identityNoun) {
      // Named — reflect it back warmly and wait for the member's confirm (the transition).
      finalReply = reflectIdentity(collected);
      awaitingConfirm = true;
    } else {
      // Gather: keep the model's question if it asked one; otherwise drive the identity forward, and after
      // a couple of tries offer the explicit "find it later" skip (the v1 identity-gate intent, staged).
      identityTurns += 1;
      if (modelText && /\?/.test(modelText)) finalReply = modelText;
      else if (!collected.athleticPast) finalReply = STAGED_OPENING;
      else finalReply = identityTurns >= IDENTITY_SKIP_OFFER_AFTER ? SKIP_OFFER : NAME_PROMPT;
    }
  } else if (stage === 'gap') {
    // FADE GATE. A model-tagged gap that is actually forward-looking ambition (no loss) is NOT a fade —
    // reject it so a no-fade optimizer can't be force-completed (the model is instructed not to tag, but we
    // never trust the tag over the contract).
    if (collected.gap && !isRealFade(collected.gap)) collected.gap = undefined;
    // Backstop: model conversed without tagging set_gap — capture their own message as the gap only if it's
    // a real fade with a loss signal (shouldCaptureStagedGap; rejects ambition and refusals).
    if (!collected.gap && shouldCaptureStagedGap(memberMessage)) collected.gap = memberMessage.trim();
    if (collected.gap) {
      // Door quality (lighter posture — receive, don't excavate): read any Doors out of the captured gap AND
      // the member's own message. Their first-person words ("I was laid off", "my dad's health") match the
      // aliases better than the model's third-person gap summary ("Her father…"), so scanning both lifts
      // recall. 0/1/several are all valid; the stage NEVER gates on Door count; augmentDoors unions and never
      // invents off empty text.
      collected.doors = augmentDoors(collected.doors ?? [], `${collected.gap} ${memberMessage}`);
      // Reflect the story back + forecast the dedicated Doors session, then await the member's confirm.
      finalReply = reflectGap(modelText);
      awaitingConfirm = true;
    } else {
      // No fade captured yet. Watch for the no-fade signal: a member describing only ambition / no loss.
      gapTurns += 1;
      // Decline once we've asked how it opened and they're STILL giving only forward ambition (2nd+ turn),
      // or once already recognized as no-fade (sticky).
      if (noFade || (isForwardAmbition(memberMessage) && gapTurns >= 2)) {
        // DECLINE — recognize there's no Fade and stop. Never fabricate a gap, never complete. The member-
        // facing decline copy/UX is the flagged Jay+Greg decision (Issue 2); the engine's job is to not force
        // it. We surface an honest, non-pathologizing reflection and hold (no completion).
        noFade = true;
        finalReply = NO_FADE_REFLECTION;
      } else {
        // Genuinely still gathering — keep the model's question if it asked one; otherwise hold the gap open.
        finalReply = modelText && /\?/.test(modelText) ? modelText : GAP_OPEN;
      }
    }
  } else if (stage === 'reclaim') {
    const closing = memberClosingReclaim(memberMessage);
    // Backstop: capture an untagged want ONLY when the member is OFFERING (not closing/refusing). The live
    // eval proved the model under-tags wants (stranding the list at 0); the close-guard proves it never
    // fabricates a list item from a "that's my list" / frustrated refusal. Offering → capture; closing → never.
    const grewThisTurn = (collected.reclaimList?.length ?? 0) > (state.collected.reclaimList?.length ?? 0);
    if (!grewThisTurn && !closing && shouldCaptureStagedReclaim(memberMessage)) {
      collected.reclaimList = [...(collected.reclaimList ?? []), memberMessage.trim()];
      collected.reclaimCategories = [...(collected.reclaimCategories ?? []), ''];
    }
    const count = collected.reclaimList?.length ?? 0;
    // Cap runaway capture: once at the soft aim (~7), stop asking "what else?" and move to confirm — this is
    // what kept a verbose persona from ballooning to 17–21 items.
    if (count >= RECLAIM_LIST_TARGET || (count >= RECLAIM_LIST_MIN && closing)) {
      // Aim reached, OR the member has met the minimum and is closing — reflect the whole list and confirm.
      finalReply = reflectReclaim(collected);
      awaitingConfirm = true;
    } else if (count >= RECLAIM_LIST_MIN) {
      // At/above the floor but still offering and not at the aim — keep gently gathering toward ~7.
      finalReply = modelText && /\?/.test(modelText) ? modelText : RECLAIM_MORE;
    } else if (closing && !reclaimNudged) {
      // Soft-close below the minimum → nudge ONCE: lower the bar (small things count), draw out more. This is
      // the moment a genuine multi-want member names the rest; it fires HERE (not a bare "what else?") because
      // memberClosingReclaim catches the soft "that's the list" closings, not just explicit wraps.
      reclaimNudged = true;
      finalReply = RECLAIM_NUDGE;
    } else if (closing && reclaimNudged) {
      // Already nudged, still closing below the floor. Per Jay's Gate-1 decision (sub-3 completion): if they
      // gave at least one real want, ACCEPT and complete — the card carries the shortfall, post-onboarding /
      // MA editing reaches the ~7 aim. Never fabricate to reach 3. Only a truly empty list holds.
      if (count >= 1) {
        finalReply = reflectReclaim(collected);
        awaitingConfirm = true;
      } else {
        finalReply = RECLAIM_SOFT_HOLD;
      }
    } else {
      // Still offering — keep the model's question if it asked one; otherwise invite the next item.
      finalReply = modelText && /\?/.test(modelText) ? modelText : RECLAIM_MORE;
    }
  } else {
    // Already complete (e.g. a resumed terminal state) — the card stands.
    finalReply = modelText || COMPLETE_HANDOFF;
    complete = true;
  }

  return {
    reply: finalReply,
    state: { stage, collected, awaitingConfirm, identityTurns, reclaimNudged, gapTurns, noFade },
    complete,
  };
}

// --- the public staged turn (opening + governance handled by onboardingNextTurn) -----------------------
export function stagedOpening(): Turn {
  return { reply: STAGED_OPENING, state: { stage: 'identity', collected: {} }, complete: false };
}

// --- live tool surface (used when ONBOARDING_ENGINE=staged on the live path) ---------------------------
// Slice a: the identity-stage tools. set_gap/note_door/add_reclaim_item land in slices b/c.
export const STAGED_TOOLS = [
  {
    name: 'set_past_self',
    description: "Record who the member was at their best, in their own words (the past self).",
    input_schema: { type: 'object' as const, properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'name_identity',
    description: 'Record the confirmed reclaimed-identity word, natural case (e.g. "Athlete"), once the member chooses or coins it.',
    input_schema: { type: 'object' as const, properties: { noun: { type: 'string' } }, required: ['noun'] },
  },
  {
    name: 'skip_identity',
    description: 'Record that the member chose NOT to name an identity yet (they will find it at Identity Excavation).',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'set_gap',
    description: "Record how the distance opened — the member's own account of the fade story (the gap). Call this once they've told you how it went, in their words.",
    input_schema: { type: 'object' as const, properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'note_door',
    description:
      'Record a Door that surfaces in the fade story — the life event that opened the distance. Call once per Door (it accumulates). Slugs: ' +
      'career_cliff, aging_parents, empty_nest, vanishing, body, diagnosis, marriage, loss, full_house, grind, load_bearer. ' +
      'Only note a Door the member actually describes — none is a valid outcome; never force one.',
    input_schema: { type: 'object' as const, properties: { slug: { type: 'string' } }, required: ['slug'] },
  },
  {
    name: 'add_reclaim_item',
    description:
      'Record one thing the member wants back (a Reclaim-List item), in their words. Call once per item; it accumulates. ' +
      "If they volunteer one EARLY (before the reclaim stage), capture it here anyway so it's never lost — you'll bring it back at its stage.",
    input_schema: {
      type: 'object' as const,
      properties: { text: { type: 'string' }, category: { type: 'string' } },
      required: ['text'],
    },
  },
];

// Parse a staged model response (per-field tool calls) into the merged Partial<Collected> the engine reads.
export function parseStagedTurn(content: readonly unknown[]): ModelTurn {
  let text = '';
  const rec: Partial<Collected> = {};
  for (const b of content as Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }>) {
    if (b.type === 'text' && typeof b.text === 'string') text += b.text;
    if (b.type === 'tool_use') {
      if (b.name === 'set_past_self' && typeof b.input?.text === 'string') rec.athleticPast = b.input.text;
      if (b.name === 'name_identity' && typeof b.input?.noun === 'string') rec.identityNoun = cleanIdentityNoun(b.input.noun);
      if (b.name === 'skip_identity') rec.identitySkipped = true;
      if (b.name === 'set_gap' && typeof b.input?.text === 'string') rec.gap = b.input.text;
      if (b.name === 'note_door' && typeof b.input?.slug === 'string' && isDoorSlug(b.input.slug)) {
        (rec.doors ??= []).push(b.input.slug);
      }
      if (b.name === 'add_reclaim_item' && typeof b.input?.text === 'string') {
        (rec.reclaimList ??= []).push(b.input.text);
        (rec.reclaimCategories ??= []).push(typeof b.input.category === 'string' ? b.input.category : '');
      }
    }
  }
  return { text, record: rec };
}

// Is the staged engine selected? Flag only — defaults OFF, so v1 serves prod until cut-over.
export function stagedEngineEnabled(): boolean {
  return process.env.ONBOARDING_ENGINE === 'staged';
}

// --- live staged turn (slice a: identity stage; gap/reclaim instructions land in b/c) -------------------
const STAGED_SYSTEM = `${MEMBER_AGENT_SYSTEM_PROMPT}

OPERATING MOMENT: Onboarding (v2.0, STAGED capture).
This is a staged conversation. You move through it one stage at a time — identity → how the gap opened →
what they want back — and you only ever ask about the CURRENT stage (named each turn). It still feels like
one warm conversation; the stages are invisible to the member.

CAPTURE WITH TOOLS, never in prose — and never narrate that you saved something:
- set_past_self(text): who they were at their best, in their own words.
- name_identity(noun): the reclaimed-identity word, natural case (e.g. "Athlete"), once they choose or coin it.
- skip_identity(): they chose not to name one yet.
- set_gap(text): how the distance opened — their fade story, in their words.
- note_door(slug): a life event that opened the distance (one call per Door; none is valid — never force one).
If the member volunteers something for a LATER stage (e.g. names what they want back while you're still on
identity), capture it with its tool anyway — never lose it — but keep asking only about the CURRENT stage;
you'll bring it back at its stage.

IDENTITY STAGE: open on who they were when they felt most like themselves — a past self of ANY kind (never
assume athletic). Reflect a specific detail back, then offer a couple of candidate words FROM THEIR OWN
LANGUAGE and invite them to choose or coin one — framed as a changeable HANDLE, not a verdict. Confirm the
word. If they're genuinely not ready, reassure them and call skip_identity — never pressure a name. Record
the word with name_identity in natural case ("Athlete", never "the Athlete").

GAP STAGE ("how it opened"): ask, once, how the distance opened, then RECEIVE — do not excavate. Let them
tell it their way; when they've given you the account, call set_gap(their story).
TAGGING DOORS — do this silently as the story comes out, NOT by interrogating: call note_door ONCE for EACH
distinct life event you recognize in what they ALREADY told you. A story can carry several. Map by meaning,
in their own words:
  • a job ending / being laid off / a layoff / forced out / a role hollowing out → career_cliff
  • work/ambition that GREW until it crowded out the self → grind
  • being the one carrying the household / the bills / the breadwinner / a partner who didn't step up → load_bearer
  • caring for a parent / a parent's health crisis or decline (a coma, getting sick, declining) → aging_parents
  • kids leaving / the house going quiet → empty_nest;  young kids + marriage, no room for you → full_house
  • a diagnosis / health scare → diagnosis;  the body saying no → body
  • a divorce or a marriage drifting into coexisting → marriage
  • losing someone close (death) → loss;  friendships/social world fading → vanishing
Tag what's THERE — zero is fine (recognition, not routing), and never force one. But do not let a clearly-
named event go un-tagged. Do NOT keep digging or re-ask "any others?"; the specific Doors get a dedicated
session later, and you may say so warmly. One Door, several, or none are all complete.
CRITICAL — DO NOT FABRICATE A FADE: this program is for people feeling a real distance from who they were
(a loss, a decline, a slow drift). If the member describes NO loss and NO drift — they're thriving and simply
want MORE (optimize, level up, the next challenge) — that person is NOT yours to capture. Do NOT call set_gap,
do NOT invent a hardship to please anyone. Gently reflect that they sound like they're in a good place and
this may not be what they need right now. A member with no Fade is the system correctly recognizing a
non-member — not a conversation to force forward.

The AI disclosure was shown on the start page — never repeat it. Reflect first, then exactly ONE warm
question per turn. No meta-narration about the program's mechanics.`;

function stageInstruction(stage?: Stage): string {
  if (stage === 'gap')
    return (
      '\n\nCURRENT STAGE: how the gap opened. Ask once, then receive their fade story and call set_gap; ' +
      'note_door for any Door that surfaces (none is valid). Do not excavate or re-ask for more Doors.'
    );
  if (stage === 'reclaim')
    return (
      '\n\nCURRENT STAGE: what they want back. Invite the things they want to reclaim and call add_reclaim_item ' +
      'once per item (big or small — there are no wrong answers). If they already named some earlier, build on ' +
      "those, don't re-ask. Aim for a few; never pressure or interrogate — small things count."
    );
  return '\n\nCURRENT STAGE: identity — who they were at their best, and the one-word handle (or skip).';
}

export async function liveTurnStaged(
  _ctx: Ctx,
  history: ConvMessage[],
  state: ConvState,
  memberMessage: string,
): Promise<Turn> {
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
    system: STAGED_SYSTEM + stageInstruction(state.stage),
    tools: STAGED_TOOLS,
    messages,
  });
  return applyStagedTurn(state, history, memberMessage, parseStagedTurn(res.content));
}

export type { Ctx };
