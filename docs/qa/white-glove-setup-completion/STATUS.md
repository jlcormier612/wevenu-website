# White Glove Setup Completion

| Field | Value |
| --- | --- |
| **Status** | **ACCEPTED / GREEN** |
| **Product tip (WG)** | `5d690d4f` + accept fixes on `27cbb1b15ecc51c2d1c74748539c4439c37c7b02` |
| **Serving image** | `htc-sandbox-venue-app:27cbb1b15ecc51c2d1c74748539c4439c37c7b02` |
| **Deploy** | [40818440323](https://github.com/jlcormier612/wevenu-website/actions/runs/40818440323) — success |
| **Accept branch** | `wg/sandbox-accept-250796c0-proxy-401` (based on `250796c0`; keeps EO catalog tip separate) |
| **Ancestors** | includes `250796c0` ← `914d7d96` ← `5d690d4f` … |
| **Production** | Untouched |
| **Unrelated dirty/untracked** | Preserved on `feat/spaces-booking-e1-smart-fields` |

## Browser acceptance

```bash
EXPECTED_SHA=27cbb1b15ecc51c2d1c74748539c4439c37c7b02 \
  npx tsx docs/qa/white-glove-setup-completion/verify-browser.mts
→ GREEN — 36 pass / 0 fail
```

Evidence: `browser-results.json`, `browser-run.log`, shots `01`–`08`.

### Persisted / runtime proof

| Check | Evidence |
| --- | --- |
| Private documents bucket | `public: false` |
| Materials upload + metadata | `storage_path` under `onboarding/{venueId}/`, `public_url: null` |
| Public object URL denied | HTTP 400 |
| HQ signed download | JSON 200 + signed URL HTTP 200 |
| Unauth download | **401** `{error:"unauthorized"}` (no HTML login redirect) |
| Non-HQ download | **403** |
| Resumable intake | waiting list + `?edit=1` persists capacity 175 |
| Import seed | HQ Import Wizard notice from received material |
| Finish handoff | `white_glove_status=setup_complete_access_pending`, token minted |
| Access email | `access_email_sent_at` set (welcome_home via Resend) |
| Activation link | `https://workspace.sandbox.hellotocheers.com/activate/{token}` opens |
| Finish retry | same activation token reused |
| Post-activation intake | 409 `already_activated` |

Fixture venue (last GREEN): `1a7641e2-ddca-4e29-b37a-03bdbf29f033` · enrollment `b4ea331a-389e-42f3-af13-3ada6f7486e9`

## Fixes shipped for accept

1. Proxy: unauthenticated `/api/admin` → JSON **401** (not HTML `/login`)
2. Resend tags: sanitize synthetic `venue:{uuid}` relationship ids so `welcome_home` sends
3. Harness: `p_is_owner: true`, `capacity` column, workspace activate host, poll until `access_email_sent_at`

## Explicit gaps (do not overclaim)

- Message-template auto-import — not fully wired
- Planning — guidance only; no auto-apply playbook from PDF
- Fresh Stripe purchase → welcome email path not separately exercised (harness uses provisioned enrollment + Finish)
