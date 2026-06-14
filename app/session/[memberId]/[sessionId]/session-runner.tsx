'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { frameForStep, saveStep, closeSessionAction, type CloseResult } from './session-actions.ts';
import type { Step } from '../../../../lib/curriculum/types.ts';

type SessionLite = { id: string; title: string; phase: string; layer: string; summary: string; steps: Step[]; earns?: string };

export default function SessionRunner({
  memberId,
  session,
  initialStep,
  initialAnswers,
  initialFrame,
  alreadyClosed,
}: {
  memberId: string;
  session: SessionLite;
  initialStep: number;
  initialAnswers: Record<string, string>;
  initialFrame: string;
  alreadyClosed: boolean;
}) {
  const total = session.steps.length;
  const [stepIdx, setStepIdx] = useState(Math.min(Math.max(initialStep, 1), total));
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [draft, setDraft] = useState(initialAnswers[String(Math.min(Math.max(initialStep, 1), total))] ?? '');
  const [frame, setFrame] = useState(initialFrame);
  const [atClose, setAtClose] = useState(alreadyClosed || initialStep > total);
  const [closed, setClosed] = useState(alreadyClosed);
  const [result, setResult] = useState<CloseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const cur = session.steps.find((s) => s.n === stepIdx) ?? null;

  function goToStep(n: number) {
    setStepIdx(n);
    setDraft(answers[String(n)] ?? '');
    setError(null);
    setAtClose(false);
    startTransition(async () => {
      const f = await frameForStep(memberId, session.id, n);
      if (f) setFrame(f);
    });
  }

  function next() {
    if (!cur) return;
    if (draft.trim() === '') {
      setError('Put something honest down — even one true sentence.');
      return;
    }
    setError(null);
    const n = cur.n;
    const nextN = n + 1;
    const updated = { ...answers, [String(n)]: draft.trim() };
    setAnswers(updated);
    startTransition(async () => {
      await saveStep(memberId, session.id, n, draft.trim(), Math.min(nextN, total));
      if (nextN > total) {
        setAtClose(true);
      } else {
        setStepIdx(nextN);
        setDraft(updated[String(nextN)] ?? '');
        const f = await frameForStep(memberId, session.id, nextN);
        if (f) setFrame(f);
      }
    });
  }

  function close() {
    setError(null);
    startTransition(async () => {
      const res = await closeSessionAction(memberId, session.id);
      setResult(res);
      if (res.ok) setClosed(true);
      else setError(res.reason === 'incomplete' ? 'Finish naming your identity first.' : 'Could not close just now — try again.');
    });
  }

  const allAnswered = session.steps.every((s) => (answers[String(s.n)] ?? '').trim() !== '');

  // ---- closed confirmation ----
  if (closed && result && result.ok) {
    return (
      <div className="card sess-done-card">
        <p className="sess-done-tag">Session closed</p>
        <h2>You named it: <span className="noun">{result.facet}</span></h2>
        <p className="muted">
          It’s on your dashboard now as a facet you’re reclaiming{result.badgeName ? <> — and you earned the <strong>{result.badgeName}</strong> badge.</> : '.'}
        </p>
        <button type="button" className="sess-next" onClick={() => router.push(`/dashboard/${memberId}`)}>Back to your dashboard →</button>
      </div>
    );
  }

  return (
    <div className="sess-flow">
      {session.steps.map((s) => {
        const isDone = s.n < stepIdx || (atClose && s.n <= total);
        const isCur = s.n === stepIdx && !atClose;
        if (isCur) {
          return (
            <div className="sess-sec cur" key={s.n}>
              <div className="sess-clab"><span className="sess-cnum">{s.n}</span><span className="sess-ctt">{s.title}</span></div>
              <div className="sess-bubble">
                <div className="sess-agent">Your G4L companion</div>
                {pending && !frame ? '…' : frame}
              </div>
              <div className="sess-q">{s.prompt}</div>
              <textarea
                className="sess-field"
                value={draft}
                onChange={(e) => { setDraft(e.target.value); if (error) setError(null); }}
                placeholder="Take your time…"
                rows={4}
                disabled={pending}
              />
              {s.probe && <p className="sess-probe">{s.probe}</p>}
              {error && <p className="measure-error">{error}</p>}
              <div className="sess-crow">
                <span className="muted">{total - s.n > 0 ? `${total - s.n} step${total - s.n === 1 ? '' : 's'} left after this` : 'Last step'}</span>
                <button type="button" className="sess-next" onClick={next} disabled={pending}>
                  {pending ? '…' : s.n < total ? 'Next →' : 'Finish the steps →'}
                </button>
              </div>
            </div>
          );
        }
        if (isDone) {
          return (
            <div className="sess-sec done" key={s.n}>
              <div className="sess-dhead">
                <span className="sess-dcheck" aria-hidden="true">✓</span>
                <span className="sess-dtt"><span className="num">{s.n}</span>{s.title}</span>
                {!closed && (
                  <button type="button" className="sess-edit" onClick={() => goToStep(s.n)} disabled={pending}>edit</button>
                )}
              </div>
              {answers[String(s.n)] && <div className="sess-danswer">{answers[String(s.n)]}</div>}
            </div>
          );
        }
        return (
          <div className="sess-sec up" key={s.n}>
            <div className="sess-uhead"><span className="sess-ulock" aria-hidden="true">○</span><span className="sess-utt"><span className="num">{s.n}</span>{s.title}</span></div>
          </div>
        );
      })}

      {/* the one close */}
      <div className={`sess-close${atClose && allAnswered ? '' : ' locked'}`}>
        <p className="sess-ctag">⬢ Closes the Session</p>
        <p className="sess-ct">Lock in your Reclaimed Identity</p>
        <p className="muted">When you finish the steps, the self you named joins your dashboard as a facet you’re reclaiming{session.earns ? ', and you earn a badge' : ''}. One close — no scoring you, just marking what you did.</p>
        {atClose && allAnswered ? (
          <button type="button" className="sess-next" onClick={close} disabled={pending}>{pending ? '…' : 'Lock it in →'}</button>
        ) : (
          <span className="sess-cbtn-locked">Finish the steps first</span>
        )}
        {error && atClose && <p className="measure-error">{error}</p>}
      </div>
    </div>
  );
}
