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
  kick: string;
  head: string[];
  body: Seg[];
  list?: { term?: string; text: string }[];
  ordered?: boolean;
  tail?: Seg[]; // copy that sits AFTER the list (the forecast's "this first sitting is the biggest one")
  cta: string;
};

// PART 1 OF 4 · GETTING READY — Jay + Cowork's messaging pass (2026-08-13).
//
// WHAT CHANGED AND WHY, since two beats went away and their content did NOT:
//   · "You've already done the hard part" — its real payload was the safety line (no wrong answers, honesty pays).
//     That now lands in Part 2's ramp, immediately before the member actually starts talking, which is where it
//     does its work rather than four screens early.
//   · "You show up. We keep track." — the Dashboard is now defined in the glossary beat below, alongside the rest
//     of the vocabulary, instead of spending a whole screen on one noun.
const BEATS: Beat[] = [
  {
    kick: 'Part 1 of 4 · Getting ready',
    head: ['Meet your', 'Companion'],
    body: [
      'There’s probably no one else in your life like this. Always listening, always here, holding everything you share. It might catch what you’ve stopped seeing in yourself.',
      ' Ask anything, anytime.',
    ],
    cta: 'Next →',
  },
  {
    kick: 'Part 1 of 4 · Getting ready',
    head: ['Four phases.', 'Your pace.'],
    body: ['The G4L Program and your Comeback runs in four phases:'],
    list: [
      { term: 'Reconnect', text: 'start looking at who you are.' },
      { term: 'Rewire', text: 'get your head right.' },
      { term: 'Rebuild', text: 'get your body back.' },
      { term: 'Reclaim', text: 'step all the way in.' },
    ],
    tail: [
      'You move through them one at a time, as fast or slow as your life allows. ',
      { b: 'Grinta' },
      ' is Italian for grit — it’s what you build along the way.',
    ],
    cta: 'Next →',
  },
  {
    kick: 'Part 1 of 4 · Getting ready',
    head: ['A few words', 'you’ll hear.'],
    body: ['New places have their own language. Here’s ours, plainly — you’ll see all of it in action soon.'],
    list: [
      { term: 'Your Companion', text: 'always there, remembers everything, helps you see what you can’t always see alone.' },
      { term: 'Your Comeback', text: 'closing the distance back to who you are.' },
      { term: 'The Program', text: 'your way back: four phases, your pace.' },
      { term: 'Your Dashboard', text: 'home base, where everything you do is kept.' },
      { term: 'Your Playbook', text: 'what you build; how you watch yourself change.' },
      { term: 'ID Score & Grinta Index', text: 'two ways to see it: how far you’ve got to go, and the grit you’re growing.' },
      // CLIP IN IS DEFINED HERE AND NOWHERE ELSE (Cowork + Jay, 2026-08-14). The word is core vocabulary — the
      // daily clip-in, the clip-back-in move, the Grinta lines, the closer — so it stays. What was wrong was
      // EXPLAINING it mid-experience, in the Threshold ceremony, at the moment the member should be stepping
      // through. Define it once, upstream, where they are still learning the language; downstream just uses it.
      //
      // Deliberately shorter than the brief's draft. Cowork's own item (e) rules that the full origin story —
      // the both-strokes payoff, the fall, the untangling — lives in MARKETING, not the app, but the draft copy
      // then told that story in full. Kept: the source of the metaphor, the commitment, and the clip-BACK-in,
      // which downstream copy (the False Start Protocol) depends on the member already understanding.
      { term: 'Clip in', text: 'cyclists lock their shoes to the pedals when they mean it — committed, in for the long ride. Everyone falls at least once; you clip back in and keep going.' },
    ],
    cta: 'Next →',
  },
  // THE PACT — KEPT DELIBERATELY through the 2026-08-13 messaging pass, which had no equivalent screen.
  //
  // It is the one place we name the endpoint before any work starts (2026-08-10 reframe): the product already
  // manufactures a Playbook, it just never told the member that was the point, so G4L read as a bin of parts
  // rather than one arc. Dropping it also strands the Opening Tour's Playbook stop, which opens "the thing we
  // said we'd build together" — a line that only parses if this promise was made.
  //
  // Positioning here is DRAFT, not canon (Jay, 2026-08-13): #134 is still open, so the wording may move.
  {
    kick: 'Part 1 of 4 · Getting ready',
    head: ['You’ll build a Playbook.', 'It’s yours to keep.'],
    body: [
      'Everything you do here goes into it — the moves that actually work for you, and what you learn about yourself along the way. Your ',
      { b: 'Playbook' },
      ' isn’t ours to hand you. It’s already in you, and we help you draw it out. You’ll use it again and again.',
    ],
    cta: 'Next →',
  },
  {
    kick: 'Part 1 of 4 · Getting ready',
    head: ['Here’s how', 'today goes.'],
    body: ['Four short parts, and you can stop between any of them — nothing’s lost.'],
    ordered: true,
    list: [
      { term: 'Getting ready', text: 'you’re in it.' },
      { term: 'Getting to know you', text: 'a conversation with your Companion. About 20 minutes.' },
      { term: 'What you found', text: 'see what surfaced.' },
      { term: 'A look around', text: 'a quick tour to show you where it all lives.' },
    ],
    // NO DAILY-TIME FORECAST, ANYWHERE. The old close promised "after today, it's a few minutes a day" — which is
    // false (Sessions run 20-30 minutes) and contradicts the upstream "as fast or slow as your life allows". Item 2
    // in the list above already sizes today honestly, so nothing here needs to forecast tomorrow.
    tail: ['This one goes deep, so give yourself the time. Reclaiming who you are takes real time — it starts here.'],
    // "Clip in →" rather than "Let's go →": the language screen defined the word a moment ago, and this is the
    // button where they do it. The word is never explained again after this.
    cta: 'Clip in →',
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
        <div className={`onbwel-heart${beat.list ? ' onbwel-heart-list' : ''}`}>
          {beat.kick && <div className="onbwel-kick">{beat.kick}</div>}
          <h1 className="onbwel-head">
            {beat.head.map((line, x) => (
              <span key={x} className="onbwel-head-line">{line}</span>
            ))}
          </h1>
          <p className="onbwel-body">{renderBody(beat.body)}</p>
          {beat.list &&
            (beat.ordered ? (
              <ol className="onbwel-list onbwel-list-num">
                {beat.list.map((it, x) => (
                  <li key={x}>{it.term && <strong>{it.term}</strong>}{it.term ? ' — ' : ''}{it.text}</li>
                ))}
              </ol>
            ) : (
              <ul className="onbwel-list">
                {beat.list.map((it, x) => (
                  <li key={x}>{it.term && <strong>{it.term}</strong>}{it.term ? ' — ' : ''}{it.text}</li>
                ))}
              </ul>
            ))}
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
function WelcomeHero({ onNext }: { onNext: () => void }) {
  return (
    <div className="onbwel-d-hero">
      {/* Logo sits tonally ON the image (Jay 7/29 — no header bar; the wordmark does the branding). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="onbwel-d-wordmark" src="/brand/g4l-wordmark.svg" alt="Grinta for Life" />
      <div className="onbwel-d-heart">
        <h1 className="onbwel-d-head">Your comeback<br />starts here.</h1>
        <p className="onbwel-d-sub">
          You didn’t lose yourself — who you are got crowded out by a hundred reasonable trade-offs. A career that
          changed, a marriage that drifted, years of carrying everyone. That’s the Fade. And you’re still in there.
        </p>
        <p className="onbwel-d-sub">
          <strong>Grinta for Life</strong> is how you start looking again: a real conversation with your AI
          Companion, then a program that closes the distance back to yourself.
        </p>
        <button type="button" className="onbwel-d-cta" onClick={onNext}>Start looking →</button>
        {/* "/" now lands here, so this hero is the FRONT DOOR — a returning member must have a way through it. */}
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
