# Deploying G4L — Path A (private preview, fake data)

A shareable preview on the spec'd stack (Next.js on Vercel + Supabase Postgres). This is for
**demos with seeded fake data** — NOT real members. Real members need Path B (auth, RLS,
consent, crisis escalation, server sessions) and a security review. See the chat history / the
"Where do I access it" + deploy discussion.

> Local dev is unchanged: no `DATABASE_URL` → the app uses local pglite. Setting `DATABASE_URL`
> switches it to hosted Postgres. Same code, same schema.

## 0. Accounts (you create these — billing is yours)
- **GitHub** (free) — ideally a GitHub *Organization* (e.g. `grintaforlife`) owning the repo.
- **Supabase** (free tier is fine for the demo).
- **Vercel** (Hobby is fine for a *private* demo; Pro when commercial).
Turn on **2FA** everywhere; use a company email; set **spend caps/alerts**.

## 1. Push the code to GitHub
```bash
cd ~/g4l-platform
git remote add origin https://github.com/<org>/g4l-platform.git
git push -u origin main
```

## 2. Create the Supabase project + apply the schema
1. Create a project (US region). Copy the **pooler** connection string
   (Project Settings → Database → Connection string → "Transaction" / port 6543).
2. Apply migrations + seed (the 8 Doors, 4 dimensions, 12 assets):
   ```bash
   DATABASE_URL='postgresql://postgres.<ref>:<pw>@<region>.pooler.supabase.com:6543/postgres' \
   PATH="$HOME/.local/bin:$PATH" npm run db:migrate
   ```
3. (Optional) Seed clearly-fake demo members so the preview isn't empty:
   ```bash
   DATABASE_URL='...' PATH="$HOME/.local/bin:$PATH" npm run db:seed-demo
   ```

## 3. Deploy to Vercel
1. Vercel → **Add New → Project** → import the GitHub repo. It auto-detects Next.js.
2. Set **Environment Variables** (Production + Preview):
   - `DATABASE_URL` — the Supabase pooler string (secret)
   - `ANTHROPIC_API_KEY` — your key (secret)
   - `ANTHROPIC_MODEL` — `claude-sonnet-4-6`
3. **Deploy.** Every `git push` redeploys; each branch gets a preview URL.

## 4. Use it
- Visit the Vercel URL → the live preview. Onboard → IDQ → dashboard, with live Claude.
- A demo member's dashboard is at `/dashboard/<memberId>` (printed by `db:seed-demo`).

## Post-deploy smoke test (`npm run smoke`)

A Playwright check that logs into a **demo** account through the real `/login` form against a
target URL and asserts the member-facing pages render (dashboard "The Program" panel, `/program`,
`/field-guide`, no 5xx). It exits non-zero on failure — drop it into CI as a post-deploy gate.

**Guardrails baked in:** demo-only (refuses any non-`.test` account), the real login path (no
bypass, no extra product endpoint), and the demo password lives in a secret — never committed,
never logged. Senior-engineer review required before pointing it at a DB that holds real members.

**One-time setup (needs the target DB — you run this, it stays with your prod creds):**
```bash
# against local pglite (no DATABASE_URL) or hosted (DATABASE_URL=<pooler string>)
SMOKE_EMAIL='demo-tom@grintaforlife.test' SMOKE_PASSWORD='<pick a strong one>' \
  npm run db:set-demo-password
```
Store that `SMOKE_PASSWORD` as a secret (and `SMOKE_EMAIL`). For live, the demo member must exist
in that DB first (`db:seed-demo`).

**Run it (needs only the demo login + a URL — never the DB creds):**
```bash
SMOKE_EMAIL='demo-tom@grintaforlife.test' SMOKE_PASSWORD='<the secret>' \
  npm run smoke -- https://g4l-ten.vercel.app      # or http://localhost:3100, or a branch preview URL
```

## Notes / guardrails
- **No login yet** — anyone with a `/dashboard/<uuid>` link sees that profile. Fine for fake
  data; do NOT put real members here until Path B.
- Keep **demo and production as separate Supabase projects** so fake data never mixes with real.
- `next build` is verified to pass locally, so Vercel builds the same way.
- Secrets live only in Vercel's env settings and your local `.env.local` — never in the repo.
