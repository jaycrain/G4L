// CLI wrapper around the fresh-member fixture. The fixture itself — and every word explaining why it exists —
// lives in lib/demo/fresh-member.ts, because the operator button at /admin/fresh calls the same function.
//
// A TERMINAL command, from the repo root. NOT the Supabase SQL Editor. Saying so because it went wrong once:
// prod database work on this project normally arrives as paste-ready SQL for the SQL Editor, so a bare shell
// invocation with no label got pasted there and errored on line 1.
//
//   local:  SMOKE_FRESH_EMAIL=fresh@grintaforlife.test SMOKE_FRESH_PASSWORD=... npm run db:seed-fresh
//
// FOR PRODUCTION, USE /admin/fresh INSTEAD. Running this against prod means holding the production connection
// string in a shell, and the answer to "how do I reset the fixture" should not be a credential.
import { getDb } from '../../lib/db/index.ts';
import { seedFreshMember, FRESH_EMAIL } from '../../lib/demo/fresh-member.ts';

const email = process.env.SMOKE_FRESH_EMAIL?.trim() || FRESH_EMAIL;
const password = process.env.SMOKE_FRESH_PASSWORD;
if (!password) {
  console.error('Set SMOKE_FRESH_PASSWORD in the environment first.');
  process.exit(1);
}
const memberId = await seedFreshMember(await getDb(), email, password);

console.log(`\nfresh member ready: ${email}`);
console.log(`  member_id           ${memberId}`);
console.log(`  ID Score            none  → /score shows its empty state`);
console.log(`  Grinta reading      none  → /grinta shows its empty state`);
console.log(`  badges / Moves      none  → panels show their zero state`);
console.log(`  threshold + tour    not seen → BOTH fire on the next dashboard visit`);
console.log(`\nRe-run this to watch the tour again — it is one-shot per member.`);
