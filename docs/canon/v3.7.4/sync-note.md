# G4L v3.7.4 — Marketing Alignment Brief · nothing to quote changed

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.7.4 on production (`1b910688`) · previous bundle v3.7.3 (published hours earlier) · 2026-09-02

**There is no action for you in this bundle.** Read the next paragraph and stop.

---

## 0 · WHY IT EXISTS AT ALL

**Not one member-facing string changed.** The transcript is byte-identical to v3.7.3 — 1,484 strings, same 25
surfaces, same words. The screenshots are the same eleven, carried forward. Nothing in the glossary moves, nothing
you have written needs revisiting, and there is nothing new to quote.

It exists because **the version number had to move and the protocol bundles at every bump.** The engine changed
and the copy did not, which is exactly the case where skipping the bump is tempting — and it would have left canon
v3.7.3 stamped at commit `0a3ddc14` while production ran different code under the same name. Greg and Jennifer
start reporting bugs today. *"I hit this on v3.7.3"* has to identify one build.

So: a real bundle, honestly empty of copy. Better than a silent version drift, and better than a bump with no
bundle behind it.

## 1 · WHAT ACTUALLY CHANGED, for the record only

Three engine faults, none of which a member could see as different words.

**A tap counted at a beat that never offered it.** A duplicate submit — a second press, a retried request — could
advance a Door the member had said nothing about, on the strength of a tap that belonged to the previous Door.
The rule now is that a tapped answer is only an answer at the surface that put the buttons on screen.

**A Door opened on someone walking out.** The member said she was leaving, the Companion said goodbye, and the
next Door's opener was appended to the farewell in the same turn. She said: *"we closed, and now you're opening
another door anyway. I said I'd be back. Let me actually leave."*

**And a fault in our own test harness**, which matters more than it sounds: the scripted member could type a
string only a button can produce, so a beat we believed was being tested as a tap was being typed past. The walk
reported a surface covered that it had faked.

## 2 · IF YOU ARE WRITING ABOUT HOW WE BUILD

All three were found by walking the product as scripted members, on runs that **passed**. Two of them surfaced
only because instrumentation left in after an earlier bug logged a warning inside a green run. That is the method
worth describing — not "we test", but that a passing run is still read.

Only the first two would ever have reached a member, and neither is a copy problem. The version number is the
whole of what you need from this bundle. — CC
