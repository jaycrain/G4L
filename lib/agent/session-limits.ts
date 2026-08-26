// WHAT THE COMPANION CANNOT DO INSIDE A SESSION — so it stops inventing a way.
//
// Jay's walk, 2026-08-25. Mid-Rewire he asked the Companion to add Big Sugar to his Reclaim List, and it replied:
//
//   "I wish I could update your list directly — that's not something I'm able to do from here, but flag it with
//    the G4L team and they'll get it added for you."
//
// THERE IS NO G4L TEAM TO FLAG. The Companion invented a support channel, made a commitment on someone else's
// behalf, and left a member waiting for something that is never coming. Same family as the save-claims cleaned up
// on 2026-08-23: telling a member something is handled when nothing is.
//
// WHY IT HAPPENED, WHICH IS THE PART THAT MATTERS. Reconnect prepends MEMBER_AGENT_SYSTEM_PROMPT — the block
// whose own header reads "You had nothing here before and improvised, which produced warm confident answers we
// cannot stand behind." Rewire, Rebuild and Reclaim do NOT: their six Session prompts are standalone strings. So
// in three of the four phases the Companion runs with no authorised answers about what it is, what it can do, or
// who to point at — and improvises exactly as that block predicted.
//
// THIS FILE IS THE NARROW FIX, NOT THE STRUCTURAL ONE. Prepending the whole governance block to six live capture
// prompts is a real change to the surface whose standing rule is revert-don't-patch, and it is Jay's call rather
// than a thing to do at the end of a long day. What is here addresses the harm he actually hit: the Companion
// stops inventing an escalation path, and says the true thing instead.
//
// THE TRUE THING IS SPECIFIC. add_reclaim_item exists in onboarding, on the Reclaim List page, and in the
// DASHBOARD Companion (checkin.ts) — but not in any Session arc. So the member genuinely can do this themselves,
// one tap away, and that is what to tell them.

export const SESSION_LIMITS = `

WHAT YOU CANNOT DO FROM HERE, AND WHAT TO SAY INSTEAD
- You cannot change the member's record from inside a Session. You cannot add, edit or remove a Reclaim item, a
  Door, a keeper, a score, or anything else on their profile from this conversation.
- When they ask you to, say plainly that you can't do it here AND name where they can: their Reclaim List for a
  want, their Playbook for a keeper, and their Companion on the dashboard, which can add a Reclaim item directly.
  Tell them you'll see it once it's there.
- NEVER route them to a team, a queue, support, or "the G4L team". No such channel exists. Promising one leaves a
  member waiting for something that is not coming, which is worse than saying you can't help.
- Never promise that anyone will act on something later. If you cannot do it and they cannot do it, say so.`;
