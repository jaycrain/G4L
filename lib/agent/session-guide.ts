// The companion threaded through a Session (Give-Back Model v0.4 — "guide a Session"). For the lit
// (current) step it speaks a short framing that reflects what the member just said, frames this step,
// and pushes — warmly — for honest depth. Live Claude when available; the registry's authored
// companion_frame is the reliable fallback (never a broken or empty frame).
import type { Step } from '../curriculum/types.ts';
import { detectCrisis, CRISIS_RESPONSE_US } from './governance.ts';

export type PriorAnswer = { title: string; prompt: string; answer: string };

export type GuideInput = {
  sessionTitle: string;
  step: Step;
  priorAnswers: PriorAnswer[];
  displayName: string;
  memory?: string | null;
  existingFacets?: string[]; // selves already named (onboarding seed + earlier Sessions)
  existingDoors?: string[]; // Doors onboarding seeded — the Doors Session refines them (Option A+)
};

const SYSTEM =
  'You are the G4L Member Agent, guiding a member through a Session — a real guided exercise, with you threaded through it. ' +
  'Voice: warm, plain, second-person; tough love that RESPECTS — firm belief in them, never shaming, never hype, never grading. ' +
  'For the CURRENT step, speak a SHORT framing (2–4 sentences) that: (a) if there are prior answers, briefly reflects or affirms what they just said, in their own spirit; (b) frames what this step is and what to do; (c) gently pushes for honest depth. ' +
  'Do not answer for them. Do not list. Output ONLY the spoken framing — no preamble.';

export async function guideSessionStep(input: GuideInput): Promise<string> {
  const fallback = input.step.companion_frame;
  if (!process.env.ANTHROPIC_API_KEY) return fallback;
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 16000, maxRetries: 1 });
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
    const prior = input.priorAnswers.length
      ? input.priorAnswers.map((p) => `Step "${p.title}" — asked: ${p.prompt}\nThey answered: ${p.answer}`).join('\n\n')
      : '(this is the first step)';
    // At a facet-naming step, tell the companion what the member has already named so it elicits a
    // CLEAN, DISTINCT self — sharpen an existing one or surface a new one — never a restatement.
    const facetNote =
      input.step.contributes === 'facet' && input.existingFacets?.length
        ? `\nThey have ALREADY named these selves: ${input.existingFacets.join(', ')}. ` +
          `Frame this as naming the self they're reclaiming right now — they can sharpen one of those or surface another, ` +
          `but ask for ONE clean natural-case phrase and steer them away from simply repeating an already-named self.\n`
        : '';
    // Doors Session (Option A+): acknowledge what onboarding seeded, then confirm/sharpen/add — never recite a menu.
    const doorNote =
      input.step.contributes === 'your_doors' && input.existingDoors?.length
        ? `\nWhen you first talked, they named these Doors: ${input.existingDoors.join(', ')}. Acknowledge those, confirm they still fit, and help them sharpen the wording or add one that surfaced (or drop one that doesn't). Do NOT recite the list of Doors — work from what they already named.\n`
        : '';
    const user =
      `Session: ${input.sessionTitle}\nMember: ${input.displayName}\n` +
      (input.memory ? `What you remember about them:\n${input.memory}\n` : '') +
      facetNote +
      doorNote +
      `\nPrior answers:\n${prior}\n\n` +
      `CURRENT step — "${input.step.title}"\nThe question they'll answer: ${input.step.prompt}\n` +
      `Your authored framing (use as the base, personalize it): ${input.step.companion_frame}\n` +
      `The depth-push to weave in if it fits: ${input.step.probe}\n\n` +
      `Speak your framing for this step now.`;
    const res = await client.messages.create({ model, max_tokens: 240, system: SYSTEM, messages: [{ role: 'user', content: user }] });
    const block = res.content.find((b) => b.type === 'text');
    const text = block && block.type === 'text' ? block.text.trim() : '';
    return text || fallback;
  } catch {
    return fallback;
  }
}

