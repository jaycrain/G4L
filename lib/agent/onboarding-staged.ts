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

import { cleanIdentityNoun, displayIdentityNoun, identityLabel, sanitizeCoinedIdentity } from '../member/identity.ts';
import { isDoorSlug, matchDoors, DOORS, type DoorSlug } from '../doors.ts';
import { isConversationalMeta, isAboutTheApp } from './conversational-meta.ts';
import { isMemberContent } from './member-turn.ts';
import { applyVoiceGate } from './voice-gate.ts';
import { RECLAIM_LIST_FLOOR, RECLAIM_LIST_MIN, RECLAIM_LIST_TARGET, reclaimAddIntent, isReclaimMetaFragment } from '../member/reclaim.ts';
import { nextFollowUp } from './follow-up.ts';
import { isModelVoiced } from './reclaim-voice.ts';
import type { SessionVisual } from './session-visual.ts';
import { gapIsNarrative, hasIdentity } from './onboarding-contract.ts';
import { ONBOARDING_BASELINE_ITEMS, grintaStem } from '../grinta/survey/instrument.ts';
import { scoreGrinta } from '../grinta/survey/scoring.ts';
import { MEMBER_AGENT_SYSTEM_PROMPT } from './system-prompt.ts';
import {
  augmentDoors,
  doorsKnown,
  stripLeadingDisclosure,
  BEAT_SEP,
  type Collected,
  type ConvMessage,
  type ConvState,
  type Ctx,
  type DoorRevision,
  type HarvestSignal,
  type ModelTurn,
  type PendingReclaimShape,
  type ReplyIntent,
  type ReseeingTell,
  type ScaleExpectation,
  type Expectation,
  type Stage,
  type Turn,
} from './onboarding.ts';
import { reconcileReclaimShapes, shapeKey, splitInlineEnumeration } from './reclaim-shape.ts';
import { filterDoorsByAttribution } from './door-attribution.ts';
import { GAP_CONFIRM_CHOICES, parseGapConfirmChoice, parseGapConfirmDoors, gapConfirmIntent } from './gap-confirm-choice.ts';
import { doorsBoardExpectation } from './doors-board-expectation.ts';
import { claimsGateOutcome } from './gate-claims.ts';
import { detectCrisis, CRISIS_RESPONSE_US } from './governance.ts';
import { captureCreate } from './capture-model.ts';
// The intent layer — the one place that decides what a member's utterance MEANS (see onboarding-intent.ts).
import {
  correctsReflection,
  declaresThriving,
  hasGenuineLoss,
  hasReductionLanguage,
  isAcceptanceFade,
  isForwardAmbition,
  memberClosingReclaim,
  memberDeflecting,
  memberSignalsGapComplete,
  memberSaysWeRepeated,
  resolveConfirmCorroborated,
  confirmsProposal,
  resolveReclaimConfirm,
  shouldCaptureStagedGap,
  shouldCaptureStagedReclaim,
  memberIsConfused,
} from './onboarding-intent.ts';

// Re-exported so existing callers/tests can keep importing it from the engine surface.
export { correctsReflection };

const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ── Contract 1 — one question per turn (docs/arc-reliability-hardening.md) ─────────────────────────────────────────
// When the engine hands into the next beat, it prepends the model's in-voice acknowledgment (receive-before-you-move).
// But the model's turn often ENDS on its own drawing-out question — and stacking that on top of the scripted opener
// gave the member two questions and no room to answer (Donna's #1 door double-opener, #4 door→IDQ). Since the engine
// has already DECIDED to advance (on the model's own done-signal), it treats the model's turn as a RECEIPT: keep the
// reflection, drop the trailing ask, so the scripted opener is the single question. Shared here so every arc handoff
// uses one contract and no site can reintroduce the double-ask.

/** Strip a trailing question sentence from the model's turn, keeping the receipt. '' if it was only a question. */
export function receiptOnly(modelText: string | undefined): string {
  const t = (modelText ?? '').trim();
  if (!t || !/\?\s*$/.test(t)) return t; // nothing to strip
  return t.replace(/\s*[^.!?]*\?\s*$/, '').trim();
}

/** Receive-then-open: the model's receipt (question stripped) + the single scripted opener. Opener alone if no receipt. */
export function receiveThen(modelText: string | undefined, opener: string): string {
  const receipt = receiptOnly(modelText);
  return receipt ? `${receipt}${BEAT_SEP}${opener}` : opener;
}

// --- stage identifiers ---------------------------------------------------------------------------------
// The onboarding arc's stages. 'declined' is a terminal OFF-RAMP (a genuinely-thriving no-fade member is
// gracefully declined, Decision E — out of scope, no card). Advancement is now owned by the stage handlers
// (each sets the next stage explicitly via its opener), so there's no central STAGE_ORDER walker any more.
type StagedStage = 'identity' | 'gap' | 'reclaim' | 'complete' | 'declined';

/**
 * How much a member must actually SAY before the model's no-fade hint may end their intake.
 *
 * Not a tuning knob — a floor under a judgement. Tim gave the gap stage eleven words across three replies and was
 * declined on the model's read of them. Forty is roughly two real sentences: still terse, but enough that "no fade
 * here" is a finding rather than a guess at someone who did not want to answer.
 *
 * Deliberately does NOT gate the member's own declaration. Someone who says plainly that nothing is missing is
 * out of scope immediately, however briefly they say it — we never manufacture a fade to admit anyone.
 */
const NO_FADE_MIN_WORDS = 40;

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
// Onboarding Copy v2 (Jay's voice pass): the corny example run is cut; the prompt is tightened + de-gendered.
export const STAGED_OPENING =
  "Let's start with a simple question.\n\n" +
  'When did you feel most like yourself?\n\n' +
  'We’ll work together to pick just one word, a handle, to describe them. Someone we can refer to that says ' +
  '“this is still who I am underneath everything.” This isn’t a label set in stone. It just puts a name to who ' +
  'you’re trying to reclaim. We can always change it later.\n\n' +
  'So tell me, when DID you feel most like yourself? Tell me about them. Not the job title or just the role for ' +
  'which everyone knows you. Who were they? What were they doing? How did it feel to be them?';

// The short re-draw when the member has spoken but we haven't yet caught a PAST self. NEVER re-emit the full
// STAGED_OPENING here — on turn 2+ they've already answered it, so the whole cold-open reads as a verbatim
// repeat (the invariant we most protect). A single warm re-pose is enough; the model usually carries the thread.
const IDENTITY_REDRAW =
  'Take your time — no rush. When did you last feel like yourself, and who was that version of you?';

const NAME_PROMPT =
  'If you put that person in a single word — the Runner, the Writer, the Builder, the Friend — what would it be? ' +
  "It's a handle to hold onto, not a label set in stone, and we can change it.";

