// C3 SETS THE WEEK UP BEFORE IT ASKS FOR THE WEEK.
//
// C3 is specified in three phases (C3.md:573): setup (stages 1–4), the tracked week (5), then a review (6–8).
// We shipped stage 2 — one coach turn that elicits the definition — and the week. Stages 1, 3 and 4 were never
// built, and they are the ones that decide whether the week actually happens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reclaimC3Opening, applyReclaimC3Turn, RECLAIM_C3_ARC } from '../lib/agent/reclaim.ts';
import type { ConvState, Turn } from '../lib/agent/onboarding.ts';

const m = (text: string, qd?: unknown) => ({ text, ...(qd ? { qualityDay: qd } : {}) } as never);
const say = (t: Turn, msg: string, model = m('Mm.')) => applyReclaimC3Turn(t.state as ConvState, [], msg, model);
const PROFILE = { nonNegotiables: ['moved my body', 'some calm'], contributors: ['real connection'], disruptors: ['poor sleep'] };

/** Setup runs to the week opening. */
function walk(): Turn[] {
  const turns: Turn[] = [reclaimC3Opening()];
  let t = turns[0]!;
  const push = (x: Turn) => { turns.push(x); return x; };
  t = push(say(t, 'One where I moved and did not feel behind.'));
  t = push(say(t, 'Movement, calm, and seeing someone.', m('Which feel non-negotiable?')));
  t = push(say(t, 'Those three.', m('', PROFILE)));
  t = push(say(t, 'Please do.'));
  t = push(say(t, 'After I put the coffee on.'));   // answers stage 3's when + anchor
  t = push(say(t, 'Catch it up the next morning.')); // answers stage 4's backup → the week opens
  return turns;
}

test('C3-79 · stage 1 sets the stance BEFORE anything is defined', () => {
  // The load-bearing one. Every other Session is a conversation that ends; this one ends and then asks for seven
  // days. A member who does not know that at the start reads the week as the app nagging them.
  const t = reclaimC3Opening();
  assert.equal((t.state as ConvState).stage, 'c3-open');
  assert.match(t.reply, /tracking over time rather than reflecting once/i, "Greg's stance, verbatim in sense");
  assert.match(t.reply, /about a week/i, 'and it says the week out loud, up front');
  assert.match(t.reply.trim(), /\?$/, 'ending on a question they answer in words');
});

test('C3-81 · the expectations are set BEFORE monitoring starts, not after', () => {
  // Said afterwards this is consolation; said first it is permission — the difference between a missed day
  // ending the week and a missed day being part of it. Greg elsewhere: never penalise a missed day.
  const all = walk().map((t) => t.reply).join('\n');
  assert.match(all, /Consistency matters more than completeness/i, 'consistency over completeness');
  assert.match(all, /you will forget a day/i, 'forgetting is normal');
  assert.match(all, /never counts against you/i, 'and a missed day is not a penalty');

  // ORDER IS THE CLAIM. The expectations must land before the week opens, or they are an apology for it.
  const turns = walk();
  const expectationsAt = turns.findIndex((t) => /Consistency matters more/i.test(t.reply));
  const weekOpensAt = turns.findIndex((t) => t.complete === true);
  assert.ok(expectationsAt >= 0 && expectationsAt < weekOpensAt, 'the expectations come before the week');
});

test('C3-82 · light planning — a cue anchored to a real routine, and a backup they choose', () => {
  const all = walk().map((t) => t.reply).join('\n');
  assert.match(all, /Hang it off something you already do/i, 'the cue hangs off an existing routine');
  // GREG NEVER DEFINES "backup for missed days" — flagged for him. So the MEMBER defines it, which is the better
  // answer regardless: a backup they chose is one they might actually use.
  assert.match(all, /on a day you forget/i, 'the backup is asked for, not assumed');
});

test('the definition still gates the week — a confirm ends stage 2, not the Session', () => {
  let t = say(reclaimC3Opening(), 'A day I moved.');
  t = say(t, 'Movement and calm.', m('Which feel non-negotiable?'));
  t = say(t, 'Those.', m('', PROFILE));
  const confirmed = say(t, 'Please do.');
  assert.equal((confirmed.state as ConvState).stage, 'c3-commit');
  assert.equal(confirmed.complete, false, 'the week still has to be set up');
});

test('the whole setup reaches the week, and the week is what completes it', () => {
  const final = walk().at(-1)!;
  assert.equal(final.complete, true, 'setup ends by opening the week');
  assert.match(final.reply, /Ready to start/i);
  assert.deepEqual(RECLAIM_C3_ARC.stageOrder, ['c3-open', 'quality', 'c3-commit', 'c3-backup']);
});

test('C3 never promises wellness as an outcome of tracking', () => {
  // C3-87, and it is the one overclaim this Session is most exposed to: a member is about to spend a week
  // logging, and "this will make your days better" is the sentence that sells it and cannot be kept.
  const all = walk().map((t) => t.reply).join('\n');
  assert.doesNotMatch(all, /will (make|leave) (you|your days?)|you'?ll feel better|improves? your wellbeing/i);
});
