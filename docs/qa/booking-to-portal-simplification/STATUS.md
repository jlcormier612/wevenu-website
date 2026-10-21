# Booking-to-portal simplification

## Status

**GREEN / CLOSED**

## Commits

| SHA | Purpose |
|-----|---------|
| `b1c1f189e8fa4f2cc2990be0232ab1af103b450b` | Preset Inventory/EO + venue checklist on book; Prepare and release portal; Invite separate; Vendor Network authoritative |
| `db43eff778a69b5cf4cad06b9f41c65a7f885c8f` | Venue checklist falls back to active event-type match when no `is_default` |

## Sandbox deploy

| Item | Value |
|------|-------|
| Workflow | Deploy Sandbox |
| Run | https://github.com/jlcormier612/wevenu-website/actions/runs/39641996104 |
| Conclusion | success |
| Serving SHA | `db43eff778a69b5cf4cad06b9f41c65a7f885c8f` |

## Acceptance

Harness: `scripts/qa/booking-to-portal-simplification-acceptance.mts`  
Results: `docs/qa/booking-to-portal-simplification/browser-results.json` — **28/28 PASS**

Synthetic fixture (Sandbox only):

- lead `d7ecaf66-2e75-4820-9e71-e72719ef6d66`
- client `6dcb204d-614e-4eb8-9f65-8320a343af57`
- event `ac44f386-b213-4d6c-8e9d-8a97e1c8da1f`
- tag `B2P-1792603382407-3f07`

## Proven

- Booking prepares Inventory + Event Order drafts (not shared/finalized/invoiced)
- Booking prepares client checklist (draft) and venue checklist (released internally)
- Prepare and release portal releases Client Planning; does not invite, send questionnaires, or invoice
- Repeated prepare is idempotent (single inv/EO rows)
- Questionnaires remain draft/unsent
- Setup Profile unchanged by booking
- Start-draft CTAs absent after book-time prepare

## Unit/seam tests

`npx tsx --test lib/event-setup/*.test.ts lib/playbooks/phase3-invite-release.test.ts` → **113/113 PASS** (pre-deploy)

## Production

Untouched. Unrelated dirty work preserved.
