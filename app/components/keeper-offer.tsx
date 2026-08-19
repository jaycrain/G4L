'use client';

import { useState } from 'react';
import type { KeeperProposal } from '../../lib/agent/harvest.ts';
import { keepProposalAction } from './keeper-actions.ts';

// THE COMPANION OFFERS; THE MEMBER DECIDES. Nothing is in her Playbook when this renders.
//
// Donna, 2026-08-19: her own housekeeping question — "Can you remind me what is on my Reclaim List?" — was stored
// as her Visualization picture, and most of what filled "What Lights You Up" was that kind of text. She called it
// what it is: "it signals the app isn't actually working as intended." Then she asked the Companion to fix it and
// was told it could not.
//
// The cause was never the model's judgement. propose-then-confirm already existed and the arc path hardcoded
// `state: 'kept'`, walking around our own gate. Jay's ruling: "Let the member decide inline before it gets posted."
//
// SO THIS IS AN OFFER, NOT A RECEIPT. Two things follow from that and both are load-bearing:
//
// 1. HER EXACT WORDS ARE SHOWN. She is ruling on this text, so she has to see the text — not "I saved something
//    from that." A summary would reproduce the original failure, where a thing was filed about her that she never
//    read.
// 2. IGNORING IT IS A REAL ANSWER, and the commonest one. There is no dismiss button to clear, no queue that
//    fills up. She keeps what she wants; everything else evaporates when the conversation moves on. A proposal
//    that survives being ignored is how you get back to a panel full of things she never chose.
export default function KeeperOffer({
  memberId,
  proposal,
}: {
  memberId: string;
  proposal: KeeperProposal;
}) {
  const [state, setState] = useState<'offered' | 'saving' | 'kept'>('offered');

  const keep = async () => {
    if (state !== 'offered') return;
    setState('saving');
    const res = await keepProposalAction(memberId, proposal);
    // A failed save returns to 'offered' rather than showing a false receipt. Telling her it is in her Playbook
    // when it is not is the same lie as filing something she never approved.
    setState(res.ok ? 'kept' : 'offered');
  };

  if (state === 'kept') {
    return (
      <div className="keeper-offer kept">
        <span className="keeper-offer-label">{proposal.label}</span>
        <p className="keeper-offer-body">{proposal.body}</p>
        <span className="keeper-offer-done">In your Playbook.</span>
      </div>
    );
  }

  return (
    <div className="keeper-offer">
      <span className="keeper-offer-label">{proposal.label}</span>
      <p className="keeper-offer-body">{proposal.body}</p>
      <div className="keeper-offer-foot">
        {/* Plain, and it asks rather than announces — "Saved to your Playbook" was the old lie. */}
        <span className="keeper-offer-ask">Keep this in your Playbook?</span>
        <button type="button" className="keeper-offer-btn" onClick={() => void keep()} disabled={state === 'saving'}>
          {state === 'saving' ? 'Keeping…' : 'Keep it'}
        </button>
      </div>
    </div>
  );
}
