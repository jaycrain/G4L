# The Playbook + Companion — the primary surface

**2026-08-07.** Jay's direction, after the twelve-asset audit and the active-tool reframe:

> *"The Program is a glorified Syllabus, necessary but not the most valuable. Just outlines the Program until it
> doesn't. The Playbook is where the action is, but don't overreact to that, it could still hold archived assets
> and information. If it's paired with the Companion, it should be the most commonly visited page on the app. And
> we need an implementation where the Companion exists as a pop-up or something ON that page too. The Member still
> needs to be engaged and communicating with it."*

**Proposal. Nothing built.**

---

## The pairing, and why it is not a floating bot

Our standard (`docs/dashboard-ui-standards.md`) says: *"No floating bot. Never a corner bubble or a floating edge
tab — **that's the generic-chatbot pattern members ignore.** The companion is woven into the dashboard, not bolted
on."*

**The rule is anti-generic, not anti-presence.** A corner bubble gets ignored because it is the same blob on every
page, knowing nothing about what you are looking at. A Companion on the Playbook is the opposite of that — it is
**the coach on the headset, looking at the same play you are.**

So the test any implementation must pass: **does it know what the member is looking at?** If opening it from a
play does not carry that play into the conversation, we have built the thing the standard forbids.

**The mechanism already exists.** The docked rail is already a full-screen overlay below 1000px — the mobile
pattern is built. What is missing is (a) availability outside the dashboard and (b) context.

---

## What the Playbook holds — four things, not one

Jay: *"don't overreact… it could still hold archived assets and information."* The active-tool reframe does not
delete the archive; it demotes it from being the whole thing.

1. **The plays** — what I can run. W1's true lines, W2's image, W3's protocol, B3's plan, C3's Quality-Day
   profile. Grouped by what they are FOR, each with *run this again*.
2. **What I'm running now** — the open practice week, live and markable. The play on the field. (This is the grid
   currently bolted to Momentum.)
3. **The reads** — the scouting report. B2's development map, B1's why, the rhythm pattern. Not plays: the thing
   that tells you **which** play to call.
4. **The record** — everything past. Closed weeks, revised plays with what changed, the story so far. Present,
   but not the front door.

**The Companion is what turns 3 into a call on 1.** *"Your maintenance skills are the thin ones, and you've got
travel next week — want to look at the False Start protocol before you go?"* That sentence needs a read, a play,
and a coach. All three live here.

---

## The Program becomes what it is: a syllabus

Jay: *"a glorified Syllabus… Just outlines the Program until it doesn't."*

That last clause is the important one. The Program page is accurate and useful **while a member is walking Cycle
1 in order**. The moment they are in the Loop — cycling back, running plays out of sequence, working on what is
live rather than what is next — a syllabus cannot describe what they are doing. **The Playbook can.**

So: keep it, stop treating it as the map of the product. It answers *"what is this program?"*. The Playbook
answers *"what do I do?"*, which is the question a member actually has on a Tuesday.

---

## The question this forces: what happens to the dashboard?

If the Playbook + Companion is the most-visited page, the dashboard triptych — which today centres the Companion
and flanks it with ID Score / Grinta / Badges and Momentum / Reclaim / Movement / Community — has an overlap
problem. Two surfaces would both be "where the Companion lives."

Three ways that could go, none chosen:

1. **Dashboard stays the front door, Playbook is the workroom.** The dashboard answers "how am I doing" (the
   three feedbacks, the ceremony moments). The Playbook answers "what do I do now". The Companion appears on
   both, contextual to each. Least disruptive; risks the member never forming the Playbook habit because the
   dashboard keeps satisfying them first.
2. **The Playbook becomes the home.** The dashboard's reflective panels stay as subpages. Biggest change, best
   matches "most commonly visited page", and closest to the iPad-on-the-sideline picture.
3. **They merge.** The triptych's centre column *is* the Playbook. One surface, Companion centred, plays and
   reads flanking. Elegant, and the most likely to break on mobile — which redirected this design once already.

**My read: 1 for now, with 2 as the direction.** The Playbook is currently a scrapbook; making it the home before
it earns the traffic would be building the front door onto an empty room. Grow it into the workroom first — plays
runnable, the running week, the first reads — and let the traffic tell us whether the dashboard should step back.

---

## Smallest first step that tests the whole idea

**Put the Companion on the Playbook, with context.** Not a new component — the existing rail/overlay, made
available on `/playbook`, carrying the entry a member opened it from.

It is small, it is reversible, and it tests the load-bearing assumption: **does a member actually talk to the
Companion about a play when the Companion is right there?** If they do, the pairing is real and the rest of the
plan is worth building. If they do not, we learn that before restructuring the IA around it.
