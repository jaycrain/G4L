import { notFound, redirect } from 'next/navigation';
import { rebuildEnabled } from '../../lib/agent/rebuild.ts';
import { currentMemberId } from '../auth.ts';

// Felt-walk shortcut — resolves the logged-in member and drops straight into Rebuild B2 (Strengths & Weaknesses).
// Flag-gated (REBUILD); if signed out, sends to /login. Convenience only; the real entry is the dashboard.
export default async function Page() {
  if (!rebuildEnabled()) notFound();
  const memberId = await currentMemberId();
  if (!memberId) redirect('/login');
  redirect(`/rebuild/${memberId}/b2`);
}
