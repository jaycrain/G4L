'use client';

import { useRef, useState } from 'react';
import { teachingFor, teachingSourceLabel } from '../../lib/content/teaching.ts';
import { keepScienceAction } from './actions.ts';
import { notifyArtifactCommitted } from '../components/artifact-refresh.ts';
import type { SessionKey } from '../../lib/workspace/session-key.ts';

// The teaching beats' shared state, for the three arc chat clients that render them.
//
// IN ITS OWN MODULE ON PURPOSE. Exporting this hook from teaching-cards.tsx — the obvious home, beside the
// components it serves — creates a client↔client import cycle that webpack-dev resolves to `undefined`, surfacing
// as the "reading 'call'" error that has cost this project real time before. Shared hooks live apart from the
// components that use them (docs/dashboard-ui-standards.md).
//
// WHY A HOOK RATHER THAN THREE COPIES. Rewire, Rebuild and Reclaim need identical behaviour here: the same gate,
// the same not-stranding rule, the same keep-on-acknowledge. Three hand-rolled copies is three chances to drift,
// and the one that drifts silently is the gate — a client that forgets to seed `taught` for a session with nothing
// to teach traps the member at a finished Session with no way out.

export type Teaching = {
  /** Does this Session teach at all? False for gates (checkpoints, B4/C4). */
  teaches: boolean;
  /** Has the member acknowledged the science? Gates the hand-home. Starts TRUE when there is nothing to teach. */
  taught: boolean;
  /** Call from the Understand card's "Got it →". Releases the gate and files the read. */
  acknowledge: () => void;
  /**
   * Await the filing before leaving the Session. Resolves immediately when there is nothing in flight, which is
   * the common case — the write has usually finished while the member was reading the card.
   */
  flushKeep: () => Promise<void>;
};

export function useTeaching(memberId: string, sessionKey: SessionKey, stage?: string | null): Teaching {
  const teaches = !!teachingFor(sessionKey, stage).understand;
  // A Session with nothing to teach starts ALREADY taught — otherwise the hand-home waits on a card that never
  // renders, which is a gate whose key is never issued.
  const [taught, setTaught] = useState(() => !teaches);

  // The in-flight filing. Held so LEAVING can wait on it — see flushKeep.
  const pending = useRef<Promise<unknown> | null>(null);

  const acknowledge = () => {
    setTaught(true); // release immediately — the filing is not something the member should wait on to READ
    // The action verifies its own write and logs server-side if the row vanished.
    pending.current = keepScienceAction(memberId, sessionKey, teachingSourceLabel(sessionKey, stage))
      .catch((e) => console.error('[teaching] keep failed', e));
    notifyArtifactCommitted();
  };

  /**
   * WHY LEAVING WAITS, WHEN READING DOES NOT (Jay, 2026-08-18).
   *
   * The filing used to be pure fire-and-forget, on the reasoning that a member should never wait for bookkeeping.
   * That is right about reading and wrong about leaving: tapping "Got it" and immediately continuing raced the
   * write against the navigation, so a member could open their Playbook and find the takeaway the card had just
   * promised them absent — then present later. Jay: "some members may not be as patient/persistent as you in
   * going back twice on something that wasn't showing up." A promise made in their own words on screen cannot be
   * eventually true.
   *
   * So the gate still releases the instant they tap — nothing about reading changes — and only the click that
   * NAVIGATES waits, almost always on an already-resolved promise. The 4s ceiling is deliberate: a member must
   * never be trapped at a finished Session by a slow write, and the server-side verification + logging is what
   * catches the write that genuinely failed.
   */
  const flushKeep = async () => {
    if (!pending.current) return;
    await Promise.race([pending.current, new Promise((r) => setTimeout(r, 4000))]);
  };

  return { teaches, taught, acknowledge, flushKeep };
}
