import { notFound, redirect } from 'next/navigation';
import { rewireEnabled } from '../../lib/agent/rewire.ts';
import { currentMemberId } from '../auth.ts';

// Felt-walk shortcut — no member id needed. Resolves the logged-in member and opens the Rewire R4 Checkpoint.
// Flag-gated (REWIRE); if signed out, sends to /login. Convenience only.
export default async function Page() {
  if (!rewireEnabled()) notFound();
  const memberId = await currentMemberId();
  if (!memberId) redirect('/login');
  redirect(`/rewire/${memberId}/checkpoint`);
}
