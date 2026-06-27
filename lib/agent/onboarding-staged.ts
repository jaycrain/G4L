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
import { RECLAIM_LIST_FLOOR, RECLAIM_LIST_MIN, RECLAIM_LIST_TARGET } from '../member/reclaim.ts';
import { gapIsNarrative, hasIdentity } from './onboarding-contract.ts';
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

// After this many identity gather-turns, offer the explicit "find it later" skip (even with no past-self yet).
const IDENTITY_SKIP_OFFER_AFTER = 2;
// Hard never-strand escape: after this many, skip identity outright and move on (recovered at Excavation).
const IDENTITY_MAX_TURNS = 5;
// Gap never-strand: after this many gap turns with nothing captured, grab the accumulated story so we advance.
const GAP_MAX_TURNS = 4;
// SYSTEMIC INVARIANT — no gather stage loops unbounded. Past this many member turns, the conversation is FORCED
// to the confirmation card (the seatbelt) as soon as there's a usable capture. A member genuinely engaged
// finishes well under this (rita 10–18); it only catches runaway gather loops, and the card still lets them
// keep talking. Set above normal completion, below the eval's hard cap (24).
const ONBOARDING_FORCE_TURNS = 20;

// --- copy (engine-owned forwards; the model leads when it asks a real question) -------------------------
// v2.0 FINAL copy — docs/handoffs/2026-06-26-v2.0-final-copy-and-floor.md §3–§6. Voice: warm, direct,
// declarative; "Companion" not "Member Agent"; Grinta mixed-case; no "Gateway".

// Personalize with the member's identity handle ("the Cheerleader") in NATURAL CASE (brand: never all-caps,
// lowercase "the" mid-sentence), with a graceful fallback when they chose to name it later (skipped).
function identityRef(c: Collected): string {
  return identityLabel(c.identityNoun) || 'who you used to be';
}

// §3 — Stage 1 (who you are): the opener (the AI disclosure + primer live on the Stage-0 start page).
export const STAGED_OPENING =
  "Let's start by thinking about when you felt most like yourself. Maybe it was twelve, riding your bike fearlessly. " +
  'Twenty, going door-to-door for something you believed in. College? Your first marathon? Fishing with your grandfather? ' +
  "Not the job title, not the role everyone knows you for — even if that's mom or dad, partner or child. The version " +
  "underneath all that — the one you've drifted from and want to be again. Who were they? What were they doing? How did " +
  'you feel? Tell me about them.';

const NAME_PROMPT =
  'If you put that person in a single word — the Runner, the Writer, the Builder, the Friend — what would it be? ' +
  "It's a handle to hold onto, not a label set in stone, and we can change it.";

const SKIP_OFFER =
  "No rush on the perfect word — and you don't have to land it today. If one comes — the Runner, the Builder, the " +
  "Friend — say it. If not, that's completely fine; we'll find it together as you go. Want to leave it for now?";

const SKIP_ACK = "That's completely fine — you'll find her through the work, no rush.";

const REOPEN_IDENTITY = "My mistake — let's get it right. What word feels truer for who she was?";

// §4 — Stage 2 (how the gap opened): introduces "Doors" at first use, personalized to their handle.
function gapOpen(c: Collected): string {
  return (
    `Somewhere, the distance between you and ${identityRef(c)} started to open. Sometimes it's one clear thing — a loss, ` +
    'a diagnosis, a move, a job that swallowed you. More often it’s slower: an accumulation of what we call Doors — moments ' +
    'and seasons you walk through and barely notice, each one widening the gap. What’s been happening that caused that ' +
    'version of you to Fade? Tell me how it went for you.'
  );
}

// Reflect-confirm copy for the gap. We lead with the model's OWN warm reflection of what they just told us
// (it just heard the whole story); the forecast sets the lighter-Door expectation (receive, don't excavate)
// that the specific Doors get a dedicated session later; one confirm question, never a Y/N gate. (§4)
const GAP_REFLECT_LEAD = "Thank you for trusting me with that — that kind of distance rarely opens all at once.";
const GAP_FORECAST_CONFIRM =
  'Most people find there’s more than one thread here; we’ll go deeper in the Doors session later, when you’re ready. ' +
  'For now, this is plenty — did I understand the shape of how it went?';
