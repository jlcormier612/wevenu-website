# Event Order default template correction — root cause

## Verdict (pre-fix)

Ceremony + Reception (`EO-D-02`) and Wedding Reception (`EO-D-01`) defaults shipped as **flat template lines only**. Mutually exclusive dinners, optional paid add-ons (Arbor), and bar packages were indistinguishable from included package items.

## Where defaults originate

| Layer | Path | Role |
| --- | --- | --- |
| Canonical masters | `lib/event-order-templates/starters.ts` → `EVENT_ORDER_STARTER_MASTERS` | Source of truth for new venues |
| Provision | `lib/event-order-templates/provision.ts` → `insertStarterFromMaster` / `provisionEventOrderStarters` | Copies master into venue Library at signup / Library ensure |
| Empty repair | `repairEmptyDeliveryStarterOfferings` | Fills section-only shells that have zero lines |
| Apply heal | `lib/event-orders/service.ts` → `loadTemplateReadyForApply` | Runs ensure before template → event copy |
| Account seed | `lib/provisioning/starters.ts` → `seedEventOrderStarters` | New venue bootstrap |

Venue copies are independent rows keyed by `source_master_key` (`EO-D-01` / `EO-D-02`). Editing a venue template does not mutate the TypeScript master. Re-running provision **skips** templates that already exist (by key or name) — so fixing the master alone never repaired Fancy’s flat copy.

## Why prior EO workflow work did not fix this

The Event Order selection/invoice journey (`docs/qa/event-order-workflow-correction`, GREEN 61/61) proved portal freeze, finalize, and billing. It did **not** change starter masters. Fancy’s Ceremony + Reception remained seven flat lines and **zero choice groups** (`d73d9734-…` style copies).

`insertStarterFromMaster` only inserted `event_order_template_lines`. Choice-group tables (`event_order_template_groups` / `_options`) were never populated from starters, even though the editor and selection freeze already supported them.

## Commercial impact

1. **Plated Dinner** and **Buffet Dinner** both appeared as independent lines → package apply (`packageStartingSelections`) could commit both as Additional charges.
2. **Arbor** ($350) appeared as a line → could be package-committed without an explicit couple selection.
3. Couple portal Send requires selectable groups; flat-only templates could not express required pick-one vs optional add-on.
4. Fixed lines with `includedByDefault: false` are still “proposed offerings,” not couple opt-ins.

## Intended model (existing product, not a parallel engine)

- **Included** → `event_order_template_lines` with `included_by_default = true` (frozen as `fixedLines` for couple context).
- **Required / optional choices** → `event_order_template_groups` + `_options` (frozen into selection `groups` / `options`).
- Couple agreement = submitted answers + venue finalize → EO lines. Template appearance ≠ commitment.

## Fix (this change)

1. Redefine `EO-D-01` / `EO-D-02` masters with included lines + choice groups.
2. Provision inserts groups/options; empty repair fills both.
3. `upgradeUncustomizedLegacyFlatStarter` — idempotent in-place upgrade only when fingerprint matches legacy flat line names and **group count = 0**.
4. Customized templates (any groups, renamed/extra lines) and all event orders are left alone.
5. `submit_client_choices` + portal route enforce required-group min/max so browser bypass fails.
