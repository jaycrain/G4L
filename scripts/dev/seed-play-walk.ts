// Dev-only: seed a real, loginnable member who has walked Rewire W1 and harvested a "true line" PLAY, so the
// Playbook's "Run it again with your Companion" button can be seen live. Runs the ACTUAL arc + persist path
// (not a fake insert). Local pglite only. Run: node --env-file .env.local --experimental-strip-types scripts/dev/seed-play-walk.ts
import { getDb } from '../../lib/db/index.ts';
import { seedDemoMembers } from '../db/seed-demo.ts';
import { rewireOpening, applyRewireTurn } from '../../lib/agent/rewire.ts';
import { emitHarvestMoment, commitKeeper } from '../../lib/agent/harvest.ts';
import { createCredential } from '../../lib/auth/store.ts';
import { hashPassword } from '../../lib/auth/password.ts';

const db = await getDb();
const seeded = await seedDemoMembers(db);
const tom = seeded.find((s) => s.name === 'Tom Miller') ?? seeded[0]!;

// Drive the real W1 arc to the turn, then write a true line → the arc harvests the play.
const LIES = ["it's just age", 'the drink helps me unwind', 'no room for me', "I'm not that person", 'too late to start'];
const LAST = 'That last one is heavy, and you said it plainly. Look at all five — each keeps you where you are. What’s the honest line you’d put in place of “it’s too late”?';
let t = rewireOpening();
LIES.forEach((lie, i) => {
  t = applyRewireTurn(t.state, [], lie, { text: i === LIES.length - 1 ? LAST : 'That’s the story.' });
});
t = applyRewireTurn(t.state, [], 'My body responds to what I ask of it — at any age', { text: 'Kept. Any others?' });
const item = (t.state.pendingHarvest ?? [])[0]!;

// Persist EXACTLY as app/rewire/actions.ts persistRewireHarvest does.
const momentId = await emitHarvestMoment(db, tom.memberId, {
  destinationIntent: item.destinationIntent,
  keeperType: item.keeperType as 'principle',
  surface: 'rewire',
  sourceRef: { kind: item.kind, ref: item.kind, label: item.label ?? item.kind },
  payloadRef: item.payloadRef,
});
await commitKeeper(db, tom.memberId, {
  momentId,
  keeperType: item.keeperType as 'principle',
  section: 'own_words',
  body: item.payloadRef,
  state: 'kept',
  source: { kind: 'own', ref: item.kind, label: item.label ?? item.kind },
});

await createCredential(db, tom.memberId, 'demo-tom@grintaforlife.test', await hashPassword('Test1234!'));

console.log(`\n✓ MEMBER      ${tom.memberId}`);
console.log(`✓ LOGIN       demo-tom@grintaforlife.test / Test1234!`);
console.log(`✓ PLAY        principle "${item.payloadRef}" (label="${item.label}")`);
console.log(`✓ PLAYBOOK    /playbook/${tom.memberId}`);
process.exit(0);
