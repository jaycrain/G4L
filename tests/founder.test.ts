import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { generateDraft, MOMENTS, type FounderContext } from '../lib/founder/draft.ts';
import { createDraft, listPending, getDraft, approveSend, rejectDraft, listForMember } from '../lib/founder/store.ts';

const ctx: FounderContext = {
  firstName: 'Tom',
  identityNoun: 'Athlete',
  doorDisplayNames: ['The Career Cliff'],
  idScore: 60,
  direction: 'up',
  delta: 5,
  currentFocus: 'Rebuild — your body',
  lastCompletedAsset: 'Identity Excavation',
  intakeQuote: 'I barely recognize myself',
};

const BANNED = [/\bjourney\b/i, /\bI hear you\b/i, /\bamazing\b/i];
const clean = (s: string) => BANNED.every((re) => !re.test(s));

test('scripted drafts are grounded, brand-safe, and signed by Jay (all moments)', async () => {
  for (const moment of Object.keys(MOMENTS) as Array<keyof typeof MOMENTS>) {
    const d = await generateDraft(moment, ctx); // no key in test env → scripted
    assert.ok(d.subject.length > 0 && d.body.length > 0, `${moment} produced content`);
    assert.match(d.subject, /Tom/, `${moment} subject names the member`);
    assert.match(d.body, /—\s*Jay\s*$/, `${moment} is signed by Jay`);
    assert.ok(clean(d.subject) && clean(d.body), `${moment} respects voice rules`);
  }
});

async function dbWithMember(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const r = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Tom Miller','tom@example.com') returning member_id`,
  );
  return { db, memberId: r.rows[0]!.member_id };
}

test('draft lands in the review queue, then approve & send clears it', async () => {
  const { db, memberId } = await dbWithMember();
  const draft = await generateDraft('milestone_commentary', ctx);
  const id = await createDraft(db, { memberId, moment: 'milestone_commentary', draft });

  assert.equal((await listPending(db)).length, 1);
  const queued = await getDraft(db, id);
  assert.equal(queued?.display_name, 'Tom Miller'); // queue joins the member name
  assert.equal(queued?.approval_status, 'pending');

  await approveSend(db, id, 'Tom,\n\nEdited by Jay before sending.\n\n— Jay');
  const sent = await getDraft(db, id);
  assert.equal(sent?.approval_status, 'approved');
  assert.ok(sent?.sent_at, 'sent_at recorded');
  assert.match(sent?.jay_edits ?? '', /Edited by Jay/);
  assert.equal((await listPending(db)).length, 0); // gate cleared
});

test('reject removes a draft from the queue without sending', async () => {
  const { db, memberId } = await dbWithMember();
  const id = await createDraft(db, { memberId, moment: 'false_start_return', draft: await generateDraft('false_start_return', ctx) });
  await rejectDraft(db, id);
  const d = await getDraft(db, id);
  assert.equal(d?.approval_status, 'rejected');
  assert.equal(d?.sent_at, null);
  assert.equal((await listForMember(db, memberId)).length, 1);
});
