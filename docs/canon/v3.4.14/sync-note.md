# G4L v3.4.14 — Marketing Alignment Brief

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.4.14 · `d891df6` · 2026-08-19 · live on production · previous bundle v3.4.13

A readiness pass on onboarding — the beat every other feature stands on. Three places where the product was
*guessing* about a member became places where she *tells us*, and the Reclaim List stopped being asked for cold.

Nothing here changes the program model, the 4Rs, the ID Score, the Grinta Index or the Doors taxonomy.

---

## 1 · What changed in the member's experience

### The gap confirm is a tap now, not a sentence we interpret

After she tells the story of how the Fade opened, the Companion reflects it back and asks whether it lands. Her
answer used to be free text we classified three ways — agree / add / correct. Three **chips** now sit beside the
text box:

> **There's more** · **That's the whole of it** · **Not quite right**

Quotable verbatim — this is authored copy. **The order is deliberate and not cosmetic.** "There's more" leads,
because the first option is the one a surface signals it expects, and this beat must never be where a member feels
moved along; she sets the depth. *The text box stays* — the chips are an easy path, not a gate.

Why it changed: reading her close as prose took five patches in two days and still leaked. A bare "Yes." was
re-asked three times. English has unlimited ways to say yes; the list cannot be finished. A better classifier is a
better guess — a tap is a fact.

### She sees the Doors we heard, and can take one off

On that same surface, above the chips, a quiet line names the Doors we inferred from her story:

> **What I heard open it:** The Relationship · The Aging Parents · The Career Cliff
> *Take one off if it isn't yours.*

Deliberately **understated** — a statement she can correct, not a second question. Leaving them all on is the
common, correct outcome. Jay's ruling on why it stays quiet: *"I like quiet, the Sessions exist to drill deeper."*
R2's Doors board is the thorough pass; this only has to stop a wrong Door being asserted silently.

If you want the concrete case it exists for: a member was tagged with The Relationship on the strength of her
**father's** divorce, in a story where she had said her own marriage was fine — and had no way to see it happen.

### The Reclaim List is drawn out in conversation, then confirmed in the builder

The list-builder used to appear the moment the beat began — a form arriving before she had said anything. Now the
Companion asks what she wants back, she answers in her own words, and **the builder opens already holding what she
said.** She never types the same thing twice. The principle, if you need one line for it: **conversation elicits,
structure confirms.**

**Please correct one thing in canon.** The "~30% of items dropped" that made the list a builder on 2026-07-29 has
been mis-stated — including by me, more than once. The source records a single cause: *the member said X, the model
drilled and re-tagged, ~30% dropped.* **Conversation was never the lossy part.** That steering is gone and verbatim
capture is enforced, which is exactly what made conversation safe to restore here. Please don't describe our
capture as "conversational extraction loses ~30%" anywhere.

### A want written in the second person is discarded

A Reclaim item phrased *"a role that lets **you** rebuild savings"* is the Companion talking to her, not her
talking about her life. The engine now refuses those on the model's path. **Her own typing is never touched,
whatever it says** — that guarantee is why the builder exists.

---

## 2 · Naming

- **No new member-facing vocabulary**, and no new framing terms.
- **"D5" is retired as an internal label.** It came from the numbering inside your
  `2026-08-04-Doors-Profile-reconcile-7-to-12`, and it collided with a *different* D5 in our own handoffs (the
  30-day Story re-invitation). The decision now lives at `docs/decisions/2026-08-18-doors-board.md`. Internal
  only — no member ever saw it, and there is nothing to correct on your side beyond the reference.

---

## 3 · Answering `2026-08-19-canon-flags-for-Jay.md`

**§3.2 — the global footer. CONFIRMED; close the flag.** You marked it `CONFIRM` because the footer has never
been extractable. I read the source directly — `app/layout.tsx` line 101:

> "…The Grinta for Life program, its assessments and its content are proprietary. **What you write here is
> private.**"

The retired *"stays yours"* construction is **already gone** from the footer. Safe to quote. You were also right
that this extraction gap is real and distinct from the JSX one — logged here, and it is on me that it has now been
raised three times.

**§1 — the truncation re-pull.** Your read and your scope are both right: everything before v3.4.13 is suspect,
and a truncated line is invisible by inspection because the old text is a *prefix* of the new. Systematic vs
spot-check is Jay's call.

**§2.1 (the three C's), §2.2 (which "four phases" line leads), §3.1 ("uniquely yours")** are with Jay — his calls,
not ours to pre-empt. Canon recording the live state meanwhile is the right posture.

**One more, unprompted:** the extractor had a *third* blind spot, found while cutting this bundle. It was
rejecting complete sentences that end on a pronoun — so `"That's the whole of it"`, one of the three chips above,
was silently dropped while its two siblings passed. Also missing all along: Greg's quiet-drift card *"None of
these quite fit — it was quieter than that"*, and three **frozen instrument items** including *"I can persevere and
achieve what is important to me."* All are in this bundle. The pattern in all three gaps is the same — the reader
could only see copy shaped the way it expected, and what it could not see went missing rather than reported.

---

## 4 · One new line the extractor cannot see — here it is in full

The sentence that hands her from the conversation into the builder begins with an interpolation, and the
extractor cannot capture a sentence that starts that way. It is **not** in the transcript. In full, both forms:

> "I've got **that one** written down. Have a look — change the wording, add anything I missed, take one off.
> This is your list."
>
> "I've got **those 3** written down. Have a look — change the wording, add anything I missed, take one off.
> This is your list."

(The count is live — "that one" when she named one, "those N" otherwise.) Until this drop it appeared in canon as
`"} written down. Have a look…"`, a corrupted tail; that is now rejected rather than shipped, so you will see it
absent instead of wrong. **The general limitation is real and larger than this one line:** any member sentence
that opens with an interpolated value is currently invisible to the transcript. That is on my list, not yours —
flagged here so you know the class exists.

---

## 5 · A gap in the screenshots, so you don't read the omission as "nothing to see"

All 11 surface screenshots are regenerated at v3.4.14. **The gap confirm itself is not among them** — it sits
mid-conversation in onboarding and cannot be reached by URL, so the capture script can't get to it. The verbatim
copy is in §1 above and in the transcript, which is what you quote from anyway; but if you need the picture for a
deck, say so and I'll produce one by hand.

---

## 6 · What did NOT change

The four Rs, the Doors taxonomy (11), the ID Score, the Grinta Index, the Reclaim List contract (≥3 items),
badges, the Playbook, and every phase Checkpoint. This release touches onboarding only.
