import OnboardingChat from './chat.tsx';

export const metadata = { title: 'Getting to Know You — Grinta for Life' };
// Live onboarding turns call Claude with growing context; allow the serverless function enough
// time so a slow turn completes rather than timing out into a failed turn.
export const maxDuration = 30;

export default function Onboarding() {
  return <OnboardingChat />;
}
