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
  return (
    <>
      <h1>{heading}</h1>
      <p className="muted">{message}</p>
      <LoginForm />
    </>
  );
}
