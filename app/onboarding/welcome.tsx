'use client';

import { useState } from 'react';

// Onboarding welcome (Slice B) — the first-run "meet the Companion" flow. Comes BEFORE the sign-up gate (Jay): forecast
// what to expect + establish safety FIRST, so identifying yourself reads as a good decision, not a risk. Two openings:
//   • DESKTOP → the landing-page hero image ("Let's begin your comeback") THEN the four navy billboard beats.
//   • MOBILE  → straight into the four navy billboard beats.
// The four beats: meet the Companion (mirror-not-grade) → name the Fade → orient + reassure (the four R's, ~7–8 weeks,
// your pace) → hand off to the gate. No name yet — the gate is still ahead — so the greeting is generic; the Companion
// uses their name only AFTER they choose to give it. Rendered as two CSS-toggled tracks (≤1000px = mobile) so there's
// no hydration flash. Copy illustrative from the mocks; sweep-provisional labels ("the Fade") live only as prose.
// Flag-gated (ONBOARDING_WELCOME). onBegin hands to the gate.

type Seg = string | { b: string };
type Beat = { kick: string; head: string[]; body: Seg[]; road?: boolean; cta: string };

const BEATS: Beat[] = [
  {
    kick: '',
    head: ['You’re here.', 'That’s the', 'hard part.'],
    body: ['I’m your Companion. I’m not here to fix you or grade you — I’m here to help you find your way back to yourself.'],
    cta: 'Go on →',
  },
  {
    kick: 'What happened',
    head: ['You didn’t', 'lose yourself', 'all at once.'],
    body: [
      'It went one reasonable choice at a time — a door closing here, a thing you loved set down there. We call it ',
      { b: 'the Fade' },
      '. Naming it is where it starts to turn around.',
    ],
    cta: 'That lands →',
  },
  {
    kick: 'The road ahead',
    head: ['Four moves.', 'Your pace.'],
    road: true,
    body: [
      'No grades, no streaks, nothing to catch up on. Every number you’ll ever see here is built from your own honest read — ',
      { b: 'a mirror, not a report card.' },
    ],
    cta: 'I’m in →',
  },
  {
    kick: '',
    head: ['Ready to', 'meet', 'yourself?'],
    body: ['We’ll start by getting honest about where you are. There are no wrong answers — take all the time you need.'],
    cta: 'Let’s begin →',
  },
];

const ROAD = ['Reconnect', 'Rewire', 'Rebuild', 'Reclaim'];

const renderBody = (segs: Seg[]) =>
  segs.map((s, i) => (typeof s === 'string' ? <span key={i}>{s}</span> : <strong key={i}>{s.b}</strong>));

// The four navy billboard beats — shared by both platforms (desktop reaches them after the hero, mobile opens on them).
function NavyBeats({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const beat = BEATS[i]!;
  const last = i === BEATS.length - 1;
  const advance = () => (last ? onDone() : setI((n) => n + 1));

  return (
    <div className="onbwel">
      <div className="onbwel-wrap">
        <div className="onbwel-dots" aria-hidden="true">
          {BEATS.map((_, x) => (
            <span key={x} className={`onbwel-dot${x === i ? ' on' : ''}`} />
          ))}
        </div>
        <div className="onbwel-heart">
          {beat.kick && <div className="onbwel-kick">{beat.kick}</div>}
          <h1 className="onbwel-head">
            {beat.head.map((line, x) => (
              <span key={x} className="onbwel-head-line">{line}</span>
            ))}
          </h1>
          {beat.road && (
            <div className="onbwel-road">
              <div className="onbwel-road-h">The road ahead · about 7–8 weeks</div>
              <div className="onbwel-road-steps">
                {ROAD.map((r) => (
                  <span key={r} className="onbwel-road-step">{r}</span>
                ))}
              </div>
            </div>
          )}
          <p className="onbwel-body">{renderBody(beat.body)}</p>
          <button type="button" className="onbwel-cta" onClick={advance}>{beat.cta}</button>
          {last && <p className="onbwel-reassure">Takes about 10 minutes. No grades, no wrong answers.</p>}
        </div>
      </div>
    </div>
  );
}

// DESKTOP hero — the landing-page image, continuous with grintaforlife.com. The warm gradient stands in for the hero
// photograph (cool daylight left → warm olive right) until a real image drops in.
function DesktopHero({ onNext }: { onNext: () => void }) {
  return (
    <div className="onbwel-d-hero">
      <div className="onbwel-d-heart">
        <h1 className="onbwel-d-head">Let’s begin<br />your comeback.</h1>
        <p className="onbwel-d-sub">You’ve carried a lot to get here. I’m your Companion — I’ll walk the whole way with you, at your pace.</p>
        <button type="button" className="onbwel-d-cta" onClick={onNext}>Let’s get started →</button>
        <p className="onbwel-d-reassure">Takes about 10 minutes. No grades, no wrong answers.</p>
      </div>
    </div>
  );
}

export default function OnboardingWelcome({ onBegin }: { onBegin: () => void }) {
  // Desktop track: hero → beats. Mobile track: beats. Both mounted; CSS shows the right one per breakpoint so there's
  // no viewport-detection flash. Each track holds its own state; the hidden one is inert.
  const [desktopStage, setDesktopStage] = useState<'hero' | 'beats'>('hero');
  return (
    <>
      <div className="onbwel-track onbwel-track-d">
        {desktopStage === 'hero' ? <DesktopHero onNext={() => setDesktopStage('beats')} /> : <NavyBeats onDone={onBegin} />}
      </div>
      <div className="onbwel-track onbwel-track-m">
        <NavyBeats onDone={onBegin} />
      </div>
    </>
  );
}