const REOPEN_GAP = "I want to get this right — tell me how it really went, in your own words.";

// Invite the REST of the story (a fade is often several things at once — job, then the household, then a
// parent) WITHOUT excavating Door-by-Door. Asked after each chapter until the member signals the story whole.
// ROTATED so it NEVER repeats verbatim as the story unfolds (a static line read as a broken loop on the live
// walk — work → marriage → "my marriage" each got the identical question). Capped at GAP_MORE_MAX asks, then
// we reflect and move on (the reflect-confirm is still correctable — she can add more there).
const GAP_MORE_VARIANTS = [
  'Thank you for that. Was there more around that same stretch — other things that landed at the same time — or is that the heart of how it opened?',
  'I hear you. Was anything else tangled up in that same period, or does that capture the shape of how the distance opened?',
  'That helps me understand. Did anything else pile on around then — or do we have the heart of it now?',
];
const GAP_MORE_MAX = GAP_MORE_VARIANTS.length; // after this many "was there more?" asks, reflect instead of re-asking
// How many times we've already asked for more in this gap stage (by the variants' shared signature in history).
function gapMoreAsks(history: ConvMessage[]): number {
  return history.filter((h) => h.role === 'agent' && /\b(was there (more|anything)|anything else|pile on|tangled up)\b/i.test(h.text)).length;
}
function gapMore(history: ConvMessage[]): string {
  return GAP_MORE_VARIANTS[gapMoreAsks(history) % GAP_MORE_VARIANTS.length]!;
}

// FLOOR (Jay+Greg, Jun 26): when there's no real Fade, ADMIT at baseline — don't decline. Honest reflection
// (they're reaching forward, not back), no fabricated fade, then straight into Reclaim. Their ID Score (earned
// later in Reconnect) comes back high; the score tells the truth. Copy is light/tunable, not a release gate.
const FLOOR_REFLECT =
  "It sounds like you're in a genuinely good place — reaching forward more than reaching back, and that's worth " +
  "saying plainly. We'll still map what you want, and your first check-in down the line will show you where " +
  'you’re starting from.';
// The truthful light gap recorded when a no-fade member gives nothing loss-shaped to capture in their words.
const NO_FADE_GAP = 'No significant gap — in a good place, looking to keep building.';

// §5 — Stage 3 (what you want back): the reframe into hope, personalized to their handle.
function reclaimOpen(c: Collected): string {
  return (
    `Now, the good part — let's talk about what you want back. We'll build out your Reclaim List from the things you want ` +
    `back from ${identityRef(c)}'s life — concrete, in your own words. The whole program measures against this list. Three ` +
    'to start, more if they keep coming — and you can edit or add to it any time. What’s the first thing that comes to mind?'
  );
}

const RECLAIM_MORE = 'What else? Anything that comes — big or small.';

// Never-trap nudge: said ONCE when the member signals done below the minimum. It does not re-ask the same
// way — it lowers the bar (small things count) to unlock one more, then the engine stops nudging.
const RECLAIM_NUDGE =
  "Even one or two more — and they can be small: sleeping through the night, an old hobby, a friend you've " +
  'lost touch with, ten quiet minutes that are yours. What comes to mind?';

// §6 — the whole-picture commit gate: the handoff into the confirmation card (the card itself is rendered
// client-side from `collected`; nothing saves until the member confirms).
const COMPLETE_HANDOFF =
  'Great job getting here. Here’s what I’ve captured from our conversation — take a look. Does this look like you? ' +
  'Nothing’s saved yet, so if anything’s missing or off, we’ll fix it.';

// Said when the member has been nudged once and is still closing BELOW the minimum: honor them (Independence
// Guarantee) — never fabricate, never re-ask identically. A warm, non-looping hold that leaves the door open
// for one more without pressure. (The frozen ≥3 floor means we still can't finalize here — see the engine
// note; whether a determined sub-min member can complete is a pending data-contract decision.)
const RECLAIM_SOFT_HOLD =
  "That's a real start, and there's no rush — your list is never locked, and you can add to it any time as " +
  'more comes back to you. If even one more surfaces right now, tell me; if not, that\'s completely okay.';

