// Conversational onboarding — the Member Agent (G4L voice) conducting the intake as a real
// turn-by-turn conversation: listen, reflect, one question at a time. Voice rewrite v1 captures
// three records — the Reclaimed Identity, the Reclaim List, and the Door(s) — and hands off
// to the IDQ. The old separate "gap" / "right now" questions are folded in (the gap is captured
// inside the Door step; "right now" is the IDQ's job).
//
// Two backends behind one engine:
//   - scripted: deterministic state machine for local dev / tests (no key)
//   - live:     Claude with tool-use (record_progress) when ANTHROPIC_API_KEY is set
// Governance runs on every member turn (crisis detection -> 988 halt). The AI disclosure is the
// verbatim first line. Voice is G4L (Member-facing) — never Jay's, never impersonating Greg.

import { CRISIS_RESPONSE_US, detectCrisis } from './governance.ts';
import { MEMBER_AGENT_SYSTEM_PROMPT } from './system-prompt.ts';
import { DOORS, DOOR_SLUGS, isDoorSlug, matchDoors, correctDoors, type DoorSlug } from '../doors.ts';
import { cleanIdentityNoun, displayIdentityNoun, identityLabel } from '../member/identity.ts';
import { RECLAIM_LIST_MIN, RECLAIM_LIST_TARGET } from '../member/reclaim.ts';
import { contractMet, gapIsNarrative } from './onboarding-contract.ts';

export type Stage = 'identity' | 'identity_name' | 'reclaim' | 'door' | 'complete'
  // v2.0 staged-capture engine (lib/agent/onboarding-staged.ts) uses 'gap' for the "how it opened" stage.
  | 'gap'
  // v2.1 (Decision E): 'declined' is the terminal off-ramp for a genuinely-thriving no-fade member.
  | 'declined'
  // v2.2 Reconnect arc (config #2 on the shared kernel): its stage ids. 'entry' = the callback (§2a).
  | 'entry'
  | 'doors'
  | 'measurement'
  // §2d Visioning is TWO draw-out beats (V3): 'drift' (the Drift Quiz) then 'legacy' (the Legacy Letter), with the
  // turn-toward-hope BRIDGE at the drift→legacy seam. 'visioning' is retained as an alias but the arc uses the two.
  | 'visioning'
  | 'drift'
  | 'legacy'
  | 'checkpoint'
  | 'ceremony';

export type Collected = {
  athleticPast?: string; // Step 1: the past self, in the member's own words
  identityNoun?: string; // the reclaimed identity, natural case (e.g. "Athlete")
  identitySkipped?: boolean; // the member chose not to name an identity yet (they'll find it at Identity Excavation)
  reclaimList?: string[]; // >= RECLAIM_LIST_MIN
  reclaimCategories?: string[]; // IDQ-dimension category per item, same order (agent-inferred)
  gap?: string; // Step 3 free-text: how the gap opened (member's words)
  doors?: DoorSlug[]; // one or more
};

export type ConvState = {
  stage: Stage;
  collected: Collected;
  doorTurns?: number; // how many exchanges the Door beat has had (gates completion — see resolveCompletion)
  identityTurns?: number; // how many exchanges spent at the naming beat (drives the identity gate — see liveTurn)
  doorAsked?: boolean; // has the Door beat actually been ENTERED (the "how did the gap open?" question posed)?
  // Until then a gap can't be captured and the intake can't complete — "list hit the minimum" is NOT
  // "we're in the Door beat" (the list has no max). The fix for capturing/completing before the ask.
  doorBeatFromIndex?: number; // history index where the Door beat began — bounds the reconciliation scan
  pendingDoorConfirm?: DoorSlug | null; // a Door the engine surfaced for confirmation, awaiting the member's answer
  declinedDoors?: DoorSlug[]; // Doors the member set aside when asked — never re-surfaced
  awaitingMore?: boolean; // the member said the fade story isn't finished — hold (no complete) until they close it
  awaitingConfirm?: boolean; // v2.0 staged engine: the current stage's capture has been reflected; awaiting confirm
  idleTurns?: number; // v2.1 kernel: consecutive turns the member added NOTHING new — the runaway signal (cross-stage, so
  // it lives here, not in stageScratch). Resets to 0 the moment they contribute; a verbose ENGAGED member never trips the cap.
  // v2.1 kernel (Phase 1 step 0): per-stage scratch counters — each stage of each arc owns its own bag (identity: turns/probes;
  // gap: gapTurns/gapDepth/noFade; reclaim: reclaimNudged), so ConvState never sprawls with a new flat field per arc.
  stageScratch?: Record<string, Record<string, number | boolean | undefined>>;
  declined?: boolean; // v2.1 (Decision E): a genuinely-thriving no-fade member was gracefully declined (out of scope) — terminal
  // §2b Reconnect revision (Decision L): a re-seeing the Companion PROPOSED, awaiting the member's confirm (offered,
  // never asserted). Threaded across the propose→confirm turns; cleared on resolve. Slugs are canonical DoorSlugs.
  pendingRevision?: DoorRevision;
  // The re-seeing "tells" this session has EARNED (R4/R5): a confirmed correct that was a real re-seeing (not a flat
  // mislabel) emits one. Slice 1 records the intent here; the persistence layer (later slice) reads it to emit the
  // member_event harvest_moment (from→to in meta). Default-emit: present unless the model flagged flatMislabel.
  reseeingTells?: ReseeingTell[];
  // §2c Measurement (administered mode): the fixed-scale responses accumulated across the administered beat, in item
  // order. The engine gathers them off the depth kernel; the action submits the baseline (submitIdq) when the set is
  // complete. Reusable for any administered instrument (IDQ now; Grit later).
  administeredResponses?: number[];
  // §2d Visioning — the general HARVEST queue (keeper/share candidates the engine confirmed this arc). The action
  // drains NEW ones via emitHarvestMoment (same seam + default-emit discipline as the §2b re-seeing tell). Drift → a
  // keeper; Legacy line → a share candidate (slice 2). driftPayload carries the member's drift declaration (their own
  // words — the "preserve declarations" wall) from the reflect turn to the confirm turn, where the keeper is queued.
  pendingHarvest?: HarvestSignal[];
  driftPayload?: string;
};

// A harvest candidate the engine queued (drained by the action → emitHarvestMoment). keeperType is a plain string to
// avoid a cycle with harvest.ts (which imports Collected from here); the action maps it to the KeeperType enum.
export type HarvestSignal = {
  kind: string; // sourceRef.kind — e.g. 'drift', 'legacy'
  keeperType: string; // 'tell' for a named drift pattern (V4); a keeper enum value
  destinationIntent: 'keeper' | 'share' | 'both';
  payloadRef: string; // the member's verbatim words (preserve declarations); NEVER the transcript
  private?: boolean; // e.g. the Legacy Letter body — the event carries a reference, not the text
  label?: string;
};
export type ConvMessage = { role: 'agent' | 'member'; text: string };
export type Ctx = { name: string; email: string };

// A door revision (Decision L). `correct` = the primary was really a different Door (from→to, retires the old).
// `widen` = the Fade went through an ADDITIONAL Door the story surfaced; `name` = a quiet Door made explicit — both
// ADD (no fromSlug, nothing retired). Tell suppression: `flatMislabel` (correct) / `mechanical` (widen/name) — both
// mean "a routine change, not a re-seeing", so default-emit / suppress-only-on-explicit holds across all kinds (R4).
export type RevisionKind = 'correct' | 'widen' | 'name';
export type DoorRevision = { kind: RevisionKind; toSlug: DoorSlug; fromSlug?: DoorSlug; flatMislabel?: boolean; mechanical?: boolean };
export type ReseeingTell = { toSlug: DoorSlug; fromSlug?: DoorSlug }; // fromSlug set for a correct (a pair); absent for an add

export type Turn = { reply: string; state: ConvState; complete: boolean; crisis?: boolean; declined?: boolean };

export const INITIAL_STATE: ConvState = { stage: 'identity', collected: {} };

const FIRST_QUESTION =
  "Before we get to any numbers or plans, I want to understand who I'm helping you reclaim — the fullest version of you. Everything we build here points at that person.\n\n" +
  "Let's start by taking a minute to think about who you were back when you felt most like yourself.\n\n" +
  'Not the job title. Not the role everyone knows you for. The version underneath all that — ' +
  'the one who showed up before life got busy and quietly talked you out of it.\n\n' +
  'Maybe you never thought twice about the stairs. The one who played until your fingers hurt, the ' +
  'early riser, the friend who always called, the one who said yes to the trip. The builder, the ' +
  'writer, the runner, the parent down on the floor with the kids.\n\n' +
  "Whoever that was — tell me about them. The more real you make them, the less abstract your comeback " +
  'gets. We have a name for the distance between who you are right now and the you you’re reclaiming — ' +
  'the Fade: the slow drift between who you are and who you know you still are underneath. It opens ' +
  'gradually, through a hundred reasonable decisions, and most people are the last to notice it. In a few ' +
  'minutes your first ID Score puts a number on it — and from there, every step closes it.';

// The AI disclosure is woven into the start page (the gate), so the conversation opens straight on the
// question — no stiff repeat here.
export const OPENING_REPLY = FIRST_QUESTION;

