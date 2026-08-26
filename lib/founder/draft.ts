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

// ── THE VOICE BLOCK — prepended to EVERY posture ────────────────────────────────────────────────────────
//
// Cowork's rework, 2026-08-02, after Jay read the LIVE drafts in the app: full of "it's not X, it's Y", and
// not sounding like him. Their root-cause read is the one that matters — several postures MODELLED the
// negation themselves ("a milestone is evidence of work, not a celebration"), so the model copied it. The fix
// had to be at the posture level, because the posture governs the live draft, which is what members actually
// receive. Editing the samples alone would have fixed the shop window and left the shop.
//
// ONE CONSTANT, PREPENDED, rather than pasted into six strings. Cowork said "prepend to every posture";
// doing that by hand means six copies of a rule set that must never drift apart, and the seventh moment
// anyone adds ships without it.
const VOICE = [
  "Write as Jay Crain, founder to member, one person who's been there to another. His voice: short sentences",
  "and deliberate fragments; land a beat, then stop. Concrete over abstract - their Door, their own words,",
  "their next step. First person, straight to them. Warmth earned through specifics, never announced. End on",
  "one short line that lands.",
  "HARD RULES: NEVER use the \"it's not X, it's Y\" construction - say what a thing IS. Keep a negation ONLY",
  "when it lifts shame or false fear (\"a hundred reasonable decisions, not a failing\"). Never use: \"honest /",
  "honestly\", \"name it / naming\" (say \"call it\"), \"quiet / quietly\", \"sit with\", \"genuinely\", \"lean in\", or",
  "any hype or cliche. No stacked em-dash contrasts. Short. Real.",
].join(' ');

export const MOMENTS: Record<OperatingMoment, { label: string; posture: string }> = {
  post_idq_welcome: {
    label: 'Welcome (post-IDQ)',
    posture:
      `${VOICE} Welcome them to the program, founder to member. Say plainly where they are - call their Door by name, and reflect the Reclaim List item they most want back, in their own words. Point them to the first step on their dashboard. No metrics. 6-9 short sentences. End warm and short.`,
  },
  retake_commentary: {
    label: 'Retake commentary',
    posture:
      `${VOICE} They just retook the IDQ. Say what moved in plain words - the dashboard shows the numbers, so no metrics here. Tie it to their Door. Reflect the movement; skip praise and grades. Point to what's next. 6-10 short sentences.`,
  },
  milestone_commentary: {
    label: 'Milestone',
    posture:
      `${VOICE} Acknowledge a specific asset or milestone they finished. Call their Door by name and tie it to the self they're reclaiming. Measured - mark the work, skip the confetti. 4-7 short sentences.`,
  },
  false_start_return: {
    label: 'False-start return',
    posture:
      `${VOICE} They slipped and have been away. Welcome them back with zero guilt. A false start is part of the work - keep that one shame-lifting note and nothing heavier. Offer one small next step. Short - 3-5 sentences.`,
  },
  gone_quiet: {
    label: 'Gone quiet',
    posture:
      `${VOICE} They've been away a while and haven't said why. Assume no reason. Imply no debt. The Fade is a hundred reasonable decisions, not a failing - so never suggest they've fallen behind. Reflect one thing they told you they wanted back, in their words, so it reads as remembered. Leave the door open, expect nothing. 3-5 short sentences.`,
  },
  goal_reclaimed: {
    label: 'Goal reclaimed',
    posture:
      `${VOICE} They marked a Reclaim List item reclaimed - the thing the whole program points at. Call the item by name, in their words. Reflect what it took, and let them be the authority on what it meant, so skip grades and 'wins'. Don't point at the next goal - let this land. 3-6 short sentences.`,
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
// EXPORTED so the Cowork bundle can RENDER these rather than shipping the template strings. They are
// authored, deterministic copy a member can actually receive (whenever the live agent is unavailable), so
// they are quotable — but only once interpolated. `${name}` in a marketing doc helps nobody.
/** "the Swimmer" is right mid-sentence and wrong at the start of one. Caught by RENDERING these for the Cowork
 *  bundle — the template read fine; the email said "…set against The Career Cliff. the Swimmer is a little
 *  closer." Interpolated copy has to be read as copy, which is the argument for rendering it at all. */
import { sentenceStart } from '../content/member-words.ts'; // one definition — see the note there

export function scriptedDraft(moment: OperatingMoment, c: FounderContext): Draft {
  const name = firstNameOr(c);
  const door = c.doorDisplayNames.length ? c.doorDisplayNames.join(' and ') : 'the door that opened';
  const noun = c.identityNoun ? `the ${c.identityNoun}` : 'the person you are reclaiming';
  const list = c.reclaimList ?? [];
  const reclaimBit = list.length
    ? ` And you told me what you want back${list[0] ? ` — starting with “${list[0]}”` : ''}. That's your Reclaim List. That's what we work toward.`
    : '';
  switch (moment) {
    case 'post_idq_welcome':
      return {
        subject: `${name} — welcome to G4L`,
        body: `${name},\n\nYou made it through the IDQ. Most people circle that for years and never sit down to do it. You did.\n\nYou called it ${door}.${reclaimBit}\n\nFirst step's on your dashboard. Start there, at your pace.\n\nI read every welcome myself. Glad you're here.\n\n— Jay`,
      };
    case 'retake_commentary':
      return {
        subject: `${name} — your latest retake`,
        body: `${name},\n\nYour IDQ landed. ${c.direction === 'up' ? 'It moved the right way' : c.direction === 'down' ? 'It moved down. A dip is information, not a failing' : 'It held steady'}. Against ${door}, that's real ground.\n\nYou did that — one call at a time.\n\nNext step's on your dashboard when you want it.\n\n— Jay`,
      };
    case 'milestone_commentary':
      return {
        subject: `${name} — that's worth noting`,
        body: `${name},\n\n${c.lastCompletedAsset ? `You finished ${c.lastCompletedAsset}.` : 'You hit a milestone.'} That's work, and it counts — against ${door}, it counts double.\n\n${sentenceStart(noun)} is a little closer than last week.\n\n— Jay`,
      };
    case 'false_start_return':
      return {
        subject: `${name} — good to see you back`,
        body: `${name},\n\nGood to see you back. Stepping away happens — it's built into this, never a mark against you. No making up for lost time.\n\nOne small step and you're back in it. It's on your dashboard when you're ready.\n\n— Jay`,
      };
    case 'gone_quiet':
      return {
        subject: `${name} — no agenda`,
        body: `${name},\n\nBeen a while. No agenda here — life gets loud, and that's most of what this is about.\n\n${list[0] ? `You told me you wanted “${list[0]}” back. That's still here when you are.` : `What you called out is still here when you are.`}\n\n— Jay`,
      };
    case 'goal_reclaimed':
      return {
        subject: `${name} — you got one back`,
        body: `${name},\n\nYou got one back.${list[0] ? ` ${sentenceStart(list[0])} — you called it, and you did it.` : ''} Against ${door}, that's the whole point of this.\n\nNothing else from me today. I saw it, and I wanted you to know.\n\n— Jay`,
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
