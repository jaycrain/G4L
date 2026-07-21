'use client';

import { useState } from 'react';

// Onboarding welcome (Slice B) — the first-run "meet the Companion" screen. Sits AFTER the sign-up gate (so the name is
// known) and BEFORE the live onboarding work. Four beats carry the relationship's opening terms: meet the Companion
// (mirror-not-grade), name the Fade, orient + reassure (the four R's, ~7–8 weeks, your pace), then hand into the real
// work. Navy billboard aesthetic (Barlow Condensed all-caps head), one component for desktop + mobile. Copy is
// illustrative from the mock; sweep-provisional labels ("the Fade") live only as prose. Flag-gated (ONBOARDING_WELCOME).

type Seg = string | { b: string };
type Beat = { kick: string; head: string[]; body: Seg[]; road?: boolean; cta: string };

const BEATS: Beat[] = [
  {
    kick: '', // beat 1 kicker is the personalized "Welcome, {name}" — filled at render
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

export default function OnboardingWelcome({ firstName, onBegin }: { firstName: string; onBegin: () => void }) {
  const [i, setI] = useState(0);
  const beat = BEATS[i]!;
  const last = i === BEATS.length - 1;
  const kicker = i === 0 ? (firstName ? `Welcome, ${firstName}` : 'Welcome') : beat.kick;

  const advance = () => (last ? onBegin() : setI((n) => n + 1));

  return (
    <div className="onbwel">
      <div className="onbwel-wrap">
        <div className="onbwel-dots" aria-hidden="true">
          {BEATS.map((_, x) => (
            <span key={x} className={`onbwel-dot${x === i ? ' on' : ''}`} />
          ))}
        </div>
        <div className="onbwel-heart">
          {kicker && <div className="onbwel-kick">{kicker}</div>}
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
