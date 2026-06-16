'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { frameForStep, replyToStep, saveStep, closeSessionAction, type CloseResult } from './session-actions.ts';
import SessionCeremony from './session-ceremony.tsx';
import type { Step } from '../../../../lib/curriculum/types.ts';

type SessionLite = { id: string; title: string; phase: string; layer: string; summary: string; steps: Step[]; earns?: string };
type Turn = { role: 'member' | 'agent'; text: string };

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
  const start = Math.min(Math.max(initialStep, 1), total);
  const seedThread = (n: number): Turn[] => (initialAnswers[String(n)] ? [{ role: 'member', text: initialAnswers[String(n)]! }] : []);
  const [stepIdx, setStepIdx] = useState(start);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [draft, setDraft] = useState('');
  const [thread, setThread] = useState<Turn[]>(seedThread(start)); // the current step's exchange
  const [ready, setReady] = useState(false); // soft: the companion feels the answer has landed
  const [frame, setFrame] = useState(initialFrame);
  const [atClose, setAtClose] = useState(alreadyClosed || initialStep > total);
  const [closed, setClosed] = useState(alreadyClosed);
  const [result, setResult] = useState<CloseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const cur = session.steps.find((s) => s.n === stepIdx) ?? null;
  const sent = thread.some((m) => m.role === 'member'); // they've engaged this step at least once

  // Autosave the in-progress draft so backing out mid-step never loses it (persists at the current
  // step, no advance). Debounced + flushed on blur.
  const savedRef = useRef<Record<string, string>>({ ...initialAnswers });
  function persistDraft(n: number, text: string) {
    const t = text.trim();
    if (!t || savedRef.current[String(n)] === t) return;
    savedRef.current = { ...savedRef.current, [String(n)]: t };
    void saveStep(memberId, session.id, n, t, n).catch(() => {});
  }
  useEffect(() => {
    if (closed || atClose) return;
    const id = setTimeout(() => persistDraft(stepIdx, draft), 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, stepIdx, closed, atClose]);

  function enterStep(n: number) {
    setStepIdx(n);
    setThread(answers[String(n)] ? [{ role: 'member', text: answers[String(n)]! }] : []);
    setReady(false);
    setDraft('');
    setError(null);
    setAtClose(false);
    startTransition(async () => {
      const f = await frameForStep(memberId, session.id, n);
      if (f) setFrame(f);
    });
  }

  // A conversational turn: the member sends, the companion reads it and responds (reflect / press / confirm).
  function send() {
    if (!cur) return;
    const text = draft.trim();
    if (!text) {
      setError('Put something down — even one true sentence.');
      return;
    }
    setError(null);
    const n = cur.n;
    const prev = answers[String(n)] ?? '';
    const accumulated = prev ? `${prev}\n${text}` : text;
    setThread((t) => [...t, { role: 'member', text }]);
    setAnswers((a) => ({ ...a, [String(n)]: accumulated }));
    savedRef.current = { ...savedRef.current, [String(n)]: accumulated };
    setDraft('');
    startTransition(async () => {
      const r = await replyToStep(memberId, session.id, n, accumulated);
      if (r.ok) {
        setThread((t) => [...t, { role: 'agent', text: r.reply }]);
        setReady(r.ready);
      }
    });
  }

  // Advance is always available once they've engaged — soft, never a hard gate (only Reconnect's
  // Checkpoint is firm).
  function advance() {
    if (!cur) return;
    const n = cur.n;
    const nextN = n + 1;
    setError(null);
    startTransition(async () => {
      await saveStep(memberId, session.id, n, answers[String(n)] ?? '', Math.min(nextN, total));
      if (nextN > total) {
        setAtClose(true);
      } else {
        enterStep(nextN);
      }
    });
  }

  function close() {
    setError(null);
    startTransition(async () => {
      const res = await closeSessionAction(memberId, session.id);
      setResult(res);
      if (res.ok) setClosed(true);
      else setError(res.reason === 'incomplete' ? 'Give the last step a real answer first.' : 'Could not close just now — try again.');
    });
  }

  const allAnswered = session.steps.every((s) => (answers[String(s.n)] ?? '').trim() !== '');

  // ---- milestone close → the Companion Ceremony (felt weight) ----
  if (closed && result && result.ok && result.ceremony) {
    return <SessionCeremony memberId={memberId} facet={result.facet} badgeId={result.badgeId} badgeName={result.badgeName} />;
  }

  // ---- plain close confirmation (non-ceremony closes) ----
  if (closed && result && result.ok) {
    return (
      <div className="card sess-done-card">
        <p className="sess-done-tag">Session closed</p>
        <h2>{result.facet}</h2>
        {result.badgeName && (
          <p className="muted">You earned the <strong>{result.badgeName}</strong> badge.</p>
        )}
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

              {/* the exchange — member sends, companion responds */}
              {thread.map((m, i) =>
                m.role === 'member' ? (
                  <div className="sess-mbubble" key={i}>{m.text}</div>
                ) : (
                  <div className="sess-bubble" key={i}>
                    <div className="sess-agent">Your G4L companion</div>
                    {m.text}
                  </div>
                ),
              )}
              {pending && <div className="sess-bubble typing">…</div>}

              <textarea
                className="sess-field"
                value={draft}
                onChange={(e) => { setDraft(e.target.value); if (error) setError(null); }}
                onBlur={() => persistDraft(stepIdx, draft)}
                placeholder={sent ? 'Say more…' : 'Take your time…'}
                rows={4}
                disabled={pending}
              />
              {s.probe && !sent && <p className="sess-probe">{s.probe}</p>}
              {error && <p className="measure-error">{error}</p>}
              <div className="sess-crow">
                <button type="button" className="sess-send" onClick={send} disabled={pending || !draft.trim()}>
                  {pending ? '…' : 'Send'}
                </button>
                {sent && (
                  <button type="button" className={`sess-next${ready ? '' : ' soft'}`} onClick={advance} disabled={pending}>
                    {s.n < total ? 'Next →' : 'Finish the steps →'}
                  </button>
                )}
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
                  <button type="button" className="sess-edit" onClick={() => enterStep(s.n)} disabled={pending}>edit</button>
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
        <p className="sess-ct">{session.earns ? 'Close it out' : 'Close the Session'}</p>
        <p className="muted">When you finish the steps, your companion reflects the Session back and files it in your Playbook{session.earns ? ', and you earn a badge' : ''}. One close — no scoring you, just marking what you did.</p>
        {atClose && allAnswered ? (
          <button type="button" className="sess-next" onClick={close} disabled={pending}>{pending ? '…' : 'Close it →'}</button>
        ) : (
          <span className="sess-cbtn-locked">Finish the steps first</span>
        )}
        {error && atClose && <p className="measure-error">{error}</p>}
      </div>
    </div>
  );
}
