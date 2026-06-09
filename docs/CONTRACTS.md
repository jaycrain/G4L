# G4L — Locked Contracts

The single source of truth for the values the build depends on. Every one is settled
across the Decision Log v1.3, the Authoring Brief v1.3, the AI Governance Framework v2.0,
and Jay's direct confirmation. **Build to this file.** Where a tech spec disagrees, this
file wins and the spec note says why (most conflicts are pre–"May 2026 cascade" leftovers).

> Provenance is named per row so the fractional architect can audit. When something here
> changes, update this file in the same PR and note it in the Decision Log.

---

## 1. The IDQ (Identity Distance Questionnaire) — FROZEN

- **24 items, 4 dimensions, 6 items per dimension.** Likert 1–5 per item.
- **The four dimensions (locked, May 2026 cascade):**

  | Dimension | Anchoring | Retired pre-cascade name |
  |-----------|-----------|--------------------------|
  | **Physical** | Lorig & Holman self-management | — |
  | **Self**     | SDT autonomy | "Identity" |
  | **Social**   | SDT relatedness | "Relational" |
  | **Outlook**  | SDT competence + intrinsic motivation | "Forward" |

- **Cadence:** retaken every **60 days**. Baseline = `sequence_no 0`.
- ⚠️ Member Agent Tech Spec v1.1 prose still says *Physical/Identity/Relational/Forward*.
  That naming is **stale** — use Physical/Self/Social/Outlook everywhere.
- The instrument items themselves are **G4L-native, authored from self-discrepancy theory**.
  The *structure and scoring below are locked.* The **24 second-person item stems (voice rewrite v1)
  are now in the build** (`lib/idq/instrument.ts`, each mapped 1:1 to its original validated item
  number) and ship for the live onboarding check — they carry **Greg's validation pass** (the
  science underneath is untouched; this is the voice layer on top).

## 2. ID Score — scoring math (locked; pending Greg's final scientific sign-off)

- Per-dimension raw = sum of its 6 items → **6–30** (the simplified scale is written as 0–30).
- **ID Score raw = sum of the four dimensions = 24–120** (written as 0–120).
- **ID Score (member-facing headline) = raw normalized to 0–100** = `(raw / 120) × 100`.
- **Bands are RETIRED.** There is no Starting Line / Fade / Drifting / In Flow *as score bands*.
  Movement is shown as **direction arrow + signed delta + the raw/normalized number**.
  ⚠️ Note: "**the Fade**" is reused (voice rewrite v1) as the name for the **identity-distance
  concept** the IDQ measures — NOT a score band. The retired thing is the *band* called Fade.
- ⚠️ Two stale-language traps to scrub when we touch those docs:
  - MA v1.1 schema says dimension scores are "0–25" — **wrong**, it's 0–30.
  - MA v1.1 prompt slices *and* **AI Governance v2.0 prohibition #2** still say "never reveal
    the score without a **band label**." Post-cascade the rule is: never a bare number —
    always with delta/direction + plain-language human context. No bands.
- Open nuance for Greg: with Likert 1–5 the true floor is 24 raw (not 0), so normalized
  floor is ~20, not 0. Confirm whether to keep the simple 0–100 normalization or re-base.
  *(Authoring Brief v1.3, Q5.)* The schema stores raw responses so any re-norm is non-breaking.

## 3. The 8 Doors — LOCKED to the pitch deck (Jay confirmed)

Identity loss accumulates through "doors that open, then close behind you." The canonical eight:

| slug | Display name | Descriptor |
|------|--------------|------------|
| `career_cliff` | The Career Cliff | The role that ended, plateaued, or a retirement that became a freefall. |
| `aging_parents` | The Aging Parents | The role reversal that makes you a primary caregiver. |
| `empty_nest`    | The Empty Nest | The house that got quiet when the kids left. |
| `vanishing`     | The Vanishing | The friendships that quietly disappeared. |
| `body`          | The Body | The body that started saying no to what it used to do easily. |
| `diagnosis`     | The Diagnosis | The mirror moment you couldn't avoid. |
| `marriage`      | The Marriage | The drift from partnership into coexistence. |
| `loss`          | The Loss | The death of someone close that changed everything. |

⚠️ MA v1.1 lists a different set (splits "The Career" and "The Cliff", omits "The Vanishing").
**Stale — ignore it.** Use these eight.

## 4. Program topology — NOT linear phases (Decision Log Jun 9 '26)

- **Reconnect** = a short **gateway** (hours to ~a week). The awareness moment, not a phase.
- **Rewire** (mind: habits) and **Rebuild** (body: movement, nutrition, sleep) run **in
  parallel, dosed per member** by IDQ subscores + the agent. Not a pipeline; either order;
  some members need mostly one.
- **Reclaim** = an **outcome state** ("The Loop"), temporary by design. **No fixed cycle
  length.** A member can reach it early; the program must recognize it (IDQ signal or
  member-declared).
- The dashboard shows **"current focus," never "phase."**
- The 4Rs remain the **organizing structure for assets** (below), not a member progression.
- ⚠️ FA v1.0's "Foundation / Rebuild / Sustain" phase names are **stale** — do not use.
- The 360-day cycle is **retired as program law**.

## 5. The Atlas — 12 gated assets (MVP scope, LOCKED) + 28 total

The full Atlas is 28 assets; the **12 gated assets** are launch scope. The other 16 are
Depth-tier companions, post-launch. Assets are **versioned content delivered by an asset
engine** — never hardcoded screens. Gating/dosing rules are **config** (Greg owns them).

