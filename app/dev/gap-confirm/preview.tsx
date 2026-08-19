'use client';

import { useState } from 'react';
import GapConfirm from '../../onboarding/gap-confirm.tsx';
import type { GapConfirmExpectation } from '../../../lib/agent/onboarding.ts';
import { parseGapConfirmChoice, parseGapConfirmDoors } from '../../../lib/agent/gap-confirm-choice.ts';

// Wraps the real component and shows what it would SEND, plus what the ENGINE reads back out of it. The board
// preview only showed the wire string, and that was enough to catch a wrong format — but the round trip is the
// thing that actually matters, and `keep:` has a null-vs-empty distinction that a raw string hides.
export default function GapConfirmPreview({ expects }: { expects: GapConfirmExpectation }) {
  const [sent, setSent] = useState<string | null>(null);
  return (
    <>
      {/* The composer that stays below it in the real surface — drawn here so the weighting can be judged in
          context. The chips must not read as the only way out of this beat. */}
      <GapConfirm expects={expects} disabled={false} onChoose={setSent} />
      <form className="chat-input" onSubmit={(e) => e.preventDefault()}>
        <textarea rows={1} placeholder="Type your reply…" readOnly />
        <button type="submit" disabled>Send</button>
      </form>
      {sent && (
        <div style={{ marginTop: '1.2rem', padding: '0.7rem 0.9rem', borderLeft: '4px solid #3B9495', background: 'rgba(0,0,0,0.03)' }}>
          <div className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.3rem' }}>What the engine receives</div>
          <code style={{ fontSize: '0.85rem', wordBreak: 'break-word' }}>{sent}</code>
          <div className="muted" style={{ fontSize: '0.8rem', margin: '0.6rem 0 0.3rem' }}>What it parses back to</div>
          <code style={{ fontSize: '0.85rem', wordBreak: 'break-word' }}>
            choice={String(parseGapConfirmChoice(sent))} · doors={JSON.stringify(parseGapConfirmDoors(sent))}
          </code>
          <div className="muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
            doors=null means “no Doors were shown, leave hers alone”. doors=[] means “she took every one off”.
            Those must never look the same here.
          </div>
        </div>
      )}
    </>
  );
}
