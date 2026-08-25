import { assertDevOnly } from '../guard.ts';
import { BEAT_CONFIRM_CHOICES } from '../../../lib/agent/beat-confirm.ts';

export const metadata = { title: 'Dev — the beat confirm' };

// LOCAL-ONLY preview of the drawout confirm chips (see ../guard.ts — 404s on any production build).
//
// Seeded with JAY'S CASE, because it is the one this surface exists for. On 2026-08-25 he was asked "Does that
// Tuesday feel like the one worth chasing — or is there more to it?", answered "Absolutely", and the next turn
// ended "Is that the one worth chasing — or not quite it yet?" — the engine stapling its own confirm onto a model
// turn that had already closed the beat.
//
// What to judge here: the model's close reads as FINISHED, and the ruling is available without a question being
// put in the Companion's mouth.
export default async function DevBeatConfirmPage() {
  assertDevOnly();
  return (
    <main className="reconnect-page">
      <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 0.25rem' }}>Dev preview · the real chips</p>
      <h2 style={{ margin: '0 0 1rem' }}>The beat confirm</h2>
      <div className="chat">
        <div className="bubble agent">
          <p style={{ margin: 0 }}>
            That&rsquo;s the day. Lean and rested, the work in, the ride on the calendar &mdash; both on schedule,
            both yours.
          </p>
          <p style={{ margin: '0.6rem 0 0' }}>
            We&rsquo;ll leave it there for today. When you&rsquo;re ready, the next phase starts turning that
            morning into a plan.
          </p>
        </div>
        <div className="beatc">
          <span className="beatc-prompt">Is that the one worth chasing — or not quite it yet?</span>
          <div className="beatc-chips">
            {BEAT_CONFIRM_CHOICES.map((c) => (
              <button key={c.value} type="button" className="idp-chip">{c.label}</button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
