// Your G4L Playbook — store layer (see docs/playbook.md). One table, two authorship modes:
//   • gathered  — MA-proposed keepers (proposed → kept | dismissed)
//   • authored  — the member's own free-add journal (lands kept on create)
// All queries are member-scoped (defense in depth; the action layer also authorizes).

import type { Db } from '../db/schema.ts';

export type PlaybookSection = 'what_works' | 'why_works' | 'own_words' | 'journal';
export type Authorship = 'gathered' | 'authored';
export type PlaybookState = 'proposed' | 'kept' | 'dismissed';
export type SourceKind = 'beat' | 'science' | 'checkpoint' | 'own' | 'session';

export type PlaybookSource = { kind?: SourceKind; ref?: string; label?: string };

export type PlaybookEntry = {
  id: string;
  section: PlaybookSection;
  body: string;
  authorship: Authorship;
  state: PlaybookState;
  source: PlaybookSource;
  pinned: boolean;
  shared: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  keeperType?: string | null; // what the line IS (definition/lights_you_up/tell/principle/recovery_move…) — 0046; the redesign groups by it
};

const SECTIONS: PlaybookSection[] = ['what_works', 'why_works', 'own_words', 'journal'];
export const isPlaybookSection = (s: string): s is PlaybookSection => (SECTIONS as string[]).includes(s);

function rowToEntry(r: any): PlaybookEntry {
  return {
    id: r.id,
    section: r.section,
    body: r.body,
    authorship: r.authorship,
    state: r.state,
    source: { kind: r.source_kind ?? undefined, ref: r.source_ref ?? undefined, label: r.source_label ?? undefined },
    pinned: r.pinned === true,
    shared: r.shared === true,
    sortOrder: Number(r.sort_order ?? 0),
    createdAt: typeof r.created_at === 'string' ? r.created_at : new Date(r.created_at).toISOString(),
    updatedAt: typeof r.updated_at === 'string' ? r.updated_at : new Date(r.updated_at).toISOString(),
    keeperType: r.keeper_type ?? null,
  };
}

async function nextSortOrder(db: Db, memberId: string, section: PlaybookSection): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    'select coalesce(max(sort_order), -1) + 1 as n from playbook_entry where member_id=$1 and section=$2',
    [memberId, section],
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * MA proposes a keeper (gathered → state 'proposed'). De-dupes against an existing live entry with
 * the same section + body (proposed or kept) so re-proposing the same line is a no-op.
 */
export async function proposeEntry(
  db: Db,
  memberId: string,
  input: { section: PlaybookSection; body: string; source?: PlaybookSource; keep?: boolean },
): Promise<{ created: boolean; entry: PlaybookEntry }> {
  const body = input.body.trim();
  const state: PlaybookState = input.keep ? 'kept' : 'proposed';
  const dupe = (
    await db.query<any>(
      `select * from playbook_entry
       where member_id=$1 and section=$2 and lower(body)=lower($3) and state in ('proposed','kept')
       limit 1`,
      [memberId, input.section, body],
    )
  ).rows[0];
  if (dupe) {
    // Verbal keep of an already-proposed line: promote it rather than duplicate.
    if (input.keep && dupe.state === 'proposed') {
      const upd = (
        await db.query<any>('update playbook_entry set state=$2, updated_at=now() where id=$1 returning *', [dupe.id, 'kept'])
      ).rows[0];
      return { created: false, entry: rowToEntry(upd) };
    }
    return { created: false, entry: rowToEntry(dupe) };
  }

  const sort = await nextSortOrder(db, memberId, input.section);
  const { rows } = await db.query<any>(
    `insert into playbook_entry (member_id, section, body, authorship, state, source_kind, source_ref, source_label, sort_order)
     values ($1,$2,$3,'gathered',$4,$5,$6,$7,$8) returning *`,
    [memberId, input.section, body, state, input.source?.kind ?? null, input.source?.ref ?? null, input.source?.label ?? null, sort],
  );
  return { created: true, entry: rowToEntry(rows[0]) };
}

/** Member free-add (authored → lands 'kept'). Defaults to the journal section. */
export async function addOwnEntry(
  db: Db,
  memberId: string,
  body: string,
  section: PlaybookSection = 'journal',
  /** The keeper this entry was written ABOUT (Journal intake, 2026-08-08). Set when a member takes a line they
   *  said in a Session and writes into it: the keeper is the line, the entry is the thinking, and the link is what
   *  lets the Journal show one as the seed of the other rather than two unrelated rows on the same day. */
  fromEntryId?: string,
): Promise<PlaybookEntry> {
  const sort = await nextSortOrder(db, memberId, section);
  const { rows } = await db.query<any>(
    `insert into playbook_entry (member_id, section, body, authorship, state, source_kind, source_ref, source_label, sort_order)
     values ($1,$2,$3,'authored','kept',$4,$5,$6,$7) returning *`,
    // source_kind stays 'own' either way — an expansion IS the member's own writing, which is what 'own' means,
    // and source_ref is already the column for linking back. Adding a 'keeper' kind would have meant a CHECK
    // constraint migration and a prod apply step for no gain; the LINK carries the distinction on its own.
    [memberId, section, body.trim(), 'own', fromEntryId ?? null, fromEntryId ? 'you wrote into this' : 'your own', sort],
  );
  return rowToEntry(rows[0]);
}

