> # ⚠️ SUPERSEDED — NEVER SENT. Do not act on this document.
>
> **Retired 2026-08-30 by Jay: "let's drop the idea of the email to Greg now, I think it would be a distraction
> before he walks."** Greg has not seen any of this and should not be sent it. The plan is now that he **walks the
> product first**.
>
> **§2 is also factually wrong as written.** It reports his two "Why" domain prompts as cut and offers them back as
> a question for him. They were **restored in v3.5.60** on Jay's ruling — *"Donna shouldn't be cutting in Greg's
> domain"* — so there is no question left to ask. Restoring also exposed that the eating half composed its own copy
> of the item, which meant the first fix reached only the activity half.
>
> Kept rather than deleted because the inventory in §1–§5 is an accurate record of what `scripts/unrun-rules.mjs`
> found in his material on 2026-08-29, and that reasoning is worth having. **The framing — a note to send — is
> dead.** A document that describes an intent nobody is acting on becomes a lie with a delay on it, which is the
> failure this whole sweep has been about.

# For Greg — what of yours is running, and what isn't

**2026-08-29 · v3.5.59 · SUPERSEDED, never sent — see the banner above**

Short version: **everything you specified for the twelve gated Sessions is built and live.** This note is about a
narrower thing — a handful of items from your source documents that exist in the code and are **not currently
reaching a member.** None of them is a science error. Each is either superseded by a later decision, deliberately
parked, or an oversight we have now fixed. We would rather tell you than have you find it.

We found these by writing a checker that hunts for one specific defect: **code that exists and nothing calls.** It
turned out to be this codebase's most common fault — nine instances surfaced in a single day, including one in the
crisis-routing constant. The full inventory is 53 items; most are internal plumbing. Below is only what touches
your material.

---

## 1. Fixed today — your 1–4 anchors now come from one place

Your skills instrument uses **"1 (strongly disagree) to 4 (strongly agree)"**. That wording existed as a single
constant with no callers, while the code typed those same words out at **four separate places**: the spoken
introduction, both ends of the rating chips, and the re-prompt when someone answers out of range.

Nothing was wrong on screen — all four copies happened to agree. The risk was drift: a future edit to one copy
would have left the chips and the sentence introducing them saying different things, in your instrument. They now
all read from the one definition, so they cannot disagree.

The same fix was already in place for the 1–5 agreement family (where the anchors had been written out **twelve**
times). This was the one instrument left out.

## 2. Removed on Donna's walk — your two "Why" domain prompts

> *"Why do you want to be physically active regularly?"*
> *"Why do you want to eat healthier?"*

These were cut during testing: members answer the twelve statements directly, and the eating half keeps only a
light transition. **The decision was made weeks ago; the constant holding your wording outlived it**, still
labelled as "shown once as the header before each domain's six items" — which had stopped being true.

We have removed the constant and recorded your wording in its place, so nothing of yours is lost and nothing in the
file claims to be running when it isn't. **If you want those prompts back, say so** — this is a walk-feedback
decision, not a science one, and it is easy to reverse.

## 3. Deliberately parked — the C-phase Evidence instrument

Your 15 evidence items (Physical / Relational / Identity, five each) are in the code, verbatim, and **not
administered.** They were built for Cycle 2, which Jay moved to post-Charter on 2026-08-29. We have marked them as
parked-with-a-reason rather than deleting them, so they are ready when Cycle 2 starts.

## 4. Internal-only, no member impact

Two items are structural notes rather than content: the mapping of each strand to its underlying construct
(reconnect→grit, rewire→commitment, rebuild→control, reclaim→challenge), and an alias for the scored Checkpoint
control set. Neither is member-facing. Flagging them only so the inventory is complete.

## 5. Not yet built — Legacy Letter open/share tracking

The Legacy Letter itself is live: the member writes it in R3, it renders in their Playbook, and it is dated
forward. Two pieces of record-keeping around it — whether they have *opened* it, and a line they choose to
*share* — have storage and an admin readout but nothing that writes them. So our own reporting would show "never
opened" for every member. **This is on our build list, not a question for you**; noted because if you ever see that
figure, it is our bug and not a finding about members.

---

## What this changes about how we work

The checker now runs as a **ratchet**: the list may shrink freely, and the build fails the moment it grows. New
work cannot quietly add another rule that exists and never runs.

**Nothing here alters a gated asset, an instrument's items, its scale, or its scoring.** The IDQ, the Grinta
battery, the skills and why instruments, and the Doors taxonomy are all administered as specified.
