'use server';

import { isAdmin } from '../../authz.ts';
import { FOUNDER_COMPANION_SYSTEM, cohortContext } from '../../../lib/founder/companion.ts';
import type { CohortView, AttentionRow } from '../../../lib/admin/console.ts';

/**
 * One turn with the Founder Companion. READ-ONLY over member data — it reasons from the cohort context the
 * server already computed, and has no tool that writes anything.
 *
 * The cohort/attention values arrive from the client, which is safe here ONLY because they are used as
 * PROMPT CONTEXT and nothing else — no query is built from them and no record is written. They are also
 * already on that client's screen. If this ever gains a tool that acts, re-derive them server-side first.
 */
export async function askFounderCompanionAction(
  question: string,
  cohort: CohortView,
  attention: AttentionRow[],
): Promise<{ reply: string }> {
  if (!(await isAdmin())) return { reply: 'Not authorized.' };
  const q = (question ?? '').trim().slice(0, 2000);
  if (!q) return { reply: '' };
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 30000,
      maxRetries: 2,
      defaultHeaders: { 'accept-encoding': 'identity' },
    });
    const res = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: `${FOUNDER_COMPANION_SYSTEM}\n\nMEMBER CONTEXT (the only facts you have — never invent beyond these):\n${cohortContext(cohort, attention)}`,
      messages: [{ role: 'user', content: q }],
    });
    const block = res.content.find((c) => c.type === 'text');
    return { reply: block && block.type === 'text' ? block.text.trim() : '(no answer)' };
  } catch {
    return { reply: 'I couldn’t reach that just now — try again in a moment.' };
  }
}
