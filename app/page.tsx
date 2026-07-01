import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentMemberId } from './auth.ts';

export default async function Home() {
  const id = await currentMemberId();
  if (id) redirect(`/dashboard/${id}`);

  return (
    <>
      <h1>Grinta for Life</h1>
      {/* Number-free + no front-loaded jargon (Donna's rule): terms are introduced at first use inside the
          conversation, not here — and v2.1 onboarding has no scores yet. DIRECTIONAL copy for wordsmithing. */}
      <p className="muted">
        Somewhere along the way, the person you know you are gets quiet — worn down by life, by
        everyone else&apos;s needs, by a hundred reasonable decisions. This is where you start turning
        that around: a real conversation, and a companion built for this one thing.
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
