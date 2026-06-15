// Conversational onboarding — the Member Agent (G4L voice) conducting the intake as a real
// turn-by-turn conversation: listen, reflect, one question at a time. Voice rewrite v1 captures
// three records — the Reclaimed Identity, the Reclaim List, and the Fade Door(s) — and hands off
// to the IDQ. The old separate "gap" / "right now" questions are folded in (the gap is captured
// inside the Door step; "right now" is the IDQ's job).
//
// Two backends behind one engine:
//   - scripted: deterministic state machine for local dev / tests (no key)
//   - live:     Claude with tool-use (record_progress) when ANTHROPIC_API_KEY is set
// Governance runs on every member turn (crisis detection -> 988 halt). The AI disclosure is the
// verbatim first line. Voice is G4L (Member-facing) — never Jay's, never impersonating Greg.

import { AI_DISCLOSURE, CRISIS_RESPONSE_US, detectCrisis } from './governance.ts';
import { MEMBER_AGENT_SYSTEM_PROMPT } from './system-prompt.ts';
import { DOORS, DOOR_SLUGS, isDoorSlug, matchDoors, correctDoors, type DoorSlug } from '../doors.ts';
import { cleanIdentityNoun, displayIdentityNoun, identityLabel } from '../member/identity.ts';
import { RECLAIM_LIST_MIN, RECLAIM_LIST_TARGET } from '../member/reclaim.ts';

export type Stage = 'identity' | 'identity_name' | 'reclaim' | 'door' | 'complete';

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
};
export type ConvMessage = { role: 'agent' | 'member'; text: string };
export type Ctx = { name: string; email: string };

export type Turn = { reply: string; state: ConvState; complete: boolean; crisis?: boolean };

export const INITIAL_STATE: ConvState = { stage: 'identity', collected: {} };

const FIRST_QUESTION =
  'Before we start — who were you, back when you felt most like yourself?\n\n' +
  'Not the job title. Not the role everyone knows you for. The version underneath all that — ' +
  'the one who showed up before life got busy and quietly talked you out of it.\n\n' +
  'Maybe you were the one who never thought twice about the stairs. The one who played until your ' +
  'fingers hurt. The early riser. The friend who always called. The one who said yes to the trip. ' +
  'The builder, the writer, the runner, the parent down on the floor with the kids.\n\n' +
  'Whoever that was — tell me about them.';

export const OPENING_REPLY = `${AI_DISCLOSURE}\n\n${FIRST_QUESTION}`;

const doorName = (slug: DoorSlug) => DOORS.find((d) => d.slug === slug)!.displayName;
const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// The Door is explored as a story, never presented as a menu — listing options stops the
// conversation, and we need to understand HOW the gap opened, not just label it.
const doorPrompt = () =>
  'One more thing before the work starts — and it might be the most important: how did the gap open?\n\n' +
  'Something usually does it, and rarely all at once. Tell me what happened — when you first felt the drift, and what it quietly cost you.';

const reclaimPrompt = (noun?: string) =>
  `Good. ${capFirst(identityLabel(noun) || 'That person')} is the who. Now the what.\n\n` +
  'Picture having that back — not the highlight reel, an ordinary Tuesday. What does it actually look like? ' +
  'The real, specific stuff: riding before work without dreading it. Keeping up on the trail instead of waving ' +
  'everyone ahead. Looking in the mirror and recognizing the person looking back. Booking the trip you keep ' +
  'talking yourself out of.\n\n' +
  'These become your Reclaim List — the concrete things we go after, three to start and more if they keep coming. ' +
  'What do you want back?';

