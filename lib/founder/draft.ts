// The Founder Agent — drafts Member-facing correspondence in Jay's voice (Founder Agent Tech
// Spec v1.0). It DRAFTS ONLY; Jay reviews/edits/approves/sends every message. No send path.
// Live Claude when ANTHROPIC_API_KEY is set; deterministic scripted fallback otherwise (and on
// any live failure — graceful degradation).
//
// NOTE: Jay's real writing corpus (Layer 2 — prior emails, book Part Three) is not wired yet;
// the voice here is described in the system prompt. The corpus drops in later for true fidelity.

import type { Direction } from '../idq/scoring.ts';

export type OperatingMoment =
  | 'post_idq_welcome'
  | 'retake_commentary'
  | 'milestone_commentary'
  | 'false_start_return'
  | 'cycle2_welcome';

export const MOMENTS: Record<OperatingMoment, { label: string; posture: string }> = {
  post_idq_welcome: {
    label: 'Welcome (post-IDQ)',
    posture:
      'Welcome them to the cycle. Acknowledge their intake in plain language, name their Door, and frame the work ahead. This is NOT a results email — no metrics. Warm, steady, personal. 6–10 sentences.',
  },
  retake_commentary: {
    label: 'Retake commentary',
    posture:
      'They just completed an IDQ retake. Name what moved in plain terms (the dashboard already shows the numbers). Reference their Door. Reflect movement — do not assign praise. Close with what is next. 8–14 sentences.',
  },
  milestone_commentary: {
    label: 'Milestone',
    posture:
      'Acknowledge a specific milestone or asset they completed. Tie it to their Door and the identity they are reclaiming. Measured tone — a milestone is evidence of work, not a celebration. 4–8 sentences.',
  },
  false_start_return: {
    label: 'False-start return',
    posture:
      'They slipped and have been away. Welcome them back with zero guilt or pressure. Normalize the false start — it is part of the work. Offer one small next step. Short.',
  },
  cycle2_welcome: {
    label: 'Cycle 2 welcome',
    posture:
      'A new Door has opened and they are beginning again. Acknowledge what they carry forward from last cycle. Frame Cycle 2 without making it feel like starting over. 6–10 sentences.',
  },
};

export type FounderContext = {
  firstName: string;
  identityNoun: string | null;
  doorDisplayName: string | null;
  idScore: number | null;
  direction: Direction | null;
  delta: number | null;
  currentFocus: string | null;
  lastCompletedAsset: string | null;
  intakeQuote: string | null;
};

export type Draft = { subject: string; body: string };

const FOUNDER_SYSTEM = `You are the Grinta for Life (G4L) Founder Agent. You draft Member-facing correspondence in the voice of Jay Crain, the founder, for Jay to review and send.

CRITICAL GOVERNANCE
- You DRAFT ONLY. You never send. Every draft is read, edited, and sent by Jay. Write as if Jay will send it as-is, but it is always his call.
- Never diagnose, label, or pathologize. Never reveal an ID Score as a bare number without plain-language, human context. Never pressure toward upgrades or purchases.

JAY'S VOICE
- Plain, measured, no hype. Call things what they are. Warm but direct — a friend who has been through it, not a coach or a marketer.
- Short sentences. Specific, never generic — ground every message in this member's own details (their Door, their words, what they just did).
- Reflective and normalizing, not motivational-pep. Reflect movement; don't hand out praise.
- Write in second person, to the member. Sign off simply as Jay.
- Use the real names: the 4Rs, IDQ, ID Score, the Door, the Reclaim List. No invented framing words.

Always call the draft_email tool with a subject line and the body. The body is plain text (no markdown), ready for Jay to read and send.`;

const firstNameOr = (c: FounderContext) => c.firstName || 'there';

