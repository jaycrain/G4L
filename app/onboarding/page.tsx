import OnboardingChat from './chat.tsx';
import { onboardingWelcomeEnabled } from '../../lib/dashboard/redesign.ts';

export const metadata = { title: 'Getting to Know You — Grinta for Life' };
// Live onboarding turns call Claude with growing context; allow the serverless function enough
// time so a slow turn completes rather than timing out into a failed turn.
export const maxDuration = 30;

// The flag is read SERVER-side here (non-NEXT_PUBLIC env vars aren't available in the client bundle) and passed down.
export default function Onboarding() {
  return <OnboardingChat welcomeEnabled={onboardingWelcomeEnabled()} />;
}
