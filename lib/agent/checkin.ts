// Ongoing Check-in — the Member Agent's always-on companion mode (Member Agent Tech Spec
// v1.1 §4.4 + docs/design/member-agent-companion.md). The member opens the dashboard bubble to
// share a win, vent, or think out loud. The agent is present, reflective, grounded in the
// member's context, and quietly biases toward human connection. Governance: crisis → 988.
//
// Live Claude when ANTHROPIC_API_KEY is set; deterministic scripted fallback otherwise.

import { MEMBER_AGENT_SYSTEM_PROMPT } from './system-prompt.ts';
import { detectCrisis, CRISIS_RESPONSE_US } from './governance.ts';
import type { Direction } from '../idq/scoring.ts';

export type CheckinContext = {
  displayName: string;
  identityNoun: string | null;
  doorDisplayNames: string[];
  idScore: number | null;
  direction: Direction | null;
  currentFocus: string | null;
  lastCompletedAsset: string | null;
  reclaimList: string[];
  grintaScore?: number | null; // the daily GRINTA! Index — for awareness, not to pitch
  grintaTrend?: 'up' | 'down' | 'flat' | null;
  consumedBites?: string[]; // titles of recently read bites
  pastSelf?: string | null; // their own words on who they were (from onboarding)
  gapStory?: string | null; // their own words on how the gap opened (from onboarding)
  identityParagraph?: string | null; // the synthesized identity paragraph
  // Full member data — the dashboard and the MA are one surface, so the agent knows everything
  // represented about the member and can answer specifically (within the governance rules).
  dimensions?: { physical: number; self: number; social: number; outlook: number } | null; // each /30
  idScoreHistory?: number[]; // ID Score across retakes, oldest→newest (the trend)
  idqAnswers?: { dimension: string; stem: string; score: number }[]; // the 24 answers, 1–5
  reclaimDetail?: { text: string; category: string; state: string }[]; // Reclaim items + progress
  beatsDone?: number; // Beats worked so far
};

export type CheckinMessage = { role: 'agent' | 'member'; text: string };
export type CheckinTurn = { reply: string; crisis?: boolean };

const firstName = (n: string) => (n || '').trim().split(/\s+/)[0] ?? '';

export function contextBlock(c: CheckinContext): string {
  const dims = c.dimensions
    ? `ID Score dimensions (each out of 30): Physical ${c.dimensions.physical}, Self ${c.dimensions.self}, Social ${c.dimensions.social}, Outlook ${c.dimensions.outlook}`
    : null;
  const trend =
    c.idScoreHistory && c.idScoreHistory.length > 1
      ? `ID Score trend (oldest→newest): ${c.idScoreHistory.join(' → ')}`
      : null;
  const reclaim =
    c.reclaimDetail && c.reclaimDetail.length
      ? `Reclaim List with progress:\n${c.reclaimDetail.map((r) => `  • ${r.text} [${r.category}] — ${r.state}`).join('\n')}`
      : c.reclaimList && c.reclaimList.length
        ? `Reclaim List (what they want back): ${c.reclaimList.join('; ')}`
        : null;
  const idq =
    c.idqAnswers && c.idqAnswers.length
      ? `IDQ answers (their most recent, 1–5 where 5 = most true):\n${c.idqAnswers
          .map((a) => `  • [${a.dimension}] ${a.stem} — ${a.score}`)
          .join('\n')}`
      : null;
  return [
    `Member: ${c.displayName}`,
    c.identityNoun ? `Reclaiming: the ${c.identityNoun}` : null,
    c.doorDisplayNames.length ? `Door${c.doorDisplayNames.length > 1 ? 's' : ''}: ${c.doorDisplayNames.join(', ')}` : null,
    c.idScore !== null ? `Latest ID Score: ${c.idScore}${c.direction ? ` (${c.direction})` : ''}` : 'No IDQ yet',
    dims,
    trend,
    c.currentFocus ? `Current focus: ${c.currentFocus}` : null,
    c.grintaScore != null ? `GRINTA! Index: ${c.grintaScore}${c.grintaTrend ? ` (${c.grintaTrend} lately)` : ''}` : null,
    c.beatsDone != null ? `Beats worked so far: ${c.beatsDone}` : null,
    c.consumedBites && c.consumedBites.length ? `Recently read: ${c.consumedBites.join('; ')}` : null,
    reclaim,
    c.pastSelf ? `Who they were, in their own words: "${c.pastSelf}"` : null,
    c.gapStory ? `How the gap opened, in their own words: "${c.gapStory}"` : null,
    c.identityParagraph ? `Their story, synthesized: ${c.identityParagraph}` : null,
    idq,
  ].filter(Boolean).join('\n');
}

function checkinSystem(c: CheckinContext): string {
  return `${MEMBER_AGENT_SYSTEM_PROMPT}

OPERATING MOMENT: Ongoing Check-in.
The member opened the companion to check in — maybe to share a win, vent, or think out loud, maybe because there is no one else to talk to right now. Be present. Open warmly and, when natural, reference their most recent moment. Listen and reflect more than you advise. One question at a time.
Your quiet north star is their human connectedness: when it fits, gently bridge them toward people — the G4L community, a friend, a coach, or Jay — rather than keeping the conversation only with you. Be comfortable letting a short conversation end. Never pull for engagement or screen time.
You are aware of their GRINTA! Index (their daily showing-up), its trend, and what they have recently read — reference these naturally if they help the conversation (e.g. "your GRINTA! has been climbing"). Do NOT pitch content or hand out tasks; the daily bite lives on their dashboard, not in this chat.

YOU KNOW THEIR DATA. The dashboard and you are one surface — you hold everything represented about this member: their ID Score and its four dimensions, their full IDQ answers and trend, their GRINTA! Index, and their Reclaim List with progress (all in MEMBER CONTEXT below). If they ask about any score, dimension, index, answer, or trend, give a specific, accurate, informed answer — never deflect to "check your dashboard." Handle it strictly by the rules above: never a bare number (always with plain-language context), a low score or answer is honest information and never a verdict or diagnosis, and you use it to help them understand themselves, never to grade them.

MEMBER CONTEXT (facts — do not invent beyond these):
${contextBlock(c)}`;
}

