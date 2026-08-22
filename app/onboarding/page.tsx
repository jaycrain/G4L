import OnboardingChat from './chat.tsx';
import { onboardingWelcomeEnabled } from '../../lib/dashboard/redesign.ts';

// Sentence case, matching the heading inside (Donna, 2026-08-21). Fixing only the h1 left the browser TAB saying
// "Getting to Know You" over a page that says "Getting to know you." — the same mismatch she reported, one level up.
export const metadata = { title: 'Getting to know you — Grinta for Life' };
// Live onboarding turns call Claude with growing context; allow the serverless function enough
// time so a slow turn completes rather than timing out into a failed turn.
export const maxDuration = 60;

// The flag is read SERVER-side here (non-NEXT_PUBLIC env vars aren't available in the client bundle) and passed down.
export default function Onboarding() {
  return <OnboardingChat welcomeEnabled={onboardingWelcomeEnabled()} />;
}
