import { redirect } from 'next/navigation';
import { currentMemberId } from '../auth.ts';
import LoginForm from './login-form.tsx';

export const metadata = { title: 'Log in — Grinta for Life' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ out?: string }>;
}) {
  const id = await currentMemberId();
  if (id) redirect(`/dashboard/${id}`);
  const { out } = await searchParams;
  return (
    <>
      <h1>{out ? 'Signed out' : 'Welcome back'}</h1>
      <p className="muted">{out ? 'You’ve been signed out. Log back in to return to your dashboard.' : 'Log in to return to your dashboard.'}</p>
      <LoginForm />
    </>
  );
}
