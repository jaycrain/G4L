// Dev-only: seed a COMPLETE onboarding session so /onboarding resumes straight to the confirmation card —
// used to visually verify the Grinta baseline block without walking the whole live conversation. Run it and
// let it EXIT before starting the dev server (both open the same .pglite dir). Then load /onboarding and enter
// the seeded email (any name + an 8+ char password) to land on the card.
//   node --experimental-strip-types scripts/dev/seed-grinta-card.ts
import { getPgliteDb } from '../../lib/db/pglite.ts';
import { saveOnboardingSession } from '../../lib/agent/onboarding-session.ts';
import type { ConvState } from '../../lib/agent/onboarding.ts';

const EMAIL = 'grinta-card-demo@example.com';

const state: ConvState = {
  stage: 'complete',
  collected: {
    identityNoun: 'Runner',
    identitySkipped: false,
    athleticPast: 'a runner who was up before dawn for the quiet miles',
    gap: 'After my divorce I stopped running, and slowly lost the person who got up at dawn for it.',
    doors: ['marriage'],
    reclaimList: ['run at dawn again', 'my quiet mornings back', 'feeling strong in my body'],
    reclaimCategories: ['physical', 'self', 'physical'],
    grintaBaseline: { strands: { reconnect: 3.33, rewire: 2.67, rebuild: 4, reclaim: 3.67 }, composite: 3.42 },
  },
  administeredResponses: [3, 4, 3, 2, 3, 3, 4, 4, 4, 4, 3, 4],
};

const messages = [
  { role: 'agent' as const, text: 'That’s your list — thank you for trusting me with it.' },
  { role: 'member' as const, text: '4' },
  {
    role: 'agent' as const,
    text:
      'That’s the whole check-in — thank you for staying with it.\n\nYour starting Grinta is 3.42 out of 5. ' +
      'Grinta is grit: the resilience you build by closing each R, one strand at a time. This is just where ' +
      'you’re standing today — nothing to grade, everything to build on.\n\nTake a look at what I’ve captured ' +
      'from our whole conversation below. Nothing’s saved yet, so if anything’s off, we’ll fix it. Reconnect is ' +
      'first — and it’s already lit.',
  },
];

const db = await getPgliteDb();
await saveOnboardingSession(db, EMAIL, 'seed-token', state, messages);
console.log(`Seeded a complete onboarding session for ${EMAIL} — load /onboarding and enter that email.`);
process.exit(0);
