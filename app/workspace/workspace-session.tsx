'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { readArtifactAction } from './actions.ts';
import { ARTIFACT_REFRESH_EVENT } from '../components/artifact-refresh.ts';
import { chatDispatch, type SessionKey } from '../../lib/workspace/session-key.ts';
import { sessionSummary } from '../../lib/content/summaries.ts';
import type { Artifact } from '../../lib/workspace/artifact.ts';
import type { RingPhaseState } from '../../lib/workspace/ring-state.ts';
import RedesignChrome from '../dashboard/redesign-chrome.tsx';
import RedesignRing from '../dashboard/redesign-ring.tsx';
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
  const [whyOpen, setWhyOpen] = useState(false);

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
    if (typeof window !== 'undefined') window.addEventListener(ARTIFACT_REFRESH_EVENT, onCommitted);
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void refresh();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
      if (typeof window !== 'undefined') window.removeEventListener(ARTIFACT_REFRESH_EVENT, onCommitted);
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
              <Link href={`/dashboard/${memberId}`} className="ws-back">← Dashboard</Link>
              {/* Slim wayfinding: ring + where you are + progress + full route — so a single column still orients. */}
              <div className="ws-col-way">
                <div className="ws-way-ring">
                  <RedesignRing rings={wayfinding.rings} centerTop={wayfinding.ringCenter} centerSub={wayfinding.ringSub} size={52} />
                </div>
                <div className="ws-way-pos">
                  <div className="ws-way-ph">Phase {wayfinding.phaseOrdinal} · {wayfinding.phaseLabel}</div>
                  <div className="ws-way-ss">{wayfinding.positionLabel}</div>
                  <div className="ws-way-bar"><span className="ws-way-fill" style={{ width: `${wayfinding.progressPct}%` }} /></div>
                </div>
                <Link href={`/program/${memberId}?from=${sessionKey}`} className="ws-way-route">Full route →</Link>
              </div>
            </>
          )}

          {/* "Why this matters" — the session's framing line, short by default, full behind the tap. */}
          {summary && !review && (
            <div className={`ws-why${whyOpen ? ' open' : ''}`}>
              <p className="ws-why-short">{summary.short}</p>
              <button type="button" className="ws-why-toggle" onClick={() => setWhyOpen((v) => !v)} aria-expanded={whyOpen}>
                Why this matters <span className="ws-why-caret" aria-hidden="true">{whyOpen ? '▾' : '▸'}</span>
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

        <div className="ws-col-body">
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
    </>
  );
}
