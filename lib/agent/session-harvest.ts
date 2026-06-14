// Session harvest — when a member completes a guided Session (Identity Excavation onward), a live MA
// pass reads what they actually WROTE and proposes keepers for their Playbook. Identity work is dense
// and worth holding onto, so this captures their own lines (the scene, who they were, the self they
// named) generously into own_words, plus any realization into what_works. Mirrors the onboarding
// harvest (docs/playbook.md): proposals only — the member keeps/dismisses on the page. Live Claude
// only; returns [] / no-ops with no API key. Best-effort: never breaks a Session close.

import type { Db } from '../db/schema.ts';
import type { Asset } from '../curriculum/types.ts';
import type { CuratedKeeper } from './playbook-curate.ts';
import { listFacets } from '../curriculum/store.ts';
import { proposeEntry } from '../playbook/store.ts';

const SECTIONS = ['what_works', 'why_works', 'own_words'] as const;

export type SessionReflection = { prompt: string; answer: string };

const HARVEST_SYSTEM = (sessionTitle: string, selves: string[]) =>
  `You are the member's G4L companion. They just completed "${sessionTitle}" — a guided identity exercise — and you are curating keepers for their Playbook from what they actually wrote.${
    selves.length ? ` The self/selves they named: ${selves.join(', ')}.` : ''
  }
Classify each keeper:
- own_words — a line they actually wrote that is worth holding onto, in THEIR wording (the scene that lit them up, who they were, the story they told, the self they named). This is the heart of an identity Session — be generous here; these are dense, personal lines they will want to revisit.
- what_works — a realization or reframe that is clearly theirs and already shifting how they see themselves.
- why_works — a piece of science/insight that genuinely landed (rare here; only if real).
Rules: quality over quantity (0–6; fewer is fine). Preserve their voice — never clinical, never praise, never generic. Pick the lines that would make them feel SEEN when they reopen their Playbook. Give each a short source_label chip (default "From ${sessionTitle}"). Return ONLY via the propose_keepers tool.`;

const KEEPERS_TOOL = {
  name: 'propose_keepers',
  description: 'Return the curated Playbook keepers selected from the Session the member just completed.',
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

export async function curateKeepersFromSession(
  sessionTitle: string,
  selves: string[],
  reflections: SessionReflection[],
): Promise<CuratedKeeper[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  const material = reflections
    .filter((r) => r.answer && r.answer.trim())
    .map((r) => `Asked: ${r.prompt}\nThey wrote: ${r.answer.trim()}`)
    .join('\n\n');
  if (!material.trim()) return [];

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 25000, maxRetries: 2 });
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 900,
    system: HARVEST_SYSTEM(sessionTitle, selves),
    tools: [KEEPERS_TOOL as any],
    tool_choice: { type: 'tool', name: 'propose_keepers' },
    messages: [{ role: 'user', content: `Here is what the member wrote in "${sessionTitle}". Select the genuine keepers for their Playbook.\n\n${material}` }],
  });
  const tu = res.content.find((b) => b.type === 'tool_use');
  if (!tu || tu.type !== 'tool_use') return [];
  const arr = (tu.input as any)?.keepers;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((k) => k && (SECTIONS as readonly string[]).includes(k.section) && typeof k.body === 'string' && k.body.trim())
    .slice(0, 6)
    .map((k) => ({
      section: k.section as CuratedKeeper['section'],
      body: String(k.body).trim(),
      sourceLabel: typeof k.source_label === 'string' && k.source_label.trim() ? k.source_label.trim() : `From ${sessionTitle}`,
    }));
}

/** Read the just-closed Session's reflections, curate keepers, and file them in the Playbook as
 * proposals the member curates. Best-effort: returns the count filed; never throws into the close. */
export async function harvestSessionToPlaybook(db: Db, memberId: string, session: Asset, answers: Record<string, string>): Promise<number> {
  try {
    const reflections: SessionReflection[] = (session.steps ?? [])
      .filter((s) => (answers[String(s.n)] ?? '').trim())
      .map((s) => ({ prompt: s.prompt, answer: answers[String(s.n)]!.trim() }));
    if (!reflections.length) return 0;
    const selves = (await listFacets(db, memberId)).map((f) => f.text);
    const keepers = await curateKeepersFromSession(session.title, selves, reflections);
    let filed = 0;
    for (const k of keepers) {
      await proposeEntry(db, memberId, { section: k.section, body: k.body, source: { kind: 'session', label: k.sourceLabel } });
      filed++;
    }
    return filed;
  } catch {
    return 0; // a harvest hiccup never fails a Session close
  }
}
