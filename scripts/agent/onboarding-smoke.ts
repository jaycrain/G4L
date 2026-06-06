// One-turn live smoke of the conversational onboarding (live Claude tool-use path).
// Run: env -u ANTHROPIC_API_KEY node --env-file=.env.local --experimental-strip-types scripts/agent/onboarding-smoke.ts
import { onboardingNextTurn, OPENING_REPLY, INITIAL_STATE } from '../../lib/agent/onboarding.ts';

const ctx = { name: 'Test Member', email: 'test@example.com' };
const history = [{ role: 'agent' as const, text: OPENING_REPLY }];
const memberMessage =
  'I was a competitive cyclist — raced every weekend for fifteen years until my knees gave out.';

console.log(`Mode: ${process.env.ANTHROPIC_API_KEY ? 'live (anthropic)' : 'scripted'}\n`);
const t = await onboardingNextTurn({ ctx, state: INITIAL_STATE, history, memberMessage });
console.log('Agent reply:\n', t.reply, '\n');
console.log('Captured so far:', JSON.stringify(t.state.collected));
console.log('Complete:', t.complete);
