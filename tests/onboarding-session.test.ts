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

test('stored as real jsonb (object/array), not a double-encoded scalar string', async () => {
  const d = await db();
  await saveOnboardingSession(d, 'jay@x.com', 'tok-1', state, messages);
  // jsonb_typeof must see structured values, not a string — guards the prod double-encode regression.
  const t = (
    await d.query<{ st: string; mt: string }>(
      "select jsonb_typeof(state) st, jsonb_typeof(messages) mt from onboarding_session where email='jay@x.com'",
    )
  ).rows[0]!;
  assert.equal(t.st, 'object', 'state is a jsonb object, not a scalar string');
  assert.equal(t.mt, 'array', 'messages is a jsonb array, not a scalar string');
});

test('a wrong (present) token does NOT resume (no resuming someone else by guessing the email)', async () => {
  const d = await db();
  await saveOnboardingSession(d, 'jay@x.com', 'tok-1', state, messages);
  assert.equal(await loadOnboardingSession(d, 'jay@x.com', 'tok-WRONG'), null);
});

test('an EMPTY token recovers by email (lost-token device) and surfaces the saved token to adopt', async () => {
  const d = await db();
  await saveOnboardingSession(d, 'jay@x.com', 'tok-1', state, messages);
  const got = await loadOnboardingSession(d, 'jay@x.com', '');
  assert.ok(got, 'empty token should recover the in-flight session by email');
  assert.equal(got!.state.stage, 'reclaim');
  assert.equal(got!.token, 'tok-1'); // the client adopts this so the device re-syncs
});

test('a matching token still resumes and returns the token', async () => {
  const d = await db();
  await saveOnboardingSession(d, 'jay@x.com', 'tok-1', state, messages);
  const got = await loadOnboardingSession(d, 'jay@x.com', 'tok-1');
  assert.equal(got!.token, 'tok-1');
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

// A-02 — the "welcome back / nothing's lost" resume gate's SERVER-VERIFY predicate. The client (app/onboarding/chat.tsx)
// shows the gate optimistically, then demotes to the fresh gate + clears stale storage unless the server returns a
// session WITH messages: `if (session && session.messages.length > 0) return; clearOnboardingStorage(); …`. This encodes
// that exact decision so the copy can never over-promise (an account-wipe, expired session, or foreign-device storage).
const gateWouldResume = (s: Awaited<ReturnType<typeof loadOnboardingSession>>): boolean => !!(s && s.messages.length > 0);

test('A-02 · resume gate demotes when NO server session exists (never a false "welcome back")', async () => {
  const d = await db();
  const s = await loadOnboardingSession(d, 'wiped@x.com', '');
  assert.equal(s, null);
  assert.equal(gateWouldResume(s), false, 'no session → fresh gate');
});

test('A-02 · resume gate demotes when a session row exists but has NO messages yet', async () => {
  const d = await db();
  await saveOnboardingSession(d, 'jay@x.com', 'tok-1', state, []); // opened the gate, no turns taken
  const s = await loadOnboardingSession(d, 'jay@x.com', 'tok-1');
  assert.ok(s, 'the row exists');
  assert.equal(s!.messages.length, 0);
  assert.equal(gateWouldResume(s), false, 'empty transcript → nothing to resume → fresh gate');
});

test('A-02 · resume gate resumes truthfully when a session WITH messages exists', async () => {
  const d = await db();
  await saveOnboardingSession(d, 'jay@x.com', 'tok-1', state, messages);
  const s = await loadOnboardingSession(d, 'jay@x.com', 'tok-1');
  assert.equal(gateWouldResume(s), true, 'real in-flight work → "welcome back" is honest');
});

test('A-02 · a completed/wiped session demotes (the exact account-wipe false-promise the gate guards)', async () => {
  const d = await db();
  await saveOnboardingSession(d, 'jay@x.com', 'tok-1', state, messages);
  await clearOnboardingSession(d, 'jay@x.com'); // finished onboarding, or the account was wiped
  const s = await loadOnboardingSession(d, 'jay@x.com', 'tok-1');
  assert.equal(gateWouldResume(s), false);
});
