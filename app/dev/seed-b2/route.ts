import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db/index.ts';
import { currentMemberId } from '../../auth.ts';
import { assertDevOnly } from '../guard.ts';
import type { Db } from '../../../lib/db/schema.ts';
import { persistSkillsReading } from '../../../lib/rebuild/store.ts';

// LOCAL DEV ONLY — plant a B2 self-management reading on the signed-in DEMO member so the map can be walked.
//
// WHY THIS EXISTS. B2's map renders only for a member who has completed the twelve-item instrument, and the demo
// seeder makes members without one. That is the same gap that let W3's grid go months without an end-to-end walk
// (see /dev/seed-w3): a surface nobody can reach is a surface nobody checks.
//
// SAFETY — the same three gates as the other dev routes, in this order:
//   1. assertDevOnly() — 404s on a production build or whenever DATABASE_URL is set, so it cannot exist on Vercel.
//   2. POST only — a GET that mutates is one prefetch away from planting rows by accident.
//   3. The signed-in member must be a DEMO (.test) account, and it only ever touches THAT member's own rows.
//
// THE SHAPE IS DELIBERATE, not random. It plants a profile with an UNEVEN family spread, because an even one is
// the degenerate case: skills-map.ts correctly returns `thinnest: null` for a flat profile and the lead line has
// nothing to name. A walk against flat data would pass while proving nothing about the read that matters.
//   · Getting ready (6,7,12)      → strong  — the member arrives ready
//   · Taking action (1,3,4,5,8,11) → mixed
//   · Staying with it (2,9,10)     → thin    — what the lead line should name
// Skill 11 (time management) carries a 2-point movement/eating split, so the divergence note has something to
// render; every other skill is level, so exactly one row should show it.
const RESPONSES = [
  // activity, skills 1-12
  4, 2, 5, 4, 4, 5, 5, 3, 2, 2, 5, 5,
  // diet, skills 1-12
  4, 2, 5, 4, 3, 5, 5, 3, 2, 2, 3, 5,
];

export async function POST(): Promise<NextResponse> {
  assertDevOnly();

  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const db = (await getDb()) as unknown as Db;
  const { rows } = await db.query<{ email: string }>('select email from member_profile where member_id = $1', [memberId]);
  const email = rows[0]?.email ?? '';
  if (!/\.test$/i.test(email)) {
    return NextResponse.json({ error: 'Demo (.test) accounts only.' }, { status: 403 });
  }

  await db.query(`delete from self_management_reading where member_id = $1 and source = 'b2'`, [memberId]);
  await persistSkillsReading(db, memberId, RESPONSES);

  return NextResponse.json({ ok: true, seeded: 'b2 self-management reading' });
}
