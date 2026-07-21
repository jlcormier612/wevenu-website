# Platform Status Snapshot

**The single, current answer to: what's complete, what remains, what's verified, and what still needs human validation.**

This is a snapshot, not a history — it reflects the platform as of the date below and gets overwritten on the next reconciliation, not appended to. For the detailed history of how the platform got here (RC1, Lead Intake, RC2, Sprint 1, Sprint 2), see `docs/release-candidate-roadmap.md` and the final report each initiative produced. For the exhaustive per-item Trust Risk Register, see `docs/trust-risk-register.md`. For a literal, run-it-yourself QA/demo checklist, see `docs/launch-verification-script.md`. For the operational (non-engineering) production validation checklist — device/browser matrix, external integrations, DNS/production config — see `docs/rc-launch-validation-runbook.md`.

**Date:** 2026-07-21 (after Sprint 2 — Vendor Certification Pass, the RC-Launch Validation Runbook pass, and the QuickBooks Online Launch Integration)

---

## What is complete

Verified — either live-database-tested this engagement, or confirmed via direct code inspection with no live browser test available in this environment (noted per item below).

| Area | Status | Verified how |
|---|---|---|
| Lead Acquisition & Intake | ✅ Complete | Live: `ingest_lead` canonical pipeline, audit trail, reactivation policy, Email Intake Engine — real inbound email → Claude extraction → Lead tested end-to-end |
| CRM / Pipeline | ✅ Complete | Live: Pipeline Templates (venue-editable stages) confirmed real this sprint, correcting a stale "fixed at 7 stages" claim. Lead-to-team assignment remains an explicit no-op hook (see below) |
| Conversations (Messaging) | ✅ Complete | Live: one Conversation object, all channels (email/SMS/portal/internal note/phone log), coordinator + couple + vendor sides, Activity Timeline, Search, Request cross-linking, vendor attachments |
| Couple Portal | ✅ Complete | Live: branding (RC1), Conversations backend swap, Seating (mobile-hardened Sprint 1), Guest List (mobile-hardened Sprint 2). Photo/document upload (`app/api/portal/upload/route.ts`) was completely broken — targeted a storage bucket that has never existed — found and fixed during the RC-Launch Validation Runbook pass, live-verified |
| Vendor Portal | ✅ Complete | Live: full Vendor Certification Pass, Sprint 2 — all 12 core workflows verified end-to-end under a real authenticated vendor session, 7 real defects found and fixed |
| Vendor Payment Visibility | ✅ Complete | Live: "what am I being paid / has it been paid" summary, built and round-trip verified Sprint 2 |
| Floor Plans (incl. Vendor Event Assets) | ✅ Complete | Live: multi-floor-plan-per-event confirmed already correct; vendor sharing built and verified Sprint 1 |
| Contracts | ✅ Complete | Live: draft/send/sign lifecycle guards, e-signature audit trail (IP/user-agent/consent), no re-open-after-signed path — all from the original Trust Foundation audit |
| Payments (venue ↔ couple) | 🟡 Mostly complete | Live: double-mark-paid guard (Sprint 2), refund/void, hard-delete guards. Real Stripe collection still design-only, blocked on credentials this environment doesn't have (TR-M1) |
| QuickBooks Online Integration | 🟡 Built, blocked on credentials | Live: OAuth connect/disconnect, Customer/Invoice/Payment/Refund one-directional push sync, retry queue with real backoff + dead-letter, connection health, sync-status badges. Every HTTP path verified against Intuit's real sandbox endpoints with fake credentials (real 401/`invalid_client` rejections correctly classified); the actual successful-sync confirmation is blocked on real Intuit sandbox credentials, same shape as TR-M1. Full detail: `docs/quickbooks-integration-completion.md` |
| Booking & Client Workspace | ✅ Complete | Carried forward from original Trust Foundation audit, unchanged since |
| Timeline | ✅ Complete | Carried forward, unchanged since |
| Requests Framework | ✅ Complete | Live: Request↔Conversation cross-linking (RC2) |
| Calendar | ✅ Complete for trust-risk purposes | Live: double-booking server-enforced, week/day views + staff visibility on the grid confirmed shipped this sprint (correcting a stale claim). iCal/webcal sync genuinely absent — see Deferred, below |
| Documents | ✅ Complete | Unchanged since original audit |
| Playbooks / Tasks / Planning | ✅ Complete | Unchanged since original audit |
| Team & Permissions | ✅ Complete | Manager Permissions Architecture Remediation, prior initiative |
| White Labeling (baseline wiring) | ✅ Complete | Live: RC1 — venue brand renders across every customer-facing surface |
| Client Identity / Portal Access | ✅ Complete | Unchanged; one documentation-clarity nuance remains (see Nice-to-have) |
| Wevenu HQ | ✅ Complete | Unchanged since original audit |
| Luv (Platform Intelligence) | ✅ Complete, for what was scoped | Unchanged since original audit |

