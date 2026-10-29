# White Glove Setup Completion

| Field | Value |
| --- | --- |
| **Status** | **NOT ACCEPTED** — tip redeploy in progress (proxy 401 + harness fixture fixes) |
| **Product commit (WG)** | `5d690d4f` |
| **Serving baseline** | `250796c072cddec30aa596e8fc7d8f9d48e5632e` |
| **WG accept tip (this ship)** | branch `wg/sandbox-accept-250796c0-proxy-401` (proxy unauth `/api/admin` → JSON 401 + harness fixes) |
| **Branch (main line)** | `feat/spaces-booking-e1-smart-fields` (kept separate; EO catalog tip not required) |
| **Prior deploy** | [40812856415](https://github.com/jlcormier612/wevenu-website/actions/runs/40812856415) — success on `250796c0` |
| **Production** | Untouched |

## First browser run on serving `250796c0` — 29 pass / 6 fail

Root causes (not product WG core regressions):

1. **Handoff blocked** — harness called `provision_enrollment_venue` without `p_is_owner: true`, so no owner `venue_staff`; Finish correctly showed "Owner relationship/membership is missing."
2. **`same_name_space_capacity_update`** — harness selected nonexistent `max_capacity`; DB already had `capacity=175` (product OK).
3. **`unauth_download_denied`** — unauthenticated `/api/admin/*` followed HTML `/login` redirect (200) instead of JSON 401; non-HQ still correctly 403. Proxy fix ships on this tip.

## Fixes in this tip

- Proxy: unauthenticated `/api/admin` → `{ error: "unauthorized" }` **401** (no HTML login redirect)
- Harness: `p_is_owner: true`, `full_name` on staff fallback, `capacity` column, `redirect: "manual"` on unauth download
- Regression: `proxy-public-paths.test.ts`

## Explicit gaps (do not overclaim)

- Message-template auto-import — not fully wired
- Planning — guidance only; no auto-apply playbook from PDF
- Fresh Stripe purchase → welcome email path not separately exercised
