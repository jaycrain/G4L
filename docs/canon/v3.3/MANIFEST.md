# Canon — v3.3

**Stamp:** `v3.3 · app @ 320bec4`

Published by `scripts/publish-canon.mjs`. The destination is this repository, not a shared drive: a commit
either contains every part or it does not, so a bundle can never again look complete while missing its
contents. Verify the checksums below before you start — if any row does not match, stop and say so.

## Parts

| Part | Bytes | sha256 (16) | What it is |
| :-- | --: | :-- | :-- |
| `member-transcript.md` | 74,313 | `b059a7800c96ff23` | clean authored copy, reading order. **QUOTE FROM THIS.** |
| `CHANGES.md` | 3,622 | `945f5b4316486578` | what the authored copy ADDED / REMOVED since the previous version. **START HERE.** |
| `sync-note.md` | 7,130 | `d684ea51b05c3053` | the Marketing Alignment Brief — what changed in voice / naming / story / function. |
| `voice-rules.md` | 15,059 | `318d9b69948035d9` | the brand + voice doc governing the DYNAMIC (model-generated) Companion copy. Describe, don't quote. |
| `founder-emails.md` | 9,969 | `ea5c38195902b7ed` | the Founder Agent's drafted messages. Samples are quotable; live drafts vary. Never auto-sent. |
| `member-facing-strings.txt` | 504,619 | `729ad42098efd0dc` | full raw dump, traceability backstop. **Do NOT quote** — contains system/model-instruction strings. |
| `screenshots/` | 12 files | — | key member surfaces at 1440px |

## Read in this order

1. `sync-note.md` — what changed and why.
2. `CHANGES.md` — the exact authored lines added and removed. This is the reconciliation list.
3. `member-transcript.md` — only if you need surrounding context for a changed line.

## Quotability

- Authored copy (transcript, assessment items, UI, badges) is fixed → **quote verbatim**.
- Model-generated copy varies per member → **never quote as canonical; describe by the voice rules**.
- The Quality Day elements are the member's OWN words → dynamic, describe only.
