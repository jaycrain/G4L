import { assertDevOnly } from '../guard.ts';
import { DOORS } from '../../../lib/doors.ts';
import { BOARD_ORDER, BOARD_HEADER, QUIET_DRIFT_CARD, doorRecognition } from '../../../lib/content/doors-board.ts';
import BoardPreview from './board-preview.tsx';

export const metadata = { title: 'Dev — the Doors board' };

// LOCAL-ONLY preview of the R2 Doors board (see ../guard.ts — 404s on any production build).
//
// The board is not wired into the arc yet, and this exists so the interaction can be judged BEFORE it is — which
// is the cheapest moment to be told it is wrong. It renders the REAL component with the REAL copy, not a mockup:
// a mockup would prove the design I imagined rather than the one I built.
//
// Pre-lit here with Donna's actual Doors so it shows what a returning member sees, not an empty grid.
export default async function DevDoorsBoardPage() {
  assertDevOnly();
  const name = new Map(DOORS.map((d) => [d.slug, d.displayName]));
  const cards = BOARD_ORDER.map((slug) => ({
    slug,
    name: name.get(slug) ?? slug,
    recognition: doorRecognition(slug)?.recognition ?? '',
  }));

  return (
    <main className="reconnect-page" style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1rem' }}>
      <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 0.25rem' }}>Dev preview · not wired into R2</p>
      <h2 style={{ marginTop: 0 }}>The Doors</h2>
      <BoardPreview
        expects={{
          kind: 'doors_board',
          cards,
          held: ['career_cliff', 'load_bearer', 'aging_parents'],
          quietDrift: { key: QUIET_DRIFT_CARD.key, name: QUIET_DRIFT_CARD.displayName, recognition: QUIET_DRIFT_CARD.recognition },
          header: BOARD_HEADER,
        }}
      />
    </main>
  );
}
