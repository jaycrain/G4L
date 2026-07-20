import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { generateOutreach } from '../lib/agent/outreach.ts';
import { validateOutreach } from '../lib/outreach/validate.ts';
import { nextOutreach } from '../lib/outreach/engine.ts';
import { gatherSources } from '../lib/outreach/sources.ts';
import type { GenerateInput } from '../lib/outreach/engine.ts';
import type { Provenance } from '../lib/outreach/config.ts';

const src = (over: Partial<Provenance>): Provenance => ({ stream: 'words', ref: 'keeper:1', quote: 'I used to run before work', ...over });
const input = (over: Partial<GenerateInput> = {}): GenerateInput => ({
  trigger: 'morning_presence', tense: 'present', planEarned: false, sources: [src({})], ...over,
});
// The generator's output must pass the real §10 gate under normal surface conditions.
const passesValidator = (d: Awaited<ReturnType<typeof generateOutreach>>) =>
  validateOutreach(d, { cadenceOk: true, dismissible: true });

test('scripted draft is grounded in the source and validator-clean', async () => {
  const d = await generateOutreach(input());
  assert.equal(d.provenance?.ref, 'keeper:1');
  assert.equal(d.hasPlan, false);
  assert.equal(d.questionCount, 1);
  assert.match(d.text, /I used to run before work/);
  assert.ok(passesValidator(d).ok, 'passes §10: ' + passesValidator(d).failures.join('; '));
});

test('every stream × tense produces a validator-clean, single-question draft', async () => {
  const streams: Provenance['stream'][] = ['words', 'reclaim', 'pattern'];
  const tenses = ['present', 'practice', 'horizon'] as const;
  for (const stream of streams) {
    for (const tense of tenses) {
      const quote = stream === 'pattern' ? '2 good calls and 1 false start in the last 7 days' : 'be the athlete again';
      const d = await generateOutreach(input({ tense, sources: [src({ stream, ref: `${stream}:1`, quote })] }));
      const v = passesValidator(d);
      assert.ok(v.ok, `${stream}/${tense} failed §10: ${v.failures.join('; ')} — "${d.text}"`);
      assert.equal(d.questionCount, 1, `${stream}/${tense} not exactly one question: "${d.text}"`);
    }
  }
});

test('a reclaim_milestone draft carries an explicit autonomy easy-out (§6)', async () => {
  const d = await generateOutreach(input({ trigger: 'reclaim_milestone', sources: [src({ stream: 'reclaim', ref: 'reclaim:9', quote: 'run a 5k again' })] }));
  assert.match(d.text, /no pressure|your call|if you want|up to you/i);
  assert.ok(passesValidator(d).ok, 'milestone passes §10: ' + passesValidator(d).failures.join('; '));
});

test('distress-laden source is dropped, never reflected back (crisis inheritance)', async () => {
  const d = await generateOutreach(input({
    sources: [src({ ref: 'keeper:distress', quote: "I don't want to be here anymore" })],
  }));
  assert.equal(d.provenance, null, 'no safe source → ungrounded shell');
  assert.equal(d.text, '');
  assert.ok(!passesValidator(d).ok, 'the validator holds an ungrounded shell');
});

test('a safe source is chosen even when a distress source is present', async () => {
  const d = await generateOutreach(input({
    sources: [src({ ref: 'keeper:distress', quote: 'I want to die' }), src({ ref: 'keeper:safe', quote: 'coaching the kids team' })],
  }));
  assert.equal(d.provenance?.ref, 'keeper:safe');
  assert.match(d.text, /coaching the kids team/);
});

test('end-to-end through the engine with the REAL generator + sources (scripted, no key)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Gen QA','gen.qa@x.com') returning member_id`,
  );
  const id = rows[0]!.member_id;
  await db.query(`insert into reclaim_item (member_id, text, sort_order) values ($1,'Get back on the bike',0)`, [id]);

  const r = await nextOutreach(db, id, 'morning_presence', new Date('2026-07-19T18:00:00Z'), {
    loadContext: async () => ({ phase: 'reconnect', sessionsInPhase: 0 }),
    gatherSources,
    generate: generateOutreach,
  });
  assert.equal(r.status, 'ready', 'a grounded, governed nudge is produced end-to-end');
  assert.match((r as { draft: { text: string } }).draft.text, /Get back on the bike/);
});
