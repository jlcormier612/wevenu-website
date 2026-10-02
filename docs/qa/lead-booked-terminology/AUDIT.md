# Lead → Booked terminology + invoice back-nav — Forensic Audit

**Date:** 2026-10-02  
**Scope:** Human-facing Lead → Booked → Client journey and invoice-detail back navigation. Do not redesign bookClient / Client / Event model.

## 1. "Return to Booked" on Lead detail

| Item | Finding |
|------|---------|
| Component | `components/leads/lead-detail.tsx` |
| Visibility | `previouslyConverted && (relationshipCancelled \|\| (!isBookingStarted && currentStage !== "lost"))` where `previouslyConverted = !!lead.linkedClientId` |
| Why it appears | Lead already has a linked client (Start booking file / commercial path) but `sales_stage` is not `booked` |
| Handler | `returnLeadToBookedAction` → `returnLeadToBooked` → **`bookClient(..., source: "manual")`** |
| After success | Hard `window.location.assign` to `/clients/{id}/booked` when newlyBooked |

**Verdict:** Mislabel. Action IS Mark as Booked. Renamed + land in Client workspace. **Done.**

## 2. "Open booking file →"

| Item | Finding |
|------|---------|
| Visibility | Any lead with `linkedClientId` |
| Destination | Plain `<Link href={`/clients/${lead.linkedClientId}`}>` |
| Distinct workflow? | **No.** Same Client workspace. |

**Verdict:** Removed from Lead action area. **Done.**

## 3. Related labels (leave)

| Surface | Label | Keep? |
|---------|-------|-------|
| Pipeline board / stage move | "Mark as Booked" | Yes — already correct |
| Lead, never converted | "Start booking file" | Distinct workspace-prep (creates client **without** Booked). Not the Booked decision. Left; not a competing destination after Booked. |
| Event detail (cancelled) | "Return to Booked" | Distinct reinstatement of a cancelled booked event via `returnClientToBooked`. Left. |

## 4. Invoice / payment-detail back nav

| Item | Finding |
|------|---------|
| Resolver | `resolveInvoiceBackNavigation` already labeled Lead / Client / Invoices **when `returnTo` is present** |
| Why Lead payment showed "← Invoices" | Setup + Open invoice from the Lead booking journey **did not pass `returnTo`**. Fallback was always `/invoices`. |
| Smoking guns | `setup-payments-sheet.tsx` `router.push(/invoices/{id})`; `commercial-facts.tsx` `<Link href=/invoices/{id}>` |
| Contract analog | Contract detail already falls back: unbooked + leadId → Lead; booked → Client |

**Verdict:** Preserve origin on Lead/Client invoice hops. Add the same unbooked/booked fallback as contracts. Do not globally rewrite every "← Invoices" — global list keeps `returnTo=/invoices`.

## 5. Payment nav (must not regress)

- FE not Booked → Lead `?setupPayments=1#booking-journey-payments`
- Booked → `/clients/{id}?setupPayments=1`
- Invoice back: unbooked → Lead; booked → Client; global list → Invoices
