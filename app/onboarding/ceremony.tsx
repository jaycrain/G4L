'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// §2d + §2e — the ONBOARDING ceremony (light) → Route Card → skippable tour → sign-off bridge. Distinct from
// the Reconnect Threshold Ceremony (v2.2, the earned ID-Score/Playbook reveal): this one is rightsized to what
// a conversation earns — a warm handoff, not a false summit. DIRECTIONAL copy (Jay's pass applied). Wired into
// the post-commit arc in Increment 6 (routing); built + previewable here.

const RS = ['Reconnect', 'Rewire', 'Rebuild', 'Reclaim'] as const;

type TourStop = { label: string; line: string };
const TOUR_STOPS: TourStop[] = [
  { label: 'Your path', line: 'Your next step’s already lit: Reconnect. That’s where we pick up and go deeper.' },
  { label: 'Your Daily Beat', line: 'The heartbeat between sessions — a small rep to keep momentum.' },
  { label: 'Your ID Score', line: 'Blank for now — it fills the moment you start, and it’s where you’ll watch the distance close.' },
  { label: 'Your Reclaim List', line: 'What you’re bringing back — the things you told me you want in your life again.' },
];

export default function OnboardingCeremony({
  firstName,
  memberId,
}: {
  firstName: string;
  memberId?: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<'threshold' | 'tour' | 'signoff'>('threshold');
  const [step, setStep] = useState(0);

  function goDashboard() {
    router.push(memberId ? `/dashboard/${memberId}` : '/dashboard');
  }

  if (phase === 'threshold') {
    return (
      <div className="onboard-ceremony">
        <h1>That’s your threshold crossed, {firstName}.</h1>
        <p>Most people never sit down and do that kind of honest looking — you just did.</p>
        {/* Route Card (Greg's concept) — the whole route before the ride, and that the circle comes back around. */}
        <div className="route-card" role="img" aria-label="The 4Rs — Reconnect, Rewire, Rebuild, Reclaim, and back around">
          {RS.map((r, i) => (
            <span key={r} className="route-step">
              <span className="route-r">{r}</span>
              {i < RS.length - 1 && <span className="route-arrow" aria-hidden="true">→</span>}
            </span>
          ))}
          <span className="route-loop">↩ the loop comes back around</span>
        </div>
        <p className="muted">Before you go further, here’s the whole route.</p>
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
    const s = TOUR_STOPS[step]!;
    const last = step === TOUR_STOPS.length - 1;
    return (
      <div className="onboard-ceremony">
        <p className="tour-progress muted">{step + 1} of {TOUR_STOPS.length}</p>
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
      <p>When you’re ready, your first session picks up right where we left off and goes deeper — to the heart of the thing.</p>
      <p>I’ll be right here — look for <strong>Talk to me</strong>. I remember everything, and you can change anything here whenever you want. No clock.</p>
      <div className="chat-continue">
        <button type="button" onClick={goDashboard}>Go to my dashboard →</button>
      </div>
    </div>
  );
}
