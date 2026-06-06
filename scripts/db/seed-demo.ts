// Seed clearly-FAKE demo members so a public preview isn't empty. Uses the offline scripted
// agent (no API cost) and the same flow code as the app. Targets whatever DATABASE_URL points
// at (Supabase in prod) or local pglite. Run: npm run db:seed-demo
//
// Demo data only — never seed against a database that holds real members.

import { getDb } from '../../lib/db/index.ts';
import { scriptedProvider } from '../../lib/agent/provider.ts';
import { runOnboarding, submitIdq } from '../../lib/gateway/flow.ts';
import { completeAsset } from '../../lib/assets/engine.ts';
import { assignVariant } from '../../lib/assets/variant.ts';

type Demo = {
  fields: Parameters<typeof runOnboarding>[2];
  responses: number[];
  completeR4?: boolean;
};

const r7 = (a: string[]) => a;

const DEMOS: Demo[] = [
  {
    fields: {
      displayName: 'Demo — Tom', email: 'demo-tom@grintaforlife.test', door: 'career_cliff', identityNoun: 'athlete',
      athleticPast: 'competitive cyclist, raced every weekend', gap: 'the role ended and the bike gathered dust',
      rightNow: 'winded on the stairs, rebuilding slowly',
      reclaimList: r7(['ride again', 'sleep well', 'coach a friend', 'climb', 'reconnect with Dana', 'race Moab', 'feel strong']),
    },
    responses: [2, 2, 3, 2, 2, 3, 4, 4, 3, 4, 4, 3, 3, 2, 3, 3, 2, 3, 4, 4, 3, 4, 3, 4], // mixed; lower Physical
    completeR4: true,
  },
  {
    fields: {
      displayName: 'Demo — Reshma', email: 'demo-reshma@grintaforlife.test', door: 'diagnosis', identityNoun: 'runner',
      athleticPast: 'marathoner who ran before dawn', gap: 'a diagnosis stopped me cold',
      rightNow: 'cautious, slower, unsure of my body',
      reclaimList: r7(['run a 5k', 'sleep deep', 'travel', 'garden', 'call mom weekly', 'cook again', 'laugh more']),
    },
    responses: Array.from({ length: 24 }, () => 3), // flat 60
  },
];

const db = await getDb();
for (const d of DEMOS) {
  const ob = await runOnboarding(db, scriptedProvider, d.fields);
  if (!ob.ok) {
    console.log(`skip ${d.fields.displayName}: ${'errors' in ob ? ob.errors.join('; ') : 'crisis'}`);
    continue;
  }
  await submitIdq(db, ob.memberId, d.responses);
  if (d.completeR4) {
    await completeAsset(db, { memberId: ob.memberId, code: 'R-4', variant: assignVariant(ob.memberId, 'R-4'), version: '0.1-draft', outputs: { excavated: ['the racer'] } });
  }
  console.log(`✓ ${d.fields.displayName} → /dashboard/${ob.memberId}`);
}
console.log('\nDemo members seeded. (Re-run after db:reset / a fresh DB.)');
process.exit(0);
