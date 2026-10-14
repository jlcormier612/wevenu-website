# Email consistency — Group A (public intake)

**Status: IMPLEMENTATION — Sandbox deploy/verify pending**

| Field | Value |
|-------|--------|
| Scope | D1 thank-you HTML · D2 forms venue notify · D3 Wedding label |
| Helper | `lib/lead-intake/public-intake-emails.ts` |
| Routes | `app/api/public/inquire/route.ts`, `app/api/public/forms/submit/route.ts` |
| Focused tests | `public-intake-emails.test.ts` + inquire branding + signature-path |
| Render proof | `group-a-render-results.json` + `group-a-*.html/png` (no sends) |
| Production / Resend / DNS | Untouched |

See `AUDIT-RESULTS-2026-10-14.md` for defect definitions. Groups B–E not started.
