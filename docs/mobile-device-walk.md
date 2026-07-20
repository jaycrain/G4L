# Mobile device-walk checklist

The PWA responsive layer (`MOBILE` flag) is built + flag-dark on prod. Everything so far was verified in a **375px
browser viewport with pointer emulation** — good enough to prove logic + layout, but three classes of thing only a real
phone can settle: **touch feel** (sheet drag/snap), **iOS Safari quirks** (input-zoom, safe-area insets, fixed-overlay
clipping), and the **ceremony-gated hand-offs** (the rhythm beat fires only after a real Reconnect completion). This is
the walk that closes those.

Owner: Jay. Do it on an actual iPhone (Safari) — that's the strict case; Android/Chrome is easier and secondary.

---

## 0. Turn it on (pick one)

- **On a Vercel Preview:** set `MOBILE=staged` in the branch/Preview environment's env vars, redeploy, open the Preview
  URL on your phone. (It also wants the other staged flags already on Preview — `REDESIGN`, `REBUILD`, `RECLAIM`,
  `OUTREACH` — so the states have data to render.)
- **Local, over your LAN:** `next dev` already has `MOBILE=staged` in `.env.local`. Run it bound to your machine's IP
  and hit `http://<your-mac-ip>:3100` from the phone on the same Wi-Fi.

The mobile surface only renders **≤1000px** — a phone naturally, or DevTools device mode for a desk re-check. Above that
you get the desktop v3.0 surface unchanged.

> **iOS cache note:** if a change doesn't show, it's almost always the dev service worker serving stale CSS. On the
> phone: Safari → open in a **Private tab** (no SW), or Settings → Safari → Clear History and Website Data. (This bit us
> repeatedly in browser verification — see the `dev-pwa-service-worker-caches-css` note.)

---

## 1. The billboard home — `/dashboard/[memberId]`

The conversation-first navy billboard is the phone home. It flexes into 8 states; you won't hit all of them in one
account, so eyeball the ones your test members land in (resume / practice / quiet are the common ones; milestone needs a
just-finished ceremony).

- [ ] **Billboard type** reads as the signature all-caps headline (Barlow **Condensed**, heavy) — not the body Barlow.
      If it looks like normal-width bold, the condensed font didn't load.
- [ ] **Kicker · headline · sub · CTA pill** stack cleanly; the CTA pill only appears on the action states
      (resume / checkpoint / practice / milestone), never on the reflective ones (morning / noticed / reengage / quiet).
- [ ] The **shared thread + composer** below the billboard is the *same* check-in conversation as the desktop rail —
      type a line, it should land and persist.
- [ ] **"Go to Dashboard ↓"** slides the cover up and reveals the real dashboard beneath; the **"Talk to me"** pill
      brings the cover back.
- [ ] **Tap targets** (pill, composer send, Go-to-Dashboard) are comfortably thumb-sized.
- [ ] **Safe-area:** nothing tucks under the notch or the home-bar; the billboard top and composer bottom clear the
      insets.

### Milestone one-shot (new this pass)
If a test member **just finished a phase ceremony** (earned a ceremonial badge within ~20h), the home shows the
**"You kept your word."** milestone billboard.
- [ ] It greets **once**. Tap its "See your badges →" or "Go to Dashboard ↓", then reload `/dashboard/[memberId]` —
      it should **not** re-greet; you should get your real next-action state instead. (Before this pass it re-showed on
      every load for 20h and masked the actionable state.)

---

## 2. The session workspace bottom-sheet — `/workspace/[memberId]/[sessionKey]`

Session keys: `w1 w2 w3 rewire-checkpoint · b1 b2 b3 b4 · c1 c2 c3 c4 · reconnect`. Use one your member can open
(e.g. `b1`). The canvas (the artifact) fills; the Companion is a bottom-sheet.

- [ ] On load the sheet is **closed** — you see the canvas first (wayfinding + artifact), with a pulsing **"Talk to me"**
      FAB bottom-right.
- [ ] Tap the FAB → sheet rises to **open** (full conversation).
- [ ] **Drag the grabber down** — the sheet should **follow your finger** live (no lag/jump), and on release **snap** to
      the nearest of open / peek / closed.
- [ ] **Peek** detent: the sheet rests low so the **canvas is admirable** (watch your committed words on the artifact)
      while a strip of conversation stays docked. → **This peek height (150px) and the snap thresholds are the main thing
      to judge on-device — tell me if peek should show more/less, or snap feels sticky/loose.**
- [ ] **Tap** (not drag) the grabber also cycles open → peek → closed as a fallback.
- [ ] At **closed**, the FAB returns.
- [ ] **iOS input zoom:** tap the composer — the page must **not** zoom in (inputs are ≥16px on purpose). If it zooms,
      the fixed sheet will clip on the right edge — that's the bug to catch.
- [ ] Reclaim sessions (`c1`…) show a **warm/orange** FAB accent; Rewire/Rebuild (`w`/`b`) stay teal.

---

## 3. The rhythm beat — end of Reconnect (auto), or `/rhythm/[memberId]`

This is the one that needs a **real Reconnect completion** to see in context (it's gated on the ceremony crossing).

- [ ] Walk a fresh member through Reconnect to the **ceremony**; tap **"Get Rewired →"**. On mobile it should hand to
      the **rhythm-setting beat** (navy guided moment) *before* the dashboard — sequence: **ceremony → rhythm → dashboard**.
- [ ] The beat shows the **4-phase road map** (current phase lit), **4 rhythm options** (few-times-a-week suggested),
      reassurance copy, and a confirm.
- [ ] Confirm → it saves your cadence and lands you on the dashboard.
- [ ] Direct-load `/rhythm/[memberId]` for a member who's **past** Reconnect (or with `MOBILE` off) → it should bounce
      straight to the dashboard (the eligibility guard).

---

## 4. The account dial — `/account`

- [ ] The **notification / "how I show up"** card renders: rhythm radios, channel toggles (**in-app = Always on**,
      push/email/sms consent-off), editable quiet-hours.
- [ ] Change the rhythm → it saves optimistically and **persists across a reload**.
- [ ] Inputs are ≥16px (no zoom on focus).

---

## What's already proven vs. what this walk is for

**Proven in-browser (don't need to re-check unless something looks off):** all 8 home-state resolutions + copy; the
sheet's three detents compute to the right positions; tap-cycle and live-follow drag + snap logic; the milestone
one-shot marker (unit + pglite tested); the rhythm hand-off wiring (tsc + route guard).

**Only a real phone settles these — this walk's real job:**
1. **Touch feel** — sheet drag smoothness, peek height, snap thresholds (§2). Most likely to need a tuning pass.
2. **iOS Safari** — input-zoom, safe-area insets, fixed-overlay clipping, condensed-font load (§1, §2, §4).
3. **Ceremony-gated hand-off** — the rhythm beat in real end-of-Reconnect context (§3).

Bring back anything that feels off and I'll tune it — it's all still `MOBILE`-dark on prod, so there's no clock.
