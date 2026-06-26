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
        Hi. We&apos;re glad you found G4L. We expect you came here because, like the people who built
        this, you&apos;re a midlifer who&apos;s lost a dimension of your identity. Somewhere along the way,
        who you know you are has Faded — diminished by life and others&apos; needs — and you&apos;re
        curious how to find that person again. Maybe even improve the whole rest of your life. It
        starts here, with a short but honest conversation.
      </p>
      <p>
        <Link className="btn" href="/onboarding">
          Begin
        </Link>
      </p>
      <p className="muted">
        Already started? <Link href="/login">Create an account</Link>.
      </p>
    </>
  );
}
