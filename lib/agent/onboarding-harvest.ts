// Onboarding harvest — the seeds for the Playbook's first pages (see docs/ceremony-threshold.md, Q1).
// At onboarding finalize, a live MA pass reads the ACTUAL onboarding transcript and proposes a few
// keepers — the member's own best lines, the cost of the Fade, the protagonist line. These become the
// Playbook's opening entries (proposals the member resolves) and the Threshold's Beat 4 preview.
// Live Claude only; returns [] with no API key. Proposals only — never auto-kept.

import type { ConvMessage } from './onboarding.ts';
import type { CuratedKeeper } from './playbook-curate.ts';

const SECTIONS = ['what_works', 'why_works', 'own_words'] as const;

const HARVEST_SYSTEM = (identityNoun: string | null) =>
  `You are the member's G4L companion. They just finished a deep onboarding conversation where they uncovered who they're reclaiming${
    identityNoun ? ` (the ${identityNoun})` : ''
  }, how their gap opened (their Door), and what they want back. Curate the FIRST pages of their Playbook from THIS conversation.
Select only genuine keepers — the lines worth holding onto:
- own_words — something they actually said that's worth keeping; preserve their wording. This is the heart of the onboarding harvest (their best, truest lines about who they are, what they lost, what they want back).
- what_works — a reframe or realization that's clearly theirs and already shifting how they see it.
- why_works — a piece of science/insight that genuinely landed (rare this early; only if real).
Rules: quality over quantity (0–5; fewer is fine). Pick the lines that would make them feel SEEN when shown back at their first dashboard moment. Skip logistics, the AI disclosure, and anything generic. Never clinical, never praise. Give each a short source_label chip (e.g. "From your onboarding" or the moment it came from). Return ONLY via the propose_keepers tool.`;

const KEEPERS_TOOL = {
  name: 'propose_keepers',
  description: 'Return the curated Playbook keepers selected from the onboarding conversation.',
  input_schema: {
    type: 'object',
    properties: {
      keepers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            section: { type: 'string', enum: ['what_works', 'why_works', 'own_words'] },
            keeper_type: {
              type: 'string',
              enum: ['definition', 'lights_you_up', 'tell', 'principle', 'recovery_move'],
              description:
                "What this line IS — it decides which chapter of their Playbook it lands in, so choose carefully. " +
                "definition = who they are or were ('I was a competitive cyclist'). lights_you_up = what still moves " +
                "them, what they light up about. tell = a sign they're drifting, a pattern worth catching early. " +
                "principle = a reframe or truth they landed on that they can use again. recovery_move = a concrete " +
                "move that gets them back on track. If a line is a GOAL or something they want back, do not return " +
                "it — that belongs on their Reclaim List, not the Playbook.",
            },
            body: { type: 'string' },
            source_label: { type: 'string' },
          },
          required: ['section', 'body'],
        },
      },
    },
    required: ['keepers'],
  },
};

export async function curateKeepersFromOnboarding(
  identityNoun: string | null,
  transcript: ConvMessage[],
): Promise<CuratedKeeper[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  const material = transcript
    .filter((m) => m.text && m.text.trim())
    .map((m) => `${m.role === 'member' ? 'Member' : 'Companion'}: ${m.text.trim()}`)
    .join('\n');
  if (!material.trim()) return [];

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 25000, maxRetries: 1 });
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 900,
    system: HARVEST_SYSTEM(identityNoun),
    tools: [KEEPERS_TOOL as any],
    tool_choice: { type: 'tool', name: 'propose_keepers' },
    messages: [{ role: 'user', content: `Here is the member's onboarding conversation. Select the genuine keepers for their Playbook.\n\n${material}` }],
  });
  const tu = res.content.find((b) => b.type === 'tool_use');
  if (!tu || tu.type !== 'tool_use') return [];
  const arr = (tu.input as any)?.keepers;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((k) => k && (SECTIONS as readonly string[]).includes(k.section) && typeof k.body === 'string' && k.body.trim())
    .slice(0, 5)
    .map((k) => ({
      section: k.section as CuratedKeeper['section'],
      keeperType: typeof k.keeper_type === 'string' ? k.keeper_type : null,
      body: String(k.body).trim(),
      sourceLabel: typeof k.source_label === 'string' && k.source_label.trim() ? k.source_label.trim() : 'From your onboarding',
    }));
}
