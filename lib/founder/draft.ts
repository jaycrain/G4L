// The Founder Agent — drafts Member-facing correspondence in Jay's voice (Founder Agent Tech
// Spec v1.0). It DRAFTS ONLY; Jay reviews/edits/approves/sends every message. No send path.
// Live Claude when ANTHROPIC_API_KEY is set; deterministic scripted fallback otherwise (and on
// any live failure — graceful degradation).
//
// SCOPE (see docs/founder-agent-reconcile.md): these are v1.0's FIVE event-driven DRAFT moments.
// v1.0's sixth moment — Ambient Educational Surfacing — is "library, not draft" (the dashboard
// educational layer), a separate concern, not a gap here. v2.0 (cross-tenant admin) is dated
// July 2027 / Stage 2–3 and is correctly NOT built now (architecture #3: dormant at launch).
//
// NOTE: Jay's real writing corpus (Layer 2 — prior emails, book Part Three) is not wired yet;
// the voice here is described in the system prompt. The corpus drops in later for true fidelity.

import type { Direction } from '../idq/scoring.ts';

// RETIRED 2026-07-31: 'cycle2_welcome'. It drafted an email built entirely on the Loop — "a new Door has
// opened, you're starting again, what you built last cycle comes with you." The Loop gate is OFF in production
// and the 60-day rule is still a Greg-and-Jay placeholder, so clicking it wrote confidently about a member's
// "last cycle" when there had never been one. Bring it back the day the Loop ships, with the wording checked
// against whatever the Loop actually turns out to be.
export type OperatingMoment =
  | 'post_idq_welcome'
  | 'retake_commentary'
  | 'milestone_commentary'
  | 'false_start_return'
  | 'gone_quiet'
  | 'goal_reclaimed';

export const MOMENTS: Record<OperatingMoment, { label: string; posture: string }> = {
  post_idq_welcome: {
    label: 'Welcome (post-IDQ)',
    posture:
      'Welcome them to the program. Acknowledge their intake in plain language, name their Door, and frame the work ahead. This is NOT a results email — no metrics. Warm, steady, personal. 6–10 sentences.',
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
  gone_quiet: {
    label: 'Gone quiet',
    posture:
      'They have not been back in a while and have NOT told you why. Do not assume a reason, do not imply they owe you anything, and never suggest they have fallen behind — the Fade is a hundred reasonable decisions, not a failing. Reference one specific thing they told you they wanted back, so it reads as being remembered rather than chased. Leave the door open and expect nothing. Short — 3–5 sentences.',
  },
  goal_reclaimed: {
    label: 'Goal reclaimed',
    posture:
      'They marked something on their Reclaim List as reclaimed — the thing the whole program works toward. Name the specific item in their own words. Reflect what it took without grading it or calling it a win; they are the authority on what it meant. Do not immediately point at the next goal — let this one land. 3–6 sentences.',
  },
};

export type FounderContext = {
  firstName: string;
  identityNoun: string | null;
  doorDisplayNames: string[];
  reclaimList?: string[];
  idScore: number | null;
  direction: Direction | null;
  delta: number | null;
  currentFocus: string | null;
  lastCompletedAsset: string | null;
  intakeQuote: string | null;
  experienceSummary?: string | null; // how they've moved through the program (telemetry) — reflect, never grade
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
  const door = c.doorDisplayNames.length ? c.doorDisplayNames.join(' and ') : 'the door that opened';
  const noun = c.identityNoun ? `the ${c.identityNoun}` : 'the person you are reclaiming';
  const list = c.reclaimList ?? [];
  const reclaimBit = list.length
    ? ` You also named ${list.length} thing${list.length === 1 ? '' : 's'} you want back${list[0] ? ` — starting with “${list[0]}”` : ''}. That's your Reclaim List, and it's what we work toward.`
    : '';
  switch (moment) {
    case 'post_idq_welcome':
      return {
        subject: `${name} — welcome to G4L`,
        body: `${name},\n\nWelcome. You named ${door}, and you put words to where you are.${reclaimBit} That takes something.\n\nThe work ahead is steady, not dramatic. We start by getting reacquainted with ${noun}. Your first step is waiting on your dashboard.\n\nI read every welcome myself. Glad you're here.\n\n— Jay`,
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
    case 'gone_quiet':
      return {
        subject: `${name} — no agenda`,
        body: `${name},\n\nYou've been away a bit. No agenda here — life gets loud, and that's most of what this program is about.\n\n${list[0] ? `You told me you wanted “${list[0]}” back. That's still there when you are.` : `What you named is still there when you are.`}\n\n— Jay`,
      };
    case 'goal_reclaimed':
      return {
        subject: `${name} — you got one back`,
        body: `${name},\n\nYou marked one reclaimed. That's the thing this whole program is pointed at, and you did it against ${door}.\n\nNo next step from me today. Just wanted you to know I saw it.\n\n— Jay`,
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
    c.identityNoun ? `Reclaiming: the ${c.identityNoun}` : null,
    c.doorDisplayNames.length ? `Door${c.doorDisplayNames.length > 1 ? 's' : ''}: ${c.doorDisplayNames.join(', ')}` : null,
    c.reclaimList?.length ? `Reclaim List: ${c.reclaimList.join('; ')}` : null,
    c.idScore !== null ? `Latest ID Score: ${c.idScore}${c.direction ? ` (${c.direction}${c.delta != null ? `, ${c.delta > 0 ? '+' : ''}${c.delta}` : ''})` : ''}` : 'No IDQ yet',
    c.currentFocus ? `Current focus: ${c.currentFocus}` : null,
    c.lastCompletedAsset ? `Most recent asset: ${c.lastCompletedAsset}` : null,
    c.experienceSummary ? `How they've moved through the program (reflect, don't grade): ${c.experienceSummary}` : null,
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
