// Verify the Gateway schema against a real (local, in-process) Postgres via pglite.
// Applies migration 0001 + seed, checks reference data, exercises inserts, and confirms
// the frozen-contract constraints actually fire. Uses the app's own scoreIdq so the
// logic core and the schema are proven together. Run: `npm run db:verify`.

import { PGlite } from '@electric-sql/pglite';
import { scoreIdq } from '../../lib/idq/scoring.ts';
import { applySchema, type Db } from '../../lib/db/schema.ts';
import { completeAsset, completedCodes } from '../../lib/assets/engine.ts';
import { DOOR_SLUGS } from '../../lib/doors.ts';

let failures = 0;
function check(name: string, pass: boolean, detail = '') {
  console.log(`${pass ? 'ok  ' : 'FAIL'} - ${name}${detail ? `  (${detail})` : ''}`);
  if (!pass) failures++;
}
async function expectError(name: string, fn: () => Promise<unknown>, match: RegExp) {
  try {
    await fn();
    check(name, false, 'expected an error but none thrown');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    check(name, match.test(msg), msg.split('\n')[0]);
  }
}

const db = new PGlite();

// 1. Apply all migrations + seed
await applySchema(db as unknown as Db);
check('migrations + seed apply cleanly', true);

// 2. Reference data
const n = async (q: string) => ((await db.query<{ n: number }>(q)).rows[0]!.n);
check(`${DOOR_SLUGS.length} Doors seeded`, (await n('select count(*)::int n from door')) === DOOR_SLUGS.length);
check('4 IDQ dimensions seeded', (await n('select count(*)::int n from idq_dimension')) === 4);
// (The 12-gated-assets seed assertion is retired: the live product delivers via the
//  curriculum engine — registry-as-data in lib/curriculum — not the old gated-asset set.)
check(
  'canonical doors present (incl. The Vanishing)',
  (await n("select count(*)::int n from door where slug in ('career_cliff','vanishing','loss')")) === 3,
);

// 3. Happy path — a member + a baseline IDQ retake scored by the app's own engine
const memberRes = await db.query<{ member_id: string }>(
  `insert into member_profile (display_name, email, named_door, reclaim_list)
   values ($1,$2,$3,$4::jsonb) returning member_id`,
  ['Tom Miller', 'tom@example.com', 'career_cliff', JSON.stringify(
    ['ride again', 'sleep well', 'coach a friend', 'climb', 'reconnect with Dana', 'race Moab', 'feel strong'],
  )],
);
const memberId = memberRes.rows[0]!.member_id;
check('member_profile insert (reclaim_list = 7)', !!memberId);

const s = scoreIdq(Array.from({ length: 24 }, () => 3)); // all-3s → dims 18, raw 72, score 60
await db.query(
  `insert into idq_retake
     (member_id, cycle_indicator, sequence_no, responses,
      physical_score, self_score, social_score, outlook_score, id_score_raw, id_score)
   values ($1,1,0,$2::jsonb,$3,$4,$5,$6,$7,$8)`,
  [memberId, JSON.stringify(Array.from({ length: 24 }, () => 3)),
   s.dimensions.physical, s.dimensions.self, s.dimensions.social, s.dimensions.outlook,
   s.idScoreRaw, s.idScore],
);
const back = (await db.query<{ id_score: string; id_score_raw: number }>(
  'select id_score, id_score_raw from idq_retake where member_id = $1', [memberId])).rows[0]!;
check('baseline IDQ retake persists with correct score', Number(back.id_score) === 60 && back.id_score_raw === 72,
  `id_score=${back.id_score}, raw=${back.id_score_raw}`);

// 4. Constraints must actually fire
// Reclaim List contract (Decision Log, voice rewrite v1, superseding the old "exactly 7"):
// at least RECLAIM_LIST_MIN (3) items, no maximum. A list of 6 is now valid.
const sixItem = await db.query<{ member_id: string }>(
  `insert into member_profile (display_name,email,reclaim_list) values ('Six','six@y.z',$1::jsonb) returning member_id`,
  [JSON.stringify(['a', 'b', 'c', 'd', 'e', 'f'])],
);
check('reclaim_list of 6 is accepted (>= 3, no max)', !!sixItem.rows[0]?.member_id);
await expectError(
  'reclaim_list below the minimum of 3 is rejected',
  () => db.query(`insert into member_profile (display_name,email,reclaim_list) values ('Two','two@y.z',$1::jsonb)`,
    [JSON.stringify(['a', 'b'])]),
  /reclaim_list_min_3/i,
);
await expectError(
  'dimension scores must sum to id_score_raw',
  () => db.query(`insert into idq_retake
     (member_id,cycle_indicator,sequence_no,responses,physical_score,self_score,social_score,outlook_score,id_score_raw,id_score)
     values ($1,1,1,'[]'::jsonb,18,18,18,18,999,60)`, [memberId]),
  /idq_dimensions_sum_raw/i,
);
await expectError(
  'dimension score above 30 is rejected',
  () => db.query(`insert into idq_retake
     (member_id,cycle_indicator,sequence_no,responses,physical_score,self_score,social_score,outlook_score,id_score_raw,id_score)
     values ($1,1,2,'[]'::jsonb,40,18,18,18,94,78)`, [memberId]),
  /physical_score/i,
);
await expectError(
  'unknown door is rejected (FK)',
  () => db.query(`insert into member_profile (display_name,email,named_door) values ('x','z@y.z','the_career')`),
  /foreign key|violates|door/i,
);

// 5. Asset engine (migration 0002)
await completeAsset(db as unknown as Db, {
  memberId, code: 'R-4', variant: 'a', version: '0.1-draft', outputs: { excavated: ['x'] },
});
check('asset_completion persists', (await n(`select count(*)::int n from asset_completion where member_id='${memberId}'`)) === 1);
const codes = await completedCodes(db as unknown as Db, memberId);
check('completedCodes includes R-1 (baseline IDQ) + R-4', codes.has('R-1') && codes.has('R-4'));
await expectError(
  'asset variant must be a or b',
  () => db.query(`insert into asset_completion (member_id,asset_code,asset_version,variant) values ($1,'W-1','0.1-draft','c')`, [memberId]),
  /variant_chk|check/i,
);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
