'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { completeTourAction } from './threshold-actions.ts';
import { tourLine } from '../../lib/content/panel-messaging.ts';
import { placeCoach } from '../../lib/dashboard/coach-placement.ts';

// Post-Ceremony Tour (back-half of the Companion Ceremony). After the Threshold, the companion doesn't
// drop the member on a static dashboard — it tours the real Slice 1 surfaces, points at the one next
// step, and visibly SETTLES into its resting spot: the "The G4L Companion" hero panel (NOT an edge
// handle — that was removed). Once per member, skippable, re-runnable from the Field Guide (?tour=1).
type Stop = { target: string; line: string };

const Mark = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img className="tour-mark" src="/icons/icon-192.png" alt="" aria-hidden="true" />
);

export default function PostCeremonyTour({
  memberId,
  firstName,
  doorsLine,
  nextSessionTitle,
  autoStart,
}: {
  memberId: string;
  firstName: string;
  doorsLine: string;
  nextSessionTitle: string | null;
  autoStart: boolean;
}) {
  const [phase, setPhase] = useState<'idle' | 'transition' | 'walk' | 'next' | 'settle' | 'done'>('idle');
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [settleRect, setSettleRect] = useState<DOMRect | null>(null);
  const [landed, setLanded] = useState(false);
  // The card's REAL height. Placement has to know it — the old code assumed 200px, the card is 250–320px, and the
  // difference is precisely how far it overshot onto the panel. 300 is the first-paint estimate; the effect below
  // replaces it with the measurement before the member reads the line.
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardH, setCardH] = useState(300);

  // The spotlight walk — fixed sequence, words filled from the member's data. §7 voice (declare what it
  // is; no definitional negation). Covers EVERY panel a member sees: center (where you are) → left flank
  // (the mirrors) → right flank (the actions), ending on the Reclaim List, then the one next step — so the
  // settle rises back up to the companion's home. Stops whose anchor isn't on this dashboard are filtered
  // out below (daily/doors live on the old dashboard; the triptych folds them into other surfaces).
  // CAT-46 — which triptych pane each stop lives in, so the tour can reveal it on the mobile fold. Anything not
  // listed is center/legacy and needs no switch.
  const PANE_OF: Record<string, 'left' | 'center' | 'right'> = {
    companion: 'center',
    idscore: 'left',
    grinta: 'left',
    badges: 'left',
    momentum: 'right',
    connect: 'right',
    movement: 'right',
    reclaim: 'right',
    program: 'center',
    daily: 'center',
    doors: 'center',
  };

  // EVERY PANEL'S LINE COMES FROM THE MESSAGING LADDER, not from here. These used to be hand-written twice —
  // once in lib/content/panel-messaging.ts and once here — so Jay's copy edits landed on the panels and the tour
  // went on saying the old words (his walk, 2026-08-13: "some of the copy didn't have my last edits"). Only the
  // three targets with no panel of their own still carry a line locally.
  const allStops: Stop[] = [
    // THE COMPANION GOES FIRST, and it had no stop at all until 2026-08-13 — the anchor existed, nothing pointed
    // at it. The Companion is the product; the tour introduced every panel around it and never it. Its line is
    // local because the Companion has no subpage, so it has no rung in the ladder to inherit.
    {
      target: 'companion',
      line: 'Your Companion is right here. The same one you just talked to — always in the center, always listening. Ask it anything, anytime. It remembers everything.',
    },
    { target: 'program', line: tourLine('program') },
    // THE PLAYBOOK STOP goes SECOND — right after Program, because Program → Playbook is the arc: the Program is
    // how you do the work, the Playbook is what the work leaves in your hands.
    //
    // It was missing entirely until Jay's walk (2026-08-11). Worse, its absence was invisible: the tour filters
    // out stops whose target element isn't on the page, and the Playbook panel used to hide itself at zero plays.
    // So a brand-new member — the only member who ever sees this tour — was the exact member who never got told
    // the Playbook exists, moments after the welcome pact promised it to them.
    { target: 'playbook', line: tourLine('playbook') },
    { target: 'idscore', line: tourLine('idScore') },
    { target: 'grinta', line: tourLine('grinta') },
    { target: 'badges', line: tourLine('badges') },
    { target: 'momentum', line: tourLine('momentum') },
    { target: 'connect', line: tourLine('community') },
    { target: 'movement', line: tourLine('movement') },
    { target: 'reclaim', line: tourLine('reclaimList') },
    // Account — the topbar, not a panel, so it comes after the panels rather than in the middle of the flanks.
    { target: 'account', line: tourLine('account') },
    { target: 'daily', line: 'Your Daily Beat — the heartbeat between Sessions. One thought, one small move, every day.' },
    { target: 'doors', line: doorsLine },
  ];
  // CAT-46 — DON'T SILENTLY DROP 7 OF 9 STOPS ON A PHONE.
  // This filtered to anchors with width > 0. On the triptych's mobile fold the two inactive panes are
  // display:none (width 0), so a brand-new member onboarding on a phone got a gutted tour — only the center
  // stop — and never met their ID Score, Grinta, Badges, Momentum, Community, Movement or Reclaim List. Because
  // the tour is marked complete and runs once per member, those introductions were lost PERMANENTLY. The
  // once-only design is right; combining it with a silent visibility filter is what made the loss unrecoverable.
  //
  // The anchors are in the DOM either way — just in a hidden pane. So instead of dropping them we bring the pane
  // to them: each stop declares which pane it lives in, and the tour asks the triptych to switch before
  // spotlighting. On desktop every pane is visible and the switch is a no-op.
  const stops: Stop[] =
    typeof document !== 'undefined'
      ? allStops.filter((s) => !!document.querySelector(`[data-tour="${s.target}"]`))
      : allStops;

  // SAY WHICH STOPS WERE DROPPED. The filter above is load-bearing and correct — a stop with no anchor can't be
  // spotlighted — but it is SILENT, and a silent filter has now hidden two introductions from the only member who
  // ever sees this tour: the Playbook (2026-08-11) and the Account (2026-08-13). Both times the anchor existed
  // somewhere in the codebase, just not on the rendered dashboard, so reading the source told you it was fine.
  // A line in the console is what turns "it didn't come up" into a five-second answer.
  useEffect(() => {
    const missing = allStops.filter((s) => !document.querySelector(`[data-tour="${s.target}"]`)).map((s) => s.target);
    if (missing.length) console.warn(`[tour] no anchor on this page, stop skipped: ${missing.join(', ')}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Run on first post-Threshold landing (autoStart) or a Field-Guide replay (?tour=1).
  useEffect(() => {
    const force = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tour') === '1';
    if (force) {
      setPhase('transition'); // an explicit replay always runs, and never re-marks
      return;
    }
    if (!autoStart) return;
    // ONE-SHOT, belt AND braces. `autoStart` comes from a SERVER-rendered read of tour_completed_at, which Next's
    // client router cache can replay STALE: leaving for "My Story" and coming back re-served the pre-write payload,
    // so the tour fired a second time even though the DB already said completed (Jay's walk). Marking it server-side
    // alone can't fix that — the stale prop never sees the write. A durable per-member client marker closes it.
    const key = `g4l-tour-seen-${memberId}`;
    try {
      if (localStorage.getItem(key) === '1') return; // already shown on this device — never replay
      localStorage.setItem(key, '1');
    } catch {
      /* storage unavailable (private mode) — fall back to the server prop alone */
    }
    setPhase('transition');
    void completeTourAction(memberId); // idempotent; finish() marks it too
  }, [autoStart, memberId]);

  const measure = useCallback((key: string) => {
    const el = document.querySelector(`[data-tour="${key}"]`) as HTMLElement | null;
    if (!el) return setRect(null);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // let the smooth-scroll settle before measuring
    const t = setTimeout(() => setRect(el.getBoundingClientRect()), 320);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase === 'walk') {
      // CAT-46: bring the pane to the stop before measuring. On the mobile fold the flank panes are display:none,
      // so without this the anchor measures 0×0 and the member never meets that surface at all. Desktop shows all
      // three panes, so the request is a no-op there. One frame for the pane swap to lay out, then measure.
      const pane = PANE_OF[stops[step]!.target];
      if (pane) window.dispatchEvent(new CustomEvent('g4l:show-pane', { detail: pane }));
      const t = setTimeout(() => measure(stops[step]!.target), pane ? 90 : 0);
      return () => clearTimeout(t);
    }
    if (phase === 'next') return measure('next-step');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step, measure]);

  // Measure the card once it has rendered this step's line, and re-place if the height changed. Lines differ by
  // ~70px between the shortest and longest stop, which is enough to turn a clean placement into an overlap.
  useEffect(() => {
    const h = cardRef.current?.offsetHeight;
    if (h && Math.abs(h - cardH) > 2) setCardH(h);
  });

  // Keep the spotlight glued to its target on resize/scroll.
  useEffect(() => {
    if (phase !== 'walk' && phase !== 'next') return;
    const key = phase === 'next' ? 'next-step' : stops[step]!.target;
    const reflow = () => {
      const el = document.querySelector(`[data-tour="${key}"]`) as HTMLElement | null;
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', reflow);
    window.addEventListener('scroll', reflow, true);
    return () => {
      window.removeEventListener('resize', reflow);
      window.removeEventListener('scroll', reflow, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step]);

  // The settle: measure the companion hero, then animate a mark from center into it.
  useEffect(() => {
    if (phase !== 'settle') return;
    const hero = document.querySelector('[data-tour="companion"]') as HTMLElement | null;
    hero?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    const t1 = setTimeout(() => {
      if (hero) setSettleRect(hero.getBoundingClientRect());
      setLanded(true); // triggers the glide via CSS transition
    }, 360);
    const t2 = setTimeout(() => void finish(), 1500); // after the glide, complete + un-mount
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const finish = useCallback(async () => {
    setPhase('done');
    await completeTourAction(memberId);
  }, [memberId]);

  if (phase === 'idle' || phase === 'done') return null;

  if (phase === 'transition') {
    return (
      <div className="tour-scrim tour-dim">
        <div className="tour-card tour-intro">
          <Mark />
          <p className="tour-line">
            Way to go! Hope you have already had some valuable insights and thought provoking moments. I’ve been
            tracking everything we’ve talked about. Take a minute to look around your Dashboard where we’re keeping
            everything we’ve done and more.
          </p>
          <div className="tour-cta">
            <button type="button" className="tour-next" onClick={() => { setStep(0); setPhase('walk'); }}>Show me around →</button>
            <button type="button" className="tour-skip" onClick={() => void finish()}>Skip the tour</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'walk' || phase === 'next') {
    const isNext = phase === 'next';
    const last = !isNext && step >= stops.length - 1;
    const line = isNext ? "Start here when you're ready — your first Session's waiting." : stops[step]!.line;
    return (
      <div className="tour-scrim">
        {rect && (
          <div
            className="tour-cutout"
            style={{ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 }}
          />
        )}
        <div ref={cardRef} className="tour-card tour-coach" style={coachStyle(rect, cardH)}>
          <Mark />
          <p className="tour-line">{line}</p>
          <div className="tour-foot">
            <span className="tour-dots" aria-hidden="true">
              {[...stops, {}].map((_, i) => (
                <span key={i} className={`tour-dot${(isNext ? stops.length : step) === i ? ' on' : ''}`} />
              ))}
            </span>
            <div className="tour-cta">
              <button type="button" className="tour-skip" onClick={() => void finish()}>Skip</button>
              <button
                type="button"
                className="tour-next"
                onClick={() => {
                  if (isNext) setPhase('settle');
                  else if (last) setPhase('next');
                  else setStep(step + 1);
                }}
              >
                {isNext ? 'Got it →' : last ? 'One last thing →' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // settle: a mark glides from center into the hero's resting spot, then we complete + un-mount.
  return (
    <div className="tour-scrim tour-settle">
      <div
        className={`tour-settle-mark${landed ? ' landed' : ''}`}
        style={landed && settleRect ? { top: settleRect.top + 18, left: settleRect.left + 22 } : undefined}
      >
        <Mark />
        {!landed && <p className="tour-line">This is home base — I&apos;m right here.</p>}
      </div>
    </div>
  );
}

const CARD_W = 320;

// Thin adapter over the pure placer — the decision lives in lib/dashboard/coach-placement.ts, where it can be
// tested against the real measurements from a 1512×900 walk instead of by watching a tour.
function coachStyle(rect: DOMRect | null, cardH: number): React.CSSProperties {
  if (typeof window === 'undefined' || !rect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  const p = placeCoach(
    { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    { width: window.innerWidth, height: window.innerHeight },
    { width: CARD_W, height: cardH },
  );
  return { top: p.top, left: p.left, width: p.width };
}
