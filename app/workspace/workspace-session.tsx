'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { readArtifactAction } from './actions.ts';
import { ARTIFACT_REFRESH_EVENT, SESSION_COMPLETE_EVENT } from '../components/artifact-refresh.ts';
import { chatDispatch, type SessionKey } from '../../lib/workspace/session-key.ts';
import { sessionSummary } from '../../lib/content/summaries.ts';
import type { Artifact } from '../../lib/workspace/artifact.ts';
import type { RingPhaseState } from '../../lib/workspace/ring-state.ts';
import RedesignChrome from '../dashboard/redesign-chrome.tsx';
import ReconnectChat from '../reconnect/reconnect-chat.tsx';
import RewireChat from '../rewire/rewire-chat.tsx';
import RebuildChat from '../rebuild/rebuild-chat.tsx';
import ReclaimChat from '../reclaim/reclaim-chat.tsx';

// Redesign Layer 3 — the PROGRAM WORKSPACE, now SINGLE-COLUMN (2026-07-21, direction A). A Session is ONE conversation,
// not a two-pane canvas+rail: a slim wayfinding header sits over the guided conversation, and answers are kept inline as
// "✓" chips as they land (polled from the committed artifact) so the member watches their progress accumulate. The full
// artifact is delivered as a summary card at the close (review mode here; the live close card is the next slice). The
// docked companion rail now lives ONLY on the dashboard. Flag-gated upstream (REDESIGN).

export interface Wayfinding {
  phaseLabel: string;
  phaseOrdinal: number;
  positionLabel: string; // "The Visualization Workshop · Session 2 of 3"
  progressPct: number; // 0..100 within the phase
  rings: RingPhaseState[];
  ringCenter: string; // phase label for the ring center
  ringSub: string | null;
}

// The guided conversation for this session — the existing arc chat client, unchanged (no arc-engine touch).
function SessionConversation({ memberId, sessionKey }: { memberId: string; sessionKey: SessionKey }) {
  const { arc, session } = chatDispatch(sessionKey);
  if (arc === 'reconnect') return <ReconnectChat memberId={memberId} />;
  if (arc === 'rewire') return <RewireChat memberId={memberId} session={session as 'w1' | 'w2' | 'w3' | 'checkpoint'} />;
  if (arc === 'rebuild') return <RebuildChat memberId={memberId} session={session as 'b1' | 'b2' | 'b3' | 'checkpoint'} />;
  return <ReclaimChat memberId={memberId} session={session as 'c1' | 'c2' | 'c3' | 'checkpoint'} />;
}

