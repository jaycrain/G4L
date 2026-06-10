import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentMemberId } from './auth.ts';

export default async function Home() {
  const id = await currentMemberId();
  if (id) redirect(`/dashboard/${id}`);

  return (
    <>
      <h1>Grinta for Life</h1>
      <p className="muted">
        Somewhere along the way, who you know you are gets diminished by life and others&apos;
        needs. The Gateway is where we start: a short conversation, the Identity Distance
        Questionnaire (IDQ), and your first ID Score — so reclaiming your identity isn&apos;t abstract.
      </p>
      <p>
        <Link className="btn" href="/onboarding">
          Begin
        </Link>
      </p>
      <p className="muted">
        Already started? <Link href="/login">Log in</Link>.
      </p>
    </>
  );
}
