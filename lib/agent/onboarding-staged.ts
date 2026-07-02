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
  stripLeadingDisclosure,
  type Collected,
  type ConvMessage,
  type ConvState,
  type Ctx,
  type ModelTurn,
  type Stage,
  type Turn,
} from './onboarding.ts';
// The intent layer — the one place that decides what a member's utterance MEANS (see onboarding-intent.ts).
import {
  correctsReflection,
  hasGenuineLoss,
  isAcceptanceFade,
  isForwardAmbition,
  memberClosingReclaim,
  memberDeflecting,
  memberSignalsGapComplete,
  resolveGapConfirm,
  resolveReclaimConfirm,
  shouldCaptureStagedGap,
  shouldCaptureStagedReclaim,
} from './onboarding-intent.ts';

// Re-exported so existing callers/tests can keep importing it from the engine surface.
export { correctsReflection };

const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// --- stage identifiers ---------------------------------------------------------------------------------
// The onboarding arc's stages. 'declined' is a terminal OFF-RAMP (a genuinely-thriving no-fade member is
// gracefully declined, Decision E — out of scope, no card). Advancement is now owned by the stage handlers
// (each sets the next stage explicitly via its opener), so there's no central STAGE_ORDER walker any more.
type StagedStage = 'identity' | 'gap' | 'reclaim' | 'complete' | 'declined';

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
// SYSTEMIC INVARIANT — no gather stage loops unbounded. But the trigger is STALL, not length: a verbose, engaged
// member (Scott, Blake — getting real value from a long conversation) must NOT be force-completed just for being
// long. So we force progress to the card only when the member has actually gone quiet — IDLE_LIMIT consecutive
// turns adding nothing new — OR at a high absolute ceiling that only a pathological loop / abuse would reach. The
// idle counter resets to 0 the moment they contribute again, so engagement is never punished; the card still
// lets them keep talking. (Replaces the blunt fixed turn-cap, which cut off exactly the members we want.)
const ONBOARDING_IDLE_LIMIT = 3; // consecutive no-progress turns = a genuine stall (not a pause — they gave nothing usable)
const ONBOARDING_HARD_CEILING = 30; // absolute backstop against a true runaway/abuse loop, regardless of progress

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

// --- stage predicate ------------------------------------------------------------------------------------
function identityTargetMet(c: Collected): boolean {
  return !!c.athleticPast && (!!c.identityNoun || !!c.identitySkipped);
}

// --- reclaim de-duplication (Jay's walk: "Ride my bike more" ×2, "lose 25 lbs" twice) -------------------
// Two capture paths run per turn — the model's add_reclaim_item AND the engine's backstop / confirm late-add —
// and a re-tag of an already-listed want double-adds it. A single normalized key (case/punctuation-insensitive)
// is the one place we decide "same want," so every append point stays deduped. It keeps the FIRST phrasing.
// A want's identity is its CONTENT tokens, order-independent — filler words and phrasing verbs dropped — so
// "Getting down to 190 lbs" and "Get down to 190 lbs" collapse to the same key (Jay's walk: the exact-string key
// missed that near-dup). Kept conservative: only true filler + the get/want/need inflections are dropped, so
// content words (nouns/verbs) still distinguish genuinely different wants. Sorted so word order doesn't matter.
const RECLAIM_STOPWORDS = new Set([
  'the', 'a', 'an', 'my', 'our', 'your', 'his', 'her', 'their', 'its',
  'to', 'of', 'for', 'and', 'or', 'some', 'just', 'more',
  'get', 'getting', 'got', 'gets', 'want', 'wants', 'wanting', 'wanna', 'need', 'needs', 'needing',
  'i', 'im', 'be', 'being',
]);
function reclaimKey(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !RECLAIM_STOPWORDS.has(w))
    .sort()
    .join(' ');
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

