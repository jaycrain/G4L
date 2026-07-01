'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// §2d + §2e — the ONBOARDING ceremony (LIGHT) → Route Card → skippable tour → sign-off bridge. Distinct from
// the Reconnect Threshold Ceremony (v2.2 — the earned ID-Score/Playbook reveal). Rightsized to what a
// conversation earns: a warm, real handoff — NOT a false summit. Personalized to what the member just gave, so
// it lands instead of reading generic. DIRECTIONAL copy (Jay reacts on the walk). Wired in Increment 6.

const RS = ['Reconnect', 'Rewire', 'Rebuild', 'Reclaim'] as const;

export default function OnboardingCeremony({
  firstName,
  identityLabel,
  reclaimList = [],
  doorLabel,
  memberId,
}: {
  firstName: string;
  identityLabel?: string | null; // "the Player" — the reclaimed identity, if they named one
  reclaimList?: string[];
  doorLabel?: string | null; // the primary Door's branded name, if one was recognized
  memberId?: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<'threshold' | 'tour' | 'signoff'>('threshold');
  const [step, setStep] = useState(0);

  const who = identityLabel ? identityLabel : 'the person you’re reclaiming';
  const reclaimN = reclaimList.length;
  const reclaimPreview = reclaimList.slice(0, 3).join(', ');

  // The tour walks the member's REAL dashboard, in their own terms — not generic stops.
  const TOUR: { label: string; line: string }[] = [
    {
      label: 'Your path',
      line: `Your next step is already lit: Reconnect. It picks up right where we left off — from ${who} — and goes deeper.`,
    },
    { label: 'Your Daily Beat', line: 'The heartbeat between sessions — one small rep to keep your momentum warm.' },
    {
      label: 'Your ID Score',
      line: 'Blank for now — it fills the moment you start Reconnect, and it’s where you’ll watch the distance close.',
    },
    {
      label: 'Your Reclaim List',
      line: reclaimN
        ? `What you’re bringing back — the ${reclaimN} you named${reclaimPreview ? ` (${reclaimPreview}${reclaimN > 3 ? '…' : ''})` : ''}, waiting for you and yours to add to any time.`
        : 'What you’re bringing back — the things you want in your life again, yours to add to any time.',
    },
  ];

  function goDashboard() {
    router.push(memberId ? `/dashboard/${memberId}` : '/dashboard');
  }

  if (phase === 'threshold') {
    return (
      <div className="onboard-ceremony">
        <h1>That’s your threshold crossed, {firstName}.</h1>
        <p>
          Most people never sit down and do that kind of honest looking — you just named {who}
          {doorLabel ? `, and the door the distance came through (${doorLabel})` : ''}, and what you want back. That
          took something real.
        </p>
        <p className="muted">Before you go further, here’s the whole route — and yes, the circle comes back around.</p>
        {/* Route Card (Greg's concept): the 4Rs loop, Reconnect lit as where you go next. */}
        <div className="route-card" role="img" aria-label="The 4Rs — Reconnect, Rewire, Rebuild, Reclaim, and back around">
          {RS.map((r, i) => (
            <span key={r} className="route-step">
              <span className={`route-r${i === 0 ? ' route-now' : ''}`}>{r}</span>
              {i < RS.length - 1 && <span className="route-arrow" aria-hidden="true">→</span>}
            </span>
          ))}
          <span className="route-loop">↩ and it comes back around — the Loop</span>
        </div>
        <div className="chat-continue">
          <button type="button" onClick={() => setPhase('tour')}>Show me around →</button>
          <button type="button" className="btn-secondary" onClick={() => setPhase('signoff')} style={{ marginTop: '0.5rem' }}>
            Skip the tour
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'tour') {
    const s = TOUR[step]!;
    const last = step === TOUR.length - 1;
    return (
      <div className="onboard-ceremony">
        <p className="tour-progress muted">{step + 1} of {TOUR.length}</p>
        <h2>{s.label}</h2>
        <p>{s.line}</p>
        <div className="chat-continue">
          <button type="button" onClick={() => (last ? setPhase('signoff') : setStep((n) => n + 1))}>
            {last ? 'Got it →' : 'Next →'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setPhase('signoff')} style={{ marginTop: '0.5rem' }}>
            Skip the rest
          </button>
        </div>
      </div>
    );
  }

  // §2e sign-off bridge
  return (
    <div className="onboard-ceremony">
      <h1>This is where it starts for real.</h1>
      <p>
        When you’re ready, your first Reconnect session picks up right where we left off and goes deeper — to the
        heart of the thing. That’s where a bigger moment waits, one you’ll have earned.
      </p>
      <p>
        And I’ll be right here — look for <strong>Talk to me</strong> on your dashboard. I remember everything we
        said, you can ask me anything, and you can change or edit anything here whenever you want. Nothing’s locked,
        and there’s no clock.
      </p>
      <div className="chat-continue">
        <button type="button" onClick={goDashboard}>Go to my dashboard →</button>
      </div>
    </div>
  );
}
