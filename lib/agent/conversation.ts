// Member Agent conversation memory — the persisted check-in thread. Framework-free (takes a Db).
import type { Db } from '../db/schema.ts';
import type { CheckinMessage } from './checkin.ts';

export async function appendMessages(db: Db, memberId: string, msgs: CheckinMessage[]): Promise<void> {
  for (const m of msgs) {
    await db.query(`insert into agent_message (member_id, role, text) values ($1,$2,$3)`, [memberId, m.role, m.text]);
  }
}

/** The member's recent thread, oldest→newest (capped). */
export async function loadConversation(db: Db, memberId: string, limit = 40): Promise<CheckinMessage[]> {
  const { rows } = await db.query<{ role: string; text: string }>(
    `select role, text from (
       select role, text, seq from agent_message where member_id = $1
       order by seq desc limit $2
     ) recent order by seq asc`,
    [memberId, limit],
  );
  return rows.map((r) => ({ role: r.role === 'agent' ? 'agent' : 'member', text: r.text }));
}
