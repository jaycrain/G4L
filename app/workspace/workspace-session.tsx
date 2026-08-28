'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { readArtifactAction, readSessionTrackerAction } from './actions.ts';
import { useRouter } from 'next/navigation';
import { ARTIFACT_REFRESH_EVENT, SESSION_COMPLETE_EVENT } from '../components/artifact-refresh.ts';
import { chatDispatch, type SessionKey } from '../../lib/workspace/session-key.ts';
import { reconnectStageTitle } from '../../lib/content/explore.ts';
import { whereItLives } from '../../lib/content/where-it-lives.ts';
import { hasHandoff } from '../../lib/content/session-tracker.ts';
import type { Artifact } from '../../lib/workspace/artifact.ts';
import type { PostSessionNudge } from '../../lib/connect/post-session-nudge.ts';
import type { RingPhaseState } from '../../lib/workspace/ring-state.ts';
import RedesignChrome from '../dashboard/redesign-chrome.tsx';
import ReconnectChat from '../reconnect/reconnect-chat.tsx';
import RewireChat from '../rewire/rewire-chat.tsx';
import RebuildChat from '../rebuild/rebuild-chat.tsx';
import ReclaimChat from '../reclaim/reclaim-chat.tsx';
import SessionVisualView from './session-visual.tsx';