const doorName = (slug: DoorSlug) => DOORS.find((d) => d.slug === slug)!.displayName;
const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// The Door is explored as a story, never presented as a menu — listing options stops the
// conversation, and we need to understand HOW the gap opened, not just label it.
const doorPrompt = () =>
  'One more thing before we start the work — and it might matter most. Somewhere, the gap began to open.\n\n' +
  'Sometimes it’s one clear thing — a loss, a diagnosis, a move, a job that swallowed you. More often it’s ' +
  'slower: a season that quietly took more than it gave. There’s no wrong story here. Tell me how it went ' +
  'for you — when you first felt the drift, and what it quietly cost you.';

// Shared Reclaim ask — the picture + the forecast (what the list IS and that the program points at it) +
// the ask. Prepended by the identity-lock connecting line (or the skip line) so it reads as one beat.
const reclaimPrompt = () =>
  'Picture having that back — not the highlight reel, an ordinary day. What does it actually look like? ' +
  'The real, specific stuff: riding before work without dreading it. Keeping up on the trail instead of waving ' +
  'everyone ahead. Looking in the mirror and recognizing the person looking back. Booking the trip you keep ' +
  'talking yourself out of.\n\n' +
  'These become your Reclaim List — the concrete things you’re coming back for, in your own words. The whole ' +
  'program points at this list: you’ll add to it, and check things off, as you go.\n\n' +
  'Three to start — more if they keep coming. What do you want back?';

