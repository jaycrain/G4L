// A GENUINELY NEW MEMBER — the one state nothing else in this repo can produce.
//
// Every test account we have is saturated: demo-tom has a score, badges, closed Sessions and a completed tour.
// So every "brand new member" path is invisible to us. That is not a theoretical gap — on 2026-08-13 it hid a
// timezone detector that had never once run, and the same day two tour stops and two empty-state pages shipped
// without anyone seeing them, because the surfaces that show them only exist for someone who has just arrived.
//
// This member has finished onboarding (they have an identity, Doors, a Reclaim List — enough to reach the
// dashboard) and NOTHING after it:
//   · no ID Score          → the /score empty state is reachable
//   · no Grinta reading    → the /grinta empty state is reachable
//   · no badges, no plays, no practice weeks → every panel renders its zero/forecast state
//   · threshold_crossed_at and tour_completed_at NULL → the Threshold ceremony AND the Opening Tour both fire
//
// The tour is the prize. It runs ONCE per member, only on a first post-Threshold landing, so it cannot be
// re-watched on any existing account — which is why nobody has ever seen the two stops added today.
//
// WHY THIS LIVES IN lib/ AND NOT IN THE SCRIPT. It is called from two places now: the CLI, and the operator
// button at /admin/fresh. The button is the one that matters — getting a terminal to speak to the production
// database means holding the production connection string, and the useful answer to "how do I reset this on
// prod" should not be a credential.
//
// SAFETY. Refuses any address that is not .test, the same guard as set-demo-password, so it can never touch a
// real member — and jay@adjacentlabmedia.com is a real member whose account is his actual life. Re-running
// RESETS this member to newborn (that is the point: the tour is one-shot, so seeing it twice means wiping it).
// It only ever deletes rows belonging to this one .test member.
import type { Db } from '../db/schema.ts';
import { hashPassword } from '../auth/password.ts';
import { createCredential } from '../auth/store.ts';

/** The fixture's address. A CONSTANT, so the operator button takes no input and the .test guard cannot be routed around. */
export const FRESH_EMAIL = 'fresh@grintaforlife.test';

/**
 * Create (or reset) the fresh member. Returns the new member_id.
 *
 * Exported and tested: a seeder whose output nobody checks is the same shape as the bug this exists to catch.
 */
export async function seedFreshMember(db: Db, email: string, password: string): Promise<string> {
  if (!/\.test$/i.test(email)) throw new Error(`Refusing: ${email} is not a demo (.test) account.`);

  // Wipe any previous run of THIS member. Scoped by member_id throughout — never by a broader predicate.
  const existing = (
    await db.query<{ member_id: string }>('select member_id from member_profile where lower(email) = lower($1)', [email])
  ).rows[0];

  if (existing) {
    const id = existing.member_id;
    // Ordered children-first. A table that does not exist yet on a drifted DB must not abort the reset, so each
    // delete is independent and a miss is reported rather than thrown.
    for (const t of [
      'reclaim_item', 'member_door', 'playbook_entry', 'practice_mark', 'practice_commitment', 'practice_week',
      'idq_retake', 'grinta_reading', 'badge_earned', 'agent_message', 'member_event', 'momentum_call',
      'quality_day_log', 'w3_daily_entry', 'movement_log', 'measure', 'arc_session', 'member_credential',
    ]) {
      // A miss is WARNED, not swallowed. The list is hand-written, and a typo here would leave rows behind on a
      // member the fixture claims is newborn — which is the quiet way a fixture stops testing anything. (It caught
      // exactly that: `member_badge` does not exist; the table is `badge_earned`.)
      await db.query(`delete from ${t} where member_id = $1`, [id]).catch((e: Error) => {
        console.warn(`  ⚠ could not clear ${t}: ${e.message.split('\n')[0]}`);
      });
    }
    await db.query('delete from member_profile where member_id = $1', [id]);
    console.log(`reset: removed the previous ${email}`);
  }

  // The post-onboarding minimum. Deliberately NOT a rich fixture: the point is what is ABSENT.
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile
       (display_name, email, named_door, identity_noun, identity_paragraph,
        intake_athletic_past, intake_gap, intake_right_now, reclaim_list, ai_consent_granted_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9::text::jsonb, now())
     returning member_id`,
    [
      'Newby Fresh',
      email,
      'empty_nest',
      // BARE, no article — that is how real onboarding stores it (displayIdentityNoun), and the surfaces add "the"
      // when they render. Seeding "the Runner" produced a member whose identity read back as "Runner" anyway, which
      // is the fixture quietly not matching the thing it stands in for.
      'Runner',
      'You were the one who ran. Early mornings, a standing race every spring — and then a house that got quiet and a calendar that filled with everyone else.',
      'Ran through my thirties, half-marathons most years.',
      'The kids left and the mornings stopped being mine to plan.',
      '',
      JSON.stringify(['Morning runs again', 'A half-marathon this year', 'Real meals, not whatever is quick']),
    ],
  );
  const memberId = rows[0]!.member_id;

  await db.query(
    `insert into member_door (member_id, door_slug, is_primary, sort_order) values ($1,'empty_nest',true,0)`,
    [memberId],
  );
  const wants = ['Morning runs again', 'A half-marathon this year', 'Real meals, not whatever is quick'];
  for (let i = 0; i < wants.length; i++) {
    await db.query(
      `insert into reclaim_item (member_id, text, category, sort_order) values ($1,$2,'physical',$3)`,
      [memberId, wants[i], i],
    );
  }

  await createCredential(db, memberId, email, await hashPassword(password));

  return memberId;
}
