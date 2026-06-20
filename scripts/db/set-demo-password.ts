// One-time setup for the post-deploy smoke test: give a DEMO member a password so the smoke run can
// log in through the real /login form. Reads SMOKE_EMAIL + SMOKE_PASSWORD from the environment — a
// SECRET, never committed and never logged here. Targets whatever DATABASE_URL points at (local
// pglite if unset; the hosted DB if set). Hard refuses any non-demo (.test) account, so it can never
// touch a real member. Run: SMOKE_EMAIL=... SMOKE_PASSWORD=... npm run db:set-demo-password
import { getDb } from '../../lib/db/index.ts';
import { hashPassword } from '../../lib/auth/password.ts';
import { createCredential } from '../../lib/auth/store.ts';

const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) {
  console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD in the environment first.');
  process.exit(1);
}
if (!/\.test$/i.test(email)) {
  console.error(`Refusing: ${email} is not a demo (.test) account. Smoke login is demo-only.`);
  process.exit(1);
}

const db = await getDb();
const { rows } = await db.query<{ member_id: string; email: string }>(
  'select member_id, email from member_profile where lower(email) = lower($1)',
  [email],
);
const member = rows[0];
if (!member) {
  console.error(`No member found for ${email}. Seed demo members first (npm run db:seed-demo).`);
  process.exit(1);
}
await createCredential(db, member.member_id, member.email, await hashPassword(password));
console.log(`✓ Password set for demo account ${member.email} (${member.member_id}).`);
process.exit(0);
