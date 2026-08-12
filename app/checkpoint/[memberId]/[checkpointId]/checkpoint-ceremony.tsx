'use client';

import { useState, useTransition } from 'react';
import RichText from '../../../rich-text.tsx';
import { useRouter } from 'next/navigation';
import { declareReconnected, holdNotYet, reconcileReclaim, type DeclareResult, type ReclaimDisposition } from './checkpoint-actions.ts';

type Phase = 'reconnect' | 'rewire' | 'rebuild' | 'reclaim';
const PHASE_LABEL: Record<Phase, string> = { reconnect: 'Reconnect', rewire: 'Rewire', rebuild: 'Rebuild', reclaim: 'Reclaim' };
const DECLARE: Record<Phase, string> = { reconnect: "I've reconnected", rewire: "I've rewired", rebuild: "I've rebuilt", reclaim: "I've reclaimed" };
const MILESTONE: Record<Phase, string> = { reconnect: 'Reconnected', rewire: 'Rewired', rebuild: 'Rebuilt', reclaim: 'Reclaimed' };
const NEXT_PHASE_LABEL: Record<Phase, string> = { reconnect: 'Rewire', rewire: 'Rebuild', rebuild: 'Reclaim', reclaim: '' };

export default function CheckpointCeremony({
  memberId,
  checkpointId,
  phase,
  title,
  opening,
  facets,
  reclaimItems,
}: {
  memberId: string;
  checkpointId: string;
  phase: Phase;
  title: string;
  opening: string;
  facets: string[];
  reclaimItems: { text: string; state: string }[];
}) {
  const isCapstone = phase === 'reclaim';
  const [step, setStep] = useState<'reconcile' | 'reflect' | 'crossed' | 'held'>(isCapstone && reclaimItems.length ? 'reconcile' : 'reflect');
  const [reflection, setReflection] = useState('');
  const [result, setResult] = useState<DeclareResult | null>(null);
  const [hold, setHold] = useState('');
  const [nudged, setNudged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Capstone reconciliation: each item carries to the next lap by default; the member marks the wins.
  const [dispo, setDispo] = useState<Record<string, ReclaimDisposition['disposition']>>(
    Object.fromEntries(reclaimItems.map((i) => [i.text, i.state === 'reclaimed' ? 'reclaimed' : 'moving'])),
  );
  const [reconMsg, setReconMsg] = useState<string | null>(null);

  function reconcile() {
    setError(null);
    startTransition(async () => {
      const r = await reconcileReclaim(memberId, reclaimItems.map((i) => ({ text: i.text, disposition: dispo[i.text] ?? 'moving' })));
      if (r.ok) {
        setReconMsg(`${r.reclaimed} reclaimed${r.reclaimed > 0 && r.badgeName ? ` — the ${r.badgeName} badge is yours` : ''}; ${r.carried} carry to the next lap.`);
        setStep('reflect');
      } else {
        setError('Something hiccupped — try again in a moment.');
      }
    });
  }

  function declare() {
    setError(null);
    if (reflection.trim().length < 40 && !nudged) {
      setNudged(true);
      return;
    }
    startTransition(async () => {
      const res = await declareReconnected(memberId, checkpointId, reflection.trim());
      if (res.ok) {
        setResult(res);
        setStep('crossed');
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
      setStep('held');
    });
  }

  return (
    <div className="ckpt-wrap">
      <div className="ckpt-card">
        <div className="ckpt-label">{PHASE_LABEL[phase]} Checkpoint · {title}</div>

        {step === 'reconcile' && (
          <>
            <div className="ckpt-bubble">
              <div className="ckpt-agent">Your G4L companion</div>
              Before we close the cycle, let’s walk your Reclaim List — the things you set out to win back. For each one, where did it land? What you reclaimed is yours to keep; what’s still moving carries into the next lap.
            </div>
            <div className="ckpt-reconcile">
              {reclaimItems.map((i) => (
                <div className="ckpt-recon-row" key={i.text}>
                  <span className="ckpt-recon-text">{i.text}</span>
                  <select
                    value={dispo[i.text] ?? 'moving'}
                    onChange={(e) => setDispo((d) => ({ ...d, [i.text]: e.target.value as ReclaimDisposition['disposition'] }))}
                    disabled={pending}
                  >
                    <option value="reclaimed">Reclaimed</option>
                    <option value="moving">Still moving</option>
                    <option value="release">Not this lap</option>
                  </select>
                </div>
              ))}
            </div>
            {error && <p className="measure-error">{error}</p>}
            <div className="ckpt-actions">
              <button type="button" className="ckpt-declare" onClick={reconcile} disabled={pending}>
                {pending ? '…' : 'Mark the cycle →'}
              </button>
            </div>
          </>
        )}

        {step === 'reflect' && (
          <>
            {reconMsg && <p className="ckpt-recon-msg">{reconMsg}</p>}
            <div className="ckpt-bubble">
              <div className="ckpt-agent">Your G4L companion</div>
              <RichText text={opening} />
            </div>
            {facets.length > 0 && (
              <p className="ckpt-facets">What you&apos;ve named: <strong>{facets.join('  ·  ')}</strong></p>
            )}
            <textarea
              className="ckpt-field"
              rows={5}
              value={reflection}
              onChange={(e) => { setReflection(e.target.value); if (error) setError(null); }}
              placeholder="In your own words — where are you now, and what does it mean?"
              disabled={pending}
            />
            {nudged && reflection.trim().length < 40 && (
              <p className="ckpt-nudge">Say a little more — what actually shifted? A fast yes only costs you later.</p>
            )}
            {error && <p className="measure-error">{error}</p>}
            <div className="ckpt-actions">
              <button type="button" className="ckpt-declare" onClick={declare} disabled={pending}>
                {pending ? '…' : DECLARE[phase]}
              </button>
              <button type="button" className="ckpt-notyet" onClick={notYet} disabled={pending}>
                Not yet — I need more time
              </button>
            </div>
          </>
        )}

        {step === 'crossed' && result && result.ok && (
          <div className="ckpt-crossed">
            <div className="ckpt-milestone">✓ {MILESTONE[phase]}</div>
            <p className="ckpt-affirm">{result.affirmation}</p>
            {result.badgeName && <p className="ckpt-badge">Badge earned · <strong>{result.badgeName}</strong></p>}
            {result.firstRewire ? (
              <p className="muted">{NEXT_PHASE_LABEL[phase]} is open — your next Session is <strong>{result.firstRewire.title}</strong>.</p>
            ) : (
              <p className="muted">You’ve closed a full cycle. The list re-forms — and when the Fade creeps back, you Reconnect again. That’s the Loop. That’s Grinta for Life.</p>
            )}
            <button type="button" className="ckpt-declare" onClick={() => router.push(`/dashboard/${memberId}`)}>
              {result.firstRewire ? 'Keep going →' : 'Back to your dashboard →'}
            </button>
          </div>
        )}

        {step === 'held' && (
          <div className="ckpt-held">
            <div className="ckpt-bubble">
              <div className="ckpt-agent">Your G4L companion</div>
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
