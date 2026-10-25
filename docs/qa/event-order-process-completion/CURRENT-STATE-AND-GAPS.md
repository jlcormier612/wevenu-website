# Current state and gaps

**Inspected against:** branch `feat/spaces-booking-e1-smart-fields`, prior serving `1c7850ef…` / digest `sha256:b157d253…` (historical; re-verify before each browser run).  
**Closed work preserved:** conditional EO choices; template dependency authoring; Offering attach/unlink; choice-tree e2e.

---

## Verified dual commercial spines

```text
BOOKING SPINE
  packages → commercial_selections (source_package_id, included_items text freeze)
           → proposal / deposit / contract / Selected Package invoice path

BUILD-SHEET SPINE
  offerings + EO templates → client_choices freeze → finalize → event_order_lines
                           → invoice freeze from EO revision
```

Fancy runtime (catalog audit): EO lines ≈ offering 134 / custom 154 / **package provenance 0**.

---

## Stage-by-stage gaps (pre-fix)

| Stage | Intended | Observed gap |
|-------|----------|--------------|
| 1 Booking start | Package context available on EO start | Selected Package lives on `commercial_selections`; EO start uses Setup Profile EO template only. No enforced join. |
| 2 Compose EO | Package inclusions + template structure | `importPackageInclusions` exists but is **manual** (Add line sheet). Auto ensure/apply does not seed booking inclusions. |
| 3 Client choices | Closed choice-tree behavior | GREEN — do not reimplement. |
| 4 Venue review | Edit open EO | Existing open-EO editor; no missing mandatory approval gate. |
| 5 Finalize | Snapshot EO | Existing finalize/reopen; catalog does not rewrite finalized EO. |
| 6 Invoice / plan | Reconcile to commitment | Existing financial harness paths; must re-verify after package-seed so inclusions (typically $0 included) do not drift payable totals. |

---

## Root cause (package / Offering / EO disconnect)

There is **no enforced transfer** from the booking Selected Package into the Event Order starting point. Packages and Offerings are intentionally separate entities (Hybrid). Package inclusions are text, not Offering FKs. The EO panel recovers from the preferred **Event Order template**, while package inclusions remain optional/manual. That is the coherence break for Stage 1–2 — not a failure of the choice-tree engine.

---

## Smallest complete fix (target)

On `ensureEventOrder` / replace-open-EO-from-template (open + not yet shared): load active `commercial_selections` for the event and seed missing inclusion descriptions as **included custom** lines with `package-selection:` notes. Dedupe by description against existing EO lines (including template-copied lines). Do not add package fee automatically. Do not name-match Offerings.

---

## Non-blocking follow-ups (out of scope unless they block acceptance)

- Library copy clarifying Packages vs Offerings vs EO Templates (catalog audit next-increment messaging).
- Offering default-price readiness badges.
- Optional future explicit Package→EO-template mapping column (not required if Setup Profile already points at the correct EO template).
