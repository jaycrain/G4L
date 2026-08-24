// MEMBER LANGUAGE HISTORY — her words, kept so they can be pointed forward.
//
// Greg names `member_language_history` as a required input to seven assets and makes it testable: "key member
// phrases are stored and re-surfaced in later turns." The purpose is C1-22 — helping her "recognize that growth
// and use it as evidence of capability" — with his own limit attached: "WITHOUT OVERSTATING IT."
//
// These pin the two things that make it safe rather than creepy: only words she CHOSE, and an immediate, total
// "don't use that".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { memberLanguage, setAsidePhrase, normalise } from '../lib/member/language-history.ts';

async function member(db: Db): Promise<string> {
  return (await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Dee','lang@x.test') returning member_id`,
  )).rows[0]!.member_id;
}

const keep = (db: Db, m: string, body: string, keeperType: string) =>
  db.query(
    `insert into playbook_entry (member_id, section, body, authorship, state, keeper_type)
     values ($1,'what_works',$2,'gathered','kept',$3)`,
    [m, body, keeperType],
  );

test('it carries her kept lines with Greg\'s shape — never a score', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  await keep(db, m, 'I stopped pretending I was fine at work', 'tell');

  const [p] = await memberLanguage(db, m);
  assert.ok(p, 'her kept line is in the history');
  assert.equal(p!.memberLanguage, 'I stopped pretending I was fine at work', 'VERBATIM — never tidied');
  assert.equal(p!.type, 'fear', 'a tell is what she wants to catch early');
  assert.ok(p!.crossReference.at, 'it knows when she said it');
  // Greg: "These are not stored as scores." Inspect the object for exactly his five keys and no rating.
  assert.deepEqual(Object.keys(p!).sort(), ['crossReference', 'domain', 'memberLanguage', 'statement', 'type']);
});

test('a line she did NOT keep never enters the history', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  // Proposed but never kept — the Companion offered it and she did not take it.
  await db.query(
    `insert into playbook_entry (member_id, section, body, authorship, state, keeper_type)
     values ($1,'what_works','A line she never accepted','gathered','proposed','tell')`, [m]);
  // And her private journal, which she never promoted.
  await db.query(
    `insert into playbook_entry (member_id, section, body, authorship, state)
     values ($1,'journal','Something raw I wrote at midnight','authored','kept')`, [m]);

  const out = await memberLanguage(db, m);
  assert.equal(out.length, 0, 'consent is the filter — a proposal is not a phrase she chose, and a journal is not a keeper');
});

test('"don\'t use that" takes effect immediately, and everywhere the phrase appears', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  const words = 'I stopped pretending I was fine at work';
  await keep(db, m, words, 'tell');
  // The SAME sentence also kept under a different type — she is asking us to stop using a THING SHE SAID, not one row.
  await keep(db, m, words, 'definition');
  assert.equal((await memberLanguage(db, m)).length, 2);

  // Punctuation and casing differ from what she is objecting to; it must still match.
  assert.equal(await setAsidePhrase(db, m, '  I Stopped Pretending I Was Fine At Work.  '), true);
  assert.equal((await memberLanguage(db, m)).length, 0, 'gone from every source, not just the one');
});

test('setting a phrase aside does NOT delete it from her Playbook', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  await keep(db, m, 'The room where I was most myself', 'lights_you_up');
  await setAsidePhrase(db, m, 'The room where I was most myself');

  const { rows } = await db.query<{ n: string }>(
    `select count(*) as n from playbook_entry where member_id = $1 and state = 'kept'`, [m]);
  // She asked us to stop QUOTING it, not to erase something she chose to keep. Different acts.
  assert.equal(Number(rows[0]!.n), 1, 'the keeper survives');
  assert.equal((await memberLanguage(db, m)).length, 0, 'it is simply never quoted');
});

test('saying it twice is one decision, not an error', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  await keep(db, m, 'Peace and optimism at home', 'principle');
  assert.equal(await setAsidePhrase(db, m, 'Peace and optimism at home'), true);
  assert.equal(await setAsidePhrase(db, m, 'peace and optimism at home'), true, 'repeating must not throw');
});

test('normalise() and the migration describe the SAME rule', () => {
  // The column comment promises "lower-cased, whitespace-collapsed, punctuation-stripped". If the function drifts
  // from that, suppression silently stops matching and she keeps hearing a phrase she asked us to drop.
  assert.equal(normalise('  Peace,  and   OPTIMISM at home! '), 'peace and optimism at home');
  assert.equal(normalise('“It’s the quiet one.”'), 'its the quiet one');
});

// ─── THE RETURN MOMENT ────────────────────────────────────────────────────────────────────────────────────────

test('it reaches back to the OLDEST phrase — the distance is the evidence', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  const { pickReturnReflection } = await import('../lib/member/language-history.ts');

  await db.query(
    `insert into playbook_entry (member_id, section, body, authorship, state, keeper_type, created_at)
     values ($1,'what_works','I stopped pretending I was fine at work','gathered','kept','tell', now() - interval '40 days'),
            ($1,'what_works','This week I caught it before it caught me','gathered','kept','principle', now() - interval '1 day')`,
    [m],
  );

  const r = await pickReturnReflection(db, m, 'False Start Protocol');
  // Greg's C1-22 is growth "across three modules". The NEWEST line would only prove she was recently in a
  // Session; the oldest is what makes the distance visible.
  assert.equal(r!.quote, 'I stopped pretending I was fine at work');
  assert.equal(r!.finished, 'False Start Protocol');
});

test('it never quotes a line from the Session she just closed', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  const { pickReturnReflection } = await import('../lib/member/language-history.ts');

  await db.query(
    `insert into playbook_entry (member_id, section, body, authorship, state, keeper_type, source_ref)
     values ($1,'what_works','Something I said ten minutes ago in this very session','gathered','kept','tell','RWIR-W3')`,
    [m],
  );
  // Quoting the Session she just finished is a recap of the last ten minutes — the thing Donna said has no value.
  assert.equal(await pickReturnReflection(db, m, 'False Start Protocol', 'RWIR-W3'), null);
});

test('a phrase she set aside is never chosen for the return moment', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  const { pickReturnReflection } = await import('../lib/member/language-history.ts');
  const words = 'I stopped pretending I was fine at work';
  await keep(db, m, words, 'tell');
  await setAsidePhrase(db, m, words);
  // The filter lives in memberLanguage, so every consumer inherits it — no caller has to remember.
  assert.equal(await pickReturnReflection(db, m, 'False Start Protocol'), null);
});

test('a member with nothing kept gets no reflection — silence, not a generic line', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  const { pickReturnReflection } = await import('../lib/member/language-history.ts');
  // "How did that land?" was the old fallback and it has no value (Jay). Nothing honest to say → say nothing.
  assert.equal(await pickReturnReflection(db, m, 'False Start Protocol'), null);
});

test('a fragment is never quoted back', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  const { pickReturnReflection } = await import('../lib/member/language-history.ts');
  await keep(db, m, 'the bike', 'lights_you_up'); // true, hers, and meaningless read aloud
  assert.equal(await pickReturnReflection(db, m, 'False Start Protocol'), null);
});
