'use client';

import { useState, useEffect, useRef } from 'react';
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

function SessionRail({ memberId, sessionKey, mobile = false }: { memberId: string; sessionKey: SessionKey; mobile?: boolean }) {
  const { arc, session } = chatDispatch(sessionKey);
  if (arc === 'reconnect') return <ReconnectChat memberId={memberId} mobile={mobile} />;
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
  mobile = false,
  tense = 'practice',
}: {
  memberId: string;
  sessionKey: SessionKey;
  artifact: Artifact;
  wayfinding: Wayfinding;
  review?: boolean; // read-only revisit of a COMPLETED session — final artifact, no live rail (Cycle-2 review too)
  mobile?: boolean; // Mobile slice 3: the phone bottom-sheet layout (canvas fills; the conversation rises as a sheet)
  tense?: 'present' | 'practice' | 'reclaim'; // §5c phase accent — reinforce, don't reskin (mobile only)
}) {
  const [artifact, setArtifact] = useState<Artifact>(initial);
  // Mobile slice 3 — the Companion is a bottom-sheet over the canvas: CLOSED by default so the member is ORIENTED by
  // the canvas first (the mock's "session summary" threshold), then a pulsing FAB rises the sheet to begin. A third
  // 'peek' detent lets them drag the open sheet down to admire the canvas (their words landing) without losing their
  // place, then raise it back. Inert on desktop (the CSS only reads .ws-mobile at the phone breakpoint).
  type SheetPos = 'closed' | 'peek' | 'open';
  const [sheetPos, setSheetPos] = useState<SheetPos>('closed');
  // The session's "why this matters" (Session Summary): the short line reads at the threshold, the full sits behind a
  // tap. Same content module + surface on desktop and the mobile pre-start canvas. Null for checkpoints (a gate, no why).
  const summary = sessionSummary(sessionKey);
  const [whyOpen, setWhyOpen] = useState(false);
  const railRef = useRef<HTMLElement>(null);
  const drag = useRef<{ startY: number; baseY: number; moved: boolean } | null>(null);
  const [dragY, setDragY] = useState<number | null>(null); // live px translate WHILE dragging (null = CSS class drives)
  const PEEK_VISIBLE = 150; // px of sheet left on screen at the 'peek' detent — KEEP IN SYNC with .sheet-peek in globals.css

  // translateY (px, downward) for a resting detent — measured from the live sheet height so it tracks any viewport.
  const posY = (pos: SheetPos): number => {
    const h = railRef.current?.offsetHeight ?? 0;
    return pos === 'open' ? 0 : pos === 'peek' ? Math.max(0, h - PEEK_VISIBLE) : h;
  };
  const cycle = () => setSheetPos((p) => (p === 'open' ? 'peek' : p === 'peek' ? 'closed' : 'open'));
  // Pointer drag (unifies touch + mouse, so it's live-followable in the preview too). Small movement = a tap → cycle.
  const gripDown = (clientY: number, el: HTMLElement, pointerId: number) => {
    el.setPointerCapture?.(pointerId);
    drag.current = { startY: clientY, baseY: posY(sheetPos), moved: false };
    setDragY(posY(sheetPos));
  };
  const gripMove = (clientY: number) => {
    if (!drag.current) return;
    const dy = clientY - drag.current.startY;
    if (Math.abs(dy) > 5) drag.current.moved = true;
    const h = railRef.current?.offsetHeight ?? 0;
    setDragY(Math.min(Math.max(drag.current.baseY + dy, 0), h));
  };
  const gripUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const cur = dragY;
    setDragY(null);
    if (!d.moved || cur == null) return cycle(); // a tap, not a drag
    const snaps: Array<[SheetPos, number]> = [['open', posY('open')], ['peek', posY('peek')], ['closed', posY('closed')]];
    const best = snaps.reduce((a, b) => (Math.abs(b[1] - cur) < Math.abs(a[1] - cur) ? b : a));
    setSheetPos(best[0]);
  };

  // Fill the canvas from committed state. Two triggers: an immediate PUSH after each conversation turn (the chat client
  // fires ARTIFACT_REFRESH_EVENT once its turn — including any keeper commit — has landed, so a confirmed line shows on
  // the left right away, not up to 5s later), plus a slow POLL as a backstop for anything committed out of band.
  // In REVIEW mode the artifact is final — nothing's being written — so there's nothing to poll.
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

      <div className={`redesign-app ws-app${review ? ' ws-review' : ''}${mobile ? ' ws-mobile' : ''}${mobile ? ` tense-${tense}` : ''}${mobile ? ` sheet-${sheetPos}` : ''}${dragY != null ? ' sheet-dragging' : ''}`}>
        <div className="redesign-canvas">
          {review ? (
            <>
              {/* Read-only revisit — back to the Journey, and a "Completed" banner instead of live progress. */}
              <Link href={`/program/${memberId}`} className="ws-back">← Your Journey</Link>
              <div className="ws-review-banner">
                <span className="ws-review-eyebrow">Phase {wayfinding.phaseOrdinal} · {wayfinding.phaseLabel} · Completed</span>
                <span className="ws-review-note">You’re looking back at this one — the final state you kept. Nothing here changes.</span>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}

          {/* Artifact — the work made visible, filling as the conversation commits */}
          <div className="ws-artifact">
            <h1 className="ws-art-title">{artifact.title}</h1>
            <p className="ws-art-lede">{artifact.lede}</p>
            {/* Session Summary — the "why this matters" for this asset: short line always visible, full behind the tap.
                Threshold copy; harmless in review. Sweep-provisional labels live inside the strings only. */}
            {summary && (
              <div className={`ws-why${whyOpen ? ' open' : ''}`}>
                <p className="ws-why-short">{summary.short}</p>
                <button
                  type="button"
                  className="ws-why-toggle"
                  onClick={() => setWhyOpen((v) => !v)}
                  aria-expanded={whyOpen}
                >
                  Why this matters <span className="ws-why-caret" aria-hidden="true">{whyOpen ? '▾' : '▸'}</span>
                </button>
                {whyOpen && <p className="ws-why-full">{summary.full}</p>}
              </div>
            )}
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
            <p className="ws-art-foot">{review ? 'Saved in your Playbook — yours to return to anytime.' : artifact.foot}</p>
          </div>
        </div>

        {!review && (
          <aside
            ref={railRef}
            className="redesign-rail ws-rail"
            aria-label="Your G4L Companion — guided session"
            style={mobile && dragY != null ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
          >
            {/* Mobile bottom-sheet grabber — DRAG to admire the canvas (peek) or lower it; a tap cycles the detents.
                Pointer events so it live-follows a mouse in the preview too (CSS-shown only on ws-mobile). */}
            {mobile && (
              <button
                type="button"
                className="ws-sheet-handle"
                onPointerDown={(e) => gripDown(e.clientY, e.currentTarget, e.pointerId)}
                onPointerMove={(e) => gripMove(e.clientY)}
                onPointerUp={gripUp}
                onPointerCancel={gripUp}
                aria-label="Drag or tap to raise, peek at your work, or lower the conversation"
              >
                <span className="ws-sheet-grip" aria-hidden="true" />
              </button>
            )}
            <SessionRail memberId={memberId} sessionKey={sessionKey} mobile={mobile} />
          </aside>
        )}
      </div>

      {/* Mobile slice 3 — the pulsing FAB that raises the conversation sheet (canvas orients first). Phone-only via CSS. */}
      {mobile && !review && sheetPos === 'closed' && (
        <button type="button" className="ws-sheet-fab" onClick={() => setSheetPos('open')} aria-label="Open the guided conversation">
          <span className="ws-sheet-fab-dot" aria-hidden="true" /> Talk to me
        </button>
      )}
    </>
  );
}
