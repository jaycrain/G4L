import Link from 'next/link';

export default function Home() {
  return (
    <>
      <h1>Grinta for Life</h1>
      <p className="muted">
        Somewhere along the way, who you know you are gets diminished by life and others&apos;
        needs. The Gateway is where we start: a short conversation, the IDQ, and your first
        ID Score — so reclaiming your identity isn&apos;t abstract.
      </p>
      <Link className="btn" href="/onboarding">
        Begin
      </Link>
    </>
  );
}
