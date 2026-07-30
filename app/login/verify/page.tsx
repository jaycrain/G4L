import Link from 'next/link';
import VerifyClient from './verify-client.tsx';

export const metadata = { title: 'Confirm your email — Grinta for Life' };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="auth-hero">
      <div className="auth-hero-heart">
        <h1 className="auth-hero-h">Confirm your email</h1>
        <div className="auth-card">
          {token ? (
            <VerifyClient token={token} />
          ) : (
            <p>
              That link is missing its code. <Link href="/login">Log in</Link> and carry on — nothing is blocked.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
