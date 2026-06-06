'use client';

import { useActionState } from 'react';
import { DOORS } from '../../lib/doors.ts';
import { AI_DISCLOSURE } from '../../lib/agent/governance.ts';
import { onboardingAction, type OnboardingState } from './actions.ts';

export default function Onboarding() {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(onboardingAction, null);

  return (
    <>
      <h1>Let&apos;s start with you</h1>
      <p className="disclosure">{AI_DISCLOSURE}</p>

      {state?.crisis && (
        <div className="crisis" role="alert">
          {state.crisis}
        </div>
      )}
      {state?.errors && (
        <ul className="error">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <form action={action}>
        <label htmlFor="displayName">Your name</label>
        <input id="displayName" name="displayName" type="text" required />

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />

        <label htmlFor="athleticPast">Before — what kind of athlete or active person were you?</label>
        <textarea id="athleticPast" name="athleticPast" required />

        <label htmlFor="door">Which door opened?</label>
        <select id="door" name="door" defaultValue="" required>
          <option value="" disabled>
            Choose the one that fits…
          </option>
          {DOORS.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.displayName} — {d.descriptor}
            </option>
          ))}
        </select>

        <label htmlFor="gap">The gap — what happened?</label>
        <textarea id="gap" name="gap" required />

        <label htmlFor="rightNow">Right now — where are you this week, without polish?</label>
        <textarea id="rightNow" name="rightNow" required />

        <label htmlFor="identityNoun">In one word: who do you want to be again?</label>
        <input id="identityNoun" name="identityNoun" type="text" placeholder="e.g. ATHLETE" required />

        <label>Your Reclaim List — seven things you want back</label>
        {Array.from({ length: 7 }, (_, i) => (
          <input key={i} name={`reclaim_${i}`} type="text" required placeholder={`${i + 1}.`} />
        ))}

        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Continue to the IDQ'}
        </button>
      </form>
    </>
  );
}
