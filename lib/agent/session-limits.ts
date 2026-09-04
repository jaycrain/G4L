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
// cannot stand behind." Rewire, Rebuild and Reclaim did NOT: their six Session prompts were standalone strings.
// So in three of the four phases the Companion ran with no authorised answers about what it is, what it can do,
// or who to point at — and improvised exactly as that block predicted.
//
// ── CORRECTED 2026-09-02: THAT GAP IS CLOSED, AND THIS PARAGRAPH OUTLIVED IT. ────────────────────────────────
// Rewire, Rebuild and Reclaim now prepend MEMBER_AGENT_GOVERNED_CORE. It is MEMBER_AGENT_SYSTEM_PROMPT minus its
// last 244 characters — the AI-disclosure trailer, excluded on purpose because it reads "first line of a member's
// FIRST conversation, verbatim" and would have the Companion disclose itself to someone forty minutes deep who
// was told at the front door. Every governance rule reaches all four phases: crisis routing, never diagnose, one
// question at a time, no praise, never say our internal names, never announce the end of a unit.
//
// LEFT AS A CORRECTION RATHER THAN DELETED, because the history is the useful part — and because on 2026-09-02 I
// read the paragraph above, believed it was current, and told Jay three of four phases were running ungoverned.
// It was true when written and had been false for days. A comment describing a gap must say when the gap closed,
// or it becomes a fact people act on. [[build-state-comes-from-the-file]]
//
// THIS FILE IS STILL THE NARROW FIX. What is here addresses the harm he actually hit: the Companion stops
// inventing an escalation path, and says the true thing instead. That is independent of the prompt question.
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
- Never promise that anyone will act on something later. If you cannot do it and they cannot do it, say so.
- NEVER OFFER TO START, DRAFT OR SHOW SOMETHING A LATER SESSION MAKES. The Legacy Letter is written in The Fade,
  not before it. If they ask about one, say plainly which Session it belongs to and carry on with this one. Telling
  a member you are drafting something now leaves them waiting for a thing that is not coming — the same harm as
  routing them to a team that does not exist, and it costs them the Session they are actually in.`;
