import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db/index.ts';
import { currentMemberId } from '../../auth.ts';
import { assertDevOnly } from '../guard.ts';
import type { Db } from '../../../lib/db/schema.ts';

// LOCAL DEV ONLY — plant a W3 monitoring week on the signed-in DEMO member so the tap path can be walked.
//
// WHY A ROUTE AND NOT A SCRIPT. scripts/dev/seed-practice-week.ts exists and requires the dev server to be STOPPED,
// because PGlite is single-process and scripting the data dir while `next dev` holds it corrupts it. A setup step
// that costs a server restart is a setup step that stops being run — which is how W3's grid went months without an
// end-to-end walk and shipped as a checkbox that did nothing. Seeding from inside the server process costs nothing.
//
// SAFETY, the same three gates as /dev/reset-session, in this order:
//   1. assertDevOnly() — 404s on a production build or whenever DATABASE_URL is set, so it cannot exist on Vercel.
//   2. POST only — a GET that mutates is one prefetch away from planting rows by accident.
//   3. The signed-in member must be a DEMO (.test) account, and it only ever touches THAT member's own rows.
//
// It plants exactly what a walk needs and nothing more: the week, two named triggers, and ONE earlier day carrying
// a written reflection — because the assertion that matters most is that a tick REFUSES to delete writing, and you
// cannot test a refusal without something to refuse over.

const TRIGGERS: [string, string][] = [
  ['brutal-week', 'A brutal week'],
  ['late-nights', 'Late nights'],
];

export async function POST(): Promise<NextResponse> {
  assertDevOnly(); // throws a Next notFound() on a production build or whenever DATABASE_URL is set

  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const db = (await getDb()) as unknown as Db;
  const { rows } = await db.query<{ email: string }>('select email from member_profile where member_id = $1', [memberId]);
  const email = rows[0]?.email ?? '';
  if (!/\.test$/i.test(email)) {
    return NextResponse.json({ error: 'Demo (.test) accounts only.' }, { status: 403 });
  }

  // The week starts THREE DAYS AGO so there is a past day to write into and a today to tick — a week that opened
  // this instant has exactly one usable column and cannot exercise the refusal at all.
  await db.query(
    `insert into practice_week (member_id, kind, started_at) values ($1,'w3_logging', now() - interval '2 days')
     on conflict (member_id, kind) do update set started_at = now() - interval '2 days', closed_at = null`,
    [memberId],
  );
  for (const [i, [slot, label]] of TRIGGERS.entries()) {
    await db.query(
      `insert into practice_commitment (member_id, kind, slot, label, sort_order)
       values ($1,'w3_logging',$2,$3,$4)
       on conflict (member_id, kind, slot) do update set label = excluded.label`,
      [memberId, slot, label, i],
    );
  }
  await db.query(`delete from w3_daily_entry where member_id = $1`, [memberId]);
  await db.query(
    `insert into w3_daily_entry (member_id, entry_date, reflection, source)
     values ($1, (now() - interval '2 days')::date, 'the words I would lose', 'companion')`,
    [memberId],
  );
  return NextResponse.json({ ok: true, memberId, triggers: TRIGGERS.map(([, l]) => l) });
}