// §3 — identity transition (reflect + correct-opening): "So — the Cheerleader is who we're bringing back…"
// Natural case for the handle (brand), reading naturally after the dash.
function reflectIdentity(c: Collected): string {
  const label = identityLabel(c.identityNoun) || 'that person';
  return `So — ${label} is who we're bringing back, the version that feels most like you. Did I get her right?`;
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
  if (parked.length === 0) return reclaimOpen(c);
  const items = parked.map((x) => `“${x.trim()}”`).join(parked.length === 2 ? ' and ' : ', ');
  // §5 re-surface — read the parked want(s) back. The single best trust moment: it proves nothing was dropped.
  return (
    `Now, the good part — and you've already started. Earlier you said you want ${items} back, so ` +
    `${parked.length === 1 ? "that's" : "those are"} on your list. What else? Big or small, there are no wrong answers.`
  );
}

// §5 — reflect the Reclaim List back before the card; the member hears their own list, one confirm question.
function reflectReclaim(c: Collected): string {
  const items = (c.reclaimList ?? []).map((x) => `• ${x.trim()}`).join('\n');
  return `Here’s what you want to reclaim:\n\n${items}\n\nAnything missing before we move on?`;
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
// Real loss LANGUAGE, ignoring explicit "no loss / nothing wrong" declarations. Deliberately keyed on loss
// VERBS/events (LOSS_RE), NOT on a Door-name match — "marriage is genuinely good" mentions the word "marriage"
// but is not a loss, and must not read as The Marriage Door / a fade.
function hasGenuineLoss(text: string): boolean {
  return LOSS_RE.test((text ?? '').replace(NO_LOSS_RE, ' '));
}
function isForwardAmbition(text: string): boolean {
  const t = text ?? '';
  if (hasGenuineLoss(t)) return false; // a genuine loss verb wins — a real fade can still say "no crisis"
  return NO_LOSS_RE.test(t) || AMBITION_RE.test(t); // explicit no-fade declaration, or pure forward ambition
}
// For the gap backstop's "is this substantial enough to be a fade" check, a Door match still counts as a loss
// signal (a terse "Knee. Then divorce." names The Marriage) — but only alongside the length/ambition guards
// already in shouldCaptureStagedGap, so a positive Door-name mention can't sneak a gap in on its own.
function hasLossSignal(text: string): boolean {
  return hasGenuineLoss(text) || matchDoors(text ?? '').length > 0;
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
  if (memberDeflecting(m) || isAffirmation(m) || isForwardAmbition(m)) return false; // never grab a wrap/refusal/ambition
  // A clear Door signal IS a fade even in a terse fragment ("Knee. Then divorce." → The Marriage). Capture it
  // regardless of length — otherwise a terse member's whole story (under the char floor) is never captured and
  // they strand. matchDoors is specific, so this fires only on a real recognized event, not noise.
  if (matchDoors(m).length > 0) return true;
  // Otherwise an inferred gap must be a substantial real-fade narrative WITH a loss signal — this is what stops
  // a no-fade optimizer's ambition ("pressure-test my SaaS idea") from being backstopped as a fade.
  if (m.length < STAGED_GAP_MIN_CHARS) return false;
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

// The member signalling the fade story is WHOLE ("that's the whole of it", "no more", "that's how it went").
// Until this fires (or a turn adds nothing new), the gap stage keeps RECEIVING — so a multi-event story fully
// surfaces (and its Doors with it) before we reflect and advance.
const GAP_DONE_RE =
  /\b(that'?s (the )?(whole|all|it|everything|gist|story|picture|heart)|the (whole|full) (story|picture|thing|of it)|no(thing)? (more|else)|no more|that'?s how it (went|happened|unfolded)|that covers it|that'?s about it|that'?s most of it|pretty much it|that'?s the heart)\b/i;
function memberSignalsGapComplete(message: string): boolean {
  const m = (message ?? '').replace(/[‘’]/g, "'");
  return confirmsWhole(m) || memberWantsToWrap(m) || GAP_DONE_RE.test(m);
}

// Every member message so far + the current one — the corpus we scan for Doors. rita reveals her Doors
// PROGRESSIVELY (layoff one turn, the household load another, the parent's illness a third), so scanning only
// the latest message drops the earlier ones. Identity-stage answers don't false-match (matchDoors is specific).
function gapStageCorpus(history: ConvMessage[], current: string): string {
  return [...history.filter((h) => h.role === 'member').map((h) => h.text), current].join(' ');
}

// --- THE STAGED ENGINE (pure, replayable) --------------------------------------------------------------
export function applyStagedTurn(
  state: ConvState,
  history: ConvMessage[],
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

  // SYSTEMIC INVARIANT (the gather-cap): no gather/elaboration stage loops forever. Past the turn budget, FORCE
  // PROGRESS THROUGH THE STAGE MACHINE — bound every gather loop, not just the last. One block for the whole
  // class (gap "was there more?", reclaim "anything else?", the frustrated-deflection loop), replacing the
  // per-stage patches. The card is the seatbelt and still offers "keep talking". Tightrope: it never fabricates
  // (gap-advance needs a real non-ambition gap; completion needs the full finalize floor) and only at turn 20
  // (a member genuinely engaged finishes well under it) — the early-completion / never-trap fixtures stay green.
  const memberTurns = history.filter((h) => h.role === 'member').length + 1;
  if (!awaitingConfirm && memberTurns >= ONBOARDING_FORCE_TURNS) {
    const realGap = gapIsNarrative(collected.gap, collected.reclaimList ?? []) && !isForwardAmbition(collected.gap ?? '');
    // Bound the gap-elaboration loop: a real gap is captured but she keeps elaborating → move on to Reclaim.
    if (stage === 'gap' && realGap) {
      return {
        reply: reclaimOpen(collected),
        state: { stage: 'reclaim', collected, awaitingConfirm: false, identityTurns, reclaimNudged, gapTurns, noFade },
        complete: false,
      };
    }
    // Bound the reclaim loop: capture a want if none has landed yet, then route to the card once card-ready.
    if (stage === 'reclaim') {
      if ((collected.reclaimList?.length ?? 0) < RECLAIM_LIST_FLOOR && shouldCaptureStagedReclaim(memberMessage)) {
        collected.reclaimList = [...(collected.reclaimList ?? []), memberMessage.trim()];
        collected.reclaimCategories = [...(collected.reclaimCategories ?? []), ''];
      }
      if (hasIdentity(collected) && realGap && (collected.reclaimList?.length ?? 0) >= RECLAIM_LIST_FLOOR) {
        return {
          reply: COMPLETE_HANDOFF,
          state: { stage: 'complete', collected, awaitingConfirm: false, identityTurns, reclaimNudged, gapTurns, noFade },
          complete: true,
        };
      }
    }
  }

  let finalReply: string;
  let complete = false;

  if (awaitingConfirm) {
    // Resolving a reflect-confirm: a correction re-opens the stage; anything else advances.
    if (correctsReflection(memberMessage)) {
      awaitingConfirm = false;
      if (stage === 'identity') {
        finalReply = REOPEN_IDENTITY;
      } else if (stage === 'gap') {
        // "No, there's MORE" is the common case here, not "you got it wrong" — rita reveals progressively and
        // says "not just the layoff." NEVER wipe what she gave: if this message is itself more fade narrative,
        // APPEND it and re-derive Doors from the whole corpus, then re-reflect the fuller story. Only a short,
        // pure dispute re-opens — and even then we keep the gap + Doors (the card is the final correction point).
        const modelTaggedGap = model.record?.gap !== undefined && model.record.gap !== '';
        if (modelTaggedGap || shouldCaptureStagedGap(memberMessage)) {
          if (!modelTaggedGap) collected.gap = collected.gap ? `${collected.gap} ${memberMessage.trim()}` : memberMessage.trim();
          collected.doors = augmentDoors(collected.doors ?? [], gapStageCorpus(history, memberMessage));
          finalReply = reflectGap(modelText);
          awaitingConfirm = true; // stay in confirm — they're still telling it
        } else {
          finalReply = REOPEN_GAP; // a short dispute — re-open, but keep the gap + Doors (never drop them)
        }
      } else {
        // Reclaim correction — they want to change the list; stay in reclaim and keep gathering.
        finalReply = modelText && /\?/.test(modelText) ? modelText : RECLAIM_MORE;
      }
    } else {
      stage = nextStagedStage(stage);
      awaitingConfirm = false;
      if (stage === 'gap') finalReply = gapOpen(collected);
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
      finalReply = `${SKIP_ACK}\n\n${gapOpen(collected)}`;
    } else if (collected.identityNoun) {
      // Named — reflect it back warmly and wait for the member's confirm (the transition).
      finalReply = reflectIdentity(collected);
      awaitingConfirm = true;
    } else {
      // Gather. Never-strand: a member who won't name a PAST self (a thriving no-fade optimizer, or just a
      // guarded one) must not loop the opening question forever. Offer the "find it later" skip after a couple
      // of tries even if no past-self was captured, and HARD-ESCAPE after a few — skip identity and move on (it's
      // recovered at Identity Excavation in Reconnect). This is what lets a no-fade member reach the gap-stage
      // floor instead of stalling at the door.
      identityTurns += 1;
      const skipOfferable = identityTurns >= IDENTITY_SKIP_OFFER_AFTER;
      if (identityTurns >= IDENTITY_MAX_TURNS && !collected.athleticPast && !collected.identityNoun) {
        collected.identitySkipped = true;
        stage = 'gap';
        finalReply = `${SKIP_ACK}\n\n${gapOpen(collected)}`;
      } else if (modelText && /\?/.test(modelText)) {
        finalReply = modelText;
      } else if (!collected.athleticPast) {
        finalReply = skipOfferable ? SKIP_OFFER : STAGED_OPENING;
      } else {
        finalReply = skipOfferable ? SKIP_OFFER : NAME_PROMPT;
      }
    }
  } else if (stage === 'gap') {
    // The model's explicit no-fade judgement (note_no_fade) is the PRIMARY signal — it reads "this person has
    // no Fade" far more reliably than any regex. Sticky once set.
    if (model.noFade) noFade = true;
    // FADE GATE. Reject a model-tagged gap that is forward-looking ambition so we never FABRICATE a fade —
    // unless we're admitting at the floor (below), where the member's honest light gap is kept. Reject on
    // AMBITION specifically, not shortness — a terse real fade ("Knee. Then divorce.") must survive.
    if (collected.gap && isForwardAmbition(collected.gap) && !noFade) collected.gap = undefined;
    // Backstop: when the model did NOT tag a (real-fade) set_gap this turn, capture the member's own message as
    // the gap if it reads as a real fade — ACCUMULATE (append) so a progressive revealer's chapters aren't lost.
    const modelTaggedGap = model.record?.gap !== undefined && model.record.gap !== '' && !isForwardAmbition(model.record.gap);
    if (!collected.gap && !noFade && shouldCaptureStagedGap(memberMessage)) {
      collected.gap = memberMessage.trim();
    } else if (collected.gap && !noFade && !modelTaggedGap && shouldCaptureStagedGap(memberMessage)) {
      collected.gap = `${collected.gap} ${memberMessage.trim()}`;
    }
    if (!collected.gap && !noFade) gapTurns += 1; // count gather turns only while no real fade is in hand

    // NEVER-STRAND the gap stage (run-2 fix): after several gap turns with NOTHING captured — a progressive
    // revealer whose short turns each fell under the per-message bar AND the model never tagged — capture the
    // accumulated gap-stage story so we advance instead of looping the opening question for 24 turns. The Doors
    // still come from the whole corpus below; this just rescues the gap TEXT so the stage can close.
    if (!collected.gap && !noFade && gapTurns >= GAP_MAX_TURNS) {
      const corpus = gapStageCorpus(history, memberMessage).trim();
      // Capture the accumulated story even if her LATEST turn is a frustrated deflection ("we already did this,
      // move on") — the earlier turns hold the story; gating on the current message being non-deflecting is what
      // stranded run 5. The !isForwardAmbition(corpus) guard keeps a no-fade ambition corpus out (no-fade is
      // floor-admitted before this anyway).
      if (corpus.length >= 40 && !isForwardAmbition(corpus)) collected.gap = corpus;
    }

    if (noFade || (!collected.gap && isForwardAmbition(memberMessage) && gapTurns >= 2)) {
      // FLOOR (Jay+Greg, Jun 26): no real Fade → ADMIT at baseline, never decline. Keep a light, TRUTHFUL gap
      // (their own no-loss words), clear any incidental Door match ("marriage is good"), and move straight into
      // Reclaim — never fabricate a fade, never strand. The (later) ID Score comes back high; the score tells
      // the truth, we don't.
      noFade = true;
      collected.gap = collected.gap || memberMessage.trim() || NO_FADE_GAP;
      collected.doors = [];
      stage = 'reclaim';
      finalReply = `${FLOOR_REFLECT}\n\n${reclaimOpen(collected)}`;
    } else if (collected.gap) {
      // Real fade. Accumulate Doors across the WHOLE corpus (rita reveals them progressively), and RECEIVE the
      // whole story before reflecting — invite the rest (GAP_MORE) until the member signals it's whole.
      collected.doors = augmentDoors(collected.doors ?? [], gapStageCorpus(history, memberMessage));
      const gapGrew = modelTaggedGap || collected.gap.length > (state.collected.gap?.length ?? 0);
      // Keep gathering only while she's adding AND we haven't already asked for more GAP_MORE_MAX times. Prefer
      // the model's own (varied) question; otherwise a ROTATED nudge (never the same line twice); once we've
      // nudged enough, reflect and move on — the confirm is still correctable.
      if (gapGrew && !memberSignalsGapComplete(memberMessage) && gapMoreAsks(history) < GAP_MORE_MAX) {
        finalReply = modelText && /\?/.test(modelText) ? modelText : gapMore(history);
      } else {
        finalReply = reflectGap(modelText);
        awaitingConfirm = true;
      }
    } else {
      // Still gathering a real fade (no ambition signal yet) — keep the model's question, else hold the gap open.
      finalReply = modelText && /\?/.test(modelText) ? modelText : gapOpen(collected);
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
      // At/above the minimum, below the aim, not explicitly closing. COMPLETE-WHEN-DONE (never force-close):
      // only keep gathering toward ~7 while she's actively ADDING items (grewThisTurn). The moment a turn adds
      // nothing new, she's finished offering — reflect the list and await her confirm (she can still correct or
      // extend; the card is the final seatbelt). This kills the 24-turn loop where a member at 3–6 items never
      // hits an explicit "that's the list" phrasing. It can't over-fire: it requires ≥3 real captured items.
      if (grewThisTurn && count < RECLAIM_LIST_TARGET) {
        finalReply = modelText && /\?/.test(modelText) ? modelText : RECLAIM_MORE;
      } else {
        finalReply = reflectReclaim(collected);
        awaitingConfirm = true;
      }
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

  // GENERAL no-verbatim-repeat guard (the abstraction, not the instance): never emit the exact line we just
  // said. A static opener/nudge falling through twice — STAGED_OPENING after the opening, gapOpen while
  // gathering, GAP_MORE/RECLAIM_MORE — reads as a broken loop and breaks the bar's "never repeat verbatim".
  // GAP_MORE already rotates; this catches every other static fallback in one place. We prepend a short
  // rotating, warm lead so it varies without losing the line's intent. (Only mid-conversation, never on
  // completion or a confirm.)
  if (!complete && !awaitingConfirm && finalReply === lastAgentReply(history)) {
    const leads = ['Take whatever time you need.', 'No rush at all.', "Whenever you're ready.", "There's no wrong way in."];
    finalReply = `${leads[history.length % leads.length]} ${finalReply}`;
  }

  return {
    reply: finalReply,
    state: { stage, collected, awaitingConfirm, identityTurns, reclaimNudged, gapTurns, noFade },
    complete,
  };
}

// The most recent thing the agent said — for the no-verbatim-repeat guard.
function lastAgentReply(history: ConvMessage[]): string | undefined {
  for (let i = history.length - 1; i >= 0; i--) if (history[i]!.role === 'agent') return history[i]!.text;
  return undefined;
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
    name: 'note_no_fade',
    description:
      "Call this when the member genuinely has NO Fade — no loss, no drift, no distance from who they were; they're " +
      'thriving and simply want MORE (optimize, level up, the next challenge). Do NOT fabricate a hardship; mark this ' +
      'instead. They will still be admitted and build a Reclaim List — their first ID Score later just comes back high.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
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
  let noFade = false;
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
      if (b.name === 'note_no_fade') noFade = true;
    }
  }
  return { text, record: rec, noFade };
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
want MORE (optimize, level up, the next challenge) — do NOT call set_gap and do NOT invent a hardship. Instead
call **note_no_fade**. They're still admitted and will build a Reclaim List; their first ID Score (later) just
comes back high. Reflect warmly that they sound like they're in a good place, and move on to what they want.

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
