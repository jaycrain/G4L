// Seed-from-history: a one-shot curation pass that reads the member's completed Beats (their close
// responses) and proposes a handful of genuine keepers for the Playbook. Live Claude only; returns
// [] with no API key. Proposals only — the member still keeps/dismisses on the page.

const SECTIONS = ['what_works', 'why_works', 'own_words'] as const;
export type CuratedSection = (typeof SECTIONS)[number];
/** `keeperType` is what the line IS, and it decides the Playbook chapter — section is only the legacy fallback.
 *  Null means "the curator didn't say", which is not neutral: the line falls through to the "Who you are" chapter. */
export type CuratedKeeper = { section: CuratedSection; body: string; sourceLabel?: string; keeperType?: string | null };

export type BeatMaterial = { title: string; content: string; closeType: string; response: string };

const CURATE_SYSTEM = (identityNoun: string | null) =>
  `You are the member's G4L companion, curating their Playbook — their kept record of what's working — from the work they've already done. ${
    identityNoun ? `They are reclaiming the ${identityNoun}.` : ''
  }
You are given their completed Beats and the responses they wrote. Select only the GENUINE keepers — the few that are worth holding onto — and classify each:
- what_works — a reframe or tactic that is clearly working for them (in their voice).
- why_works — a piece of science/insight that genuinely convinced THEM (plain language, not a textbook).
- own_words — a line they actually said that is worth keeping; preserve their wording.
Rules: quality over quantity (0–6; fewer is fine). Skip filler, vague check-ins, and anything that isn't a real keeper. Phrase each tight and in the member's own spirit — never clinical, never praise. Give each a short source_label chip (e.g. "Rewire · Food as fuel" or the Beat's name). Return ONLY via the propose_keepers tool.`;

const KEEPERS_TOOL = {
  name: 'propose_keepers',
  description: 'Return the curated Playbook keepers selected from the member’s completed work.',
  input_schema: {
    type: 'object',
    properties: {
      keepers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            section: { type: 'string', enum: ['what_works', 'why_works', 'own_words'] },
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

export async function curateKeepersFromHistory(
  identityNoun: string | null,
  beats: BeatMaterial[],
): Promise<CuratedKeeper[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  const material = beats
    .filter((b) => b.response && b.response.trim())
    .map((b, i) => `${i + 1}. [${b.closeType}] Beat "${b.title}": ${b.content}\n   They wrote: "${b.response.trim()}"`)
    .join('\n\n');
  if (!material) return [];

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 25000, maxRetries: 1 });
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 900,
    system: CURATE_SYSTEM(identityNoun),
    tools: [KEEPERS_TOOL as any],
    tool_choice: { type: 'tool', name: 'propose_keepers' },
    messages: [{ role: 'user', content: `Here is the member's completed work. Select the genuine keepers.\n\n${material}` }],
  });
  const tu = res.content.find((b) => b.type === 'tool_use');
  if (!tu || tu.type !== 'tool_use') return [];
  const arr = (tu.input as any)?.keepers;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((k) => k && (SECTIONS as readonly string[]).includes(k.section) && typeof k.body === 'string' && k.body.trim())
    .slice(0, 6)
    .map((k) => ({
      section: k.section as CuratedSection,
      body: String(k.body).trim(),
      sourceLabel: typeof k.source_label === 'string' && k.source_label.trim() ? k.source_label.trim() : undefined,
    }));
}
