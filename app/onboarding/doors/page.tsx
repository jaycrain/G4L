import { redirect } from 'next/navigation';
import { authorizeMember } from '../../authz.ts';
import DoorsChat from './doors-chat.tsx';

// Live Door-beat turns call Claude; give the function time to finish a slow turn.
export const maxDuration = 30;

export default async function DoorsPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const { member } = await searchParams;
  if (!member) {
    return <p className="error">No member in context. Start from your dashboard.</p>;
  }
  if (!(await authorizeMember(member))) redirect('/login');
  return <DoorsChat memberId={member} />;
}