// CAT-20 — ROTATE THE FALLBACKS. The no-verbatim guard compares the WHOLE reply, but withQuestion prepends the
// model's varying receipt — so the engine BODY could repeat byte-for-byte across consecutive turns while the whole
// reply differed, and the guard never fired. To a terse member that reads as a broken loop: the same paragraph,
// again, as though nothing they said registered. GAP_MORE/RECLAIM_MORE were already rotated; these two were not.
// Rotation is the honest fix — the same question asked a different way is a person; the identical paragraph twice
// is a machine.
const SKIP_OFFER_VARIANTS = [
  "No rush on the perfect word — and you don't have to land it today. If one comes — the Runner, the Builder, the " +
    "Friend — say it. If not, that's completely fine; we'll find it together as you go. Want to leave it for now?",
  "The word can wait. Some people know it straight away, some find it months in — both are normal. Shall we leave " +
    'it open and come back when something fits?',
  "You don't need a label to do this work. If nothing lands, we can move on and let it surface later — want to do " +
    'that?',
];
/** Pick a variant by how many times we've already offered the skip, so consecutive turns never repeat verbatim. */
function skipOffer(history: ConvMessage[]): string {
  const asked = history.filter(
    (h) => h.role === 'agent' && /(no rush on the perfect word|the word can wait|don't need a label)/i.test(h.text),
  ).length;
  return SKIP_OFFER_VARIANTS[Math.min(asked, SKIP_OFFER_VARIANTS.length - 1)]!;
}
export const SKIP_OFFER = SKIP_OFFER_VARIANTS[0]!; // the first variant, exported for tests/fixtures

const SKIP_ACK = "That's completely fine — you'll find your way back to them through the work, no rush.";

// DE-GENDERED (2026-08-24, Jay). This shipped saying "who SHE was" — the exact bug the rule three hundred lines
// down already records as fixed once: "'her' was wrong for a male member." It reaches a member at the worst
// possible moment: right after they told us the handle we offered was wrong, we misgender them while apologising
// for getting it wrong.
//
// "That version of you" also beats any pronoun here, gendered or not — it is the member's own past self, and the
// second person keeps it theirs rather than a character we are discussing.
const REOPEN_IDENTITY = "My mistake — let's get it right. What word feels truer for that version of you?";

// Identity tap-to-pick (Jay, 2026-07-29): once the past self is drawn out, the model offers 2–4 candidate handle
// words FROM THE MEMBER'S OWN LANGUAGE (offer_identity_words); the client renders them as chips + a "write your own"
// field. The member's tap/coin is DEFINITIVE — the engine captures it verbatim (no model in the capture path, which
// kept failing to commit a clear pick). Accepting the pick advances straight to the gap — no re-litigating a confirm.
const IDENTITY_PICK_OFFER =
  'Here are a few words for who that was — tap the one that fits, or write your own. It’s a handle to hold onto, ' +
  'not a label set in stone, and we can change it anytime.';
const IDENTITY_PICK_REPROMPT =
  'No wrong answer here — pick whichever comes closest, or write your own word for that person.';
// The picker's "not sure yet" affordance submits this exact sentinel; the engine also recognizes a few natural "not
// yet" phrasings a member might type into the write-your-own field, so neither path names them something they didn't mean.
const IDENTITY_PICK_SKIP = '__identity_skip__';
// Phrases anywhere in the reply that signal "I'm not ready to name it." Deliberately phrase-based (not lone words like
// "skip"/"pass") so a one-word handle can never be mistaken for a skip — a real handle ("Skipper", "Passer") is a word,
// this is a sentence. The picker's button submits the sentinel; this only defends the write-your-own field.
const IDENTITY_PICK_SKIP_RE =
  /(?:not\s+sure|not\s+ready|not\s+yet|don'?t\s+know|no\s+idea|none\s+of\s+(?:these|them)|maybe\s+later)/i;
function identityPickIsSkip(raw: string): boolean {
  const t = raw.trim();
  // Case-insensitive + substring so a paste/altered-casing/decorated sentinel ("The __IDENTITY_SKIP__") still skips
  // rather than committing the sentinel as a literal handle. (CAT-12)
  if (t.toLowerCase().includes(IDENTITY_PICK_SKIP)) return true;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length >= 2 && IDENTITY_PICK_SKIP_RE.test(t); // phrase-length uncertainty only
}
// Accept the tapped/coined handle and bridge straight into the gap — the pick is definitive (Jay: accept it as the
// answer, don't re-ask). Warm and brief, then the gap draw-out opens FROM the named person (gapBridge).
function identityPickAck(c: Collected): string {
  const label = identityLabel(c.identityNoun) || 'that person';
  const Label = label.charAt(0).toUpperCase() + label.slice(1); // sentence-start ("The Athlete")
  return `${Label} it is.\n\n${gapBridge(c)}`;
}

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
function gapOpen(c: Collected, history: ConvMessage[] = []): string {
  // CAT-20: re-asked cold, this used to repeat verbatim. The Doors teaching is only owed ONCE — after that, ask
  // again in fewer words rather than replaying the whole paragraph at someone who already heard it.
  const asked = history.filter((h) => h.role === 'agent' && /what we call Doors|caused that version of you|pulled you away from/i.test(h.text)).length;
  if (asked >= 2) return `Take it wherever it starts. What was going on for you when the distance opened?`;
  if (asked === 1) return `Whenever you're ready — what's been happening that pulled you away from ${identityRef(c)}?`;
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
  // SECOND PERSON (Cowork + Jay, 2026-08-14). This carried the Identity handle THREE times in one paragraph
  // ("what happened to the Athlete … the distance from the Athlete … pulled you away from the Athlete") — the
  // densest instance in the product of a member being discussed in the third person to their face. They claimed
  // that word one beat ago; saying it back AT them now reads as filing rather than recognition. The bridge is
  // still a bridge — "Then" carries it — this beat just addresses the person who did the naming.
  return (
    `Then let's find out what happened. That distance rarely opens all at once — more often ` +
    `it's an accumulation of what we call Doors: moments and seasons you walk through and barely notice, each one ` +
    `widening the gap. So how did it go — what pulled you away from yourself? Take me through it.`
  );
}

// Reflect-confirm copy for the gap. We lead with the model's OWN warm reflection of what they just told us
// (it just heard the whole story); the forecast sets the lighter-Door expectation (receive, don't excavate)
// that the specific Doors get a dedicated session later; one confirm question, never a Y/N gate. (§4)
const GAP_REFLECT_LEAD = "Thank you for trusting me with that — that kind of distance rarely opens all at once.";
// Warm, clear, invites correction — replaces the old "for now this is plenty / we'll go deeper later / did I
// understand the shape of how it went?" which read as dismissive AND generic on Jay's walk (he replied "the
// shape of what?"). Under the model-judged flow the LEAD is the model's own drawn-out reflection in their words.
// THE INVITATION THE CHIPS ANSWER. All three of her options have to be a real answer to this one sentence, or the
// question and the buttons are two separate asks — the exact shape that made a member say "didn't we just do that"
// on the Doors board. "Does that land" is answered by "not quite right"; "is there more" by "there's more"; both
// by "that's the whole of it". It stays a question in the Companion's voice, not a prompt to operate a control.
const GAP_FORECAST_CONFIRM = 'Does that land the way it happened — or is there more?';
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
// THE CAP WAS A COMMENT, NOT CODE. GAP_MORE_MAX was declared here and never referenced — the chooser indexed
// `asks % length`, which wraps, so "capped at N asks, then reflect" never happened. Now the list genuinely runs
// out: nextFollowUp returns null and the caller stops asking rather than starting again at the top.
function gapMore(history: ConvMessage[]): string | null {
  return nextFollowUp(GAP_MORE_VARIANTS, history);
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
// A warm BRIDGE from the gap into reclaim (Phase 2.3 / Cowork #5) — the gap beat is heavy, so we don't cold-pivot
// to "Now, the good part." We land on the weight they just named, then turn it toward hope, referencing the
// identity. Directional copy (Jay reacts on the walk).
//
// THE BRIDGE ITSELF, hoisted so it cannot exist on only one path again. It was written for the blank opener and
// never reached the parked one, so every front-loader got the cold pivot this copy exists to replace — for weeks,
// invisibly, because the branch nobody walks is the branch nobody reads. (Jay, 2026-08-18.)
function gapToReclaimBridge(c: Collected): string {
  const identity = identityLabel(c.identityNoun);
  // SECOND PERSON (Cowork + Jay, 2026-08-14): "no wonder the Athlete got quiet" and "the Athlete's life" made
  // the member the OBJECT of a sentence about their own experience. The Identity may still be named as the thing
  // they are reclaiming (the product's actual promise); it may not stand in for them as the one who lived it.
  return (
    `That's a lot to have been carrying${identity ? ` — no wonder that part of you got quiet under all of it` : ''}. ` +
    `Here's the turn, though: none of it is gone. It's been waiting for you.`
  );
}

/**
 * THE FRAME — three beats, then the builder opens. Nothing else writes to this list.
 *
 * WIDGET-FIRST (Jay, 2026-08-22; docs/decisions/2026-08-22-reclaim-list-widget-first.md). A six-turn draw-out
 * used to run in front of the builder and seed it with whatever the model tagged along the way. Donna's walk put
 * four conversational fragments into her committed list, one of which was a bug report ABOUT the Reclaim List.
 * The builder is now the only writer, so there is no judgement to get wrong in either direction.
 *
 * "WHAT DID THE IDENTITY DO?" IS A MEMORY QUESTION, and that is the whole point of the middle beat. "What do you
 * want back?" asks her to invent an answer; asking what she was capable of asks her to RECALL one — she already
 * knows it and simply has not said it aloud. Memories arrive concrete, so items come out closeable without
 * anyone telling her to be specific. (Jay: "things that Identity did or was capable of that seem out of reach.")
 *
 * NO EXAMPLES IN THE FRAME. Naming what someone else might write narrows what she writes. The Door and the
 * Identity are hers, already confirmed, and they are enough to write from.
 */
function reclaimOpen(c: Collected): string {
  const beats = [gapToReclaimBridge(c)];
  // SECOND PERSON, AND THE IDENTITY IS NOT NAMED HERE — caught twice by the naming guard within an hour of this
  // being written, and it was right both times. The first draft asked "What did the Maker DO?" (third person, the
  // thing CLAUDE.md forbids outright). The second said "You're reclaiming the Maker — so what did you DO?", which
  // reads better but still puts the Identity on this turn: it may be named at the MOMENT SHE CLAIMS IT and at a
  // real milestone, and this is neither.
  //
  // Jay's framing survives the constraint intact, because it was never about the word. "What did you DO, back
  // when you were most yourself" is the same memory question — she recalls rather than invents — and it asks it
  // of HER, which is stronger anyway.
  beats.push(
    `So here's the other direction. What did you DO, back when you were most yourself? The things you were good `
      + `at, the ones that came easily, the ones that feel out of reach now. Those are what you want back.`,
  );
  beats.push(
    `Put them down as they come. Big or small, three to start is plenty, and you can add as many as you want.`,
  );
  return beats.join(BEAT_SEP);
}

// ROTATED so the "what else?" backstop NEVER repeats verbatim as the list grows (the same static line, appended by
// the engine turn after turn, read as a broken loop on the live walk — the gap stage already rotates its GAP_MORE for
// exactly this reason; reclaim now matches). After these, the turn logic reflects the list instead of re-asking.
const RECLAIM_MORE_VARIANTS = [
  'What else? Anything that comes — big or small.',
  'What else would you want back? Small things count.',
  'Anything else on your mind — even something small you miss?',
];
const RECLAIM_MORE = RECLAIM_MORE_VARIANTS[0]!; // the soft-close / recite-mismatch nudge (a single ask, not a loop)
function reclaimMore(history: ConvMessage[]): string | null {
  return nextFollowUp(RECLAIM_MORE_VARIANTS, history);
}

// The confirm-only card reply when a member tries to add a want AFTER the summary card. Nothing lands here — so we
// say that plainly, and point them to where adding DOES work (the first session + the companion rail). Never "Added".
const CARD_LIST_SET =
  "Your Reclaim List is set for now — no need to add more here. You'll be able to add to it and change it in your first session, or anytime just by talking with your Companion. Take a look at the summary below whenever you're ready.";

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

// SHARED draw-out primitive (kernel-level): when has a draw-out beat gathered ENOUGH to reflect? Model-judged depth
// (depthReady) bounded by a FLOOR (never pattern on thin material) and CAP (never trap the member). Also advances when
// the model already WRAPPED UP (a declarative reflection past the floor, not another probe). Used by every draw-out
// stage across the arcs (Reconnect Doors/Drift/Window; Rewire W1…). Lives here, in the kernel, not any one arc.
export function drawoutShouldReflect(
  modelText: string,
  depthReady: boolean | undefined,
  depth: number,
  min: number,
  max: number,
  memberWantsToMove = false,
): boolean {
  // Contract 2 (advance) — the Independence Guarantee: the member sets the depth and can stop ANY time. If they say
  // "move on / that's it / we already did this," advance now — never re-pose and loop (Donna's #3 window that kept
  // asking for another Tuesday until she forced it). This can't flatten: it only fires on an explicit move-on signal.
  if (memberWantsToMove) return true;
  const t = (modelText ?? '').trim();
  const wrappedUp = depth >= min && t.length >= 40 && !/\?\s*$/.test(t); // a declarative reflection, not another probe
  return (depthReady === true && depth >= min) || wrappedUp || depth >= max;
}

// Ensure a turn ENDS on a real forward question (bar: always be correctable / keep the conversation going).
// The old `/\?/.test(modelText)` guard passed a rhetorical mid-sentence "…were they?" and then let the reply
// trail off into a statement with nothing to answer (Jay's walk: the reflection dead-ended). This keeps the
// model's reflection AND guarantees a closing question: model ends on a question → use it; model reflected but
// trailed into a statement → keep it, append the stage probe; nothing usable → the probe alone.
// Exported: a shared draw-out primitive the arcs reuse (Reconnect has its own copy; Rewire imports this one).
// `probe` is NULL once every follow-up for this beat has been said (nextFollowUp). Then the model's own text IS
// the turn — which is the drawout rule anyway: the model owns the question, the engine never appends its own.
// NOTHING_LEFT_TO_ASK covers the one combination that would otherwise emit an empty reply.
export const NOTHING_LEFT_TO_ASK = "Take your time — say more whenever you're ready.";
export function withQuestion(modelText: string, probe: string | null): string {
  const t = (modelText ?? '').trim();
  if (!t) return probe ?? NOTHING_LEFT_TO_ASK;
  if (!probe) return t;
  // Did the model already lead the turn with a forward question? Look at the whole LAST PARAGRAPH, not just the
  // last N characters. The model routinely asks its question and then adds an invitation coda in the same breath
  // ("…what did that look like for you? Give me a glimpse of what that version of you was doing."). A char-window
  // heuristic misses that when the coda runs long and re-appends a SECOND question — or, worse, the whole opening.
  // Two of Jay's walks hit this exact shape; a paragraph-scoped check is the robust contract. (The confirmation
  // card remains the seatbelt if a rhetorical '?' ever suppresses a probe we wanted.)
  const lastPara = t.split(/\n\s*\n/).pop() ?? t;
  if (lastPara.includes('?')) return t;
  return `${t}\n\n${probe}`; // a reflection with no forward question anywhere — add one
}

// The model's reflect_gap turn IS the reflection: the prompt tells it to reflect the WHOLE story back in the
// member's words and ask a correctable question on that same turn. So TRUST it — don't overwrite it with an
// engine-built lead. (Jay's walk: the engine threw away the model's rich reflection because it contained a "?"
// and read back the stalest early gap fragment — "Well, I got married and had kids" — dropping everything just
// drawn out. Never read a stale fragment back as "here's what I'm holding.")
function reflectGap(modelText: string): string {
  // RECEIVE, THEN INVITE — and the invitation is always OURS now (2026-08-19).
  //
  // It used to keep the model's own trailing question when it had one, to avoid stacking two asks. That was right
  // while her answer was free text. With the chips it inverts: her three options must answer the question actually
  // on screen, and a model question ("what was that like?") leaves them answering something else. receiveThen
  // strips the model's ask and keeps its reflection, so there is still exactly one question — ours, the one the
  // chips are the answers to.
  //
  // The reflection still leads and is still the model's, in her words. The structure only carries the ending.
  const t = (modelText ?? '').trim();
  return receiveThen(t || GAP_REFLECT_LEAD, GAP_FORECAST_CONFIRM);
}

// W-12: join accumulated gap chapters with a sentence boundary. When a member adds a chapter at the gap confirm, we
// append it to the stored gap — but a bare space ran the sentences together ("gotten me there It went deeper"). Add a
// period when the prior chapter doesn't already end in terminal punctuation. Pure + testable.
export function joinGapChapters(prev: string, next: string): string {
  const p = (prev ?? '').trim();
  const n = (next ?? '').trim();
  if (!p) return n;
  if (!n) return p;
  // W-45: a progressive revealer's gap should GROW, not repeat — if the new chapter is already present verbatim
  // (an exact re-paste of what was captured), don't append it again. Conservative: exact-substring only, so distinct
  // new chapters (layoff → household → illness) are never dropped.
  if (p.includes(n)) return p;
  return /[.!?]$/.test(p) ? `${p} ${n}` : `${p}. ${n}`;
}

// A light MECHANICS-ONLY tidy for a gap built from the member's RAW messages (the backstop path, when the model didn't
// record a clean set_gap). Fixes whitespace, punctuation spacing, and sentence capitalization WITHOUT changing any
// words — governance: it's the member's own account, kept in their voice (milie@ walk: the raw fallback showed
// run-ons/fragments unpolished; set_gap is the primary tidy, this is the safety net so the fallback is never that raw).
export function tidyGapProse(s: string): string {
  let t = (s ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return t;
  t = t.replace(/\s+([.,;:!?])/g, '$1'); // no space before punctuation
  // a space after sentence-ending punctuation — but NOT when the period is part of a single-letter abbreviation
  // ("3 p.m.", "e.g.", "a.m.") — those are the member's own words, not a sentence boundary. (CAT-25)
  t = t.replace(/(?<!\b[a-z])([.!?])(?=[A-Za-z])/gi, '$1 ');
  t = t.replace(/([.!?]\s+|^)([a-z])/g, (_m, pre: string, ch: string) => pre + ch.toUpperCase()); // capitalize sentence starts
  return /[.!?]$/.test(t) ? t : `${t}.`; // a closing period
}

// THE ENGINE'S OWN RECEIPT for the gap close — used when the model gave none.
//
// receiveThen falls back to "opener alone if no receipt", and at this hand-in the model regularly answers a close
// with tool calls and no prose. So she finished describing her father's coma and read a scripted bridge straight
// into "add each thing below" — on roughly half of otherwise identical runs, because it depended on whether the
// model happened to produce text that turn. That inconsistency is the whole defect: the heaviest transition in
// onboarding cannot be conditional on the model's sentence shape.
//
// NOT SOLVED BY HOLDING THE BEAT. 4c5b416 removed exactly that — Jay's walk had the confirm refusing to close,
// "the engine stayed stuck in gap while the model moved on in its text, the stages desynced". The bias to advance
// is deliberate and stays.
//
// The pattern already exists one hand-in later: enterGrintaSurvey does receiveThen(b.modelText || reclaimReceipt(…)).
// This is the same idea for the hand-in that never had it — named from her COMMITTED Doors, so it is true by
// construction and specific to her without the model having to say anything.
function gapReceipt(c: Collected): string {
  // THE SHAPE, NOT THE LABELS. The first version of this named her Doors — "The Career Cliff, The Aging Parents
  // and The Relationship" — and a live walk protested it immediately. She had just described a job lost in a day,
  // a partner who was not in it with her, and her father in a coma; answering with three product categories
  // converts her life into our taxonomy at the one moment she needs to be heard. Specific, and in exactly the
  // wrong register.
  //
  // When the model DOES speak here it says "Those three, close together" — the count and the clustering, no
  // labels. That is the right instinct, so the fallback follows it rather than reaching for the words we happen
  // to have. The Doors get named plenty of places; this is not one of them.
  const n = doorsKnown(c).length;
  if (n < 2) return '';
  const word = ['', '', 'Two', 'Three', 'Four', 'Five', 'Six'][Math.min(n, 6)] ?? String(n);
  return `${word} things, close together.`;
}

// The reclaim-stage opener. If the member ALREADY parked wants earlier (front-loader), read them back —
// "earlier you said X — let's start there." True by construction, and the single best trust moment in the
// flow: it proves nothing was dropped. With nothing parked, it's the clean RECLAIM_OPEN.
function reclaimOpening(c: Collected): string {
  const parked = c.reclaimList ?? [];
  if (parked.length === 0) return reclaimOpen(c);
  const items = parked.map((x) => `“${x.trim()}”`).join(parked.length === 2 ? ' and ' : ', ');
  // §5 re-surface — read the parked want(s) back. The single best trust moment: it proves nothing was dropped.
  //
  // THE BRIDGE COMES FIRST. This branch used to open "Now, the good part —", which is the EXACT cold pivot the
  // bridge above was written to replace ("the gap beat is heavy, so we don't cold-pivot to 'Now, the good part.'").
  // The member has just finished describing the worst decade of their life; the receipt for their wants is not
  // the first thing they should hear. Warmth first, then the proof that nothing was dropped.
  //
  // It also now POINTS AT THE BUILDER. The old line ended on a bare "What else?" while the live surface is a
  // list-builder UI — an invitation with nowhere visible to answer it.
  return (
    `${gapToReclaimBridge(c)} And you've already started — earlier you said you want ${items} back, so ` +
    `${parked.length === 1 ? "that's" : "those are"} on your list. Add anything else below — big or small. ` +
    `There's no rush, and you can always add more later.`
  );
}

// §5 — reflect the Reclaim List back before the card; the member hears their own list, one confirm question.
// LIGHT acknowledgement — no re-listing. The final confirmation card is the single authoritative list view (it
// renders the consolidated list from `collected`), so the mid-conversation reflect only acknowledges + invites a
// last add. This kills the doubled list (reflect + card) and keeps the card as the one place under-tagging surfaces.
function reflectReclaim(_c: Collected): string {
  // Donna's phrasing — invite an edit to what's captured (not an open "anything missing?" that reads as pressure to
  // keep producing). The card is still the authoritative view; this only offers a last correction before we move on.
  return `Got it — that’s a strong list to build from. Want to make any edits to those, or does that feel like the shape of what you’d want back?`;
}

// The recite-mismatch guard's detector (Phase 2.2): is the model's turn RECITING/wrapping the Reclaim List in
// prose? Two+ bulleted lines, or an explicit "your reclaim list" / "here's what you want to reclaim". When it is,
// the engine reflects from the TAGS instead of letting that (possibly-untagged) phantom stand. Deliberately
// narrow so a normal one-line reflection isn't caught.
function modelRecitesList(text: string): boolean {
  const t = text ?? '';
  const bulletLines = (t.match(/\n\s*[-•*]\s/g) ?? []).length;
  return bulletLines >= 2 || /\byour reclaim list\b|\bhere'?s what you want to reclaim\b/i.test(t);
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
  return reclaimTokens(s).sort().join(' ');
}
function reclaimTokens(s: string): string[] {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !RECLAIM_STOPWORDS.has(w));
}
// A bare cadence/frequency fragment ("every day", "2-3 times a week", "twice a week") — NOT a standalone want but
// a DRILL of the previous one (Jay's walk: "Start walking every morning" + "Every day" landed as two sloppy
// items). When one is captured, the engine folds it into the last want instead of a standalone.
const BARE_MODIFIER_RE =
  /^(every\s+(day|morning|evening|night|week|weekend)s?|daily|weekly|nightly|on\s+weekends?|most\s+(days|mornings)|(a\s+few|once|twice|[1-9][0-9]?(\s*[-–to]+\s*[1-9][0-9]?)?)\s*(times?|x|days?|rides?|runs?|walks?|workouts?|sessions?|swims?|lifts?|classes?|rounds?)?\s*(a|per|each|\/)?\s*(day|week|morning|month)?)$/i;
// Rule 4 (Decision II): a bare cadence folds into its parent want. Tolerate trailing FILLER so "2-3 times a week
// to start with" folds too (Donna's walk — it was anchored too tightly before and survived standalone).
const CADENCE_FILLER_RE = /\s+(?:to (?:start|begin)(?:\s+with)?|to start off|for (?:now|a start)|at first|these days|initially)$/i;
function isBareModifier(s: string): boolean {
  const t = (s ?? '').trim().replace(/[.,!?]+$/, '').replace(CADENCE_FILLER_RE, '').trim();
  return BARE_MODIFIER_RE.test(t);
}
function isTokenSubset(a: string[], b: Set<string>): boolean {
  return a.length > 0 && a.every((x) => b.has(x));
}
// Append a want to `c`, keeping the list CLEAN (Jay's walk: repetitive + sloppy). Returns whether a genuinely NEW
// item landed (so the gather stage can tell a real offer from a dup/merge). Four cases, in order:
//   1. exact-token dup → skip;  2. bare cadence fragment → fold into the last want;  3. token-subset of / superset
//   of an existing want (a shorter/longer phrasing of the SAME want, e.g. "Lose 50 lbs" vs "My body, lose 50 lbs")
//   → keep the more complete one, never a second;  4. otherwise → a new item.
// A member sometimes WRAPS a want in a meta-request: "I'd like to add to the list. Have more energy…" / "can you add
// golf. Play golf weekends". The leading clause trips the reclaim detector AND mangles dedup (it stored the whole
// meta-sentence, so the real want was dropped — Jay's kids'-lives walk). Strip a leading add-request clause that ends
// at a sentence boundary, so CAPTURE sees the actual want. Narrow: only fires with a trailing . ! ? so bare wants
// like "add painting" are untouched. Pure + testable.
const RECLAIM_PREAMBLE_RE =
  /^\s*(?:i(?:['’]d| would)?\s+(?:like|want|love|need)\s+to\s+add\b[^.!?]*|(?:can|could|would)\s+you\s+(?:please\s+)?add\b[^.!?]*|please\s+add\b[^.!?]*)\s*[.!?]\s+/i;
export function stripReclaimPreamble(msg: string): string {
  const stripped = (msg ?? '').replace(RECLAIM_PREAMBLE_RE, '').trim();
  return stripped.length >= 3 ? stripped : (msg ?? '').trim(); // never strip down to nothing
}

// ── Decision II: the reclaim shape gate (propose/confirm, no silent rewrites) ─────────────────────────────────
// The SHAPE-specific half of a yes here — the verbs that only ever answer THIS proposal ("merge them", "as one",
// "move it to the Playbook"). Matched anywhere, not anchored, because they arrive mid-sentence ("yeah, merge them").
// The generic half ("absolutely", "that works", "go for it") comes from the shared commit vocabulary, which every
// gate now uses — this one was missing 10 of 12 ordinary confirms on its own.
const SHAPE_YES_RE = /\b(merge|combine|same|as one|one goal|move it)\b/i;
// A NO always wins over a yes here: the proposal is "shall I collapse/move this?", and any signal that they want
// both kept is a refusal, however warmly it's phrased. Losing a want is the expensive direction.
const SHAPE_NO_RE = /\b(no|nope|nah|different|separate|distinct|two goals?|keep both|leave (it|them|both)|it'?s a goal|keep it|not the same)\b/i;
export function saysYes(msg: string): boolean {
  const m = (msg ?? '').toLowerCase();
  if (SHAPE_NO_RE.test(m)) return false;
  return confirmsProposal(m, SHAPE_YES_RE);
}

// Remove the first item matching `item` (and its parallel category), returning true if one was removed.
function removeReclaimItem(c: Collected, item: string): boolean {
  const list = c.reclaimList ?? [];
  const i = list.findIndex((x) => x === item);
  if (i < 0) return false;
  c.reclaimList = [...list.slice(0, i), ...list.slice(i + 1)];
  const cats = c.reclaimCategories;
  if (cats && cats.length === list.length) c.reclaimCategories = [...cats.slice(0, i), ...cats.slice(i + 1)];
  return true;
}

const SHAPE_PROPOSAL = {
  overlap: (keep: string, drop: string) =>
    `“${drop}” and “${keep}” sound like the same thing to me — want me to keep them as one, or are they different?`,
  vision: (item: string) =>
    `“${item}” reads more like the bigger picture of the life you’re reclaiming than a single goal. I’d keep it in your Playbook for that work and leave the goal list for the concrete steps — want me to do that?`,
  identity: (item: string) =>
    `“${item}” sounds like who you are, not one goal on a list. I’d hold onto it as part of your identity and keep the list for the concrete things you’re taking back — want me to do that?`,
  multiwant: (item: string) =>
    `You named a few things in “${item}.” Which one do you most want back? We’ll start there — the rest aren’t going anywhere.`,
  // When the member enumerated the wants themselves, asking them to pick ONE would throw away the ones they didn't
  // pick. They already did the separating; all we need is permission to store it that way.
  multiwantSplit: (parts: string[]) =>
    `That came through as one entry, but you named ${numberWord(parts.length)} things in it: ${parts.map((p) => `“${p}”`).join(', ')}. Want me to list them separately?`,
} as const;

function numberWord(n: number): string {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] ?? String(n);
}

// Run the reconciliation over the assembled list; if an unaddressed shape exists, set it pending + return the
// member-facing proposal. Otherwise null (the list is clean — proceed to the normal confirm).
function gateNextShape(b: Beat): string | null {
  const issue = reconcileReclaimShapes(b.collected.reclaimList, new Set(b.reclaimShapesResolved));
  if (!issue) return null;
  if (issue.kind === 'overlap') {
    b.pendingReclaimShape = { kind: 'overlap', keep: issue.keep, drop: issue.drop };
    return SHAPE_PROPOSAL.overlap(issue.keep, issue.drop);
  }
  if (issue.kind === 'vision') {
    b.pendingReclaimShape = { kind: 'vision', item: issue.item };
    return SHAPE_PROPOSAL.vision(issue.item);
  }
  if (issue.kind === 'identity') {
    b.pendingReclaimShape = { kind: 'identity', item: issue.item };
    return SHAPE_PROPOSAL.identity(issue.item);
  }
  // If the member numbered the wants inside the item, offer the SPLIT rather than the draw-out. The draw-out asks
  // "which one do you most want back?" and keeps only that answer — correct when a want is tangled up in prose, but
  // lossy when the member has already told us there are three separate things.
  const parts = splitInlineEnumeration(issue.item);
  if (parts && parts.length >= 2) {
    b.pendingReclaimShape = { kind: 'multiwant', item: issue.item, parts };
    return SHAPE_PROPOSAL.multiwantSplit(parts);
  }
  b.pendingReclaimShape = { kind: 'multiwant', item: issue.item };
  return SHAPE_PROPOSAL.multiwant(issue.item);
}

// When two overlapping wants merge (member said "keep as one"), keep the CLEANER phrasing — not whichever was
// captured first. Before this, keep/drop were assigned purely by list position, so the model's "Theme — concrete"
// composition ("Fitness back — riding up to Brainard Lake") survived over the plain "Riding up to Brainard Lake"
// just because it came first. "Adorned" = a short leading clause + em/en dash preamble. Ties (both or neither
// adorned) keep `a`, the earlier item — preserving the prior conservative default. Pure + testable.
const THEME_PREAMBLE_RE = /^\s*[^—–]{1,32}\s+[—–]\s+\S/;
export function cleanerReclaimText(a: string, b: string): string {
  const aAdorned = THEME_PREAMBLE_RE.test(a ?? '');
  const bAdorned = THEME_PREAMBLE_RE.test(b ?? '');
  if (aAdorned && !bAdorned) return b; // a carries a "Theme —" preamble, b is clean → keep b
  if (bAdorned && !aAdorned) return a;
  return a; // tie → keep the earlier item (prior behavior)
}

// Apply the member's answer to a pending shape. Conservative by default: a want is NEVER lost — an ambiguous
// answer keeps both / keeps the item. Marks the shape resolved so it's never re-proposed. Returns the ack line.
function resolvePendingShape(b: Beat, pending: PendingReclaimShape): string {
  b.pendingReclaimShape = undefined;
  const yes = saysYes(b.memberMessage);
  const markResolved = (key: string) => { if (!b.reclaimShapesResolved.includes(key)) b.reclaimShapesResolved.push(key); };
  if (pending.kind === 'overlap') {
    markResolved(shapeKey({ kind: 'overlap', keepIndex: 0, dropIndex: 0, keep: pending.keep, drop: pending.drop }));
    if (yes) {
      // Keep the CLEANER of the two texts, not whichever came first — then drop the other.
      const keepText = cleanerReclaimText(pending.keep, pending.drop);
      removeReclaimItem(b.collected, keepText === pending.keep ? pending.drop : pending.keep);
      return 'Good — I’ll keep them as one.';
    }
    return 'Got it — I’ll keep both.';
  }
  if (pending.kind === 'vision') {
    markResolved(shapeKey({ kind: 'vision', index: 0, item: pending.item }));
    if (yes) {
      removeReclaimItem(b.collected, pending.item);
      b.collected.visionKeepers = [...(b.collected.visionKeepers ?? []), pending.item];
      return 'Kept — it’s in your Playbook for the bigger-picture work.';
    }
    return 'Okay — I’ll leave it on your list.';
  }
  if (pending.kind === 'identity') {
    markResolved(shapeKey({ kind: 'identity', index: 0, item: pending.item }));
    if (yes) {
      removeReclaimItem(b.collected, pending.item);
      // Revert of 5d683d2 (Jay 2026-07-26 — "vibe wins"): NEVER auto-seed identity_noun from a stated identity.
      // Committing an identity the member was never drawn out on and asked to confirm is the governance breach
      // ("named her without asking"). A confirmed identity-shape statement is preserved to the Playbook as their own
      // words; identity_noun is set ONLY through the real naming beat. A blank strip is recoverable; an unasked label
      // is not. (Completeness — seeding the strip when they clearly named themselves — is a follow-up we solve WITHOUT
      // touching the draw-out: draw out → ask → confirm → then commit.)
      b.collected.visionKeepers = [...(b.collected.visionKeepers ?? []), pending.item];
      return 'Kept — it’s part of who you are, held in your Playbook.';
    }
    return 'Okay — I’ll leave it on your list.';
  }
  // multiwant: the member's message IS their distilled want (draw-out answer). Replace the paragraph with it when
  // it reads as a real want; otherwise leave the paragraph (they can edit on the card).
  markResolved(shapeKey({ kind: 'multiwant', index: 0, item: pending.item }));
  // The SPLIT branch: they enumerated the wants and we offered to separate them. On yes, every part becomes its own
  // item — nothing they named is dropped. On no, the entry stays exactly as they wrote it.
  if (pending.parts?.length) {
    if (yes) {
      removeReclaimItem(b.collected, pending.item);
      for (const part of pending.parts) appendReclaim(b.collected, part);
      return `Done — they’re ${pending.parts.length} separate items now.`;
    }
    return 'Okay — I’ll leave it as you wrote it.';
  }
  const distilled = stripReclaimPreamble(b.memberMessage);
  // Contract 3: a meta reply to the multi-want (a protest / "you're glitching" / "not an item") is NOT their distilled
  // want — never echo it as "Perfect — X it is" and re-pose (Donna's #17 loop). The shape is already markResolved above,
  // so it won't re-propose; we just decline to capture the meta.
  if (shouldCaptureStagedReclaim(distilled) && !correctsReflection(b.memberMessage) && !isProcessMetaOrAssent(distilled)) {
    removeReclaimItem(b.collected, pending.item);
    appendReclaim(b.collected, distilled);
    return `Perfect — “${distilled}” it is.`;
  }
  return 'No rush — we can shape that one together anytime.';
}

// W-42 — the reclaim SHAPE GATE. Scott's cold walk committed his exit line "that's the end can i continue later?" as a
// Reclaim item. Members STATE life-wants; they don't ask the agent questions or type navigation/assent. This rejects
// SESSION-meta (pause/continue-later/how-long), bare assent/dissent, and agent-directed questions — WITHOUT touching real
// behavior-change wants ("stop drinking", "quit smoking" have an object, so they pass). Pure + testable.
const RECLAIM_ASSENT_RE = /^(ok(ay)?|yes|yeah|yep|yup|no|nope|nah|sure|fine|done|next|maybe|idk|dunno|i don'?t know|nothing( else)?|that'?s it|thanks?|thank you)[.!?]*$/i;
const RECLAIM_META_EXIT_RE = /\b(continue (this )?later|come back (to (this|it) )?later|can (i|we) (continue|stop|pause|finish|do (this|the rest)) (later|another time|now)?|that'?s (the end|it for now|all for now|enough( for now)?)|i'?m done( (for now|for today|here))?|stop (here|now|for now|there|for today)|pause (here|for now)|(finish|do) (this|the rest) later|quit (for now|this)|take a break|are we (done|finished|almost done)|how (long|much longer|many more)|what'?s next|not right now)\b/i;

// Agent-directed protest/complaint — the member is talking TO or ABOUT the Companion, not naming a want (Donna's
// walk: "I feel like you are glitching", "Hey G4L companion, I'm trying to tell you something, not document an item for
// my Reclaim List" — both got committed as items and re-asked as multi-wants, looping). Deliberately narrow to
// agent-meta phrasings so it can never swallow a real want (no life-goal says "glitching" or "hey companion").
const RECLAIM_AGENT_META_RE =
  /\b(glitch(ing|ed|y)?|you'?re (broke|broken|bugg(y|ing)|malfunction(ing)?|not (working|listening))|document(ing)? an? (item|entry)|not (a|an) (reclaim[- ]?)?(item|entry|goal)\b|hey,? (g4l|companion)\b|g4l companion|trying to (tell|say) you|talking (to|at) you|you (misunderstood|did\s?n['’]?t (get|understand) (me|this|that)))\b/i;

// An answer to one of OUR OWN shape proposals ("want me to keep them as one, or are they different?"). Jennifer's
// walk (2026-07-30) committed "We can keep them as one." to her Reclaim List as a life-want. Same shape as Scott's
// exit line and Donna's protest: a reply ABOUT the process, promoted to a want. The structural fix is that a pending
// shape now owns its turn so these never reach the append path at all — this is the belt to that suspenders, living
// at the one chokepoint so it holds on any future path too. Whole-string anchored and deliberately narrow: a real
// want is a life goal, and essentially never has the exact shape "keep/merge <them|both> ...".
const RECLAIM_PROPOSAL_ANSWER_RE =
  /^(yes|no|nope|nah|sure|ok(ay)?)?[,.\s]*(((we|you|i)\s+(can|could|should|)\s*)?(please\s+)?(keep|merge|combine)\s+(them|those|these|both|it)(\s+(as|in)\s+one|\s+together|\s+both|\s+separate(ly)?|\s+apart)?|(they'?re|they are|those are|it'?s)\s+(the\s+same|different|separate|distinct))[.!]*$/i;

// True if `text` is session-meta / assent / a proposal answer / an agent-directed question — never a real Reclaim want.
export function isProcessMetaOrAssent(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return true;
  if (RECLAIM_ASSENT_RE.test(t)) return true;
  if (RECLAIM_META_EXIT_RE.test(t)) return true;
  if (RECLAIM_PROPOSAL_ANSWER_RE.test(t.replace(/[‘’]/g, "'"))) return true; // an answer to our own shape proposal (Jennifer's)
  if (isReclaimMetaFragment(t)) return true; // confusion / "this isn't making sense" — never a want
  if (RECLAIM_AGENT_META_RE.test(t.replace(/[‘’]/g, "'"))) return true; // agent-directed protest/complaint — never a want (Donna's #2/#17)
  // A question aimed at the agent: starts with a question/modal word AND ends with '?'. (A real want is declarative;
  // "riding again?" starts with a noun so it's spared.)
  if (/\?\s*$/.test(t) && /^(can|could|should|would|will|do|does|did|is|are|am|how|what|when|where|why|may|shall)\b/i.test(t)) return true;
  return false;
}

function appendReclaim(c: Collected, item: string, category = ''): boolean {
  const trimmed = item.trim();
  // The ONE chokepoint that turns text into a list item — so the "never capture a confirmation" rule holds on EVERY
  // path (gather backstop, forceProgress, confirm late-add). isProcessMetaOrAssent catches bare assent; affirmsReflection
  // catches the confirm-the-shape family ("those feel right") that slipped through and landed as Blair's goal.
  if (isProcessMetaOrAssent(trimmed) || affirmsReflection(trimmed)) return false;
  const key = reclaimKey(trimmed);
  if (!key) return false;
  const list = c.reclaimList ?? [];
  if (list.some((x) => reclaimKey(x) === key)) return false; // 1. exact-token dup
  if (isBareModifier(trimmed) && list.length > 0) {
    // 2. drill fragment → fold into the previous want, don't stand alone.
    const merged = [...list];
    merged[merged.length - 1] = `${merged[merged.length - 1]}, ${trimmed}`;
    c.reclaimList = merged;
    return false;
  }
  const newTokens = reclaimTokens(trimmed);
  const newSet = new Set(newTokens);
  for (let i = 0; i < list.length; i++) {
    const exTokens = reclaimTokens(list[i]!);
    if (isTokenSubset(newTokens, new Set(exTokens))) return false; // 3a. existing already covers the new one
    if (isTokenSubset(exTokens, newSet)) {
      // 3b. new is the more complete phrasing → replace in place (list length unchanged, categories stay aligned).
      const replaced = [...list];
      replaced[i] = trimmed;
      c.reclaimList = replaced;
      return false;
    }
  }
  c.reclaimList = [...list, trimmed]; // 4. a genuinely new want
  c.reclaimCategories = [...(c.reclaimCategories ?? []), category];
  return true;
}

// ── Decision II follow-on (Donna's numbered-entry): split a member's reclaim message into DISTINCT wants when they
// gave EXPLICIT list structure — numbered markers ("1. …  2. …  3. …") or bullets ("- …"). This moves the "what is
// an item" decision OFF the fuzzy model and onto deterministic engine parsing: the member structures, the engine
// splits, so a multi-want turn lands as clean separate items instead of one run-on paragraph (the milie/Marcus/Donna
// shape: "1. Lose 20 lbs 2. Go to yoga 3. Ride my bike" became a single item, then the multiwant gate looped on it).
// Deliberately CONSERVATIVE: only splits on explicit markers, never guess-splits a prose sentence on "and"/commas
// (a false split is worse than a run-on the shape gate can still catch). A leading segment before the first marker is
// preamble ("For my list please state…"), not an item, so it's dropped. Prose with no markers → the whole want,
// unchanged. Pure + testable; each split item still flows through appendReclaim's dedup/fold/subset guards.
const RECLAIM_ITEM_MARKER_RE = /(?:^|\s)[([]?\d{1,2}[.):\]–-]\s+|(?:^|\n)\s*[-•*]\s+/g;
const RECLAIM_STARTS_WITH_MARKER_RE = /^\s*(?:[([]?\d{1,2}[.):\]–-]|[-•*])\s+/;
export function parseReclaimItems(message: string): string[] {
  const raw = (message ?? '').trim();
  if (!raw) return [];
  const markers = raw.match(RECLAIM_ITEM_MARKER_RE) ?? [];
  if (markers.length >= 2) {
    const parts = raw.split(RECLAIM_ITEM_MARKER_RE);
    // Drop the pre-first-marker segment unless the message itself opens on a marker (else it's a preamble, not an item).
    const segs = RECLAIM_STARTS_WITH_MARKER_RE.test(raw) ? parts : parts.slice(1);
    const cleaned = segs.map((s) => stripReclaimPreamble(s.trim())).filter((s) => s.length >= 3);
    if (cleaned.length >= 2) return cleaned;
  }
  // Single want: strip a leading list marker too (a member who types just "1. Get back on real trails" shouldn't
  // store the "1." prefix), but never strip down to nothing.
  const single = raw.replace(RECLAIM_STARTS_WITH_MARKER_RE, '').trim();
  return [stripReclaimPreamble(single.length >= 3 ? single : raw)];
}

// Append EVERY want the member structured this turn (numbered/bulleted → each; plain prose → the one). Returns whether
// any genuinely new item landed. Single point so the gather backstop, forceProgress, and the confirm late-add all
// split identically.
function appendReclaimItems(c: Collected, message: string): boolean {
  let grew = false;
  for (const item of parseReclaimItems(message)) if (appendReclaim(c, item)) grew = true;
  return grew;
}

// The list-builder's submission: one item per line (the builder controls the format — single-line entries, each
// optionally sent with a "• " / number prefix for a nice member bubble). Deterministic — split on newlines, strip a
// leading marker, keep the member's exact words. This is the whole capture: no model, nothing to drop.
export function parseReclaimListSubmission(message: string): string[] {
  return (message ?? '')
    .split(/\r?\n+/)
    // STRIP REPEATEDLY, not once. The builder prefixes every field with "• ", so a member who types their own
    // dash inside a field submits "• - a creative role…" — one strip leaves the dash, and it then shows on her
    // dashboard and gets quoted back to her by the Companion for the rest of the program. (Donna, 2026-08-18:
    // two of her three items carried it.) Bounded so this can only ever remove list scaffolding, never words:
    // a want that genuinely begins with a marker character does not survive three of them.
    .map((line) => {
      let t = line;
      for (let i = 0; i < 3; i++) {
        const stripped = t.replace(/^\s*(?:[([]?\d{1,2}[.):\]–-]|[-•*])\s*/, '');
        if (stripped === t) break;
        t = stripped;
      }
      return t.trim();
    })
    .filter((line) => line.length > 0)
    // A member can put a whole numbered list INSIDE one field ("My goals: 1. … 2. … 3. …"). Splitting on newlines
    // alone turned that into a single blob item, and the goals inside it were unreachable — nothing downstream could
    // see them, tick them off, or notice when the member later re-typed one by hand as a duplicate. They enumerated
    // it themselves; take them at their word rather than making them re-enter it. (Jennifer, 2026-08-05.)
    .flatMap((line) => splitInlineEnumeration(line) ?? [line]);
}

// Is this turn a structured Reclaim-builder submission? The builder (app/onboarding/reclaim-list-builder.tsx) submits
// every item as a "• "-prefixed line, which no conversational reply looks like — so a bullet-led line is the reliable
// signal that the member used the builder (→ verbatim/authoritative capture + floor), vs the retired conversational path.
function isBuilderSubmission(message: string): boolean {
  return /^[ \t]*•/m.test(message ?? '');
}

// CAT-18 — a STRUCTURED LIST typed anywhere it wasn't expected. Broader than isBuilderSubmission (which detects our
// own builder's "• " submissions): this catches a member pasting their own bulleted or numbered block into a
// free-text gate. Requires TWO marked lines, so an ordinary sentence that happens to start with "1." or a dash
// can't be mistaken for a list.
const LIST_LINE_RE = /^[ \t]*(?:[-•*]|\(?\d{1,2}[.):\]])\s+\S/;
export function isListBlock(message: string): boolean {
  const marked = (message ?? '').split(/\r?\n/).filter((l) => LIST_LINE_RE.test(l));
  if (marked.length >= 2) return true;
  // …or the same list typed on ONE line ("1. lifting 2. walk daily 3. sleep"). Line-led markers were the only shape
  // this recognised, so an inline list fell through to free-text and was captured whole.
  return (message ?? '').split(/\r?\n/).some((l) => splitInlineEnumeration(l) !== null);
}

// The structured Reclaim List builder is an onboarding-only turn: whenever the machine is in the reclaim stage (and not
// yet complete), tell the client to render the list builder — pre-filled with any wants volunteered earlier — instead
// of the text box or the scale chips. Once submitted, the stage advances to 'grinta', so this stops firing. Everything
// else defers to the scale-chip expectation.
function nextExpects(arc: ArcConfig, stageId: StageId, complete: boolean, answered: number, collected: Collected, awaitingConfirm = false): Expectation | undefined {
  // THE GAP CONFIRM OFFERS ITS OWN ANSWERS (2026-08-19). We reflect her whole story and ask "have I got the shape
  // of it — or is there more?", then classified her free-text reply three ways with regex vocabulary. Five patches
  // in two days and it still leaked; one attempt matched "I said yes to the trip that summer", which would have
  // closed her story mid-sentence. A tap is a fact. See lib/agent/gap-confirm-choice.ts.
  //
  // ONLY WHEN THE BEAT IS ACTUALLY WAITING ON HER. Mid-draw-out the question is the model's own, and offering
  // "that's the whole of it" while she is still telling it would be the surface asking her to stop.
  if (arc.id === 'onboarding' && stageId === 'gap' && awaitingConfirm && !complete) {
    // SHE SEES WHAT WE HEARD, by name, BEFORE she agrees. We tag Doors by matching her prose and then assert them;
    // Jennifer got The Marriage from her FATHER'S divorce in a story where she also said "my marriage is fine".
    // Showing them here turns the riskiest inference in the product into something she rules on.
    return {
      kind: 'gap_confirm',
      choices: GAP_CONFIRM_CHOICES.map((c) => ({ value: c.value, label: c.label })),
      // THE PROPOSAL, not her record. These are Doors we have inferred and not yet asserted — this line is the
      // asking. Anything already in `collected.doors` was confirmed at an earlier pass of this same gate and is
      // deliberately absent: re-offering a Door she has already ruled on reads as not having listened.
      // THE DESCRIPTOR RIDES WITH THE NAME (Jay, mid-walk 2026-08-25). He was shown "The Grind" and had to ASK
      // the Companion what it meant — mid-intake, about a Door we had just told him was his. The sentence that
      // answers him already exists on every Door and already ships to R2's board; only this surface withheld it.
      // The Doors CONCEPT is explained twice before this beat; the individual names never were, and a name we
      // assert without meaning is the one thing this gate exists to prevent.
      doorsHeard: (collected.doorsProposed ?? []).map((slug) => {
        const d = DOORS.find((x) => x.slug === slug);
        return {
          slug: slug as string,
          name: d?.displayName ?? (slug as string),
          descriptor: d?.descriptor,
        };
      }),
    };
  }
  // THE BUILDER OPENS WITH THE FRAME (2026-08-22, widget-first). It used to wait for `drawnOut` — a six-turn
  // conversation that elicited items and seeded the form with them. That seeding is what carried Donna's
  // conversational turns into her committed list, so the conversation in front of it is gone and the frame does
  // the eliciting instead.
  //
  // THE 2026-08-19 NOTE THIS REPLACES said a form arriving before she had said anything is "structure doing the
  // ELICITING", and that was true of the form ALONE. It is not true of a frame that names her Door and asks what
  // her Identity used to do — the question is asked, and the form is where she answers it.
  //
  // SEEDING IS LEFT IN, and for one reason only: a member already mid-onboarding when this deploys has draw-out
  // captures sitting in `collected.reclaimList`, and an empty builder would vanish them. Nothing writes to that
  // field any more, so it is [] for everyone who starts after this. The v3.4.27 seed filter stays for the same
  // window — it is what stops an in-flight member's captured protests from arriving pre-ticked.
  // No recap flag needed: the submission advances the stage to `grinta` in the same turn, so a later turn is
  // never `reclaim` unless she is still below the floor — where re-showing the builder is exactly right.
  if (arc.id === 'onboarding' && stageId === 'reclaim' && !complete) {
    return { kind: 'reclaim_list', min: RECLAIM_LIST_MIN, seeded: reclaimSeedList(collected) };
  }
  // THE DOORS BOARD. Reconnect's doors stage opens with the framing and the board TOGETHER — recognition
  // before conversation, so the Companion draws out what she marked instead of fishing for it. Emitted only
  // while the board is still unanswered: once she submits, `boardDone` is set and the stage becomes the ordinary
  // draw-out, or the board would reappear under every subsequent turn of that conversation.
  if (arc.id === 'reconnect' && stageId === 'doors' && !complete && !collected.boardDone) {
    return doorsBoardExpectation(collected.doors ?? []);
  }
  return scaleExpects(arc, stageId, complete, answered);
}

// At the CONFIRM gate (after the list is reflected — "want to make edits, or does that feel like the shape?"), the
// engine — not the model — must not mistake an AFFIRMATION of the reflection for a new want. The assent regex only
// catches bare "yes/ok/fine"; it missed Blair's "Those feel right", which then landed as a goal. This recognizes the
// bounded family of confirm-the-shape replies ("those feel right", "that works", "looks good", "that's the shape",
// "no changes", "leave them", "perfect") so they advance instead of capturing. A genuine bare want ("play golf",
// "swimming") does NOT match — those still capture. Only used at the confirm gate, not the gather.
const RECLAIM_AFFIRM_RE =
  /^\s*(?:(?:those|these|that|they|it)\s+(?:feel|feels|look|looks|sound|sounds|seem|seems|are|is|work|works)\b|(?:that'?s|those are|these are)\s+(?:right|good|great|perfect|it|the\s+(?:shape|list|ones?)|all|everything)\b|(?:looks?|sounds?|feels?)\s+(?:right|good|great|perfect|complete)\b|(?:perfect|great|exactly|correct|agreed|spot\s*on)\b|no\s+(?:edits?|changes?|more)\b|nothing\s+(?:to\s+(?:add|change|edit)\b|else\b|missing\b)|(?:just\s+)?leave\s+(?:it|them|as)\b|keep\s+(?:it|them)\b)/i;
export function affirmsReflection(message: string): boolean {
  return RECLAIM_AFFIRM_RE.test((message ?? '').trim());
}

/**
 * ONBOARDING — grow the Door PROPOSAL from the story so far, without touching what she has already confirmed.
 *
 * Wraps augmentDoors (model tags ∪ the regex backstop, then the Full House / Empty Nest disambiguation) and adds
 * the one rule the propose→confirm split needs: a Door she has already ruled on never returns to the pending set.
 * Without it, every later turn would re-propose the Door she just took off, and the ✕ would look broken.
 */
function proposeDoors(c: Collected, corpus: string): DoorSlug[] {
  const confirmed = new Set(c.doors ?? []);
  return augmentDoors(c.doorsProposed ?? [], corpus).filter((d) => !confirmed.has(d));
}

// --- capture merge (the per-field tools' result, merged into Collected) ---------------------------------
// The model's turn carries the per-field captures already merged into a Partial<Collected> (parseStagedTurn
// does this on the live path; fixtures provide it directly). Only the early-beat fields exist in slice a.
/**
 * What a `note_door` tag is ALLOWED to do this turn.
 *
 *   'commit'  — write straight to `doors`. Every arc but onboarding: by then the set has been through the intake
 *               gate or the R2 board, and those arcs have their own confirms.
 *   'propose' — onboarding, IN the gap stage: park it in `doorsProposed` for her to rule on at the confirm.
 *   'ignore'  — onboarding, PAST the gap stage: the tool is offered on every turn, so the model can tag a Door
 *               during the Reclaim List or the survey. There is no gate left to rule at, so the tag is dropped
 *               here rather than parked and swept later. Dropping it at the door (rather than merging it and
 *               clearing it downstream) is what keeps the STALL DETECTOR honest: `grew` compares this turn's
 *               Doors against last turn's, and a tag that lands and is then wiped every turn reads as fresh
 *               progress forever — which would quietly disable the runaway backstop for a drifting member.
 */
type DoorPolicy = 'commit' | 'propose' | 'ignore';

function doorPolicyFor(arcId: string, stage: string | undefined): DoorPolicy {
  if (arcId !== 'onboarding') return 'commit';
  return stage === 'gap' ? 'propose' : 'ignore';
}

function mergeStaged(prev: Collected, rec?: Partial<Collected>, memberMaterial = '', policy: DoorPolicy = 'commit'): Collected {
  if (!rec) return prev;
  // WHOSE LIFE — drop a Door the member's own words contradict before it is ever stored. The model tagged Jennifer
  // with Marriage from her FATHER'S divorce, in a story where she also said "My marriage is fine"; the prompt rule
  // alone did not hold. Doors are shown to the member at intake, so a mis-attributed one tells them to their face
  // that the wrong thing opened their Fade. Evidence is the member's material only — never the model's reflections.
  // Filter the ACCUMULATED set, not just the incoming one. The model tags a Door the moment it hears a cue — often
  // turns before the member gets to "…that was his marriage, not mine". Filtering only on the way in meant Jennifer's
  // Marriage tag was already stored by the time she said it, and nothing looked at it again. The member's words
  // outrank the guess whenever they arrive, so this re-runs every turn against everything they've told us.
  const material = [prev.gap ?? '', rec.gap ?? '', memberMaterial].filter(Boolean).join('\n');
  // WHICH FIELD THE TAGS ACCUMULATE IN. In onboarding they are a PROPOSAL (`doorsProposed`) until the member
  // rules at the gap confirm — see Collected.doorsProposed for why. Every other arc writes `doors` directly,
  // because by the time they run, every Door in the set has already been through that gate or the R2 board.
  const bucket: 'doors' | 'doorsProposed' = policy === 'propose' ? 'doorsProposed' : 'doors';
  const held = prev[bucket];
  // 'ignore' — the model's tags are dropped; anything already in the bucket is left exactly as it is.
  const incoming = policy === 'ignore' ? undefined : rec.doors;
  const union = incoming !== undefined || held !== undefined
    ? Array.from(new Set<DoorSlug>([...(held ?? []), ...(incoming ?? [])]))
    : undefined;
  // Never re-propose a Door she has already confirmed — it is hers, and offering it back as a question would
  // read as the product having forgotten. (No-op outside onboarding, where the two sets are the same one.)
  const confirmed = new Set(policy === 'propose' ? prev.doors ?? [] : []);
  const tagged = union !== undefined
    ? filterDoorsByAttribution(union, material).filter((d) => !confirmed.has(d))
    : undefined;
  const next: Collected = {
    ...prev,
    ...(rec.athleticPast !== undefined && { athleticPast: rec.athleticPast }),
    ...(rec.identityNoun !== undefined && rec.identityNoun !== '' && { identityNoun: displayIdentityNoun(rec.identityNoun) }),
    ...(rec.identitySkipped === true && { identitySkipped: true }),
    ...(rec.gap !== undefined && rec.gap !== '' && { gap: rec.gap }),
    // Doors accumulate — one note_door call per Door; union with what we already have (never drop one).
    ...(tagged !== undefined && { [bucket]: tagged }),
  };
  // Reclaim items accumulate in lockstep with their categories, DEDUPED — an item volunteered early (front-loader)
  // parks here in the moment (never lost, re-surfaced at its stage), and a model re-tag of a listed want is a no-op.
  if (rec.reclaimList !== undefined) {
    // THE ONE PLACE MODEL-AUTHORED TEXT BECOMES A LIST ITEM — which is why the voice check lives HERE and not in
    // appendReclaim. That function is shared: the retired conversational path and the runaway backstop both feed
    // it the MEMBER'S own message text, and applying a "she'd never say this" rule to something she actually said
    // would be the very inversion we keep having to undo. Provenance is the whole basis of the check, so it has
    // to sit where provenance is known. (Donna, 2026-08-19 — see lib/agent/reclaim-voice.ts.)
    rec.reclaimList.forEach((item, i) => {
      if (isModelVoiced(item)) {
        // THE VOICE IS THE MODEL'S. THE WANT IS HERS. Do not confuse the two.
        //
        // This used to `return` — the item was discarded outright. That got the first half right (a sentence the
        // model composed must never be stored as her words) and the second half exactly backwards: it threw away
        // the want along with the phrasing. "Get your fitness back" is the model's wording of something she
        // actually said, and dropping it means the builder opens WITHOUT it, so she either types the same thing
        // twice or never notices it is gone. That is the ~30% loss the builder was built to end, reintroduced by
        // a guard written to protect capture. Two of Donna's three wants were this shape (2026-08-20).
        //
        // So it is held as a SEED: it rides into the builder as a proposal, where what she submits is
        // authoritative and verbatim. Never committed on the model's say-so, never lost. Propose → confirm.
        const seeds = (next.reclaimSeeds ??= []);
        if (!seeds.some((s) => s.toLowerCase() === item.toLowerCase())) seeds.push(item);
        return;
      }
      appendReclaim(next, item, rec.reclaimCategories?.[i] ?? '');
    });
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
  // The Door conversation earns its time (Jay + Greg, 2026-07-14): it is rare for ONE door to be the whole story, so
  // the "already rich, don't trap" escape needs a FULLER picture — two or more doors named — not a single long answer.
  // A genuine one-door member still advances the moment they signal done (memberPushedPast); the very-long-narrative
  // fallback (2× the rich-char floor) is only a safety valve so an exhausted member is never trapped mid-story.
  if (stage === 'gap')
    return gapIsNarrative(c.gap, c.reclaimList ?? []) && (doorsKnown(c).length >= 2 || (c.gap ?? '').length >= GAP_RICH_CHARS * 2);
  return (c.reclaimList?.length ?? 0) >= RECLAIM_LIST_MIN; // several wants already on the table
}

// ESCAPE 2 — MEMBER-PUSHED-PAST (the terse member): after an honest invitation they decline / signal done /
// won't add more. Advancing here honors them instead of trapping — the analog of v1's `memberDone`.
function memberPushedPast(stage: StagedStage, message: string, c: Collected): boolean {
  if (stage === 'identity') return c.identitySkipped === true || memberDeflecting(message);
  // memberSaysWeRepeated fires here too: the GATHER gate and the CONFIRM gate are two different close
  // detectors, and every earlier agreement fix went into the confirm one — so a member closing mid-draw-out was
  // never covered. See lib/agent/onboarding-intent.ts.
  if (stage === 'gap') return memberSignalsGapComplete(message) || memberSaysWeRepeated(message) || memberDeflecting(message);
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

export type StageId = string;
// 'coach' (v2.4 Rebuild B3, Decision PP) — a THIRD mode alongside draw-out + administered. The model owns the
// coaching conversation (elicit → make specific → right-size, one move per turn); the engine holds a plan-COMPLETENESS
// contract (never completes until the plan's fields are present + the member confirms). Runs off the depth kernel,
// like administered. Reusable — Reclaim (quality-days) + Cycle 2 (deepening) run on it too.
export type StageMode = 'drawout' | 'administered' | 'coach';

// A stage's private counter bag — a loose key/value map. Each stage reads/writes its OWN keys through a typed
// view (IdentityScratch/GapScratch/ReclaimScratch below), so ConvState carries ONE `stageScratch` map instead of
// a flat field per counter that would sprawl as arcs multiply (Phase 1 step 0).
type StageScratch = Record<string, number | boolean | undefined>;
interface IdentityScratch { identityTurns?: number; identityProbes?: number; confirmBounces?: number;
  /** CAT-54: failed pick re-prompts, so this beat can't loop forever like it did fifteen times in walk 3. */
  pickMisses?: number }
interface GapScratch {
  gapTurns?: number;
  gapDepth?: number;
  noFade?: boolean;
  confirmBounces?: number;
  /**
   * The engine REJECTED the model's reflect_gap and kept this beat open (the depth floor).
   *
   * Recorded because the override was previously INVISIBLE to the model: we take its turn, append our own
   * drawing-out question to it, and send that. Next turn the model reads its own message back with our question
   * attached as though it wrote it — so it believes the gap closed, and the next natural move is the Reclaim
   * List. The engine is still in `gap`, so the authored bridge, the builder and the parked read-back all
   * silently do not happen. Every onboarding "rush" today traces back here.
   */
  gapHeld?: boolean;
}
interface ReclaimScratch {
  reclaimNudged?: boolean;
  confirmBounces?: number;
  /** The conversation is finished, so the builder may open to CONFIRM it. */
  drawnOut?: boolean;

  /** Draw-out turns so far — bounded by RECLAIM_DRAWOUT_MAX so it can never become a "what else?" march. */
  drawTurns?: number;
  /** Set by the runaway backstop when it ends a thin draw-out: gather owns the handoff, the backstop only calls it. */
  forced?: boolean;
}

// SHARED anti-loop contract for the CONFIRM phase (torture harness, 2026-07-26). Every gather stage's GATHER phase is
// bounded by its own floor/cap, but each stage's CONFIRM re-opened forever when a rambling member's reply never reads
// as a clean "done" — identity: repeated dispute → reopen; gap: every reply an 'addition'; reclaim: every reply a
// late-want / change. Same shape, three places → one contract, not three ad-hoc ceilings (CLAUDE.md "fix the pattern").
// Count each NON-done re-open; past the ceiling, take the stage's own advance path (content already captured — the
// card is the backstop). The model still owns the drawing-out; this fires ONLY on a genuine loop. Deliberately does
// NOT count Decision-II shape-proposal turns (those are finite by construction — one per shape).
const CONFIRM_BOUNCE_CEILING = 4;
function confirmBounceExceeded(s: { confirmBounces?: number }): boolean {
  s.confirmBounces = (s.confirmBounces ?? 0) + 1;
  return s.confirmBounces > CONFIRM_BOUNCE_CEILING;
}

// The mutable per-turn working state handed to every stage handler: the merged captures, the CURRENT stage's
// scratch bag, and the control fields a handler sets. A handler mutates it in place OR returns a terminal Turn
// (the decline off-ramp and the runaway force-progress use the early return).
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
  idleTurns: number; // the cross-stage runaway counter (kernel-level, not per-stage)
  scratch: StageScratch; // the CURRENT stage's counter bag (mutated in place by the handler)
  readonly baseScratch: Record<string, StageScratch>; // the incoming full map, so OTHER stages' scratch is preserved
  readonly stageAtEntry: StageId; // the stage whose scratch `scratch` belongs to — where it persists (handlers may advance b.stage)
  // §2b Reconnect revision (Decision L) — threaded across the propose→confirm turns; arc-specific, optional (only the
  // Reconnect doors beat sets them). pendingRevision is cleared on resolve; reseeingTells accumulates confirmed tells.
  pendingRevision?: DoorRevision;
  reseeingTells: ReseeingTell[];
  administeredResponses: number[]; // §2c: fixed-scale responses accumulated by an administered stage (IDQ/Grit)
  pendingHarvest: HarvestSignal[]; // §2d: keeper/share candidates queued for the action to emit
  driftPayload?: string; // §2d: the member's drift declaration, carried reflect→confirm
  // R3 Legacy Letter — threaded across the draft→revise→confirm turns, exactly like driftPayload. All three MUST
  // appear in the write-back below or the draft vanishes between turns and the member is asked to revise a letter
  // the engine no longer holds (mutating-state-vanishes-over-the-wire: the tell is that only the first write
  // survives). legacyLetter is set ONLY on their confirm and is what the action persists.
  legacyDraft?: string;
  legacyRevisions?: number;
  legacyTuesday?: string;
  /** Doors board: her Doors-board submission, handed to the ACTION to persist (the engine stays pure). */
  boardSubmission?: unknown;
  legacyLetter?: { body: string; datedFor: string };
  pendingReclaimShape?: PendingReclaimShape; // Decision II: a shape awaiting the member's confirm (merge/move/draw-out)
  reclaimShapesResolved: string[]; // Decision II: keys of shapes already ruled on — never re-proposed
  pendingIdentityPick?: string[]; // identity tap-to-pick: candidate words offered LAST turn, awaiting the member's choice
  expects?: Expectation; // a structured turn a handler emits directly (identity chips); else nextExpects() computes it
  // A picture this stage wants drawn beside its text. Set by the stage; passed straight through to the Turn and
  // then stored on the message, because it is part of what was said (lib/agent/session-visual.ts).
  visual?: SessionVisual;
}

// A stage handler mutates the Beat (sets b.reply etc.) or returns a terminal Turn. `resolveConfirm`'s CONTRACT
// (its use inside a stage's confirm handler) carries the VERBATIM-REFLECTION GATE: a draw-out beat advances only
// on a substantive reflection quoting the member's own words (today via the reflect_gap prompt + reflectGap) —
// preserved as a contract so the Phase 2 regex→model-signaled swap keeps it.
type StageHandler = (b: Beat) => Turn | void;

export interface StageDef {
  id: StageId;
  mode: StageMode;
  opener: (c: Collected) => string; // the reply when the machine ADVANCES into this stage
  offersSubstance: (message: string, c: Collected) => boolean; // did the member contribute this turn? (idle counter)
  gather: StageHandler; // not awaitingConfirm, in this stage (DRAW-OUT stages)
  confirm: StageHandler; // awaitingConfirm in this stage (DRAW-OUT stages)
  forceProgress?: StageHandler; // the runaway backstop's per-stage action (early-return Turn, or mutate + fall through)
  administer?: StageHandler; // ADMINISTERED stages (§2c: validated instruments) — runs OFF the depth kernel (below)
  coach?: StageHandler; // COACH stages (B3, Decision PP) — model coaches, engine holds the completeness contract; OFF the kernel
  scale?: { max: number; minLabel: string; maxLabel: string; itemCount: number }; // W-24/W-48: an administered stage's fixed Likert scale + anchors + length, so the kernel emits a ScaleExpectation (incl. "n of total") for the chip surface
}

export interface ArcConfig {
  id: string;
  stageOrder: StageId[];
  stages: Record<StageId, StageDef>;
  onComplete: (c: Collected) => string; // the completion reply (the card / the earned ceremony)
}

// --- The SHARED administered-beat component (lifted so ANY arc reuses it: reconnect IDQ §2c, onboarding Grinta,
// the §2e Checkpoint grit items). A validated instrument runs OFF the depth kernel — the generic loop is
// parse a 1–5 → accumulate → deliver the next framed item → on the LAST item, hand off (the arc's onComplete
// closure sets the reply + next stage; the ACTION scores + persists). Everything instrument-specific (opener,
// items, count, frames, completion) lives in the config; the loop lives here, once.
const LIKERT_NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
// Parse a Likert reply to an integer in [1, max]. `max` defaults to 5 (the IDQ / Grinta scale — every existing caller
// is unchanged); B1's SDT instrument passes 7, and Reclaim's C2/C3 pass 10. Matches a 1–2 digit number (so "10" reads
// as ten, not "1") and clamps to [1, max]; a value outside the range (or a spelled word above the scale) returns null
// so the administered loop RE-PROMPTS the current item rather than recording a bad value. (Existing 1–5/1–7 callers are
// unaffected: "10"/"12" were already out-of-range → null.)
export function parseLikert(msg: string, max = 5): number | null {
  const m = (msg ?? '').toLowerCase();
  // Strip SCALE/ITEM references first, then take the first remaining number — so an incidental figure ("on a scale of
  // 1 to 5, I'm a 4" → 4; "question 3: a 5" → 5) can't beat the real rating, while "8 out of 10" still reads 8.
  // Out-of-range digits are ignored (so "10" on a 1–5 scale still yields null). (CAT-33)
  const cleaned = m
    .replace(/\bout of\s+\d+/g, ' ') // "8 out of 10" → keep the 8
    .replace(/\b\d+\s*(?:to|through|[-–—])\s*\d+\b/g, ' ') // ranges: "1 to 5", "1-5"
    .replace(/\/\s*\d+/g, ' ') // "4/5"
    .replace(/\b(?:question|item|q|#)\s*#?\s*\d+/g, ' '); // item labels: "question 3", "#2"
  const inRange = [...cleaned.matchAll(/\b(\d{1,2})\b/g)].map((x) => Number(x[1])).filter((n) => n >= 1 && n <= max);
  if (inRange.length) return inRange[0]!;
  for (const [w, n] of Object.entries(LIKERT_NUM_WORDS)) if (n <= max && new RegExp(`\\b${w}\\b`).test(m)) return n;
  return null;
}

export type AdministeredConfig = {
  id: StageId;
  itemCount: number;
  scaleMax?: number; // the Likert ceiling — defaults to 5 (IDQ/Grinta); B1's SDT instrument passes 7
  // THE INSTRUMENT'S FULL LENGTH, when it differs from this stage's completion target. `itemCount` answers "when is
  // this STAGE done" and is compared against the shared response bag, so an instrument split across several stages
  // uses CUMULATIVE targets (5, 10, 15, 20). But the member-facing "Question n of y" must always say the whole
  // instrument's length, or C2's second domain would announce itself as "of 10". Defaults to itemCount, so every
  // single-stage instrument (the IDQ, Grinta, B1, B2, C4) is untouched.
  displayTotal?: number;
  minLabel?: string; // W-24: the low-pole anchor shown under the "1" chip (e.g. "not at all true"); defaults to "1"
  maxLabel?: string; // W-24: the high-pole anchor shown under the top chip (e.g. "very true"); defaults to the number
  opener: (c: Collected) => string; // the warm open + item 0, delivered when the prior stage hands in
  deliverItem: (index: number) => string; // the framed item at 0-based index (cluster transitions etc.)
  reprompt: (index: number) => string; // a gentle re-prompt of the current item on an unclear (out-of-scale) answer
  onComplete: (b: Beat) => void; // all items in — the config sets b.stage + b.reply (advance + close)
  // CAT-32 — clear the shared administeredResponses accumulator when this instrument STARTS, not only when the
  // previous one ends. Two instruments in one arc (Reconnect's 24-item IDQ then the 6-item grit Checkpoint) share
  // one bag, and the hand-off reset lived in a single distant stage-confirm branch — one bypass away from scoring
  // IDQ answers as the member's grit. An instrument that owns its own bag can't inherit anybody else's answers,
  // whichever path reached it. Opt-in, because a single-instrument arc must not wipe a legitimate resume.
  resetOnEntry?: boolean;
};

// Build an administered StageDef from an instrument config. gather/confirm are unused (the kernel dispatches to
// administer() on mode==='administered'); they're present only to satisfy the StageDef contract.
export function administeredStage(cfg: AdministeredConfig): StageDef {
  const max = cfg.scaleMax ?? 5;
  return {
    id: cfg.id,
    mode: 'administered',
    scale: { max, minLabel: cfg.minLabel ?? '1', maxLabel: cfg.maxLabel ?? String(max), itemCount: cfg.displayTotal ?? cfg.itemCount }, // W-24/W-48: the chip surface's scale + anchors + length
    opener: cfg.opener,
    offersSubstance: () => true,
    gather() {},
    confirm() {},
    administer(b) {
      // CAT-32: first answer of this instrument, but the bag already holds MORE than this instrument can — those
      // are the previous instrument's responses. Drop them; they are not ours to score.
      if (cfg.resetOnEntry && b.administeredResponses.length >= cfg.itemCount) {
        b.administeredResponses = [];
      }
      const val = parseLikert(b.memberMessage, cfg.scaleMax ?? 5);
      const sc = b.scratch as { unparsed?: number };
      if (val == null) {
        // Unclear answer → re-prompt the CURRENT item; do NOT advance or record.
        // LIVENESS (CAT-31): administered stages return BEFORE the idle/runaway backstop, so this used to re-prompt
        // the same item forever with no way out. We must not skip an item (a validated instrument is a frozen
        // contract) and must never fabricate a value — so instead of looping in silence, after a few tries we say
        // plainly how to answer AND that they can leave with their place saved. An informed choice, not a trap.
        sc.unparsed = (sc.unparsed ?? 0) + 1;
        const base = cfg.reprompt(b.administeredResponses.length);
        b.reply = sc.unparsed >= ADMINISTERED_HELP_AFTER ? `${base}${BEAT_SEP}${administeredStuckHelp(cfg.scaleMax ?? 5)}` : base;
        return;
      }
      sc.unparsed = 0; // a readable answer clears the streak
      b.administeredResponses = [...b.administeredResponses, val];
      const n = b.administeredResponses.length;
      if (n >= cfg.itemCount) cfg.onComplete(b);
      else b.reply = cfg.deliverItem(n);
    },
  };
}

// After this many consecutive unreadable answers, stop repeating the item alone and name the way out. (CAT-31)
const ADMINISTERED_HELP_AFTER = 3;
function administeredStuckHelp(max: number): string {
  return (
    `Tap any number from 1 to ${max} above — whichever is closest is the right one; there's no wrong answer here. ` +
    `And if now isn't the moment for this, you can leave it and come back whenever you like — your place is saved.`
  );
}

// W-24 — the chip signal for a turn, derived from the RESULTING active stage. One rule covers every administered ask:
// the opener (item 0), each delivered item, and a re-prompt all leave b.stage on the administered stage → emit its
// scale; completion advances b.stage off it (or sets complete) → no chips (the close is prose). This is why the signal
// is computed from state, not per-reply-path: it can't miss an ask or leak onto a close.
/**
 * WHAT SURFACE A SAVED STATE OWES THE MEMBER. The one owner, so RESUME can never disagree with a live turn.
 *
 * Every arc's resume path recomputed this itself by calling `scaleExpects` directly — which is the FALLBACK inside
 * `nextExpects`, reached only after the structured branches have declined. So resume could return scale chips and
 * nothing else, and any richer surface simply vanished.
 *
 * WHAT THAT COST, from Jay's walk (2026-08-25): Reconnect's doors stage opens "with the framing and the board
 * TOGETHER — recognition before conversation, so the Companion draws out what she marked instead of fishing for
 * it." He got the framing, stepped away, came back — and the board was gone, because `scaleExpects` cannot see
 * the branch that emits it. He typed "Got it" to a text box; the model read that as a conversational turn and
 * moved on to drawing out; the board then arrived a beat late, beside a question that assumed it had already
 * happened. **It does not merely hide a widget — it desynchronises the stage**, and the Companion ends up fishing
 * for exactly what the board exists to prevent.
 *
 * And it is not an edge case. Reconnect runs 65+ minutes; a member stepping away and returning IS the normal path.
 *
 * TAKES THE WHOLE STATE, not (stage, complete, answered) spread across four call sites. `collected` and
 * `awaitingConfirm` are what the structured branches read, and a signature that lets a caller omit them is a
 * signature that invites this bug back. The seam is closed by removing the choice.
 */
export function expectsForState(arc: ArcConfig, state: ConvState, answered = 0): Expectation | undefined {
  return nextExpects(
    arc,
    state.stage as StageId,
    false, // a resumable session is by definition not complete
    answered,
    state.collected ?? {},
    state.awaitingConfirm ?? false,
  );
}

// W-24 — the chip signal for a turn, derived from the RESULTING active stage. One rule covers every administered ask:
// the opener (item 0), each delivered item, and a re-prompt all leave b.stage on the administered stage → emit its
// scale; completion advances b.stage off it (or sets complete) → no chips (the close is prose). This is why the signal
// is computed from state, not per-reply-path: it can't miss an ask or leak onto a close.
export function scaleExpects(arc: ArcConfig, stageId: StageId, complete: boolean, answered = 0): ScaleExpectation | undefined {
  if (complete) return undefined;
  const s = arc.stages[stageId];
  if (s?.mode !== 'administered' || !s.scale) return undefined;
  // W-48: the item being ASKED is the (answered+1)th of the instrument's length — the universal "Question n of y" cue.
  return { kind: 'scale', min: 1, max: s.scale.max, minLabel: s.scale.minLabel, maxLabel: s.scale.maxLabel, index: answered + 1, total: s.scale.itemCount };
}

// Build the persisted ConvState from a Beat — the single place the turn's state shape is assembled. The current
// stage's scratch persists under the stage it BELONGS to (stageAtEntry), since a handler may have advanced b.stage
// this turn; every other stage's scratch is carried through unchanged from baseScratch.
function beatState(b: Beat): ConvState {
  // A DOOR PROPOSAL CANNOT OUTLIVE THE GAP STAGE (systemic invariant — onboarding only).
  //
  // The gap confirm is the ONLY gate where a member rules on her Doors. The happy paths all reach it (a
  // model-judged reflect, the depth cap, a member pushing past), but the anti-loop machinery does not:
  // forceProgress on a stall and the dispute/addition bounce ceilings advance a stuck member to Reclaim
  // mid-story, and every one of those is an EARLY RETURN. Written at the stage-transition site below, this rule
  // would have covered some of them and silently missed the rest — which is the exact failure mode that comment
  // is about. So it lives here, where a Beat becomes state and every path passes through exactly once.
  //
  // It also closes the other end: note_door is offered to the model on EVERY turn, so a tag can arrive during the
  // Reclaim List or the survey, long after the gate. Such a tag has no path to a ruling, and keeping an assertion
  // we can never ask her about is how it eventually gets "used" by some later reader.
  //
  // She may therefore finish intake holding NO Doors. That is the correct outcome, not a degraded one: Doors are
  // explicitly not a completion requirement (null routing, Taxonomy Spec §1), her gap story — the thing she
  // actually gave us — is kept in full, and R2's board opens with all eleven and re-derives from her record. An
  // empty set she was never asked about is recoverable in a way a wrong assertion on her card is not.
  if (b.arc.id === 'onboarding' && b.stage !== 'gap' && (b.collected.doorsProposed?.length ?? 0) > 0) {
    b.collected.doorsProposed = [];
  }
  return {
    stage: b.stage as StagedStage,
    collected: b.collected,
    awaitingConfirm: b.awaitingConfirm,
    idleTurns: b.idleTurns,
    stageScratch: { ...b.baseScratch, [b.stageAtEntry]: b.scratch },
    ...(b.pendingRevision && { pendingRevision: b.pendingRevision }),
    ...(b.reseeingTells.length > 0 && { reseeingTells: b.reseeingTells }),
    ...(b.administeredResponses.length > 0 && { administeredResponses: b.administeredResponses }),
    ...(b.pendingHarvest.length > 0 && { pendingHarvest: b.pendingHarvest }),
    ...(b.driftPayload !== undefined && { driftPayload: b.driftPayload }),
    ...(b.legacyDraft !== undefined && { legacyDraft: b.legacyDraft }),
    ...(b.legacyRevisions !== undefined && { legacyRevisions: b.legacyRevisions }),
    ...(b.legacyLetter !== undefined && { legacyLetter: b.legacyLetter }),
    ...(b.legacyTuesday !== undefined && { legacyTuesday: b.legacyTuesday }),
    ...(b.boardSubmission !== undefined && { boardSubmission: b.boardSubmission }),
    ...(b.pendingReclaimShape && { pendingReclaimShape: b.pendingReclaimShape }),
    ...(b.reclaimShapesResolved.length > 0 && { reclaimShapesResolved: b.reclaimShapesResolved }),
    ...(b.pendingIdentityPick && b.pendingIdentityPick.length > 0 && { pendingIdentityPick: b.pendingIdentityPick }),
  };
}

// --- ONBOARDING_ARC (config #1) — the three draw-out stages, logic moved verbatim from the old monolith -----

const identityStage: StageDef = {
  id: 'identity',
  mode: 'drawout',
  opener: () => STAGED_OPENING, // stage 0 — never advanced-into; opener unused (the arc opening lives in stagedOpening())
  offersSubstance: (message) => message.trim().length >= 15,
  gather(b) {
    const s = b.scratch as IdentityScratch;
    if (b.collected.identitySkipped) {
      // Skipped — nothing to confirm; acknowledge and advance straight into the gap stage.
      b.stage = 'gap';
      b.reply = `${SKIP_ACK}\n\n${gapOpen(b.collected)}`;
    } else if (b.collected.identityNoun && b.pendingIdentityPick && b.pendingIdentityPick.length > 0) {
      // CAT-54 (1) — WE ALREADY HAVE THEIR ANSWER. In walk 3 the model recorded identityNoun="Sovereign" from the
      // member's second reply while the pick branch below rejected that same message, and the engine's rejection
      // won silently: fifteen consecutive re-prompts for a question she had answered. Two sources of truth
      // disagreed about the member's own word, and the one that ignored her won.
      // A set handle is the end of this beat, full stop. [[member-words-outrank-model-guess]]
      b.pendingIdentityPick = undefined;
      b.stage = 'gap';
      b.reply = identityPickAck(b.collected);
    } else if (b.pendingIdentityPick && b.pendingIdentityPick.length > 0) {
      // TAP-TO-PICK RESOLVE: last turn we offered candidate handles as chips; this message IS the member's pick
      // (a tapped chip, a coined word, or the "not sure yet" affordance). Engine-authoritative, verbatim — the model
      // is NOT in this capture path (it kept failing to commit a clear pick). Accept it and move on; never re-litigate.
      const raw = b.memberMessage.trim();
      if (identityPickIsSkip(raw)) {
        b.collected.identitySkipped = true;
        b.pendingIdentityPick = undefined;
        b.stage = 'gap';
        b.reply = `${SKIP_ACK}\n\n${gapOpen(b.collected)}`;
      } else {
        // A tapped CHIP matches a candidate exactly (pre-vetted) → take it as-is; a COINED word goes through the
        // validity gate so junk (emoji, a whole sentence, a bare article) re-prompts instead of becoming a label. (CAT-10)
        const chip = b.pendingIdentityPick.find((c) => c.toLowerCase() === cleanIdentityNoun(raw).toLowerCase());
        // CAT-54 (2) — people don't answer a chip question with a bare word. "Sovereign. Yeah. That one." and
        // "I already picked — Sovereign." are unambiguous picks that exact-match could never see. Take a candidate
        // NAMED INSIDE the reply, but only when exactly one appears: two would be a genuine ambiguity to ask about.
        const named = b.pendingIdentityPick.filter((c) =>
          new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(raw));
        const handle = chip ?? (named.length === 1 ? named[0]! : null) ?? sanitizeCoinedIdentity(raw);
        if (!handle) {
          // CAT-54 (3) — the runaway escape every other stage has and this one didn't. `pendingIdentityPick` was
          // never cleared on a miss, so no input shape could end the beat: it was the only surface in onboarding
          // that could not self-recover. Two misses is plenty; after that we stop asking and let them move on.
          // Their identity is recoverable later from the rail — being trapped here is not.
          s.pickMisses = (s.pickMisses ?? 0) + 1;
          if (s.pickMisses >= 2) {
            b.collected.identitySkipped = true;
            b.pendingIdentityPick = undefined;
            b.stage = 'gap';
            b.reply = `${SKIP_ACK}\n\n${gapOpen(b.collected)}`;
          } else {
            b.reply = IDENTITY_PICK_REPROMPT;
            b.expects = { kind: 'identity_pick', candidates: b.pendingIdentityPick };
          }
        } else {
          b.collected.identityNoun = displayIdentityNoun(handle); // verbatim (article stripped, natural case)
          b.pendingIdentityPick = undefined;
          b.stage = 'gap';
          b.reply = identityPickAck(b.collected); // accept + bridge into the gap — the pick was definitive
        }
      }
    } else if (b.collected.identityNoun) {
      // BREATHE FLOOR (1a) + the conditional second probe (1b / Decision S). Reflect once the material is RICH
      // (front-loader escape), the member PUSHES PAST (terse escape), or we've drawn out enough (2 probes).
      const rich = stageMaterialRich('identity', b.collected);
      const pushed = memberPushedPast('identity', b.memberMessage, b.collected);
      if (rich || pushed || (s.identityProbes ?? 0) >= 2) {
        b.reply = reflectIdentity(b.collected);
        b.awaitingConfirm = true;
      } else {
        s.identityProbes = (s.identityProbes ?? 0) + 1;
        // probe 1 = the general draw; probe 2 = smaller + concrete. Prefer the model's own drawing-out question.
        const probe = s.identityProbes === 1 ? identityProbe(b.collected) : identityProbe2(b.collected);
        b.reply = withQuestion(b.modelText, probe);
      }
    } else if ((b.model.identityCandidates ?? []).map((w) => w.trim()).filter(Boolean).length > 0) {
      // OFFER: the model has drawn out the past self and proposed candidate handle words from the member's OWN
      // language. Hand them to the client as a tap-to-pick chooser (chips + write-your-own); the member's pick names
      // it next turn (resolved above). The model's prose frames the invite; fall back to a warm default.
      const candidates = (b.model.identityCandidates ?? []).map((w) => w.trim()).filter(Boolean).slice(0, 4);
      b.pendingIdentityPick = candidates;
      b.expects = { kind: 'identity_pick', candidates };
      b.reply = b.modelText || IDENTITY_PICK_OFFER;
    } else {
      // Gather. Never-strand a member who won't name a PAST self: offer the "find it later" skip after a couple
      // of tries, HARD-ESCAPE after a few (recovered at Identity Excavation in Reconnect).
      s.identityTurns = (s.identityTurns ?? 0) + 1;
      const skipOfferable = s.identityTurns >= IDENTITY_SKIP_OFFER_AFTER;
      if (s.identityTurns >= IDENTITY_MAX_TURNS && !b.collected.athleticPast && !b.collected.identityNoun) {
        b.collected.identitySkipped = true;
        b.stage = 'gap';
        b.reply = `${SKIP_ACK}\n\n${gapOpen(b.collected)}`;
      } else {
        // CAT-20: rotate the skip offer by how often we've already made it — the same paragraph twice reads as a
        // broken loop to a terse member (the whole-reply guard misses it, since withQuestion varies the lead).
        const offer = skipOffer(b.history);
        const probe = !b.collected.athleticPast ? (skipOfferable ? offer : IDENTITY_REDRAW) : skipOfferable ? offer : NAME_PROMPT;
        b.reply = withQuestion(b.modelText, probe);
      }
    }
  },
  confirm(b) {
    const s = b.scratch as IdentityScratch;
    // Model-signaled (Phase 2.1): a 'dispute' reopens the naming; anything else advances. Regex fallback when the
    // model didn't tag the reply.
    const disputes = b.model.replyIntent ? b.model.replyIntent === 'dispute' : correctsReflection(b.memberMessage);
    if (disputes) {
      // Anti-loop: a member who keeps disputing the reflection re-opens the naming forever. Past the ceiling, DON'T
      // commit a wrong name — SKIP identity (recovered later at Reconnect's Identity Excavation) and move on. Never
      // names an unconfirmed identity (governance) — skipping is the safe advance here.
      if (confirmBounceExceeded(s)) {
        b.collected.identitySkipped = true;
        b.collected.identityNoun = undefined;
        b.stage = 'gap';
        b.awaitingConfirm = false;
        b.reply = `${SKIP_ACK}\n\n${gapOpen(b.collected)}`;
        return;
      }
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
    const s = b.scratch as GapScratch;
    // REAL-FADE SIGNALS, read fresh from the whole gap-stage corpus every turn. HARD signals — committed Doors, the
    // ordinary reduction/reroute fade, or resigned Acceptance — are UNAMBIGUOUS: a member showing any is a real Fade
    // and is NEVER declined (fixes the Doors-accumulation member wrongly turned away — the Doors ARE the fade
    // taxonomy, so a committed Door outranks any vocabulary check). A genuine loss verb also admits + captures. (CAT-01/05/06)
    const gapCorpusNow = gapStageCorpus(b.history, b.memberMessage);
    const hardFadeSignal =
      doorsKnown(b.collected).length > 0 || hasReductionLanguage(gapCorpusNow) || isAcceptanceFade(gapCorpusNow);
    const anyFadeSignal = hardFadeSignal || hasGenuineLoss(gapCorpusNow);
    // note_no_fade is a HINT, not authority: honored ONLY while NO fade signal is present, and RECONCILED every turn —
    // the moment a Door / reduction / loss surfaces, a stale no-fade flag clears for good. This kills the sticky-flag
    // strand where one model misfire silently dropped a genuine-loss member's whole story. (CAT-02/04)
    s.noFade = (s.noFade || !!b.model.noFade) && !anyFadeSignal;
    // FADE GATE. Only wipe a model-tagged gap as "forward ambition" when there's NO hard fade signal — an accumulation
    // fade routinely carries ambition words ("a bigger job") yet is plainly real once a Door/reduction is on the table.
    // Reject on AMBITION specifically, not shortness — a terse real fade ("Knee. Then divorce.") must survive. (CAT-05)
    if (b.collected.gap && isForwardAmbition(b.collected.gap) && !hardFadeSignal) b.collected.gap = undefined;
    // Backstop: when the model did NOT tag a (real-fade) set_gap this turn, capture the member's own message as
    // the gap if it reads as a real fade — ACCUMULATE (append) so a progressive revealer's chapters aren't lost.
    const modelTaggedGap = b.model.record?.gap !== undefined && b.model.record.gap !== '' && !isForwardAmbition(b.model.record.gap);
    if (!b.collected.gap && !s.noFade && shouldCaptureStagedGap(b.memberMessage)) {
      b.collected.gap = tidyGapProse(b.memberMessage);
    } else if (b.collected.gap && !s.noFade && !modelTaggedGap && shouldCaptureStagedGap(b.memberMessage)) {
      // W-33: join with a sentence boundary (joinGapChapters, W-12) — a raw space ran the member's sentences together
      // ("consumed me It also…"). Same helper the confirm-append path uses; boundary-only, no internal/proper-noun risk.
      // tidyGapProse (milie walk): mechanics-only cleanup of the raw backstop text (never the model's clean set_gap).
      b.collected.gap = tidyGapProse(joinGapChapters(b.collected.gap, b.memberMessage));
    }
    if (!b.collected.gap) s.gapTurns = (s.gapTurns ?? 0) + 1; // count gap-stage turns spent without a captured fade
    // NEVER-STRAND the gap stage: after several gap turns with NOTHING captured, grab the accumulated gap-stage
    // story so we advance instead of looping the opening question.
    if (!b.collected.gap && !s.noFade && (s.gapTurns ?? 0) >= GAP_MAX_TURNS) {
      const corpus = gapStageCorpus(b.history, b.memberMessage).trim();
      // NEVER fabricate a fade: still never-strand a subtle real fade the matcher missed, but do NOT grab a corpus
      // that positively declares thriving (or is pure forward ambition) — that would manufacture a fade for a
      // genuinely-thriving member. (CAT-03; preserves the run-2 never-strand for real subtle fades.)
      if (corpus.length >= 40 && !declaresThriving(corpus) && !isForwardAmbition(corpus)) b.collected.gap = tidyGapProse(corpus);
    }
    // DECISION E FORK: resolve a "no obvious fade event" member from the whole gap-stage corpus.
    const gapCorpus = gapCorpusNow;
    if (isAcceptanceFade(gapCorpus)) {
      // RESIGNED to age-decline → The Acceptance Door: a real, quiet Fade. NOT no-fade — clear the flag, capture
      // their own words as the gap, and fall through to the normal real-fade reflect/advance below.
      s.noFade = false;
      if (!b.collected.gap) b.collected.gap = tidyGapProse(b.memberMessage || gapCorpus);
    }
    // GENUINELY THRIVING → graceful DECLINE. Fires ONLY on POSITIVE evidence of no-fade — an affirmative thriving/
    // no-loss declaration (or a reconciled model no-fade judgement) — AND NO hard fade signal (Door/reduction/
    // Acceptance) AND NO genuine loss anywhere. Absence of a fade is never enough on its own: we never fabricate a
    // fade to admit, and — the failure that turned away our own demographic — never turn away a real one. (CAT-01/03)
    // TERSE IS NOT THRIVING — the rule this gate was missing (Tim Carlin, declined 2026-08-14, 13 turns).
    //
    // He never said he was fine. `declaresThriving` returns FALSE on every word he typed. What he actually gave the
    // gap stage was eleven words — "Never happened", a joke about spelling — after answering "Living" and then
    // "Done." A man shutting a conversation down, which the model read as contentment and the engine executed as a
    // decline. That is the failure named two lines up: "never turn away a real one."
    //
    // AND IT IS THIS CODEBASE'S OLDEST SHAPE: the engine acting on a model JUDGEMENT that contradicts what the
    // member plainly said. Her own words outrank the model's read, every time.
    //
    // TURNS WERE THE WRONG UNIT. The old guard asked for "a beat first" and counted two gap TURNS — which a terse
    // member spends in nine words. Absence of a fade is not evidence of no fade, and the comment above already
    // says absence must never be enough on its own; counting turns let it be enough anyway.
    //
    // So the model's hint now needs SUBSTANCE behind it: enough said in the gap stage to have actually judged. Her
    // own affirmative declaration still decides immediately and is untouched — someone who says "honestly, nothing
    // is missing, I just want more" is out of scope on the first turn, as they should be.
    const gapWords = gapCorpus.trim().split(/\s+/).filter(Boolean).length;
    const enoughToJudge = gapWords >= NO_FADE_MIN_WORDS;
    const thrivingDecline =
      !hardFadeSignal &&
      !hasGenuineLoss(gapCorpus) &&
      (declaresThriving(gapCorpus) || (s.noFade && (s.gapTurns ?? 0) >= 2 && enoughToJudge));
    if (thrivingDecline) {
      // Out of scope; the door stays open. Terminal — no card, no reclaim. We never fabricate a fade to admit them.
      b.stage = 'declined';
      b.awaitingConfirm = false;
      b.declined = true;
      return { reply: DECLINE_REPLY, state: { ...beatState(b), declined: true }, complete: false, declined: true };
    }
    if (b.collected.gap) {
      // Real fade. Accumulate Doors across the WHOLE corpus, and RECEIVE the whole story before reflecting.
      b.collected.doorsProposed = proposeDoors(b.collected, gapStageCorpus(b.history, b.memberMessage));
      s.gapDepth = (s.gapDepth ?? 0) + 1; // one more drawing-out exchange with the story in hand
      // MODEL-JUDGED advance: the MODEL decides when the story is drawn out (reflect_gap), bounded by the engine —
      // a FLOOR (GAP_MIN_DEPTH) and a CAP (GAP_MAX_DEPTH). A member close overrides; the card is the backstop.
      const modelJudgedDone = b.model.gapReady && (s.gapDepth ?? 0) >= GAP_MIN_DEPTH;
      const advance = modelJudgedDone || memberPushedPast('gap', b.memberMessage, b.collected) || (s.gapDepth ?? 0) >= GAP_MAX_DEPTH;
      if (!advance) {
        // TELL THE MODEL NEXT TURN. Overriding it silently is what produced the divergence; the floor itself is
        // right and stays exactly as it is — nothing here shortens the draw-out.
        s.gapHeld = b.model.gapReady === true;
        b.reply = withQuestion(b.modelText, gapMore(b.history));
      } else {
        s.gapHeld = false;
        b.reply = reflectGap(b.modelText);
        b.awaitingConfirm = true;
      }
    } else {
      // Still gathering a real fade — keep the model's question, else hold the gap open.
      b.reply = withQuestion(b.modelText, gapOpen(b.collected));
    }
  },
  confirm(b) {
    const s = b.scratch as GapScratch;
    // GAP CONFIRM — "…or is there more to it?" A bare "no / nope / that's it / more or less it for now" means NO
    // MORE = DONE → ADVANCE. resolveGapConfirm owns the meaning (dispute / addition / done); the engine acts on it.
    // CORROBORATION GATE: the model's 'more' is a GUESS about what the member meant; a clear closing affirmation
    // ("that's the brunt of it", "that's it") is a deterministic CLOSE. When the member's own words plainly close the
    // beat and carry NO new material, the close WINS — otherwise the engine holds in gap while the model, believing
    // it has moved on, runs the next stage's conversation itself (Jay's walk: the reclaim BUILDER never fired and the
    // old conversational extraction came back). Same "a guess promoted over a clear signal" pattern as the capture
    // discipline: an 'addition' must be corroborated by actual new content, not asserted.
    // (Extracted to resolveConfirmCorroborated so Reconnect's confirms share ONE implementation — they had none,
    // and a member's "Yes." was re-asked three times. The gap's own material test is what counts as "new" here.)
    // A TAP IS A FACT and outranks everything — the classifier AND the model's own tag. She was offered three
    // answers and chose one; nothing we infer can be better evidence than that. Typed replies fall through to the
    // classifier exactly as before, so she is never forced through the chips.
    const tapped = parseGapConfirmChoice(b.memberMessage);
    const intent = tapped
      ? gapConfirmIntent(tapped)
      : resolveConfirmCorroborated(b.memberMessage, b.model.replyIntent, shouldCaptureStagedGap);
    // ── THE DOOR GATE — where a proposal becomes a fact about her life ────────────────────────────────────────
    //
    // Everything tagged so far sits in `doorsProposed` and is true of nothing. This is the one place in
    // onboarding it can move into `doors`, and it moves only on HER ruling.
    //
    // Her word outranks the matcher, always. INTERSECTED WITH WHAT SHE WAS SHOWN, so a slug that was never
    // offered cannot arrive through the wire and become part of her story — the same bound the R2 board uses.
    //
    // WHAT COUNTS AS RULING. A tap is a fact: she was shown the Doors by name alongside three answers and chose
    // one, so any tap commits the proposal (minus anything she took off with the ✕). A TYPED close is the same
    // statement in her own words and commits the same way. A dispute or an addition is NOT a ruling on the
    // Doors — she is still telling the story — so the proposal stays pending and is put to her again at the next
    // confirm, grown by whatever she just added.
    if (intent === 'done') {
      const proposed = b.collected.doorsProposed ?? [];
      const kept = tapped ? parseGapConfirmDoors(b.memberMessage) : null;
      const shown = new Set(proposed);
      const ruled = kept !== null ? proposed.filter((d) => kept.includes(d) && shown.has(d)) : proposed;
      b.collected.doors = Array.from(new Set([...(b.collected.doors ?? []), ...ruled]));
      b.collected.doorsProposed = [];
    }
    if (intent === 'dispute') {
      // wrong, no new content → reopen, but KEEP the gap + Doors (never wipe). ANTI-LOOP: count the bounce like
      // identity's confirm does — a member who keeps disputing must hit the SHARED ceiling and be moved on, not
      // ping-pong to the 30-turn hard ceiling. Past it, accept the story as-is and advance to reclaim. (CAT-21)
      if (confirmBounceExceeded(s)) {
        b.stage = 'reclaim';
        b.awaitingConfirm = false;
        b.reply = receiveThen(b.modelText || gapReceipt(b.collected), reclaimOpening(b.collected));
        return { reply: b.reply, state: beatState(b), complete: false, ...(nextExpects(b.arc, b.stage, false, 0, b.collected, b.awaitingConfirm) ? { expects: nextExpects(b.arc, b.stage, false, 0, b.collected, b.awaitingConfirm)! } : {}) };
      }
      b.awaitingConfirm = false;
      b.reply = REOPEN_GAP;
    } else if (intent === 'addition') {
      // CAT-18 — A LIST IS NOT PROSE. A member who pastes a bulleted/numbered block at the gap confirm (their
      // wants, or fade chapters) had it classified as an "addition" and joined RAW into the gap narrative —
      // "…what to do with myself. • Rediscover what I enjoy" — corrupting the stored gap, and those items never
      // reached the Reclaim List. This is the same "structured input into a free-text gate" shape
      // parseReclaimListSubmission already solved for the reclaim stage; this gate was simply unguarded.
      //
      // Never drop what they gave you: the items are parked as Reclaim wants (they seed the builder later), and
      // the gap prose is left alone rather than polluted.
      const listItems = isListBlock(b.memberMessage) ? parseReclaimListSubmission(b.memberMessage) : [];
      if (listItems.length >= 2) {
        for (const item of listItems) appendReclaim(b.collected, item);
        b.collected.doorsProposed = proposeDoors(b.collected, gapStageCorpus(b.history, b.memberMessage));
        b.awaitingConfirm = true; // still at the confirm — we haven't heard more of the STORY yet
        b.reply = withQuestion(
          b.modelText,
          "I've kept those — they're the things you want back, and we'll build that list together in a minute. Right now I'm still with how it happened. Was there more to it?",
        );
        return;
      }
      // a new chapter (or a correction WITH content) → append it, re-derive Doors, and DRAW IT OUT.
      const modelTaggedGap = b.model.record?.gap !== undefined && b.model.record.gap !== '';
      if (!modelTaggedGap) b.collected.gap = joinGapChapters(b.collected.gap ?? '', b.memberMessage);
      b.collected.doorsProposed = proposeDoors(b.collected, gapStageCorpus(b.history, b.memberMessage));
      b.awaitingConfirm = false;
      // ANTI-LOOP (shared contract): a rambling / drifting member's every reply reads as an 'addition', so this
      // append → re-ask cycle never reaches a clean "done" and the confirm probe repeats ("…or is there more?" ×10).
      // Past the bounce ceiling, KEEP the addition (content is never dropped, above) but stop asking and advance —
      // the card is the backstop for anything still missing.
      if (confirmBounceExceeded(s)) {
        b.stage = 'reclaim';
        b.reply = receiveThen(b.modelText || gapReceipt(b.collected), reclaimOpening(b.collected));
      } else {
        b.reply = withQuestion(b.modelText, gapMore(b.history));
      }
    } else {
      // done / affirm / bare "no more" → advance into reclaim (re-surfacing any parked wants).
      b.stage = 'reclaim';
      b.awaitingConfirm = false;
      // RECEIVE, THEN OPEN — the heaviest transition in onboarding, and the only hand-in that was not doing it.
      // receiveThen() is already the contract at the Grinta hand-in and at two Reconnect hand-ins; this site
      // discarded the model's turn entirely and substituted the scripted bridge.
      //
      // What that cost, from Donna's walk: she said her father had gone into a coma and nearly died, closed the
      // story two turns later, and the very next thing she read was "Let's write down what you want back. Add
      // each thing below." She said "that felt really rushed", and the Companion's own reply named it better
      // than any of my diagnoses did — "You'd just told me your father nearly died, and I moved straight to a
      // list. That deserved a beat, not a pivot."
      //
      // The beat it deserved was already written. The model had a reflection of exactly what she had just said,
      // and the engine threw it away at the one moment in the conversation where a generic line cannot stand in
      // for a specific one. Nothing here changes pacing or capture: same turn count, same builder, same floor.
      b.reply = receiveThen(b.modelText || gapReceipt(b.collected), reclaimOpening(b.collected));
    }
  },
};

// Structured Reclaim capture is AUTHORITATIVE and VERBATIM — the member's exact builder entries ARE the list, so this
// REPLACES it (discarding any model add/refine pollution mergeStaged merged earlier this turn — CAT-16), does exact
// case-insensitive dedup only (NOT the fuzzy conversational appendReclaim, which folded/dropped deliberate entries —
// CAT-15), and keeps reclaimCategories index-locked so the IDQ-dimension array can never desync (CAT-17).
function setStructuredReclaim(c: Collected, items: string[]): void {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const raw of items) {
    const item = raw.trim();
    if (!item || seen.has(item.toLowerCase())) continue;
    seen.add(item.toLowerCase());
    list.push(item);
  }
  c.reclaimList = list;
  c.reclaimCategories = list.map(() => ''); // IDQ dimension is assigned later; keep the parallel array in lockstep
  // SHE HAS NOW RULED. The seeds were proposals waiting for exactly this moment, and her submission is the answer
  // — including for anything she deleted from the form, which is a deliberate NO and must not come back. Leaving
  // them would re-seed a later render of the builder with a want she just removed.
  delete c.reclaimSeeds;
}

// Reclaim → Grinta with the FLOOR enforced (CAT-13/14). The frozen data contract is a ≥RECLAIM_LIST_MIN list; that
// floor lived ONLY in the dead v1 contractGaps, so the staged path advanced on an empty/short list. This is the single
// reclaim→survey chokepoint: below the floor we HOLD and re-show the builder seeded with what they have.
/**
 * THE RECAP — read it back, recognise what she just did, then ONE question.
 *
 * She used to submit the builder and drop straight into the Grinta survey with no acknowledgement at all. Jay,
 * 2026-08-22: "sandwiched by an intro and recap from the Companion."
 *
 * IT RECOGNISES THE ACT, NOT THE LIST. "That's a harder thing to write down than it looks" is about what she just
 * did; "good list" would be a verdict on her answers, which is the line the voice rules draw. Nothing here praises
 * and nothing claims her list is saved — the engine owns that (gate-claims, 2026-08-22).
 *
 * THE QUESTION IS ASKED OF THE WHOLE LIST, NOT ONE ITEM. The 2026-07-29 sharpening proposal wanted to sharpen
 * items individually and flagged its own trap: turning "hanging out with friends" into "twice a month" converts
 * something warm into an obligation she can fail at. Asking what the Identity would be DOING sidesteps that
 * entirely — it produces a picture of the evidence without touching a single item she wrote, and it needs no
 * heuristic deciding which of her goals is "a doing-goal", which would have been one more judgement to get wrong.
 *
 * NOT SMART GOALS. Jay's instruction is on record in that proposal: "not literally."
 */
function reclaimRecap(c: Collected): string {
  // THE READ-BACK IS HERE AND IT IS DETERMINISTIC. `reclaimReceipt` also reads the list back one beat later, but
  // only as a FALLBACK — `b.modelText || reclaimReceipt(...)` — so the moment the model writes anything, her list
  // is never read back at all. Leaving it to the model is the exact dependence this redesign removes, so the
  // recap owns it and enterGrintaSurvey is told to skip its own (withReceipt = false).
  const list = (c.reclaimList ?? []).map((x) => x.trim()).filter(Boolean);
  return [
    // "That's YOUR LIST — …" is what this said, and claimsGateOutcome catches it: list-is-made is one of the three
    // families the gate exists to stop, and it does not care who wrote the sentence. It had shipped inside
    // reclaimReceipt as a FALLBACK — fired only when the model was silent — so no walk had ever exercised it.
    // Making the read-back deterministic is what finally surfaced it.
    //
    // "Here's what you wrote" is the same information as a receipt of HER action rather than a declaration of
    // ours, which is what it should have been either way.
    list.length ? `Here's what you wrote — ${list.join(' · ')}.` : '',
    // "This is the list the whole program is pointed at now" was the first draft, and claimsGateOutcome caught it
    // — the gate built this morning, on copy written this evening. It reads as "your list is made", which is the
    // engine's statement to make, not the Companion's. Saying where the WORK goes claims nothing about the list.
    `That's a harder thing to write down than it looks. Most people can name what went wrong long before they can `
      + `name what they want back. Everything from here points at these.`,
    // THE EXPECTATION, SET WHERE SHE ACTUALLY IS (Cowork + Jay, 2026-08-23). Onboarding already had a line saying
    // the list is a starting point — but it is CARD_LIST_SET, which only fires when a member tries to ADD a want
    // after the summary card. An edge-case reply. Most members never see it, so nothing in the ordinary path told
    // her this was a first draft. That is what let onboarding stay shallow without feeling thin.
    `It's a starting point, not a contract — you'll sharpen it in your sessions, and change it any time.`,
  ].filter(Boolean).join(BEAT_SEP);
}

function commitStructuredReclaim(b: Beat): Turn {
  setStructuredReclaim(b.collected, parseReclaimListSubmission(b.memberMessage));
  if ((b.collected.reclaimList?.length ?? 0) < RECLAIM_LIST_MIN) {
    return {
      reply: RECLAIM_NUDGE,
      state: beatState(b),
      complete: false,
      expects: { kind: 'reclaim_list', min: RECLAIM_LIST_MIN, seeded: (b.collected.reclaimList ?? []).filter(Boolean) },
    };
  }
  // THE RECAP RIDES ON THE HANDOFF — one turn, not two (Cowork + Jay, 2026-08-23).
  //
  // It briefly held the stage open for an answer to an evidence question ("what would you be doing, on an ordinary
  // week…"). That question is cut: W2's Visioning already builds an ordinary-day picture and opens on this very
  // list, so asking it here was redundant depth in a step whose only job is a clean baseline.
  //
  // CUTTING IT CLOSED A HOLE STRUCTURALLY RATHER THAN BY A GUARD. Holding the stage gave the model one more turn
  // after she had committed, and the record merge appended a phantom want to her authored list — the exact bug
  // this redesign exists to remove, arriving through the door the redesign opened. I guarded it by restoring her
  // committed list on that turn; with no turn there is nothing to guard. The guard, the scratch flag and the
  // handler are all gone.
  //
  // The member authored these entries herself. Nothing to reconcile — do NOT run the shape gate over her own words.
  // THE MODEL IS SILENT ON THIS TURN (Donna, 2026-08-23: "it repeated the list so it's showing 3 times").
  //
  // Her list appeared as her own submission, then in the recap's read-back, then a THIRD time because the model
  // still got a turn and used it to reflect the list back: "That's a clear, honest list. Let me reflect it back:
  // - A - B - C."
  //
  // The duplication is the reported bug, but the same bubble carried two worse things. It said "the first goes
  // straight back to the Maker" — the member in the third person by her Identity, the rule we had just spent a
  // day enforcing in engine copy. And "that's a clear, honest list" APPRAISES her answer, which is a verdict
  // rather than a receipt, using "honest" as precisely the filler the voice section bans.
  //
  // One cause: the model was handed a turn where it has no job. She submitted a form; the engine reads it back,
  // recognises the act and sets the expectation. There is nothing left to say, so anything the model says here is
  // either redundant or a rule it gets to break. It is dropped — not gated, not filtered. Silence is the design.
  const survey = enterGrintaSurvey(b, false, true);
  const reply = `${reclaimRecap(b.collected)}${BEAT_SEP}${survey.reply}`;
  b.reply = reply;
  return { ...survey, reply, state: beatState(b) };
}

/**
 * What the Companion says when the MODEL says nothing — the floor under a blank bubble, never the normal path.
 *
 * Deliberately the smallest possible turn: a receipt of what just landed and one open door. It must not sound
 * like a different Companion arriving, and it must not ask a second question on a turn where the model may have
 * meant to ask one.
 */
function reclaimDrawoutFallback(c: Collected): string {
  const last = (c.reclaimList ?? []).at(-1);
  return last ? `Got it — ${last}. What else do you want back?` : 'What else do you want back?';
}

/** How many wants she can name before the builder arrives regardless — the cap that stops a "what else?" march. */
const RECLAIM_DRAWOUT_MAX = 6;


// The hand-in TO the builder, once she has said her piece. It names what we already hold, so the form reads as a
// receipt rather than a fresh demand — and says plainly that she can change any of it.
/**
 * Everything the builder opens holding — her verbatim items, then the model-voiced seeds she has not ruled on.
 *
 * ONE FUNCTION because the count and the contents must never disagree. The handoff says "I've got those three
 * written down" and the form beneath it has to contain three; derived separately, a seed counted in one and
 * missing from the other is precisely the kind of quiet mismatch nobody notices until a member does.
 */
/**
 * The items the builder arrives PRE-FILLED with.
 *
 * A SEED IS OUR PROPOSAL, NOT HER STATEMENT — and that asymmetry is the whole reason it is safe to filter here.
 * Dropping a bad seed costs nothing: the builder is right in front of her and she can type anything she wants.
 * Dropping a COMMITTED item would be the dangerous direction, and this is not that. "Never drop what they gave
 * you" is about her words; a seed is ours.
 *
 * DONNA, 2026-08-22 — the walk that made this necessary. Four of her seven committed items were conversation:
 *   "Uhmmm, we just did that"
 *   "This remains confusing and fucked up."
 *   "We need to make a change here to how the Reclaim List is populated"
 * She stopped and typed us a bug report about this list, and the list stored it as something she wanted back.
 *
 * They reached her because the model called `add_reclaim_item` on her conversational turns, those pushed into
 * `collected.reclaimList`, and this function handed them to the builder already ticked. She then submitted the
 * form — so by the time the authoritative path saw them they were indistinguishable from things she had typed.
 * The guard existed (isConversationalMeta, built for exactly this shape) and was wired into Playbook keepers and
 * Reconnect, never into the list.
 *
 * FILTERED HERE RATHER THAN AT COMMIT, deliberately. At commit we cannot tell her words from our guesses; here we
 * can, because everything in this function is a guess by definition.
 */
function reclaimSeedList(c: Collected): string[] {
  const usable = (s: string): boolean => !!s && !isConversationalMeta(s) && !isAboutTheApp(s);
  const items = (c.reclaimList ?? []).filter(usable);
  const seen = new Set(items.map((s) => s.toLowerCase()));
  for (const s of c.reclaimSeeds ?? []) {
    if (usable(s) && !seen.has(s.toLowerCase())) { items.push(s); seen.add(s.toLowerCase()); }
  }
  return items;
}

function reclaimBuilderHandoff(c: Collected): string {
  const n = reclaimSeedList(c).length;
  return n
    ? `I've got ${n === 1 ? 'that one' : `those ${n}`} written down. Have a look — change the wording, add anything I missed, take one off. This is your list.`
    : `Put them down here in your own words — big or small, three to start is plenty. You can always add more later.`;
}

const reclaimStage: StageDef = {
  id: 'reclaim',
  mode: 'drawout', // unused for the structured turn; kept for the StageDef shape
  opener: (c) => reclaimOpening(c),
  // A BUILDER SUBMISSION IS ALWAYS SUBSTANTIVE; A DRAW-OUT TURN IS NOT.
  //
  // This was `() => true`, which was correct while the beat WAS the submission — one turn, always real. With a
  // conversational draw-out in front of it, always-true means the idle counter never increments, so the runaway
  // backstop can never fire and a stalling member is trapped in the draw-out instead of being handed on. Found by
  // the stall test the moment the draw-out landed.
  offersSubstance: (message) => isBuilderSubmission(message) || shouldCaptureStagedReclaim(message),
  // THE RUNAWAY BACKSTOP, which this stage never needed until now.
  //
  // While the beat WAS the builder submission there was nothing here to run away with: one turn, in and out. The
  // draw-out puts a conversation in front of it, which means a member CAN now stall or spiral here — and the
  // systemic backstop delegates to this hook, so with no hook the stall test's member was simply trapped in the
  // draw-out forever. (Three tests caught it at once; the fall-through they were exercising was gather's.)
  //
  // Two exits, and which one she gets depends on whether her list can stand:
  //   - at or above the floor → hand on, through the SAME chokepoint as every other path so the shape gate still
  //     runs (Decision II: no path bypasses it), capturing whatever the stalling turn still offered first.
  //   - below the floor → she is not finished, she is stuck. Open the builder, which is the thing that enforces
  //     the floor. Handing a one-item list to the survey would break the ≥MIN contract to escape a stall.
  forceProgress(b) {
    const rs = b.scratch as ReclaimScratch;
    if (b.pendingReclaimShape) return; // a parked proposal owns the turn — gather resolves it
    if (!rs.drawnOut && (b.collected.reclaimList?.length ?? 0) < RECLAIM_LIST_MIN) {
      rs.forced = true; // gather ends the draw-out; ONE construction of the handoff, so expects stays with it
      return;
    }
    rs.drawnOut = true;
    for (const item of parseReclaimListSubmission(b.memberMessage)) appendReclaim(b.collected, item);
    return enterGrintaSurvey(b);
  },
  // STRUCTURED CAPTURE (Jay, 2026-07-29): the Reclaim List is built in a list-builder UI, not extracted from
  // conversation (which proved ~30% lossy in testing). The submission arrives as a bulleted block; the engine stores
  // the member's EXACT entries VERBATIM (setStructuredReclaim), enforces the ≥MIN floor, then hands into the Grinta
  // baseline survey. There is no conversational gather or confirm: the builder IS the input AND the confirmation.
  gather(b) {
    // An in-flight session that was already holding a shape proposal when widget-first shipped. Nothing creates
    // one any more — a builder submission never did — so this only ever runs for a member mid-onboarding at the
    // cut-over, and it hands her straight on.
    if (b.pendingReclaimShape) return answerPendingShape(b);

    // THE BUILDER IS THE ONLY WRITER (2026-08-22, widget-first).
    //
    // The six-turn draw-out that used to live here is gone, and with it `add_reclaim_item`, `reclaimSeeds`, the
    // runaway backstop this stage needed only because a member could stall in a conversation, and the
    // model-closed handling that existed because the model could try to end a beat it did not own. Every one of
    // those was a fix for a problem the conversation created.
    //
    // Nothing but her typing reaches the list now, so there is no judgement to get wrong in either direction.
    // Donna's bug report about the Reclaim List could not have entered it, because the model never writes.
    if (isBuilderSubmission(b.memberMessage)) return commitStructuredReclaim(b);

    // SHE IS NOT SUPPOSED TO BE ABLE TO GET HERE. The builder is an `expects`, and the composer is hidden while
    // one is outstanding (lib/chat/composer.ts), so there is no text box to type into. If something does arrive —
    // a stale client, a resumed session, a replay — the right answer is to put the form back in front of her, NOT
    // to capture it conversationally. Capturing it is precisely the bug this redesign removes.
    b.reply = reclaimBuilderHandoff(b.collected);
    return { reply: b.reply, state: beatState(b), complete: false,
      expects: { kind: 'reclaim_list', min: RECLAIM_LIST_MIN, seeded: reclaimSeedList(b.collected) } };
  },
  confirm(b) {
    return reclaimStage.gather(b);
  },
};

// DECISION II — THE MISSING HALF OF THE SHAPE GATE. gateNextShape() posed the proposal and parked it on
// `pendingReclaimShape`, and resolvePendingShape() knew how to apply the answer — but NOTHING CONNECTED THEM.
// resolvePendingShape was unreachable, so the member's answer fell through to the "append whatever they typed"
// path below and the unresolved shape re-detected on the next pass. Two live failures, both hit in Jennifer's
// walk (2026-07-30): the proposal repeated VERBATIM after she answered it, and her answer to a multi-want
// draw-out was appended to the list as a NEW item — which then overlapped the original and started a SECOND
// loop the engine had manufactured itself.
//
// A pending shape OWNS the turn: she is ruling on our proposal, not adding to her list. Apply her answer, then
// re-gate — because resolving one shape can reveal the next (and clearing the last one is what lets her through).
// Only reachable now for a session that was ALREADY holding a proposal when this shipped (Jennifer's), or the retired
// conversational path — a builder submission never creates one. It applies her answer and advances WITHOUT re-gating:
// at most ONE proposal, ever. That is deliberate and it is what makes the loop structurally impossible rather than
// merely fixed — with no path from "answered a proposal" back to "pose a proposal", there is no cycle in the graph to
// get stuck in. Anything still worth sharpening is hers to edit from the rail, with the Companion's help.
function answerPendingShape(b: Beat): Turn {
  const ack = resolvePendingShape(b, b.pendingReclaimShape!);
  const turn = enterGrintaSurvey(b, false);
  b.reply = `${ack}${BEAT_SEP}${turn.reply}`;
  return { ...turn, reply: b.reply, state: beatState(b) };
}

// --- The Grinta baseline — "Introduction to Grinta." An administered 12-item survey that runs AFTER the member
// confirms their Reclaim List (the seatbelt above is untouched) and BEFORE onboarding completes. Off the depth
// kernel (administered mode). It establishes the GRINTA baseline (grit across four strands, one per R). NO ID
// Score here — that's earned in Reconnect. Built on the shared administeredStage() factory; copy lives here.
// Introduce the four Phases HERE — the first time the member meets the framework — right before the baseline
// survey, so the Card's "each Phase"/"first Phase" has a referent. Onboarding Copy v2 (Jay's voice pass, verbatim).
// Tightened in the 2026-08-13 messaging pass. The old version took six sentences to say "twelve questions, a
// couple of minutes, it's a starting line" — and never actually told the member how long it would take, which is
// the one thing someone deciding whether to keep going wants to know.
const GRINTA_OPEN =
  'Before we go further, a quick baseline — twelve questions, a minute or two.' +
  '\n\nThis sets your starting Grinta Index. Grinta is grit, and you don’t get to midlife without it — this just ' +
  'marks where yours stands today, so you can watch it climb.';
// The WHY before the scale (a mirror; sets the starting Grinta to watch climb), then how to answer + the 1–5 scale.
// The honesty line lives on the RAMP now (the last screen before the conversation starts), so repeating it here
// would be the third time a member has been told to be honest before answering anything.
const GRINTA_SCALE =
  'Answer as you actually are right now, not who you’re aiming to be. For each, how true does it feel — 1 (not at ' +
  'all) to 5 (completely)?\n\nToday:';
// The full survey opener as TWO beats (two bubbles): the Phases intro (orientation), then the pre-survey framing +
// the first item (the survey instruction). Two jobs — let each breathe (same reason as the drift-beat split).
function grintaSurveyOpener(): string {
  return `${GRINTA_OPEN}${BEAT_SEP}${GRINTA_SCALE}\n\n${grintaDeliver(0)}`;
}

// A member answered with something that isn't a 1–5 → re-ask the CURRENT item, gently.
function grintaReprompt(index: number): string {
  return `A number from 1 to 5 is all I need here — 1 is “not at all,” 5 is “completely.”\n\n${grintaDeliver(index)}`;
}

// Deliver the item at 0-based `index`. W-48: the "n of 12" progress cue moved to the chip surface (universal across
// all instruments via the ScaleExpectation index/total), so it's no longer prefixed here — it would double up.
function grintaDeliver(index: number): string {
  return `“${grintaStem(ONBOARDING_BASELINE_ITEMS[index]!)}”`;
}

// The completion beat — folds the whole-picture commit handoff (the confirmation card is rendered client-side from
// `collected`; nothing saves until the member confirms) WITH the light Grinta reveal: the baseline number + the
// four Rs, Reconnect lit next. Governed: a starting line, never a grade; no ID Score.
function grintaClose(composite: number): string {
  // Onboarding Copy v2 (Jay's voice pass): "working through the four Phases, one at a time" (was "closing each R…");
  // "ready for you now" (was "already lit").
  return (
    `That’s the whole check-in. Thanks for staying with it.\n\n` +
    `Your starting Grinta Index is ${composite} out of 5. This is just where you stand today. You will build it in ` +
    `the G4L program by working through the four Phases — Reconnect, Rewire, Rebuild, and Reclaim.\n\n` +
    `Take a look below at what I captured from our conversation so far. You are now officially into the first Phase ` +
    `of G4L — Reconnect. Well done!`
  );
}

const grintaStage: StageDef = administeredStage({
  id: 'grinta',
  itemCount: ONBOARDING_BASELINE_ITEMS.length, // 12
  minLabel: 'not at all', // W-24: chip anchors — the frozen Grinta 1–5 poles
  maxLabel: 'completely',
  opener: () => grintaSurveyOpener(), // the 4Rs intro + scale + item 0, delivered when Reclaim hands in
  deliverItem: (n) => grintaDeliver(n),
  reprompt: (n) => grintaReprompt(n),
  onComplete: (b) => {
    // Score the 12, stash the baseline (composite + the 4 strand means) for the card + the action, and COMPLETE.
    const score = scoreGrinta(ONBOARDING_BASELINE_ITEMS, b.administeredResponses);
    b.collected.grintaBaseline = score;
    b.stage = 'complete';
    b.complete = true;
    b.reply = grintaClose(score.composite);
  },
});

// The seam from Reclaim into the Grinta baseline. Called from BOTH of Reclaim's terminal crossings (the confirm
// seatbelt and the runaway backstop) in place of completing: the capture is settled, so instead of finishing we
// hand into the administered survey. complete stays false — the opener renders as a normal turn, not the card.
// RECEIVE BEFORE YOU MOVE — the reclaim → baseline hand-in.
//
// The member has just written the thing the whole program aims at, and the next bubble was the scripted baseline
// frame. Jay, walking it 2026-08-14: "it rushed through and didn't acknowledge." He had typed three items and the
// Companion went straight to "Before we go further, a quick baseline."
//
// The contract already exists — receiveThen(), used at two Reconnect hand-ins for exactly this reason ("the
// founder answered a weighty question and got the cold let's-shift frame"). This transition never got it. Third
// site of the same rule, second time it was missing.
//
// TWO HALVES, because this beat is different from Reconnect's: the list arrives from the STRUCTURED BUILDER, so
// there is often no model prose to receive. When there is, receiveThen uses it. When there isn't, we still owe an
// acknowledgment — and the honest one is their own words, back, which also proves we heard them. No praise, no
// grading: the list is not an achievement, it is what they want back.
function reclaimReceipt(c: Collected): string {
  const list = (c.reclaimList ?? []).map((x) => x.trim()).filter(Boolean);
  if (!list.length) return '';
  // Same correction as the recap's read-back above: "That's your list" trips the list-is-made gate. This is the
  // fallback path (model silent), which is why it went unnoticed for so long.
  return `Here's what you wrote — ${list.join(' · ')}.`;
}

/**
 * @param engineSpoke the caller has already written this turn's prose, so the MODEL's text is dropped rather than
 *   carried. Only the Reclaim recap sets it, and Donna's walk is why.
 */
function enterGrintaSurvey(b: Beat, gateShapes = true, engineSpoke = false): Turn {
  // DECISION II CHOKEPOINT — now scoped to the RETIRED CONVERSATIONAL PATH ONLY (Jay, 2026-07-30).
  //
  // The shape gate is extraction-era machinery: it existed because conversational capture produced sloppy lists that
  // had to be reconciled before they could be trusted. Since the structured builder shipped (2026-07-29) the member
  // TYPES her own entries and they ARE the list, verbatim — so running the gate over them means interrogating words
  // she wrote herself ("you named a few things in <her own sentence>"), which contradicts the very guarantee the
  // builder was built to give. Jennifer's walk is what that looks like from her side.
  //
  // So a builder submission passes gateShapes=false and goes straight through. Shaping did not disappear — it MOVED
  // to where it belongs: the member edits her list from the Companion rail, and the Companion can offer to sharpen an
  // item into something trackable. That is member-initiated and non-blocking, instead of a gate standing between her
  // and the rest of onboarding.
  if (!gateShapes) {
    b.stage = 'grinta';
    b.awaitingConfirm = false;
    b.reply = receiveThen(engineSpoke ? '' : (b.modelText || reclaimReceipt(b.collected)), grintaSurveyOpener());
    const ex = nextExpects(b.arc, b.stage, false, b.administeredResponses.length, b.collected, b.awaitingConfirm);
    return { reply: b.reply, state: beatState(b), complete: false, ...(ex && { expects: ex }) };
  }
  const proposal = gateNextShape(b);
  if (proposal) {
    b.stage = 'reclaim';
    b.awaitingConfirm = true;
    b.reply = proposal;
    return { reply: b.reply, state: beatState(b), complete: false };
  }
  b.stage = 'grinta';
  b.awaitingConfirm = false;
  b.reply = receiveThen(engineSpoke ? '' : (b.modelText || reclaimReceipt(b.collected)), grintaSurveyOpener());
  // W-24/W-48: this is the ONLY path into the grinta survey (natural confirm AND the runaway/ceiling backstop), so emit
  // the chip signal (+ "Question 1 of 12") here — otherwise a force-progressed member gets the text box for item 1.
  const expects = nextExpects(b.arc, b.stage, false, b.administeredResponses.length, b.collected, b.awaitingConfirm);
  return { reply: b.reply, state: beatState(b), complete: false, ...(expects && { expects }) };
}

const ONBOARDING_ARC: ArcConfig = {
  id: 'onboarding',
  stageOrder: ['identity', 'gap', 'reclaim', 'grinta'],
  stages: { identity: identityStage, gap: gapStage, reclaim: reclaimStage, grinta: grintaStage },
  onComplete: () => COMPLETE_HANDOFF,
};

/**
 * WHICH STRUCTURED SURFACE A RESUMED SESSION SHOULD RENDER.
 *
 * The saved session carries `state` and `messages` and NOT the expectation — so on a refresh the client had
 * nothing to render chips from and fell back to the text box. Donna hit it on the Grinta baseline: twelve items
 * that can only be answered 1-5, and no 1-5 to tap (2026-08-20). It was live for every structured beat, not just
 * that one: refresh at the gap confirm and the three chips vanish; refresh at the Reclaim builder and the form
 * does. Anywhere a member is told to tap, a reload turned it into a box.
 *
 * DERIVED, NOT STORED. The expectation is a pure function of the state the engine already persists, so computing
 * it on resume cannot disagree with what a live turn would have produced — whereas a second copy written into the
 * session row is one more thing to keep in step, and it would be wrong for every session saved before it shipped.
 */
export function expectsForResume(state: ConvState): Expectation | undefined {
  if (!state?.stage) return undefined;
  return nextExpects(
    ONBOARDING_ARC,
    state.stage as StageId,
    state.stage === 'complete',
    state.administeredResponses?.length ?? 0,
    state.collected ?? {},
    state.awaitingConfirm ?? false,
  );
}

/** The draw-out flag lives in the reclaim stage's scratch; read it the same way the live turn does. */

// --- the generic kernel: run one turn of ANY arc -------------------------------------------------------
// The rephrase. It takes the blame, invites their own words, and adds NOTHING about their life — inventing
// content for a member who just said they were lost is the worst available move. Kept as one line so
// alreadyClarified can find it in the transcript; a second confusion after this one proceeds.
export const CLARIFY_REPLY =
  "That was me asking it badly — let me try again. Say it however it comes to you, in your own words, and I'll follow.";
const alreadyClarified = (history: ConvMessage[]): boolean =>
  history.some((h) => h.role === 'agent' && (h.text ?? '').includes(CLARIFY_REPLY));

export function runArcTurn(
  arc: ArcConfig,
  state: ConvState,
  history: ConvMessage[],
  memberMessage: string,
  model: ModelTurn,
): Turn {
  // GOVERNANCE — crisis routing is always on (CLAUDE.md hard rule). A distress signal in ANY arc turn — Reconnect,
  // Rewire, Rebuild, Reclaim; administered, draw-out, or coach — short-circuits to the 988 protocol before the engine
  // processes it. The deterministic backstop beneath the model's own instruction; every arc on this kernel inherits it,
  // so a future arc can't forget it. (Onboarding handles its own crisis upstream in onboardingNextTurn.)
  if (detectCrisis(memberMessage).flagged) {
    return { reply: CRISIS_RESPONSE_US, state, complete: false, crisis: true };
  }
  // "I DON'T UNDERSTAND" IS NOT A CONFIRMATION — held here, beside crisis, for the same reason: it is a rule that
  // must hold in every arc, and a rule enforced at each confirm() is a rule some future stage forgets.
  //
  // The confirm gates classify a reply as dispute / addition / done and let everything unrecognised fall to done.
  // That bias is deliberate and mostly right. It is wrong when the member has told us they did not follow us:
  // Jay's walk (2026-08-13) had the Companion emit its graceful fallback, Jay ask "What do you mean", and the
  // engine read that as agreement and end the Doors excavation into the 24-item IDQ.
  //
  // ONLY AT A GATE (awaitingConfirm), because that is where a reply is being read as consent. Mid-draw-out the
  // model handles a confused member itself, and intercepting there would talk over it.
  //
  // ONCE. If we already asked for a rephrase and they are still stuck, the beat proceeds rather than trapping
  // them in a loop — the failure in the other direction, and the reason the advance-bias exists at all.
  if ((state.awaitingConfirm ?? false) && memberIsConfused(memberMessage) && !alreadyClarified(history)) {
    return { reply: CLARIFY_REPLY, state, complete: false };
  }
  const collected = mergeStaged({ ...state.collected }, model.record, memberMessage, doorPolicyFor(arc.id, state.stage));
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

  const stageAtEntry = (state.stage ?? arc.stageOrder[0]) as StageId;
  const baseScratch: Record<string, StageScratch> = { ...(state.stageScratch ?? {}) };
  const b: Beat = {
    history,
    memberMessage,
    model,
    // THE VOICE GATE, at the one seam where model prose enters a beat (Donna 2026-08-22, Jay approved 08-23).
    // stripLeadingDisclosure already establishes that this is where the model's text gets cleaned; the tells she
    // reported go through the same door. Deletions only — see lib/agent/voice-gate.ts for why substitution was
    // tried, mangled a sentence in its own test, and was cut.
    modelText: applyVoiceGate(stripLeadingDisclosure(model.text).trim()).text,
    refinedThisTurn,
    priorReclaimLen: state.collected.reclaimList?.length ?? 0,
    arc,
    collected,
    stage: stageAtEntry,
    awaitingConfirm: state.awaitingConfirm ?? false,
    reply: '',
    complete: false,
    declined: false,
    idleTurns: state.idleTurns ?? 0,
    stageAtEntry,
    baseScratch,
    scratch: { ...(baseScratch[stageAtEntry] ?? {}) }, // the current stage's bag, copied so mutations are isolated
    pendingRevision: state.pendingRevision, // §2b revision, threaded across the propose→confirm turns
    reseeingTells: [...(state.reseeingTells ?? [])],
    administeredResponses: [...(state.administeredResponses ?? [])], // §2c administered responses, accumulated
    pendingHarvest: [...(state.pendingHarvest ?? [])], // §2d harvest queue, drained by the action
    driftPayload: state.driftPayload,
    legacyDraft: state.legacyDraft,
    legacyRevisions: state.legacyRevisions,
    legacyLetter: state.legacyLetter,
    legacyTuesday: state.legacyTuesday,
    boardSubmission: state.boardSubmission,
    pendingReclaimShape: state.pendingReclaimShape, // Decision II, threaded across the propose→confirm turns
    reclaimShapesResolved: [...(state.reclaimShapesResolved ?? [])],
    pendingIdentityPick: state.pendingIdentityPick, // identity chips: candidates offered last turn, this message is the pick
  };
  const stageDef = arc.stages[b.stage];

  // ADMINISTERED stages (§2c — validated instruments: IDQ, Grit) run entirely OFF the depth kernel: no idle/runaway
  // backstop, no gather/confirm draw-out loop, no floor/verbatim gate, no no-repeat lead. Just deliver the fixed item
  // and capture the fixed-scale response. This is the WALL — a validated construct is never "drawn out".
  if (stageDef?.mode === 'administered' && stageDef.administer) {
    b.awaitingConfirm = false; // administered stages have no reflect-confirm loop
    const early = stageDef.administer(b);
    if (early) return early;
    const expects = nextExpects(arc, b.stage, b.complete, b.administeredResponses.length, b.collected); // W-24/W-48: next item → chips (+ "n of y"); completed → prose close
    return { reply: b.reply, state: beatState(b), complete: b.complete, ...(b.declined ? { declined: true } : {}), ...(expects && { expects }), ...(b.visual && { visual: b.visual }) };
  }

  // COACH stages (§B3, Decision PP) also run OFF the depth kernel: the model owns the coaching conversation and the
  // engine holds the plan-COMPLETENESS contract (accumulate the model's locked fields via model.plan → propose the
  // whole plan → confirm → complete).
  //
  // CAT-35 — COACH MODE HAD NO LIVENESS FLOOR, and it was the only kernel path without one. The completeness
  // contract guarantees "never leave without a plan" but said nothing about "always able to LEAVE": if the model
  // never emitted both plan fields — because the member stonewalled, or because it simply never called record_plan
  // — the stage never proposed and never completed. B3 looped forever and blocked the B3→B4 advance. Reproduced at
  // 30 turns of "I don't know" still sitting in 'pilot'.
  //
  // So coach mode gets the same ABSOLUTE ceiling the draw-out path has. Deliberately only the hard ceiling, not the
  // 3-turn idle limit: coaching is legitimately slow and circular, and a member thinking out loud must never be
  // hurried out of it. This is the runaway floor, not an efficiency gate.
  if (stageDef?.mode === 'coach' && stageDef.coach) {
    const coachTurns = history.filter((h) => h.role === 'member').length + 1;
    if (coachTurns >= ONBOARDING_HARD_CEILING) {
      const forced = stageDef.forceProgress?.(b);
      if (forced) return forced;
      // forceProgress may mutate-and-fall-through (the usual shape) — if it ended the stage, emit that, don't
      // hand the turn back to the coach and overwrite its exit line.
      if (b.complete) return { reply: b.reply, state: beatState(b), complete: true, ...(b.visual && { visual: b.visual }) };
    }
    const early = stageDef.coach(b);
    if (early) return early;
    return { reply: b.reply, state: beatState(b), complete: b.complete, ...(b.declined ? { declined: true } : {}), ...(b.visual && { visual: b.visual }) };
  }

  // PROGRESS vs STALL: the member CONTRIBUTED this turn if a captured field grew, OR they offered usable
  // substance (per the current stage) and weren't deflecting. Biased toward "engaged" — a verbose member resets
  // the idle counter every turn they give something, so length never triggers the cap; only a true STALL does.
  const grew =
    (collected.gap?.length ?? 0) > (state.collected.gap?.length ?? 0) ||
    doorsKnown(collected).length > doorsKnown(state.collected).length ||
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
    // A STAGE TRANSITION CLEARS THE CONFIRM GATE (systemic invariant).
    //
    // A handler that changes b.stage has just emitted the NEW stage's OPENER as its reply. Nothing is pending a
    // check across that seam, so the member's next message is an answer to that opener — it must reach the new
    // stage's gather(), never its confirm().
    //
    // Left to each handler this is one fact restated at every transition site, and it was already wrong at six of
    // Reconnect's seven. The live cost: drift's confirm handed into The Window with awaitingConfirm still true, so
    // the member's FIRST Tuesday answer was routed to windowStage.confirm(). Read as assent, the Window closed on
    // the spot — the whole §2d beat skipped — and since driftPayload had just been cleared there was no payload to
    // queue, so the spark keeper was silently lost. Jennifer's walk (2026-08-09) ended with one keeper where there
    // should have been two, and the vision she had just described was thrown away.
    if (b.stage !== stageAtEntry) b.awaitingConfirm = false;
  } else {
    // CONFIRM-ONLY CARD (Jay's call): the card sits at the terminal 'complete' stage, and the reclaim work is DONE
    // by here. New wants are NOT captured post-card — the earlier "add at the card" path was buggy (silent loss +
    // no room to answer), and Reconnect (which revisits the whole list) + the companion rail (Decision L CRUD)
    // are where wants are added from here. So FREEZE the Reclaim List against any growth this turn (the model may
    // have re-recorded it) — the card is a gate, not an editor. Corrections to identity/doors/gap still merge above.
    // If the member TRIES to add a want here, nothing lands — so the reply must NEVER claim it did. A false "Added"
    // dents trust the same way the silent loss did, just relocated (Jay). Deterministic override: say the list is set,
    // add more in the first session or the rail. Detected engine-side so it never depends on the model behaving.
    const addAttempt = arc.id === 'onboarding' && (reclaimAddIntent(memberMessage) || shouldCaptureStagedReclaim(memberMessage));
    if (arc.id === 'onboarding') b.collected.reclaimList = state.collected.reclaimList;
    b.reply = addAttempt ? CARD_LIST_SET : b.modelText || arc.onComplete(b.collected);
    b.complete = true;
  }

  // GENERAL no-verbatim-repeat guard: never emit the exact line we just said. A static opener/nudge falling
  // through twice reads as a broken loop. Prepend a short rotating warm lead. (Mid-conversation only.)
  //
  // This used to skip while awaitingConfirm — which is precisely the state where repeats happen, because a confirm
  // that isn't resolved re-emits the same reflection fallback. Jennifer's walk shipped one line three times running.
  // A guard whose job is "never say the same thing twice" cannot have an exemption for the case that says it twice.
  if (!b.complete && b.reply === lastAgentReply(history)) {
    const leads = ['Take whatever time you need.', 'No rush at all.', "Whenever you're ready.", "There's no wrong way in."];
    b.reply = `${leads[history.length % leads.length]} ${b.reply}`;
  }

  // A handler may have emitted a structured turn directly (identity tap-to-pick chips); that wins. Otherwise derive
  // the expectation from the resulting stage (W-24/W-48: a draw-out handing INTO an administered stage delivers item 0).
  const expects = b.expects ?? nextExpects(arc, b.stage, b.complete, b.administeredResponses.length, b.collected, b.awaitingConfirm);
  return { reply: b.reply, state: beatState(b), complete: b.complete, ...(b.declined ? { declined: true } : {}), ...(expects && { expects }) };
}

// The onboarding turn — config #1 on the generic kernel. The public signature is unchanged (callers/fixtures
// keep calling applyStagedTurn); it now just binds ONBOARDING_ARC.
export function applyStagedTurn(
  state: ConvState,
  history: ConvMessage[],
  memberMessage: string,
  model: ModelTurn,
): Turn {
  // 'declined' is a TERMINAL off-ramp (out of scope, Decision E). On resume it isn't a real stage in the arc, so
  // without this it fell through to the 'complete' card branch and force-committed an empty member. Re-assert the
  // decline instead — never drag a declined session into a broken completion. (CAT-26)
  if (state.stage === 'declined') {
    return { reply: DECLINE_REPLY, state, complete: false, declined: true };
  }
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
    name: 'offer_identity_words',
    description:
      "Offer 2–4 candidate handle words for who the member was at their best, drawn FROM THEIR OWN LANGUAGE in this " +
      'conversation (e.g. after they describe racing bikes and chasing summits: ["Athlete", "Cyclist", "Competitor"]). ' +
      "Call this ONCE you've genuinely drawn out the past self — it hands the member a tap-to-pick chooser (chips + a " +
      "write-your-own field) so THEY choose or coin the word; their pick is captured verbatim and is definitive. Natural " +
      'case, no leading article ("Athlete", never "the Athlete"). Your prose this turn should warmly invite them to tap ' +
      "one or write their own. Do NOT also call name_identity — the member's tap is what names it.",
    input_schema: { type: 'object' as const, properties: { words: { type: 'array', items: { type: 'string' } } }, required: ['words'] },
  },
  {
    name: 'name_identity',
    description:
      'Record the reclaimed-identity word directly, natural case (e.g. "Athlete") — ONLY when the member flatly names ' +
      'it themselves before you offer candidates. For the normal choose-a-word beat use offer_identity_words instead.',
    input_schema: { type: 'object' as const, properties: { noun: { type: 'string' } }, required: ['noun'] },
  },
  {
    name: 'skip_identity',
    description: 'Record that the member chose NOT to name an identity yet (they will find it at Identity Excavation).',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'set_gap',
    description:
      "Record how the distance opened — the fade story (the gap) — in the member's OWN FIRST-PERSON voice, keeping " +
      "their words and specifics as they told it ('I stopped training but kept riding, then lost the level'; 'my wife " +
      "got laid off, which hit her hard'). This exact text is shown back to them on their summary card ('Here's what " +
      "you shared') and dashboard ('in your own words'), so it must read as their OWN account. The one thing to avoid: " +
      "NEVER rewrite it into the THIRD person about them ('they/their', or a guessed 'he/she') — that distances them " +
      "from their own story. Keep it first person, as they said it. W-33: write it as clean, correctly-spelled and " +
      "-punctuated prose (whole sentences, proper periods) — but ONLY fix mechanics; preserve their exact words, " +
      "phrasing, and voice. Never paraphrase, reorder, smooth, or add. W-45: compose the story ONCE — each part of it " +
      "appears a SINGLE time; never re-tell or restate what you've already captured. As a member reveals more, the gap " +
      "GROWS with the new part; it does not repeat the whole arc again. Call this once they've told you how it went.",
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
      'career_cliff, aging_parents, empty_nest, vanishing, body, diagnosis, marriage, loss, full_house, grind, load_bearer, acceptance ' +
      '(acceptance = resignation to age/decline — "this is just who I am now, at my age" — a real, quiet Fade). ' +
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
      'Record one thing the member wants back (a Reclaim-List item), in their words — the CONCRETE want itself, plainly. ' +
      'Do NOT prepend a theme/category or compose a "Theme — the want" phrasing: write "riding up to Brainard Lake", NOT ' +
      '"Fitness back — riding up to Brainard Lake". Call once per item; it accumulates. ' +
      "If they volunteer one EARLY (before the reclaim stage), capture it here anyway so it's never lost — you'll bring it back at its stage. " +
      'Call add ONLY for a genuinely NEW, distinct want. Do NOT call add for an amount, number, cadence, or detail that ' +
      "ELABORATES the want you most recently added — that is the SAME want getting sharper ('about 25 lbs' after " +
      "'lose weight'; '2-3 rides a week' after 'ride my bike'; 'a few days a week there too' after 'core work'). Fold " +
      'those into the existing item with refine_reclaim_item — NEVER as a second item, or the card reads repetitive and sloppy. ' +
      'ONLY record a concrete want. Do NOT record a passing aside, a moment of confusion ("this isn\'t making sense"), ' +
      'a logistics remark, or an identity statement of WHO they are ("I\'m a director") — an identity belongs to who ' +
      'they are, not the goal list; reflect it back and hold it, but do not add it as a reclaim item.',
    input_schema: {
      type: 'object' as const,
      properties: { text: { type: 'string' }, category: { type: 'string' } },
      required: ['text'],
    },
  },
  {
    name: 'refine_reclaim_item',
    description:
      "REPLACE the reclaim item you MOST RECENTLY added with a sharper, more complete version — pass the WHOLE new " +
      "phrasing in `text`, in their words. Two triggers: (1) after you gently drew them toward something trackable " +
      "('ride my bike more' → 'ride my bike a couple times a week'); (2) whenever their reply just adds an amount, " +
      "number, cadence, or detail to the want you most recently added — FOLD it in ('lose weight' + 'about 25 lbs' → " +
      "'lose about 25 lbs'; 'core work' + '2-3 days a week' → 'core work, 2-3 days a week'). This updates the item in " +
      "place — it does NOT add a second one. Use add_reclaim_item ONLY for a genuinely new, distinct want.",
    input_schema: { type: 'object' as const, properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'member_reply',
    description:
      "At a reflect-confirm beat (right after you reflected something back — their past self, their gap story, or " +
      "their Reclaim List — and asked whether it lands or if there's more), classify what the member's reply MEANS, " +
      "so the conversation moves the right way. Call it once with `intent`: 'done' = they're satisfied / nothing to " +
      "add / a plain 'nope, that's right' answering 'anything missing?'; 'more' = they're adding new material or want " +
      "to change/extend it; 'dispute' = they say the reflection is WRONG. When unsure, omit it — a plain-language " +
      "fallback covers you. This is ONLY for the reply to a reflection, not for normal gathering turns.",
    input_schema: {
      type: 'object' as const,
      properties: { intent: { type: 'string', enum: ['done', 'more', 'dispute'] } },
      required: ['intent'],
    },
  },
];

// Parse a staged model response (per-field tool calls) into the merged Partial<Collected> the engine reads.
export function parseStagedTurn(content: readonly unknown[]): ModelTurn {
  let text = '';
  let noFade = false;
  let gapReady = false;
  let refineReclaim: string | undefined;
  let replyIntent: ReplyIntent | undefined;
  let identityCandidates: string[] | undefined;
  const rec: Partial<Collected> = {};
  for (const b of content as Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }>) {
    if (b.type === 'text' && typeof b.text === 'string') text += b.text;
    if (b.type === 'tool_use') {
      if (b.name === 'set_past_self' && typeof b.input?.text === 'string') rec.athleticPast = b.input.text;
      if (b.name === 'offer_identity_words' && Array.isArray(b.input?.words)) {
        const words = (b.input.words as unknown[]).filter((w): w is string => typeof w === 'string' && w.trim().length > 0).map((w) => w.trim());
        if (words.length) identityCandidates = words;
      }
      if (b.name === 'name_identity' && typeof b.input?.noun === 'string') rec.identityNoun = cleanIdentityNoun(b.input.noun);
      if (b.name === 'skip_identity') rec.identitySkipped = true;
      // Tidy the MODEL's set_gap too (torture-harness fragment-typer: the model sometimes stores raw run-on prose
      // despite the instruction). tidyGapProse is a no-op on clean prose, so this only cleans mechanics — never
      // changes the model's words. Closes the hole where a raw model set_gap bypassed the backstop-only tidy.
      if (b.name === 'set_gap' && typeof b.input?.text === 'string') rec.gap = tidyGapProse(b.input.text);
      if (b.name === 'note_door' && typeof b.input?.slug === 'string' && isDoorSlug(b.input.slug)) {
        (rec.doors ??= []).push(b.input.slug);
      }
      if (b.name === 'add_reclaim_item' && typeof b.input?.text === 'string') {
        (rec.reclaimList ??= []).push(b.input.text);
        (rec.reclaimCategories ??= []).push(typeof b.input.category === 'string' ? b.input.category : '');
      }
      if (b.name === 'refine_reclaim_item' && typeof b.input?.text === 'string') refineReclaim = b.input.text;
      if (b.name === 'member_reply' && (b.input?.intent === 'done' || b.input?.intent === 'more' || b.input?.intent === 'dispute')) {
        replyIntent = b.input.intent;
      }
      if (b.name === 'note_no_fade') noFade = true;
      if (b.name === 'reflect_gap') gapReady = true;
    }
  }
  // Governance arbitration (CAT-11): if the model OFFERS candidate words this turn, the member's tap is what names the
  // identity — so a same-turn name_identity must NOT commit an unconfirmed handle. The offer wins; drop the name.
  if (identityCandidates && rec.identityNoun !== undefined) rec.identityNoun = undefined;
  return { text, record: rec, noFade, gapReady, refineReclaim, replyIntent, ...(identityCandidates && { identityCandidates }) };
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
- offer_identity_words(words): 2–4 candidate handle words from THEIR OWN language → the member taps or coins one (the normal path once you've drawn the past self out).
- name_identity(noun): only if the member flatly declares the word themselves before you offer.
- skip_identity(): they chose not to name one yet.
- set_gap(text): how the distance opened — their fade story, in their words.
- note_door(slug): a life event that opened the distance (one call per Door; none is valid — never force one).
If the member volunteers something for a LATER stage (e.g. names what they want back while you're still on
identity), capture it with its tool anyway — never lose it — but keep asking only about the CURRENT stage;
you'll bring it back at its stage.

IDENTITY STAGE: open on who they were when they felt most like themselves — a past self of ANY kind (never
assume athletic). Draw it out, reflect a specific detail back, and once you have a real feel for that person,
call offer_identity_words with 2–4 candidate words FROM THEIR OWN LANGUAGE — your prose warmly invites them to
tap one or write their own, framed as a changeable HANDLE, not a verdict.
EVERY CANDIDATE MUST BE A NOUN — A PERSON THEY WERE, NOT A QUALITY THEY HAD. "the Runner", "the Swimmer",
"the Builder", "the Maker", "the Friend Who Always Called". NEVER adjectives: not "Untamed", not "Sovereign",
not "Alive", not "Fearless". The whole program is about reclaiming an IDENTITY — someone you can go be again
on a Tuesday morning — and an adjective is a mood, which gives them nothing to walk back toward. If their own
language gives you only adjectives, name the PERSON who was that way ("unstoppable on the bike" → the Cyclist). The member's tap/coin names it
(captured verbatim) — do NOT also call name_identity on that turn, and do NOT ask them to confirm it afterward;
the tap IS the choice, so once it's made you move straight on to how the gap opened. Only use name_identity if
the member flatly declares the word themselves before you offer. If they're genuinely not ready, reassure them
and call skip_identity — never pressure a name.

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
with set_gap as it grows — and ALWAYS record it with set_gap, every gap turn, in clean mechanics-fixed prose
(their exact words, whole sentences, proper capitalization and periods). The set_gap text is the ONLY tidied
record shown on their card and dashboard "in your own words"; if you skip it, the engine falls back to their raw
message VERBATIM — typos, fragments, run-ons and all — which reads unpolished. So never leave the fade story
unrecorded, and never store it raw.
DO NOT BUILD THEIR RECLAIM LIST HERE. This stage is HOW IT OPENED — nothing else. People naturally name things
they miss while telling you how they lost them; note each one with add_reclaim_item as it lands, silently, and
keep going with the story. But NEVER compose those wants into a list, never read a list back to them, and never
ask them to confirm one ("here's the whole of it… does that land?"). The next stage hands them a form they fill
in THEMSELVES, so a list you assemble here just makes them say it all over again a moment later — which reads as
if you weren't listening the first time. Warmth about what they miss is right and welcome; ASSEMBLING it is what
the next stage is for. If you find yourself summarising what they want, stop: stay with the story.

ONLY when you have GENUINELY drawn it out — something specific and true you can reflect back in their own words —
call reflect_gap to close the beat, and on that same turn reflect their WHOLE story back in two or three
sentences, in their words. Reflect the STORY — how it happened — not a summary of what they want back.
NEVER call reflect_gap on the first mention of what happened. (The engine holds the
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
WHOSE LIFE — a Door is an event in THE MEMBER'S OWN life. Their story is full of other people, and those people
have divorces, illnesses and job losses of their own. "My dad's second marriage fell apart" is not the member's
Marriage; "my sister got laid off" is not their Career Cliff. Tag the event only when it happened TO THEM. When
someone else's event changed the member's own life, tag the Door that names what it did to THEM (a parent's
illness → aging_parents; that parent dying → loss) — never the Door that belongs to the other person's story.
A DEATH IS ALWAYS ITS OWN DOOR. If someone close to them died, call note_door('loss') — even when you have
already tagged the illness or decline that came before it. A parent who got sick and then died is BOTH
aging_parents AND loss — separate events, each with its own Door. Never let the caregiving Door stand in
for the death.
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
READING THEIR REPLY (at a confirm) — right after you've reflected something back (their past self, their gap
story, or their Reclaim List) and asked whether it lands, the member's next message is answering THAT. Call
member_reply to tag what it means: 'done' (they're satisfied / a plain "nope, that's right"), 'more' (they're
adding or changing something), or 'dispute' (they say you got it wrong). This is how the conversation moves the
right way — a bare "no" answering "anything missing?" is 'done', not a dispute. If you're unsure, omit it.
NEVER ASSUME GENDER — this is a hard rule. You do NOT know the member's gender, and the reclaimed identity
("the Racer", "the Player", "the Writer") has NO gender. Never write "he/him" or "she/her" about the member or
their past self unless THEY used that pronoun about themselves first. Refer to the past self by its handle
("the Racer"), by "you/your" ("who you were", "you stopped running"), or by "that version of you" — never a
guessed pronoun. Getting this wrong ("the Racer… he faded") is a real harm; when in doubt, use the handle or "you".
NUMBER-FREE ONBOARDING — this whole conversation is free of scores and instruments. Do NOT mention the IDQ, the
ID Score, a questionnaire, a test, points, or "your first score" — not as a next step, not as a reward, not at
all. There is no next step to pitch: when the beats are done the member sees a summary card and their dashboard.
If you feel the pull to tell them what comes next, don't — just reflect what they gave you and ask your one
question. Naming an instrument here breaks the spell and is off-spec.`;

/**
 * The per-turn steering. `gapHeld` is the engine telling the model the truth about its OWN last turn — that its
 * reflect_gap was refused and the beat is still open. Engine state → model, rather than the reverse: inferring the
 * model's intent from its prose was tried (lib/agent/stage-agreement.ts) and could not be made to work, because
 * the model rephrases the pivot every time and a pattern list is a guess about wording.
 */
export function stageInstruction(stage?: Stage, opts?: { gapHeld?: boolean }): string {
  if (stage === 'gap')
    return (
      (opts?.gapHeld
        ? '\n\nHOLD — READ THIS FIRST: last turn you called reflect_gap, and the engine REFUSED it because the ' +
          'story is not drawn out yet. It kept the beat open and appended its own drawing-out question to your ' +
          'message, so the turn you can see in the history is NOT the turn you wrote. The gap is NOT closed. Do ' +
          'not summarise it as finished, and do NOT ask what they want back or name a Reclaim List — that beat ' +
          'belongs to the engine and it will open it when this one is genuinely done. Keep drawing the story ' +
          'out: what else landed around then, and what it cost them.'
        : '') +
      '\n\nCURRENT STAGE: how the gap opened — the Door(s). EXPLORE, and EXPECT MORE THAN ONE: it is rare for a single ' +
      'thing to be the whole story — usually several pile up over time (a job, a move, an injury, a loss, kids, slow ' +
      'drift). Draw the story out over SEVERAL exchanges — the sequence, when they first felt it, what it cost. After ' +
      'they name one door, RECEIVE it (reflect it back so they feel heard) and then ask what ELSE was going on around ' +
      'then — do NOT collapse it to one thread, and do NOT rush on to what they want back. This conversation earns its ' +
      // IF A WANT LANDS HERE, TAG IT HERE — the instruction has to live where it can be acted on.
      //
      // The reclaim steering says "tag every want they name earlier... the gap story especially". The model never
      // sees that until the reclaim stage, by which point this beat is over: it was being told, too late, to have
      // done something. That is why seeding fired only by luck, and why members who volunteered a want mid-story
      // were sometimes asked for it again at the builder.
      //
      // This does NOT invite wants — the sentence above still forbids that, and it is the rule that stops the
      // run-ahead. It only says: if they offer one unprompted while telling you how it happened, keep it.
      // DE-GENDERED 2026-08-24. This taught the model a female default for every member ("IF SHE VOLUNTEERS...",
      // "her list"), which is how a guessed pronoun reaches a real one — the failure the identity rule already
      // records: "'her' was wrong for a male member."
      'IF THEY VOLUNTEER SOMETHING THEY WANT BACK WHILE TELLING YOU THIS — "I miss riding", "I want to sleep ' +
      'again" — call add_reclaim_item the moment it lands, and carry on with the story. Do NOT ask for more of ' +
      'them and do NOT change the subject to their list: this beat is still how it happened. Tagging it here is ' +
      'what makes their Reclaim List open already holding it, so they never have to say the same thing twice.\n' +
      'time; do not compress it. Capture with set_gap as it grows, note_door for EACH door named (none is valid). Call ' +
      'reflect_gap ONLY once the FULLER picture is genuinely drawn out — usually after they have named more than one ' +
      'door or clearly told you that is the whole of it — and reflect their whole story back in their words on that turn. ' +
      'ALWAYS end your turn with your single forward question — your drawing-out ask while gathering ("was there more ' +
      'around then — other things that landed at the same time?"), or your correctable check on the reflect turn ' +
      '("does that land, or is there more to it?"). NEVER end on a bare reflection or wrap-up coda with no ' +
      'question ("let me make sure I have it right"), or the engine appends its own and the member sees a jumbled double-ask.\n' +
      // THE ONE EXEMPTION, and it is why the heaviest transition in onboarding was inconsistent (2026-08-19).
      //
      // The rule above has no exception for the turn where the member CLOSES the beat. So on that turn the model
      // obediently ends with another question — receiptOnly() strips it — and what is left is thin or empty. The
      // gap→reclaim hand-in is receiveThen(modelText, reclaimOpening), which falls back to "opener alone if no
      // receipt": she finishes describing her father's coma and reads a scripted bridge straight into "add each
      // thing below". Whether she gets a beat depended on what shape the model's sentence happened to take, which
      // is why Donna's persona failed on roughly half of identical runs.
      //
      // NOT FIXED BY ADDING A BEAT. Holding after she has closed is what 4c5b416 removed — Jay's walk: the confirm
      // would not close, "the engine stayed stuck in gap while the model moved on in its text, the stages
      // desynced". The bias to advance is deliberate. And a bridge-turn without the builder would leave her in a
      // text box whose next message reclaimStage.gather sends straight to the Grinta survey.
      //
      // So the engine keeps advancing exactly as it does; the model simply stops asking one more question at the
      // moment she has finished answering.
      'ONE EXEMPTION: the turn they CLOSE the story. When they tell you that is the whole of it — "that was it", ' +
      '"it was mostly those three things", a bare "no" to your check — do NOT ask anything further. That turn is ' +
      'a RECEIPT: reflect what they actually just told you, in their words, specific to what they said, and STOP. ' +
      'It is the last thing they read before the next beat opens, and after a story like this one, moving straight ' +
      'on is the part that reads as not having listened. The engine opens what comes next — you do not have to.'
    );
  if (stage === 'reclaim')
    return (
      '\n\nCURRENT STAGE: what they want back — the Reclaim List (what the whole program measures against; big or ' +
      'small, both belong).\n' +
      // THIS BLOCK DESCRIBED THE PRE-BUILDER DESIGN FOR THREE WEEKS AFTER THE BUILDER SHIPPED (fixed 2026-08-19).
      //
      // Structured capture landed 2026-07-29: the Reclaim List is built in a list-builder UI because conversational
      // extraction lost ~30% of what members said. The steering was never updated. It still told the model to "draw
      // this out... one want at a time", to end every turn with "what else?", and to sharpen each item with
      // refine_reclaim_item — a multi-turn elicitation the surface makes impossible, since the builder REPLACES the
      // text box and its submission REPLACES anything the model tagged.
      //
      // DEAD STEERING IS NOT NEUTRAL. The model follows it. Told to invite wants one at a time, it opens the topic
      // itself — and it cannot know the engine has not reached this stage yet. That is the run-ahead behind the
      // "rushed" reports: it asks what she wants back while the engine is still in the gap, so the builder never
      // renders, her list comes out of chat, and she is asked for it a second time. I spent a day chasing that as a
      // stage-detection problem. We were instructing it.
      //
      // Sharpening is gone from here on purpose too — see enterGrintaSurvey: it MOVED to the Companion rail,
      // member-initiated and non-blocking, instead of a gate standing between her and the rest of onboarding.
      // REWRITTEN 2026-08-19 with the draw-out. The block above replaced a conversational design with a
      // builder-only one; this replaced the builder-only one with BOTH, in order. Same trap either way — the
      // model follows what it reads, so steering that describes the previous design is not neutral, it is a bug
      // with a delay on it. Conversation elicits, structure confirms: the model draws her out, the builder opens
      // holding what she said. What must NOT come back is the drilling and re-tagging that lost ~30% of items.
      'THE ENGINE OPENS THIS BEAT — NOT YOU. Do not ask what they want back until it has. Opening this topic ' +
      'yourself is the single most common way this beat fails: they answer into a beat that is not running, and ' +
      'get asked for the same thing twice.\n' +
      'ONCE IT IS OPEN, DRAW THEM OUT — in conversation, one want at a time, and call add_reclaim_item the moment ' +
      'each lands. Their words, exactly as they said them: do not sharpen, re-word, make it concrete, or split it ' +
      // The tell, with the sentence that shipped. A want addressed to the member is one you wrote — and the
      // engine now drops those, so this is not a style note: phrase it as your sentence and it is lost.
      'up. **Never write a want in the second person** — "a role that lets YOU rebuild savings" is you talking to ' +
      'them, not them talking about their life, and it will be discarded. Tag "rebuild my savings", as they said ' +
      'it. Do NOT propose or recite a set of items to them — not mined from their gap story, not from anywhere. ' +
      'You are asking and receiving, never drafting. Ask about what they gave you, not what you expect to be ' +
      'missing.\n' +
      'THEN THE ENGINE OPENS A LIST-BUILDER, holding everything you tagged, and what they submit IS the list. It ' +
      'decides when — not you. Never promise them a form, describe one, or tell them they will get to write it ' +
      'down; if you name a step they cannot see yet and it does not arrive on your schedule, you have made the ' +
      'product look broken.\n' +
      // THE OTHER HALF OF "THE ENGINE DECIDES WHEN" — and the half that was missing (Donna, 2026-08-20).
      //
      // The block above forbids OPENING the beat early. Nothing forbade CLOSING it early, so the model did: having
      // heard three wants it wrote "So here's what you want back: … That's your Reclaim List. It lives on your
      // dashboard now", and two turns later "That's plenty for today." Nothing was committed, there was no
      // dashboard, there was no account, and the builder was still two turns out. She spent three turns asking
      // "is that it?", was told the assessment would come later and that someone else would have to get her to
      // her dashboard, and emailed to report the product broken. The engine now reads a close like that as the
      // signal it plainly is and opens the builder on the spot — but the model should not be writing it at all.
      'NEVER DECLARE THE LIST MADE, SAVED, OR THE SESSION OVER. Do not summarise their wants as a finished list, ' +
      'do not tell them it is on their dashboard or saved to their account, and do not say goodbye or that this ' +
      'is enough for today. None of it is true when you write it: nothing is stored until they submit the ' +
      'builder, and onboarding is not over until a baseline assessment and a summary card they have not seen yet. ' +
      'The exact shape to avoid, which shipped to a member: "So here\'s what you want back: — Lose the 20 lbs you ' +
      'gained … That\'s your Reclaim List. It lives on your dashboard now." Ending the conversation is the ' +
      'engine\'s to do, never yours — and if they ask what comes next, the next step arrives here in a moment; ' +
      'never tell them someone else will have to help them reach it.\n' +
      'WHEN THEIR SUBMISSION ARRIVES, RECEIVE IT. Your words on that turn are what they read back, so reflect the ' +
      'whole list — every item, in their words. A partial read-back tells them you were only half listening.\n' +
      // ONE TAG RULE, not three. It was stated in three separate blocks that grew independently, and the draw-out
      // above would have made a fourth. Same reason as everywhere else in this codebase: a rule restated N times
      // has N-1 copies waiting to drift out of agreement, and in a prompt the model gets to pick which one it
      // believes. Both exemplars are kept — they are what makes the rule legible.
      'TAG EVERY WANT — this is load-bearing, and it applies from the FIRST beat, not just this one. Call ' +
      'add_reclaim_item the MOMENT a want is named, including any they volunteered earlier (the gap story ' +
      'especially). Those earlier ones SEED the builder, so it opens already holding what they told you and they ' +
      'never have to say it twice. The Reclaim List is built ONLY from your tool calls, never from your prose — so ' +
      'if you reflect or list wants back, EVERY item you name must already be an add_reclaim_item call. Never ' +
      'recite a list you have not tagged, or it silently vanishes from their card.\n' +
      // Reworded 2026-08-19, and the guard test is why it is worded THIS way. It used to forbid saying you would
      // go through their wants "one at a time" — which now collides head-on with the draw-out above, where taking
      // them one at a time is the instruction. Deleting Donna's phrase to resolve that would have thrown away the
      // exemplar that makes the rule legible (the exact sentence she read), so the rule is split at its real
      // seam instead: the PACING is fine and always was, ANNOUNCING a per-item ceremony is what broke.
      'FINISH WHAT YOU PROMISE. Taking their wants one at a time is right — ANNOUNCING that you will is the ' +
      'failure. "Let me take those one at a time — they each deserve it" was said, one want was addressed, and ' +
      'the beat ended; this stage hands straight to the baseline survey, so there was never another turn to keep ' +
      'it in. Do not offer a review you will not carry out unless you address EVERY item before moving on. The ' +
      'safer move is not to promise one at all: receive each want as it lands, and close by telling them the ' +
      'whole list is on their dashboard and theirs to change anytime. If you DO reflect the list back, name ' +
      'every item you tagged — a partial read-back tells them you were only half listening.\n' +
      'NEVER ANNOUNCE THE MECHANICS — never say "let me make that concrete" or "before I capture that". Just ' +
      'receive what they gave you, in plain language.'
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
    maxRetries: 1,
    defaultHeaders: { 'accept-encoding': 'identity' },
  });
  const messages = [
    ...history.map((m) => ({ role: (m.role === 'agent' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.text })),
    { role: 'user' as const, content: memberMessage },
  ];
  // onboarding capture → Opus by default (Sonnet stalled in testing), Sonnet fail-safe if Opus errors. See capture-model.ts.
  const res = await captureCreate((model) => client.messages.create({
    model,
    max_tokens: 600,
    system: STAGED_SYSTEM + stageInstruction(state.stage, { gapHeld: state.stageScratch?.gap?.gapHeld === true }),
    tools: STAGED_TOOLS,
    messages,
  }));
  return applyStagedTurn(state, history, memberMessage, parseStagedTurn(res.content));
}

export type { Ctx };