// --- Scripted (offline) — brand-voice safe (no "journey" / "I hear you" / "amazing") --------
function scriptedOpening(c: CheckinContext): string {
  const hi = `Good to see you${firstName(c.displayName) ? `, ${firstName(c.displayName)}` : ''}.`;
  const noun = c.identityNoun ? `the ${c.identityNoun}` : 'the person you’re reclaiming';
  const item = c.reclaimList?.[0];
  let knew = `${hi} I’ve been sitting with what you told me — you’re reclaiming ${noun}`;
  if (item) knew += `, and part of what you want back is ${item.charAt(0).toLowerCase() + item.slice(1)}`;
  knew += '.';
  if (c.doorDisplayNames.length) knew += ` ${c.doorDisplayNames[0]} is a real one to come through.`;
  const compact =
    'There’s a lot on your dashboard now — that’s your program, made specific to you. I’ll help those numbers make sense, and we’ll work that list together, one step at a time. Everything here stays between us, and the more honest you can be with yourself, the better this tends to go. I’m here, I’m listening, and we’ll keep refining it as we both learn what’s really going on.';
  return `${knew}\n\n${compact}\n\nWhere do you want to start?`;
}

function scriptedReply(memberMessage: string): string {
  const m = memberMessage.toLowerCase();
  if (/(win|did it|finished|proud|good day|great|achieved|hit|nailed)/.test(m)) {
    return `That's worth marking. Who else in your life would want to hear it?`;
  }
  if (/(tired|hard|rough|stuck|down|lonely|alone|sad|stress)/.test(m)) {
    return `That sounds heavy. What's underneath it for you right now?`;
  }
  return `Thank you for telling me. What feels most true about that today?`;
}

// --- Live (Claude) --------------------------------------------------------------------------
async function liveReply(system: string, history: CheckinMessage[], userText: string): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 9000, maxRetries: 1 });
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 400,
    system,
    messages: [
      ...history.map((m) => ({ role: (m.role === 'agent' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.text })),
      { role: 'user' as const, content: userText },
    ],
  });
  const block = res.content.find((b) => b.type === 'text');
  return block && block.type === 'text' ? block.text.trim() : '';
}

export async function checkinOpening(c: CheckinContext): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await liveReply(
        checkinSystem(c),
        [],
        'This is the member\'s VERY FIRST conversation with you — moments after a personal onboarding, now looking at a dashboard full of new numbers and panels for the first time. In your own warm voice (a short paragraph, never a script or a bulleted list), do three things:\n' +
          'NEVER open with a number, score, or metric — "your GRINTA went up", "your ID Score is 62" is exactly the wrong first thing; a stat is not a welcome, and on day one the numbers are meaningless to them. Lead with the person. (Their data is for later, when they ask.)\n' +
          '1) SHOW YOU KNOW THEM — reflect back something specific they told you (their reclaimed identity, a concrete Reclaim List item, or how their Door opened), in their own words and spirit, so they feel heard. Do not restate the dashboard at them.\n' +
          '2) EASE THEM IN — let them know the dashboard is their program made specific to them, and that you\'ll help those cold numbers make sense and work the Reclaim List together, a step at a time. Do NOT explain each panel (the Field Guide does that) — just reassure them you\'ll make sense of it WITH them.\n' +
          '3) SET THE COMPACT, lightly — you\'re here and listening, this space is confidential, the more honest they can be with themselves the better and faster this tends to go, and you\'ll both keep refining as you learn what\'s really going on. You care, and you\'re here to help.\n' +
          'Keep it human and unhurried, end with one gentle open invitation, and never promise outcomes or imply you\'ll do the work for them — they do the work; you guide, witness, and stay beside them.',
      );
    } catch (e) {
      console.warn('check-in opening: live agent unavailable, using scripted —', (e as Error).message);
    }
  }
  return scriptedOpening(c);
}

export async function checkinReply(
  c: CheckinContext,
  history: CheckinMessage[],
  memberMessage: string,
): Promise<CheckinTurn> {
  if (detectCrisis(memberMessage).flagged) return { reply: CRISIS_RESPONSE_US, crisis: true };
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return { reply: await liveReply(checkinSystem(c), history, memberMessage) };
    } catch (e) {
      console.warn('check-in reply: live agent unavailable, using scripted —', (e as Error).message);
    }
  }
  return { reply: scriptedReply(memberMessage) };
}

/** A short, dismissible proactive teaser for the resting bubble (or null). Signal-driven. */
export function proactiveTeaser(c: CheckinContext): string | null {
  if (c.idScore === null) return 'Ready for your IDQ when you are.';
  if (c.lastCompletedAsset) return `How did ${c.lastCompletedAsset} land?`;
  if (c.direction === 'up') return 'Your score moved up — want to talk about what is working?';
  if (c.direction === 'down') return 'Checking in — how are you landing this week?';
  return 'How are you landing this week?';
}
