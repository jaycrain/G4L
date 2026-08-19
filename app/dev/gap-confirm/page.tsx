import { assertDevOnly } from '../guard.ts';
import { DOORS } from '../../../lib/doors.ts';
import { GAP_CONFIRM_CHOICES } from '../../../lib/agent/gap-confirm-choice.ts';
import GapConfirmPreview from './preview.tsx';

export const metadata = { title: 'Dev — the gap confirm' };

// LOCAL-ONLY preview of the gap-confirm chips + the Doors line (see ../guard.ts — 404s on any production build).
//
// Seeded with JENNIFER'S case, because it is the one this surface exists for: she was tagged with The Marriage
// from her FATHER'S divorce, in a story where she had said her own marriage was fine. The question to judge here
// is whether taking that off looks available WITHOUT the line turning into a second task standing between her and
// answering the question the Companion actually asked.
const JENNIFER_DOORS = ['marriage', 'aging_parents', 'career_cliff'] as const;

export default async function DevGapConfirmPage() {
  assertDevOnly();
  const name = new Map(DOORS.map((d) => [d.slug, d.displayName]));

  return (
    <main className="onboard-page" style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1rem' }}>
      <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 0.25rem' }}>Dev preview · the real component</p>
      <h2 style={{ marginTop: 0 }}>The gap confirm</h2>
      <div className="bubble agent" style={{ margin: '0 0 1rem' }}>
        <p style={{ margin: 0 }}>
          So it was your father’s illness, then the years of driving up there every weekend, and the promotion you
          stopped putting your hand up for.
        </p>
        <p style={{ margin: '0.6rem 0 0' }}>Does that land the way it happened — or is there more?</p>
      </div>
      <GapConfirmPreview
        expects={{
          kind: 'gap_confirm',
          choices: GAP_CONFIRM_CHOICES.map((c) => ({ value: c.value, label: c.label })),
          doorsHeard: JENNIFER_DOORS.map((slug) => ({ slug, name: name.get(slug) ?? slug })),
        }}
      />
    </main>
  );
}
