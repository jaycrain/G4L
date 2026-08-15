// CATEGORISE A CONFIRMED RECLAIM LIST — the upgrade lib/beats/category.ts has been waiting for.
//
// That file's own header says it: "v1 is a keyword heuristic so the slice has categorized items today; the real
// version is the Member Agent inferring category during the onboarding shaping conversation. Flagged for
// upgrade." The upgrade shipped in the PROMPT — onboarding still instructs the model to assign a category per
// item — but never in the PATH. The Reclaim List became a structured builder, the builder sets every category to
// '' with the comment "assigned later", and there was no later. So every member's list has been falling through
// to the v1 keyword heuristic, permanently, on the most important list in the product.
//
// FOUND BY RUNNING THE FALLBACK OVER A REAL PERSONA WALK (2026-08-15). Joanne is an open-water swimmer; the
// centre of the identity she is reclaiming is "Getting in the ocean regularly." The keyword list has `swim` but
// not `ocean`, so her flagship PHYSICAL goal was tagged `self` — and category selects which Beats she is served
// (lib/beats/serves.ts), so she would be fed identity content for the one thing she came back for.
//
// ── WHY HERE, AND NOT IN THE CONVERSATION ─────────────────────────────────────────────────────────────────
// This runs at PERSISTENCE, not inside the capture loop. The list is already final and member-confirmed by the
// time it lands, so there is nothing to race and no turn to derail — and the standing rule on lib/agent/
// onboarding.ts is to default to not touching it. One call, off the conversational path, after the member has
// already said "this is me".
//
// ── IT CAN NEVER COST THEM THEIR SIGNUP ───────────────────────────────────────────────────────────────────
// A category is metadata. No key, a timeout, a malformed answer, the wrong number of items — every one of those
// degrades to the keyword heuristic for the items it could not resolve, and the member's list is written either
// way. Same rule as telemetry: a measurement may fail, the member's record may not (lib/db/best-effort.ts).

import { CATEGORIES, isCategory, type Category } from './registry.ts';
import { inferCategory } from './category.ts';

/** What the model is told each dimension MEANS — the same definitions the onboarding prompt uses, so the two
 *  paths cannot drift into disagreeing about what "self" covers. */
const GUIDE = [
  'physical — body, movement, food, sleep, energy',
  'self — identity, who they are, their own creative work, self-knowledge',
  'social — people, relationships, family, friends, belonging, community',
  'outlook — purpose, the future, mindset, adventure, what is next',
  'life — any goal that does not map to a dimension: money, a venture, savings, a milestone',
].join('\n');

/**
 * One category per item, index-locked to the input.
 *
 * Returns keyword-inferred categories unchanged when there is no API key, so tests and offline runs behave
 * exactly as they did before this existed.
 */
export async function categorizeReclaimItems(texts: string[]): Promise<Category[]> {
  const fallback = texts.map((t) => inferCategory(t));
  if (!texts.length || !process.env.ANTHROPIC_API_KEY) return fallback;

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 16000, maxRetries: 1 });
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
    const sys =
      'You tag each item on a member\'s Reclaim List with the ONE area it belongs to. Judge the item by what the ' +
      'member would actually DO, not by the words it happens to use — "getting in the ocean" is physical because ' +
      'it is swimming. When an item genuinely spans two areas, choose the one the ACTIVITY lives in. This tag is ' +
      'internal routing and is never shown to the member.\n\n' +
      `The areas:\n${GUIDE}\n\n` +
      'Return one category per item, in the SAME ORDER, the same length as the input.';
    const user = texts.map((t, i) => `${i + 1}. ${t}`).join('\n');

    const res = await client.messages.create({
      model,
      max_tokens: 300,
      system: sys,
      tools: [
        {
          name: 'set_categories',
          description: 'One category per Reclaim item, in the order given.',
          input_schema: {
            type: 'object',
            properties: { categories: { type: 'array', items: { type: 'string', enum: [...CATEGORIES] } } },
            required: ['categories'],
          },
        } as never,
      ],
      tool_choice: { type: 'tool', name: 'set_categories' } as never,
      messages: [{ role: 'user', content: user }],
    });

    const tu = res.content.find((b) => b.type === 'tool_use');
    const raw = tu && tu.type === 'tool_use' ? (tu.input as { categories?: unknown }).categories : null;
    const got = Array.isArray(raw) ? raw : [];

    // PER-ITEM, NOT ALL-OR-NOTHING. A short array or one bad value only costs the items it actually affected;
    // the rest keep the model's read. Index-locked, so a dropped element can never shift another item's tag
    // onto the wrong goal — the failure that would be invisible and wrong rather than visible and missing.
    const out = texts.map((t, i) => (isCategory(got[i]) ? (got[i] as Category) : fallback[i]!));
    const missed = out.filter((c, i) => !isCategory(got[i])).length;
    if (missed) console.warn(`reclaim categorize: ${missed}/${texts.length} fell back to the keyword heuristic`);
    return out;
  } catch (e) {
    // LOG IT. A silent catch here made a TOTAL failure look like agreement: while building this, the API was
    // unreachable from the sandbox and every item came back matching the keyword heuristic exactly — which
    // reads as "the model concurs" and is really "the model never answered". I nearly reported it that way.
    // A categoriser that has quietly been degrading for a month is indistinguishable from one that works,
    // unless it says so. Same rule as activeQualityDayProfile: assert-or-log, never a bare catch on a read
    // whose result something downstream trusts.
    console.warn('reclaim categorize: model unavailable, using the keyword heuristic —', (e as Error).message);
    return fallback;
  }
}
