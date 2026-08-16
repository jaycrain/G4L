// PARKED — the Cycle 2 retake surface. NOT dead code, NOT v1 debris. (Jay, 2026-08-16.)
//
// The IDQ moved into Reconnect, which now administers the 24 items conversationally and writes the BASELINE
// (sequence_no = 0, "fires exactly once"). What did NOT move is the other job this page did: the RETAKE.
//
// So this route is unlinked — its only entry point was the v1 branch of
//   stagedEngineEnabled() ? `/dashboard/${id}` : `/idq?member=${id}`   (app/onboarding/actions.ts)
// and prod runs staged. Nothing reaches it. But it is not broken: it authorizes the member, runs the
// conversation, and submitIdq would write the next sequence_no. It is the only working implementation of the
// retake we have.
//
// IT IS KEPT ON PURPOSE, because the product already PROMISES the retake: the dashboard renders "Your next
// scheduled IDQ is <date>" from max(taken_at) + 60 days, with no way to take it. The earliest of those dates is
// 2026-09-08. Cycle 2 will decide what the retake actually is — plausibly re-entering Reconnect rather than a
// standalone page — and will retrofit member timing then.
//
// IF YOU ARE HERE TO DELETE THIS: read docs/ first and check with Jay. I nearly deleted it on 2026-08-16 for
// looking abandoned, which is exactly why this comment exists. Its crisis escalation is declared PARKED in
// tests/crisis-escalation.test.ts, and that declaration is verified against the LIVE path — so removing this
// file means updating that guard too, deliberately.
import { redirect } from 'next/navigation';
import { authorizeMember } from '../authz.ts';
import IdqChat from './idq-chat.tsx';

export default async function IdqPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const { member } = await searchParams;
  if (!member) {
    return <p className="error">No member in context. Start at the beginning.</p>;
  }
  if (!(await authorizeMember(member))) redirect('/login');
  return <IdqChat memberId={member} />;
}
