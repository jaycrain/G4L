import { NextResponse } from 'next/server';
import { payloadKind } from '../../../lib/db/jsonb.ts';
import { getDb } from '../../../lib/db/index.ts';
import { currentMemberId } from '../../auth.ts';
import { assertDevOnly } from '../guard.ts';
import type { Db } from '../../../lib/db/schema.ts';

// Reset ONE in-flight session for the signed-in demo member, so an end-to-end walk can run twice in a row.
//
// WHY THIS EXISTS. `npm run walk:c2` needs a FRESH audit — C2 correctly resumes an in-flight session, so a second
// run (or any earlier crashed one) starts mid-conversation and the walk refuses. Before this, clearing that meant
// `rm -rf .pglite`, re-seeding, resetting the demo password and restarting the dev server, every single time. A
// walk that costs four commands and a restart is a walk people stop running — which is exactly why C2 had no
// end-to-end coverage for months, and why a state bug survived in it until 2026-08-09.
//
// The walk CANNOT do this itself: the dev server holds the PGlite directory open, and a standalone script that
// opens it while the server is running corrupts the data dir (docs/runbooks + memory: it happened twice that day,
// and the symptom is a 64KB bundle dump instead of an error). The reset has to happen INSIDE the server process.
//
// SAFETY. Three independent gates, in this order:
//   1. assertDevOnly() — 404s on a production build or whenever DATABASE_URL is set, so this cannot exist on
//      Vercel or against hosted Postgres. Same gate the /dev "view as member" tools use.
//   2. POST only — a GET that mutates is one prefetch away from wiping a session by accident.
//   3. The signed-in member must be a DEMO (.test) account, and it only ever touches THAT member's own rows.
// It clears working state (the in-flight arc session, this cycle's audit reading, the session-progress row). It
// never deletes a member, credentials, or anything belonging to someone else.

const CLEARABLE = new Set(['c1', 'c2', 'c3', 'c4']);

export async function POST(req: Request): Promise<NextResponse> {
  assertDevOnly();

  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ ok: false, error: 'not signed in' }, { status: 401 });

  const session = new URL(req.url).searchParams.get('session') ?? 'c2';
  if (!CLEARABLE.has(session)) {
    return NextResponse.json({ ok: false, error: `unknown session "${session}"` }, { status: 400 });
  }

  const db = (await getDb()) as unknown as Db;

  // DEMO ACCOUNTS ONLY — belt and braces behind the dev gate. If this ever ran somewhere it shouldn't, the worst
  // it could reach is a throwaway .test account rather than a member's real work.
  const { rows } = await db.query<{ email: string }>(
    'select email from member_profile where member_id = $1',
    [memberId],
  );
  const email = rows[0]?.email ?? '';
  if (!/\.test$/i.test(email)) {
    return NextResponse.json({ ok: false, error: 'refusing: not a demo (.test) account' }, { status: 403 });
  }

  await db.query('delete from arc_session where member_id = $1 and arc = $2', [memberId, `reclaim:${session}`]);
  await db.query('delete from session_progress where member_id = $1 and session_id = $2', [
    memberId,
    `RCL-${session.toUpperCase()}`,
  ]);
  // C2's durable register, so the walk starts from no reading rather than appending a second sequence.
  if (session === 'c2') await db.query('delete from bigger_world_reading where member_id = $1', [memberId]);

  // C3's durable registers. Without these a second run finds an existing profile, so the log surface renders
  // already-defined and the DEFINING half of the walk is never exercised — the walk would pass while testing half
  // the feature. Scoped by payload kind, not just phase: `coaching_plan` hosts more than one reclaim payload shape
  // (C1's refinement snapshots live here too), and a phase-only delete would take an unrelated plan with it.
  if (session === 'c3') {
    // Kind matched in JS for the same reason as the readers — `payload->>'kind'` is NULL on a jsonb string, so
    // this delete quietly cleared nothing on a Postgres-backed dev DB. See lib/db/jsonb.ts.
    const { rows: plans } = await db.query<{ id: string; payload: unknown }>(
      `select id, payload from coaching_plan where member_id = $1 and phase = 'reclaim'`,
      [memberId],
    );
    const ids = plans.filter((r) => payloadKind(r.payload) === 'quality_day_profile').map((r) => r.id);
    if (ids.length) await db.query('delete from coaching_plan where id = any($1::uuid[])', [ids]);
    await db.query('delete from quality_day_log where member_id = $1', [memberId]);
  }

  return NextResponse.json({ ok: true, session, memberId });
}
