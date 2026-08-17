'use client';

import { useState } from 'react';
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
};

export function useTeaching(memberId: string, sessionKey: SessionKey, stage?: string | null): Teaching {
  const teaches = !!teachingFor(sessionKey, stage).understand;
  // A Session with nothing to teach starts ALREADY taught — otherwise the hand-home waits on a card that never
  // renders, which is a gate whose key is never issued.
  const [taught, setTaught] = useState(() => !teaches);

  const acknowledge = () => {
    setTaught(true); // release immediately — the filing is not something the member should wait on
    // Fire-and-forget. The action verifies its own write and logs server-side if the row vanished, so a silent
    // drop surfaces in the logs rather than trapping someone at a finished Session.
    void keepScienceAction(memberId, sessionKey, teachingSourceLabel(sessionKey, stage));
    notifyArtifactCommitted();
  };

  return { teaches, taught, acknowledge };
}