// --- THE ARC KERNEL (Phase 0 seam) — a generic, replayable staged-conversation engine ------------------
// Design of record: docs/handoffs/2026-07-02-v2.2-kernel-seam-and-sequenced-plan.md. The engine is now
// arc-AGNOSTIC (`runArcTurn`), driven by an ArcConfig: an ordered list of StageDefs. Onboarding is config #1
// (ONBOARDING_ARC). A second arc (Reconnect) plugs in as another ArcConfig — NO fork of the spine.
// PHASE 0 SCOPE: the per-stage COUNTERS still live as flat ConvState fields (identityProbes/gapDepth/…),
// threaded through `Beat`. Migrating them into per-stage scratch is Phase 1 step 0 — kept OUT of here so the 53
// fixtures prove this extraction bit-for-bit behavior-identical without editing the safety net. TWO-MODE:
// every onboarding stage is 'drawout'; the 'administered' path (IDQ/Grinta, no depth kernel) lands with §2c.

type StageId = string;
type StageMode = 'drawout' | 'administered';

// The mutable per-turn working state handed to every stage handler. Carries the merged captures, the flat
// scratch counters (Phase 0), and the control fields a handler sets. A handler mutates it in place OR returns a
// terminal Turn (an early return — the decline off-ramp and the runaway force-progress use this).
interface Beat {
  readonly history: ConvMessage[];
  readonly memberMessage: string;
  readonly model: ModelTurn;
  readonly modelText: string;
  readonly refinedThisTurn: boolean;
  readonly priorReclaimLen: number; // reclaim-list length BEFORE this turn's merge (for the backstop's grew-check)
  readonly arc: ArcConfig;
  collected: Collected;
  stage: StageId;
  awaitingConfirm: boolean;
  reply: string;
  complete: boolean;
  declined: boolean;
  // flat per-stage scratch (Phase 0 — migrates to per-stage scratch in Phase 1 step 0):
  identityTurns: number;
  identityProbes: number;
  gapTurns: number;
  gapDepth: number;
  reclaimNudged: boolean;
  noFade: boolean;
  idleTurns: number;
}

// A stage handler mutates the Beat (sets b.reply etc.) or returns a terminal Turn. `resolveConfirm`'s CONTRACT
// (its use inside a stage's confirm handler) carries the VERBATIM-REFLECTION GATE: a draw-out beat advances only
// on a substantive reflection quoting the member's own words (today via the reflect_gap prompt + reflectGap) —
// preserved as a contract so the Phase 2 regex→model-signaled swap keeps it.
type StageHandler = (b: Beat) => Turn | void;

interface StageDef {
  id: StageId;
  mode: StageMode;
  opener: (c: Collected) => string; // the reply when the machine ADVANCES into this stage
  offersSubstance: (message: string, c: Collected) => boolean; // did the member contribute this turn? (idle counter)
  gather: StageHandler; // not awaitingConfirm, in this stage
  confirm: StageHandler; // awaitingConfirm in this stage
  forceProgress?: StageHandler; // the runaway backstop's per-stage action (early-return Turn, or mutate + fall through)
}

interface ArcConfig {
  id: string;
  stageOrder: StageId[];
  stages: Record<StageId, StageDef>;
  onComplete: (c: Collected) => string; // the completion reply (the card / the earned ceremony)
}

// Build the persisted ConvState from a Beat — the single place the turn's state shape is assembled.
function beatState(b: Beat): ConvState {
  return {
    stage: b.stage as StagedStage,
    collected: b.collected,
    awaitingConfirm: b.awaitingConfirm,
    identityTurns: b.identityTurns,
    identityProbes: b.identityProbes,
    reclaimNudged: b.reclaimNudged,
    gapTurns: b.gapTurns,
    gapDepth: b.gapDepth,
    idleTurns: b.idleTurns,
    noFade: b.noFade,
  };
}

// --- ONBOARDING_ARC (config #1) — the three draw-out stages, logic moved verbatim from the old monolith -----

