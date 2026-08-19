import { assertDevOnly } from '../guard.ts';
import KeeperOffer from '../../components/keeper-offer.tsx';

export const metadata = { title: 'Dev — the keeper offer' };

// LOCAL-ONLY preview (see ../guard.ts — 404s on any production build). Seeded with DONNA'S ACTUAL BAD KEEPER,
// because the question this surface has to answer is whether she would look at that text and decline it.
export default async function DevKeeperOfferPage() {
  assertDevOnly();
  return (
    <main className="onboard-page" style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1rem' }}>
      <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 0.25rem' }}>Dev preview · the real component</p>
      <h2 style={{ marginTop: 0 }}>The keeper offer</h2>
      <div className="bubble agent" style={{ margin: '0 0 0.5rem' }}>
        <p style={{ margin: 0 }}>That&rsquo;s the picture, then — the one you&rsquo;d come back to.</p>
      </div>
      <KeeperOffer
        memberId="00000000-0000-0000-0000-000000000000"
        proposal={{ momentId: 'dev-1', keeperType: 'lights_you_up', label: 'Your picture', ref: 'w2', body: 'Can you remind me what is on my Reclaim List?' }}
      />
      <KeeperOffer
        memberId="00000000-0000-0000-0000-000000000000"
        proposal={{ momentId: 'dev-2', keeperType: 'principle', label: 'Your true line', ref: 'w1', body: 'I need to put myself first to be good for anyone else.' }}
      />
    </main>
  );
}
