// A member talking ABOUT the conversation is never talking about her life.
//
// The NEGATIVE cases carry the weight here. This predicate decides what may be stored as a member's own words,
// so a false positive silently discards something real about her — the exact failure the voice guard made
// earlier the same day. Real material must survive even when it is a question, even when it says "you".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isConversationalMeta } from '../lib/agent/conversational-meta.ts';
import { isKeeperMaterial } from '../lib/agent/reconnect.ts';

test('META — the protest that became "The Spark" and poisoned the letter (Donna, verbatim)', () => {
  const meta = [
    'I think we already did that and you were writing a letter for me?',
    "Didn't I already answer this one?",
    'You just asked me that. Can we move on?',
    'Wait, are you writing the letter or not?',
    'I already told you that.',
    'We already did that.',
    'You asked me that already.',
    'I just said that.',
  ];
  for (const t of meta) assert.equal(isConversationalMeta(t), true, `should be caught: ${t}`);
});

test('HER LIFE IS NOT META — real material survives, including questions and second person', () => {
  const real = [
    // A reflection that ends in a question is still hers.
    'Who even am I now, if I am not the person everyone comes to?',
    // Second person about the WORLD, not about us.
    'I want work that pays you what you are actually worth.',
    'You spend twenty years building something and then it is just gone.',
    // The genuine Tuesday answer this whole beat exists to capture.
    "I'd be up early, out on the water before anyone else is awake, and I'd come home and make something.",
    'I lost my job two years ago and it took my sense of myself with it.',
    'Feeling supported and cared for',
    'I want my strength back.',
    '',
  ];
  for (const t of real) assert.equal(isConversationalMeta(t), false, `must NOT be caught: ${t}`);
});

test('SEAM — isKeeperMaterial now rejects the protest, and still keeps the real Tuesday', () => {
  // The predicate is only worth anything if the caller that caused the damage actually consults it.
  assert.equal(isKeeperMaterial('I think we already did that and you were writing a letter for me?'), false);
  assert.equal(
    isKeeperMaterial("I'd be up early, out on the water before anyone else is awake, and I'd come home and make something."),
    true,
  );
});

// ── HEAL ON READ ───────────────────────────────────────────────────────────────────────────────────────────────
//
// The write-side fix stops a protest ever becoming stored content. It does nothing for a member who is ALREADY
// carrying one — and Donna was, at the moment this shipped, mid-Reconnect with the poisoned value in her session.
// A fix that requires her to start the phase over is not a hot fix, so both consumers check at the point of USE.

import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { drainHarvest } from '../lib/agent/harvest.ts';
import { stageInstructionReconnect } from '../lib/agent/reconnect.ts';

const PROTEST = 'I think we already did that and you were writing a letter for me?';

test('HEAL — a poisoned Tuesday already in her state is ignored, so the letter beat asks properly', () => {
  const poisoned = stageInstructionReconnect('legacy', { stage: 'legacy', collected: {}, legacyTuesday: PROTEST } as never);
  assert.equal(poisoned.includes('ALREADY answered'), false, 'a protest must never be fed back as her answer');
  assert.equal(poisoned.includes(PROTEST), false, 'and must not appear in the prompt at all');

  // …while a REAL carried answer still does its job — this is the whole point of the field.
  const real = "I'd be up early, out on the water before anyone else is awake.";
  const good = stageInstructionReconnect('legacy', { stage: 'legacy', collected: {}, legacyTuesday: real } as never);
  assert.ok(good.includes('ALREADY answered'), 'a genuine Tuesday must still be carried forward');
  assert.ok(good.includes(real));
});

test('HEAL — a protest already QUEUED as a keeper is never offered as a card', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = (await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Donna','heal@x.test') returning member_id`,
  )).rows[0]!.member_id;

  // Her session's actual pendingHarvest at the time of the report: one real keeper, one protest.
  const proposals = await drainHarvest(db, m, { pendingHarvest: [] }, {
    pendingHarvest: [
      { kind: 'drift', label: 'The Fade', keeperType: 'tell', destinationIntent: 'keeper', payloadRef: 'Feeling supported and cared for' },
      { kind: 'window', label: 'The spark', keeperType: 'lights_you_up', destinationIntent: 'keeper', payloadRef: PROTEST },
    ],
  }, 'reconnect');

  assert.equal(proposals.length, 1, 'the protest must not become a card');
  assert.equal(proposals[0]!.body, 'Feeling supported and cared for', 'and the real keeper still reaches her');
});