const identityStage: StageDef = {
  id: 'identity',
  mode: 'drawout',
  opener: () => STAGED_OPENING, // stage 0 — never advanced-into; opener unused (the arc opening lives in stagedOpening())
  offersSubstance: (message) => message.trim().length >= 15,
  gather(b) {
    if (b.collected.identitySkipped) {
      // Skipped — nothing to confirm; acknowledge and advance straight into the gap stage.
      b.stage = 'gap';
      b.reply = `${SKIP_ACK}\n\n${gapOpen(b.collected)}`;
    } else if (b.collected.identityNoun) {
      // BREATHE FLOOR (1a) + the conditional second probe (1b / Decision S). Reflect once the material is RICH
      // (front-loader escape), the member PUSHES PAST (terse escape), or we've drawn out enough (2 probes).
      const rich = stageMaterialRich('identity', b.collected);
      const pushed = memberPushedPast('identity', b.memberMessage, b.collected);
      if (rich || pushed || b.identityProbes >= 2) {
        b.reply = reflectIdentity(b.collected);
        b.awaitingConfirm = true;
      } else {
        b.identityProbes += 1;
        // probe 1 = the general draw; probe 2 = smaller + concrete. Prefer the model's own drawing-out question.
        const probe = b.identityProbes === 1 ? identityProbe(b.collected) : identityProbe2(b.collected);
        b.reply = withQuestion(b.modelText, probe);
      }
    } else {
      // Gather. Never-strand a member who won't name a PAST self: offer the "find it later" skip after a couple
      // of tries, HARD-ESCAPE after a few (recovered at Identity Excavation in Reconnect).
      b.identityTurns += 1;
      const skipOfferable = b.identityTurns >= IDENTITY_SKIP_OFFER_AFTER;
      if (b.identityTurns >= IDENTITY_MAX_TURNS && !b.collected.athleticPast && !b.collected.identityNoun) {
        b.collected.identitySkipped = true;
        b.stage = 'gap';
        b.reply = `${SKIP_ACK}\n\n${gapOpen(b.collected)}`;
      } else {
        const probe = !b.collected.athleticPast ? (skipOfferable ? SKIP_OFFER : STAGED_OPENING) : skipOfferable ? SKIP_OFFER : NAME_PROMPT;
        b.reply = withQuestion(b.modelText, probe);
      }
    }
  },
  confirm(b) {
    if (correctsReflection(b.memberMessage)) {
      b.awaitingConfirm = false;
      b.reply = REOPEN_IDENTITY;
    } else {
      // Not a correction → advance into the gap stage (bridge from the named identity, not a cold switch).
      b.stage = 'gap';
      b.awaitingConfirm = false;
      b.reply = gapBridge(b.collected);
    }
  },
};

