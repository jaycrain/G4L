'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { completeTourAction } from './threshold-actions.ts';

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

  // The spotlight walk — fixed sequence, words filled from the member's data. §7 voice (declare what it
  // is; no definitional negation). Ordered top-to-bottom by the shipped dashboard, ending near the foot
  // so the settle rises back up to the companion's home.
  const allStops: Stop[] = [
    {
      target: 'program',
      line: nextSessionTitle
        ? `Your path — Reconnect, Rewire, Rebuild, Reclaim. Your next step's already lit: ${nextSessionTitle}.`
        : `Your path — Reconnect, Rewire, Rebuild, Reclaim. Your next step lights up here.`,
    },
    { target: 'daily', line: 'Your Daily Beat — the heartbeat between Sessions. One thought, one small move, every day.' },
    { target: 'idscore', line: 'Your ID Score — the mirror. How far the gap runs, and the climb back.' },
    { target: 'reclaim', line: "Your Reclaim List — what you're bringing back. The goals the work points at." },
    { target: 'doors', line: doorsLine },
  ];
  // Only walk stops whose anchor exists on THIS dashboard — so the redesign (no Daily Beat panel) skips that stop
  // instead of dimming to a spotlight-less line. The live dashboard has every anchor, so its walk is unchanged.
  const stops: Stop[] = typeof document !== 'undefined' ? allStops.filter((s) => document.querySelector(`[data-tour="${s.target}"]`)) : allStops;

  // Run on first post-Threshold landing (autoStart) or a Field-Guide replay (?tour=1).
  useEffect(() => {
    const force = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tour') === '1';
    if (autoStart || force) setPhase('transition');
    // Mark it SEEN the moment the first-run tour appears — so navigating away mid-tour (e.g. to "Your full story")
    // doesn't re-fire it on return. finish() marks it too (idempotent); a ?tour=1 replay never re-marks.
    if (autoStart) void completeTourAction(memberId);
  }, [autoStart]);

  const measure = useCallback((key: string) => {
    const el = document.querySelector(`[data-tour="${key}"]`) as HTMLElement | null;
    if (!el) return setRect(null);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // let the smooth-scroll settle before measuring
    const t = setTimeout(() => setRect(el.getBoundingClientRect()), 320);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase === 'walk') return measure(stops[step]!.target);
    if (phase === 'next') return measure('next-step');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step, measure]);

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
            That&apos;s your Threshold crossed, {firstName}. Before I step back — let me show you around your home base.
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
        <div className="tour-card tour-coach" style={coachStyle(rect)}>
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

// Place the coachmark just below the spotlight (or above if it'd run off the bottom), clamped to the viewport.
function coachStyle(rect: DOMRect | null): React.CSSProperties {
  if (typeof window === 'undefined' || !rect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  const cardW = 320;
  const below = rect.bottom + 14;
  const above = rect.top - 14;
  const room = window.innerHeight - rect.bottom;
  const left = Math.min(Math.max(rect.left + rect.width / 2 - cardW / 2, 12), window.innerWidth - cardW - 12);
  if (room > 220) return { top: below, left, width: cardW };
  return { top: Math.max(above - 200, 12), left, width: cardW };
}
