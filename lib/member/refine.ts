// Member-initiated refinement of their own core records — additive only. Used by the Member Agent's
// governed tools so a member can add to / sharpen their Reclaim List and add Door(s) in conversation,
// instead of a bolt-on page. Deleting or editing items that already carry progress is deliberately
// NOT here (state-machine + Journey integrity) — see the deferred follow-up.

import type { Db } from '../db/schema.ts';
import { writeAsActor } from '../db/actor.ts';
import { addReclaimItems, getReclaimItems } from '../beats/store.ts';
import { inferCategory, isVagueReclaim } from '../beats/category.ts';
import { isCategory, type Category } from '../beats/registry.ts';
import { DOORS, DOOR_SLUGS, matchDoors, isDoorSlug, type DoorSlug } from '../doors.ts';

const doorDisplay = (slug: DoorSlug) => DOORS.find((d) => d.slug === slug)?.displayName ?? slug;

/** The member's current canonical Door set (slugs, primary first). The onboarding seed lives here; the
 * Doors Session refines it. */
export async function getMemberDoors(db: Db, memberId: string): Promise<DoorSlug[]> {
  const { rows } = await db.query<{ door_slug: string }>(
    'select door_slug from member_door where member_id=$1 order by is_primary desc, sort_order',
    [memberId],
  );
  return rows.map((r) => r.door_slug).filter(isDoorSlug);
}

/** The member's current Doors as display names (for the companion to acknowledge in the Doors Session). */
export async function getMemberDoorNames(db: Db, memberId: string): Promise<string[]> {
  return (await getMemberDoors(db, memberId)).map(doorDisplay);
}

/** Write the canonical Door set — the Doors Session is the one source of truth for refinement. Adds
 * new, removes dropped, re-orders (first = primary). Never wipes to empty (≥1 Door contract). */
export async function setMemberDoors(db: Db, memberId: string, slugs: DoorSlug[]): Promise<string[]> {
  const valid = slugs.filter(isDoorSlug);
  if (valid.length === 0) return getMemberDoors(db, memberId).then((d) => d.map(doorDisplay)); // refuse empty
  await db.query('delete from member_door where member_id=$1 and door_slug <> all($2::text[])', [memberId, valid]);
  for (let i = 0; i < valid.length; i++) {
    await db.query(
      `insert into member_door (member_id, door_slug, is_primary, sort_order) values ($1,$2,$3,$4)
       on conflict (member_id, door_slug) do update set is_primary = excluded.is_primary, sort_order = excluded.sort_order`,
      [memberId, valid[i], i === 0, i],
    );
  }
  await writeAsActor(db, 'member_agent', (tx) =>
    tx.query('update member_profile set named_door=$2 where member_id=$1', [memberId, valid[0]]),
  );
  return valid.map(doorDisplay);
}

/** Reconcile the canonical Door set from the Doors-Session conversation + what onboarding seeded —
 * keep, add, or drop, per what the member affirmed. Live Claude (faithful to their words, never invents
 * a Door they didn't own); additive matchDoors fallback when no key. */
export async function reconcileDoors(conversation: string, current: DoorSlug[]): Promise<DoorSlug[]> {
  const fallback = Array.from(new Set<DoorSlug>([...current, ...matchDoors(conversation)]));
  if (!process.env.ANTHROPIC_API_KEY) return fallback.length ? fallback : current;
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 16000, maxRetries: 1 });
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
    const map = DOORS.map((d) => `- ${d.slug}: ${d.displayName} — ${d.descriptor}`).join('\n');
    const sys =
      'You reconcile a member\'s Doors after the Doors Session. From the conversation + the Doors they had coming in, ' +
      'return the CANONICAL set they affirm now — keep the ones that still fit, ADD any new one they surfaced, DROP any they ' +
      'clearly disowned. Map only to the Doors below; never invent or infer one they did not own. Leaving the set empty is valid — better none than a Door they would not claim. Most-central first. ' +
      'Output STRICT JSON only: {"doors": string[]} of slugs.\n\n' + map;
    const user = `Doors they came in with: ${current.length ? current.join(', ') : '(none yet)'}\n\nThe Doors-Session conversation:\n${conversation}`;
    const res = await client.messages.create({
      model,
      max_tokens: 200,
      system: sys,
      tools: [{ name: 'set_doors', description: 'The canonical Door slugs the member affirms.', input_schema: { type: 'object', properties: { doors: { type: 'array', items: { type: 'string', enum: [...DOOR_SLUGS] } } }, required: ['doors'] } } as never],
      tool_choice: { type: 'tool', name: 'set_doors' } as never,
      messages: [{ role: 'user', content: user }],
    });
    const tu = res.content.find((b) => b.type === 'tool_use');
    const arr = tu && tu.type === 'tool_use' ? (tu.input as { doors?: unknown }).doors : null;
    const slugs = Array.isArray(arr) ? arr.filter(isDoorSlug) : [];
    return slugs.length ? slugs : fallback.length ? fallback : current;
  } catch {
    return fallback.length ? fallback : current;
  }
}

