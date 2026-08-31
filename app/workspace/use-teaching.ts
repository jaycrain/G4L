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

/**
 * THE BADGE BEAT — one copy of the words, and one rule about when they arrive.
 *
 * Jay's ruling, 2026-08-31: MEANING BEFORE REWARD.
 *
 * Donna, 2026-08-30: "The note about earning a badge should come up AFTER Why it Works, and this should be the
 * case across the entire app experience."
 *
 * NOBODY CHOSE THE OLD ORDER. The badge was a MESSAGE appended to the stream at the close; "Why it works" is a
 * CARD rendered after the stream. So the badge landed first — not by decision, but because two different
 * rendering mechanisms happened to sit in that sequence. Four chat surfaces each hand-rolled the same two lines,
 * which is also why it was inconsistent: there was no single place where a Session's ending was authored.
 *
 * There is an argument for reward-first — a milestone is a moment of delight and burying it risks a scroll-past.
 * Jay ruled the other way and the governance reasoning backs it: a badge arriving before the member is told what
 * she did reads as a prize for compliance rather than a marker of work. The program never grades; a reward that
 * precedes its own meaning is the closest thing to a grade we would ship.
 */
export const badgeBeatText = (name: string) => `You earned another badge! \u201C${name}.\u201D I added it to your collection.`;

export type Teaching = {
  /** Does this Session teach at all? False for gates (checkpoints, B4/C4). */
  teaches: boolean;
  /** Has the member acknowledged the science? Gates the hand-home. Starts TRUE when there is nothing to teach. */
  taught: boolean;
  /** Call from the Understand card's "Got it →". Releases the gate and files the read. */
  acknowledge: () => void;
  /**
   * Hold a badge earned at the close until the member has read WHY the work mattered.
   *
   * Returns the beat to append once she acknowledges — or immediately, when the Session teaches nothing and there
   * is no card to wait behind. A badge must never be swallowed by the ordering rule.
   */
  deferBadge: (name: string | null | undefined) => void;
  /** The badge beat to append this render, or null. Consumed once. */
  releasedBadge: string | null;
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
  // Held from the close until the science card is acknowledged. `null` means nothing pending.
  const [heldBadge, setHeldBadge] = useState<string | null>(null);
  const [releasedBadge, setReleasedBadge] = useState<string | null>(null);

  // NOTHING TO TEACH → NOTHING TO WAIT BEHIND. A gate (checkpoint, B4/C4) has no Understand card, so holding the
  // badge for an acknowledgment that can never come would silently drop it. Release on the spot.
  const deferBadge = (name: string | null | undefined) => {
    if (!name) return;
    if (teaches) setHeldBadge(name);
    else setReleasedBadge(badgeBeatText(name));
  };

  // The in-flight filing. Held so LEAVING can wait on it — see flushKeep.
  const pending = useRef<Promise<unknown> | null>(null);

  const acknowledge = () => {
    setTaught(true);
    // MEANING, THEN REWARD — the badge lands only now, after she has read what the work was for.
    if (heldBadge) { setReleasedBadge(badgeBeatText(heldBadge)); setHeldBadge(null); } // release immediately — the filing is not something the member should wait on to READ
    // The action verifies its own write and logs server-side if the row vanished.
    pending.current = keepScienceAction(memberId, sessionKey, teachingSourceLabel(sessionKey, stage), null, stage)
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

  return { teaches, taught, acknowledge, flushKeep, deferBadge, releasedBadge };
}
