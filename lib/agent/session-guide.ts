// The companion threaded through a Session (Give-Back Model v0.4 — "guide a Session"). For the lit
// (current) step it speaks a short framing that reflects what the member just said, frames this step,
// and pushes — warmly — for honest depth. Live Claude when available; the registry's authored
// companion_frame is the reliable fallback (never a broken or empty frame).
import type { Step } from '../curriculum/types.ts';

export type PriorAnswer = { title: string; prompt: string; answer: string };

export type GuideInput = {
  sessionTitle: string;
  step: Step;
  priorAnswers: PriorAnswer[];
  displayName: string;
  memory?: string | null;
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
    const user =
      `Session: ${input.sessionTitle}\nMember: ${input.displayName}\n` +
      (input.memory ? `What you remember about them:\n${input.memory}\n` : '') +
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

/** The reclaimed identity a Session close commits — the answer to the step that contributes a facet. */
export function facetFromAnswers(step: Step[] | undefined, answers: Record<string, string>): string | null {
  const facetStep = (step ?? []).find((s) => s.contributes === 'facet');
  if (!facetStep) return null;
  const raw = (answers[String(facetStep.n)] ?? '').trim();
  return raw || null;
}
