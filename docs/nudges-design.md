# Nudges — the design, decided

Jay + CC, 2026-08-02. This is the conversation that unblocked backlog item #8, which had sat for two weeks
because it looked like a UI question and was actually a model question.

The thing that unlocked it: **a nudge is not a message, it is a re-entry.** Its whole job is to bring someone
back into the app. Everything below follows from that.

---

## 1. Two roles, split by POSITION — not by sender or channel

The two panels on the member record ("Generate a message" / "Push a Member Agent nudge") looked like
duplicates. They aren't, but the reason in the code was wrong: they had simply grown different plumbing, and
one of them had no review gate for no principled reason.

The real split, Jay's words:

| | The Companion | Jay |
| :- | :- | :- |
| Position | **Inside** the flow — part of the program, the guide | **Outside**, looking in |
| Frequency | In rhythm | **Infrequent** |
| Job | Prompt, encourage, remind, in context | Acknowledge that someone is in charge and paying attention to their wellbeing — and be the point of escalation |
| Voice | MI posture: reflect, normalise, never grade | Jay's own. He is allowed to be direct |

> "Anything from Jay should be looking outside in and… infrequent. Just an acknowledgement that lets them
> know someone is in charge and watching / paying attention to their well being. And a point of escalation if
> something is not going right."

**A nudge is always the Companion.** Jay's messages are a different object — presence and escalation — and
probably want a different name.

**Two voices on purpose.** Jay: *"my natural inclination isn't MI friendly. But that's my role."* The
Companion holds the MI posture; Jay does not have to. Sanding Jay down to sound like a coaching framework
would remove the only human voice in the system.

---

## 2. In-app is not a nudge

> "In app doesn't make sense to me, it's kind of already baked in. The Companion could just simply make a
> suggestion in the main thread. The Member is in the app."

A message shown to someone already in the app is just the Companion talking. A nudge, by definition, reaches
someone who is **not** here.

---

## 3. Why it is legitimate to reach out at all

> "It's not bossy, it's encouraging. It's hey, you asked for this, you want this. And it is to combat the
> biggest problem that got them into this situation in the first place… not following up and being there for
> themselves. We have to take that on, on their behalf."

Taking that on runs close to the Independence Guarantee — let the member set the depth, never extract. What
keeps it the right side of the line is that **the member set the rhythm.** The nudge carries their own prior
intention back to them.

> **If we ever nudge on a cadence WE picked, we have stopped holding their intention and started holding
> ours.** That is the line, and it is worth re-reading before any change to this system.

---

## 4. Two layers

**A — Rhythm.** A cadence the member chooses and comes to recognise. Jay: *"almost expected."*
The `/rhythm` elicitation surface is already built and dark.

**B — Reactive absence.** No check-in after ~a week / 10 days / a month. Numbers are **Greg's**, and per
architecture principle 2 (*gating rules and dosing are configuration, not code*) they live in config. The
engine ships without waiting for him; he moves the numbers without re-engineering and without CC.

---

## 5. Channel: text foremost, or push. NOT email.

Email is Jay's channel; keeping it out of nudges keeps the two roles legible.

**Consent is two asks, not one.** Rhythm first; "how should I reach you" as its own choice with its own
record. Jay: *"cleaner and self resolves."* A member can want a rhythm without wanting their phone to buzz.

⚠️ **Text has a hard prerequisite that does not exist yet.** No phone numbers are collected anywhere, and US
automated texts require prior express written consent plus STOP/HELP handling. That is a legal requirement,
not a nicety. Push works today (service worker, subscriptions, send path all built).

---

## 6. The text itself is NEUTRAL

The strongest possible nudge would use their own words — *"you told me you wanted to get back in open
water."* It is also the most exposing, because a text renders on a **lock screen**, in front of whoever is
near the phone. They consented to be texted. They did not consent to have what they told the Companion — in a
place promised to be safe to be honest — appear where someone else can read it.

**So the text carries nothing personal. It is a door, not a message.** The memory, the recall, the specific
thing they said, all wait inside the app.

Consequence worth keeping: **the rhythm text and the absence text are nearly the same message.** No text ever
has to manufacture something to say, which is what would have turned the Companion into a scheduler.

---

## 7. A nudge is an EVENT, not a send

Jay's insight, and the most structural thing in this document:

> "That makes it part of the Member's history AND something the Companion has memory of."

A quiet stretch and the reaching-out are part of the member's story. They must be written where the Companion
can find them later — which is exactly the raw material the Playbook needs for the Loop (*how did I handle
this before?*). It is also a second argument for the Companion owning nudges: a Jay email lives in a review
queue, not in the member's history.

**Recall is where praise sneaks in.** Jay's own example — *"you came roaring back, let's do it again!"* — is
the motivational-pep register the voice rules cut, and it grades the member's past. Same memory, no verdict:

> "You were away around this time last April. You came back on your own."

The Companion holds evidence of what someone did, and evidence is very easy to turn into a scoreboard.

---

## 8. When it doesn't work → hand to Jay

The reactive layer aims at people who are not coming back, so the case it must handle well is the one where
it fails. **The Companion tries a bounded number of times, then stops and hands them to Jay.** Jay's message
becomes the *last* touch rather than another one, and it is from a person.

> "Then I can break out of the MI philosophy if I choose to. And I've helped a lot of people this way, it's
> necessary sometimes. That's the yin and yang that is Greg and Jay. I'm the last resort."

**The escalation card carries context, so Jay can shape the message** (his ask):

- how long, and what they were mid-way through — an open Session differs from a clean stop
- their Door and Reclaim List, in their words — helping one person is when their own material is his to see
- what the Companion already tried, and when — so Jay is not the fourth identical message
- what happened the last time they went quiet, if there was one
- **a distress flag**

⚠️ **Three different people land in this queue:** someone who drifted and would welcome a push from a human;
someone who withdrew *because* things got bad; and someone who has simply left. Jay's directness is right for
the first and can be wrong for the second.

**Hard line, and it is governance rather than opinion: if there were distress signals before they went quiet,
that is not a "are we the right fit" conversation.** Crisis routing is always on; that case escalates as a
person needing help.

---

## Still open

1. **Rhythm + reactive collision.** Someone on a weekly rhythm who goes quiet at 10 days hits both. Proposed
   default: reactive supersedes, never two in one day, one message per member per day maximum.
2. **Quiet hours.** No text before ~8am or after ~9pm local. Needs a timezone we do not currently store.
3. **Turning it off.** Not a question — the Independence Guarantee requires it. Every nudge channel is
   revocable from the member's own settings, and STOP must work as a real unsubscribe.
4. **Sequencing.** Push ships today; text needs phone collection, a provider, consent capture and STOP
   handling. Whether the reactive layer ships push-only first is a Charter-timing call.
