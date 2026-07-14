'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { readArtifactAction } from './actions.ts';
import { ARTIFACT_REFRESH_EVENT } from '../components/artifact-refresh.ts';
import { chatDispatch, type SessionKey } from '../../lib/workspace/session-key.ts';
import type { Artifact } from '../../lib/workspace/artifact.ts';
import type { RingPhaseState } from '../../lib/workspace/ring-state.ts';
import RedesignChrome from '../dashboard/redesign-chrome.tsx';
import RedesignRing from '../dashboard/redesign-ring.tsx';
import ReconnectChat from '../reconnect/reconnect-chat.tsx';
import RewireChat from '../rewire/rewire-chat.tsx';
import RebuildChat from '../rebuild/rebuild-chat.tsx';
import ReclaimChat from '../reclaim/reclaim-chat.tsx';

// Redesign Layer 3 (D-05, build spec §4) — the PROGRAM WORKSPACE. One shell, every session: the CANVAS carries a slim
// wayfinding header (ring + position + progress + Full route) over the artifact the session builds; the RAIL runs the
// session as a guided conversation. The rail reuses the EXISTING arc chat client unchanged (no arc-engine touch); the
// canvas polls the committed artifact so it fills as the conversation commits. Flag-gated upstream (REDESIGN).

export interface Wayfinding {
  phaseLabel: string;
  phaseOrdinal: number;
  positionLabel: string; // "The Visualization Workshop · Session 2 of 3"
  progressPct: number; // 0..100 within the phase
  rings: RingPhaseState[];
  ringCenter: string; // phase label for the ring center
  ringSub: string | null;
}

function SessionRail({ memberId, sessionKey }: { memberId: string; sessionKey: SessionKey }) {
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
}: {
  memberId: string;
  sessionKey: SessionKey;
  artifact: Artifact;
  wayfinding: Wayfinding;
}) {
  const [artifact, setArtifact] = useState<Artifact>(initial);

  // Fill the canvas from committed state. Two triggers: an immediate PUSH after each conversation turn (the chat client
  // fires ARTIFACT_REFRESH_EVENT once its turn — including any keeper commit — has landed, so a confirmed line shows on
  // the left right away, not up to 5s later), plus a slow POLL as a backstop for anything committed out of band.
  useEffect(() => {
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
  }, [memberId, sessionKey]);

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

      <div className="redesign-app ws-app">
        <div className="redesign-canvas">
          {/* Back nav — standard place (top-left of content) + color (teal), matching .back-dash elsewhere */}
          <Link href={`/dashboard/${memberId}`} className="ws-back">← Dashboard</Link>
          {/* Wayfinding: ring + where you are + progress + full route */}
          <div className="ws-wayfind">
            <div className="ws-way-ring">
              <RedesignRing rings={wayfinding.rings} centerTop={wayfinding.ringCenter} centerSub={wayfinding.ringSub} size={72} />
            </div>
            <div className="ws-way-pos">
              <div className="ws-way-ph">Phase {wayfinding.phaseOrdinal} · {wayfinding.phaseLabel}</div>
              <div className="ws-way-ss">{wayfinding.positionLabel}</div>
              <div className="ws-way-bar"><span className="ws-way-fill" style={{ width: `${wayfinding.progressPct}%` }} /></div>
            </div>
            <Link href={`/program/${memberId}?from=${sessionKey}`} className="ws-way-route">Full route →</Link>
          </div>

          {/* Artifact — the work made visible, filling as the conversation commits */}
          <div className="ws-artifact">
            <h1 className="ws-art-title">{artifact.title}</h1>
            <p className="ws-art-lede">{artifact.lede}</p>
            {artifact.slots.length > 0 && (
              <div className="ws-slots">
                {artifact.slots.map((s, i) => {
                  const lines = (s.value ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
                  return (
                    <div key={i} className={`ws-slot${s.value ? ' filled' : ''}`}>
                      <div className="ws-slot-lab">{s.label}</div>
                      {lines.length > 0 ? (
                        // Each committed line reads as KEPT — the member watches their own words get immortalized here.
                        <ul className="ws-slot-list">
                          {lines.map((ln, j) => (
                            <li key={j} className="ws-slot-line"><span className="ws-slot-tick" aria-hidden="true">✓</span>{ln}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="ws-slot-val empty">Your own words land here as you name them — and they’re kept.</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="ws-art-foot">{artifact.foot}</p>
          </div>
        </div>

        <aside className="redesign-rail ws-rail" aria-label="Your G4L Companion — guided session">
          <SessionRail memberId={memberId} sessionKey={sessionKey} />
        </aside>
      </div>
    </>
  );
}
