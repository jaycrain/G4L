import { redirect } from 'next/navigation';
import { currentMemberId } from '../auth.ts';
import LoginForm from './login-form.tsx';

export const metadata = { title: 'Log in — Grinta for Life' };

export default async function LoginPage() {
  const id = await currentMemberId();
  if (id) redirect(`/dashboard/${id}`);
  return (
    <>
      <h1>Welcome back</h1>
      <p className="muted">Log in to return to your dashboard.</p>
      <LoginForm />
    </>
  );
}
