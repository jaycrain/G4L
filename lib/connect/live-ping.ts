// Coalescing throttle for realtime "something changed" pings (SEC-04).
//
// The room's Realtime channel is joined with the PUBLIC anon key, so anyone can send it a ping. That is acceptable
// only because a ping carries no content and grants no authority — the worst an attacker can do is make our clients
// refetch from an endpoint that already authorizes them. This bounds even that: pings coalesce to at most one
// refetch per interval, so a flood costs one request per member per interval, not one per ping.
//
// Leading-edge on purpose: the first ping in a quiet room fires IMMEDIATELY (that is the whole point of realtime),
// and only a burst gets collapsed onto the trailing edge.

export type Coalescer = { ping: () => void; cancel: () => void };

export function createCoalescer(
  minIntervalMs: number,
  run: () => void,
  clock: {
    now: () => number;
    setTimer: (fn: () => void, ms: number) => unknown;
    clearTimer: (h: unknown) => void;
  } = { now: () => Date.now(), setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: (h) => clearTimeout(h as never) },
): Coalescer {
  let lastRun = -Infinity;
  let timer: unknown = null;

  const fire = () => {
    lastRun = clock.now();
    timer = null;
    run();
  };

  return {
    ping() {
      if (timer !== null) return; // a trailing run is already queued — this ping is covered by it
      const since = clock.now() - lastRun;
      if (since >= minIntervalMs) fire();
      else timer = clock.setTimer(fire, minIntervalMs - since);
    },
    cancel() {
      if (timer !== null) clock.clearTimer(timer);
      timer = null;
    },
  };
}