| Code | Asset | 4R group | Layer |
|------|-------|----------|-------|
| R-1 | IDQ | Reconnect | Recognition |
| R-4 | Identity Excavation | Reconnect | Excavation |
| R-6 | Window Exercise | Reconnect | Spark |
| W-1 | Disinformation Audit | Rewire | Awareness |
| W-3 | Visualization Workshop | Rewire | Visualization |
| W-5 | False Start Protocol | Rewire | Hardiness |
| B-1 | First Step Assessment | Rebuild | — |
| B-3 | First 1,000 Miles | Rebuild | — |
| B-5 | Fuel Plan | Rebuild | — |
| C-1 | Reclaim Readiness Assessment | Reclaim | — |
| C-3 | Adventure Planning Worksheet | Reclaim | — |
| C-5 | Your Success Story | Reclaim | — |

- **Reconnect A/B variant test** runs in Feasibility (Excavation+Window vs Doors+adapted S-DS
  Spark). The asset engine must support variants + per-variant telemetry.
- **First 1,000 Miles (B-3)** is a gated Rebuild-track asset *but* the standalone tracking
  subsystem is **optional and post-launch** — not a universal progress gate.

## 6. Reconnect required outputs — data contract (every variant)

Regardless of which Reconnect variant wins, Reconnect must produce:
- **The Reclaim List** — **at least 3 items** (member-stated), no maximum. The agent gently
  aims for a soft target of ~7 but never forces a count. *(Voice rewrite v1, Jun 2026 — superseded
  the earlier "exactly 7" rule, which is flagged to Greg.)*
- **The member's Door(s)** — **one or more** of the 8 above. Stored as a set (`member_door`);
  `member_profile.named_door` holds the primary for single-value reads.
- **The baseline ID Score.**

These feed the dashboard hero, First Step (B-1), and the Member Agent's routing.

The reclaimed identity is stored as a bare noun and rendered in **natural case** ("the Athlete",
never "THE ATHLETE"). **The Fade** is the named concept for the identity distance the IDQ measures;
**the Door** is the life event that opened it — both are canonical vocabulary.

## 7. Telemetry — capture from day one (internal QI, no IRB dependency)

Required events per asset: **started · completed · time-on-asset · drop-off point.**
These are the implementation-outcome measures. Product telemetry is internal QI; research
data is separate and consented (activates at IRB approval, post-launch).

## 8. AI Governance — non-negotiables enforced in code (Framework v2.0)

First 9 apply to the MVP (single-tenant). #10–12 are multi-tenant (P3, dormant at launch).
The Member Agent **never**:
1. Diagnoses, labels, or pathologizes.
2. Gives an ID Score as a bare number — always with delta/direction + plain-language human
   context. *(Framework text still says "band label"; bands are retired — see §2.)*
3. Addresses a mental-health disclosure directly → routes to **988** (US) + escalates to a
   human within 24h. Crisis routing is **always on, from v1**.
4. Suggests programs, tiers, upgrades, or commercial offerings.
5. Operates outside the G4L voice + 4Rs framework.
6. Substitutes for human coaching at the Direct tier.
7. Stores/references anything beyond explicit consent.
8. Continues after a member signals stop.
9. (Founder Agent) Sends in Jay's name without review — **no send tool exists.** *(FA is P3.)*

Plus, always: **AI disclosure is the literal first line** of the first conversation
(verbatim text in the Framework); **Independence Guarantee** — a paper protocol exists for
every gating asset, the agent is a service not a requirement, never penalized for opting out.

Data: explicit consent · minimum necessary · product/research data separated · **no model
training on member data** (Anthropic API configured to honor) · retain membership + 12 months,
delete within 30 days of request · breach notice within 72h.

Positioning: **"Personal AI for Human Flourishing"** (VanderWeele / Harvard tradition) —
optimize for the four IDQ dimensions, not app engagement.

## 9. Stack — reference architecture (Tech Specs, Appendix C v1.3)

- **Next.js on Vercel** (web app + hosting)
- **Supabase** — Postgres + Auth + Storage + Realtime; **pgvector** for RAG; **row-level
  security** as the data-governance enforcement layer
- **Anthropic API** (Claude) for both agents, behind a **provider-abstraction layer** (hedge)
- **HubSpot** — CRM relationship spine + transactional email rail
- Integrations (not rebuilds): **Circle** (community), **Tovuti** (LMS), **Stripe** (payments),
  **Typeform** (acceptable interim surface for IDQ/intake before the conversational version)
- Deviations from this reference require written justification; **Jay approves all deviations.**

## 10. Multi-tenant — capable, dormant at launch (CLAUDE.md principle 3)

Build the **row-level-isolation foundation** (a `tenant_id` on member-scoped tables, default
`'public'`) so a private company instance can be switched on later — but **do not build
corporate/tenant-admin features now.** The full multi-tenant + Founder Agent layer is **P3**.

## 11. Dates (Decision Log Jun 9 '26)

- **Charter MVP — October 2026** (the 12 gated assets live; first IDQ retakes Dec '26).
- **Paid public launch — January 1, 2027** (into resolution season). Billing live by Dec '26.
- Companions + First-1,000-Miles subsystem + Founder Agent + multi-tenant: **post-launch.**
- ⚠️ The pitch deck's "Full v1 Apr 30 2027" is **superseded** by the above.
