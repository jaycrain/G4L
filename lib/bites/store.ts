// GRINTA! Bites store — consumption + the daily-serve panel. Framework-free (takes a Db).
import type { Db } from '../db/schema.ts';
import type { RGroup } from '../assets/gating.ts';
import { pickDailyBite, getBite, type Bite } from './definitions.ts';

export async function consumeBite(db: Db, memberId: string, biteCode: string): Promise<void> {
  await db.query(
    `insert into bite_consumed (member_id, bite_code) values ($1,$2) on conflict do nothing`,
    [memberId, biteCode],
  );
}

/** Titles of the member's most recently consumed bites (for the agent's awareness). */
export async function recentConsumedTitles(db: Db, memberId: string, limit = 3): Promise<string[]> {
  const { rows } = await db.query<{ bite_code: string }>(
    `select bite_code from bite_consumed where member_id=$1 order by consumed_at desc limit $2`,
    [memberId, limit],
  );
  return rows.map((r) => getBite(r.bite_code)?.title).filter((t): t is string => Boolean(t));
}

export async function consumedCodes(db: Db, memberId: string): Promise<Set<string>> {
  const { rows } = await db.query<{ bite_code: string }>(
    `select bite_code from bite_consumed where member_id=$1`,
    [memberId],
  );
  return new Set(rows.map((r) => r.bite_code));
}

export type BitePanel =
  | { state: 'available'; bite: Bite }
  | { state: 'done' } // already had today's bite
  | { state: 'empty' }; // worked through them all

export async function getBitePanel(db: Db, memberId: string, focusGroup?: RGroup | null): Promise<BitePanel> {
  const today = (
    await db.query<{ n: number }>(
      `select count(*)::int n from bite_consumed where member_id=$1 and consumed_at >= date_trunc('day', now())`,
      [memberId],
    )
  ).rows[0]!.n;
  if (today > 0) return { state: 'done' };

  const consumed = await consumedCodes(db, memberId);
  const bite = pickDailyBite(consumed, focusGroup);
  return bite ? { state: 'available', bite } : { state: 'empty' };
}
