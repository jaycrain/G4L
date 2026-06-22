import Link from 'next/link';

// The distilled identity line as its own panel (Dashboard Reshuffle §2) — one line (the selves they're
// reclaiming) + the standard sub-page-nav link to the full narrative. This is the identity READ (who you
// are), distinct from the Playbook's arc (where you've been → where you're going); they link to the same
// stored paragraph but never read as two copies. "Your full story →" uses the standard panel→sub-page
// link pattern (the same .see-more treatment as Score / Program / Journey).
export default function IdentityStrip({ line, memberId, hasStory }: { line: string; memberId: string; hasStory: boolean }) {
  return (
    <div className="card identity-strip">
      <p className="idline">{line}</p>
      {hasStory && (
        <Link href={`/story/${memberId}`} className="see-more" prefetch={false}>Your full story →</Link>
      )}
    </div>
  );
}
