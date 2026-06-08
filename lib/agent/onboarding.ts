// Conversational onboarding — the Member Agent (G4L voice) conducting the four-chapter
// intake as a real turn-by-turn conversation: listen, reflect, one question at a time,
// synthesize-propose-confirm the identity noun, gather the Reclaim List (7) and the Door.
//
// Two backends behind one engine:
//   - scripted: deterministic state machine for local dev / tests (no key)
//   - live:     Claude with tool-use (record_progress) when ANTHROPIC_API_KEY is set
// Governance runs on every member turn (crisis detection -> 988 halt). The AI disclosure is
// the verbatim first line. Voice is G4L (Member-facing) — never Jay's, never impersonating Greg.

import { AI_DISCLOSURE, CRISIS_RESPONSE_US, detectCrisis } from './governance.ts';
import { MEMBER_AGENT_SYSTEM_PROMPT } from './system-prompt.ts';
import { DOORS, DOOR_SLUGS, isDoorSlug, type DoorSlug } from '../doors.ts';
import { RECLAIM_LIST_SIZE } from '../member/reclaim.ts';

export type Stage = 'athletic_past' | 'gap' | 'right_now' | 'identity' | 'reclaim' | 'door' | 'complete';

export type Collected = {
  athleticPast?: string;
  gap?: string;
  rightNow?: string;
  identityNoun?: string;
  reclaimList?: string[];
  door?: DoorSlug;
};

export type ConvState = { stage: Stage; collected: Collected };
export type ConvMessage = { role: 'agent' | 'member'; text: string };
export type Ctx = { name: string; email: string };

export type Turn = { reply: string; state: ConvState; complete: boolean; crisis?: boolean };

export const INITIAL_STATE: ConvState = { stage: 'athletic_past', collected: {} };

const FIRST_QUESTION =
  'Before we start — who were you, back when you felt most like yourself? Not your job title — the version of you that has faded. A writer, a runner, a musician, a builder, a parent who used to play. Whatever that was for you.';

export const OPENING_REPLY = `${AI_DISCLOSURE}\n\n${FIRST_QUESTION}`;

const DOOR_LIST = () => DOORS.map((d, i) => `${i + 1}. ${d.displayName} — ${d.descriptor}`).join('\n');
const doorOptions = () =>
  `We call the change that set this chapter in motion your “Door.” From what you’ve told me, which of these fits best?\n\n${DOOR_LIST()}\n\nReply with the number or the name.`;
const doorName = (slug: DoorSlug) => DOORS.find((d) => d.slug === slug)!.displayName;

// Derive the stage from what's collected — keeps state coherent on the live path so a scripted
// fallback (after a transient live failure) resumes at the right question instead of restarting.
export function nextStage(c: Collected): Stage {
  if (!c.athleticPast) return 'athletic_past';
  if (!c.gap) return 'gap';
  if (!c.rightNow) return 'right_now';
  if (!c.identityNoun) return 'identity';
  if (!c.reclaimList || c.reclaimList.length !== RECLAIM_LIST_SIZE) return 'reclaim';
  if (!c.door) return 'door';
  return 'complete';
}

// A safety-net question per stage — used if a live turn comes back with no text (tool-only),
// so the member never sees a blank reply that looks like the agent stalled.
const STAGE_PROMPT: Record<Stage, string> = {
  athletic_past: 'Who were you, back when you felt most like yourself?',
  gap: 'And then something shifted — what happened?',
  right_now: 'Where are you right now, this week — without polishing it?',
  identity: 'In one word: who do you want to be again?',
  reclaim: `Name ${RECLAIM_LIST_SIZE} things you want back — one per line, or separated by commas.`,
  door: doorOptions(),
  complete: 'Thank you — that’s everything we need. Let’s look at your baseline next.',
};

