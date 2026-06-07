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
  doorDisplayName: string | null;
  idScore: number | null;
  direction: Direction | null;
  currentFocus: string | null;
  lastCompletedAsset: string | null;
  reclaimList: string[];
};

export type CheckinMessage = { role: 'agent' | 'member'; text: string };
export type CheckinTurn = { reply: string; crisis?: boolean };

const firstName = (n: string) => (n || '').trim().split(/\s+/)[0] ?? '';

function contextBlock(c: CheckinContext): string {
  return [
    `Member: ${c.displayName}`,
    c.identityNoun ? `Reclaiming: THE ${c.identityNoun}` : null,
    c.doorDisplayName ? `Door: ${c.doorDisplayName}` : null,
    c.idScore !== null ? `Latest ID Score: ${c.idScore}${c.direction ? ` (${c.direction})` : ''}` : 'No IDQ yet',
    c.currentFocus ? `Current focus: ${c.currentFocus}` : null,
    c.lastCompletedAsset ? `Most recent asset: ${c.lastCompletedAsset}` : null,
  ].filter(Boolean).join('\n');
}

function checkinSystem(c: CheckinContext): string {
  return `${MEMBER_AGENT_SYSTEM_PROMPT}

OPERATING MOMENT: Ongoing Check-in.
The member opened the companion to check in — maybe to share a win, vent, or think out loud, maybe because there is no one else to talk to right now. Be present. Open warmly and, when natural, reference their most recent moment. Listen and reflect more than you advise. One question at a time.
Your quiet north star is their human connectedness: when it fits, gently bridge them toward people — the G4L community, a friend, a coach, or Jay — rather than keeping the conversation only with you. Be comfortable letting a short conversation end. Never pull for engagement or screen time.

MEMBER CONTEXT (facts — do not invent beyond these):
${contextBlock(c)}`;
}

// --- Scripted (offline) — brand-voice safe (no "journey" / "I hear you" / "amazing") --------
function scriptedOpening(c: CheckinContext): string {
  const name = firstName(c.displayName);
  if (c.lastCompletedAsset) return `Good to see you${name ? `, ${name}` : ''}. You just finished ${c.lastCompletedAsset} — how did it land?`;
  if (c.idScore === null) return `Good to see you${name ? `, ${name}` : ''}. What's on your mind today?`;
  return `Good to see you${name ? `, ${name}` : ''}. What's on your mind today?`;
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
        'The member just opened the check-in and has not said anything yet. Greet them warmly in G4L voice, reference their recent context if there is any, and ask one gentle opening question.',
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
