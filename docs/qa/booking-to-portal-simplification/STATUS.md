# Booking-to-portal — Overview release correction

## Status

**GREEN / CLOSED**

Settings and Setup Profiles remain frozen. Overview release UX corrected: configured Inventory/Event Order are not “Unavailable,” outstanding no longer duplicates Prepare, one **Release to client portal**, Planning Open from card, Invite separate.

## Serving

| Item | Value |
|------|-------|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Fix commit | `0ff9098b5105263a3e7fd673df098309bbc30aa0` |
| Deploy | [39664454427](https://github.com/jlcormier612/wevenu-website/actions/runs/39664454427) **success** |
| Serving SHA | `0ff9098b5105263a3e7fd673df098309bbc30aa0` (exact match) |
| Settings/Profiles | Unmodified (frozen contract from `0cd25c62`+) |

## Root causes fixed

1. Missing Inv/EO drafts with valid template refs → wrongly `unavailable` + Prepare nextAction.
2. Drafts treated as outstanding → yellow list + primary CTA hidden + duplicated Prepare.
3. Planning Open suppressed when listed in outstanding.

## Acceptance

```bash
EXPECTED_SHA=0ff9098b5105263a3e7fd673df098309bbc30aa0 \
  npx tsx scripts/qa/booking-to-portal-simplification-acceptance.mts
```

**44/44 PASS** against serving `0ff9098b…`

Fixture: client `cd47d555-66ec-4d21-9016-f36f6ef1097a` / event `c4e728d7-17ae-441e-b2c6-5f7917f3f31f` (see `browser-results.json`).

Key gates:
- `event_setup_no_unavailable_inventory_eo`
- `event_setup_open_planning_from_card`
- `event_setup_single_release_cta`
- Release released client planning; venue checklist kept; no invite/Q/invoice on release
- Invite separate (pending `.invalid`); no Q/invoice on invite
- Idempotent release; profile unchanged

## Unit / seam tests

Focused event-setup suites green before deploy.

## Production

Untouched. Unrelated dirty work preserved.
