import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCoalescer } from '../lib/connect/live-ping.ts';

// SEC-04 — the room's Realtime channel is joined with the PUBLIC anon key, so any actor can ping it. That is only
// safe because a ping carries no content and no authority; this bounds the one thing it CAN cause (a refetch).

function fakeClock() {
  let t = 0;
  const timers: Array<{ id: number; at: number; fn: () => void }> = [];
  let nextId = 1;
  return {
    clock: {
      now: () => t,
      setTimer: (fn: () => void, ms: number) => {
        const id = nextId++;
        timers.push({ id, at: t + ms, fn });
        return id;
      },
      clearTimer: (h: unknown) => {
        const i = timers.findIndex((x) => x.id === h);
        if (i >= 0) timers.splice(i, 1);
      },
    },
    advance(ms: number) {
      t += ms;
      for (const timer of timers.filter((x) => x.at <= t)) {
        timers.splice(timers.indexOf(timer), 1);
        timer.fn();
      }
    },
  };
}

test('the first ping in a quiet room fires IMMEDIATELY — realtime must still feel instant', () => {
  const { clock } = fakeClock();
  let runs = 0;
  createCoalescer(1000, () => runs++, clock).ping();
  assert.equal(runs, 1, 'no artificial delay on the leading edge');
});

test('a flood of pings collapses to ONE refetch per interval, not one per ping', () => {
  const { clock, advance } = fakeClock();
  let runs = 0;
  const c = createCoalescer(1000, () => runs++, clock);
  for (let i = 0; i < 500; i++) c.ping(); // an attacker spraying the public channel
  assert.equal(runs, 1, 'only the leading edge ran');
  advance(1000);
  assert.equal(runs, 2, 'the burst collapses to a single trailing refetch — 500 pings, 2 requests');
});

test('a ping during the quiet window is not dropped — it runs on the trailing edge', () => {
  // Correctness matters as much as the bound: a REAL message arriving just after a refetch must still show up
  // promptly, or the throttle would silently cost a member their message until the 15s poll caught it.
  const { clock, advance } = fakeClock();
  let runs = 0;
  const c = createCoalescer(1000, () => runs++, clock);
  c.ping();
  assert.equal(runs, 1);
  advance(200);
  c.ping();
  assert.equal(runs, 1, 'held, not run');
  advance(800);
  assert.equal(runs, 2, 'and delivered when the window opens');
});

test('spaced-out pings each run immediately (the throttle never penalises normal use)', () => {
  const { clock, advance } = fakeClock();
  let runs = 0;
  const c = createCoalescer(1000, () => runs++, clock);
  for (let i = 0; i < 5; i++) {
    c.ping();
    advance(1000);
  }
  assert.equal(runs, 5, 'a normal conversation is never throttled');
});

test('cancel() drops a queued refetch — no work after the room is left', () => {
  const { clock, advance } = fakeClock();
  let runs = 0;
  const c = createCoalescer(1000, () => runs++, clock);
  c.ping();
  c.ping();
  c.cancel();
  advance(5000);
  assert.equal(runs, 1, 'the trailing refetch never fires after unmount');
});
