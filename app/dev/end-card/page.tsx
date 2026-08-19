import { assertDevOnly } from '../guard.ts';
import { whereItLives } from '../../../lib/content/where-it-lives.ts';
import { SESSION_KEYS } from '../../../lib/workspace/session-key.ts';

export const metadata = { title: 'Dev — where it lives' };

// LOCAL-ONLY preview (see ../guard.ts). The end card itself needs a finished session to raise, so this renders the
// line every Session close now carries, for all thirteen at once — which is the only way to see whether they read
// as a set rather than as thirteen sentences written one at a time.
export default async function DevEndCardPage() {
  assertDevOnly();
  return (
    <main className="onboard-page" style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1rem' }}>
      <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 0.25rem' }}>Dev preview · the real copy</p>
      <h2 style={{ marginTop: 0 }}>Where it lives — all 13 Sessions</h2>
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
