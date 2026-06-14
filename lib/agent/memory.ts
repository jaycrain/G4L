// Durable companion memory — "the knowing compounds." The recent thread is replayed to the agent
// as a window (last RECALL_WINDOW messages). As older messages age PAST that window, their durable
// facts are distilled into a running memory the agent always carries, so people/relationships and
// life context never just scroll away. Framework-free (takes a Db).
import type { Db } from '../db/schema.ts';

export const RECALL_WINDOW = 40; // must match the slice in sendCheckin's history
const FOLD_BATCH = 10; // only run the (LLM) fold once at least this many messages have aged out

export type SeqMessage = { seq: number; role: string; text: string };

/**
 * Pure: which aged-out, not-yet-folded messages are due to be folded into durable memory.
 * Messages with seq <= (maxSeq - window) are outside recall; of those, fold any with seq > throughSeq,
 * but only once at least `batch` have accumulated (so the LLM merge runs occasionally, not every turn).
 */
export function selectFoldBatch(
  rows: SeqMessage[],
  throughSeq: number,
  window = RECALL_WINDOW,
  batch = FOLD_BATCH,
): { batch: SeqMessage[]; newThroughSeq: number } | null {
  if (rows.length === 0) return null;
  const maxSeq = Math.max(...rows.map((r) => r.seq));
  const cutoff = maxSeq - window; // seq <= cutoff is out of the recall window
  const due = rows.filter((r) => r.seq > throughSeq && r.seq <= cutoff).sort((a, b) => a.seq - b.seq);
  if (due.length < batch) return null;
  return { batch: due, newThroughSeq: Math.max(...due.map((r) => r.seq)) };
}

async function mergeMemory(existing: string, batch: SeqMessage[]): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 20000, maxRetries: 1 });
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
  const transcript = batch.map((m) => `${m.role === 'agent' ? 'You' : 'Member'}: ${m.text}`).join('\n');
  const system =
    'You maintain a durable, private memory for a companion whose job is to truly know the member it supports. ' +
    'Keep a tight, plain record of what is worth remembering long-term: people and relationships (names + who they are), ' +
    'significant life events, health context, work/projects, and clear preferences. Merge new facts into what is already ' +
    'remembered; deduplicate; stay concise (short lines). Omit small talk, passing mood, and anything that is clearly ' +
    'already in their structured profile (their reclaimed identity, Reclaim List, Doors, scores). Never invent or infer ' +
    'beyond what was said. Output ONLY the updated memory text, nothing else.';
  const user =
    `What you already remember:\n${existing.trim() || '(nothing yet)'}\n\n` +
    `Older messages now passing out of recent recall:\n${transcript}\n\n` +
    `Return the full updated memory.`;
  const res = await client.messages.create({ model, max_tokens: 700, system, messages: [{ role: 'user', content: user }] });
  const block = res.content.find((b) => b.type === 'text');
  return block && block.type === 'text' ? block.text.trim() : existing;
}

/** Best-effort: fold aged-out messages into durable memory if a batch is due. Never throws. */
export async function maybeFoldMemory(db: Db, memberId: string): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) return;
  try {
    const prof = (
      await db.query<{ agent_memory: string | null; agent_memory_seq: string | number | null }>(
        'select agent_memory, agent_memory_seq from member_profile where member_id=$1',
        [memberId],
      )
    ).rows[0];
    if (!prof) return;
    const throughSeq = Number(prof.agent_memory_seq ?? 0);
    const { rows } = await db.query<{ seq: string | number; role: string; text: string }>(
      'select seq, role, text from agent_message where member_id=$1 order by seq',
      [memberId],
    );
    const sel = selectFoldBatch(
      rows.map((r) => ({ seq: Number(r.seq), role: r.role, text: r.text })),
      throughSeq,
    );
    if (!sel) return;
    const updated = await mergeMemory(prof.agent_memory ?? '', sel.batch);
    if (updated && updated.trim()) {
      await db.query('update member_profile set agent_memory=$1, agent_memory_seq=$2 where member_id=$3', [
        updated.trim(),
        sel.newThroughSeq,
        memberId,
      ]);
    }
  } catch (e) {
    console.warn('memory fold skipped:', (e as Error).message);
  }
}
