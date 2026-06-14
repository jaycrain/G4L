import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authorizeMember } from '../../authz.ts';

// "More about the Journey" — intentionally a blank canvas for now; Jay will add to it.
export default async function JourneyMorePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');

  return (
    <>
      <div className="crumb">
        <Link href={`/dashboard/${memberId}`} className="back-link">← Dashboard</Link>
      </div>
      <div className="hero"><h1>More about the Journey</h1></div>
      <div className="card">
        <p className="muted">More detail about your Journey will live here.</p>
      </div>
    </>
  );
}
