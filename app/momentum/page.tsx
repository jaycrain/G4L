import { notFound, redirect } from 'next/navigation';
import { rewireEnabled } from '../../lib/agent/rewire.ts';
import { currentMemberId } from '../auth.ts';

// Felt-walk shortcut — no member id needed. Resolves the logged-in member and opens their Momentum quick-log.
// Flag-gated (REWIRE); if signed out, sends to /login. Convenience only; the real entry is the dashboard foot link.
export default async function Page() {
  if (!rewireEnabled()) notFound();
  const memberId = await currentMemberId();
  if (!memberId) redirect('/login');
  redirect(`/momentum/${memberId}`);
}
