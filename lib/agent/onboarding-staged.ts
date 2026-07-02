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
// 'declined' is a terminal OFF-RAMP (not in the sequential order): a genuinely-thriving no-fade member is
// gracefully declined (Decision E), out of scope, no card. It is never a `nextStagedStage` target.
type StagedStage = 'identity' | 'gap' | 'reclaim' | 'complete' | 'declined';
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
// v2.1 model-judged gap depth (bring back v1's drawing-out). Once the gap story is in hand, the MODEL owns when
// it's drawn out enough (it calls reflect_gap), bounded by the engine: a FLOOR — never close before this many
// drawing-out exchanges even if the model rushes — and a CAP — always close by this many (anti-loop). No
// richness proxy (door-count / length): depth is judgment, the floor/cap bound the error, the card corrects.
const GAP_MIN_DEPTH = 2;
const GAP_MAX_DEPTH = 5;
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

// The breathe-floor probe (Increment 1a): when a name lands but the person hasn't been drawn out yet,
// draw them out once before reflecting it back. (Directional voice — refined in 1b.)
function identityProbe(c: Collected): string {
  const label = identityLabel(c.identityNoun) || 'that person';
  return `Before we hold onto that word — take me back into being ${label}. What did it actually feel like, and when did it feel most true?`;
}

// The conditional SECOND probe (1b tuning / Decision S — "the net"): fires ONLY when the material is still
// thin after probe 1. It goes smaller and more concrete — a single ordinary moment, a sensory detail, a
// contrast — never re-asking probe 1, warm and low-pressure. At most one; then the terse-escape moves on.
function identityProbe2(c: Collected): string {
  const label = identityLabel(c.identityNoun) || 'that person';
  return `Even one small moment is enough — a specific morning, a feeling in your body — when you were most ${label}. What did being ${label} give you that you don't feel now? Even a little thing; there's no wrong answer.`;
}

// §4 — Stage 2 (how the gap opened): introduces "Doors" at first use, personalized to their handle.
function gapOpen(c: Collected): string {
  return (
    `Somewhere, the distance between you and ${identityRef(c)} started to open. Sometimes it's one clear thing — a loss, ` +
    'a diagnosis, a move, a job that swallowed you. More often it’s slower: an accumulation of what we call Doors — moments ' +
    'and seasons you walk through and barely notice, each one widening the gap. What’s been happening that caused that ' +
    'version of you to Fade? Tell me how it went for you.'
  );
}

// §4 bridge (Increment 1b): when identity was NAMED and drawn out, the gap emerges FROM that conversation on
// its own momentum (Scott's "natural connection") — turn the person they just painted into the how-did-you-
// lose-her question, not a cold topic switch. Still introduces "Doors" at first use (terminology governance).
// Falls back to the standalone gapOpen when identity was skipped (no name to bridge from).
function gapBridge(c: Collected): string {
  if (!c.identityNoun) return gapOpen(c);
  const label = identityLabel(c.identityNoun) || 'that person';
  return (
    `Then let's find out what happened to ${label}. The distance from ${label} rarely opens all at once — more often ` +
    `it's an accumulation of what we call Doors: moments and seasons you walk through and barely notice, each one ` +
    `widening the gap. So how did it go — what pulled you away from ${label}? Take me through it.`
  );
}

// Reflect-confirm copy for the gap. We lead with the model's OWN warm reflection of what they just told us
// (it just heard the whole story); the forecast sets the lighter-Door expectation (receive, don't excavate)
// that the specific Doors get a dedicated session later; one confirm question, never a Y/N gate. (§4)
const GAP_REFLECT_LEAD = "Thank you for trusting me with that — that kind of distance rarely opens all at once.";
// Warm, clear, invites correction — replaces the old "for now this is plenty / we'll go deeper later / did I
// understand the shape of how it went?" which read as dismissive AND generic on Jay's walk (he replied "the
// shape of what?"). Under the model-judged flow the LEAD is the model's own drawn-out reflection in their words.
const GAP_FORECAST_CONFIRM = 'Have we got a good handle on how it all happened — or is there more to it?';
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

