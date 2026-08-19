'use client';

import { useState } from 'react';
import DoorsBoard from '../../reconnect/doors-board.tsx';
import type { DoorsBoardExpectation } from '../../../lib/agent/onboarding.ts';

// Wraps the real board and shows what it would SEND, so the wire format is visible while judging the interaction.
// Nothing is persisted here — this route has no database write at all.
export default function BoardPreview({ expects }: { expects: DoorsBoardExpectation }) {
  const [sent, setSent] = useState<string | null>(null);
  return (
    <>
      <DoorsBoard expects={expects} onSubmit={setSent} />
      {sent && (
        <div style={{ marginTop: '1.2rem', padding: '0.7rem 0.9rem', borderLeft: '4px solid #3B9495', background: 'rgba(0,0,0,0.03)' }}>
          <div className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.3rem' }}>What the engine receives</div>
          <code style={{ fontSize: '0.85rem', wordBreak: 'break-word' }}>{sent}</code>
        </div>
      )}
    </>
  );
}
