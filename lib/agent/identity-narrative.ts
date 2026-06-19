// Re-sharpen the dashboard mirror (member_profile.identity_paragraph) after the member does identity
// work in a Session. The mirror should get "further and further dialed" — each identity-bearing
// Session feeds the member's own words + their named selves back into a sharper reflection. Best-effort:
// never throws into the close path, never blanks an existing paragraph.
import type { Db } from '../db/schema.ts';
import { writeAsActor } from '../db/actor.ts';
import type { Asset } from '../curriculum/types.ts';
import { getProvider } from './provider.ts';
import { listFacets, getSessionProgress } from '../curriculum/store.ts';

/** Recompose the identity paragraph from a just-closed Session's reflections + the named selves, and
 * persist it. Returns the new paragraph, or null if there was nothing to dial in / it was skipped. */
export async function refreshIdentityNarrative(db: Db, memberId: string, session: Asset): Promise<string | null> {
  try {
    const [{ rows }, facets, progress] = await Promise.all([
      db.query<{ display_name: string | null; identity_paragraph: string | null }>(
        'select display_name, identity_paragraph from member_profile where member_id=$1',
        [memberId],
      ),
      listFacets(db, memberId),
      getSessionProgress(db, memberId, session.id),
    ]);
    const prof = rows[0];
    if (!prof) return null;

    const answers = progress?.answers ?? {};
    const reflections = (session.steps ?? [])
      .filter((s) => (answers[String(s.n)] ?? '').trim())
      .map((s) => ({ prompt: s.prompt, answer: answers[String(s.n)]!.trim() }));
    if (!reflections.length) return null; // a non-reflective Session (tracker/pulse) — nothing to dial in

    const narrative = (
      await getProvider().composeIdentityNarrative({
        displayName: prof.display_name ?? 'there',
        facets: facets.map((f) => f.text),
        priorParagraph: prof.identity_paragraph,
        sessionTitle: session.title,
        reflections,
      })
    ).trim();
    if (!narrative) return null;

    await writeAsActor(db, 'member_agent', (tx) =>
      tx.query('update member_profile set identity_paragraph=$2 where member_id=$1', [memberId, narrative]),
    );
    return narrative;
  } catch {
    return null; // the mirror refresh is never allowed to break a Session close
  }
}