function doorPhrase(doors: DoorSlug[]): string {
  const names = doors.map(doorName);
  if (names.length <= 1) return names[0] ?? 'The door that opened';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function handoff(doors: DoorSlug[], noun?: string): string {
  // Null routing is valid (Taxonomy Spec §1): a real Fade can complete with no Door. Lead with the
  // member's own account rather than a label they wouldn't claim.
  const opened = doors.length ? `${doorPhrase(doors)} is how it started.` : 'How you described it — in your own words — is how it started.';
  return (
    "Okay. Here's what we've got.\n\n" +
    `${opened} ${capFirst(identityLabel(noun) || 'That person')} is who we're bringing back. ` +
    'And your Reclaim List is what that looks like, in real life.\n\n' +
    'Before we go to work, we need one thing: a clear read on exactly how far the gap runs right now. ' +
    "That's next — a set of questions that hold up a mirror. No studying, no score to pass. Then we start closing the distance.\n\n" +
    'Ready when you are.'
  );
}

const IDQ_HANDOFF_TAIL =
  'Next, a set of questions to see exactly how far the gap runs right now — no studying, no score to pass. Ready when you are.';
// Prefer the model's OWN close (it can summarize the member's story and reveal the Door(s) in context,
// not just name them) — just guarantee the IDQ transition is on the end.
export function ensureIdqHandoff(modelText: string): string {
  const t = modelText.trim();
  return /ready when you are/i.test(t) ? t : `${t}\n\n${IDQ_HANDOFF_TAIL}`;
}

// The AI disclosure is shown ONCE, on the start page (the gate). The live model still sometimes opens
// its first spoken turn with it — it's the final instruction in the shared system prompt — which lands
// redundantly mid-conversation (the awkward turn-2 disclosure). Strip a leading disclosure so it never
// repeats inside onboarding; the start-page disclosure remains the single, up-front one (governance met).
const DISCLOSURE_LEAD_RE = /^\s*this conversation is guided by ai\b[\s\S]*?stop at any time\.?\s*/i;
export function stripLeadingDisclosure(text: string): string {
  return text.replace(DISCLOSURE_LEAD_RE, '').replace(/^\s+/, '');
}

// Derive the stage from what's collected — keeps state coherent on the live path so a scripted
// fallback (after a transient live failure) resumes at the right question instead of restarting.
export function nextStage(c: Collected): Stage {
  if (!c.athleticPast) return 'identity';
  if (!c.identityNoun && !c.identitySkipped) return 'identity_name';
  if (!c.reclaimList || c.reclaimList.length < RECLAIM_LIST_MIN) return 'reclaim';
  // The Door BEAT is held by the fade STORY, not by a Door tag (routing may be null — Taxonomy Spec
  // §1). What an unfinished Door beat looks like is an empty/thin gap narrative, NOT a missing slug
  // (Joanne run 2: door tagged, gap was a stray goal). So we stay in 'door' until the gap reads like a
  // real "how it opened" story; a member can complete with that story and NO Door.
  if (!gapIsNarrative(c.gap, c.reclaimList ?? [])) return 'door';
  return 'complete';
}

// Completion timing for the Door beat is unreliable when left to the model alone — it raced to the
// handoff (ending abruptly), then, once gated, refused to take "yes" for an answer and kept re-asking.
// So the engine bounds it on BOTH sides, and this is safe because the handoff is now reversible
// ("keep talking"):
//   - it may NOT complete before DOOR_MIN_TURNS exchanges (the beat must breathe — explore HOW the
//     gap opened and whether more than one Door was involved);
//   - after that, it completes when the model signals it, when the member affirms the read ("it
//     does", "yes, that's right"), or at the DOOR_MAX_TURNS soft cap (so it can never run forever).
const DOOR_MIN_TURNS = 3;
const DOOR_MAX_TURNS = 6;

// IDENTITY GATE (Issue 1 — Charter blocker). The conversation must not leave the naming beat without
// either a confirmed identityNoun OR identitySkipped, or the completion contract can never be met
// (Donna: 71 turns, un-completable — the model drifted past the identity beat recording neither). After
// this many exchanges spent asking, the engine stops just re-asking and OFFERS the explicit "name it
// later" skip (found at Identity Excavation); accepting it sets identitySkipped. Mirrors the Door drive.
const IDENTITY_SKIP_OFFER_AFTER = 2;

// A short, clear affirmation of the read ("for sure", "yes, that's right") is the member's signal to
// wrap the Door beat. Kept short so "yes, and also…" (which adds a Door) isn't mistaken for closure.
const AFFIRM_RE =
  /\b(yes|yep|yeah|yup|for sure|absolutely|definitely|totally|it does|that'?s right|that'?s it|that'?s me|exactly|correct|spot on|sounds (right|about right)|accurate|you got it|nailed it|that'?s the (whole )?picture|pretty much|that'?s fair)\b/i;
export function isAffirmation(message: string): boolean {
  const m = (message ?? '').trim().replace(/[‘’]/g, "'"); // normalize curly apostrophes
  return AFFIRM_RE.test(m) && m.split(/\s+/).length <= 6;
}

// The Door beat is "engaged" only once the gap story or a Door is actually on the table — NOT merely
// because the Reclaim List filled (nextStage flips to 'door' then, but the model may still be drawing
// out Reclaim items). Counting from real Door material is what keeps the beat from wrapping on the
// member's very first gap answer.
export function doorEngaged(prev: Collected, next: Collected): boolean {
  const has = (c: Collected) => !!c.gap || (c.doors?.length ?? 0) >= 1;
  return has(prev) || has(next);
}

// Infer Door(s) from the GAP NARRATIVE the member actually told us — catching doors the model
// discussed but forgot to record (incl. the FIRST door, which is why Donna got re-asked the gap
// question forever: her rich gap named her doors, but none were captured). This is safe against the
// old fabrication bug because the caller passes ONLY the gap (never the Reclaim List or scattered
// text), and the gap is never backfilled from a stray message — so a skipped Door beat means an empty
// gap → matchDoors('') → [] → nothing invented. A door drawn from the fade story is reading their
// account, not fabricating one.
export function augmentDoors(recorded: DoorSlug[], gap: string): DoorSlug[] {
  const merged = Array.from(new Set<DoorSlug>([...recorded, ...matchDoors(gap ?? '')]));
  // Apply the Door disambiguation (Full House vs Empty Nest / Aging Parents; idempotent) so the staged engine
  // gets the same accuracy v1 does — the model occasionally tags contradictory siblings (Jay's walk: full_house
  // AND empty_nest for kids-still-home). correctDoors is a no-op when there's nothing to reconcile.
  return correctDoors(merged, gap ?? '');
}

// Live-path backstop for a model that CONVERSES without recording: should the engine capture the
// member's own message as the gap? True only AT the Door beat (nextStage 'door' — identity + Reclaim
// List done, no narrative gap yet, so the question on the table IS "how did the gap open?") and only
// when their message reads as a real fade narrative. Pure + testable. Safe against the old fabrication
// bug: it never fires off-beat and gapIsNarrative rejects a reclaim item or a bare goal line — so it
// reads the member's account, it doesn't invent one. (Donna told her whole story; the model reflected
// it but never wrote `gap`, so the engine looped on the opening question — this closes that hole.)
const GAP_CAPTURE_MIN_CHARS = 80; // a genuine fade-opening answer is a sentence or two, not a one-liner
export function shouldCaptureGapFromMessage(collected: Collected, message: string): boolean {
  const m = (message ?? '').trim();
  if (nextStage(collected) !== 'door') return false; // only the Door beat — never mid-Reclaim
  // A close/affirm/dispute/advance message is NOT the story (a protest like "it seems like you're hung
  // up" or "move me on" must never become the gap). And a real "how it opened" answer is substantial —
  // gapIsNarrative alone is too lenient (it passes any 20+ char line), so require real heft too.
  if (memberWantsToWrap(m) || isAffirmation(m) || isDoorDispute(m)) return false;
  if (m.length < GAP_CAPTURE_MIN_CHARS) return false;
  return gapIsNarrative(m, collected.reclaimList ?? []);
}

// The member pushing back on the Door read ("that's not it", "what do you mean", "those don't fit").
// A dispute must REOPEN the beat — never wrap, never replay the same label.
const DISPUTE_RE =
  /\b(what do you mean|that'?s not (it|right|quite)|that wasn'?t (it|the)|doesn'?t (seem|sound|fit|feel)|don'?t (seem|think|see|fit)|i (wouldn'?t|don'?t) (say|call|think)|not (really )?(it|right|the problem|what)|disagree|off( |-)base|that'?s wrong|no,? that|isn'?t (it|right))\b/i;
export function isDoorDispute(message: string): boolean {
  return DISPUTE_RE.test((message ?? '').replace(/[‘’]/g, "'"));
}

// The member clearly ending the Door beat ("I'm done", "that's it", "nothing else", "let's move on") OR
// explicitly asking to advance ("move me through to the IDQ", "what's next", "let's proceed"). Both are
// the member's call — they OVERRIDE the explore-minimum (which only exists to stop the model racing,
// never to trap a member who wants to move). Independence Guarantee: stop, or move on, anytime.
// NOTE (capture-quality discipline): this is the close-detection shape we've now extended a few times
// (AFFIRM_RE "it does", WHOLE_RE "the biggest ones", and here). It's bounded — "the member is done OR
// asking to proceed" — but if a FOURTH distinct phrasing slips through, consolidate the three detectors
// into one "member is closing/advancing" signal rather than widening regexes again.
const WRAP_RE =
  /\b(i'?m done|i am done|that'?s it|that is it|that'?s all|that is all|nothing (else|more)|no more|that'?s the whole|ready to move on|let'?s move on|move (on|forward|ahead)|move me (on|forward|ahead|through|to|along)|take me (to|through)|to the idq|what'?s next|what is next|let'?s (go|proceed|continue)|i'?m ready|can (we|you) (move|proceed|continue|go)|proceed|keep going|next step|enough for now|i'?m good|i think i'?m good|wrap (it )?up|go to bed|that'?s enough)\b/i;
export function memberWantsToWrap(message: string): boolean {
  return WRAP_RE.test((message ?? '').replace(/[‘’]/g, "'"));
}

// Answering "is that the whole of it?" with "those are the main/biggest ones" — a soft close the
// narrow affirmation set missed, so the engine re-asked the same question verbatim (Scott:
// "Those are the biggest contributors"). Treat it as the member closing the Door beat (only matters
// once the contract is met — it can never complete a half-finished intake).
const WHOLE_RE =
  /\b(those are (the )?(biggest|main|primary|major|ones|two|three)|that'?s (the )?(whole|main|biggest|it|everything|gist)|the whole of it|that covers it|that'?s (the )?(full )?picture|(biggest|main|primary|major) (one|ones|contributor|contributors|factor|factors|thing|things))\b/i;
export function confirmsWhole(message: string): boolean {
  return WHOLE_RE.test((message ?? '').replace(/[‘’]/g, "'"));
}

// The member signaling the fade story ISN'T finished ("there's more", "it wasn't just the layoff",
// "there's also…"). The opposite of a close — it must HOLD the Door beat open and never complete, the
// mirror of a dispute. (Rita, live eval: she said "there's more to how I got here, it wasn't just the
// layoff" and the engine handed off anyway, dropping the Doors she was about to name.) Per the bar:
// never assume past what they said.
const SIGNALS_MORE_RE =
  /\b(there'?s more|there is more|it wasn'?t just|it wasn'?t only|not just the|not only the|there'?s also|there was also|more to (it|the|how|that|this)|i haven'?t (told|said|gotten)|one more thing|that'?s not all|there'?s another|another (door|thing|part|piece|layer)|still more|isn'?t the whole|wasn'?t the whole)\b/i;
export function memberSignalsMore(message: string): boolean {
  return SIGNALS_MORE_RE.test((message ?? '').replace(/[‘’]/g, "'"));
}

// --- Leg 3 reconciliation: catch a Door the member RAISED but the model didn't record -----------------
// The model writes a lossy summary of the fade story and sometimes drops a Door the member clearly named
// (Donna raised caring for her aging parents during onboarding; it never made the gap summary, so no
// aging_parents Door — she only got it later by re-raising it). Before the Door beat closes, the engine
// scans the member's OWN words for Door signals it hasn't recorded and asks ONE warm confirm, reflecting
// their words back (the MI move, not a bare label). ASK, never auto-add: a false match is a question they
// decline, not a wrong Door — which is exactly what makes scanning the member's full account safe here,
// where auto-tagging it would over-tag (see the gap-only inference note in applyModelTurn).
const DOOR_CONFIRM_RE =
  /\b(yes|yeah|yep|yup|for sure|absolutely|definitely|totally|it is|that'?s right|sort of|kind of|i guess|true|exactly|correct|sure|a door|its own door|part of (it|how|the))\b/i;
const DOOR_DECLINE_RE =
  /\b(no|nope|not (really|a door|it|sure)|just (background|context|part of|something)|background|separate|unrelated|don'?t (think|know)|unsure|maybe not)\b/i;
// Did the member affirm the Door we asked about? An explicit decline always wins; otherwise an explicit
// yes OR a substantive engagement with what THEY raised reads as confirming (governed: a Door is only
// recorded on affirmation — we never assert one).
export function memberConfirmsDoor(message: string): boolean {
  const m = (message ?? '').trim().replace(/[‘’]/g, "'");
  if (!m) return false;
  if (DOOR_DECLINE_RE.test(m)) return false;
  return DOOR_CONFIRM_RE.test(m) || m.split(/\s+/).length >= 6;
}

// Door signals present in the member's OWN messages but not yet recorded (or already set aside). Returns
// the candidate slug AND the member's phrase that surfaced it, so the confirm can reflect their words.
export function uncapturedDoorSignals(
  memberMessages: string[],
  captured: DoorSlug[],
  declined: DoorSlug[] = [],
): Array<{ slug: DoorSlug; phrase: string }> {
  const have = new Set<string>([...captured, ...declined]);
  const seen = new Set<string>();
  const out: Array<{ slug: DoorSlug; phrase: string }> = [];
  for (const msg of memberMessages) {
    const sentences = msg.split(/(?<=[.!?])\s+/);
    for (const slug of matchDoors(msg)) {
      if (have.has(slug) || seen.has(slug)) continue;
      seen.add(slug);
      // reflect the SPECIFIC sentence that carries this Door, so the confirm quotes their actual words
      // about it (not an unrelated clause from the same message).
      const sentence = sentences.find((s) => matchDoors(s).includes(slug)) ?? msg;
      out.push({ slug, phrase: sentence.trim() });
    }
  }
  return out;
}

function doorSnippet(phrase: string): string {
  const s = phrase.trim().replace(/\s+/g, ' ');
  if (s.length <= 160) return s;
  const first = s.split(/(?<=[.!?])\s/)[0] ?? s;
  return first.length <= 200 ? first : `${s.slice(0, 157)}…`;
}
function doorConfirmPrompt(slug: DoorSlug, phrase: string): string {
  const door = DOORS.find((d) => d.slug === slug)!;
  const snippet = doorSnippet(phrase).replace(/[.!?,;:\s]+$/, ''); // trim trailing punctuation for clean quoting
  const meaning = door.descriptor.replace(/\.\s*$/, ''); // drop the descriptor's trailing period
  return `Before we move on — you also mentioned: “${snippet}.” That can be its own Door — ${meaning}. Is that part of how the gap opened too, or more the background?`;
}

// At the naming step, a member may genuinely not know yet — honor it, don't force a label.
const DECLINE_IDENTITY_RE =
  /\b(not sure|don'?t know|dunno|no idea|no clue|unsure|can'?t say|hard to say|not yet|don'?t have (one|a word)|skip|pass|i don'?t)\b/i;

// IDENTITY GATE decision (Issue 1), extracted pure so it unit-tests without the live model. Given the
// state coming IN (prev) and the member's message, decide: are we at the naming beat, how many turns
// have been spent there, should the identity be marked skipped THIS turn (an explicit decline, or a
// bare affirmation accepting a skip the engine already offered), and should the engine now OFFER the
// explicit "name it later" skip. The caller (liveTurn) still only applies setSkipped when the model
// itself left identity unset — so a model that DID capture a name this turn always wins.
export function resolveIdentityGate(
  prev: Collected,
  message: string,
  identityTurnsBefore = 0,
): { atNamingBeat: boolean; identityTurns: number; setSkipped: boolean; offerSkip: boolean } {
  const atNamingBeat = !!prev.athleticPast && !prev.identityNoun && !prev.identitySkipped;
  const identityTurns = (identityTurnsBefore ?? 0) + (atNamingBeat ? 1 : 0);
  if (!atNamingBeat) return { atNamingBeat, identityTurns, setSkipped: false, offerSkip: false };
  const m = (message ?? '').trim().replace(/[‘’]/g, "'");
  const declined = DECLINE_IDENTITY_RE.test(m);
  const acceptedSkipOffer = identityTurns > IDENTITY_SKIP_OFFER_AFTER && isAffirmation(message);
  return {
    atNamingBeat,
    identityTurns,
    setSkipped: declined || acceptedSkipOffer,
    offerSkip: identityTurns >= IDENTITY_SKIP_OFFER_AFTER,
  };
}

export function resolveCompletion(
  collected: Collected,
  wantsComplete: boolean,
  doorTurns = 0,
  memberAffirmed = false,
  blocked = false, // a Door dispute this turn — never wrap; reopen the beat instead
  memberDone = false, // the member explicitly ended the beat — honor it, even below the explore-minimum
): { complete: boolean; stage: Stage; exploringDoor: boolean } {
  // The full contract — incl. a real gap NARRATIVE, not just a Door slug (see onboarding-contract.ts).
  // This is what makes "complete" honest: the agent cannot hand off without the fade story.
  const reqsMet = contractMet(collected);
  // The explore-floor (DOOR_MIN_TURNS) exists to stop the MODEL racing to "done" on a member's first
  // gap sentence and to give the beat room to widen ("did more than one Door pile on?"). But a member
  // who FRONT-LOADS a rich, multi-Door fade in one pass (Donna gave finances + marriage + parents + the
  // buried self in a single message) has already done both — forcing two more "what else piled on?"
  // turns just traps someone who's ready, even as the model says "I have everything, let me close."
  // So the floor is also satisfied when the captured story is already substantial: 2+ Doors on the
  // table (the widen question is moot) OR a long narrative gap. Completion STILL needs a close signal
  // below (the model's complete, a member affirmation, or the member asking to move on) — this only
  // removes the turn-count trap, never the need for a signal; a thin single-Door gap still breathes.
  const gap = collected.gap ?? '';
  const storyIsRich =
    gapIsNarrative(gap, collected.reclaimList ?? []) &&
    ((collected.doors?.length ?? 0) >= 2 || gap.length >= 240);
  const exploredEnough = doorTurns >= DOOR_MIN_TURNS || storyIsRich;
  const mustWrap = doorTurns >= DOOR_MAX_TURNS;
  // The member saying they're done wraps it even before the explore-minimum — the floor exists to stop
  // the MODEL racing, not to override the MEMBER. Otherwise it's: explored enough + a signal to close.
  // (memberDone still cannot complete an unmet contract — `reqsMet` gates it either way.)
  const complete = !blocked && reqsMet && (memberDone || (exploredEnough && (wantsComplete || memberAffirmed || mustWrap)));
  // Hold in the Door beat whenever the fade STORY or a Door is on the table but we're not done — so the
  // engine keeps the conversation there (drawing out the gap story, widening to other Doors) instead of
  // stranding. Keyed on the gap too (not just a Door tag) so a NULL-routing member — a real Fade whose
  // story maps to no Door (Taxonomy Spec §1) — is still held in the beat to develop the story, never
  // pushed to name a Door they wouldn't claim.
  const exploringDoor = !complete && (!!collected.gap || (collected.doors?.length ?? 0) >= 1);
  const stage: Stage = complete ? 'complete' : exploringDoor ? 'door' : nextStage(collected);
  return { complete, stage, exploringDoor };
}

// A safety-net question per stage — used if a live turn comes back with no text (tool-only),
// so the member never sees a blank reply that looks like the agent stalled.
const STAGE_PROMPT: Record<Stage, string> = {
  identity: 'Who were you, back when you felt most like yourself?',
  identity_name: 'If you put that person in a single word — the Runner, the Writer, the Builder — what is the word?',
  reclaim: `What are a few things you want back? Three to start, more if they keep coming.`,
  door: doorPrompt(),
  gap: doorPrompt(), // v1 never sets 'gap' (that's the v2.0 staged engine) — present only for type completeness
  complete: "That's everything we need. Let's look at where you're starting from next.",
  declined: 'This may not be your season for it — and the door stays open whenever that changes.', // terminal; never appended
  // v2.2 Reconnect stages are present only for type completeness — v1 never routes here, and the Reconnect
  // engine (lib/agent/reconnect.ts) supplies its own openers. A neutral fallback keeps the safety net honest.
  entry: 'Where would you like to pick things up?',
  doors: 'What feels like it opened the distance — take me into it.',
  measurement: 'Ready to take a clear read of where things stand?',
  visioning: 'What do you want to be true again?',
  drift: 'What did the Fade cost you — and how far are you from that version of you?',
  legacy: "Picture the version of you that's still in there, reclaimed — what would you want them to know?",
  checkpoint: 'How are you doing with the work right now?',
  ceremony: "Let's look at how far you've come.",
};

// Guarantee a non-final turn ends with a forward question, so the member is never stranded.
// Live models sometimes end on a bare reflection ("That stays with you.") with no next step —
// when that happens we append the question for wherever the conversation now is.
export function withForwardPrompt(reply: string, stage: Stage): string {
  const r = reply.trim();
  if (!r) return STAGE_PROMPT[stage];
  return /\?/.test(r) ? r : `${r}\n\n${STAGE_PROMPT[stage]}`;
}

// --- Public engine ----------------------------------------------------------------------
export async function onboardingNextTurn(args: {
  ctx: Ctx;
  state: ConvState;
  history: ConvMessage[];
  memberMessage: string | null;
}): Promise<Turn> {
  // v2.0 staged-capture engine — selected by ONBOARDING_ENGINE=staged (off by default; v1 serves prod until
  // cut-over). Dynamically imported so onboarding-staged.ts can statically import this module without a cycle.
  const staged = process.env.ONBOARDING_ENGINE === 'staged';

  // Opening turn: the AI disclosure (verbatim) + the first question, always engine-owned.
  if (args.memberMessage === null) {
    if (staged) return (await import('./onboarding-staged.ts')).stagedOpening();
    return { reply: OPENING_REPLY, state: INITIAL_STATE, complete: false };
  }
  // Governance first, every member turn.
  if (detectCrisis(args.memberMessage).flagged) {
    return { reply: CRISIS_RESPONSE_US, state: args.state, complete: false, crisis: true };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    // LIVE mode. If a live turn fails (e.g. a transient API timeout mid-conversation) we must NOT
    // silently fall back to scriptedTurn: the scripted path is a separate, simpler state machine
    // that can't read the live context and just re-asks its stage prompt — which stranded the Door
    // beat in a "won't take yes for an answer" loop. Surface the failure instead; the client rolls
    // back and lets the member resend, state preserved, and the next attempt hits the live engine.
    if (staged) {
      const s = await import('./onboarding-staged.ts');
      try {
        return await s.liveTurnStaged(args.ctx, args.history, args.state, args.memberMessage);
      } catch (e) {
        console.warn('onboarding(staged): live turn failed —', (e as Error).message);
        throw e;
      }
    }
    try {
      return await liveTurn(args.ctx, args.history, args.state, args.memberMessage);
    } catch (e) {
      console.warn('onboarding: live turn failed —', (e as Error).message);
      throw e;
    }
  }
  // No API key (offline / tests): the deterministic scripted engine.
  return scriptedTurn(args.state, args.memberMessage);
}

/** Build the OnboardingFields to persist (via flow.runOnboarding) once the conversation completes. */
export function collectedToFields(ctx: Ctx, c: Collected) {
  return {
    displayName: ctx.name,
    email: ctx.email,
    doors: c.doors ?? [],
    identityNoun: c.identityNoun ?? '',
    identitySkipped: c.identitySkipped ?? false,
    athleticPast: c.athleticPast ?? '',
    gap: c.gap ?? '',
    reclaimList: c.reclaimList ?? [],
    reclaimCategories: c.reclaimCategories ?? [],
  };
}

// --- Scripted (deterministic) -----------------------------------------------------------
export function scriptedTurn(state: ConvState, message: string): Turn {
  const collected: Collected = { ...state.collected };
  const done = (stage: Stage, reply: string, complete = false): Turn => ({
    reply,
    state: { stage, collected },
    complete,
  });

  switch (state.stage) {
    case 'identity':
      collected.athleticPast = message.trim();
      return done(
        'identity_name',
        'That stays with you — I can hear it.\n\nIf you had to put that person in a single word — a handle to hold onto, not a label set in stone — what would it be? Something like the Runner, the Builder, the Friend, or a word of your own.',
      );
    case 'identity_name': {
      // Honor "I'm not sure yet" — never force a name. They'll find it at Identity Excavation.
      if (DECLINE_IDENTITY_RE.test(message.trim().replace(/[‘’]/g, "'"))) {
        collected.identitySkipped = true;
        return done(
          'reclaim',
          `That's an honest answer — and totally fine. You don't have to name it today; we'll find it together as you go.\n\nLet's talk about what you want back.\n\n${reclaimPrompt()}`,
        );
      }
      // The member names it themselves (governance: identity is never assigned without confirmation).
      const cleaned = cleanIdentityNoun(message);
      const word = (cleaned.split(/\s+/)[0] ?? '').replace(/[^A-Za-z-]/g, '');
      const noun = displayIdentityNoun(word);
      collected.identityNoun = noun;
      return done(
        'reclaim',
        `Locked. ${capFirst(identityLabel(noun))} is the version of you that feels most like yourself. Now let's talk about what you want back from them.\n\n${reclaimPrompt()}`,
      );
    }
    case 'reclaim': {
      const items = message.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      if (items.length < RECLAIM_LIST_MIN) {
        return done(
          'reclaim',
          `Three is enough to start — you've given me ${items.length}. What else comes to mind?`,
        );
      }
      collected.reclaimList = items;
      return done(
        'door',
        `That's a real list — practical, personal, honest. It's yours now; it'll be right there on your dashboard, and we'll knock them down one at a time.\n\n${doorPrompt()}`,
      );
    }
    case 'door': {
      const doors = matchDoors(message);
      if (doors.length === 0) {
        return done(
          'door',
          `Take your time — tell me in your own words what changed, and roughly when you first noticed it.`,
        );
      }
      collected.gap = message.trim();
      collected.doors = doors;
      return done(
        'complete',
        `Yeah. That's a door a lot of good people have walked through — and most of them never had a name for it. Now you do.\n\n${handoff(doors, collected.identityNoun)}`,
        true,
      );
    }
    default:
      return done('complete', '', true);
  }
}

// --- Live (Claude tool-use) -------------------------------------------------------------
const ONBOARDING_SYSTEM = `${MEMBER_AGENT_SYSTEM_PROMPT}

OPERATING MOMENT: Onboarding (voice rewrite v1).
Conduct the intake as a warm, member-paced conversation. Capture exactly three records, in this order:

1) RECLAIMED IDENTITY. Open with the question about who they were when they felt most themselves (a past self of ANY kind — runner, writer, musician, builder, teacher, parent, the friend who always called — never assume it is athletic). Listen. NARROW GRADUALLY — never jump from the opening question straight to "give me one word." First reflect a specific detail of THEIR OWN words back, THEN — drawn from their own language — offer a couple of candidate words and invite them to choose one or coin their own, framing it as a HANDLE to hold onto (changeable later), not a verdict: e.g. "From what you said I'd reach for the Runner, maybe the Builder — does either fit, or is there a truer word? It's just a handle; we can change it." Confirm the word with them before moving on. NEVER all-caps the noun ("the Athlete", never "THE ATHLETE"). Record identityNoun as the bare noun in natural case, without a leading "the/a/an".
NOT SURE IS OK. If they genuinely don't know yet, or aren't ready to put a single word to it, do NOT push — reassure them warmly that they don't have to name it today and they'll find it through the work (Identity Excavation comes soon). In that case call record_progress with identitySkipped=true and leave identityNoun empty, then move on to the Reclaim List. Never assign or pressure a name.

2) RECLAIM LIST. Ask what having that self back looks like on an ordinary day — concrete, specific things they want back. Gather at least ${RECLAIM_LIST_MIN}; there is NO maximum. Gently keep drawing more out toward about ${RECLAIM_LIST_TARGET}, but never force a count or make it feel like a quota.
THE BAR (important): every item you record MUST be specific and observable — something you could BOTH witness happening in an ordinary week. Catch two failure modes, warmly and without a worksheet:
(a) A feeling or inner state on its own — "feel better about myself", "be happier", "more confident", "less stressed" — is fog and cannot be measured. Ask "what would that look like in an ordinary week?" and sharpen until observable ("feel better about myself" → "recognize the person in the mirror"; "be healthier" → "walk 30 minutes most mornings").
(b) A real action with a vague or mission-scale tail — "train hard enough to build the movement", "ride to get away from it all", "eat right" — where the action is good but the aim isn't witnessable. Don't accept the abstract finish line; press ONCE MORE to anchor it to something countable or concrete ("how many hard training days a week would that be?", "what does 'eat right' look like on a normal day?"). This is the easy one to let slide — don't.
The strongest items name a number, a frequency, or a named event ("down to 190", "ride with a group weekly", "race-ready for Big Sugar"). Only record an item once it clears the bar — but keep it a warm conversation, one gentle press at a time, never an interrogation.
For EACH item, also assign a category — the area it belongs to: physical (body/movement/food/sleep), self (identity/who they are), social (people/relationships), outlook (purpose/future/mindset), or life (any goal that doesn't map to those — money, a venture, savings, a milestone like "raise $250k"). The Reclaim List holds ANY goal that matters to them, not just identity work; don't force a money/venture goal into a dimension — that's what life is for. Record the items in reclaimList and their categories in reclaimCategories, same order. (Category is internal — never name it to the member.)

3) THE DOOR(S) — EXPLORE, never list. This is the most important and most vulnerable beat. Open it with a real question about how the gap opened ("Something opened this gap, and it's rarely all at once — what happened? When did you first feel the drift?"). Then have a CONVERSATION, not a form: follow up to understand HOW it unfolded — the sequence, when they first noticed, what it quietly cost them — reflecting their own words back. Your job is to understand how it happened, not just that it did. Stay with their story for two or three exchanges; don't rush to wrap it.
THE GAP IS USUALLY MORE THAN ONE DOOR. The Fade rarely opens through a single event — the body starts saying no AND the career plateaus; the nest empties AND a parent gets sick. Once you understand the FIRST door, explicitly check whether others stacked onto it ("Was that the whole of it, or did something else pile on around the same time?"). Capture every door that genuinely applies, not just the first one named. Ask this once — don't interrogate; if they say it was just the one, accept that and move on.
NOT EVERYONE HAS A CLASSIC FADE — and you must not force one. Some members are thriving and want MORE: to optimize, expand, chase peak experiences, not recover from a loss. If they tell you they haven't drifted ("I just want more", "no pressing issues"), DO NOT push a drift narrative or keep asking how the gap opened. Acknowledge it plainly, capture the Door that best fits the pull they DO name (often the Body / the closing window of time, or the nearest one), confirm it lightly, and move to the handoff.
HONOR "DONE." The moment a member signals they're finished — "that's it", "I'm done", "let's move on", "that's enough", "I want to go to bed" — WRAP immediately: reflect what you have and hand off. Do NOT ask another question. Their call to stop always overrides your urge to explore one more turn.
Do NOT recite a menu of Doors or ask them to pick one — listing options stops the conversation cold. The Doors below are YOUR private map for tagging, never shown to the member. Map their story silently to one OR MORE of them, and record their account in gap and the mapped slug(s) in doors.
HOW TO SURFACE A DOOR — context first, the NAME last (never open with the bare label; it's cryptic and unearned). When you recognize which Door fits, reveal it in three beats, not one:
(1) CONTEXT — reflect what they described back in plain words, using the Door's one-line meaning (given in the map below) as your language, NOT its title. e.g. "the house getting quiet after the kids moved out", "your body starting to say no to what it used to do easily", "the role reversal where you became the one doing the caring." They should feel seen by the description.
(2) METAPHOR — then offer the frame lightly: a single life event like that is what we call a Door — the moment the Fade quietly opened.
(3) NAME — only THEN give it its name, and offer it for them to accept or adjust: "some people call that one The Empty Nest — does that fit, or is it not quite that?" Let them take it, refine it, or wave it off.
Never collapse these into "That's The Empty Nest." The name is the last beat, after the description and the metaphor have landed.
MAP WHAT THEY ACTUALLY SAID — NOT A PROJECTED LIFE STAGE. Tag the event they describe, in the timeframe they describe it. Do NOT project forward: someone describing getting married or having young kids is NOT "the Empty Nest" or "the Aging Parents" (those are later-life stages) — if anything it's the responsibility of a new family crowding out the self. If their story does not clearly fit any of the Doors below, do NOT force one: reflect their OWN words, keep exploring, and name a Door only as tentative recognition they would themselves agree with. A Door the member wouldn't recognize is worse than none yet — never assert one as a verdict. Routing can be left open — it is better to record the gap in their OWN words with NO Door than to staple on one they wouldn't claim.
A DOOR DRAWN FROM THE RECLAIM LIST MUST BE CONFIRMED — NEVER TACKED ON. The Door(s) come from how the gap OPENED (the fade story), not from what the member wants back. But sometimes a CLUSTER of Reclaim-List items points at a life area that may itself be a Door — e.g. several items about the body and fitness (back in shape, the gym, physical activity) can suggest The Body; several about people can suggest a relational Door. If you sense one this way, do NOT silently record it. Raise it as a question and let the member decide, e.g.: "I'm hearing several things about your body — getting back in shape, the gym, physical activity. Sometimes that's its own Door — the body itself drifting. Would you call it that, or is it just part of what you want back?" Record that Door ONLY if they affirm it. A Reclaim-List theme is what they want BACK; it is not automatically a Door (how the gap opened). When unsure whether something is a Door, ask — never assume.
IF THEY PUSH BACK on a Door you named ("that's not it", "what do you mean", "those don't seem right"), treat it as a correction, not a detour: set the label aside immediately, say plainly you may have misread, ask them to tell you more about what actually changed, and RE-MAP from their answer. NEVER repeat a Door label the member has just questioned.
[internal Door map — do not list to the member]
${DOORS.map((d) => `- ${d.slug}: ${d.displayName} — ${d.descriptor}`).join('\n')}
DISAMBIGUATE the three family Doors — they are NOT interchangeable, and confusing them is the most common mistake:
- aging_parents is caring for your OWN AGING PARENTS. A spouse's needs, a partner's struggles, or young kids are NOT this.
- empty_nest is kids who GREW UP and MOVED OUT, leaving the house quiet. Getting married, HAVING kids, or RAISING young kids is the OPPOSITE of this — never tag empty_nest for it.
- full_house is the years a household FILLS UP: marriage, young or dependent kids, a partner who needs carrying, becoming the one everyone leans on, until there's no room left for yourself. THIS is the Door for "I got married, then we had kids, and the responsibility took over." When someone describes marrying and raising a family and losing themselves in it, it is full_house — never empty_nest or aging_parents.

DISAMBIGUATE the two load Doors (grind, load_bearer) — these are the self crowded out by accumulated load, and they collide easily with the work and family Doors. The line is SOURCE and DIRECTION:
- grind (The Grind) vs career_cliff (The Career Cliff) is DIRECTION. Career Cliff = the role ENDED or shrank (subtraction: laid off, retired, plateaued, hollowed out, a freefall). The Grind = the role or ambition GREW OVER them (addition: took over, consumed, crazy hours, bigger job, no room left). Overwork that THEN ended → route by the loss they feel more sharply; let their words decide.
- load_bearer (The Load-Bearer) is the catch-all for load from ANY OTHER source: a partner's abdicated share, the household, the money, diffuse responsibility that fell on them — load carried largely alone, OUTSIDE parent-care or the active-family season. It ranks LAST among the load Doors: the specific load Door wins, Load-Bearer catches what they don't.
  - load_bearer vs aging_parents / full_house is SOURCE and SEASON. Parent caretaking → aging_parents. Active-family-season load (kids in the house) → full_house. Other or diffuse load, or load that persists outside that season → load_bearer. Never tag load_bearer alongside aging_parents or full_house for the SAME load — pick the specific one.
  - load_bearer vs marriage is the OBJECT of the Fade. Marriage = the relational distance from the partner (drift into coexisting; they grieve the DISTANCE). Load-Bearer = being buried by the weight — even when a partner stepping back caused it, the Fade is the LOAD, not the relational drift (they grieve the WEIGHT). e.g. "he semi-retired and I carried the financial weight for a decade" is load_bearer, not marriage.

CLOSE WITH A SUMMARY, NOT A LIST. Once you understand how the gap opened and have checked whether more than one Door stacked on (about three or four exchanges — don't keep asking past that), close the beat in ONE warm turn, and call record_progress with complete=true on that turn. Include ALL of these, in this order:
(1) SUMMARY — reflect their WHOLE story back in two or three sentences, in their own words: what actually opened the gap and what it quietly cost them.
(2) THE METAPHOR, THEN NAME EVERY DOOR — the first time you name a Door, explain the idea: a single life event like that is what we call a "Door" — the moment the Fade quietly opened. THEN name EVERY Door you are recording for them — if you record three, you name three; never name only some. Each gets its plain meaning AND its title, woven into their story, e.g. "that's a Door — and yours is the stretch where the house filled up: marriage, young kids, everyone leaning on you, no room left for you. We'd call that one The Full House. And alongside it, the work that took everything you had — that's its own Door, The Career Cliff." This is not a formality: naming each Door back is how the member knows you actually heard them — every Door you record but don't say is a piece of their story you left on the floor. The spoken summary and the Doors you record MUST match exactly. Don't drop a title without the plain meaning and the metaphor first.
(3) THE RECLAIM LIST, CONCRETELY — bring their actual list in: name two or three of their real items back ("the craft, getting your body back, saying yes to the trip") and tell them that list is what reclaiming looks like in real life, waiting on their dashboard. Don't just say "your Reclaim List" abstractly — show them it's captured.
(4) THE IDENTITY — confirm the reclaimed identity is who you're bringing back.
(5) THE HANDOFF — a set of questions to see how far the gap runs comes next, no studying, no score — end with "Ready when you are."
NEVER close on a bare label: the member should feel their whole story reflected, understand what a Door even is, and see their own Reclaim List named back before the conversation moves on.

AI DISCLOSURE — ALREADY SHOWN, DO NOT REPEAT. The member saw the AI disclosure on the start page before this conversation began. Never begin a turn with "This conversation is guided by AI" or otherwise restate that you are AI / that they can stop — that is handled. Open straight into your reflection and question. (This overrides the disclosure note in the base instructions above, which applies to other moments, not onboarding.)
VOICE: no meta-narration about the program's own mechanics; gender-inclusive; warm, direct, short sentences. Let the Fade carry the weight, not statistics.
TURN-TAKING (important): reflect first, then ALWAYS end your turn with exactly ONE clear question or prompt that tells the member what to do next. Never end on a bare statement or reflection — that strands the member, unsure whether it is their turn. The ONLY turn without a question is the final IDQ handoff, which closes with "Ready when you are."
ALWAYS write a spoken message to the member on EVERY turn — never respond with only a tool call and no text (a tool-only turn makes the app repeat the last prompt, which feels broken). And NEVER re-ask a question the member has already answered or repeat a prompt you've already sent — if you have their answer, acknowledge it and move forward. Once you understand how the gap opened, record it and move to the handoff; do not keep circling the same question.

RECOGNITION OVER ROUTING (important): the thing you MUST capture is the member's fade story IN THEIR OWN WORDS — that is what makes them feel seen. The Door is just a best-fit category tag behind their words, and it is OPTIONAL. When a Door fits confidently, name it. When none fits, lead with their own words and a soft descriptor and record NO Door — never force a label onto a real Fade, and never show "Other." A real Fade with a clear story and no Door is a COMPLETE, valid intake.

On EVERY turn you MUST also call the record_progress tool with everything gathered so far. Set complete=true only once ALL of these are gathered: athleticPast, EITHER a confirmed natural-case identityNoun OR identitySkipped=true (they chose not to name one yet), a reclaimList of at least ${RECLAIM_LIST_MIN}, and a real gap story (HOW the fade opened, in their words) — AND you have genuinely explored HOW it opened (not just labeled it) AND checked whether more than one Door was involved. A Door tag is NOT required to complete — the gap story is. Do not complete on the first mention of what happened; understand the story, and whether there was more than one Door, first. CLOSING THE BEAT: once you have reflected the full picture of how the gap opened and the member confirms it is accurate ("it does", "yes, that's right"), you are DONE — call record_progress with complete=true and hand off on that same turn. Do NOT ask another question, and NEVER re-ask what changed or when they first noticed it once they have already told you. Their confirmation is the signal to wrap; honor it. On that closing turn, any Doors you name in your spoken summary MUST be exactly the Doors you record — name every one, in plain meaning and title; if you recorded no Door, reflect their own words instead of reaching for a label. A recorded Door you don't say back is a part of their story you failed to reflect.`;

const RECORD_PROGRESS_TOOL = {
  name: 'record_progress',
  description: 'Record the structured intake gathered so far. Call on every turn.',
  input_schema: {
    type: 'object' as const,
    properties: {
      athleticPast: { type: 'string', description: "the member's past self, in their own words" },
      identityNoun: { type: 'string', description: 'confirmed identity noun, natural case (e.g. "Athlete")' },
      identitySkipped: { type: 'boolean', description: 'true if the member chose not to name an identity yet (they will find it at Identity Excavation)' },
      reclaimList: { type: 'array', items: { type: 'string' }, description: 'specific, observable items the member wants back' },
      reclaimCategories: {
        type: 'array',
        items: { type: 'string', enum: ['physical', 'self', 'social', 'outlook', 'life'] },
        description: 'category for each reclaimList item, in the same order',
      },
      gap: { type: 'string', description: 'how the gap opened, in the member’s words' },
      doors: { type: 'array', items: { type: 'string', enum: [...DOOR_SLUGS] }, description: 'one or more Door slugs' },
      complete: { type: 'boolean' },
    },
    required: ['complete'],
  },
};

// A single model turn, decoupled from the live API so the engine can be replayed deterministically from
// recorded transcripts (tests/onboarding-replay.test.ts). `record` is the record_progress input the model
// emitted that turn, or undefined when the model conversed WITHOUT recording (the Donna failure mode).
// replyIntent (v2.2 Phase 2.1): the model's read of the member's reply to a reflect-confirm — the intent layer
// goes model-SIGNALED (the model understands "nope, that's a good list" = done far better than a regex), the
// engine still DISPOSES (bounds it; the regex resolvers remain the fallback when the model doesn't signal).
export type ReplyIntent = 'done' | 'more' | 'dispute';
export type ModelTurn = { text: string; record?: Partial<Collected> & { complete?: boolean }; noFade?: boolean; gapReady?: boolean; refineReclaim?: string; replyIntent?: ReplyIntent; depthReady?: boolean; revision?: DoorRevision };

// Parse an Anthropic response into a ModelTurn (prose + the record_progress tool input, if any).
function parseModelTurn(content: readonly unknown[]): ModelTurn {
  let text = '';
  let record: (Partial<Collected> & { complete?: boolean }) | undefined;
  for (const b of content as Array<{ type: string; text?: string; name?: string; input?: unknown }>) {
    if (b.type === 'text' && typeof b.text === 'string') text += b.text;
    if (b.type === 'tool_use' && b.name === 'record_progress') record = b.input as Partial<Collected> & { complete?: boolean };
  }
  return { text, record };
}

// Thin LIVE wrapper: build the request, call the model, hand off to the PURE engine. This is the only
// non-deterministic, untestable part of a turn — every DECISION lives in applyModelTurn below.
// NOTE: the full conversation history is sent every turn, so the model already HAS its memory. An
// earlier "ALREADY CAPTURED — do NOT ask these again" injection was tried here to stop re-asking, but it
// pushed the model to race: it skipped whole beats and locked early guesses as committed truth (the
// "guess promoted to committed truth" shape). Removed. The anti-re-ask intent lives in the system
// prompt's reflect-then-ask rule instead — pacing, not a directive to stop asking.
async function liveTurn(
  _ctx: Ctx,
  history: ConvMessage[],
  state: ConvState,
  memberMessage: string,
): Promise<Turn> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // Deep-in-conversation turns carry a large context; give it room and retry transient blips.
  // accept-encoding: identity disables response gzip — sidesteps a node-fetch + gzip stream bug
  // ("Premature close") that breaks on newer Node runtimes; transport-only, no effect on capture.
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
    system: ONBOARDING_SYSTEM,
    tools: [RECORD_PROGRESS_TOOL],
    messages,
  });
  return applyModelTurn(state, history, memberMessage, parseModelTurn(res.content));
}

// THE ENGINE — pure and replayable. Given the state coming in, the conversation history, the member's
// message, and the model's turn, it merges the record, runs every decision (identity gate, gap-capture,
// door inference, completion gating, the forced-forward branches, anti-repeat) and returns the reply +
// next state. No API, no SDK — so it unit-tests and replays offline against recorded transcripts. This is
// the fix for "the live loop is the least-testable, highest-risk code": now the risk is one thin wrapper.
export function applyModelTurn(
  state: ConvState,
  history: ConvMessage[],
  memberMessage: string,
  model: ModelTurn,
): Turn {
  let collected: Collected = { ...state.collected };
  const inDoorBeat = state.doorAsked ?? false; // was the Door question already posed on a prior turn?
  let wantsComplete = false;
  let modelGap: string | undefined;
  let modelDoors: DoorSlug[] | undefined;
  if (model.record) {
    const p = model.record;
    modelGap = p.gap;
    modelDoors = Array.isArray(p.doors) ? p.doors.filter(isDoorSlug) : undefined;
    // Early-beat records (identity, Reclaim List) commit as gathered. The Door-beat records (gap, doors)
    // are held until we're actually IN the Door beat (below) — so a model that races ahead and paraphrases
    // a Reclaim item into `gap` can't satisfy the contract before the Door question is even asked (Donna).
    collected = {
      ...collected,
      ...(p.athleticPast !== undefined && { athleticPast: p.athleticPast }),
      ...(p.identityNoun !== undefined && p.identityNoun !== '' && { identityNoun: displayIdentityNoun(p.identityNoun) }),
      ...(p.identitySkipped === true && { identitySkipped: true }),
      ...(Array.isArray(p.reclaimList) && { reclaimList: p.reclaimList }),
      ...(Array.isArray((p as { reclaimCategories?: string[] }).reclaimCategories) && {
        reclaimCategories: (p as { reclaimCategories?: string[] }).reclaimCategories,
      }),
    };
    wantsComplete = Boolean(p.complete);
  }
  let reply = stripLeadingDisclosure(model.text); // disclosure lives on the start page — never repeat it here

  // IDENTITY GATE (Issue 1): a deterministic hold on the naming beat, mirroring the Door drive. Decide
  // (pure) whether we're at the naming beat, the turn count, and whether to mark identity skipped — then
  // apply the skip only if the model itself left identity unset (a model that captured a name wins).
  // This guarantees the member can always move past identity (named or skipped) — the gate Donna lacked.
  const idGate = resolveIdentityGate(state.collected, memberMessage, state.identityTurns ?? 0);
  const identityTurns = idGate.identityTurns;
  if (idGate.setSkipped && !collected.identityNoun && !collected.identitySkipped) {
    collected = { ...collected, identitySkipped: true };
  }

  // DOOR-BEAT ENTRY. "The Reclaim List reached the minimum count" is NOT "the Reclaim beat is over" — the
  // list has no max. We ENTER the Door beat only once the member is done adding (the list did NOT grow
  // this turn); on that turn the engine poses the "how did the gap open?" question. Until the beat is
  // entered, no gap is committed and the intake cannot complete — the fix for capturing a gap / handing
  // off before the Door question was ever asked (Donna). Once entered, `doorAsked` stays true (sticky via
  // state.doorAsked → inDoorBeat next turn).
  const identityCaptured = !!collected.athleticPast && (!!collected.identityNoun || !!collected.identitySkipped);
  const listAtMin = (collected.reclaimList?.length ?? 0) >= RECLAIM_LIST_MIN;
  const listGrew = (collected.reclaimList?.length ?? 0) > (state.collected.reclaimList?.length ?? 0);
  const enteringDoorBeat = !inDoorBeat && identityCaptured && listAtMin && !listGrew;
  const doorActive = inDoorBeat || enteringDoorBeat;
  const doorAsked = doorActive;
  // Where the Door beat began in the transcript — the boundary for the reconciliation scan below, so it
  // reads the member's "how the gap opened" answers (where Doors live), never their Reclaim-list answers.
  const doorBeatFromIndex = state.doorBeatFromIndex ?? (enteringDoorBeat ? history.length : undefined);

  // The model's gap/doors are trusted only once we're ALREADY in the Door beat (a prior turn asked the
  // question). On the entry turn the gap can come only from the member's OWN words (the backstop below) —
  // never the model — so a paraphrased Reclaim item can never be promoted to the fade story.
  if (inDoorBeat && modelGap !== undefined) collected = { ...collected, gap: modelGap };
  // Doors ACCUMULATE, never replace: a Door the model recognized earlier in the beat must survive a later
  // (fumbled) record. Ree's run — the model named multiple Doors out loud (Career Cliff, Load-Bearer, Aging
  // Parents), then its final record carried a different set, and a replace dropped the recognized ones.
  // A later record may ADD; a Door only LEAVES on an explicit member dispute/decline (handled below).
  // correctDoors still fixes mislabels; the confirmation card is the member's final backstop.
  if (inDoorBeat && modelDoors && modelDoors.length > 0) {
    collected = { ...collected, doors: Array.from(new Set<DoorSlug>([...(collected.doors ?? []), ...modelDoors])) };
  }

  // GAP-CAPTURE BACKSTOP: the model is the primary recorder, but it sometimes CONVERSES and reflects the
  // fade without ever persisting it via record_progress. Donna told her whole story across several turns,
  // the agent reflected it warmly — yet `gap` stayed empty, so the engine kept re-asking "how did the gap
  // open?" (and repeated it verbatim when the model went quiet). The scripted path captures the member's
  // answer as the gap; the live path must too, so the engine is never blind to a story the member has
  // plainly told. When we're AT the Door beat (`nextStage` is 'door' — identity + Reclaim List done, no
  // narrative gap yet, so the question on the table IS "how did the gap open?") and the member's own
  // message reads as a real fade narrative, record it as the gap. This is reading their account — safe
  // against the old fabrication bug: it fires ONLY at the Door beat, ONLY on a substantive narrative, and
  // never scrapes reclaim items or scattered text (gapIsNarrative rejects a reclaim item or a short goal).
  if (doorActive && shouldCaptureGapFromMessage(collected, memberMessage)) {
    collected = { ...collected, gap: memberMessage.trim() };
  }

  // SAFETY NET: the model sometimes explores the Door(s) in prose but forgets to record them in the
  // tool — which strands the beat re-asking the opening question (its stage prompt). If the core is
  // ready (identity + Reclaim List) and no Door was recorded, infer the Door(s) from what the member
  // actually said, so the engine is never blind to a Door the conversation clearly surfaced.
  const coreReady =
    !!collected.athleticPast &&
    (!!collected.identityNoun || !!collected.identitySkipped) &&
    (collected.reclaimList?.length ?? 0) >= RECLAIM_LIST_MIN;
  // AUGMENT a SECOND Door only — never FABRICATE the first Door or the gap. The model sometimes
  // verbalizes a real second Door (e.g. "caring for your 95-year-old mom is its own weight") but
  // records only the first; we catch that. But if the model recorded NO Door, the gap beat hasn't
  // genuinely happened — do NOT scrape a Door from scattered words (that mis-tagged Joanne as Empty
  // Nest from "retired/granddaughter/LA"), and NEVER backfill the gap from an arbitrary message (that
  // stuffed a reclaim answer into the fade story). With nothing fabricated, the contract holds the
  // conversation in the Door beat and the engine asks "how did the gap open?" — capturing a REAL gap.
  // Door inference reads ONLY the gap narrative — how the fade actually opened — NOT the reclaim
  // answers. Matching over the whole transcript mis-added a Door twice: Empty Nest from
  // "retired/granddaughter/LA", then The Body from "lose weight/get in shape". A reclaim goal is what
  // the member wants BACK, not a Door that opened the Fade. The gap is the only honest source.
  const fadeNarrative = collected.gap ?? '';
  if (coreReady) {
    const augmented = augmentDoors(collected.doors ?? [], fadeNarrative);
    if (augmented.length !== (collected.doors?.length ?? 0)) collected = { ...collected, doors: augmented };
  }

  // Guard the model's most common Door mix-up — a marriage/young-kids/load-bearer story is The Full
  // House, never the later-life Empty Nest or Aging Parents. Correct from the fade narrative.
  if ((collected.doors?.length ?? 0) > 0) {
    collected = { ...collected, doors: correctDoors(collected.doors!, fadeNarrative) };
  }

  // LEG 3 RECONCILIATION — resolve a Door confirmation the engine asked for last turn (reflecting the
  // member's own words). Confirm (or substantive engagement) → record it; an explicit "no / just
  // background" → set it aside and never re-ask. Governed: a Door is recorded only once the member affirms.
  let declinedDoors: DoorSlug[] = [...(state.declinedDoors ?? [])];
  let pendingDoorConfirm: DoorSlug | null = state.pendingDoorConfirm ?? null;
  if (pendingDoorConfirm) {
    const slug = pendingDoorConfirm;
    if (memberConfirmsDoor(memberMessage)) {
      if (!(collected.doors ?? []).includes(slug)) collected = { ...collected, doors: [...(collected.doors ?? []), slug] };
    } else {
      declinedDoors = [...declinedDoors, slug];
    }
    pendingDoorConfirm = null;
  }

  // Count exchanges spent in the Door beat — only once the gap/Door is actually being discussed, NOT
  // the moment the Reclaim List fills (nextStage flips to 'door' then, even while the model is still
  // drawing out Reclaim items — counting those would wrap the beat on the first real gap answer).
  const engagingDoor = doorEngaged(state.collected, collected);
  const doorTurns = (state.doorTurns ?? 0) + (engagingDoor ? 1 : 0);

  // The member disputing the Door read must REOPEN the beat: never wrap, never replay the same label —
  // let the model's reply (which reconsiders / re-maps) through instead of the canned handoff.
  // (A reply to a reconciliation confirm is about that one candidate Door — not a dispute of the read.)
  const disputed = isDoorDispute(memberMessage) && !state.pendingDoorConfirm && ((state.collected.doors?.length ?? 0) >= 1 || !!state.collected.gap);
  // The member explicitly ending the beat wraps it — even below the explore-minimum (Independence
  // Guarantee). A dispute is the one thing that still holds (they're correcting, not finishing).
  // "I'm done" OR "those are the main ones" both close the beat (once the contract is met) — the
  // latter answers the widen question, so re-asking it is the bug we're fixing.
  // STICKY "there's more" hold: once the member says the fade story isn't finished ("there's more, it
  // wasn't just the layoff"), stay open until they EXPLICITLY close it — so a thin gap can't complete a
  // couple of turns later when they happen not to re-signal (the per-turn hold let Rita's run slip). The
  // member ending the beat ("that's the whole of it" / "I'm done") clears it; the DOOR_MAX_TURNS cap is
  // the safety valve so it can never trap. The mirror of a dispute.
  const signalsMore = memberSignalsMore(memberMessage);
  const closesStory = confirmsWhole(memberMessage) || memberWantsToWrap(memberMessage);
  const awaitingMore = ((state.awaitingMore ?? false) || signalsMore) && !closesStory;
  const atDoorCap = doorTurns >= DOOR_MAX_TURNS;
  const memberDone = (memberWantsToWrap(memberMessage) || confirmsWhole(memberMessage)) && !disputed && !signalsMore;
  let { complete, stage, exploringDoor } = resolveCompletion(
    collected,
    wantsComplete && !disputed,
    doorTurns,
    isAffirmation(memberMessage) && !disputed,
    disputed || (awaitingMore && !atDoorCap), // a dispute OR an unresolved "there's more" blocks the wrap
    memberDone,
  );

  // LEG 3 RECONCILIATION (the catch-net): before handing off, make sure no Door the member RAISED in the
  // Door beat got dropped by the model's lossy summary. Scan their OWN Door-beat words; if one isn't
  // recorded (and wasn't already set aside), DON'T complete — reflect it back and ask once whether it's a
  // Door or just background. Ask-never-assert keeps scanning their full account safe. Also wraps cleanly:
  // once they've answered the last confirm and nothing else was dropped, complete.
  let doorConfirmReply: string | null = null;
  const wasResolvingConfirm = !!state.pendingDoorConfirm; // this turn answered a confirm we posed last turn
  if (doorBeatFromIndex !== undefined && !pendingDoorConfirm) {
    const beatMessages = [
      ...history.slice(doorBeatFromIndex).filter((mm) => mm.role === 'member').map((mm) => mm.text),
      memberMessage,
    ];
    const missed = uncapturedDoorSignals(beatMessages, collected.doors ?? [], declinedDoors);
    if (missed.length > 0 && (complete || wasResolvingConfirm)) {
      pendingDoorConfirm = missed[0]!.slug;
      doorConfirmReply = doorConfirmPrompt(missed[0]!.slug, missed[0]!.phrase);
      complete = false;
      stage = 'door'; // still in the Door beat — we're asking a confirm, not handing off
    } else if (wasResolvingConfirm && missed.length === 0 && !disputed && !awaitingMore && contractMet(collected)) {
      complete = true; // last reconciliation confirm answered, nothing else dropped → wrap now
    }
  }

  let finalReply: string;
  if (complete) {
    // Prefer the model's OWN close — a warm summary of how the gap opened with the Door(s) named in
    // context (not a bare list). Fall back to the engine handoff only when the model gave no real
    // text (e.g. a tool-only turn). Ensure the IDQ transition is on the end either way.
    const r = reply.trim();
    finalReply = r.length >= 100 ? ensureIdqHandoff(r) : handoff(collected.doors ?? [], collected.identityNoun);
  } else if (disputed) {
    // Honor the pushback: use the model's own reply (it's reconsidering / asking what actually
    // changed), guaranteeing a forward question — never the canned forward or a repeated label.
    finalReply = withForwardPrompt(reply, 'door');
  } else if (exploringDoor) {
    // Stay in the Door beat. Use the model's text if it asked something; otherwise drive the beat
    // forward ourselves — widen first (the gap is usually more than one Door), then move toward
    // closure. Never re-ask what changed or when (that reads as the loop members hit before).
    const r = reply.trim();
    // If the fade STORY isn't captured yet, that's the priority — ask how it opened before widening to
    // other Doors. (Prevents completing on a Door slug with no real "how it opened" narrative.)
    const needGap = !gapIsNarrative(collected.gap, collected.reclaimList ?? []);
    // Vary the widen question by turn so it can NEVER repeat verbatim (the "asked the same thing twice"
    // bug), and escalate toward closing rather than circling.
    const forward = needGap
      ? 'Help me understand how that opened — when did you first feel the drift, and what did it quietly cost you?'
      : signalsMore || awaitingMore
        ? 'I’m listening — tell me the rest of how it opened.'
        : doorTurns <= 1
          ? 'That rarely opens all at once. Was that the whole of it, or did something else pile on around the same time?'
          : doorTurns === 2
            ? 'Got it. Anything else from that stretch worth naming — or is that the heart of it?'
            : 'That sounds like the full picture. Ready to move on whenever you are — unless there’s one more piece.';
    // The model sometimes jumps to a wrap ("Ready when you are.") before the engine will let the
    // beat close. Don't stack the forward question onto a contradictory handoff — just ask it.
    const prematureHandoff = /ready when you are/i.test(r);
    finalReply = prematureHandoff ? forward : /\?/.test(r) ? r : `${r ? `${r}\n\n` : ''}${forward}`;
  } else if (stage === 'door') {
    const r = reply.trim();
    const prematureHandoff = /ready when you are/i.test(r);
    const lead = r && !prematureHandoff && !/\?\s*$/.test(r) ? `${r}\n\n` : '';
    if (!doorActive) {
      // The Reclaim List hit the minimum but the member is still adding — keep the list OPEN; never pose
      // the Door question yet, never capture/complete. (The list has no max — count alone never ends it.)
      finalReply = /\?/.test(r) ? r : `${lead}Anything else you want back, or does that feel like the list?`;
    } else if (enteringDoorBeat) {
      // The member just finished the Reclaim List — ENTER the Door beat and pose the question. Never keep
      // a lingering "anything else?" reclaim question here: the gap can only be gathered once we've asked.
      finalReply = `${lead}${doorPrompt()}`;
    } else {
      // Already in the Door beat, gap not yet a narrative. NEVER re-ask "how did the gap open?" once it's
      // captured (the loop Donna hit). If it isn't captured yet, ask it; if it is, move to naming the Door.
      const needGap = !gapIsNarrative(collected.gap, collected.reclaimList ?? []);
      const forward = needGap
        ? doorPrompt()
        : 'You’ve already told me how it opened — I’ve got that. If you had to name the one thing that opened the gap, what would you call it?';
      finalReply = !prematureHandoff && /\?/.test(r) ? r : `${lead}${forward}`;
    }
  } else if (stage === 'identity_name') {
    // IDENTITY GATE forced-forward: hold the conversation on naming the reclaimed identity until the
    // member names it (model records identityNoun) or chooses to find it later (identitySkipped). Keep
    // the model's reply ONLY when it's genuinely asking the naming question — otherwise it drifted
    // (Donna: wandered into the Reclaim List), so drop its off-track question and drive the beat. After
    // IDENTITY_SKIP_OFFER_AFTER tries, the forward becomes the explicit "name it later" skip offer.
    const r = reply.trim();
    const forward = idGate.offerSkip
      ? 'No rush on the perfect word — and you don’t have to land it today. If one comes — the Runner, the Writer, the Builder, the Friend — say it. If not, that’s completely fine; we’ll find it together as you go. Want to leave it for now?'
      : 'If you put that person in a single word — the Runner, the Writer, the Builder, the Friend — what would it be?';
    const onTopic = /\?/.test(r) && /\b(word|name|call it|single|one word|who you were|that person|leave it for now)\b/i.test(r);
    const lead = r && !/\?/.test(r) ? `${r}\n\n` : ''; // keep a non-question reflection; drop a drift question
    finalReply = onTopic ? r : `${lead}${forward}`;
  } else {
    finalReply = withForwardPrompt(reply, stage);
  }

  // If reconciliation intervened, the confirm question (in the member's own words) replaces the forward.
  if (doorConfirmReply) finalReply = doorConfirmReply;

  // ANTI-REPEAT (the "you're hung up" guard): when the model returns a degraded turn (no usable text or
  // tool call — e.g. an API wobble mid-conversation), the forced-forward can land on the SAME canned
  // prompt we just sent. Donna got the identical gap question four times in a row, even after "it seems
  // like you're hung up." Never echo our own last message verbatim: if it would repeat (and we're not
  // completing), acknowledge the snag and hand the member an explicit way forward — including a clear
  // exit ("that's everything") that the close-detection already honors.
  const lastAgent = [...history].reverse().find((mm) => mm.role === 'agent')?.text?.trim();
  if (!complete && lastAgent && finalReply.trim() === lastAgent) {
    finalReply =
      'I think I got tangled there — sorry about that. You’ve already shared a lot, and I have it. ' +
      'If there’s more to how the gap opened, tell me in a line — otherwise say “that’s everything” and I’ll take us straight to what’s next.';
  }

  return {
    reply: finalReply,
    state: { stage, collected, doorTurns, identityTurns, doorAsked, doorBeatFromIndex, pendingDoorConfirm, declinedDoors, awaitingMore },
    complete,
  };
}
