'use client';

import { useState } from 'react';

// Onboarding welcome (Slice B) — the first-run "meet the Companion" flow. Comes BEFORE the sign-up gate (Jay): forecast
// what to expect + establish safety FIRST, so identifying yourself reads as a good decision, not a risk. The opening
// hero (photo billboard) now shows on BOTH desktop and mobile (Jay 2026-07-26: fold the hero into mobile) — so every
// visitor gets the "what this is" framing before the navy billboard beats.
//   Hero → five navy beats: already-done-the-hard-part → meet the Companion → the four Phases → the Dashboard →
//   one more step → hand off to the gate. No name yet — the gate is still ahead — so nothing is personalized.
// Rendered as two CSS-toggled tracks (≤1000px = mobile) so there's no hydration flash; both now run hero → beats.
// Flag-gated (ONBOARDING_WELCOME). onBegin hands to the gate.

type Seg = string | { b: string };
type Beat = { kick: string; head: string[]; body: Seg[]; cta: string };

const BEATS: Beat[] = [
  {
    kick: '',
    head: ['You’ve already', 'done the', 'hard part.'],
    body: [
      'There’s no version of your answers that’s wrong — only versions that are true or aren’t. The more honest you are, the more useful this gets.',
    ],
    cta: 'Next →',
  },
  {
    kick: '',
    head: ['Meet your', 'Companion'],
    body: [
      'There’s probably no one else in your life like this. Always listening. Always here. Remembers everything. Might see things in you that you hadn’t seen yourself. You can ask any question, any time.',
    ],
    cta: 'Next →',
  },
  {
    kick: '',
    head: ['Four phases.', 'Your pace.'],
    body: [
      'Reconnect — find who you are again. Rewire — get your head right. Rebuild — get your body back. Reclaim — step all the way into it. ',
      { b: 'Grinta' },
      ' is Italian for grit, and it’s exactly what you’ll build as you go through the program, one Phase at a time.',
    ],
    cta: 'I’m in →',
  },
  {
    kick: '',
    head: ['You show up.', 'We keep track.'],
    body: [
      'Every conversation with your Companion, every assessment you take, is kept on your ',
      { b: 'Dashboard' },
      '. One place to go to see what you’ve done, where you are, and what’s next.',
    ],
    cta: 'Show me →',
  },
  {
    kick: '',
    head: ['One more', 'step'],
    body: ['Your comeback begins with a conversation between you and your G4L Companion.'],
    cta: 'Start my comeback →',
  },
];

const renderBody = (segs: Seg[]) =>
  segs.map((s, i) => (typeof s === 'string' ? <span key={i}>{s}</span> : <strong key={i}>{s.b}</strong>));

// The five navy billboard beats — shared by both platforms (they follow the hero on desktop and mobile alike).
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
          <p className="onbwel-body">{renderBody(beat.body)}</p>
          <button type="button" className="onbwel-cta" onClick={advance}>{beat.cta}</button>
          {last && <p className="onbwel-reassure">Takes about 20 minutes. Take all the time you need.</p>}
        </div>
      </div>
    </div>
  );
}

// The opening HERO — the landing-page photo billboard, continuous with grintaforlife.com. Shows on desktop AND mobile
// now; the photo (public/brand/onboarding-hero.jpg) sits behind a dark scrim so the copy stays legible at any width.
function WelcomeHero({ onNext }: { onNext: () => void }) {
  return (
    <div className="onbwel-d-hero">
      <div className="onbwel-d-heart">
        <h1 className="onbwel-d-head">Welcome midlifer.<br />Your comeback<br />begins today.</h1>
        <p className="onbwel-d-sub">
          You’re still in there. The person you were before life got loud — before the job, the obligations, the
          hundred reasonable trade-offs that added up to someone you don’t quite recognize. That person didn’t
          disappear. They got crowded out.
        </p>
        <p className="onbwel-d-sub">
          <strong>Grinta for Life</strong> is how you come back. Together we’ll explore who you used to be, look at
          what caused your Fade away from them, and get clear on who and what you want to reclaim. Then we’ll build
          your way back from identity loss to a healthier and happier rest of your life.
        </p>
        <p className="onbwel-d-sub">
          It starts with a real conversation with your AI G4L Companion that’s as easy as a chat with a friend.
        </p>
        <button type="button" className="onbwel-d-cta" onClick={onNext}>Sign up →</button>
      </div>
    </div>
  );
}

export default function OnboardingWelcome({ onBegin }: { onBegin: () => void }) {
  // Both tracks now run hero → beats (Jay: the hero shows on mobile too). Each track holds its own stage so the CSS
  // breakpoint toggle stays flash-free; only the one for the current viewport is visible, the other is inert.
  const [dStage, setDStage] = useState<'hero' | 'beats'>('hero');
  const [mStage, setMStage] = useState<'hero' | 'beats'>('hero');
  return (
    <>
      <div className="onbwel-track onbwel-track-d">
        {dStage === 'hero' ? <WelcomeHero onNext={() => setDStage('beats')} /> : <NavyBeats onDone={onBegin} />}
      </div>
      <div className="onbwel-track onbwel-track-m">
        {mStage === 'hero' ? <WelcomeHero onNext={() => setMStage('beats')} /> : <NavyBeats onDone={onBegin} />}
      </div>
    </>
  );
}
