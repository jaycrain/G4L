import { redirect } from 'next/navigation';
import { currentMemberId } from '../auth.ts';
import LoginForm from './login-form.tsx';

export const metadata = { title: 'Log in — Grinta for Life' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ out?: string; exists?: string }>;
}) {
  const id = await currentMemberId();
  if (id) redirect(`/dashboard/${id}`);
  const { out, exists } = await searchParams;
  // `exists`: routed here from onboarding when the email is already registered — a returner, not a dead end. Greet it
  // as "you already have an account" so the redirect reads as intentional, not a bounce.
  const heading = exists ? 'You already have an account' : out ? 'Signed out' : 'Welcome back';
  const message = exists
    ? 'That email is already registered — log in to pick up right where you left off.'
    : out
      ? 'You’ve been signed out. Log back in to return to your dashboard.'
      : 'Log in to return to your dashboard.';
  // Photo-hero treatment (Jay 2026-07-26, the deck rework): the returning-member login now shares the new-user hero
  // photo + dark scrim, headline "WELCOME BACK", with the form in a white card floating on top.
  return (
    <div className="auth-hero">
      <div className="auth-hero-heart">
        <h1 className="auth-hero-h">{heading}</h1>
        <p className="auth-hero-sub">{message}</p>
        <div className="auth-card">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
