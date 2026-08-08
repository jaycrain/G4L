import type { Outcome } from '../../../lib/dashboard/outcomes.ts';

// THE THREE OUTCOME CARDS — the head of the Playbook.
//
// Greg (2026-08-08): "W builds mindfulness, B builds fitness, and C builds wellness … Mindfulness and Fitness both
// directly contribute to Wellness so they build hierarchically too." Jay kept the spine on condition it stop being
// a slogan — "make them more detailed and understandable in terms of how they are 'completed'." So each card shows
// the three things that make the outcome, and each one is either present or not yet. `lib/dashboard/outcomes.ts`
// decides; this file only draws.
//
// The eyebrow and the title are ONE SENTENCE read together — "Rewire builds Mindfulness", then "Rewire built
// Mindfulness" when the three are done. That is deliberately a claim about what the PHASE built, never a claim
// that the member now possesses wellness. Cycle 1 builds the skills; you practise the shot, not the winning.
//
// Unfinished parts are drawn as road ahead, not debt — the badge grid's treatment (a dimmed card, a hollow mark),
// because a member three weeks in should read this as "here is the shape of it" rather than a list of failures.

export default function OutcomeCards({ outcomes }: { outcomes: Outcome[] }) {
  if (outcomes.length === 0) return null; // a read hiccup shows nothing rather than a wrong claim
  return (
    <section className="pb-outcomes" aria-label="What you’re building">
      <div className="pb-oc-h">What you’re building</div>
      <div className="pb-oc-d">
        Three things, and each one is made of three: something you know, something you hold, something you practise
        for a week. The cycle builds the skills — you practise the shot, not the winning.
      </div>
      <div className="pb-oc-grid">
        {outcomes.map((o) => (
          <article key={o.phase} className={`pb-oc ${o.phase}${o.built ? ' built' : ''}${o.fedByOthers ? ' fed' : ''}`}>
            <div className="pb-oc-eyebrow">
              {o.phase} {o.built ? 'built' : 'builds'}
            </div>
            <h3 className="pb-oc-name">{o.product}</h3>
            <p className="pb-oc-blurb">{o.blurb}</p>
            {/* ABOVE the parts, not below: the list is bottom-aligned across the row so the three cards read as one
                rank, and a footer under it pushed this card's list out of line with the other two. */}
            {o.fedByOthers && <div className="pb-oc-fed">The other two feed this one.</div>}
            <ul className="pb-oc-parts">
              {o.parts.map((p) => (
                <li key={p.sub} className={p.done ? 'on' : p.running ? 'running' : ''}>
                  <span className="pb-oc-mark" aria-hidden="true">{p.done ? '✓' : '○'}</span>
                  <span className="pb-oc-part">
                    <span className="pb-oc-label">{p.label}</span>
                    <span className="pb-oc-sub">{p.running ?? p.sub}</span>
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