export type AddReclaimResult =
  | { ok: true; text: string; category: string }
  | { ok: false; reason: 'empty' | 'vague' | 'duplicate' };

/**
 * Add ONE item to the member's Reclaim List. Refuses fog (a feeling/inner state) so the Beat engine
 * can actually bind work to it, infers the IDQ-dimension category, and appends (never reorders or
 * drops existing items, so the ≥3 contract can't be violated by an add).
 */
export async function addReclaimItemForMember(
  db: Db,
  memberId: string,
  rawText: string,
  agentCategory?: string, // the MA's inferred category (incl. 'life'); falls back to the heuristic
): Promise<AddReclaimResult> {
  const text = (rawText ?? '').trim();
  if (!text) return { ok: false, reason: 'empty' };
  if (isVagueReclaim(text)) return { ok: false, reason: 'vague' };
  const existing = await getReclaimItems(db, memberId);
  if (existing.some((i) => i.text.trim().toLowerCase() === text.toLowerCase())) {
    return { ok: false, reason: 'duplicate' };
  }
  const category: Category = isCategory(agentCategory) ? agentCategory : inferCategory(text);
  await addReclaimItems(db, memberId, [{ text, category }]);
  return { ok: true, text, category };
}

export type AddDoorResult =
  | { ok: true; added: string[] }
  | { ok: false; reason: 'nomatch' | 'already' };

/**
 * Record additional Door(s) from the member's own words. Maps free text to the canonical Doors,
 * adds only ones they don't already have (additive), and makes the first Door primary if they had none.
 */
export async function addDoorForMember(db: Db, memberId: string, description: string): Promise<AddDoorResult> {
  const matched = matchDoors(description ?? '');
  if (matched.length === 0) return { ok: false, reason: 'nomatch' };

  const existingRows = (
    await db.query<{ door_slug: string; is_primary: boolean; sort_order: number }>(
      'select door_slug, is_primary, sort_order from member_door where member_id=$1',
      [memberId],
    )
  ).rows;
  const existing = new Set(existingRows.filter((r) => isDoorSlug(r.door_slug)).map((r) => r.door_slug));
  const hadPrimary = existingRows.some((r) => r.is_primary === true);

  const added: DoorSlug[] = [];
  let order = existingRows.length;
  for (const slug of matched) {
    if (existing.has(slug)) continue;
    const isPrimary = !hadPrimary && added.length === 0;
    await db.query(
      `insert into member_door (member_id, door_slug, is_primary, sort_order)
       values ($1,$2,$3,$4) on conflict (member_id, door_slug) do nothing`,
      [memberId, slug, isPrimary, order],
    );
    added.push(slug);
    existing.add(slug);
    order++;
  }

  if (added.length === 0) return { ok: false, reason: 'already' };
  // Keep named_door (the single-value primary used by some reads) in sync if there wasn't one.
  if (!hadPrimary)
    await writeAsActor(db, 'member_agent', (tx) =>
      tx.query('update member_profile set named_door=$2 where member_id=$1', [memberId, added[0]]),
    );
  return { ok: true, added: added.map(doorDisplay) };
}
