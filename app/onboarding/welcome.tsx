'use client';

import { useEffect, useState } from 'react';

// Onboarding welcome (Slice B) — the first-run "meet the Companion" flow. Comes BEFORE the sign-up gate (Jay): forecast
// what to expect + establish safety FIRST, so identifying yourself reads as a good decision, not a risk. The opening
// hero (photo billboard) now shows on BOTH desktop and mobile (Jay 2026-07-26: fold the hero into mobile) — so every
// visitor gets the "what this is" framing before the navy billboard beats.
//   Hero → five navy beats: meet the Companion → the four phases → the vocabulary → the Playbook pact → how today
//   goes → hand off to the gate. No name yet — the gate is still ahead — so nothing is personalized.
// Rendered as two CSS-toggled tracks (≤1000px = mobile) so there's no hydration flash; both now run hero → beats.
// Flag-gated (ONBOARDING_WELCOME). onBegin hands to the gate.

type Seg = string | { b: string };
/**
 * `kick` carries the member-facing progress marker ("Part 1 of 4 · Getting ready") — the same "X of Y" pattern
 * used everywhere else in the platform. The field already existed and was empty on every beat.
 *
 * `list` exists because two of the screens are genuinely lists — the glossary and the four-part forecast — and
 * flattening them into a paragraph is what made the old "Four phases" beat a run-on sentence of four dashes.
 * `ordered` picks <ol> over <ul>; `term` bolds the leading phrase for the glossary's term — gloss shape.
 */
type Beat = {
  /** Which of Donna's illustrations sits above the copy. Absent art renders nothing — never a broken image. */
  art?: ArtKey;
  head: string[];
  body: Seg[];
  /** Slide 2 — the two-line exchange, shown as a Companion line and the member's answer back. */
  quotes?: string[];
  /** Slide 3 — the four Rs as their own row, not a comma list buried in a sentence. */
  rs?: string[];
  /** Slide 4 — the worked ID Score example, set apart so it reads as a specimen and not as a claim. */
  score?: string;
  tail?: Seg[];
  cta: string;
};

/**
 * DONNA'S SVGs, and why a missing one renders NOTHING rather than a broken image.
 *
 * The art arrives by email and lands in public/brand/onboarding/ by hand. Wiring `<img src>` straight to a path
 * that may not exist yet would put four broken-image icons on the front door — the first thing a prospect sees —
 * for however long the gap lasts. This map is the switch: a key present means the file is in the repo.
 */
type ArtKey = 'wake-up' | 'companion' | 'walk' | 'progress' | 'rings';
const ART: Partial<Record<ArtKey, string>> = {
  'wake-up': '/brand/onboarding/wake-up.svg',
  companion: '/brand/onboarding/companion.svg',
  walk: '/brand/onboarding/walk.svg',
  progress: '/brand/onboarding/progress.svg',
  rings: '/brand/onboarding/rings.svg',
};
function Art({ k }: { k?: ArtKey }) {
  const src = k && ART[k];
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="onbwel-art" src={src} alt="" aria-hidden="true" />;
}

// PART 1 OF 4 · GETTING READY — Jay + Cowork's messaging pass (2026-08-13).
//
// WHAT CHANGED AND WHY, since two beats went away and their content did NOT:
//   · "You've already done the hard part" — its real payload was the safety line (no wrong answers, honesty pays).
//     That now lands in Part 2's ramp, immediately before the member actually starts talking, which is where it
//     does its work rather than four screens early.
//   · "You show up. We keep track." — the Dashboard is now defined in the glossary beat below, alongside the rest
//     of the vocabulary, instead of spending a whole screen on one noun.
// DONNA'S FIVE SCREENS, white ground (2026-08-27). Copy is Cowork's final spec, built verbatim so Donna does not
// have to touch it again — with two changes Jay ruled on before the build:
//
//   · SLIDE 4 drops "this week" from the ID Score example. The IDQ is retaken every 60 DAYS (frozen data
//     contract), so a score cannot move weekly. Same fault as the old "about 20 minutes" over a 65-minute
//     Reconnect: a number in the intro the product contradicts later, except this one is the headline metric and
//     it is on the screen selling it.
//   · SLIDE 5 keeps "you can stop between any of them" from the screen it replaces. That is the Independence
//     Guarantee at the moment it does the most work — a prospect deciding whether to begin a half-hour
//     conversation — and it was the one thing the new copy dropped.
//
// "Clip in →" is deliberately NOT the final CTA any more. The word was defined in the glossary beat these screens
// replace; keeping the button while losing its definition would put an unexplained term on the last thing a
// member taps.
const BEATS: Beat[] = [
  {
    art: 'companion',
    head: ['Your AI Companion', 'by your side.'],
    body: [
      'They’re always available, never judging, and remember everything you say — with the voice of a wise friend.',
    ],
    quotes: [
      'You lost your job, your dad got sick, and you don’t feel like yourself physically. That’s a lot.',
      '…no wonder I’ve been struggling.',
    ],
    cta: 'Next →',
  },
  {
    art: 'walk',
    head: ['Find your way back.', 'Walk your own pace.'],
    body: [
      'Rediscover who you were before life told you who you had to be. Backed by the science that actually changes behavior.',
    ],
    rs: ['Reconnect', 'Rewire', 'Rebuild', 'Reclaim'],
    tail: ['You’ll build Grinta — Italian for grit — along the way.'],
    cta: 'Next →',
  },
  {
    art: 'progress',
    head: ['Track your', 'progress.'],
    body: [
      'Your Companion helps you build a Reclaim List — setting goals for things worth getting back. Your ID Score shows exactly how far you’ve come.',
    ],
    // No timeframe. See the note above: the instrument moves every 60 days, not weekly.
    score: 'Your ID (Identity Distance) Score: 34 → 41',
    cta: 'Next →',
  },
  {
    art: 'rings',
    head: ['What you’ll', 'see next.'],
    body: [
      'Here’s what today looks like. Give it a good half hour with your Companion — a friendly first conversation and a quick program tour, so it can get to know you and you can find your way.',
      'You can stop between any of it — nothing’s lost. After today it opens out: a first cycle runs about six weeks, at whatever pace your life allows.',
    ],
    cta: 'Keep looking →',
  },
];