const gapStage: StageDef = {
  id: 'gap',
  mode: 'drawout',
  opener: (c) => gapBridge(c),
  offersSubstance: (message) => shouldCaptureStagedGap(message) || message.trim().length >= 20,
  forceProgress(b) {
    // Bound the gap-elaboration loop: a real gap is captured but she keeps elaborating → move on to Reclaim.
    const realGap = gapIsNarrative(b.collected.gap, b.collected.reclaimList ?? []) && !isForwardAmbition(b.collected.gap ?? '');
    if (realGap) {
      b.stage = 'reclaim';
      b.awaitingConfirm = false;
      b.idleTurns = 0;
      return { reply: reclaimOpen(b.collected), state: beatState(b), complete: false };
    }
    // no real gap yet → nothing to force; fall through to normal gather
  },
  gather(b) {
    // The model's explicit no-fade judgement (note_no_fade) is the PRIMARY signal. Sticky once set.
    if (b.model.noFade) b.noFade = true;
    // FADE GATE. Reject a model-tagged gap that is forward-looking ambition (never FABRICATE a fade). Reject on
    // AMBITION specifically, not shortness — a terse real fade ("Knee. Then divorce.") must survive.
    if (b.collected.gap && isForwardAmbition(b.collected.gap) && !b.noFade) b.collected.gap = undefined;
    // Backstop: when the model did NOT tag a (real-fade) set_gap this turn, capture the member's own message as
    // the gap if it reads as a real fade — ACCUMULATE (append) so a progressive revealer's chapters aren't lost.
    const modelTaggedGap = b.model.record?.gap !== undefined && b.model.record.gap !== '' && !isForwardAmbition(b.model.record.gap);
    if (!b.collected.gap && !b.noFade && shouldCaptureStagedGap(b.memberMessage)) {
      b.collected.gap = b.memberMessage.trim();
    } else if (b.collected.gap && !b.noFade && !modelTaggedGap && shouldCaptureStagedGap(b.memberMessage)) {
      b.collected.gap = `${b.collected.gap} ${b.memberMessage.trim()}`;
    }
    if (!b.collected.gap && !b.noFade) b.gapTurns += 1; // count gather turns only while no real fade is in hand
    // NEVER-STRAND the gap stage: after several gap turns with NOTHING captured, grab the accumulated gap-stage
    // story so we advance instead of looping the opening question.
    if (!b.collected.gap && !b.noFade && b.gapTurns >= GAP_MAX_TURNS) {
      const corpus = gapStageCorpus(b.history, b.memberMessage).trim();
      if (corpus.length >= 40 && !isForwardAmbition(corpus)) b.collected.gap = corpus;
    }
    // DECISION E FORK: resolve a "no obvious fade event" member from the whole gap-stage corpus.
    const gapCorpus = gapStageCorpus(b.history, b.memberMessage);
    if (isAcceptanceFade(gapCorpus)) {
      // RESIGNED to age-decline → The Acceptance Door: a real, quiet Fade. NOT no-fade — clear the flag, capture
      // their own words as the gap, and fall through to the normal real-fade reflect/advance below.
      b.noFade = false;
      if (!b.collected.gap) b.collected.gap = b.memberMessage.trim() || gapCorpus.trim();
    }
    // GENUINELY THRIVING → graceful DECLINE. Fires when there's NO real-fade signal anywhere AND either the model
    // judged no-fade, or the member's own words are pure forward-ambition with nothing captured after a couple turns.
    const noRealFadeSignal = !isAcceptanceFade(gapCorpus) && !hasGenuineLoss(gapCorpus);
    const thrivingDecline =
      noRealFadeSignal && (b.noFade || (isForwardAmbition(b.memberMessage) && !b.collected.gap && b.gapTurns >= 2));
    if (thrivingDecline) {
      // Out of scope; the door stays open. Terminal — no card, no reclaim. We never fabricate a fade to admit them.
      b.stage = 'declined';
      b.awaitingConfirm = false;
      b.declined = true;
      return { reply: DECLINE_REPLY, state: { ...beatState(b), declined: true }, complete: false, declined: true };
    }
    if (b.collected.gap) {
      // Real fade. Accumulate Doors across the WHOLE corpus, and RECEIVE the whole story before reflecting.
      b.collected.doors = augmentDoors(b.collected.doors ?? [], gapStageCorpus(b.history, b.memberMessage));
      b.gapDepth += 1; // one more drawing-out exchange with the story in hand
      // MODEL-JUDGED advance: the MODEL decides when the story is drawn out (reflect_gap), bounded by the engine —
      // a FLOOR (GAP_MIN_DEPTH) and a CAP (GAP_MAX_DEPTH). A member close overrides; the card is the backstop.
      const modelJudgedDone = b.model.gapReady && b.gapDepth >= GAP_MIN_DEPTH;
      const advance = modelJudgedDone || memberPushedPast('gap', b.memberMessage, b.collected) || b.gapDepth >= GAP_MAX_DEPTH;
      if (!advance) {
        b.reply = withQuestion(b.modelText, gapMore(b.history));
      } else {
        b.reply = reflectGap(b.modelText);
        b.awaitingConfirm = true;
      }
    } else {
      // Still gathering a real fade — keep the model's question, else hold the gap open.
      b.reply = withQuestion(b.modelText, gapOpen(b.collected));
    }
  },
  confirm(b) {
    // GAP CONFIRM — "…or is there more to it?" A bare "no / nope / that's it / more or less it for now" means NO
    // MORE = DONE → ADVANCE. resolveGapConfirm owns the meaning (dispute / addition / done); the engine acts on it.
    const intent = resolveGapConfirm(b.memberMessage);
    if (intent === 'dispute') {
      // wrong, no new content → reopen, but KEEP the gap + Doors (never wipe).
      b.awaitingConfirm = false;
      b.reply = REOPEN_GAP;
    } else if (intent === 'addition') {
      // a new chapter (or a correction WITH content) → append it, re-derive Doors, and DRAW IT OUT.
      const modelTaggedGap = b.model.record?.gap !== undefined && b.model.record.gap !== '';
      if (!modelTaggedGap) b.collected.gap = b.collected.gap ? `${b.collected.gap} ${b.memberMessage.trim()}` : b.memberMessage.trim();
      b.collected.doors = augmentDoors(b.collected.doors ?? [], gapStageCorpus(b.history, b.memberMessage));
      b.awaitingConfirm = false;
      b.reply = withQuestion(b.modelText, gapMore(b.history));
    } else {
      // done / affirm / bare "no more" → advance into reclaim (re-surfacing any parked wants).
      b.stage = 'reclaim';
      b.awaitingConfirm = false;
      b.reply = reclaimOpening(b.collected);
    }
  },
};

