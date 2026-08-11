'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { readArtifactAction } from './actions.ts';
import { ARTIFACT_REFRESH_EVENT, SESSION_COMPLETE_EVENT } from '../components/artifact-refresh.ts';
import { chatDispatch, type SessionKey } from '../../lib/workspace/session-key.ts';
import { sessionSummary, sessionAsset } from '../../lib/content/summaries.ts';
import { exploreFor, exploreForReconnectStage } from '../../lib/content/explore.ts';
import type { Artifact } from '../../lib/workspace/artifact.ts';
import type { RingPhaseState } from '../../lib/workspace/ring-state.ts';
import RedesignChrome from '../dashboard/redesign-chrome.tsx';
import ExplorePanel from './explore-panel.tsx';
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
function SessionConversation({
  memberId,
  sessionKey,
  onReconnectStage,
}: {
  memberId: string;
  sessionKey: SessionKey;
  /** Reconnect only — reports which beat the arc is on so the header can show the matching Science Check. */
  onReconnectStage?: (stage: string | null) => void;
}) {
  const { arc, session } = chatDispatch(sessionKey);
  if (arc === 'reconnect') return <ReconnectChat memberId={memberId} onStage={onReconnectStage} />;
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
  topbar,
}: {
  memberId: string;
  sessionKey: SessionKey;
  artifact: Artifact;
  wayfinding: Wayfinding;
  review?: boolean; // read-only revisit of a COMPLETED session — the summary card, no live conversation
  topbar?: ReactNode; // the shared RedesignTopbar, rendered by the server page (async server component)
}) {
  const [artifact, setArtifact] = useState<Artifact>(initial);
  const summary = sessionSummary(sessionKey);
  // Tier 3 — the evidence base, behind its own tap. Only some assets have one; the link doesn't render without it.
  const asset = sessionAsset(sessionKey);
  // RECONNECT RESOLVES ITS SCIENCE CHECK BY BEAT. Greg wrote three (r1/r2/r3) for what the member experiences as
  // ONE session, so keyed by session id it found nothing and the button silently never drew — the content was
  // there the whole time. The nine other sessions are 1:1 with an asset and resolve normally.
  const [reconnectStage, setReconnectStage] = useState<string | null>(null);
  const isReconnect = chatDispatch(sessionKey).arc === 'reconnect';
  const explore = isReconnect ? exploreForReconnectStage(reconnectStage) : asset ? exploreFor(asset) : undefined;
  const [exploreOpen, setExploreOpen] = useState(false);
  // "Why this matters" starts COLLAPSED at every width now (Jay 7/28): the conversation is the point, so it gets full
  // height immediately; the pinned "Why this matters ▶" pill (the header never scrolls) invites a tap to read the
  // framing, which the Companion's opening beat echoes anyway. (Was open-on-landing, which squeezed the chat — worst on
  // a phone, where it stranded the member on a question-less tail; Jennifer's walk, 2026-07-27.)
  const [whyOpen, setWhyOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
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
      {/* The SHARED app topbar. This surface used to hand-roll a brand-only bar, making the workspace the one member
          page without Program / Field Guide / Playbook — the same gap SubpageShell fixed for the subpages. */}
      {topbar}

      <div className={`ws-col${review ? ' ws-review' : ''}`}>
        <header className="ws-col-head">
          {review ? (
            <>
              <Link href={`/program/${memberId}`} className="ws-back">← The Program</Link>
              <div className="ws-col-way">
                <div className="ws-way-pos">
                  <div className="ws-way-ph">Phase {wayfinding.phaseOrdinal} · {wayfinding.phaseLabel} · Completed</div>
                  <div className="ws-way-ss">{wayfinding.positionLabel}</div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Back nav FIRST, matching SubpageShell — every other member page puts "← Dashboard" directly under the
                  topbar, and the workspace was the outlier. (Jay, 8/7: "it's on EVERY sub page.") */}
              <Link href={`/dashboard/${memberId}`} className="ws-back">← Dashboard</Link>
              {/* Wayfinding on ONE line — phase and position were stacked, and "The Program →" sat alongside them as a
                  third route out. It's dropped: the shared topbar carries Program, so it was a duplicate of a link
                  now two rows above it. */}
              <div className="ws-col-way">
                <div className="ws-way-pos">
                  <div className="ws-way-ph">
                    Phase {wayfinding.phaseOrdinal} · {wayfinding.phaseLabel}
                    <span className="ws-way-ss">{wayfinding.positionLabel}</span>
                  </div>
                  <div className="ws-way-bar"><span className="ws-way-fill" style={{ width: `${wayfinding.progressPct}%` }} /></div>
                </div>
              </div>
            </>
          )}

          {/* The two framing tiers, on ONE row so depth costs no height.
              · "Why this matters" (~70 words) expands INLINE and auto-collapses on scroll.
              · "Explore the Science" (~300) opens an OVERLAY — see explore-panel.tsx.
              Peers rather than nested: the Why panel closes itself the moment the member scrolls, so hanging the
              science link inside it would put it behind a door that shuts. The glyphs say which one moves the page. */}
          {summary && !review && (
            <div className={`ws-why${whyOpen ? ' open' : ''}`}>
              <div className="ws-why-row">
                <button type="button" className="ws-why-toggle" onClick={() => setWhyOpen((v) => !v)} aria-expanded={whyOpen}>
                  Why this matters <span className="ws-why-caret" aria-hidden="true">{whyOpen ? '▾' : '▸'}</span>
                </button>
                {explore && (
                  <button type="button" className="ws-explore-open" onClick={() => setExploreOpen(true)} aria-haspopup="dialog">
                    Explore the Science <span aria-hidden="true">↗</span>
                  </button>
                )}
              </div>
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
            <SessionConversation memberId={memberId} sessionKey={sessionKey} onReconnectStage={setReconnectStage} />
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

      {/* Tier 3. Mounted at the root, not inside the header, so opening it can never change the header's height. */}
      {exploreOpen && explore && (
        <ExplorePanel explore={explore} title={wayfinding.positionLabel} onClose={() => setExploreOpen(false)} />
      )}
    </>
  );
}
