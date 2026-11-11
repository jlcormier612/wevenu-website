# Event Order — Fixed Order vs Client-Selection Routing

**Phase 1 forensic audit (read-only).**  
**Date:** 2026-10-22  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**HEAD:** `4a2b23b3`  
**Sandbox serving:** `htc-sandbox-venue-app:4a2b23b32655af4fad5a1919ec8e6f28aca54c8d`  
**Production:** untouched  

Unrelated dirty work preserved (includes uncommitted layout tweaks in `event-order-template-list.tsx` / `event-task-list.tsx` and many QA artifacts).

---

## Reproduction

Library → Event Order Templates → card for a fixed-only template (e.g. “Day-of Coordination — $1,200 · Flat”, no choice groups) → **Send to client** → toast:

> “This template has no choice groups to send. Use Apply for fixed offerings, or add choice groups first.”

---

## Proven root cause

**“Send to client” always invokes Path B (client-selectable offerings), never Path A (share a fixed Event Order).**

The Library template card always exposes both actions:

| UI label | Code path | Intended workflow |
| --- | --- | --- |
| **Use** | `useEventOrderTemplate` → `startOrApplyEventOrderTemplate` (+ optional venue-side finalize of choice groups) | Apply fixed lines (and venue-answered choices) into the event’s Event Order draft |
| **Send to client** | `sendEventOrderTemplate` → apply fixed lines, then **require** choice groups → `createClientChoicesFromEventOrderTemplate` → `sendClientChoices` | Client selection round-trip |

For a template with `groups.length === 0`, `sendEventOrderTemplate` correctly refuses at:

`lib/event-order-templates/use-send.ts` (approx. lines 134–138)

That refusal is **legitimate for Path B**. The defect is **routing/UX**: the product presents **Send to client** as if it could publish a fixed Event Order to the couple. It cannot. Path A sharing is a **separate** Event Order lifecycle on the event (`Finalize` → `Share` in `event-order-panel.tsx` → `shareEventOrderWithClient`).

Secondary UX bug: the error says **“Use Apply”**, but the Library primary action is labeled **“Use”** (confirm CTA inside the sheet is “Apply to event”). Venues following the toast cannot find a button named Apply on the template card.

---

## Exact code paths

### Button → handler

1. `components/event-order-templates/event-order-template-list.tsx`  
   - `TemplateCard` primaryActions: `use` → `LIBRARY_LABELS.useTemplate` (“Use”), `send` → `LIBRARY_LABELS.sendToClient` (“Send to client”) — **both always shown** (no group-count gate).  
   - `UseOrSendEventOrderSheet` `mode === "send"` → `sendEventOrderTemplateAction`.
2. `app/(app)/events/[id]/event-order-actions.ts` → `sendEventOrderTemplateAction` / `useEventOrderTemplateAction`.
3. `lib/event-order-templates/use-send.ts` — orchestration.
4. Selectability: `templateHasSelectableGroups` = `template.groups.length > 0` (`selection-definition.ts`).

### Path A — Fixed Event Order (authoritative)

1. Apply template: Library **Use** *or* event panel **Apply a template** (`ApplyEventOrderTemplateSheet` → `applyEventOrderTemplateAction` / `startOrApplyEventOrderTemplate`).
2. Edit lines on event Event Order (open status).
3. `finalizeEventOrder` — status `open` → `finalized`.
4. `shareEventOrderWithClient` — gated by `shareBlockedWhenNotFinalized` (must be finalized); writes PDF/doc, share snapshot, `shared_at`, optional email + conversation (`sourceType: event_order_shared`), task autocomplete.  
5. Couple portal reads shared snapshot via portal Event Order section.
6. **Invoice / payment plan are separate deliberate actions** — share path does not call `createInvoice` / payment-plan builders (covered by `event-order-completeness.test.ts` / prior EO QA).

### Path B — Client-selectable offerings (authoritative)

1. Template must have choice groups (+ options).
2. Library **Send to client** → freeze `client_choices`, `sendClientChoices`.
3. Couple submits selections; venue reviews; `finalizeClientChoices` hands off into Event Order once (existing handoff / idempotency).
4. Choice-group validation **must remain** on this path.

### What “Apply” means here

- In Library sheet (Use mode): confirm CTA **“Apply to event”** → `useEventOrderTemplate`.
- On the event Event Order panel: **“Apply a template”** → same apply engine without client send.
- Error copy “Use Apply” conflates those labels with the card’s **Use** action.

---

## Current vs intended

| Scenario | Current | Intended |
| --- | --- | --- |
| Fixed template + Send to client | Error after full sheet; feels like share is broken | Do not offer Path B; guide to Use → Finalize → Share |
| Fixed template + Use | Applies EO lines; success | Correct (still need Finalize + Share for couple visibility) |
| Template with choice groups + Send | Creates/sends client_choices | Correct — keep validator |
| Share EO | Requires finalized; no auto-invoice | Correct |

---

## Safeguards already in place (preserve)

- Share blocked unless finalized (`lifecycle-gates.shareBlockedWhenNotFinalized`).
- Finalize/share $0 warnings (UI).
- Finalized order mutation immutability / reopen gates.
- Included vs additional fee semantics on lines / offerings handoff.
- Send path already refuses zero choice groups (do not remove for Path B).

---

## Smallest complete fix

1. **UI routing:** Do not present an active **Send to client** path for templates with zero selectable groups. Prefer hiding/disabling the action on the Library card once group presence is known; inside the send sheet, if detail loads with no groups, block Send and offer **Apply to event** (Use path) with clear next-step copy (Finalize & Share on the Event Order).
2. **Error copy (defense in depth):** If `sendEventOrderTemplate` is still called without groups, return an actionable message that names **Use** / Apply to event and **Finalize & Share**, and does not imply inventing choice groups is required for a fixed order.
3. **Do not** make Send auto-finalize+share a fixed EO (would conflate workflows and risk surprise client notification).
4. **Do not** remove choice-group validation from Path B.
5. **Tests:** Prove fixed templates apply/share without offerings validator; prove send without groups is blocked with the new message / UI gate; prove send with groups still works (source/contract tests + Sandbox browser).

---

## Regression risks

| Risk | Mitigation |
| --- | --- |
| Hide Send for templates that have groups but options empty | Gate on `groups.length > 0` (same as server); unfinished warning already covers empty templates |
| Venues expect Send = “email the EO” | Copy must point to Finalize + Share on the event |
| Dirty footer layout in `event-order-template-list.tsx` | Preserve / compose with that uncommitted layout work |
| Inventory template “Send to client” | Separate surface; out of scope unless same report expands |

---

## Proposed test cases (Phase 3)

**Fixed (Path A)**  
- Template with one priced fixed line, zero groups → Use/apply succeeds.  
- Finalize + share succeed; portal sees EO.  
- Send action not offered or blocked without offerings validator success path.  
- Share does not create invoice/payment plan.  
- Re-apply / re-share does not duplicate lines incorrectly (existing apply semantics).

**Selection (Path B)**  
- Valid groups → Send succeeds.  
- Zero groups → blocked with actionable message.  
- Couple submit → venue finalize → single EO handoff; no duplicate paid lines.

**Auth / financial**  
- Existing tenant checks on actions preserved.  
- Couple cannot mutate venue-authored fixed lines via selection APIs.

---

## Implementation status

Audit complete. Implementation proceeds in Phase 2 against this routing model.