const reclaimStage: StageDef = {
  id: 'reclaim',
  mode: 'drawout',
  opener: (c) => reclaimOpening(c),
  offersSubstance: (message) => shouldCaptureStagedReclaim(message),
  forceProgress(b) {
    // Bound the reclaim loop → the card once card-ready. NEVER drop the want they JUST offered at the cap.
    if (!memberClosingReclaim(b.memberMessage) && shouldCaptureStagedReclaim(b.memberMessage)) {
      appendReclaim(b.collected, b.memberMessage);
    }
    const realGap = gapIsNarrative(b.collected.gap, b.collected.reclaimList ?? []) && !isForwardAmbition(b.collected.gap ?? '');
    if (hasIdentity(b.collected) && realGap && (b.collected.reclaimList?.length ?? 0) >= RECLAIM_LIST_FLOOR) {
      b.stage = 'complete';
      b.awaitingConfirm = false;
      return { reply: b.arc.onComplete(b.collected), state: beatState(b), complete: true };
    }
    // not card-ready → mutation kept, fall through to normal gather
  },
  gather(b) {
    // Uniform floor+escape (1b): reclaim's drawing-out is "gather toward the aim."
    const closing = memberPushedPast('reclaim', b.memberMessage, b.collected);
    // The member put a want FORWARD this turn (new or a restatement) — the "still in flow" signal, distinct from
    // whether the list actually grew (a dup offer keeps them in flow).
    const offered = !closing && shouldCaptureStagedReclaim(b.memberMessage);
    const modelCaptured = (b.collected.reclaimList?.length ?? 0) > b.priorReclaimLen; // model's add_reclaim_item landed
    // Backstop: capture an untagged want ONLY when offered AND the model did NOT already tag it. appendReclaim
    // dedupes restatements. Skip when the turn REFINED a want (the sharpening answer, already folded in).
    if (offered && !modelCaptured && !b.refinedThisTurn) appendReclaim(b.collected, b.memberMessage);
    const count = b.collected.reclaimList?.length ?? 0;
    const grewThisTurn = count > b.priorReclaimLen; // a NEW unique want landed this turn (model or backstop)
    if (count >= RECLAIM_LIST_TARGET || (count >= RECLAIM_LIST_MIN && closing)) {
      // Aim reached, OR at the minimum and closing — reflect the whole list and confirm.
      b.reply = reflectReclaim(b.collected);
      b.awaitingConfirm = true;
    } else if (count >= RECLAIM_LIST_MIN) {
      // At/above the minimum, below the aim, not explicitly closing. COMPLETE-WHEN-DONE: keep gathering while
      // she's still OFFERING (new item OR a restatement — a dup must NOT pull the list up short). Only when a
      // turn brings nothing at all is she finished — reflect and await her confirm.
      if ((grewThisTurn || offered) && count < RECLAIM_LIST_TARGET) {
        b.reply = withQuestion(b.modelText, RECLAIM_MORE);
      } else {
        b.reply = reflectReclaim(b.collected);
        b.awaitingConfirm = true;
      }
    } else if (closing && !b.reclaimNudged) {
      // Soft-close below the minimum → nudge ONCE (small things count), draw out more.
      b.reclaimNudged = true;
      b.reply = RECLAIM_NUDGE;
    } else if (closing && b.reclaimNudged) {
      // Already nudged, still closing below the floor. Gate-1 (sub-3): with ≥1 real want, ACCEPT and complete —
      // the card carries the shortfall. Never fabricate. Only a truly empty list holds.
      if (count >= 1) {
        b.reply = reflectReclaim(b.collected);
        b.awaitingConfirm = true;
      } else {
        b.reply = RECLAIM_SOFT_HOLD;
      }
    } else {
      // Still offering — keep the model's reflection with a guaranteed closing question; else invite the next item.
      b.reply = withQuestion(b.modelText, RECLAIM_MORE);
    }
  },
  confirm(b) {
    // RECLAIM late-add: a want volunteered AT the confirm — neither a correction nor an affirmation — used to be
    // dropped as the beat advanced. Capture it and re-reflect. Only a genuinely NEW want re-opens (deduped).
    if (
      !b.refinedThisTurn && // a sharpening answer isn't a new want
      !correctsReflection(b.memberMessage) &&
      !memberClosingReclaim(b.memberMessage) &&
      shouldCaptureStagedReclaim(b.memberMessage) &&
      appendReclaim(b.collected, b.memberMessage)
    ) {
      b.reply = reflectReclaim(b.collected);
      b.awaitingConfirm = true; // stay in confirm — re-reflect with the just-added want included
      return;
    }
    // RECLAIM CONFIRM — "Anything missing?" A bare "no / nope / that's a good list" = nothing missing = DONE →
    // the card. Only an explicit CHANGE request reopens the gather. resolveReclaimConfirm owns the meaning.
    if (resolveReclaimConfirm(b.memberMessage) === 'change') {
      b.awaitingConfirm = false;
      b.reply = withQuestion(b.modelText, RECLAIM_MORE);
    } else {
      b.stage = 'complete';
      b.awaitingConfirm = false;
      b.reply = b.arc.onComplete(b.collected);
      b.complete = true;
    }
  },
};