// --- Scripted fallback (brand-safe, no banned phrases) --------------------------------------
function scriptedDraft(moment: OperatingMoment, c: FounderContext): Draft {
  const name = firstNameOr(c);
  const door = c.doorDisplayName ?? 'the door that opened';
  const noun = c.identityNoun ? `THE ${c.identityNoun}` : 'the person you are reclaiming';
  switch (moment) {
    case 'post_idq_welcome':
      return {
        subject: `${name} — welcome to G4L`,
        body: `${name},\n\nWelcome. You named ${door}, and you put words to where you are. That takes something.\n\nThe work ahead is steady, not dramatic. We start by getting reacquainted with ${noun}. Your first step is waiting on your dashboard.\n\nI read every welcome myself. Glad you're here.\n\n— Jay`,
      };
    case 'retake_commentary':
      return {
        subject: `${name} — your latest retake`,
        body: `${name},\n\nYour IDQ just landed. ${c.direction === 'up' ? 'Something moved in the right direction' : c.direction === 'down' ? 'A dip is information, not a failure' : 'You held steady'}. Set against ${door}, that matters.\n\nKeep going at your pace. Your next step is on your dashboard.\n\n— Jay`,
      };
    case 'milestone_commentary':
      return {
        subject: `${name} — that's worth noting`,
        body: `${name},\n\n${c.lastCompletedAsset ? `You finished ${c.lastCompletedAsset}.` : 'You hit a milestone.'} That's evidence of work, set against ${door}. ${noun} is a little closer.\n\n— Jay`,
      };
    case 'false_start_return':
      return {
        subject: `${name} — good to see you back`,
        body: `${name},\n\nYou stepped away for a bit. That happens — it's built into the work, not a mark against you. No need to make up for lost time.\n\nOne small step is enough to be back in it. It's on your dashboard when you're ready.\n\n— Jay`,
      };
    case 'cycle2_welcome':
      return {
        subject: `${name} — Cycle 2 begins`,
        body: `${name},\n\nA new Door has opened, and you're starting again — but not from zero. What you built last cycle comes with you.\n\nWe'll work across ${door} this time. Steady as before.\n\n— Jay`,
      };
  }
}

// --- Live (Claude tool-use) -----------------------------------------------------------------
const DRAFT_TOOL = {
  name: 'draft_email',
  description: 'Return the drafted message for Jay to review.',
  input_schema: {
    type: 'object' as const,
    properties: { subject: { type: 'string' }, body: { type: 'string' } },
    required: ['subject', 'body'],
  },
};

function contextLines(c: FounderContext): string {
  return [
    `First name: ${c.firstName || '(unknown)'}`,
    c.identityNoun ? `Reclaiming: THE ${c.identityNoun}` : null,
    c.doorDisplayName ? `Door: ${c.doorDisplayName}` : null,
    c.idScore !== null ? `Latest ID Score: ${c.idScore}${c.direction ? ` (${c.direction}${c.delta != null ? `, ${c.delta > 0 ? '+' : ''}${c.delta}` : ''})` : ''}` : 'No IDQ yet',
    c.currentFocus ? `Current focus: ${c.currentFocus}` : null,
    c.lastCompletedAsset ? `Most recent asset: ${c.lastCompletedAsset}` : null,
    c.intakeQuote ? `Their intake words: "${c.intakeQuote}"` : null,
  ].filter(Boolean).join('\n');
}

async function liveDraft(moment: OperatingMoment, c: FounderContext): Promise<Draft> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 12000, maxRetries: 1 });
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 700,
    system: FOUNDER_SYSTEM,
    tools: [DRAFT_TOOL],
    tool_choice: { type: 'tool', name: 'draft_email' },
    messages: [
      {
        role: 'user',
        content:
          `Draft this message in Jay's voice.\n\nMOMENT: ${MOMENTS[moment].label}\nWHAT TO DO: ${MOMENTS[moment].posture}\n\nMEMBER CONTEXT (use only these facts):\n${contextLines(c)}`,
      },
    ],
  });
  const tool = res.content.find((b) => b.type === 'tool_use');
  if (tool && tool.type === 'tool_use') {
    const input = tool.input as Partial<Draft>;
    if (input.subject && input.body) return { subject: input.subject, body: input.body };
  }
  throw new Error('no draft returned');
}

export async function generateDraft(moment: OperatingMoment, c: FounderContext): Promise<Draft> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await liveDraft(moment, c);
    } catch (e) {
      console.warn('founder draft: live agent unavailable, using scripted —', (e as Error).message);
    }
  }
  return scriptedDraft(moment, c);
}
