# Launch Blocker #2 — Phase 2 diagnosis (2026-10-14 re-audit)

**Production:** untouched  
**Code changes this pass:** none (fix already present in source + Sandbox)

## Path A — Purchaser activation

| Field | Finding |
|-------|---------|
| Root cause (original) | Activate API returned `venueId` but workspace redirected to `/login?activated=1` without a trusted handoff; `B_keep_valid` kept the prior venue (e.g. Sally / Fancy) |
| Files | `workspace/app/activate/actions.ts` → `productPostActivationLoginUrl`; `app/api/internal/enrollment/activate/route.ts` → `createPurchaseOnboardingHandoff`; `lib/venue/active-context.ts` → `consumeOnboardingHandoff` before classification |
| Duplicate venues? | No — membership created correctly; defect was active-context selection |
| Minimum correction | One-time `venue_onboarding_handoffs` row (service-role create; auth consume) then `set_active_venue` — **already shipped** in `20261412900000_…` + activate route |
| Ordinary multi-venue | `B_keep_valid` unchanged when no pending handoff |

## Path B — Invitation under wrong email

| Field | Finding |
|-------|---------|
| Root cause (original) | `20261405300000` replaced `accept_team_invitation` and dropped TR-G7 email match; Fancy session could bind as Owner |
| Files | `supabase/migrations/20261412900000_invite_identity_and_onboarding_handoff.sql` (restored match + sets active venue); `app/join/page.tsx` (`email_mismatch` → Wrong account); `lib/team/service.ts` (`setActiveVenue` after accept) |
| Authorization risk | Critical when unfixed; **mitigated** — live RPC returns `email_mismatch` |
| Sandbox Juniper | Owner = purchaser `6721694e…`; Fancy Juniper memberships = **0**; yahoo owner invite still pending |

## Existing coverage

- `lib/team/invite-identity.test.ts`, `lib/venue/onboarding-handoff.test.ts`, `lib/auth/post-activation-login.test.ts`, active-context + multi-venue integrity — **54/54 PASS** this pass
- Prior E2E closeout: `STATUS.md` (2026-10-06)
- This pass re-proof: `verify-sandbox-state.mts`, `verify-browser.mts` on serving `2bfe4cde`

## Decision

No additional product code required. Close on re-proof evidence against current Sandbox serving SHA.
