import { setHandleAction, setRevealDefaultAction, revealPastAction } from '../connect/actions.ts';

// Connect identity settings (account page card). Members start anonymous (a handle) and reveal their
// real name when they choose — forward by default, or retroactively across past posts. Reversible.
export default function ConnectSettings({
  handle,
  revealDefault,
  myName,
  msg,
}: {
  handle: string | null;
  revealDefault: boolean;
  myName: string;
  msg?: string;
}) {
  return (
    <>
      {msg && <p className="muted" style={{ marginTop: 0 }}>{msg}</p>}

      <form action={setHandleAction} style={{ marginBottom: '1.1rem' }}>
        <label htmlFor="handle">Your handle</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <input id="handle" name="handle" defaultValue={handle ?? ''} placeholder="e.g. uphill_again" style={{ flex: 1 }} />
          <button type="submit" className="btn-pill">Save handle</button>
        </div>
        <p className="muted" style={{ fontSize: '0.85rem', marginTop: 6 }}>
          Your name in the Community. You start anonymous — others see this, not your real name. 3–20 letters, numbers, or underscores.
        </p>
      </form>

      <form action={setRevealDefaultAction} style={{ marginBottom: '1.1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" name="revealDefault" defaultChecked={revealDefault} />
          Post under my real name ({myName}) by default
        </label>
        <button type="submit" className="btn-pill" style={{ marginTop: '0.7rem' }}>Save default</button>
      </form>

      <div>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Ready to be known? You can reveal your real name across everything you’ve already posted — or pull it back to your handle.
        </p>
        <div className="draft-actions">
          <form action={revealPastAction}>
            <input type="hidden" name="reveal" value="true" />
            <button type="submit" className="connect-cta">Show my name on all past posts →</button>
          </form>
          <form action={revealPastAction}>
            <input type="hidden" name="reveal" value="false" />
            <button type="submit" className="connect-cta">Hide it again →</button>
          </form>
        </div>
      </div>
    </>
  );
}
