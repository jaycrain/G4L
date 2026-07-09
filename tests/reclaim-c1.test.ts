import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reclaimC1Opening, applyReclaimC1Turn } from '../lib/agent/reclaim.ts';
import { EVIDENCE_ITEMS, EVIDENCE_ITEM_COUNT, EVIDENCE_PART_STARTS, EVIDENCE_PART_LABEL } from '../lib/reclaim/evidence-instrument.ts';

// C1 · Readiness Assessment · Step 1 — the administered evidence self-check. FORMATIVE (RC-2): 15 items, three parts,
// nothing scored or persisted; closes on the reflective "are you in Reclaim" mirror.

test('C1 Step 1 · warm frame → 15 evidence items in three parts → reflective close (no score)', () => {
  let t = reclaimC1Opening();
  assert.equal(t.state.stage, 'evidence');
  assert.match(t.reply, /recognize in yourself/i, 'the warm frame');
  assert.match(t.reply, /1 \(strongly disagree\) to 5/i, 'the 1–5 scale');
  assert.ok(t.reply.includes(EVIDENCE_ITEMS[0]!.stem), 'item 0 verbatim');
  assert.match(t.reply, /The Physical Evidence/i, 'part A header');

  for (let i = 0; i < EVIDENCE_ITEM_COUNT; i++) {
    assert.equal(t.state.stage, 'evidence', `administering item ${i}`);
    assert.equal(t.complete, false);
    // part headers appear at the cluster starts (5 = relational, 10 = identity)
    if (i === 5) assert.match(t.reply, new RegExp(EVIDENCE_PART_LABEL[EVIDENCE_PART_STARTS[5]!], 'i'));
    if (i === 10) assert.match(t.reply, new RegExp(EVIDENCE_PART_LABEL[EVIDENCE_PART_STARTS[10]!], 'i'));
    t = applyReclaimC1Turn(t.state, [], '4');
  }
  assert.equal(t.complete, true, 'after the 15th, C1 Step 1 completes');
  assert.equal(t.state.stage, 'complete');
  assert.match(t.reply, /you're in Reclaim/i, 'the reflective mirror');
  assert.match(t.reply, /cycle, not a checklist/i, 'not all-or-nothing');
  assert.match(t.reply, /revisit your Reclaim List/i, 'bridges toward Step 2');
  assert.doesNotMatch(t.reply, /\bscore\b|\/\s*5\b/i, 'RC-2: formative — no score at the close');
});

test('C1 Step 1 · a non-number is re-prompted, not advanced (instrument fidelity)', () => {
  const t = reclaimC1Opening();
  const bad = applyReclaimC1Turn(t.state, [], 'pretty true');
  assert.equal(bad.state.stage, 'evidence', 'a non-Likert answer does not advance');
  assert.equal((bad.state.administeredResponses ?? []).length, 0, 'nothing recorded');
  assert.match(bad.reply, /1 to 5/i, 're-prompts');
});

test('evidence-instrument · 15 items, 5 per part, in Physical→Relational→Identity order', () => {
  assert.equal(EVIDENCE_ITEM_COUNT, 15);
  assert.equal(EVIDENCE_ITEMS.filter((i) => i.part === 'physical').length, 5);
  assert.equal(EVIDENCE_ITEMS.filter((i) => i.part === 'relational').length, 5);
  assert.equal(EVIDENCE_ITEMS.filter((i) => i.part === 'identity').length, 5);
  assert.equal(EVIDENCE_ITEMS[0]!.part, 'physical');
  assert.equal(EVIDENCE_ITEMS[5]!.part, 'relational');
  assert.equal(EVIDENCE_ITEMS[10]!.part, 'identity');
});
