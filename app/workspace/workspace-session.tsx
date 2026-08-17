'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { readArtifactAction } from './actions.ts';
import { useRouter } from 'next/navigation';
import { ARTIFACT_REFRESH_EVENT, SESSION_COMPLETE_EVENT } from '../components/artifact-refresh.ts';
import { chatDispatch, type SessionKey } from '../../lib/workspace/session-key.ts';
import { reconnectStageTitle } from '../../lib/content/explore.ts';
import type { Artifact } from '../../lib/workspace/artifact.ts';
import type { RingPhaseState } from '../../lib/workspace/ring-state.ts';
import RedesignChrome from '../dashboard/redesign-chrome.tsx';
import ReconnectChat from '../reconnect/reconnect-chat.tsx';
import RewireChat from '../rewire/rewire-chat.tsx';
import RebuildChat from '../rebuild/rebuild-chat.tsx';
import ReclaimChat from '../reclaim/reclaim-chat.tsx';
import SessionVisualView from './session-visual.tsx';

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
  // RECONNECT RESOLVES ITS SCIENCE CHECK BY BEAT. Greg wrote three (r1/r2/r3) for what the member experiences as
  // ONE session, so keyed by session id it found nothing and the button silently never drew — the content was
  // there the whole time. The nine other sessions are 1:1 with an asset and resolve normally. Still tracked here
  // because the HEADER TITLE follows the beat (reconnectStageTitle); the teaching cards resolve their own content.
  const [reconnectStage, setReconnectStage] = useState<string | null>(null);
  const isReconnect = chatDispatch(sessionKey).arc === 'reconnect';
  const bodyRef = useRef<HTMLDivElement>(null);
  // (Removed 2026-08-16: a wheel/touchmove listener that collapsed the framing panel on first scroll. It existed
  //  because the panel was PINNED in this header and had to get out of the conversation's way. The panel now lives
  //  in the thread and scrolls away on its own, so the listener had nothing left to close.)
  // The "here's what you built" card — the RECEIPT for the session, raised when the member continues from the
  // finished conversation, not the instant the arc completes.
  const [endCard, setEndCard] = useState(false);
  const router = useRouter();

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
    // The member finished reading the close and hit Continue: read the final artifact, then raise the receipt.
    const onComplete = async () => {
      const next = await readArtifactAction(memberId, sessionKey);
      if (cancelled) return;
      if (next) setArtifact(next);
      // NO DEAD END. The card is what the Continue button now asks for, so when there is nothing to show it — a
      // session that kept nothing — the click must still take them home rather than doing visibly nothing.
      const hasSomething = (next ?? artifact).slots.some((sl) => (sl.value ?? '').trim().length > 0);
      if (!hasSomething) {
        router.refresh();
        router.push(`/dashboard/${memberId}`);
        return;
      }
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
              {/* A revisit is reached from the PLAYBOOK — that "Revisit" link is the only route into ?review=1 — so
                  back belongs there, not on the Program. Sending them to the Program dropped them somewhere they
                  hadn't been and made them re-find the entry they were reading (Jay's walk, 2026-08-11). If a second
                  entry point ever appears, this should carry the origin rather than pick a new hardcoded guess. */}
              <Link href={`/playbook/${memberId}`} className="ws-back">← Your Playbook</Link>
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
                    <span className="ws-way-ss">{isReconnect ? reconnectStageTitle(reconnectStage) : wayfinding.positionLabel}</span>
                  </div>
                  <div className="ws-way-bar"><span className="ws-way-fill" style={{ width: `${wayfinding.progressPct}%` }} /></div>
                </div>
              </div>
            </>
          )}

          {/* THE FRAMING TIERS MOVED OUT OF THIS HEADER (2026-08-16). They used to live here as a "Why this matters"
              inline expander plus an "Explore the Science" overlay link — optional content the member triggered from
              a widget, and skipped, while the Checkpoints downstream read as though they hadn't.
              They are now REQUIRED teaching beats rendered inside the thread: see app/workspace/teaching-cards.tsx.
              Leaving the row here would have printed "Why this matters" twice on one screen — the walk's first
              screenshot caught exactly that. The header keeps only wayfinding, which is what a fixed header is for. */}

          {/* KEPT CHIPS REMOVED (Jay, 2026-08-11: "the Kept row doesn't do anything for the member either, does
              it? Your doors, does."). He is right, and the distinction is worth keeping: "Your doors: The Career
              Cliff · The Marriage · The Load-Bearer" is HIS material, named back to him. "Kept ✓ The self you're
              reclaiming ✓ The Doors you named" is OUR progress bookkeeping wearing his vocabulary — it tells him
              the machine recorded something, which is our concern, not his. The header keeps what is his. */}
        </header>

        <div className="ws-col-body" ref={bodyRef}>
          {review ? (
            // The summary card — every answer the member built, kept.
            <div className="ws-built">
              <h1 className="ws-built-title">{artifact.title}</h1>
              <p className="ws-built-lede">{artifact.lede}</p>
              {/* The picture the Session showed, shown again. Above the slots because it is the thing the member
                  was looking at when they decided — the slots are what came out of that. */}
              {artifact.visual && <SessionVisualView visual={artifact.visual} />}
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

      {/* End card — the receipt for the session: every answer the member built, in one place.
          It is raised when the member CONTINUES from the finished conversation, not the instant the arc completes.
          Firing it on completion put it on top of the Companion's close before that close could be read; the wrap
          earns the receipt, so it comes first. From here "Continue →" leaves for the dashboard. */}
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
            <button
              type="button"
              className="ws-endcard-cta"
              onClick={() => { router.refresh(); router.push(`/dashboard/${memberId}`); }}
            >
              Continue →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
