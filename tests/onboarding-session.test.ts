import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import {
  saveOnboardingSession,
  loadOnboardingSession,
  clearOnboardingSession,
} from '../lib/agent/onboarding-session.ts';
import type { ConvState, ConvMessage } from '../lib/agent/onboarding.ts';

async function db(): Promise<Db> {
  const d = new PGlite() as unknown as Db;
  await applySchema(d);
  return d;
}

const state: ConvState = { stage: 'reclaim', collected: { athleticPast: 'a cyclist', identityNoun: 'Cyclist' } };
const messages: ConvMessage[] = [
  { role: 'agent', text: 'who were you?' },
  { role: 'member', text: 'a cyclist who rode every weekend' },
];

test('save then load round-trips state + transcript (matching token)', async () => {
  const d = await db();
  await saveOnboardingSession(d, 'jay@x.com', 'tok-1', state, messages);
  const got = await loadOnboardingSession(d, 'jay@x.com', 'tok-1');
  assert.ok(got);
  assert.equal(got!.state.stage, 'reclaim');
  assert.equal(got!.state.collected.identityNoun, 'Cyclist');
  assert.equal(got!.messages.length, 2);
  assert.equal(got!.messages[1]!.text, 'a cyclist who rode every weekend');
});

test('a wrong token does NOT resume (no resuming someone else by guessing the email)', async () => {
  const d = await db();
  await saveOnboardingSession(d, 'jay@x.com', 'tok-1', state, messages);
  assert.equal(await loadOnboardingSession(d, 'jay@x.com', 'tok-WRONG'), null);
});

test('saving again upserts (one in-flight session per email)', async () => {
  const d = await db();
  await saveOnboardingSession(d, 'jay@x.com', 'tok-1', state, messages);
  const advanced: ConvState = { stage: 'door', collected: { ...state.collected, reclaimList: ['a', 'b', 'c'] } };
  await saveOnboardingSession(d, 'jay@x.com', 'tok-1', advanced, [...messages, { role: 'agent', text: 'how did the gap open?' }]);
  const got = await loadOnboardingSession(d, 'jay@x.com', 'tok-1');
  assert.equal(got!.state.stage, 'door');
  assert.equal(got!.messages.length, 3);
  const n = (await d.query<{ n: number }>("select count(*)::int n from onboarding_session where email='jay@x.com'")).rows[0]!.n;
  assert.equal(n, 1);
});

test('clear removes the session (completion)', async () => {
  const d = await db();
  await saveOnboardingSession(d, 'jay@x.com', 'tok-1', state, messages);
  await clearOnboardingSession(d, 'jay@x.com');
  assert.equal(await loadOnboardingSession(d, 'jay@x.com', 'tok-1'), null);
});
