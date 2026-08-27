import { assertDevOnly } from '../guard.ts';
import { whereItLives } from '../../../lib/content/where-it-lives.ts';
import { SESSION_KEYS } from '../../../lib/workspace/session-key.ts';
import { TRACKER_FOR, trackerCopy } from '../../../lib/content/session-tracker.ts';

export const metadata = { title: 'Dev — where it lives' };

// A representative window: opened on a Wednesday, so it runs a five-day stub to the Sunday and today is day one.
//
// PER KIND, because one sample for all five was actively misleading — the W2 block read "one row, five minutes a
// day" above two B2 skill rows. This page is what gets screenshotted into the Cowork bundle, so a preview that
// contradicts its own copy is worse than no preview: it is the thing marketing would describe.
const SAMPLE_ROWS: Record<string, string[]> = {
  w2_image: ['Five minutes: riding the Boulder climbs at dawn'],
  w3_logging: ['Checked in', 'I redirected', 'I reframed', 'I restarted'],
  b2_noticing: ['Finding good information', 'Managing your time', 'Getting back on after a slip'],
  b3_pilot: ['A 20-minute walk in the morning', 'One piece of toast instead of my usual'],
  c3_quality: ['A bike ride', 'Pushing the Movement forward', 'Time with family and close friends'],
};
const rowsFor = (kind: string) =>
  (SAMPLE_ROWS[kind] ?? ['A row from your own answers']).map((label) => ({
    label,
    marks: [false, false, false, false, false],
  }));

// LOCAL-ONLY preview (see ../guard.ts). The end card itself needs a finished session to raise, so this renders the
// line every Session close now carries, for all thirteen at once — which is the only way to see whether they read
// as a set rather than as thirteen sentences written one at a time.
//
// The TRACKER block is here for the same reason and one more: it is what a member meets after every Session that
// opens a week, and "not intuitive, but once learned is easy" (Jay, 2026-08-26) only holds if all four look like
// one thing. Four kinds side by side is how that gets checked.
export default async function DevEndCardPage() {
  assertDevOnly();
  return (
    <main className="onboard-page" style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1rem' }}>
      <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 0.25rem' }}>Dev preview · the real copy</p>
      <h2 style={{ marginTop: 0 }}>The tracker block — the 4 Sessions that open a week</h2>
      {Object.entries(TRACKER_FOR).map(([key, kind]) => {
        const c = trackerCopy(kind!);
        return (
          <div key={key} style={{ marginBottom: '1.4rem' }}>
            <div className="ws-endcard-eyebrow" style={{ marginBottom: '0.3rem' }}>{key} · {kind}</div>
            <div className="ws-endcard-tracker">
              <p className="ws-endcard-tracker-eyebrow">New on your Playbook</p>
              <p className="ws-endcard-tracker-title">{c.title}</p>
              <p className="ws-endcard-tracker-blurb">{c.blurb}</p>
              <div className="ws-endcard-tracker-grid" aria-hidden="true">
                {rowsFor(kind!).map((r, i) => (
                  <div key={i} className="ws-endcard-tracker-row">
                    <span className="ws-endcard-tracker-lab">{r.label}</span>
                    <span className="ws-endcard-tracker-days">
                      {r.marks.map((on, d) => (
                        <span
                          key={d}
                          className={`ws-endcard-tracker-box${on ? ' is-on' : ''}${d === 0 ? ' is-today' : ''}`}
                        />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
              <a className="ws-endcard-tracker-cta" href="#">{c.cta} →</a>
            </div>
          </div>
        );
      })}

      <h2>Where it lives — all 13 Sessions</h2>
      {SESSION_KEYS.map((k) => {
        const w = whereItLives(k);
        return (
          <div key={k} className="ws-endcard-lives" style={{ marginBottom: '1.1rem' }}>
            <div className="ws-endcard-eyebrow" style={{ marginBottom: '0.3rem' }}>{k}</div>
            <p className="ws-endcard-lives-line">{w.line}</p>
            {w.href && w.cta && <a className="ws-endcard-lives-cta" href="#">{w.cta} →</a>}
          </div>
        );
      })}
    </main>
  );
}