export default function WorkspaceSession({
  memberId,
  sessionKey,
  artifact: initial,
  wayfinding,
  review = false,
}: {
  memberId: string;
  sessionKey: SessionKey;
  artifact: Artifact;
  wayfinding: Wayfinding;
  review?: boolean; // read-only revisit of a COMPLETED session — the summary card, no live conversation
}) {
  const [artifact, setArtifact] = useState<Artifact>(initial);
  const summary = sessionSummary(sessionKey);
  // Open on landing (#18E): the member should see WHY this Session matters before diving in, not have to hunt for it.
  // But it's tall — on a PHONE it ate the whole screen and squeezed the chat to an unreadable sliver, stranding the
  // member on the tail of a message with no visible question (Jennifer's walk, 2026-07-27). The first fix collapsed it
  // on scroll, but a phone member has no reason to scroll (the composer is already in view), so it stayed open. Real
  // fix: on a phone, start COLLAPSED — the pinned "Why this matters ▶" pill (the header never scrolls) invites a tap;
  // the chat gets full height immediately. Desktop/tablet keep open-on-landing + collapse-on-scroll below.
  const [whyOpen, setWhyOpen] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Phone: default collapsed so the conversation isn't squeezed. Runs once after mount (SSR renders open → matches
    // on hydrate, then this tucks it away before the member reads). matchMedia keeps the breakpoint in one place.
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches) setWhyOpen(false);
  }, []);
  useEffect(() => {
    if (review) return;
    const el = bodyRef.current;
    if (!el) return;
    const collapse = () => setWhyOpen(false); // no-op re-render when already closed (React bails on same value)
    el.addEventListener('wheel', collapse, { passive: true });
    el.addEventListener('touchmove', collapse, { passive: true });
    return () => {
      el.removeEventListener('wheel', collapse);
      el.removeEventListener('touchmove', collapse);
    };
  }, [review]);
  // The "here's what you built" card — shown when the conversation reaches its close (SESSION_COMPLETE_EVENT), over the
  // hand-home beat. "Continue →" dismisses it, revealing the hand-home/next-step underneath. Not the close itself.
  const [endCard, setEndCard] = useState(false);

  // Fill from committed state: an immediate PUSH after each turn (the chat fires ARTIFACT_REFRESH_EVENT once its turn —
  // including any keeper commit — has landed) + a slow POLL backstop. In REVIEW the artifact is final, so nothing polls.
  useEffect(() => {
    if (review) return;
    let cancelled = false;
    const refresh = async () => {
      const next = await readArtifactAction(memberId, sessionKey);
      if (!cancelled && next) setArtifact(next);
    };
    const onCommitted = () => void refresh();
    // Session close: read the final artifact, then raise the summary card over the hand-home.
    const onComplete = async () => {
      const next = await readArtifactAction(memberId, sessionKey);
      if (cancelled) return;
      if (next) setArtifact(next);
      setEndCard(true);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(ARTIFACT_REFRESH_EVENT, onCommitted);
      window.addEventListener(SESSION_COMPLETE_EVENT, onComplete);
    }
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void refresh();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
      if (typeof window !== 'undefined') {
        window.removeEventListener(ARTIFACT_REFRESH_EVENT, onCommitted);
        window.removeEventListener(SESSION_COMPLETE_EVENT, onComplete);
      }
    };
  }, [memberId, sessionKey, review]);

  // Each filled slot is a "kept" answer — the running proof of what the member is building.
  const filled = artifact.slots.filter((s) => (s.value ?? '').trim().length > 0);

  return (
    <>
      <RedesignChrome />
      <div className="redesign-topbar">
        <Link href="/" className="rt-brand" aria-label="Go to your G4L home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="rt-logo-mark" src="/brand/g4l-rings.svg" alt="" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="rt-wordmark" src="/brand/g4l-wordmark.svg" alt="Grinta for Life" />
        </Link>
      </div>

      <div className={`ws-col${review ? ' ws-review' : ''}`}>
        <header className="ws-col-head">
          {review ? (
            <>
              <Link href={`/program/${memberId}`} className="ws-back">← Your Journey</Link>
              <div className="ws-col-way">
                <div className="ws-way-pos">
                  <div className="ws-way-ph">Phase {wayfinding.phaseOrdinal} · {wayfinding.phaseLabel} · Completed</div>
                  <div className="ws-way-ss">{wayfinding.positionLabel}</div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Slim wayfinding — left-aligned phase + progress, full route on the right. No ring (redundant with the
                  topbar bullseye, and its label can't render legibly small anyway). Back nav sits BELOW it. */}
              <div className="ws-col-way">
                <div className="ws-way-pos">
                  <div className="ws-way-ph">Phase {wayfinding.phaseOrdinal} · {wayfinding.phaseLabel}</div>
                  <div className="ws-way-ss">{wayfinding.positionLabel}</div>
                  <div className="ws-way-bar"><span className="ws-way-fill" style={{ width: `${wayfinding.progressPct}%` }} /></div>
                </div>
                <Link href={`/program/${memberId}?from=${sessionKey}`} className="ws-way-route">The Program →</Link>
              </div>
              <Link href={`/dashboard/${memberId}`} className="ws-back">← Dashboard</Link>
            </>
          )}

          {/* "Why this matters" — compact: just the tap, the full expands inline. The short framing line is echoed in
              the Companion's opening beat anyway, so it doesn't need to sit pinned. */}
          {summary && !review && (
            <div className={`ws-why${whyOpen ? ' open' : ''}`}>
              <button type="button" className="ws-why-toggle" onClick={() => setWhyOpen((v) => !v)} aria-expanded={whyOpen}>
                Why this matters <span className="ws-why-caret" aria-hidden="true">{whyOpen ? '▼' : '▶'}</span>
              </button>
              {whyOpen && <p className="ws-why-full">{summary.full}</p>}
            </div>
          )}

          {/* Kept chips — grow live as the conversation commits answers (the member's running accomplishment). */}
          {!review && filled.length > 0 && (
            <div className="ws-kept" aria-label="What you've kept so far">
              <span className="ws-kept-lab">Kept</span>
              {filled.map((s, i) => (
                <span key={i} className="ws-kept-chip"><span className="ws-kept-tick" aria-hidden="true">✓</span>{s.label}</span>
              ))}
            </div>
          )}
        </header>

        <div className="ws-col-body" ref={bodyRef}>
          {review ? (
            // The summary card — every answer the member built, kept.
            <div className="ws-built">
              <h1 className="ws-built-title">{artifact.title}</h1>
              <p className="ws-built-lede">{artifact.lede}</p>
              <div className="ws-built-slots">
                {filled.map((s, i) => (
                  <div key={i} className="ws-built-slot">
                    <div className="ws-slot-lab">{s.label}</div>
                    <ul className="ws-slot-list">
                      {(s.value ?? '').split('\n').map((l) => l.trim()).filter(Boolean).map((ln, j) => (
                        <li key={j} className="ws-slot-line"><span className="ws-slot-tick" aria-hidden="true">✓</span>{ln}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="ws-built-foot">Saved in your Playbook — yours to return to anytime.</p>
            </div>
          ) : (
            <SessionConversation memberId={memberId} sessionKey={sessionKey} />
          )}
        </div>
      </div>

      {/* End card — raised over the hand-home at the session's close: every answer the member built, in one place.
          "Continue →" dismisses it, revealing the conversation's hand-home / next-step underneath. Not the close. */}
      {endCard && !review && filled.length > 0 && (
        <div className="ws-endcard-scrim" role="dialog" aria-modal="true" aria-label="What you built">
          <div className="ws-endcard">
            <div className="ws-endcard-eyebrow">Session complete</div>
            <h2 className="ws-endcard-title">Here’s what you built</h2>
            <div className="ws-built-slots">
              {filled.map((s, i) => (
                <div key={i} className="ws-built-slot">
                  <div className="ws-slot-lab">{s.label}</div>
                  <ul className="ws-slot-list">
                    {(s.value ?? '').split('\n').map((l) => l.trim()).filter(Boolean).map((ln, j) => (
                      <li key={j} className="ws-slot-line"><span className="ws-slot-tick" aria-hidden="true">✓</span>{ln}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <button type="button" className="ws-endcard-cta" onClick={() => setEndCard(false)}>Continue →</button>
          </div>
        </div>
      )}
    </>
  );
}