## What remains

Nothing on the platform is currently known-unbuilt except the one item below, which is a deliberate future initiative, not an oversight.

| Item | Type | Why it's not done |
|---|---|---|
| Real Stripe payment collection (TR-M1) | Deferred, designed | Blocked on a live Stripe test-mode account this environment doesn't have. Full architecture in `docs/stripe-payment-architecture.md` |
| Real QuickBooks sync confirmation | Deferred, built | Blocked on a live Intuit sandbox app/credentials this environment doesn't have. Every other piece (OAuth, queue, error handling, idempotency queries) is built and verified against real Intuit rejections — see `docs/quickbooks-integration-completion.md` |
| iCal/webcal calendar sync | Deferred | Genuinely unbuilt; not previously scoped as a Trust Risk item |
| Lead-to-team-member assignment | Deferred | `resolveLeadOwner()` is an explicit no-op stub — the pipeline stage exists, the routing logic behind it doesn't |
| `lib/notifications/engine.ts`'s tour-reminder emails bypass Conversations | Deferred, disclosed | Sends directly via Resend; a coordinator has no record of it in the couple's thread. Named in RC2's final report, not yet actioned |
| `lead_notes`/`client_notes`/`event_notes` vs. Conversation `internal_note` overlap | Deferred, disclosed | Real future consolidation candidate, not a defect — these are single-party notes, a different shape than a conversation |

## What's verified

Everything in the "What is complete" table above was verified live against the local database — real fixtures created (never seed/demo data assumed correct), real authenticated sessions signed (venue staff, couple portal token, and critically for Sprint 2, real vendor JWTs — never the superuser CLI session, which bypasses RLS and would silently hide exactly the class of bug Sprint 2 found), real reads/writes attempted and their actual effect confirmed via a second, independent read — not just that a call returned `{ok: true}`. Every fixture was cleaned up after its test; none were left in the local database.

**Not verified — genuinely needs a human with a browser and real devices, which this environment cannot provide:**
- Anything requiring visual/interaction judgment rather than a database-observable effect (does a layout *look* right, does an animation feel smooth, does a touch target feel comfortably sized in the hand — vs. "does the underlying data operation succeed and does the CSS/breakpoint logic reason correctly about the given viewport width").
- The full Launch Verification Script (`docs/launch-verification-script.md`) — authored this sprint, never executed. This is the actual remaining gap.
- Dogfooding (Release Gate #5) — not started.
- Live SMS/email delivery through real Twilio/Resend credentials in a production-like environment (this environment tests against the real APIs in sandbox/local mode, not production credentials).

## What still needs human validation

In priority order:

1. **Run the Launch Verification Script's Verification Flow** — every checkbox, on real phone/tablet/desktop devices, as the three real user types (vendor, couple, coordinator). This is the single largest remaining gap between "verified in this environment" and "launch ready."
2. **Dogfooding** — a real person running their actual business on the platform for a real stretch of time.
3. **The Demo Flow** — a full walkthrough (lead → tour → proposal → contract → payment → planning → vendor → event → review request) as a rehearsed, presentable sequence, not just individually-working pieces.

---

## Nice-to-have / not launch-blocking

- SMS/push notification open/click tracking — confirmed absent, not implied to exist.
- Luv's Daily Briefing / full six-kind Observation Model convergence across all four Claude integrations.
- Venue-wide cross-booking Inventory ledger (currently per-booking only).
- Client Identity / Portal Access / Support Access Grants — three related but distinct vocabularies that don't cleanly cross-reference each other in documentation. Enforcement is real and tested; this is a clarity nuance, not a defect.
- Refund button not yet hidden client-side for non-Owner roles (server-side Owner-only check is the real enforcement).
