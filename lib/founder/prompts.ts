// Saved prompts — the questions Jay actually opens with (migration 0067).
//
// The console ships four defaults. They're a reasonable guess at a morning routine and they are not HIS
// routine; that only emerges in use. Starring a question he just asked turns the pin row from a feature tour
// into his own shortlist.
//
// Schema-tolerant, like everything else that landed after a hand-applied migration: before 0067 saving is a
// no-op and the defaults still work, rather than the console erroring.

import type { Db } from '../db/schema.ts';

/** The starting four. Kept here so the client and the server agree on what "default" means. */
export const DEFAULT_PROMPTS = [
  'Run my morning scan',
  "Who hasn't been back in 5 days?",
  'Who is closest to a Checkpoint?',
  'What moved overnight?',
];

const MAX_SAVED = 8; // a shortlist, not an archive — past this the row stops being scannable

let tableConfirmed = false;
export function __resetPromptCache(): void { tableConfirmed = false; }

async function hasTable(db: Db): Promise<boolean> {
  if (tableConfirmed) return true;
  try {
    const { rows } = await db.query<{ e: boolean }>(
      `select exists (select 1 from information_schema.tables
         where table_schema='public' and table_name='founder_prompt') as e`,
    );
    tableConfirmed = Boolean(rows[0]?.e); // only the POSITIVE is cached — see lib/founder/thread.ts
    return tableConfirmed;
  } catch { return false; }
}

export async function listSavedPrompts(db: Db, operator = 'jay'): Promise<string[]> {
  if (!(await hasTable(db))) return [];
  try {
    const { rows } = await db.query<{ text: string }>(
      `select text from founder_prompt where operator = $1 order by created_at desc limit $2`,
      [operator, MAX_SAVED],
    );
    return rows.map((r) => r.text);
  } catch (e) {
    console.error('[founder] saved prompts read failed:', e);
    return [];
  }
}

/** Star a question. Idempotent — starring twice is one pin. */
export async function savePrompt(db: Db, text: string, operator = 'jay'): Promise<void> {
  const t = (text ?? '').trim().slice(0, 200);
  if (!t || !(await hasTable(db))) return;
  try {
    await db.query(
      `insert into founder_prompt (operator, text) values ($1,$2) on conflict (operator, text) do nothing`,
      [operator, t],
    );
    // Keep the shortlist short: drop the oldest beyond MAX_SAVED rather than letting the row grow forever.
    await db.query(
      `delete from founder_prompt where operator = $1 and id not in (
         select id from founder_prompt where operator = $1 order by created_at desc limit $2)`,
      [operator, MAX_SAVED],
    );
  } catch (e) {
    console.error('[founder] could not save the prompt:', e);
  }
}

export async function unsavePrompt(db: Db, text: string, operator = 'jay'): Promise<void> {
  if (!(await hasTable(db))) return;
  try {
    await db.query(`delete from founder_prompt where operator = $1 and text = $2`, [operator, (text ?? '').trim()]);
  } catch (e) {
    console.error('[founder] could not unsave the prompt:', e);
  }
}