// The companion's RESPONSE to what the member just wrote on a step — the move that makes a Session a
// conversation, not a worksheet. Reflects their words, presses once when it's thin, confirms when it
// lands. `ready` is a SOFT signal (encourage depth, never gate). Live Claude; scripted fallback.
const STEP_RESPONSE_SYSTEM =
  'You are the G4L Member Agent, threaded through a Session as a real guide — not a worksheet. ' +
  'Voice: warm, plain, second-person; tough love that RESPECTS; never grade, fix, or pathologize; normalize, never praise. ' +
  'HARD VOICE RULES: declare what something IS. Don\'t define or redirect by negation — cut "not X, that\'s Y" setups and "don\'t do X, do Y" redirects; say it directly ("that\'s the whole reason you ride", "tell me what it felt like in your body"). The ONLY negation to keep is the rare one that removes a genuinely HARMFUL BELIEF — the Fade normalization ("a hundred reasonable decisions, not a failing"). Do NOT keep reassurance-tics: "no grade here", "not a grade", "never a scold", "not a test", "not about a perfect score" — those are the cringy "it\'s not X, it\'s Y" marketing cadence, not shame-lifting; cut them and say the thing plainly. Never tell them to "name" anything — ask directly ("which…", "what…", "tell me"). ' +
  'Do not say "sit with" — use "let that land" / "give it a minute". Do NOT use the word "honest" or "honestly". ' +
  'The member just answered the current step. Respond in 2–3 short sentences: reflect what they ACTUALLY said, in their own words; if it\'s thin or surface, press ONCE for more (use the depth-probe); if it has real depth, affirm it landed and that you have it. One move, no lists. ' +
  'Then set ready: true once they\'ve given something real to move forward on (soft — you\'re drawing out depth, not gating).';

export type StepResponse = { reply: string; ready: boolean };

export async function respondToStep(input: {
  sessionTitle: string;
  step: Step;
  priorAnswers: PriorAnswer[];
  answer: string;
  displayName: string;
  memory?: string | null;
  existingDoors?: string[]; // the member's committed Doors — so a mid-step "what were my Doors?" is ANSWERED, not deflected
}): Promise<StepResponse> {
  const answer = (input.answer ?? '').trim();
  // GOVERNANCE — crisis routing is always on: a distress signal in a Session step routes to 988 (never a conversational
  // reply, never advance). Deterministic backstop beneath the model, same as the phase arcs + onboarding + check-in.
  if (detectCrisis(answer).flagged) return { reply: CRISIS_RESPONSE_US, ready: false };
  const fallback: StepResponse = {
    reply: input.step.probe || 'Tell me a little more about that — what’s underneath it?',
    ready: answer.length >= 40,
  };
  if (!answer || !process.env.ANTHROPIC_API_KEY) return fallback;
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 16000, maxRetries: 1 });
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
    const prior = input.priorAnswers.length
      ? input.priorAnswers.map((p) => `Step "${p.title}": ${p.answer}`).join('\n')
      : '(first step)';
    const user =
      `Session: ${input.sessionTitle}\nMember: ${input.displayName}\n` +
      (input.memory ? `What you remember: ${input.memory}\n` : '') +
      (input.existingDoors?.length
        ? `Their committed Doors (named at onboarding): ${input.existingDoors.join(', ')}. If they ask what their Doors were, or seem to have lost the thread, STATE them plainly — you DO remember. Never say you have "no record" or that they're "starting fresh".\n`
        : '') +
      `Earlier in this Session:\n${prior}\n\n` +
      `CURRENT step — "${input.step.title}"\nThe question: ${input.step.prompt}\nDepth-probe (use if you press): ${input.step.probe}\n\n` +
      `They just wrote: ${answer}\n\nRespond, and set ready.`;
    const tool = {
      name: 'step_response',
      description: 'Your spoken reply to the member, plus whether their answer is ready to move forward on.',
      input_schema: {
        type: 'object' as const,
        properties: { reply: { type: 'string' }, ready: { type: 'boolean' } },
        required: ['reply', 'ready'],
      },
    };
    const res = await client.messages.create({
      model,
      max_tokens: 260,
      system: STEP_RESPONSE_SYSTEM,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'step_response' },
      messages: [{ role: 'user', content: user }],
    });
    const tu = res.content.find((b) => b.type === 'tool_use');
    if (!tu || tu.type !== 'tool_use') return fallback;
    const p = tu.input as { reply?: string; ready?: boolean };
    const reply = typeof p.reply === 'string' && p.reply.trim() ? p.reply.trim() : fallback.reply;
    return { reply, ready: p.ready === true };
  } catch {
    return fallback;
  }
}

