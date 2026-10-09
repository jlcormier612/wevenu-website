# INQUIRY FORM PREVIEW — GREEN / FROZEN

**Status:** GREEN / FROZEN — no further changes unless a release-blocking defect is discovered.

| Field | Value |
|---|---|
| Intended commit | `109543fb55bf42ba0163b5509c51237ab69b8cdc` |
| Serving commit (`dpl`) | `109543fb55bf42ba0163b5509c51237ab69b8cdc` |
| Deployment ID | `37585885250` |
| Deploy branch | `deploy/inquiry-preview-109543fb` |
| Serving image | `405254329873.dkr.ecr.us-east-1.amazonaws.com/htc-sandbox-venue-app:109543fb55bf42ba0163b5509c51237ab69b8cdc` |
| Serving digest | `sha256:17069c8cc8020ad24021b9cc71d5bbbb5d31a74d37e6c21c6ed7712db8756679` |
| Health | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| Automated | 10/10 `lib/inquiry-form/preview-config.test.ts` |
| Browser proof | `scripts/qa/inquiry-form-preview-browser.mts` — 14/14 PASS |

## Exact runtime proof

- Settings → Inquiry Form → Preview form opens without save
- Preview banner: “This is a preview. Form submissions are disabled.”
- Preview identifies as Inquiry Form (Preview)
- Unsaved builder change reflected (preferred-date mode)
- Submit disabled / “Preview only — submissions disabled”; click creates no leads
- No Turnstile in preview
- Closing preview leaves builder intact
- Direct Link + saved public form unchanged (no preview chrome)

## Freeze reason

Exact intended commit serving, healthy, focused tests green, customer-facing preview proven non-mutating on that runtime.