// The member chooses their Door explicitly (number or name) — the agent does not guess it
// from free text, which is ambiguous ("lost my job" vs "lost my mother") and would risk
// assigning an identity the member didn't confirm.
function matchDoor(message: string): DoorSlug | null {
  const m = message.trim().toLowerCase();
  const num = Number.parseInt(m, 10);
  if (Number.isInteger(num) && num >= 1 && num <= DOORS.length) return DOORS[num - 1]!.slug;
  for (const d of DOORS) {
    const short = d.displayName.toLowerCase().replace(/^the\s+/, ''); // e.g. "career cliff"
    if (m === d.slug || m === short || m === d.displayName.toLowerCase() || m.includes(short)) {
      return d.slug;
    }
  }
  return null;
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
    door: c.door ?? '',
    identityNoun: c.identityNoun ?? '',
    athleticPast: c.athleticPast ?? '',
    gap: c.gap ?? '',
    rightNow: c.rightNow ?? '',
    reclaimList: c.reclaimList ?? [],
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
    case 'athletic_past':
      collected.athleticPast = message.trim();
      return done('gap', 'That stays with you. Then something shifted — what happened?');
    case 'gap':
      collected.gap = message.trim();
      return done('right_now', "That's a real loss, and naming it matters. Where are you right now, this week — without polishing it?");
    case 'right_now':
      collected.rightNow = message.trim();
      return done('identity', 'Thank you for being straight about it. In one word: who do you want to be again?');
    case 'identity': {
      // Strip a leading article first ("the writer" → "writer") so we never render "THE THE".
      const cleaned = message.trim().replace(/^(the|a|an)\s+/i, '');
      const noun = (cleaned.split(/\s+/)[0] ?? '').replace(/[^A-Za-z-]/g, '').toUpperCase();
      collected.identityNoun = noun;
      return done(
        'reclaim',
        `THE ${noun} — we'll hold that as the self you're reclaiming. Now name ${RECLAIM_LIST_SIZE} things you want back. List them, one per line or separated by commas.`,
      );
    }
    case 'reclaim': {
      const items = message.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      if (items.length !== RECLAIM_LIST_SIZE) {
        return done(
          'reclaim',
          `I need exactly ${RECLAIM_LIST_SIZE} — you gave ${items.length}. ${items.length < RECLAIM_LIST_SIZE ? 'Add a few more.' : 'Trim it down.'}`,
        );
      }
      collected.reclaimList = items;
      return done(
        'door',
        `That's your Reclaim List — hold onto it; it's what we work toward.\n\nOne last thing before your baseline. ${doorOptions()}`,
      );
    }
    case 'door': {
      const slug = matchDoor(message);
      if (!slug) return done('door', `I didn't catch which one — reply with the number or the name:\n\n${DOOR_LIST()}`);
      collected.door = slug;
      return done(
        'complete',
        `${doorName(slug)} — that's the gap we'll work across. Your IDQ is next; it sets your baseline ID Score.`,
        true,
      );
    }
    default:
      return done('complete', '', true);
  }
}

// --- Live (Claude tool-use) -------------------------------------------------------------
const ONBOARDING_SYSTEM = `${MEMBER_AGENT_SYSTEM_PROMPT}

OPERATING MOMENT: Onboarding.
Conduct the four-chapter intake as a conversation, at the member's pace, in G4L voice:
1) who they were when they felt most themselves (a past self of ANY kind — writer, musician, runner, builder, teacher, parent — never assume it is athletic), 2) the gap (the Door that opened), 3) right now, 4) identity synthesis.
Use synthesize-propose-confirm for the identity noun: propose it from their OWN words (e.g. "It sounds like THE WRITER" / "THE RUNNER" / "THE MUSICIAN" — match what they said), and only treat it as set once they confirm. The reclaimed identity is whoever they name; the Rewire and Rebuild work (the health and wellness fundamentals) is the same path back regardless of who that is. Record identityNoun as the bare noun WITHOUT a leading "the/a/an".
Then gather the Reclaim List (exactly ${RECLAIM_LIST_SIZE} things they want back).
Finally, map their story to a "Door" — the life event that opened this chapter (the same gap they already described). Don't ask it cold: acknowledge their Reclaim List, then in one plain sentence say what a Door is and tie it back to what they told you, and present these eight so they can choose by number or name:
${DOORS.map((d, i) => `${i + 1}. ${d.displayName} — ${d.descriptor}`).join('\n')}
Ask ONE question per turn. Reflect before asking.

On EVERY turn you MUST also call the record_progress tool with everything gathered so far. Set complete=true only once all of these are gathered: athleticPast, gap, rightNow, a confirmed identityNoun, a reclaimList of exactly ${RECLAIM_LIST_SIZE}, and door.`;

const RECORD_PROGRESS_TOOL = {
  name: 'record_progress',
  description: 'Record the structured intake gathered so far. Call on every turn.',
  input_schema: {
    type: 'object' as const,
    properties: {
      athleticPast: { type: 'string' },
      gap: { type: 'string' },
      rightNow: { type: 'string' },
      identityNoun: { type: 'string', description: 'confirmed identity noun, uppercase' },
      reclaimList: { type: 'array', items: { type: 'string' } },
      door: { type: 'string', enum: [...DOOR_SLUGS] },
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
      collected = {
        ...collected,
        ...(p.athleticPast !== undefined && { athleticPast: p.athleticPast }),
        ...(p.gap !== undefined && { gap: p.gap }),
        ...(p.rightNow !== undefined && { rightNow: p.rightNow }),
        ...(p.identityNoun !== undefined && { identityNoun: p.identityNoun }),
        ...(Array.isArray(p.reclaimList) && { reclaimList: p.reclaimList }),
        ...(isDoorSlug(p.door) && { door: p.door }),
      };
      // Trust complete only when the hard requirements are actually present.
      complete = Boolean(p.complete) &&
        !!collected.athleticPast && !!collected.gap && !!collected.rightNow &&
        !!collected.identityNoun && collected.reclaimList?.length === RECLAIM_LIST_SIZE && !!collected.door;
    }
  }
  const stage: Stage = complete ? 'complete' : nextStage(collected);
  const finalReply = reply.trim() || STAGE_PROMPT[stage];
  return { reply: finalReply, state: { stage, collected }, complete };
}
