// LOCAL DEV ONLY — give the SMOKE demo account a TAPPABLE b3_pilot practice week.
//
// Why this exists: the grid's tappable kinds (b2_noticing, b3_pilot) can only be reached by finishing a Session,
// so a bug in the tap path had nowhere to be reproduced. The demo account carried only MIRROR weeks (w3/c3), whose
// cells are disabled by design — a walk against it reported "element is not enabled" and proved nothing either way
// (2026-08-11, chasing a tick that appeared not to save).
//
// RUN WITH THE DEV SERVER STOPPED. pglite is single-process; scripting the data dir while `next dev` holds it
// corrupts it, and every symptom afterwards points somewhere else.
//
//   npm run dev:seed-week      (stop the dev server first)
//
// Never point this at prod, and never at jay@adjacentlabmedia.com — that is a real member record.
import { getDb } from '../lib/db/index.ts';
const db = (await getDb()) as any;
const email = process.env.SMOKE_EMAIL!;
const m = (await db.query('select member_id from member_profile where lower(email)=lower($1)', [email])).rows[0];
if (!m) { console.error('no such member'); process.exit(1); }
const id = m.member_id;
await db.query(
  `insert into practice_week (member_id, kind, started_at) values ($1,'b3_pilot', now())
   on conflict (member_id, kind) do update set started_at = now(), closed_at = null`, [id]);
for (const [slot, text] of [['activity', '15-minute morning walk'], ['diet', 'Half a piece of bread at dinner']]) {
  await db.query(
    `insert into practice_commitment (member_id, kind, slot, label, target_days)
     values ($1,'b3_pilot',$2,$3,5) on conflict (member_id, kind, slot) do update set label = excluded.label`,
    [id, slot, text]);
}
const w = (await db.query(`select kind, started_at, closed_at from practice_week where member_id=$1`, [id])).rows;
console.log('weeks now:', JSON.stringify(w));
process.exit(0);
