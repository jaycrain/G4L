import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { logQualityDay, recentQualityDays } from '../lib/reclaim/quality-day-store.ts';

// A SECOND LOG ON THE SAME DAY MUST NOT ERASE THE FIRST.
//
// Jay, on his OWN account (2026-08-15): "the only box that will stay checked is the last one you've entered
// data for. So it switches every time you enter." It read as a grid bug and was data loss — logQualityDay
// upserts on (member_id, logged_on) and REPLACES `present`, while the form always started empty. So a second
// visit submitted only what was ticked that time, and that became the whole day.
//
// The fix is that the FORM seeds from today's record, which makes replace correct. These tests hold both ends:
// the store still replaces (so a member can UNTICK), and the form is wired to arrive holding the record.

async function member(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const r = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Jay','j@x.test') returning member_id`,
  );
  return { db, memberId: r.rows[0]!.member_id };
}
const DAY = '2026-08-15';

test('THE BUG: a partial second log replaces the day — which is why the form must seed', async () => {
  const { db, memberId } = await member();
  await logQualityDay(db, memberId, { score: 8, present: ['bike ride', 'Maple'], loggedOn: DAY });
  // A form that started blank would send only the newly-ticked element. This is that submission.
  await logQualityDay(db, memberId, { score: 8, present: ['Food as fuel'], loggedOn: DAY });

  const [entry] = await recentQualityDays(db, memberId, 7);
  assert.deepEqual(entry!.present, ['Food as fuel'], 'the store REPLACES — this is by design, not the bug');
});

test('the seeded form sends the whole record, so nothing is lost', async () => {
  const { db, memberId } = await member();
  await logQualityDay(db, memberId, { score: 8, present: ['bike ride', 'Maple'], loggedOn: DAY });
  // Seeded: the form arrives holding ['bike ride','Maple'] and the member adds one.
  await logQualityDay(db, memberId, { score: 8, present: ['bike ride', 'Maple', 'Food as fuel'], loggedOn: DAY });

  const [entry] = await recentQualityDays(db, memberId, 7);
  assert.deepEqual(entry!.present.sort(), ['Food as fuel', 'Maple', 'bike ride'], 'all three survive');
});

test('and UNTICKING still works — the reason this is not a server-side merge', async () => {
  // A union-on-write would have been the tempting one-liner and would make this impossible: a member could
  // never correct something they logged by mistake. A tracker you cannot correct is worse than one that forgets.
  const { db, memberId } = await member();
  await logQualityDay(db, memberId, { score: 7, present: ['bike ride', 'Maple'], loggedOn: DAY });
  await logQualityDay(db, memberId, { score: 7, present: ['bike ride'], loggedOn: DAY });

  const [entry] = await recentQualityDays(db, memberId, 7);
  assert.deepEqual(entry!.present, ['bike ride'], 'Maple was removed on purpose and stayed removed');
});

test('separate days stay separate — the grid can show more than one column', async () => {
  const { db, memberId } = await member();
  await logQualityDay(db, memberId, { score: 6, present: ['bike ride'], loggedOn: '2026-08-13' });
  await logQualityDay(db, memberId, { score: 9, present: ['Maple'], loggedOn: '2026-08-14' });
  const rows = await recentQualityDays(db, memberId, 7);
  assert.equal(rows.length, 2, 'two days, two rows');
});

test('THE WIRING: the form seeds from today, and the page passes it', () => {
  // The data tests above pass whether or not the form is wired — the bug lived in the CLIENT starting empty.
  // So assert the seam itself, or these tests would have gone green against the broken product.
  const form = readFileSync(new URL('../app/quality-day/quality-day-log.tsx', import.meta.url), 'utf8');
  assert.match(form, /useState<Set<string>>\(new Set\(today\?\.present \?\? \[\]\)\)/, 'elements seed from today');
  assert.match(form, /useState<number \| null>\(today\?\.score \?\? null\)/, 'score seeds from today');
  assert.match(form, /useState\(today\?\.mostValuable \?\? ''\)/, 'and the reflections seed too');

  const page = readFileSync(new URL('../app/quality-day/[memberId]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /today=\{todayEntry\}/, 'the page passes today’s entry into the form');
});
