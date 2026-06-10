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
import { DOORS, DOOR_SLUGS, isDoorSlug, matchDoors, type DoorSlug } from '../doors.ts';
import { cleanIdentityNoun, displayIdentityNoun, identityLabel } from '../member/identity.ts';
import { RECLAIM_LIST_MIN, RECLAIM_LIST_TARGET } from '../member/reclaim.ts';

export type Stage = 'identity' | 'identity_name' | 'reclaim' | 'door' | 'complete';

export type Collected = {
  athleticPast?: string; // Step 1: the past self, in the member's own words
  identityNoun?: string; // the reclaimed identity, natural case (e.g. "Athlete")
  reclaimList?: string[]; // >= RECLAIM_LIST_MIN
  reclaimCategories?: string[]; // IDQ-dimension category per item, same order (agent-inferred)
  gap?: string; // Step 3 free-text: how the gap opened (member's words)
  doors?: DoorSlug[]; // one or more
};

export type ConvState = { stage: Stage; collected: Collected };
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

const DOOR_LINES = () => DOORS.map((d) => `${d.displayName} — ${d.descriptor}`).join('\n');
const doorPrompt = () =>
  'One more thing before the work starts — and it might be the most important one: how did the gap open?\n\n' +
  'Something usually does it, and rarely all at once. For most people it traces back to one of a handful of doors. ' +
  'See if one of these is your story:\n\n' +
  `${DOOR_LINES()}\n\n` +
  'Which one sounds like yours? And if more than one fits, tell me — most people walked through more than one, not just one.';

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

// Derive the stage from what's collected — keeps state coherent on the live path so a scripted
// fallback (after a transient live failure) resumes at the right question instead of restarting.
export function nextStage(c: Collected): Stage {
  if (!c.athleticPast) return 'identity';
  if (!c.identityNoun) return 'identity_name';
  if (!c.reclaimList || c.reclaimList.length < RECLAIM_LIST_MIN) return 'reclaim';
  if (!c.doors || c.doors.length === 0) return 'door';
  return 'complete';
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
    try {
      return await liveTurn(args.ctx, args.history, args.state, args.memberMessage);
    } catch (e) {
      console.warn('onboarding: live agent unavailable, using scripted —', (e as Error).message);
    }
  }
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
          `Tell me in your own words what changed — or name the one from the list that fits closest.\n\n${DOOR_LINES()}`,
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

2) RECLAIM LIST. Ask what having that self back looks like on an ordinary day — concrete, specific things they want back. Gather at least ${RECLAIM_LIST_MIN}; there is NO maximum. Gently keep drawing more out toward about ${RECLAIM_LIST_TARGET}, but never force a count or make it feel like a quota.
THE BAR (important): every item you record MUST be specific and observable — concrete enough to witness on an ordinary day. A feeling or inner state on its own is NOT acceptable: "feel better about myself", "be happier", "more confident", "less stressed" are fog and cannot be measured later. When a member offers one, do NOT record it as-is — ask, warmly and without a worksheet, "what would that look like on a Tuesday?" and keep gently sharpening until it becomes observable (e.g. "feel better about myself" → "recognize the person in the mirror" or "ride before work without dreading it"; "be healthier" → "walk 30 minutes most mornings"). Only record an item once it clears that bar.
For EACH item, also assign a category — the life area it belongs to: physical (body/movement/food/sleep), self (identity/who they are), social (people/relationships), or outlook (purpose/future/mindset). Record the items in reclaimList and their categories in reclaimCategories, same order.

3) FADE DOOR(S). Ask how the gap opened. The member answers in their own words; map silently to one OR MORE of the eight Doors below (most people walked through more than one). Do not make them pick from a numbered list — confirm gently only if their answer is ambiguous. Record doors as an array of slugs.
${DOORS.map((d) => `- ${d.slug}: ${d.displayName} — ${d.descriptor}`).join('\n')}

Then hand off to the IDQ: name the Door(s), the reclaimed identity, and the Reclaim List in one or two plain sentences, and say a set of honest questions comes next (no studying, no score to pass).

VOICE: no meta-narration about the program's own mechanics; gender-inclusive; warm, direct, short sentences. Let the Fade carry the weight, not statistics.
TURN-TAKING (important): reflect first, then ALWAYS end your turn with exactly ONE clear question or prompt that tells the member what to do next. Never end on a bare statement or reflection — that strands the member, unsure whether it is their turn. The ONLY turn without a question is the final IDQ handoff, which closes with "Ready when you are."

On EVERY turn you MUST also call the record_progress tool with everything gathered so far. Set complete=true only once ALL of these are gathered: athleticPast, a confirmed natural-case identityNoun, a reclaimList of at least ${RECLAIM_LIST_MIN}, and at least one door.`;

const RECORD_PROGRESS_TOOL = {
  name: 'record_progress',
  description: 'Record the structured intake gathered so far. Call on every turn.',
  input_schema: {
    type: 'object' as const,
    properties: {
      athleticPast: { type: 'string', description: "the member's past self, in their own words" },
      identityNoun: { type: 'string', description: 'confirmed identity noun, natural case (e.g. "Athlete")' },
      reclaimList: { type: 'array', items: { type: 'string' }, description: 'specific, observable items the member wants back' },
      reclaimCategories: {
        type: 'array',
        items: { type: 'string', enum: ['physical', 'self', 'social', 'outlook'] },
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
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 9000, maxRetries: 1 });

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
  let complete = false;
  for (const block of res.content) {
    if (block.type === 'text') reply += block.text;
    if (block.type === 'tool_use' && block.name === 'record_progress') {
      const p = block.input as Partial<Collected> & { complete?: boolean };
      const doors = Array.isArray(p.doors) ? p.doors.filter(isDoorSlug) : undefined;
      collected = {
        ...collected,
        ...(p.athleticPast !== undefined && { athleticPast: p.athleticPast }),
        ...(p.identityNoun !== undefined && { identityNoun: displayIdentityNoun(p.identityNoun) }),
        ...(Array.isArray(p.reclaimList) && { reclaimList: p.reclaimList }),
        ...(Array.isArray((p as { reclaimCategories?: string[] }).reclaimCategories) && {
          reclaimCategories: (p as { reclaimCategories?: string[] }).reclaimCategories,
        }),
        ...(p.gap !== undefined && { gap: p.gap }),
        ...(doors && doors.length > 0 && { doors }),
      };
      // Trust complete only when the hard requirements are actually present.
      complete = Boolean(p.complete) &&
        !!collected.athleticPast && !!collected.identityNoun &&
        (collected.reclaimList?.length ?? 0) >= RECLAIM_LIST_MIN &&
        (collected.doors?.length ?? 0) >= 1;
    }
  }
  const stage: Stage = complete ? 'complete' : nextStage(collected);
  // On completion the handoff is intentionally a statement (followed by the Continue button);
  // every other turn must end with a forward question so the member is never left hanging.
  const finalReply = complete
    ? reply.trim() || STAGE_PROMPT.complete
    : withForwardPrompt(reply, stage);
  return { reply: finalReply, state: { stage, collected }, complete };
}