function doorPhrase(doors: DoorSlug[]): string {
  const names = doors.map(doorName);
  if (names.length <= 1) return names[0] ?? 'The door that opened';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function handoff(doors: DoorSlug[], noun?: string): string {
  return (
    "Okay. Here's what we've got.\n\n" +
    `${doorPhrase(doors)} is how it started. ${capFirst(identityLabel(noun) || 'That person')} is who we're bringing back. ` +
    'And your Reclaim List is what that looks like, in real life.\n\n' +
    'Before we go to work, we need one honest thing: a clear read on exactly how far the gap runs right now. ' +
    "That's next — a set of questions that hold up a mirror. No studying, no score to pass. Then we start closing the distance.\n\n" +
    'Ready when you are.'
  );
}

const IDQ_HANDOFF_TAIL =
  'Next, a set of honest questions to see exactly how far the gap runs right now — no studying, no score to pass. Ready when you are.';
// Prefer the model's OWN close (it can summarize the member's story and reveal the Door(s) in context,
// not just name them) — just guarantee the IDQ transition is on the end.
export function ensureIdqHandoff(modelText: string): string {
  const t = modelText.trim();
  return /ready when you are/i.test(t) ? t : `${t}\n\n${IDQ_HANDOFF_TAIL}`;
}

// Derive the stage from what's collected — keeps state coherent on the live path so a scripted
// fallback (after a transient live failure) resumes at the right question instead of restarting.
export function nextStage(c: Collected): Stage {
  if (!c.athleticPast) return 'identity';
  if (!c.identityNoun && !c.identitySkipped) return 'identity_name';
  if (!c.reclaimList || c.reclaimList.length < RECLAIM_LIST_MIN) return 'reclaim';
  if (!c.doors || c.doors.length === 0) return 'door';
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

// The member pushing back on the Door read ("that's not it", "what do you mean", "those don't fit").
// A dispute must REOPEN the beat — never wrap, never replay the same label.
const DISPUTE_RE =
  /\b(what do you mean|that'?s not (it|right|quite)|that wasn'?t (it|the)|doesn'?t (seem|sound|fit|feel)|don'?t (seem|think|see|fit)|i (wouldn'?t|don'?t) (say|call|think)|not (really )?(it|right|the problem|what)|disagree|off( |-)base|that'?s wrong|no,? that|isn'?t (it|right))\b/i;
export function isDoorDispute(message: string): boolean {
  return DISPUTE_RE.test((message ?? '').replace(/[‘’]/g, "'"));
}

// At the naming step, a member may genuinely not know yet — honor it, don't force a label.
const DECLINE_IDENTITY_RE =
  /\b(not sure|don'?t know|dunno|no idea|no clue|unsure|can'?t say|hard to say|not yet|don'?t have (one|a word)|skip|pass|i don'?t)\b/i;

export function resolveCompletion(
  collected: Collected,
  wantsComplete: boolean,
  doorTurns = 0,
  memberAffirmed = false,
  blocked = false, // a Door dispute this turn — never wrap; reopen the beat instead
): { complete: boolean; stage: Stage; exploringDoor: boolean } {
  const reqsMet =
    !!collected.athleticPast &&
    (!!collected.identityNoun || !!collected.identitySkipped) && // named it, or chose "not yet"
    (collected.reclaimList?.length ?? 0) >= RECLAIM_LIST_MIN &&
    (collected.doors?.length ?? 0) >= 1;
  const exploredEnough = doorTurns >= DOOR_MIN_TURNS;
  const mustWrap = doorTurns >= DOOR_MAX_TURNS;
  const complete = !blocked && reqsMet && exploredEnough && (wantsComplete || memberAffirmed || mustWrap);
  // We hold in the Door beat whenever we have a Door but aren't completing — so the engine keeps the
  // conversation there (widening to other Doors, then deepening) instead of stranding or rushing.
  const exploringDoor = !complete && reqsMet;
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
  complete: "That's everything we need. Let's look at where you're starting from next.",
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
  // Opening turn: the AI disclosure (verbatim) + the first question, always engine-owned.
  if (args.memberMessage === null) {
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
        'That stays with you — I can hear it.\n\nIf you put that person in a single word — the Runner, the Writer, the Builder, the Friend — what is the word?',
      );
    case 'identity_name': {
      // Honor "I'm not sure yet" — never force a name. They'll find it at Identity Excavation.
      if (DECLINE_IDENTITY_RE.test(message.trim().replace(/[‘’]/g, "'"))) {
        collected.identitySkipped = true;
        return done(
          'reclaim',
          `That's an honest answer — and totally fine. You don't have to name it today; we'll find it together as you go.\n\n${reclaimPrompt()}`,
        );
      }
      // The member names it themselves (governance: identity is never assigned without confirmation).
      const cleaned = cleanIdentityNoun(message);
      const word = (cleaned.split(/\s+/)[0] ?? '').replace(/[^A-Za-z-]/g, '');
      const noun = displayIdentityNoun(word);
      collected.identityNoun = noun;
      return done(
        'reclaim',
        `${capFirst(identityLabel(noun))}. That's who we're bringing back, and I'll keep that in front of us the whole way.\n\n${reclaimPrompt(noun)}`,
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

1) RECLAIMED IDENTITY. Open with the question about who they were when they felt most themselves (a past self of ANY kind — runner, writer, musician, builder, teacher, parent, the friend who always called — never assume it is athletic). Listen. Then reflect a specific detail of THEIR OWN words back, propose the identity as a single natural-case noun ("So — the Runner." / "the Writer." / "the Builder."), and confirm it with them before moving on. NEVER all-caps the noun ("the Athlete", never "THE ATHLETE"). Record identityNoun as the bare noun in natural case, without a leading "the/a/an".
NOT SURE IS OK. If they genuinely don't know yet, or aren't ready to put a single word to it, do NOT push — reassure them warmly that they don't have to name it today and they'll find it through the work (Identity Excavation comes soon). In that case call record_progress with identitySkipped=true and leave identityNoun empty, then move on to the Reclaim List. Never assign or pressure a name.

2) RECLAIM LIST. Ask what having that self back looks like on an ordinary day — concrete, specific things they want back. Gather at least ${RECLAIM_LIST_MIN}; there is NO maximum. Gently keep drawing more out toward about ${RECLAIM_LIST_TARGET}, but never force a count or make it feel like a quota.
THE BAR (important): every item you record MUST be specific and observable — something you could BOTH witness happening in an ordinary week. Catch two failure modes, warmly and without a worksheet:
(a) A feeling or inner state on its own — "feel better about myself", "be happier", "more confident", "less stressed" — is fog and cannot be measured. Ask "what would that look like on a Tuesday?" and sharpen until observable ("feel better about myself" → "recognize the person in the mirror"; "be healthier" → "walk 30 minutes most mornings").
(b) A real action with a vague or mission-scale tail — "train hard enough to build the movement", "ride to get away from it all", "eat right" — where the action is good but the aim isn't witnessable. Don't accept the abstract finish line; press ONCE MORE to anchor it to something countable or concrete ("how many hard training days a week would that be?", "what does 'eat right' look like on a normal day?"). This is the easy one to let slide — don't.
The strongest items name a number, a frequency, or a named event ("down to 190", "ride with a group weekly", "race-ready for Big Sugar"). Only record an item once it clears the bar — but keep it a warm conversation, one gentle press at a time, never an interrogation.
For EACH item, also assign a category — the area it belongs to: physical (body/movement/food/sleep), self (identity/who they are), social (people/relationships), outlook (purpose/future/mindset), or life (any goal that doesn't map to those — money, a venture, savings, a milestone like "raise $250k"). The Reclaim List holds ANY goal that matters to them, not just identity work; don't force a money/venture goal into a dimension — that's what life is for. Record the items in reclaimList and their categories in reclaimCategories, same order. (Category is internal — never name it to the member.)

3) FADE DOOR(S) — EXPLORE, never list. This is the most important and most vulnerable beat. Open it with a real question about how the gap opened ("Something opened this gap, and it's rarely all at once — what happened? When did you first feel the drift?"). Then have a CONVERSATION, not a form: follow up to understand HOW it unfolded — the sequence, when they first noticed, what it quietly cost them — reflecting their own words back. Your job is to understand how it happened, not just that it did. Stay with their story for two or three exchanges; don't rush to wrap it.
THE GAP IS USUALLY MORE THAN ONE DOOR. The Fade rarely opens through a single event — the body starts saying no AND the career plateaus; the nest empties AND a parent gets sick. Once you understand the FIRST door, explicitly check whether others stacked onto it ("Was that the whole of it, or did something else pile on around the same time?"). Capture every door that genuinely applies, not just the first one named. Ask this once — don't interrogate; if they say it was just the one, accept that and move on.
Do NOT recite a menu of Doors or ask them to pick one — listing options stops the conversation cold. The eight Doors below are YOUR private map for tagging, never shown to the member. Map their story silently to one OR MORE of them, and record their account in gap and the mapped slug(s) in doors.
HOW TO SURFACE A DOOR — context first, the NAME last (never open with the bare label; it's cryptic and unearned). When you recognize which Door fits, reveal it in three beats, not one:
(1) CONTEXT — reflect what they described back in plain words, using the Door's one-line meaning (given in the map below) as your language, NOT its title. e.g. "the house getting quiet after the kids moved out", "your body starting to say no to what it used to do easily", "the role reversal where you became the one doing the caring." They should feel seen by the description.
(2) METAPHOR — then offer the frame lightly: a single life event like that is what we call a Door — the moment the Fade quietly opened.
(3) NAME — only THEN give it its name, and offer it for them to accept or adjust: "some people call that one The Empty Nest — does that fit, or is it not quite that?" Let them take it, refine it, or wave it off.
Never collapse these into "That's The Empty Nest." The name is the last beat, after the description and the metaphor have landed.
MAP WHAT THEY ACTUALLY SAID — NOT A PROJECTED LIFE STAGE. Tag the event they describe, in the timeframe they describe it. Do NOT project forward: someone describing getting married or having young kids is NOT "the Empty Nest" or "the Aging Parents" (those are later-life stages) — if anything it's the responsibility of a new family crowding out the self. If their story does not clearly fit any of the eight, do NOT force one: reflect their OWN words, keep exploring, and name a Door only as tentative recognition they would themselves agree with. A Door the member wouldn't recognize is worse than none yet — never assert one as a verdict.
IF THEY PUSH BACK on a Door you named ("that's not it", "what do you mean", "those don't seem right"), treat it as a correction, not a detour: set the label aside immediately, say plainly you may have misread, ask them to tell you more about what actually changed, and RE-MAP from their answer. NEVER repeat a Door label the member has just questioned.
[internal Door map — do not list to the member]
${DOORS.map((d) => `- ${d.slug}: ${d.displayName} — ${d.descriptor}`).join('\n')}
DISAMBIGUATE the three family Doors — they are NOT interchangeable, and confusing them is the most common mistake:
- aging_parents is caring for your OWN AGING PARENTS. A spouse's needs, a partner's struggles, or young kids are NOT this.
- empty_nest is kids who GREW UP and MOVED OUT, leaving the house quiet. Getting married, HAVING kids, or RAISING young kids is the OPPOSITE of this — never tag empty_nest for it.
- full_house is the years a household FILLS UP: marriage, young or dependent kids, a partner who needs carrying, becoming the one everyone leans on, until there's no room left for yourself. THIS is the Door for "I got married, then we had kids, and the responsibility took over." When someone describes marrying and raising a family and losing themselves in it, it is full_house — never empty_nest or aging_parents.

CLOSE WITH A SUMMARY, NOT A LIST. Once you understand how the gap opened and have checked whether more than one Door stacked on (about three or four exchanges — don't keep asking past that), close the beat in ONE warm turn, and call record_progress with complete=true on that turn. Include ALL of these, in this order:
(1) SUMMARY — reflect their WHOLE story back in two or three sentences, in their own words: what actually opened the gap and what it quietly cost them.
(2) THE METAPHOR, THEN THE NAME — the first time you name a Door, explain the idea: a single life event like that is what we call a "Door" — the moment the Fade quietly opened. THEN give the Door(s) you heard, each with its plain meaning AND its title, e.g. "that's a Door — and yours is the stretch where the house filled up: marriage, young kids, everyone leaning on you, no room left for you. We'd call that one The Full House." Don't drop a title without the plain meaning and the metaphor first.
(3) THE RECLAIM LIST, CONCRETELY — bring their actual list in: name two or three of their real items back ("the craft, getting your body back, saying yes to the trip") and tell them that list is what reclaiming looks like in real life, waiting on their dashboard. Don't just say "your Reclaim List" abstractly — show them it's captured.
(4) THE IDENTITY — confirm the reclaimed identity is who you're bringing back.
(5) THE HANDOFF — a set of honest questions to see how far the gap runs comes next, no studying, no score — end with "Ready when you are."
NEVER close on a bare label: the member should feel their whole story reflected, understand what a Door even is, and see their own Reclaim List named back before the conversation moves on.

VOICE: no meta-narration about the program's own mechanics; gender-inclusive; warm, direct, short sentences. Let the Fade carry the weight, not statistics.
TURN-TAKING (important): reflect first, then ALWAYS end your turn with exactly ONE clear question or prompt that tells the member what to do next. Never end on a bare statement or reflection — that strands the member, unsure whether it is their turn. The ONLY turn without a question is the final IDQ handoff, which closes with "Ready when you are."
ALWAYS write a spoken message to the member on EVERY turn — never respond with only a tool call and no text (a tool-only turn makes the app repeat the last prompt, which feels broken). And NEVER re-ask a question the member has already answered or repeat a prompt you've already sent — if you have their answer, acknowledge it and move forward. Once you understand how the gap opened and have mapped at least one Door, record it and move to the handoff; do not keep circling the same question.

On EVERY turn you MUST also call the record_progress tool with everything gathered so far. Set complete=true only once ALL of these are gathered: athleticPast, EITHER a confirmed natural-case identityNoun OR identitySkipped=true (they chose not to name one yet), a reclaimList of at least ${RECLAIM_LIST_MIN}, and at least one door — AND you have genuinely explored HOW that door opened (not just labeled it) AND checked whether more than one door was involved. Do not complete on the first mention of what happened; understand the story, and whether there was more than one door, first. CLOSING THE BEAT: once you have reflected the full picture of how the gap opened and the member confirms it is accurate ("it does", "yes, that's right"), you are DONE — call record_progress with complete=true and hand off on that same turn. Do NOT ask another question, and NEVER re-ask what changed or when they first noticed it once they have already told you. Their confirmation is the signal to wrap; honor it.`;

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

async function liveTurn(
  ctx: Ctx,
  history: ConvMessage[],
  state: ConvState,
  memberMessage: string,
): Promise<Turn> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // Deep-in-conversation turns carry a large context; 9s was too tight and tripped intermittent
  // timeouts that dropped the member into the scripted fallback. Give it room, and retry transient blips.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 25000, maxRetries: 2 });

  const messages = [
    ...history.map((m) => ({
      role: (m.role === 'agent' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: m.text,
    })),
    { role: 'user' as const, content: memberMessage },
  ];

  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 600,
    system: ONBOARDING_SYSTEM,
    tools: [RECORD_PROGRESS_TOOL],
    messages,
  });

  let reply = '';
  let collected: Collected = { ...state.collected };
  let wantsComplete = false;
  for (const block of res.content) {
    if (block.type === 'text') reply += block.text;
    if (block.type === 'tool_use' && block.name === 'record_progress') {
      const p = block.input as Partial<Collected> & { complete?: boolean };
      const doors = Array.isArray(p.doors) ? p.doors.filter(isDoorSlug) : undefined;
      collected = {
        ...collected,
        ...(p.athleticPast !== undefined && { athleticPast: p.athleticPast }),
        ...(p.identityNoun !== undefined && p.identityNoun !== '' && { identityNoun: displayIdentityNoun(p.identityNoun) }),
        ...(p.identitySkipped === true && { identitySkipped: true }),
        ...(Array.isArray(p.reclaimList) && { reclaimList: p.reclaimList }),
        ...(Array.isArray((p as { reclaimCategories?: string[] }).reclaimCategories) && {
          reclaimCategories: (p as { reclaimCategories?: string[] }).reclaimCategories,
        }),
        ...(p.gap !== undefined && { gap: p.gap }),
        ...(doors && doors.length > 0 && { doors }),
      };
      wantsComplete = Boolean(p.complete);
    }
  }

  // SAFETY NET: the model sometimes explores the Door(s) in prose but forgets to record them in the
  // tool — which strands the beat re-asking the opening question (its stage prompt). If the core is
  // ready (identity + Reclaim List) and no Door was recorded, infer the Door(s) from what the member
  // actually said, so the engine is never blind to a Door the conversation clearly surfaced.
  const coreReady =
    !!collected.athleticPast &&
    (!!collected.identityNoun || !!collected.identitySkipped) &&
    (collected.reclaimList?.length ?? 0) >= RECLAIM_LIST_MIN;
  if (coreReady && (collected.doors?.length ?? 0) === 0) {
    const memberText = [...history.filter((m) => m.role === 'member').map((m) => m.text), memberMessage, collected.gap ?? ''].join('  ');
    const inferred = matchDoors(memberText);
    if (inferred.length > 0) collected = { ...collected, doors: inferred, ...(collected.gap ? {} : { gap: memberMessage }) };
  }

  // Guard the model's most common Door mix-up — a marriage/young-kids/load-bearer story is The Full
  // House, never the later-life Empty Nest or Aging Parents. Correct from the actual narrative.
  if ((collected.doors?.length ?? 0) > 0) {
    const narrative = [...history.filter((m) => m.role === 'member').map((m) => m.text), memberMessage, collected.gap ?? ''].join('  ');
    collected = { ...collected, doors: correctDoors(collected.doors!, narrative) };
  }

  // Count exchanges spent in the Door beat — only once the gap/Door is actually being discussed, NOT
  // the moment the Reclaim List fills (nextStage flips to 'door' then, even while the model is still
  // drawing out Reclaim items — counting those would wrap the beat on the first real gap answer).
  const engagingDoor = doorEngaged(state.collected, collected);
  const doorTurns = (state.doorTurns ?? 0) + (engagingDoor ? 1 : 0);

  // The member disputing the Door read must REOPEN the beat: never wrap, never replay the same label —
  // let the model's reply (which reconsiders / re-maps) through instead of the canned handoff.
  const disputed = isDoorDispute(memberMessage) && ((state.collected.doors?.length ?? 0) >= 1 || !!state.collected.gap);
  const { complete, stage, exploringDoor } = resolveCompletion(
    collected,
    wantsComplete && !disputed,
    doorTurns,
    isAffirmation(memberMessage) && !disputed,
    disputed,
  );

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
    const forward =
      doorTurns <= 1
        ? 'That rarely opens all at once. Was that the whole of it, or did something else pile on around the same time?'
        : 'Is there anything else that pulled at you in that season — or does that feel like the whole of how it opened?';
    // The model sometimes jumps to a wrap ("Ready when you are.") before the engine will let the
    // beat close. Don't stack the forward question onto a contradictory handoff — just ask it.
    const prematureHandoff = /ready when you are/i.test(r);
    finalReply = prematureHandoff ? forward : /\?/.test(r) ? r : `${r ? `${r}\n\n` : ''}${forward}`;
  } else {
    finalReply = withForwardPrompt(reply, stage);
  }
  return { reply: finalReply, state: { stage, collected, doorTurns }, complete };
}
