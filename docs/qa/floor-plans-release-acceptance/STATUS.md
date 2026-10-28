# Floor Plans — Full customer-journey release acceptance

**Verdict: OPEN / NOT GREEN**

Prior remediation **23/23 on `12721ce6`** remains valid for its scoped scenarios. It does **not** replace this release-acceptance journey.

## Serving / commits

| Item | Value |
|------|--------|
| Acceptance start serving | `12721ce63afa00b187b1bf5816dd7880d5eda219` |
| First-layout → working seed fix | `fab331592a1a77a15f852364d356c3b8cd4395cf` |
| Typecheck unblock (amendsInvoiceId) | `40eb7531339659efbb3204be3f465fb1b79d20b9` |
| Deploy (failed typecheck on fab33159) | https://github.com/jlcormier612/wevenu-website/actions/runs/40622837094 |
| Deploy (retry with type fix) | https://github.com/jlcormier612/wevenu-website/actions/runs/40623617817 |
| Production | Untouched |

## Honest answer

**Can a typical venue owner and couple complete the full Floor Plans process correctly, confidently, and without developer assistance, through seating?**

**No — not yet GREEN.** Venue first-use empty state and layout create are clear and work through the UI. Before/after link/unlink, share, and layout-room review create/clear largely work. The couple collaboration loop breaks when the venue uses **Additional layout + Share** without Event-setup **offers**: the couple can see a shared working layout but often cannot save a preference or submit furniture (`clientMaySubmitLayout` requires `couple_selected`). That is a customer-facing dead end, not a harness quirk.

## What passed (live UI + persisted where noted)

- Serving SHA gate + health
- Clean event with **zero** layouts
- First-use empty copy + CTAs (Event setup offer vs Additional layout)
- Create Ceremony + Reception via Apply Template UI
- Designate working layout (UI Set as working on `12721ce6`; auto-seed on `fab33159`)
- Setup organizer create via UI (member attach still awkward — labeled fixture assist)
- Before/after link + unlink preserving objects
- Share Floor Plan via UI
- Couple legal welcome → Floor Plans entry (readable)
- Layout-room review flag create via card room Save UI; flag visible
- Ready not auto-set from furniture approve; seating-open ≠ seating started

## Confirmed gaps / defects

| ID | Severity | Finding |
|----|----------|---------|
| FP-RA-1 | **Blocker** | Additional-layout + Share without offers: couple lacks preference chooser; Submit hidden (`couple_selected` required). First-use presents Additional layout as a peer path to Offer — only Offer completes couple loop. |
| FP-RA-2 | Fixed (pending serve) | First Additional-layout create left no working layout until manual “Set as working”. Fixed in `fab33159` (`seedWorkingLayoutIfUnset`). |
| FP-RA-3 | Open | Furniture drag on movable object did not always persist coordinates in harness (scale/pointer). |
| FP-RA-4 | Open | Review Clear sometimes left flag `open` (clear control / timing). |
| FP-RA-5 | UX | Setup member attach after “Add setup” is easy to miss; harness needed DB member attach assist. |
| FP-RA-6 | Boundary | Unlocking one template object for couple edit was fixture prep (templates lock objects). |

## Product change shipped

`lib/floor-plans/service.ts` — seed working layout when first plan is created/applied/duplicated and operational is unset. Does not share, set preference, or open seating. Phase 1 invariants test updated (15/15).

## Harness

```bash
EXPECTED_SHA=<serving> npx tsx docs/qa/floor-plans-release-acceptance/verify-release.mts
```

Latest run on `12721ce6`: **20/25** with 5 fails concentrated on preference/submit/approve/move/clear (see `browser-results.json`). UX notes in `usability-notes.json` / results.

## What remains for GREEN

1. Serving `fab33159` (or later) verified  
2. Close FP-RA-1 (product heal or force first-use Offer path + instruction)  
3. Couple preference → furniture move → submit → venue approve all via UI on fresh fixture  
4. Review clear reliability  
5. Re-run full harness green; seating transition still truthful  

## Boundaries

- Floor Plans only; Phases 1–5 not reopened wholesale  
- No schema migration  
- Unrelated dirty/untracked work preserved  
- Production untouched  
