# UI automation difficulties — Phase 2 closure rehearsal

Product owner clarifications applied. Automation navigation difficulty ≠ UX defect.

| # | Issue | Exact screen / action | Automation initially attempted | What actually worked | Human user impact? | Classification |
|---|---|---|---|---|---|---|
| 1 | Save Inquiry naming | `/leads/new` → create lead | Clicked patterns like `Save lead` / `Create lead` / bare `Save`; then fell back to clicking “Claire Ellison” in the list | Button label is **Save inquiry**; unique DemoA names avoid list collision | No — humans see the labeled button | **Closed — expected behavior** (automation/navigation issue only) |
| 2 | Native confirmation on Save Draft | `/contracts/new` → **Save draft** (create mode) | Playwright default-dismissed `window.confirm`, so create never ran | Accept dialog; draft then persisted and navigated to `/contracts/:id` | Yes — browser shows a confirm dialog (intentional create-mode safeguard). See forensics below | **Needs clarification** only on product preference to keep vs restyle; **not a defect**. Behavior understood |
| 3 | Missing `/contracts/:id/edit` | After draft create | Navigated to invented `/contracts/:id/edit` → 404 | Real route is `/contracts/:id` (draft editor embedded on detail) | No — humans use in-app navigation / post-save redirect | **Closed — expected behavior** (automation/navigation issue) |
| 4 | Send vs Review & Send locator | Contract builder review overlay | `getByRole(/Send to Client/i)` also matched **Review & send to client** | Exact name `Send to Client` inside the review overlay; then **Send Anyway** if starter placeholders | Low — humans click distinct buttons by visible label. Overlap is Playwright accessible-name substring matching | **Automation/navigation issue**. Targeted product review: Preview vs Review & send are intentional (see §4). No code change without approval |
| 5 | Payment wizard Review Schedule | Set up payments sheet after Continue | Expected immediate Create after one Continue; stopped on Build Schedule | Continue → **Review schedule** → **Create payment plan** (footer may be below fold) | No — normal multi-step wizard | **Closed — expected behavior** |
| 6 | Record payment method | Payment schedule → Record payment | Submitted without method; button stayed disabled / no paid_amount | Select method (Cash default available; Check used in rehearsal) then Record | No — method is required by design; Cash is intended default | **Closed — expected behavior** |
| 7 | Mark as Booked location | After payments | Looked on client workspace first; CTA absent there | **Mark as Booked** (and stage change) on **lead** workspace header | No — both lead stage change and top Book button are intentional | **Closed — expected behavior**. Optional relocation: not proposed (top-of-page button is appropriate) |

---

## Item 2 — Save Draft confirmation forensics

| Question | Answer |
|---|---|
| Screen | Contract builder in **create** mode: `/contracts/new?selectionId=…&clientId=…` |
| Action | Click **Save draft** |
| Exact text | `Save a draft contract for {clientLabel}?\n\nTemplate: {templateName}\n\nSmart Fields stay in the draft until you send. This does not email the client or request a signature.` |
| Cause | Intentional `window.confirm(...)` in `handleSaveDraft()` when `mode === "create"` (`components/contracts/contract-builder.tsx`). Not an unsaved-changes / navigation guard |
| Did draft save? | Only after Accept. Dismiss/cancel aborts with no write. After Accept → `createContractAction` → toast “Draft saved.” → `/contracts/{id}` |
| Human encounter? | Yes — native browser confirm on first Save draft of a new contract. Edit-mode Save draft does **not** use this confirm |

**No behavior change** until product owner decides to keep, restyle (in-app dialog), or remove.

---

## Item 4 — Preview / Review / Send targeted review

| Control | Role |
|---|---|
| **Preview** | Display-only Smart Field resolution. Does not persist or send. Eyebrow: “Preview — display only” |
| **Review & send to client** | Opens customer-facing review overlay; Send is the commit action |
| **Send to Client** | Inside review overlay; creates/sends (create mode) or sends draft |
| **Send Anyway** | Only when starter policy placeholders remain |

**Conclusion:** Intentional safeguard ladder, not redundant duplication. Terminology differs slightly from proposal “Preview → Send” but contract’s stronger review step is deliberate (client-facing agreement).

**Code change:** None (would alter workflow / remove a meaningful step → needs approval).

**QA update:** Operator guide / automation must use exact button names and `/contracts/:id` only.
