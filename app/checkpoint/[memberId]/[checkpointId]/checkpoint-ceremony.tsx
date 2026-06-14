'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { declareReconnected, holdNotYet, type DeclareResult } from './checkpoint-actions.ts';

export default function CheckpointCeremony({
  memberId,
  checkpointId,
  title,
  opening,
  facets,
}: {
  memberId: string;
  checkpointId: string;
  title: string;
  opening: string;
  facets: string[];
}) {
  const [phase, setPhase] = useState<'reflect' | 'crossed' | 'held'>('reflect');
  const [reflection, setReflection] = useState('');
  const [result, setResult] = useState<DeclareResult | null>(null);
  const [hold, setHold] = useState('');
  const [nudged, setNudged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function declare() {
    setError(null);
    // Anti-gaming: a single gentle "are you sure?" on a thin reflection. Member is still the authority.
    if (reflection.trim().length < 40 && !nudged) {
      setNudged(true);
      return;
    }
    startTransition(async () => {
      const res = await declareReconnected(memberId, checkpointId, reflection.trim());
      if (res.ok) {
        setResult(res);
        setPhase('crossed');
      } else {
        setError('Something hiccupped — try again in a moment.');
      }
    });
  }

  function notYet() {
    setError(null);
    startTransition(async () => {
      const res = await holdNotYet(memberId, checkpointId, reflection.trim());
      setHold(res.hold);
      setPhase('held');
    });
  }

  return (
    <div className="ckpt-wrap">
      <div className="ckpt-card">
        <div className="ckpt-label">Reconnect Checkpoint · {title}</div>

        {phase === 'reflect' && (
          <>
            <div className="ckpt-bubble">
              <div className="ckpt-agent">Your G4L Companion</div>
              {opening}
            </div>
            {facets.length > 0 && (
              <p className="ckpt-facets">What you&apos;ve named: <strong>{facets.join('  ·  ')}</strong></p>
            )}
            <textarea
              className="ckpt-field"
              rows={5}
              value={reflection}
              onChange={(e) => { setReflection(e.target.value); if (error) setError(null); }}
              placeholder="In your own words — have you found yourself again? What surfaced, and what does it mean?"
              disabled={pending}
            />
            {nudged && reflection.trim().length < 40 && (
              <p className="ckpt-nudge">Say a little more — what actually shifted? This is the one gate that matters; a fast yes only costs you later.</p>
            )}
            {error && <p className="measure-error">{error}</p>}
            <div className="ckpt-actions">
              <button type="button" className="ckpt-declare" onClick={declare} disabled={pending}>
                {pending ? '…' : "I've reconnected"}
              </button>
              <button type="button" className="ckpt-notyet" onClick={notYet} disabled={pending}>
                Not yet — I need more time
              </button>
            </div>
          </>
        )}

        {phase === 'crossed' && result && result.ok && (
          <div className="ckpt-crossed">
            <div className="ckpt-milestone">✓ Reconnected</div>
            <p className="ckpt-affirm">{result.affirmation}</p>
            {result.badgeName && <p className="ckpt-badge">Badge earned · <strong>{result.badgeName}</strong></p>}
            {result.firstRewire && (
              <p className="muted">Rewire is open — your first Session is <strong>{result.firstRewire.title}</strong>.</p>
            )}
            <button type="button" className="ckpt-declare" onClick={() => router.push(`/dashboard/${memberId}`)}>
              Step into Rewire →
            </button>
          </div>
        )}

        {phase === 'held' && (
          <div className="ckpt-held">
            <div className="ckpt-bubble">
              <div className="ckpt-agent">Your G4L Companion</div>
              {hold}
            </div>
            <button type="button" className="ckpt-notyet" onClick={() => router.push(`/dashboard/${memberId}`)}>
              Back to keep working →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
