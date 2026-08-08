import { PART_GLOSS, type Outcome } from '../../../lib/dashboard/outcomes.ts';

// THE THREE OUTCOME CARDS — the head of the Playbook.
//
// Greg (2026-08-08): "W builds mindfulness, B builds fitness, and C builds wellness … Mindfulness and Fitness both
// directly contribute to Wellness so they build hierarchically too." Jay kept the spine on condition it stop being
// a slogan — "make them more detailed and understandable in terms of how they are 'completed'." So each card shows
// the three things that make the outcome, what each one IS, and whether it's there yet.
//
// COPY IS COWORK'S, placed. The vocabulary — a read · a tool · a tracked week — is deliberately the same on the
// Program page: two surfaces teaching one vocabulary, or neither teaches anything. The glosses (know / keep /
// practise) are stated ONCE in the intro rather than repeated under all nine parts, which is what made an earlier
// draft read like a form.
//
// The eyebrow and the title are ONE SENTENCE read together — "Rewire builds Mindfulness", then "Rewire built
// Mindfulness" when the three are done. That is deliberately a claim about what the PHASE built, never a claim
// that the member now possesses wellness. Cycle 1 builds the skills; the outcome is what it produces over time.
//
// Unfinished parts are drawn as road ahead, not debt — the badge grid's treatment (a dimmed row, a hollow mark),
// because a member three weeks in should read this as "here is the shape of it" rather than a list of failures.

export default function OutcomeCards({ outcomes }: { outcomes: Outcome[] }) {
  if (outcomes.length === 0) return null; // a read hiccup shows nothing rather than a wrong claim
  return (
    <section className="pb-outcomes" aria-label="What you’re building">
      <div className="pb-oc-h">What you’re building</div>
      <div className="pb-oc-d">
        Three things, and each one is made of the same three: <b>a read</b> ({PART_GLOSS['A read']}), <b>a tool</b>{' '}
        ({PART_GLOSS['A tool']}), and <b>a tracked week</b> ({PART_GLOSS['A tracked week']}). Practise the process,
        and the product follows.
      </div>
      <div className="pb-oc-grid">
        {outcomes.map((o) => (
          <article key={o.phase} className={`pb-oc ${o.phase}${o.built ? ' built' : ''}${o.fedByOthers ? ' fed' : ''}`}>
            <div className="pb-oc-eyebrow">
              {o.phase} {o.built ? 'built' : 'builds'}
            </div>
            <h3 className="pb-oc-name">{o.product}</h3>
            <p className="pb-oc-blurb">{o.blurb}</p>
            <ul className="pb-oc-parts">
              {o.parts.map((p) => (
                <li key={p.kind} className={p.done ? 'on' : p.running ? 'running' : ''}>
                  <span className="pb-oc-mark" aria-hidden="true">{p.done ? '✓' : '○'}</span>
                  <span className="pb-oc-part">
                    <span className="pb-oc-label">
                      {p.kind} — {p.label}
                      {p.running && <span className="pb-oc-run"> · {p.running}</span>}
                    </span>
                    <span className="pb-oc-detail">{p.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            {/* THE FINISHED MOMENT. Only when all three are done — the one place a card is allowed to say something
                warm, and it still names what they DID rather than what they now are. */}
            {o.built && <p className="pb-oc-done">{o.builtLine}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
