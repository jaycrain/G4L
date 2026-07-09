import { notFound, redirect } from 'next/navigation';
import { reclaimEnabled } from '../../lib/agent/reclaim.ts';
import { currentMemberId } from '../auth.ts';

// Felt-walk shortcut — resolves the logged-in member and drops straight into Reclaim C3 (Quality Days). Flag-gated
// (RECLAIM); if signed out, sends to /login. Convenience only; the real entry is the dashboard.
export default async function Page() {
  if (!reclaimEnabled()) notFound();
  const memberId = await currentMemberId();
  if (!memberId) redirect('/login');
  redirect(`/reclaim/${memberId}/c3`);
}