/** Everything the member should see: kept + still-proposed (never dismissed). Pinned float to top. */
export async function listPlaybook(db: Db, memberId: string): Promise<PlaybookEntry[]> {
  const { rows } = await db.query<any>(
    `select * from playbook_entry
     where member_id=$1 and state in ('proposed','kept')
     order by section, pinned desc, sort_order, created_at`,
    [memberId],
  );
  return rows.map(rowToEntry);
}

async function setState(db: Db, memberId: string, id: string, state: PlaybookState): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(
    'update playbook_entry set state=$3, updated_at=now() where member_id=$1 and id=$2 returning id',
    [memberId, id, state],
  );
  return rows.length > 0;
}

export const keepEntry = (db: Db, memberId: string, id: string) => setState(db, memberId, id, 'kept');
export const dismissEntry = (db: Db, memberId: string, id: string) => setState(db, memberId, id, 'dismissed');

export async function pinEntry(db: Db, memberId: string, id: string, pinned: boolean): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(
    'update playbook_entry set pinned=$3, updated_at=now() where member_id=$1 and id=$2 returning id',
    [memberId, id, pinned],
  );
  return rows.length > 0;
}

export async function editEntry(db: Db, memberId: string, id: string, body: string): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(
    'update playbook_entry set body=$3, updated_at=now() where member_id=$1 and id=$2 returning id',
    [memberId, id, body.trim()],
  );
  return rows.length > 0;
}

export async function removeEntry(db: Db, memberId: string, id: string): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(
    'delete from playbook_entry where member_id=$1 and id=$2 returning id',
    [memberId, id],
  );
  return rows.length > 0;
}

/**
 * A capped, summarized slice of the Playbook for the Member Agent's context (the two-way loop).
 * Kept keepers (the cheat sheet) + the most recent authored journal lines. Used to help — never
 * quoted back coldly or weaponized (enforced in the agent's system prompt).
 */
export async function playbookForAgent(
  db: Db,
  memberId: string,
  opts: { keptMax?: number; journalMax?: number } = {},
): Promise<{ keepers: { section: PlaybookSection; body: string; keeperType?: string }[]; recentNotes: string[] }> {
  const keptMax = opts.keptMax ?? 12;
  const journalMax = opts.journalMax ?? 5;
  const kept = (
    await db.query<any>(
      // keeper_type (0046) rides along so the companion can tell a true line from an image from a recovery move —
      // the recall pattern reaches for the RIGHT tool when the old voice shows up (Decision MM #2).
      `select section, body, keeper_type from playbook_entry
       where member_id=$1 and state='kept' and section in ('what_works','why_works','own_words')
       order by pinned desc, sort_order, created_at limit $2`,
      [memberId, keptMax],
    )
  ).rows.map((r) => ({ section: r.section as PlaybookSection, body: r.body as string, keeperType: r.keeper_type ?? undefined }));
  const recentNotes = (
    await db.query<{ body: string }>(
      `select body from playbook_entry
       where member_id=$1 and section='journal' and state='kept'
       order by created_at desc, sort_order desc limit $2`,
      [memberId, journalMax],
    )
  ).rows.map((r) => r.body);
  return { keepers: kept, recentNotes };
}

/**
 * Find the ONE kept entry a member means when they name it in conversation ("the false-start thing isn't working").
 *
 * ANCHORED, never a fuzzy nearest-neighbour, and it refuses rather than guesses. Retiring the wrong play is a
 * silent edit to the member's own operating manual — they may not notice for weeks, and when they do, the thing
 * they trusted to hold their words got one wrong. An ambiguous match returns `ambiguous` so the Companion asks
 * which one instead of picking. Same discipline as marking a practice day against the wrong commitment.
 *
 * Three tiers, best first: exact body, then prefix, then containment. Ties WITHIN a tier are ambiguous; a single
 * hit in a better tier beats several in a worse one.
 */
export function matchKeptEntry(
  entries: PlaybookEntry[],
  phrase: string,
): { entry: PlaybookEntry | null; ambiguous: boolean } {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const q = norm(phrase);
  if (!q) return { entry: null, ambiguous: false };
  const kept = entries.filter((e) => e.state === 'kept' && e.section !== 'journal');

  for (const tier of [
    (b: string) => b === q,
    (b: string) => b.startsWith(q) || q.startsWith(b),
    (b: string) => b.includes(q) || q.includes(b),
  ]) {
    const hits = kept.filter((e) => tier(norm(e.body)));
    if (hits.length === 1) return { entry: hits[0]!, ambiguous: false };
    if (hits.length > 1) return { entry: null, ambiguous: true };
  }
  return { entry: null, ambiguous: false };
}
