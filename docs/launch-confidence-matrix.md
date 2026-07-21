# Launch Confidence Matrix

A concrete record of what has actually been exercised, not what we think is done. Update this after every future initiative that touches a listed area — that's what makes it useful for spotting regressions later: if an area that was ✅ Live Tested regresses, that's a real signal, not a guess.

**Legend**
- **Built** — the capability exists in code, verified by direct inspection.
- **Live Tested** — exercised against the real local database with a real authenticated session (venue staff, vendor JWT, or portal token) and a real observed effect — not just "the RPC returned ok:true."
- **Mobile Tested** — audited by reading the actual layout code and reasoning through phone/tablet viewport behavior (no physical device available in this environment). This is **not** the same as a human on a real phone — see `docs/launch-verification-script.md` for the step that closes that gap.
- **N/A** — not a mobile-relevant surface (e.g., a backend-only pipeline).

| Area | Built | Live Tested | Mobile Tested | Notes |
|---|:---:|:---:|:---:|---|
| Lead Intake | ✅ | ✅ | N/A | Canonical `ingest_lead` pipeline, audit trail, Email Intake Engine — real inbound email tested end-to-end |
| CRM / Pipeline | ✅ | ✅ | 🟡 Audited | Pipeline Templates confirmed real this sprint (corrected a stale "still fixed at 7 stages" claim); board layout not separately mobile-audited |
| Conversations (Messaging) | ✅ | ✅ | 🟡 Audited | All channels, all three sides (coordinator/couple/vendor); attachment compose bar mobile-audited Sprint 2, clean |
| Couple Portal — Guest List | ✅ | ✅ | ✅ Fixed | Row action menu crushed at phone width, found and fixed Sprint 2 (collapsed into a dropdown) |
| Couple Portal — Seating | ✅ | ✅ | ✅ Fixed | Fixed-width sidebar crushed the canvas at phone width, found and fixed Sprint 1 |
| Couple Portal — other tabs (Payments, Documents, Timeline) | ✅ | 🟡 Partial | 🟡 Audited | Broadly audited Sprint 2, no breaks found; not individually live-write-tested this engagement |
| Vendor Portal — all 12 core workflows | ✅ | ✅ | 🟡 Audited | Full Vendor Certification Pass, Sprint 2 — every workflow live-tested under a real vendor session; 7 real defects found and fixed. Tasks-tab Add form mobile break found and fixed |
| Vendor Payment Visibility | ✅ | ✅ | N/A | New Sprint 2 — full round trip (venue sets fee → vendor sees it → venue marks paid → vendor sees update) live-verified |
| Floor Plans (incl. Vendor Event Assets) | ✅ | ✅ | N/A (SVG canvas, scales) | Multi-floor-plan-per-event confirmed correct; vendor sharing built + live-verified Sprint 1 |
| Contracts | ✅ | ✅ | ❌ Not checked | Lifecycle guards + e-signature audit trail verified live in the original Trust Foundation audit; no mobile-specific pass run |
| Payments (venue ↔ couple) | 🟡 | ✅ | 🟡 Audited | Double-mark-paid guard added Sprint 2; real Stripe collection still design-only (blocked on credentials); list view confirmed "usable but rough" on mobile (horizontal scroll, not broken) |
| Calendar | ✅ | 🟡 Partial | 🟡 Audited | Double-booking server-enforced (live-tested, prior initiative); week/day views + staff visibility confirmed shipped Sprint 2 (corrected a stale claim); month grid mobile-audited, cramped but standard, not broken |
| Documents | ✅ | 🟡 Partial | ❌ Not checked | Unchanged since original audit |
| Requests / Search / Activity Timeline | ✅ | ✅ | ❌ Not checked | RC2 — Conversations + Requests in global search, cross-linking, live-verified |
| Automations | ✅ | ✅ | N/A | Event.Completed review/referral nudge — real end-to-end trigger test, disabled-by-default confirmed |
| White Labeling | ✅ | ✅ | ❌ Not checked | RC1 — venue brand rendering confirmed across every named customer-facing surface |
| Trust Foundation (Program 1) | ✅ | ✅ | N/A | Every bounded Trust Risk Register item resolved as of Sprint 2 (TR-M4/B2/B3); TR-M1 externally blocked |
| Reporting / Analytics | ✅ | 🟡 Partial | ❌ Not checked | Unchanged since original audit; not re-verified this engagement |

## What this matrix does not cover

Nothing here substitutes for `docs/launch-verification-script.md`'s Verification Flow — that's the step where a real person on a real device turns every "🟡 Audited" and "❌ Not checked" cell above into a genuine pass or fail. This matrix records engineering-verifiable state; the script records human-verifiable state. Both are needed before launch.
