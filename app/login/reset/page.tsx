import Link from 'next/link';
import ResetForm from './reset-form.tsx';

export const metadata = { title: 'Choose a new password — Grinta for Life' };

// The token stays in the URL and is redeemed by the action on submit — we deliberately do NOT validate it on
// render. A GET that consumed the token would be spent by any mail scanner or link preview that fetched the
// link before the member ever clicked it.
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="auth-hero">
      <div className="auth-hero-heart">
        <h1 className="auth-hero-h">Choose a new password</h1>
        <div className="auth-card">
          {token ? (
            <ResetForm token={token} />
          ) : (
            <p>
              That link is missing its code. <Link href="/login/forgot">Ask for a new one</Link>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
