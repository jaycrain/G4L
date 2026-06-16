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
): Promise<PlaybookEntry> {
  const sort = await nextSortOrder(db, memberId, section);
  const { rows } = await db.query<any>(
    `insert into playbook_entry (member_id, section, body, authorship, state, source_kind, source_label, sort_order)
     values ($1,$2,$3,'authored','kept','own','your own',$4) returning *`,
    [memberId, section, body.trim(), sort],
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
): Promise<{ keepers: { section: PlaybookSection; body: string }[]; recentNotes: string[] }> {
  const keptMax = opts.keptMax ?? 12;
  const journalMax = opts.journalMax ?? 5;
  const kept = (
    await db.query<any>(
      `select section, body from playbook_entry
       where member_id=$1 and state='kept' and section in ('what_works','why_works','own_words')
       order by pinned desc, sort_order, created_at limit $2`,
      [memberId, keptMax],
    )
  ).rows.map((r) => ({ section: r.section as PlaybookSection, body: r.body as string }));
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
