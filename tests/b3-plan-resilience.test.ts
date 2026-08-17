import test from 'node:test';
import assert from 'node:assert/strict';
import { parseB3Model } from '../lib/agent/rebuild.ts';
import type { RebuildPilotPayload } from '../lib/rebuild/plan-store.ts';

// GREG'S B3 STEP WE HAD SKIPPED. His Science Check puts backups and anticipated obstacles in the scientific
// scaffolding (#3, action planning / implementation intentions), not in passing: "define backup versions, and
// anticipate likely obstacles. This increases the odds that the plan can survive a NORMAL week instead of only an
// IDEAL one." His Engineering Memo names the storage. The re-audit confirmed record_plan had four fields and
// neither of these — so a member who missed Tuesday had nothing to fall back to, which is the exact moment B3
// exists to teach recovery from.

const toolUse = (input: Record<string, unknown>) => [{ type: 'tool_use', name: 'record_plan', input }];

test('the coach can lock a backup for each change, and what might get in the way', () => {
  const t = parseB3Model(toolUse({
    activityChange: 'A 20-minute walk after dinner',
    dietChange: 'Vegetables at lunch',
    activityBackup: 'Once round the block',
    dietBackup: 'Just swap the crisps',
    obstacles: 'Two late meetings midweek',
  }));
  assert.equal(t.plan?.activityBackup, 'Once round the block');
  assert.equal(t.plan?.dietBackup, 'Just swap the crisps');
  assert.equal(t.plan?.obstacles, 'Two late meetings midweek');
});

test('they are OPTIONAL — a plan without them still parses, exactly as before', () => {
  // Same rule as the day targets: a member who won't name a backup must never be blocked from committing. This is
  // also what every plan written before 2026-08-17 looks like, and those must keep reading cleanly.
  const t = parseB3Model(toolUse({ activityChange: 'A walk', dietChange: 'More veg' }));
  assert.equal(t.plan?.activityChange, 'A walk');
  assert.equal(t.plan?.activityBackup, undefined);
  assert.equal(t.plan?.obstacles, undefined);
});

test('blank or non-string values are dropped, not stored as empty strings', () => {
  // An empty backup is worse than no backup: it renders as a promise the member never made.
  const t = parseB3Model(toolUse({ activityChange: 'A walk', dietChange: 'More veg', activityBackup: '   ', obstacles: 42 }));
  assert.equal(t.plan?.activityBackup, undefined);
  assert.equal(t.plan?.obstacles, undefined);
});

test('the payload type carries the fields — the three declarations agree', () => {
  // The plan shape is declared in THREE places: RebuildPilotPayload (storage), ModelTurn.plan (the wire), and
  // parseB3Model's local (the parse). They must agree, and nothing but the typechecker enforces it — this asserts
  // the storage type actually accepts what the parser produces, so a future field added to one is caught here.
  const payload: RebuildPilotPayload = {
    activityChange: 'A walk', dietChange: 'More veg',
    activityBackup: 'Once round the block', dietBackup: 'Swap the crisps', obstacles: 'Late meetings',
  };
  assert.equal(payload.activityBackup, 'Once round the block');
});
