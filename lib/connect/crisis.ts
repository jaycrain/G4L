// Two-layer crisis assessment for member-composed Connect content (posts, replies, room messages).
//   1. detectCrisis (regex) — instant, always-on, no dependency.
//   2. a semantic LLM check (Claude Haiku) — ONLY when the regex is silent — to catch paraphrased
//      distress the patterns miss ("I don't think it's worth it anymore", "I just want it to stop").
//
// Governance: this NEVER censors the content (the member is reaching out — that's the point). A hit
// routes to 988 + a human (the caller files a system report). It NEVER diagnoses or labels.
// Fail-safe by design: no API key, an error, or a timeout falls back to the regex result and never
// throws — a flaky model must never block a post or, worse, swallow a real signal silently.
import { detectCrisis } from '../agent/governance.ts';

export type CrisisAssessment = { flagged: boolean; source: 'pattern' | 'model' | 'none' };

const CLASSIFIER_SYSTEM =
  'You are a safety classifier for a peer-support community of midlife adults. Decide whether a ' +
  "member's message suggests they may be at risk of suicide or self-harm, that life may not be worth " +
  'living, that they want to stop existing or disappear, or that they are in acute crisis. INCLUDE ' +
  "indirect or passive phrasing (e.g. \"I don't know if it's worth it anymore\", \"I just want it to " +
  'stop", "everyone would be better off without me", "I can\'t keep doing this"). Ordinary venting, ' +
  'sadness, frustration, stress, or tiredness is NOT crisis. Respond with EXACTLY one word: CRISIS or SAFE.';

async function modelFlagsCrisis(text: string): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) return false; // no key (local/dev) → regex-only
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic();
    const model = process.env.ANTHROPIC_CRISIS_MODEL ?? 'claude-haiku-4-5-20251001';
    const res = await client.messages.create({
      model,
      max_tokens: 5,
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: 'user', content: text.slice(0, 2000) }],
    });
    const out = (res.content as { type: string; text?: string }[])
      .map((b) => (b.type === 'text' ? b.text ?? '' : ''))
      .join('')
      .trim()
      .toUpperCase();
    return out.startsWith('CRISIS');
  } catch {
    return false; // fail-safe — never block a post on a model error
  }
}

/** Regex first (instant); only if it's silent, ask the model. Returns which layer caught it. */
export async function assessCrisis(text: string): Promise<CrisisAssessment> {
  const t = (text ?? '').trim();
  if (t.length < 4) return { flagged: false, source: 'none' };
  if (detectCrisis(t).flagged) return { flagged: true, source: 'pattern' };
  if (await modelFlagsCrisis(t)) return { flagged: true, source: 'model' };
  return { flagged: false, source: 'none' };
}
