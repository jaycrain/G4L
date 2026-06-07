# G4L Platform — Architecture (as built)

What's running today, end to end. Solid boxes are **built and deployed**; dashed boxes are
**planned / not yet wired**. View this on GitHub (it renders the diagram), or paste the
Mermaid block into <https://mermaid.live> to export a PNG for a deck.

```mermaid
flowchart TD
  Member(["Member"]):::person
  Jay(["Jay (operator)"]):::person

  subgraph SURF["Surfaces — Next.js on Vercel"]
    Landing["Landing"]
    Onb["Onboarding (conversation)"]
    IDQ["IDQ (conversation)"]
    Dash["Dashboard: ID Score, current focus, program, Reclaim List"]
    Bubble["Member Agent bubble (always-on check-in)"]
    Asset["Asset screen (generic renderer)"]
    Admin["Admin Review UI (/admin: queue, search)"]
  end

  Member --> Landing --> Onb --> IDQ --> Dash
  Dash --> Asset --> Dash
  Dash -.->|opens| Bubble
  Jay --> Admin

  subgraph AG["AI Agents"]
    MA["Member Agent (G4L voice)"]:::agent
    FA["Founder Agent (Jay's voice, review-before-send)"]:::agent
  end
  Onb --> MA
  Bubble --> MA
  Admin --> FA

  subgraph ENG["Domain engines — lib/"]
    Gov["Governance: AI disclosure, 988 crisis, no-diagnosis, no bare score"]
    Flow["Gateway flow: onboarding, IDQ submit, dashboard read"]
    Score["IDQ scoring (0-100, no bands)"]
    Dose["Dosing v1 (current focus)"]
    AssetEng["Asset engine: versioned content, gating config, A/B variants, telemetry"]
    Draft["Founder draft engine + review queue"]
  end
  MA --> Gov
  MA --> Flow
  IDQ --> Score
  Dash --> Flow
  Dash --> Dose
  Asset --> AssetEng
  FA --> Draft
  FA --> Gov

  Prov["Provider abstraction"]:::ai
  Claude["Anthropic Claude (live)"]:::ai
  Scripted["Scripted fallback"]:::ai
  MA --> Prov
  FA --> Prov
  Prov --> Claude
  Prov -.->|degrades to| Scripted

  subgraph DB["Data — Supabase Postgres (RLS-ready)"]
    MP["member_profile"]:::data
    IR["idq_retake"]:::data
    AC["asset_completion"]:::data
    AE["asset_event (telemetry)"]:::data
    FD["founder_agent_drafts"]:::data
    REF["door, idq_dimension, atlas_asset (reference)"]:::data
  end
  Flow --> MP
  Flow --> IR
  Score --> REF
  AssetEng --> AC
  AssetEng --> AE
  Draft --> FD

  GH["GitHub jaycrain/G4L"]:::ext --> Vercel["Vercel (auto-deploy)"]:::ext --> SURF

  FA -.->|planned send| HubSpot["HubSpot email / SMS"]:::planned
  SURF -.->|planned| Integ["Circle, Tovuti, Stripe"]:::planned
  DB -.->|planned Path B| Auth["Supabase Auth + RLS + consent"]:::planned

  classDef person fill:#374F63,color:#fff,stroke:#101045
  classDef agent fill:#EC6233,color:#fff,stroke:#BB2127
  classDef ai fill:#3B9495,color:#fff,stroke:#101045
  classDef data fill:#919536,color:#fff,stroke:#101045
  classDef ext fill:#101045,color:#fff
  classDef planned fill:#E8E6E6,color:#2A2A2A,stroke-dasharray:4 4
```

## How to read it
- **Two agents, two voices.** The **Member Agent** (G4L voice) powers onboarding and the
  always-on check-in bubble. The **Founder Agent** (Jay's voice) drafts correspondence for the
  admin review queue and never sends on its own.
- **Surfaces are thin; engines do the work.** Each screen calls framework-free engines in
  `lib/` (scoring, governance, gateway flow, dosing, asset engine, founder drafting), which is
  what makes the logic testable (53 passing tests) and portable.
- **One provider abstraction, graceful fallback.** Both agents talk to Anthropic Claude through
  one layer; if Claude is unreachable, they degrade to a scripted voice instead of failing.
- **One data layer, two backends.** The same SQL runs on local Postgres (pglite) in dev and
  hosted Supabase in production, selected by `DATABASE_URL`.
- **Governance is cross-cutting**, not a feature: AI disclosure, 988 crisis routing, no
  diagnosis, no bare score, and review-before-send on the Founder Agent.

## Built vs planned
- **Built & live:** all solid boxes — both agents, all member surfaces, the asset engine,
  the admin Review UI, telemetry, Supabase, Vercel auto-deploy.
- **Planned (dashed):** the HubSpot send rail, the Circle/Tovuti/Stripe integrations, and the
  Path-B security layer (Supabase Auth + row-level security + consent) required before real
  members. Multi-tenant (corporate instances) is architected-for but dormant.
