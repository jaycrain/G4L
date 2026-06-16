# Founder Agent — spec reconciliation (v1.0 ↔ v2.0)

Settles where the built Founder Agent stands against the two specs in `docs/source/`
(`G4L_FounderAgent_TechSpec_v1.0.pdf`, `G4L_FounderAgent_TechSpec_v2.0_crosstenant.docx`).
Reviewed Jun 2026.

## Verdict: correctly scoped — nothing in v2.0 to build now

**v2.0 supplements v1.0; it does not replace it.** Per v2.0 §1.2, the cross-tenant admin
capabilities activate **July 1, 2027** (Stage 2 Option B pull-forward) and scale through Stage 3.
During the current stage the spec is explicit: *"the Founder Agent v1.0 ships in production for the
public tenant only. Cross-tenant capabilities are not yet built; the schema additions in §2 below are
pre-staged but unused."* This matches CLAUDE.md architecture principle #3 (multi-tenant-capable,
**dormant** at launch; don't build corporate features now). So **v2.0 is correctly deferred** — no
`tenant_id` columns, no `tenant_admin_*` tables, no admin-mode drafting at this stage.

## v1.0 — the six operating moments

v1.0 defines **six** moments: **five event-driven drafts** + **one ambient educational-layer surfacing
("library, not draft")**.

| Moment | Kind | Built? |
|---|---|---|
| Post-IDQ Welcome | draft | ✅ `lib/founder/draft.ts` (`post_idq_welcome`) |
| Retake Commentary | draft | ✅ `retake_commentary` |
| Milestone Commentary | draft | ✅ `milestone_commentary` |
| False Start Return | draft | ✅ `false_start_return` |
| Cycle 2 Welcome | draft | ✅ `cycle2_welcome` |
| **Ambient Educational Surfacing** | **library, not draft** | ⚠️ deferred — see below |

The draft engine's five moments are complete and correct. The sixth is **not a draft** — it's curated
Jay-voice content surfaced on the dashboard's educational layer (the `founder_agent_library`). The
educational layer we ship today (the **Daily Beat** panel, the **Field Guide**) covers that surface in
spirit, but **not** as a Founder-voice library attributed to Jay. Treat as a separate, deferrable build,
not a draft-engine gap.

## Governance (matches v1.0 + v2.0)

Drafts flow toward Jay; commits flow away from Jay; the agent has no second arrow. Auto-triggers fill
the review queue (`lib/founder/triggers.ts`); a human approves every send (`/admin`). The email send
rail (Resend) stays behind `RESEND_API_KEY` + `EMAIL_FROM` — nothing leaves until that's wired. v2.0
extends this same posture to cross-tenant admin (when it's built in 2027).

## Open / deferred
- **Layer 2 — Jay's writing corpus** (`founder_agent_corpus`): not wired; voice is prompt-described
  only. The biggest voice-fidelity lever when Jay provides the corpus.
- **Ambient Educational Surfacing** as a Founder-voice library: deferred (educational layer exists).
- **Cross-tenant admin (all of v2.0):** deferred to July 2027 / Stage 2–3. Do not build now.
