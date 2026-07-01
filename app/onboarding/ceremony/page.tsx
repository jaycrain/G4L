import OnboardingCeremony from '../ceremony.tsx';

// Standalone route for the onboarding ceremony (§2d/§2e). Increment 6 wires it into the post-commit arc with
// the real member's data; for now it reads ?name= / ?member= so the screen is reviewable on its own.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; member?: string }>;
}) {
  const sp = await searchParams;
  return <OnboardingCeremony firstName={sp.name || 'friend'} memberId={sp.member} />;
}
