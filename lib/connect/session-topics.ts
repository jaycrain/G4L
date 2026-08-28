// THE THREAD THAT MATCHES WHAT SHE JUST DID.
//
// After a Session the Companion points a member at the Community. Until now every one of the four nudges resolved
// to the same place — `/connect/{memberId}`, the front page — so a member who had just spent twenty minutes
// building a False Start Protocol was invited to "look in" and landed on a general feed with nothing about false
// starts on it. The invitation was real, the room was real, and the thing she was invited to look at was not
// there. Donna, 2026-08-21.
//
// (That line has now failed twice. Before 2026-08-19 all four nudges were the bare string '/connect', which is not
// a route — they 404'd for every member, every time.)
//
// SO EACH SESSION GETS A TOPIC, and the nudge links to THAT.
//
// AUTHORED BY THE FOUNDERS, AND PHRASED AS A QUESTION (Jay, 2026-08-21, option 1 of three).
//
// The alternative — the one the existing demo seed uses — is to write these as member stories: "The week I almost
// quit — and didn't." That is fine in a seeded demo account and dishonest in front of a real member, because it
// fabricates a person and their recovery and gives her no way to know. A member who replies to a story that was
// never true has been deceived by us at the exact moment we asked her to be honest.
//
// A question from the Founders is true as written. It also matches what the Community spec asks for — "guided,
// seed-topic discussion, not an empty forum" — and it is the version that survives Charter without needing to be
// unpicked, which matters because scaffolding that must be removed later usually is not.
//
// NO REAL NAME (Jay, 2026-08-21). "The Founders", never a person.
//
// THIS IS DELIBERATE SCAFFOLDING. Jay: "This would help us all visualize how it would work... Then we'll clean it
// all up before Charter." It is also §8 of docs/community-build-plan.md in miniature — the Companion pointing at
// the thread that matches what a member actually worked on, rather than at a room. If it reads well here, that is
// evidence for building the real version.

// KEYS ARE THE REGISTRY'S, NOT INVENTED. My first pass wrote 'rewire-w3' / 'reclaim-c3' / 'rewire-w2' — none of
// which exist. The registry's ids are flat: reconnect · w1 · w2 · w3 · rewire-checkpoint · b1..b4 · c1..c4. A
// wrong key here fails silently (topicForSession returns null, the nudge falls back to the room) which is exactly
// the shape that ships unnoticed — so the test below pins every key against the registry.

/** A seeded discussion prompt, keyed to the Session whose work it follows. */
export type SessionTopic = {
  /** The workspace session key this follows — see lib/workspace/session-registry.ts. */
  sessionKey: string;
  title: string;
  /** One or two lines under the title. An invitation, never an instruction, and never a claim about her. */
  body: string;
};

export const SESSION_TOPICS: SessionTopic[] = [
  {
    sessionKey: 'w3',
    title: 'What does your slip usually look like?',
    body:
      'Everybody slips. The useful part is knowing your own shape of it — when it tends to happen, and the first '
      + 'thing that actually helps you start again. Say as much or as little as you want.',
  },
  {
    sessionKey: 'c3',
    title: 'What actually makes a day a good one for you?',
    body:
      'Not the highlight reel — the ordinary version. The things that, when they happen, mean the day went well. '
      + 'Other people\'s answers here are often the useful part.',
  },
  {
    // Keyed to R2 — the Doors are their own Session now. It was 'reconnect' when the phase was one Session.
    sessionKey: 'r2',
    title: 'Which door did you walk through, and when did you notice?',
    body:
      'Most people can name the moment the distance opened, or the year they realized it already had. If you want '
      + 'to put yours down here, it stays among people who have walked through one too.',
  },
  {
    sessionKey: 'w2',
    title: 'What is the ordinary Tuesday you are working toward?',
    body:
      'A year out, on a day with nothing special in it. How it starts, what you reach for, who is in it. Writing it '
      + 'somewhere other than your own head tends to sharpen it.',
  },
];

/** The topic seeded for this Session, or null when the Session has none — the caller falls back to the room. */
export function topicForSession(sessionKey: string | null | undefined): SessionTopic | null {
  if (!sessionKey) return null;
  return SESSION_TOPICS.find((t) => t.sessionKey === sessionKey) ?? null;
}