/** What the close knows about the week the Session just opened. Null when it opened none — see session-tracker.ts. */
type SessionTracker = Awaited<ReturnType<typeof readSessionTrackerAction>>;

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
  if (arc === 'reconnect') return <ReconnectChat memberId={memberId} session={session as 'r1' | 'r2' | 'r3' | 'checkpoint'} onStage={onReconnectStage} />;
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
  nudge = null,
}: {
  memberId: string;
  sessionKey: SessionKey;
  artifact: Artifact;
  wayfinding: Wayfinding;
  review?: boolean; // read-only revisit of a COMPLETED session — the summary card, no live conversation
  topbar?: ReactNode; // the shared RedesignTopbar, rendered by the server page (async server component)
  // The moment after a Session — one line pointing at a real person in the Community, or null. Resolved on the
  // SERVER (lib/connect/post-session-nudge.ts) because it reads their pacts and unread replies; null when there
  // is nothing true to say, which is most of the time and is the point.
  nudge?: PostSessionNudge | null;
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
  const [tracker, setTracker] = useState<SessionTracker>(null);
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
      const [next, tr] = await Promise.all([
        readArtifactAction(memberId, sessionKey),
        readSessionTrackerAction(memberId, sessionKey),
      ]);
      if (cancelled) return;
      if (next) setArtifact(next);
      setTracker(tr);
      // NO DEAD END. The card is what the Continue button now asks for, so when there is nothing to show it — a
      // session that kept nothing — the click must still take them home rather than doing visibly nothing.
      //
      // "NOTHING TO SHOW" USED TO MEAN "NO FILLED SLOTS", AND THAT WAS TOO NARROW (Jay, 2026-08-26). B1, B2 and
      // C2 are administered instruments: their artifact is a qualitative frame with an EMPTY slots array, so this
      // returned early and the end card never rendered for them at all. Which means `whereItLives.b2` — authored,
      // covered by a test, sitting in the table — had never been shown to a single member. Jay finished B2, got a
      // five-day tracker built from his own answers, and was told nothing about either. A hand-off has something
      // to say when there is a destination or a tracker, not only when there are slots to recite.
      const lives = whereItLives(sessionKey);
      const hasSomething = hasHandoff({
        filledSlots: (next ?? artifact).slots.filter((sl) => (sl.value ?? '').trim().length > 0).length,
        hasTracker: !!tr,
        hasDestination: !!lives.href,
      });
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
              <p className="ws-built-foot">Saved in your Playbook — there whenever you want it.</p>
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
      {endCard && !review && (
        <div className="ws-endcard-scrim" role="dialog" aria-modal="true" aria-label="What you saw">
          <div className="ws-endcard">
            <div className="ws-endcard-eyebrow">Session complete</div>
            {/* THE TITLE HAS TO SURVIVE HAVING NOTHING TO LIST. Since the card now also raises for the administered
                instruments (B1, B2, C2), whose artifact is a qualitative frame with no slots, "Here's what you saw"
                would sit over empty space. A member who answered twenty-four items and is shown a heading with
                nothing under it reads it as the answers going nowhere — the exact fear this card exists to settle. */}
            <h2 className="ws-endcard-title">{filled.length ? 'Here’s what you saw' : 'That’s recorded'}</h2>
            {filled.length > 0 && (
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
            )}
            {/* WHERE IT LIVES — the middle third of the close (Donna's End-of-Session Flow, 2026-08-19). The card
                already showed WHAT she built and HOW to leave; it never said where the thing went. That gap is
                what produced two separate reports from her ("True Lines: no visibility after Session Complete",
                "the Reclaim List referenced but not shown"), both of which are the same question: I made
                something, where is it?

                It sits ABOVE the human step and the CTA because it is about what she just did, and a member
                reads downward from her own work. A checkpoint has no page to open — it names the reading
                instead, which is precisely when a member assumes her answers went nowhere. */}
            {(() => {
              const w = whereItLives(sessionKey);
              return (
                <div className="ws-endcard-lives">
                  <p className="ws-endcard-lives-line">{w.line}</p>
                  {w.href && w.cta && (
                    <a className="ws-endcard-lives-cta" href={w.href(memberId)}>{w.cta} →</a>
                  )}
                </div>
              );
            })()}
            {/* THE TRACKER THIS SESSION JUST BUILT — visually its own block, with the rows previewed and one tap in.
                Jay, 2026-08-26: "we've got to orient a Member to what we're creating for them, where it is, and
                immediate access to it. It's not intuitive, but once learned is easy."

                SEPARATE FROM "WHERE IT LIVES" ON PURPOSE, not for emphasis. That line answers "the thing I made —
                where did it go", about a record to go and read. This is a thing we built FOR them that wants them
                back tomorrow. Folded into the same sentence the second one vanished: B2's line names the
                development map and never mentions that a five-day tracker opened with two of the member's own
                skills as its rows. Jay finished B2 and found them on his Playbook with no idea where they came from.

                THE PREVIEW IS THE ORIENTING DEVICE. Real row labels, real day boxes, today outlined — so landing
                on the Playbook is recognising something they have seen, not decoding a sentence from a minute ago.
                "Once learned is easy" is why it is the same block in the same place after every Session that opens
                a week; the second time, they already know what it is. */}
            {tracker && (
              <div className="ws-endcard-tracker">
                <p className="ws-endcard-tracker-eyebrow">New on your Playbook</p>
                <p className="ws-endcard-tracker-title">{tracker.title}</p>
                <p className="ws-endcard-tracker-blurb">{tracker.blurb}</p>
                <div className="ws-endcard-tracker-grid" aria-hidden="true">
                  {tracker.rows.map((r, i) => (
                    <div key={i} className="ws-endcard-tracker-row">
                      <span className="ws-endcard-tracker-lab">{r.label}</span>
                      <span className="ws-endcard-tracker-days">
                        {r.marks.map((on, d) => (
                          <span
                            key={d}
                            className={`ws-endcard-tracker-box${on ? ' is-on' : ''}${d === tracker.day - 1 ? ' is-today' : ''}`}
                          />
                        ))}
                      </span>
                    </div>
                  ))}
                  {tracker.more > 0 && (
                    <p className="ws-endcard-tracker-more">
                      and {tracker.more} more {tracker.more === 1 ? 'row' : 'rows'}
                    </p>
                  )}
                </div>
                <a className="ws-endcard-tracker-cta" href={tracker.href}>{tracker.cta} →</a>
              </div>
            )}
            {/* THE HUMAN STEP. Jay, 2026-08-17: "we want to emphasize the human side that exists on the app, and
                it's a credibility builder for the Companion to encourage human interaction. Loss of connection is
                a huge factor in midlife loneliness and identity loss."

                It sits ABOVE Continue on purpose — after Continue it is a footnote nobody reads (Donna: it "needs
                to be more visually prominent so it actually stands out"). And it is a quiet second option, not a
                competing CTA: they have just finished something, and the way out is still one tap. */}
            {nudge && (
              <div className="ws-endcard-human">
                <p className="ws-endcard-human-line">{nudge.text}</p>
                <a className="ws-endcard-human-cta" href={nudge.href}>{nudge.cta} →</a>
              </div>
            )}
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
