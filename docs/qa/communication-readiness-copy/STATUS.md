# Communication Readiness copy cleanup

**Status: IMPLEMENTATION — Sandbox deploy/verify pending**

| Field | Value |
|-------|--------|
| Page | `/messaging/health` (Communication Health / Readiness) |
| Source | `app/(app)/messaging/health/page.tsx` |
| Scope | Copy only — no layout/behavior/provider changes |
| Production | Untouched |

## Exact copy changes

**How to read this page** → complete-setup wording + Settings → Text messaging link inside the box; Inbox next-steps sentence updated.  
**Beneath the box** → “Email is configured…” (removed redundant per-venue texting sentence; link moved into the box).

## Tests

`npx tsx --test lib/communication/health-back-nav.test.ts` (+ related health presentation tests): **21 pass / 0 fail**.
