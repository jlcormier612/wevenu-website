# Product contrast audit + event-assignment fixes

**STATUS:** IN PROGRESS — code + tests landed; awaiting Sandbox deploy + browser proof.

Production untouched. Unrelated dirty tree preserved.

## Assignment panel (Issues 1–3)

| Issue | Root cause | Fix |
| --- | --- | --- |
| 1 Unreadable Dismiss/Remove | Soft `destructive` used theme `text-foreground` (white in `.dark`) on hardcoded light `amber-50` banner; dusty-rose soft fill + pale ink also failed AA | Solid `bg-destructive` + `--destructive-foreground: black`; theme-aware amber banner; outline pins `bg-background text-foreground` |
| 2 $500 fee meaning | `event_vendor_assignments.agreed_fee` = venue cost owed to vendor; not EO/invoice | Labels: “Venue cost”; vendor copy clarified; couple portal has no fee field |
| 3 Required + withdrawal banner | `submit_vendor_list` created couple removal requests for every assignment without `selected_at`, including `is_required` | Migration excludes required relationships; dismisses spurious pending couple requests |

## Product-wide contrast

- Coverage matrix: `docs/qa/product-contrast-audit/COVERAGE.md`
- Regression gate: `lib/theme/shared-contrast-regression.test.ts`
- Shared token/component fixes in `globals.css`, `button.tsx`, `badge.tsx`
