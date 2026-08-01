'use server';

import { isAdmin } from '../../authz.ts';
import { getDb } from '../../../lib/db/index.ts';
import { FOUNDER_COMPANION_SYSTEM, cohortContext } from '../../../lib/founder/companion.ts';
import { FOUNDER_TOOLS, runFounderTool, newTurnBudget } from '../../../lib/founder/companion-tools.ts';
import { appendFounderTurns, loadFounderThread, clearFounderThread } from '../../../lib/founder/thread.ts';
import type { CohortView, AttentionRow } from '../../../lib/admin/console.ts';

/**
 * One turn with the Founder Companion.
 *
 * IT RETRIEVES RATHER THAN BEING BRIEFED. The first cut handed the model a fixed cohort summary, so it could
 * say "1 stalled" but not who — and at 1,000 members no static brief fits in a prompt anyway, while 999 of
 * those members are irrelevant to whatever Jay just asked. So it runs tools: it fetches the answer to the
 * question asked, and nothing else. Jay's use is a phone, mid-ride, asking one specific thing.
 *
 * READ-ONLY, ENFORCED HERE AND NOT JUST BY THE PROMPT. Every tool in FOUNDER_TOOLS is a SELECT. There is no
 * write path, no send path, no draft-approve path — a prompt injection through a member's own name or gap
 * text has nothing to reach for. The no-auto-send rule is upheld by there being no send tool to call.
 *
 * The cohort/attention values from the client stay PROMPT CONTEXT only — nothing queries from them. Tools
 * re-derive everything server-side, which is what makes it safe to let the model drive them.
 */
/** What was already said in this sitting. Text only — the tool traffic doesn't need to be replayed. */
export type PriorTurn = { role: 'jay' | 'companion'; text: string };

/** The stored thread, for the console to render on load (a different device, or a fresh tab). */
export async function loadFounderThreadAction(): Promise<PriorTurn[]> {
  if (!(await isAdmin())) return [];
  const db = await getDb();
  return (await loadFounderThread(db)).map((t) => ({ role: t.role, text: t.text }));
}

/** Purge — deletes the rows, not just the screen. The privacy control the durable version is built WITH. */
export async function clearFounderThreadAction(): Promise<void> {
  if (!(await isAdmin())) return;
  await clearFounderThread(await getDb());
}

/** Enough to hold a conversation, bounded so a long morning doesn't grow the prompt without limit. */
const HISTORY_TURNS = 12;

export async function askFounderCompanionAction(
  question: string,
  cohort: CohortView,
  attention: AttentionRow[],
  history: PriorTurn[] = [],
): Promise<{ reply: string; looked: string[] }> {
  if (!(await isAdmin())) return { reply: 'Not authorized.', looked: [] };
  const q = (question ?? '').trim().slice(0, 2000);
  if (!q) return { reply: '', looked: [] };

  const looked: string[] = [];
  try {
    const db = await getDb();
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 30000,
      maxRetries: 2,
      defaultHeaders: { 'accept-encoding': 'identity' },
    });

    const system = `${FOUNDER_COMPANION_SYSTEM}

WHAT IS ALREADY ON JAY'S SCREEN (so you don't just read it back at him):
${cohortContext(cohort, attention)}`;

    // THE THREAD, NOT A ONE-SHOT.
    //
    // This was missing and it broke the most important exchange there is. The rail rendered the conversation
    // but sent only the latest line, so every question arrived with no memory: Jay asks "who needs a nudge?",
    // the Companion offers to write to Pat, Jay says "yes, draft something to Pat" — and the model has no idea
    // what it just offered. Caught by a live walk; the offer/accept flow simply could not complete.
    //
    // The product's own north star is REMEMBER, SO THE KNOWING COMPOUNDS. An operator surface that forgets
    // the previous sentence fails that at the smallest possible scale.
    const messages: Array<{ role: 'user' | 'assistant'; content: unknown }> = [
      ...history
        .slice(-HISTORY_TURNS)
        .filter((t) => t.text.trim())
        .map((t) => ({ role: (t.role === 'jay' ? 'user' : 'assistant') as 'user' | 'assistant', content: t.text })),
      { role: 'user', content: q },
    ];
    // The API rejects a leading assistant turn — which is exactly what a trimmed window can start with.
    while (messages.length > 1 && messages[0]!.role === 'assistant') messages.shift();
    // One budget for the whole turn, so the member-detail fan-out cap spans every pass of the tool loop —
    // not just a single pass, which the model could trivially step around by spreading calls out.
    const budget = newTurnBudget();

    // Bounded loop. Four passes is enough for "find the stalled members, then look one up" and it caps the
    // cost of a model that decides to keep browsing. Terminates on the first turn with no tool_use.
    for (let pass = 0; pass < 4; pass++) {
      const res = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 900,
        system,
        tools: FOUNDER_TOOLS,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messages as any,
      });

      const calls = res.content.filter((c): c is Extract<typeof c, { type: 'tool_use' }> => c.type === 'tool_use');
      if (!calls.length || res.stop_reason !== 'tool_use') {
        const block = res.content.find((c) => c.type === 'text');
        const reply = block && block.type === 'text' ? block.text.trim() : '(no answer)';
        // Durable now (0066), so the thread survives moving from a phone to a desk. Best-effort: losing the
        // continuity must never cost him the answer he just got.
        await appendFounderTurns(db, [{ role: 'jay', text: q }, { role: 'companion', text: reply, looked }]);
        return { reply, looked };
      }

      messages.push({ role: 'assistant', content: res.content });
      const results = await Promise.all(
        calls.map(async (c) => {
          looked.push(c.name);
          const out = await runFounderTool(db, c.name, (c.input ?? {}) as Record<string, unknown>, Date.now(), budget).catch((e) => ({
            error: `That lookup failed: ${e instanceof Error ? e.message : 'unknown'}. Say the lookup failed — do not answer as if the result were empty.`,
          }));
          return { type: 'tool_result' as const, tool_use_id: c.id, content: JSON.stringify(out) };
        }),
      );
      messages.push({ role: 'user', content: results });
    }

    // Ran out of passes. Say so rather than inventing a conclusion from partial lookups.
    return { reply: 'That took more digging than I could do in one go — try asking it more narrowly.', looked };
  } catch {
    return { reply: 'I couldn’t reach that just now — try again in a moment.', looked };
  }
}
