// A FAILED READ MUST NOT LOOK LIKE AN EMPTY ONE.
//
// The pattern this replaces is `await someRead(db, id).catch(() => [])`. It keeps the page up, which is right — a
// dashboard should degrade, never crash. But it also erases the difference between "this member has logged nothing"
// and "the query threw", and the UI renders both as the same blank panel. The member is then told, confidently, that
// their work isn't there.
//
// Greg logged a Good Call on 2026-08-06, pressed the button, and it "didn't show up as a positive." Six separate
// read sites for Momentum alone swallow their errors into `[]`, so there was no way to tell from the outside whether
// the write failed, the read failed, or he genuinely had no calls. This is the FOURTH time this shape has cost us a
// debugging session (see the Playbook harvest silent-drop and the Community feed, both `catch { return [] }`).
//
// So: still degrade, but say so. `softRead` logs the label, the member, and the real error, then returns the
// fallback. The panel stays blank for the member; the cause is in the server log for us.

/**
 * Run a read that must not take the page down. On failure: log loudly, return `fallback`.
 *
 * @param label  where this read lives, e.g. 'momentum.pulseBeats' — this is what you'll grep for at 2am.
 */
export async function softRead<T>(label: string, memberId: string, read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (e) {
    // Never throw from the logger itself — a broken log must not become a broken page.
    try {
      console.error(`softRead FAILED — ${label} · member=${memberId} · ${(e as Error)?.message ?? e}`);
    } catch {
      /* ignore */
    }
    return fallback;
  }
}