// DECISION E FORK (v2.1, Increment 2) — supersedes the Jun-26 admit-at-floor + `note_no_fade`. A "no obvious
// fade event" member is TWO cases: RESIGNED to age-decline ("this is just who I am now", "at my age") → The
// Acceptance Door, a real quiet Fade served via the normal path; GENUINELY THRIVING (forward optimizer, no loss,
// no resignation) → gracefully DECLINED, out of scope, door left open. We never fabricate a fade to admit a
// thriving member — the honest, non-pathologizing move is to say this isn't their season yet.
const DECLINE_REPLY =
  "Honestly? From everything you've shared, you're not carrying the kind of distance this program is built for — " +
  "you're reaching forward, not trying to find your way back to someone you've lost. That's a genuinely good place " +
  "to be, and it would be dishonest of me to manufacture a problem you don't have. G4L is for the season when that " +
  'changes — when something real has pulled you away from who you were. If that day comes, this door stays open ' +
  "and I'll be right here. Until then — keep building.";

// Decision E fork signals, read from the whole gap-stage corpus (resignation can reveal progressively).
function isAcceptanceFade(text: string): boolean {
  return matchDoors(text ?? '').includes('acceptance'); // resignation to age-decline = The Acceptance (a REAL Fade)
}

// §5 — Stage 3 (what you want back): the reframe into hope, personalized to their handle.
function reclaimOpen(c: Collected): string {
  return (
    `Now, the good part — let's talk about what you want back. We'll build your Reclaim List from the things you want ` +
    `back from ${identityRef(c)}'s life — concrete, in your own words. The whole program measures against this list, and ` +
    'you can add to it or edit it any time. What’s the first thing you want back?'
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
  // Substantive reflection (1b): name the SPECIFICS the member gave, in their own words — not a hollow restate
  // ("so, the Athlete, got it"), which is a race in the floor's clothing. Thin capture → visibly thin
  // reflection → the member sees it's off and corrects: the quality is self-policing, not an extra gate.
  // De-gendered (1b): reference the identity by name, never a guessed pronoun ("her" was wrong for a male member).
  const specifics = (c.athleticPast ?? '').trim();
  if (specifics) {
    return `So — ${label} is who we're bringing back — “${specifics}.” That's the version that feels most like you. Did I get ${label} right?`;
  }
  return `So — ${label} is who we're bringing back, the version that feels most like you. Did I get ${label} right?`;
}

// Ensure a turn ENDS on a real forward question (bar: always be correctable / keep the conversation going).
// The old `/\?/.test(modelText)` guard passed a rhetorical mid-sentence "…were they?" and then let the reply
// trail off into a statement with nothing to answer (Jay's walk: the reflection dead-ended). This keeps the
// model's reflection AND guarantees a closing question: model ends on a question → use it; model reflected but
// trailed into a statement → keep it, append the stage probe; nothing usable → the probe alone.
function withQuestion(modelText: string, probe: string): string {
  const t = (modelText ?? '').trim();
  if (!t) return probe;
  if (/\?\s*$/.test(t)) return t; // already ends on a question — the model led the turn
  return `${t}\n\n${probe}`; // a reflection with no forward question — add one
}

// The model's reflect_gap turn IS the reflection: the prompt tells it to reflect the WHOLE story back in the
// member's words and ask a correctable question on that same turn. So TRUST it — don't overwrite it with an
// engine-built lead. (Jay's walk: the engine threw away the model's rich reflection because it contained a "?"
// and read back the stalest early gap fragment — "Well, I got married and had kids" — dropping everything just
// drawn out. Never read a stale fragment back as "here's what I'm holding.")
function reflectGap(modelText: string): string {
  const t = (modelText ?? '').trim();
  if (t && /\?\s*$/.test(t)) return t; // reflected AND invited correction — use the whole turn
  if (t) return `${t}\n\n${GAP_FORECAST_CONFIRM}`; // reflected but didn't invite correction — add the confirm
  return `${GAP_REFLECT_LEAD}\n\n${GAP_FORECAST_CONFIRM}`; // no usable reflection — warm canned lead, not a fragment
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
  // Strip ALL "no loss / no drift" declarations (global), not just the first — a corpus can repeat them
  // ("nothing went wrong … no loss or drift here"), and a leftover "no loss" would trip LOSS_RE below.
  return LOSS_RE.test((text ?? '').replace(new RegExp(NO_LOSS_RE.source, NO_LOSS_RE.flags + 'g'), ' '));
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

// --- reclaim de-duplication (Jay's walk: "Ride my bike more" ×2, "lose 25 lbs" twice) -------------------
// Two capture paths run per turn — the model's add_reclaim_item AND the engine's backstop / confirm late-add —
// and a re-tag of an already-listed want double-adds it. A single normalized key (case/punctuation-insensitive)
// is the one place we decide "same want," so every append point stays deduped. It keeps the FIRST phrasing.
function reclaimKey(s: string): string {
  return (s ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
// Append a want to `c` only if it isn't already on the list (normalized). Returns whether it actually landed —
// so the gather stage can tell a real new offer from a duplicate and NOT read the dup as a "done" signal.
function appendReclaim(c: Collected, item: string, category = ''): boolean {
  const key = reclaimKey(item);
  if (!key) return false;
  if ((c.reclaimList ?? []).some((x) => reclaimKey(x) === key)) return false;
  c.reclaimList = [...(c.reclaimList ?? []), item.trim()];
  c.reclaimCategories = [...(c.reclaimCategories ?? []), category];
  return true;
}

// --- capture merge (the per-field tools' result, merged into Collected) ---------------------------------
// The model's turn carries the per-field captures already merged into a Partial<Collected> (parseStagedTurn
// does this on the live path; fixtures provide it directly). Only the early-beat fields exist in slice a.
function mergeStaged(prev: Collected, rec?: Partial<Collected>): Collected {
  if (!rec) return prev;
  const next: Collected = {
    ...prev,
    ...(rec.athleticPast !== undefined && { athleticPast: rec.athleticPast }),
    ...(rec.identityNoun !== undefined && rec.identityNoun !== '' && { identityNoun: displayIdentityNoun(rec.identityNoun) }),
    ...(rec.identitySkipped === true && { identitySkipped: true }),
    ...(rec.gap !== undefined && rec.gap !== '' && { gap: rec.gap }),
    // Doors accumulate — one note_door call per Door; union with what we already have (never drop one).
    ...(rec.doors !== undefined && { doors: Array.from(new Set<DoorSlug>([...(prev.doors ?? []), ...rec.doors])) }),
  };
  // Reclaim items accumulate in lockstep with their categories, DEDUPED — an item volunteered early (front-loader)
  // parks here in the moment (never lost, re-surfaced at its stage), and a model re-tag of a listed want is a no-op.
  if (rec.reclaimList !== undefined) {
    rec.reclaimList.forEach((item, i) => appendReclaim(next, item, rec.reclaimCategories?.[i] ?? ''));
  }
  return next;
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
  /\b(that'?s (actually |really |pretty much |honestly )?(it|all|everything|the list)|those are (the )?(real|only|main|biggest) ones|that'?s (my|the) (real )?list|the (real )?list( is)?( complete| done| it)?|i'?m (good|done|ready)|i'?ve (answered|said|told you)|(let'?s |can we )?(move on|moving on|move forward|keep going)|i'?m (stepping away|not answering|done answering)|(that )?(about )?sums it up|that'?ll do|that covers it|(that'?s )?(a )?(pretty |fairly )?(solid|good|decent|fair|great) (start|list)|good enough)\b/i;
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

// At the gap reflect-confirm we ask "…does it land, or is there more to it?" — so an answer that ADDS material
// ("yeah, there was work too") is a MORE signal, NOT a move-on. The old engine advanced on anything that wasn't
// a textual CORRECTION, so this invited-more got read as confirmation → premature jump to Reclaim → the model
// backtracked to explore the thread while the engine thought it was in Reclaim → gap answers polluted the list
// (Jay's walk points 3/5/6). Detect it and STAY: not a clean close, not a bare acknowledgement, and the residual
// after stripping the leading "yeah/yes" is substantive (and not a short "that lands"-style confirmation). Bias
// to stay — drawing out one more thread is cheap (bounded by GAP_MAX_DEPTH); advancing early is the harm.
// Detection = strip the acknowledgement, see what's LEFT. A confirmation ("yes, you've got it", "that lands",
// "exactly right") is nothing but affirmation + a meta-acknowledgement — stripping both leaves no content word.
// An addition ("yeah, there was work too", "and my mom got sick") leaves a real topic behind. This is more
// robust than a length threshold (a short confirm and a short addition are the same length) and doesn't need a
// growing list of "more"-phrases — it recognises the closed set of confirmations and treats everything else as
// still-telling-it. (bias to STAY: a false stay costs one bounded draw-out turn; a false advance desyncs.)
const AFFIRM_PREFIX_RE =
  /^(yeah|yes|yep|yup|sure|ok(ay)?|right|true|correct|exactly|totally|definitely|absolutely|for sure|i guess|kind of|sort of|mm+|uh[ -]?huh)[\s,.!—–-]*/i;
const GAP_CONFIRM_WORDS_RE =
  /\b(you'?(ve|d| have)?\s*(got|nailed)\s*(it|that)|that'?s (it|right|me|correct|the one|spot on)|(it|that) (lands|fits|works|tracks)|spot on|exactly( right)?|absolutely|totally|definitely|perfect(ly)?|precisely|nailed it|got it|makes sense|understood)\b/gi;
function memberAddingMoreGap(message: string): boolean {
  const m = (message ?? '').replace(/[‘’]/g, "'").trim();
  if (!m) return false;
  if (memberSignalsGapComplete(m)) return false; // "that's it / no more / that's the whole of it" → advance
  const residual = m
    .replace(AFFIRM_PREFIX_RE, '')
    .replace(GAP_CONFIRM_WORDS_RE, ' ')
    .replace(/[^a-z]+/gi, ' ')
    .trim();
  return residual.split(/\s+/).some((w) => w.length >= 3); // a real content word remains → still telling it → STAY
}

// Every member message so far + the current one — the corpus we scan for Doors. rita reveals her Doors
// PROGRESSIVELY (layoff one turn, the household load another, the parent's illness a third), so scanning only
// the latest message drops the earlier ones. Identity-stage answers don't false-match (matchDoors is specific).
function gapStageCorpus(history: ConvMessage[], current: string): string {
  return [...history.filter((h) => h.role === 'member').map((h) => h.text), current].join(' ');
}

// --- The per-stage BREATHE FLOOR (Increment 1a) --------------------------------------------------------
// Generalizes v1's DOOR_MIN_TURNS (the Door-beat "breathe" floor, onboarding.ts:158) across identity/gap/
// reclaim: a stage may advance to its reflect-confirm only once it has BREATHED — the Companion drew the
// member out past their first answer — UNLESS an escape fires. Per §7a-flag-1 the ESCAPES are the load-
// bearing part (naive floors re-create the stalls the caps were built to kill), and they are keyed to
// MATERIAL RICHNESS, never a turn clock — so the floor never traps the front-loader (gives everything in
// one pass) or the terse member (won't give more after honest invitation). Pure + replayable.

// How rich a one-pass answer must be to count as "already drawn out" (the front-loader escape). Length is a
// deliberately crude proxy for 1a's mechanics; 1b refines what "rich" means (named specifics, not chars).
const IDENTITY_RICH_CHARS = 90;
const GAP_RICH_CHARS = 240; // mirrors v1's storyIsRich threshold exactly (resolveCompletion, onboarding.ts)

// ESCAPE 1 — ALREADY-SATISFIED (the front-loader): the material is already rich enough that another probe
// would trap someone who's ready. "Rich" is MORE than merely present.
function stageMaterialRich(stage: StagedStage, c: Collected): boolean {
  if (stage === 'identity') return !!c.identityNoun && (c.athleticPast ?? '').trim().length >= IDENTITY_RICH_CHARS;
  if (stage === 'gap')
    return gapIsNarrative(c.gap, c.reclaimList ?? []) && ((c.doors?.length ?? 0) >= 2 || (c.gap ?? '').length >= GAP_RICH_CHARS);
  return (c.reclaimList?.length ?? 0) >= RECLAIM_LIST_MIN; // several wants already on the table
}

// ESCAPE 2 — MEMBER-PUSHED-PAST (the terse member): after an honest invitation they decline / signal done /
// won't add more. Advancing here honors them instead of trapping — the analog of v1's `memberDone`.
function memberPushedPast(stage: StagedStage, message: string, c: Collected): boolean {
  if (stage === 'identity') return c.identitySkipped === true || memberDeflecting(message);
  if (stage === 'gap') return memberSignalsGapComplete(message) || memberDeflecting(message);
  return memberClosingReclaim(message);
}

// The two ESCAPE predicates above (`stageMaterialRich` + `memberPushedPast`) are the shared, uniform contract
// across all three stages — every stage advances the moment either fires, so the floor never traps the front-
// loader or the terse member. The FLOOR itself (how long a stage draws out before those escapes) is per-stage:
// identity = up to two probes (Decision S "the net"); gap = invite-until-whole (GAP_MORE); reclaim = gather to
// the aim (MIN/nudge/complete-when-done). Same escapes, stage-appropriate drawing-out.

// --- THE STAGED ENGINE (pure, replayable) --------------------------------------------------------------
export function applyStagedTurn(
  state: ConvState,
  history: ConvMessage[],
  memberMessage: string,
  model: ModelTurn,
): Turn {
  const collected = mergeStaged({ ...state.collected }, model.record);
  // Light-touch measurability (Decision: reclaim items should land concrete/trackable). The model sharpens a
  // vague want by REPLACING its most-recent item in place — never a second entry. Dedupe after, in case the
  // sharpened text collides with an earlier want.
  const refinedThisTurn = !!model.refineReclaim && (collected.reclaimList?.length ?? 0) > 0;
  if (refinedThisTurn) {
    const list = [...collected.reclaimList!];
    list[list.length - 1] = model.refineReclaim!.trim();
    const seen = new Set<string>();
    const cats = collected.reclaimCategories ?? [];
    const keptCats: string[] = [];
    collected.reclaimList = list.filter((item, i) => {
      const k = reclaimKey(item);
      if (seen.has(k)) return false;
      seen.add(k);
      keptCats.push(cats[i] ?? '');
      return true;
    });
    collected.reclaimCategories = keptCats;
  }
  let stage = (state.stage ?? 'identity') as StagedStage;
  let awaitingConfirm = state.awaitingConfirm ?? false;
  let identityTurns = state.identityTurns ?? 0;
  let reclaimNudged = state.reclaimNudged ?? false;
  let gapTurns = state.gapTurns ?? 0;
  let noFade = state.noFade ?? false;
  let identityProbes = state.identityProbes ?? 0;
  let gapDepth = state.gapDepth ?? 0;
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
        appendReclaim(collected, memberMessage);
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
    // RECLAIM late-add (v2.1 fix): a want volunteered AT the confirm — Jay's "play golf on weekends" — is
    // neither a correction nor an affirmation, so it used to be dropped as the beat advanced to the card.
    // Capture it and re-reflect the fuller list. Only when genuinely OFFERING (not closing / affirming /
    // correcting) — the same offering guard the gather stage uses, so "yes, that's it" still advances.
    if (
      stage === 'reclaim' &&
      !refinedThisTurn && // a sharpening answer isn't a new want
      !correctsReflection(memberMessage) &&
      !memberClosingReclaim(memberMessage) &&
      shouldCaptureStagedReclaim(memberMessage) &&
      appendReclaim(collected, memberMessage) // only a genuinely NEW want re-opens the confirm (deduped)
    ) {
      finalReply = reflectReclaim(collected);
      awaitingConfirm = true; // stay in confirm — re-reflect with the just-added want included
      // fall through to the shared return
    } else if (stage === 'gap' && !correctsReflection(memberMessage) && memberAddingMoreGap(memberMessage)) {
      // GAP late-add (v2.1 fix — Jay's walk points 3/5/6): the confirm invited "is there more?" and they gave
      // more ("yeah, there was work too"). NEVER advance on invited more — append it, re-derive Doors from the
      // whole corpus, and go back to DRAWING IT OUT (not straight to re-reflect: we haven't explored the new
      // thread yet). The model's own follow-up carries the beat; the engine only nudges if it gave no question.
      const modelTaggedGap = model.record?.gap !== undefined && model.record.gap !== '';
      if (!modelTaggedGap) collected.gap = collected.gap ? `${collected.gap} ${memberMessage.trim()}` : memberMessage.trim();
      collected.doors = augmentDoors(collected.doors ?? [], gapStageCorpus(history, memberMessage));
      awaitingConfirm = false; // re-open the gap draw for the new thread
      finalReply = withQuestion(modelText, gapMore(history));
    } else if (correctsReflection(memberMessage)) {
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
        finalReply = withQuestion(modelText, RECLAIM_MORE);
      }
    } else {
      stage = nextStagedStage(stage);
      awaitingConfirm = false;
      if (stage === 'gap') finalReply = gapBridge(collected); // 1b: bridge from the named identity, not a cold switch
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
      // BREATHE FLOOR (1a) + the conditional second probe (1b / Decision S). Reflect once the material is RICH
      // (front-loader escape), the member PUSHES PAST (terse escape), or we've drawn out enough: a general probe,
      // then ONE smaller/concrete probe if STILL thin — capped at 2 so it never loops or re-asks. This is the
      // expanded drawing-out identity gets (Scott's "rushed"); the escapes keep it off the front-loader/terse.
      const rich = stageMaterialRich('identity', collected);
      const pushed = memberPushedPast('identity', memberMessage, collected);
      if (rich || pushed || identityProbes >= 2) {
        finalReply = reflectIdentity(collected);
        awaitingConfirm = true;
      } else {
        identityProbes += 1;
        // probe 1 = the general draw; probe 2 = smaller + concrete (never re-asking probe 1). Prefer the model's
        // own drawing-out question when it asked one.
        const probe = identityProbes === 1 ? identityProbe(collected) : identityProbe2(collected);
        finalReply = withQuestion(modelText, probe);
      }
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
      } else {
        // Keep the model's reflection and guarantee a closing question (withQuestion). The probe it falls back to
        // depends on what's still missing: the past self (opening) or the handle (name prompt), softened to the
        // "find it later" skip offer once we've asked a couple of times.
        const probe = !collected.athleticPast ? (skipOfferable ? SKIP_OFFER : STAGED_OPENING) : skipOfferable ? SKIP_OFFER : NAME_PROMPT;
        finalReply = withQuestion(modelText, probe);
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

    // DECISION E FORK (Increment 2): resolve a "no obvious fade event" member from the whole gap-stage corpus.
    const gapCorpus = gapStageCorpus(history, memberMessage);
    if (isAcceptanceFade(gapCorpus)) {
      // RESIGNED to age-decline → The Acceptance Door: a real, quiet Fade. NOT no-fade — clear the flag, make
      // sure their own words are captured as the gap, and fall through to the normal real-fade reflect/advance
      // below (augmentDoors tags 'acceptance'). Never decline, never admit-at-floor.
      noFade = false;
      if (!collected.gap) collected.gap = memberMessage.trim() || gapCorpus.trim();
    }
    // GENUINELY THRIVING → graceful DECLINE (Decision E supersedes the Jun-26 admit-at-floor). Fires when there's
    // NO real-fade signal anywhere (no genuine loss, no resignation/Acceptance) AND either the model judged no-fade
    // (trusted even over an incidentally-tagged prose "gap" like "career/marriage/kids are great"), or the member's
    // own words are pure forward-ambition with nothing captured after a couple turns (the conservative path).
    const noRealFadeSignal = !isAcceptanceFade(gapCorpus) && !hasGenuineLoss(gapCorpus);
    const thrivingDecline =
      noRealFadeSignal && (noFade || (isForwardAmbition(memberMessage) && !collected.gap && gapTurns >= 2));
    if (thrivingDecline) {
      // Out of scope; the door stays open. Terminal — no card, no reclaim. We never fabricate a fade to admit them.
      return {
        reply: DECLINE_REPLY,
        state: { stage: 'declined', collected, awaitingConfirm: false, identityTurns, reclaimNudged, gapTurns, noFade, declined: true },
        complete: false,
        declined: true,
      };
    }
    if (collected.gap) {
      // Real fade. Accumulate Doors across the WHOLE corpus (rita reveals them progressively), and RECEIVE the
      // whole story before reflecting — invite the rest (GAP_MORE) until the member signals it's whole.
      collected.doors = augmentDoors(collected.doors ?? [], gapStageCorpus(history, memberMessage));
      gapDepth += 1; // one more drawing-out exchange with the story in hand
      // MODEL-JUDGED advance (v2.1 — bring back v1's drawing-out). The MODEL decides when the story is genuinely
      // drawn out (it calls reflect_gap), NOT an engine richness heuristic — door-count and length are proxies,
      // and proxies leak (the whole lesson of v2.0's field-count and v2.1's door-count). The engine only BOUNDS
      // the judgment: a FLOOR (never close before GAP_MIN_DEPTH real exchanges, so a rushing model can't wrap on
      // two brief mentions) and a CAP (close by GAP_MAX_DEPTH — anti-loop). A member close overrides; the
      // substantive reflection quotes their words, and the card is the correction backstop.
      const modelJudgedDone = model.gapReady && gapDepth >= GAP_MIN_DEPTH;
      const advance = modelJudgedDone || memberPushedPast('gap', memberMessage, collected) || gapDepth >= GAP_MAX_DEPTH;
      if (!advance) {
        // Keep drawing out — follow the model's depth question (it's exploring HOW it opened). Its own reflection
        // carries the beat; withQuestion guarantees it ends on a forward question, nudging with gapMore if not.
        finalReply = withQuestion(modelText, gapMore(history));
      } else {
        finalReply = reflectGap(modelText);
        awaitingConfirm = true;
      }
    } else {
      // Still gathering a real fade (no ambition signal yet) — keep the model's question, else hold the gap open.
      finalReply = withQuestion(modelText, gapOpen(collected));
    }
  } else if (stage === 'reclaim') {
    // Uniform floor+escape (1b): reclaim's drawing-out is "gather toward the aim." Its two escapes are the
    // shared ones — ALREADY-SATISFIED = stageMaterialRich('reclaim') (≥ the min wants on the table) and
    // MEMBER-PUSHED-PAST = memberPushedPast('reclaim') (the member is closing). Same predicates as identity/gap.
    const closing = memberPushedPast('reclaim', memberMessage, collected);
    // The member put a want FORWARD this turn (new or a restatement) — distinct from closing/refusing. This is
    // the "still in flow" signal, separate from whether the list actually grew (a dup offer keeps them in flow).
    const offered = !closing && shouldCaptureStagedReclaim(memberMessage);
    const priorLen = state.collected.reclaimList?.length ?? 0;
    const modelCaptured = (collected.reclaimList?.length ?? 0) > priorLen; // the model's add_reclaim_item already landed
    // Backstop: capture an untagged want ONLY when the member offered AND the model did NOT already tag it — else
    // we'd double-add the same want in two phrasings ("riding again" + "I want to ride again"). appendReclaim also
    // dedupes exact restatements across turns, so a re-said want is a safe no-op — never a second "Ride my bike more".
    // Skip when the turn REFINED a want (the member's message was the sharpening answer, already folded in).
    if (offered && !modelCaptured && !refinedThisTurn) appendReclaim(collected, memberMessage);
    const count = collected.reclaimList?.length ?? 0;
    const grewThisTurn = count > priorLen; // a NEW unique want landed this turn (model or backstop)
    // Cap runaway capture: once at the soft aim (~7), stop asking "what else?" and move to confirm — this is
    // what kept a verbose persona from ballooning to 17–21 items.
    if (count >= RECLAIM_LIST_TARGET || (count >= RECLAIM_LIST_MIN && closing)) {
      // Aim reached, OR the member has met the minimum and is closing — reflect the whole list and confirm.
      finalReply = reflectReclaim(collected);
      awaitingConfirm = true;
    } else if (count >= RECLAIM_LIST_MIN) {
      // At/above the minimum, below the aim, not explicitly closing. COMPLETE-WHEN-DONE (never force-close):
      // keep gathering toward ~7 while she's still OFFERING — a new item OR a restatement (a dup must NOT pull
      // the list up short; Jay's walk). Only when a turn brings nothing at all (not offering, not growing) is
      // she finished — reflect the list and await her confirm (she can still correct or extend; card is the
      // seatbelt). This kills the 24-turn loop where a member at 3–6 items never says "that's the list".
      if ((grewThisTurn || offered) && count < RECLAIM_LIST_TARGET) {
        finalReply = withQuestion(modelText, RECLAIM_MORE);
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
      // Still offering — keep the model's reflection and guarantee a closing question; else invite the next item.
      finalReply = withQuestion(modelText, RECLAIM_MORE);
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
    state: { stage, collected, awaitingConfirm, identityTurns, identityProbes, reclaimNudged, gapTurns, gapDepth, noFade },
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
    name: 'reflect_gap',
    description:
      "Call this ONLY once you have genuinely DRAWN OUT the fade story — never on the first mention of what happened. " +
      "It means: you explored HOW the distance opened (the sequence, when they first felt it, what it quietly cost " +
      "them), stayed with one thread until it's particular and real, and checked whether more than one Door stacked " +
      "on. It signals you're ready to reflect their WHOLE story back in their own words and move on. Naming several " +
      "things briefly ('married, kids, work') is BREADTH, not depth — do NOT call this until you have something " +
      "specific and true to reflect. (The system won't let you close the beat before it has genuinely breathed.)",
    input_schema: { type: 'object' as const, properties: {}, required: [] },
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
  {
    name: 'refine_reclaim_item',
    description:
      "REPLACE the reclaim item you MOST RECENTLY added with a sharper, more concrete version — use this after you " +
      "gently drew the member toward something they could actually notice progress on (a cadence, a number, a specific " +
      "anchor: 'ride my bike more' → 'ride my bike a couple times a week'). Pass the WHOLE new phrasing in `text`, in " +
      "their words. This updates the item in place — it does NOT add a second one. Only use it to sharpen the last " +
      "item; use add_reclaim_item for a genuinely new want.",
    input_schema: { type: 'object' as const, properties: { text: { type: 'string' } }, required: ['text'] },
  },
];

// Parse a staged model response (per-field tool calls) into the merged Partial<Collected> the engine reads.
export function parseStagedTurn(content: readonly unknown[]): ModelTurn {
  let text = '';
  let noFade = false;
  let gapReady = false;
  let refineReclaim: string | undefined;
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
      if (b.name === 'refine_reclaim_item' && typeof b.input?.text === 'string') refineReclaim = b.input.text;
      if (b.name === 'note_no_fade') noFade = true;
      if (b.name === 'reflect_gap') gapReady = true;
    }
  }
  return { text, record: rec, noFade, gapReady, refineReclaim };
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

GAP STAGE ("how it opened") — the most important, most vulnerable beat. EXPLORE it; do not just receive it.
Open with a real question about how the distance opened, then have a CONVERSATION, not a form: follow up to
understand HOW it unfolded — the sequence, when they first felt it, what it quietly cost them — reflecting
their own words back. DEPTH is the goal, not moving on. Naming several things briefly ("married, kids, work")
is BREADTH, not depth — keep pulling into ONE thread until it's particular and real: a specific moment, what
it felt like, what it took from them. Draw out the thread THEY lean into, in THEIR words — never invent a
connecting thread or add a detail they didn't give (if they named travel, friends, and competing, don't
quietly collapse it to one and pin "the body" on them). Stay with their story for two or three exchanges;
don't rush to wrap it.
The Fade is usually more than one Door — once you understand the first, check ONCE whether another stacked on
("was that the whole of it, or did something else pile on around then?"), then let it be. Capture the story
with set_gap as it grows.
ONLY when you have GENUINELY drawn it out — something specific and true you can reflect back in their own words —
call reflect_gap to close the beat, and on that same turn reflect their WHOLE story back in two or three
sentences, in their words. NEVER call reflect_gap on the first mention of what happened. (The engine holds the
beat open until it has breathed and caps it so it never drags — you own the depth call between those bounds.)
TAGGING DOORS — do this silently as the story comes out, NOT by interrogating: call note_door ONCE for EACH
distinct life event you recognize. A story can carry several. Map by meaning, in their own words:
  • a job ending / being laid off / a layoff / forced out / a role hollowing out → career_cliff
  • work/ambition that GREW until it crowded out the self → grind
  • being the one carrying the household / the bills / the breadwinner / a partner who didn't step up → load_bearer
  • caring for a parent / a parent's health crisis or decline (a coma, getting sick, declining) → aging_parents
  • kids leaving / the house going quiet → empty_nest;  young kids + marriage, no room for you → full_house
  • a diagnosis / health scare → diagnosis;  the body saying no → body
  • a divorce or a marriage drifting into coexisting → marriage
  • losing someone close (death) → loss;  friendships/social world fading → vanishing
Tag what's THERE — zero is fine (recognition, not routing), and never force one. But do not let a clearly-
named event go un-tagged. Depth means going deeper into the story they gave, NOT interrogating for more Doors —
don't turn it into a checklist. One Door, several, or none are all complete.
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
      '\n\nCURRENT STAGE: how the gap opened. EXPLORE — draw out the story over a few exchanges (the sequence, ' +
      'when they first felt it, what it cost); pull into one thread until it\'s particular, not a list of labels. ' +
      'Capture with set_gap as it grows, note_door silently (none is valid). Call reflect_gap ONLY once it\'s ' +
      'genuinely drawn out, and reflect their whole story back in their words on that turn.'
    );
  if (stage === 'reclaim')
    return (
      '\n\nCURRENT STAGE: what they want back. Invite the things they want to reclaim and call add_reclaim_item ' +
      'once per item (big or small — there are no wrong answers). If they already named some earlier, build on ' +
      "those, don't re-ask. Aim for a few; never pressure or interrogate — small things count.\n" +
      'MAKE EACH WANT CONCRETE (light touch): a Reclaim item should be something they could actually notice ' +
      'progress on. When a want is vague ("ride my bike more", "get in shape"), reflect it and ask ONE gentle ' +
      'question toward something trackable — a rough cadence, a number, a specific anchor ("what would that look ' +
      'like — a couple rides a week? weekends?"). Then call refine_reclaim_item with the sharper phrasing IN ' +
      'THEIR WORDS to replace the vague one (do NOT add a second item). Take whatever they give — if they stay ' +
      "general, that's fine; never force a metric, never turn it into a form, at most ONE sharpening per want. " +
      'Already-concrete wants ("lose 25 lbs") need no sharpening — leave them.'
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