const ONBOARDING_ARC: ArcConfig = {
  id: 'onboarding',
  stageOrder: ['identity', 'gap', 'reclaim'],
  stages: { identity: identityStage, gap: gapStage, reclaim: reclaimStage },
  onComplete: () => COMPLETE_HANDOFF,
};

// --- the generic kernel: run one turn of ANY arc -------------------------------------------------------
export function runArcTurn(
  arc: ArcConfig,
  state: ConvState,
  history: ConvMessage[],
  memberMessage: string,
  model: ModelTurn,
): Turn {
  const collected = mergeStaged({ ...state.collected }, model.record);
  // Light-touch measurability: the model sharpens a vague want by REPLACING its most-recent item in place —
  // never a second entry. Dedupe after, in case the sharpened text collides with an earlier want.
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

  const b: Beat = {
    history,
    memberMessage,
    model,
    modelText: stripLeadingDisclosure(model.text).trim(),
    refinedThisTurn,
    priorReclaimLen: state.collected.reclaimList?.length ?? 0,
    arc,
    collected,
    stage: (state.stage ?? arc.stageOrder[0]) as StageId,
    awaitingConfirm: state.awaitingConfirm ?? false,
    reply: '',
    complete: false,
    declined: false,
    identityTurns: state.identityTurns ?? 0,
    identityProbes: state.identityProbes ?? 0,
    gapTurns: state.gapTurns ?? 0,
    gapDepth: state.gapDepth ?? 0,
    reclaimNudged: state.reclaimNudged ?? false,
    noFade: state.noFade ?? false,
    idleTurns: state.idleTurns ?? 0,
  };
  const stageDef = arc.stages[b.stage];

  // PROGRESS vs STALL: the member CONTRIBUTED this turn if a captured field grew, OR they offered usable
  // substance (per the current stage) and weren't deflecting. Biased toward "engaged" — a verbose member resets
  // the idle counter every turn they give something, so length never triggers the cap; only a true STALL does.
  const grew =
    (collected.gap?.length ?? 0) > (state.collected.gap?.length ?? 0) ||
    (collected.doors?.length ?? 0) > (state.collected.doors?.length ?? 0) ||
    (collected.reclaimList?.length ?? 0) > (state.collected.reclaimList?.length ?? 0) ||
    (!!collected.identityNoun && !state.collected.identityNoun) ||
    (!!collected.athleticPast && !state.collected.athleticPast);
  const offeredSubstance = !memberDeflecting(memberMessage) && (stageDef?.offersSubstance(memberMessage, collected) ?? false);
  b.idleTurns = grew || offeredSubstance ? 0 : (state.idleTurns ?? 0) + 1;

  // SYSTEMIC INVARIANT (the runaway backstop): fires on STALL (ONBOARDING_IDLE_LIMIT consecutive no-progress
  // turns) or the absolute ONBOARDING_HARD_CEILING — never on length alone. It delegates to the CURRENT stage's
  // forceProgress, which either returns a terminal Turn or mutates + falls through.
  const memberTurns = history.filter((h) => h.role === 'member').length + 1;
  if (!b.awaitingConfirm && (b.idleTurns >= ONBOARDING_IDLE_LIMIT || memberTurns >= ONBOARDING_HARD_CEILING)) {
    const forced = stageDef?.forceProgress?.(b);
    if (forced) return forced;
  }

  if (stageDef) {
    const early = b.awaitingConfirm ? stageDef.confirm(b) : stageDef.gather(b);
    if (early) return early;
  } else {
    // Already complete/declined (a resumed terminal state) — the card / reveal stands.
    b.reply = b.modelText || arc.onComplete(b.collected);
    b.complete = true;
  }

  // GENERAL no-verbatim-repeat guard: never emit the exact line we just said. A static opener/nudge falling
  // through twice reads as a broken loop. Prepend a short rotating warm lead. (Mid-conversation only.)
  if (!b.complete && !b.awaitingConfirm && b.reply === lastAgentReply(history)) {
    const leads = ['Take whatever time you need.', 'No rush at all.', "Whenever you're ready.", "There's no wrong way in."];
    b.reply = `${leads[history.length % leads.length]} ${b.reply}`;
  }

  return { reply: b.reply, state: beatState(b), complete: b.complete, ...(b.declined ? { declined: true } : {}) };
}

// The onboarding turn — config #1 on the generic kernel. The public signature is unchanged (callers/fixtures
// keep calling applyStagedTurn); it now just binds ONBOARDING_ARC.
export function applyStagedTurn(
  state: ConvState,
  history: ConvMessage[],
  memberMessage: string,
  model: ModelTurn,
): Turn {
  return runArcTurn(ONBOARDING_ARC, state, history, memberMessage, model);
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
  • kids at home taking your time/energy — young, or older-but-still-here (busy, needing you) → full_house
  • ONLY once the kids have actually LEFT and the house went quiet → empty_nest (mutually exclusive with full_house —
    never tag both; kids getting older/busier while still at home is full_house, not empty_nest)
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
question per turn. No meta-narration about the program's mechanics.
NUMBER-FREE ONBOARDING — this whole conversation is free of scores and instruments. Do NOT mention the IDQ, the
ID Score, a questionnaire, a test, points, or "your first score" — not as a next step, not as a reward, not at
all. There is no next step to pitch: when the beats are done the member sees a summary card and their dashboard.
If you feel the pull to tell them what comes next, don't — just reflect what they gave you and ask your one
question. Naming an instrument here breaks the spell and is off-spec.`;

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