/** The reclaimed identity a Session close commits — the answer to the step that contributes a facet. */
export function facetFromAnswers(step: Step[] | undefined, answers: Record<string, string>): string | null {
  const facetStep = (step ?? []).find((s) => s.contributes === 'facet');
  if (!facetStep) return null;
  const raw = (answers[String(facetStep.n)] ?? '').trim();
  return raw || null;
}

const normFacet = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Normalize a member's phrasing into a wearable natural-case self: "An Elite Cyclist" → "the Elite
 * Cyclist", "Builder" → "the Builder". Preserves the member's casing of the noun itself. */
export function cleanFacet(s: string): string {
  let t = (s ?? '').replace(/\s+/g, ' ').trim().replace(/[.,;:!?]+$/, '');
  if (!t) return '';
  t = t.replace(/^(an?|the|my)\s+/i, '').trim();
  return t ? `the ${t}` : '';
}

/** Drop empties and any candidate that restates an already-named (or earlier-in-batch) self. */
function dedupeFacets(cands: string[], existing: string[]): string[] {
  const seen = new Set(existing.map(normFacet));
  const out: string[] = [];
  for (const c of cands) {
    const t = c.trim();
    if (!t) continue;
    const k = normFacet(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** Turn the member's naming-step answer into the clean reclaimed self/selves they just named, with
 * any already-named ones stripped out (so the identity strip never repeats a known self). Faithful to
 * their own words — never invents an identity. Live Claude when available; deterministic fallback. */
export async function extractFacets(
  rawAnswer: string,
  existingFacets: string[],
  opts?: { displayName?: string; memory?: string | null },
): Promise<string[]> {
  const fallback = dedupeFacets([cleanFacet(rawAnswer)], existingFacets);
  if (!process.env.ANTHROPIC_API_KEY) return fallback;
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 16000, maxRetries: 1 });
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
    const already = existingFacets.length ? existingFacets.join(', ') : '(none yet)';
    const sys =
      "You normalize a member's own words into the reclaimed identity (or identities) they just named in a guided exercise. " +
      'Return ONLY identities the member themselves stated — NEVER invent, infer, or relabel. ' +
      'Each as a short natural-case noun phrase that reads as a self to wear, like "the Elite Cyclist" or "the Builder". ' +
      'EXCLUDE any self they have already named (given below) — do not repeat it. If their answer restates an already-named self ' +
      'plus a new one, return only the new one(s). Output STRICT JSON only: {"facets": string[]} — use [] when nothing is new.';
    const user = `Already named: ${already}\nTheir answer: ${rawAnswer}`;
    const res = await client.messages.create({ model, max_tokens: 200, system: sys, messages: [{ role: 'user', content: user }] });
    const block = res.content.find((b) => b.type === 'text');
    const text = block && block.type === 'text' ? block.text.trim() : '';
    const a = text.indexOf('{');
    const b = text.lastIndexOf('}');
    if (a < 0 || b < a) return fallback;
    const parsed = JSON.parse(text.slice(a, b + 1)) as { facets?: unknown };
    const arr = Array.isArray(parsed.facets) ? parsed.facets : [];
    const clean = arr.map((x) => cleanFacet(String(x))).filter(Boolean);
    return dedupeFacets(clean, existingFacets);
  } catch {
    return fallback;
  }
}