const renderBody = (segs: Seg[]) =>
  segs.map((s, i) => (typeof s === 'string' ? <span key={i}>{s}</span> : <strong key={i}>{s.b}</strong>));

// The navy billboard beats — shared by both platforms (they follow the hero on desktop and mobile alike).
function NavyBeats({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  // CLAMPED, because two clicks can land in the SAME React batch — an impatient double-tap, or a tap that
  // registers twice on a slow phone. `advance` closes over `last` from the render that drew the button, so both
  // clicks saw last === false, both incremented, and `i` ran off the end of BEATS. The next render then read a
  // property of undefined and blew up the very first screen a member ever sees. Found by driving it in a browser.
  const beat = BEATS[Math.min(i, BEATS.length - 1)]!;
  const last = i >= BEATS.length - 1;
  const advance = () => {
    if (last) { onDone(); return; }
    setI((n) => Math.min(n + 1, BEATS.length - 1));
  };

  return (
    <div className="onbwel">
      <div className="onbwel-wrap">
        <div className="onbwel-dots" aria-hidden="true">
          {BEATS.map((_, x) => (
            <span key={x} className={`onbwel-dot${x === i ? ' on' : ''}`} />
          ))}
        </div>
        <div className="onbwel-heart">
          <Art k={beat.art} />
          <h1 className="onbwel-head">
            {beat.head.map((line, x) => (
              <span key={x} className="onbwel-head-line">{line}</span>
            ))}
          </h1>
          {beat.body.map((seg, x) => (
            <p key={x} className="onbwel-body">{renderBody([seg])}</p>
          ))}
          {/* SLIDE 2 — the exchange. Rendered as two turns rather than one block quote so the second line reads as
              the MEMBER answering, which is the whole point of the example: what it feels like to be heard. */}
          {beat.quotes && (
            <div className="onbwel-quotes">
              {beat.quotes.map((q, x) => (
                <p key={x} className={`onbwel-quote${x === 1 ? ' is-member' : ''}`}>{q}</p>
              ))}
            </div>
          )}
          {/* SLIDE 3 — the four Rs on their own row. A comma list inside a sentence made them read as prose; they
              are the spine of the program and the only four words a member has to carry out of here. */}
          {beat.rs && (
            <div className="onbwel-rs">
              {beat.rs.map((r) => <span key={r} className="onbwel-r">{r}</span>)}
            </div>
          )}
          {/* SLIDE 4 — a worked example, set apart so it reads as a specimen rather than a promise. NO timeframe:
              the IDQ is retaken every 60 days, so "this week" (Donna's draft) would have been a cadence the
              instrument cannot deliver. */}
          {beat.score && <p className="onbwel-score">{beat.score}</p>}
          {beat.tail && <p className="onbwel-body">{renderBody(beat.tail)}</p>}
          <button type="button" className="onbwel-cta" onClick={advance}>{beat.cta}</button>
          {/* The forecast beat now states the 20 minutes itself, in context, so the old blanket reassurance under
              the final CTA would say it twice. */}
        </div>
      </div>
    </div>
  );
}

// The opening HERO — the landing-page photo billboard, continuous with grintaforlife.com. Shows on desktop AND mobile
// now; the photo (public/brand/onboarding-hero.jpg) sits behind a dark scrim so the copy stays legible at any width.
// SLIDE 1 — the front door, on white (Donna, 2026-08-27). Was navy-over-photo with "Your comeback starts here."
//
// Jay's ruling when the two collided: Donna's slide wins for this surface. The held 8/24 line ("By the time you hit
// midlife, something had to give") stays held with the rest of the on-ramp work.
//
// THE LOG-IN LINE SURVIVES THE REDESIGN and is not decoration. "/" lands here, so this is the door a RETURNING
// member arrives at too; a front door with no way through it for someone who already has an account is a bug that
// looks like a design.
function WelcomeHero({ onNext }: { onNext: () => void }) {
  return (
    <div className="onbwel-d-hero">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="onbwel-d-wordmark" src="/brand/g4l-wordmark.svg" alt="Grinta for Life" />
      <div className="onbwel-d-heart">
        <Art k="wake-up" />
        <h1 className="onbwel-d-head">This could be your<br />wake-up call.</h1>
        <p className="onbwel-d-sub">
          By the time we get to midlife, we’ve likely been sleepwalking through Doors for years — a career that
          changed, kids who needed everything, aging parents who suddenly needed us too — and we didn’t even notice
          as they closed behind us.
        </p>
        <p className="onbwel-d-sub onbwel-d-sub-lead">This is where you open your eyes.</p>
        <button type="button" className="onbwel-d-cta" onClick={onNext}>Start looking →</button>
        <p className="onbwel-d-signin">
          Already a member? <a href="/login">Log in</a>.
        </p>
      </div>
    </div>
  );
}

export default function OnboardingWelcome({ onBegin }: { onBegin: () => void }) {
  // Full-bleed intro (Jay 7/29): the welcome is a true one-screen image + message — drop the global header, footer, and
  // page padding while it shows, then restore them when it hands off to the sign-up gate.
  useEffect(() => {
    document.body.classList.add('onbwel-bleed');
    return () => document.body.classList.remove('onbwel-bleed');
  }, []);
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
