# Website-form venue inquiry notification branding

**Status: GREEN** (venue-facing sync notify path)

## Gate A — Forensic (confirmed)

| Item | Finding |
|------|---------|
| Trigger | `POST /api/public/inquire` after successful `ingestLead` / `create_public_lead` |
| Implicated send | Immediate `sendEmail` to `venue.email` with **text only** (no `html`) — before fix |
| Shared branded path | `buildVenueNotificationEmail` + `htcEmailLogoHeaderHtml` + `htcEmailCtaAnchorHtml` |
| Root cause | Sync venue alert in `app/api/public/inquire/route.ts` bypassed the HTC staff notification HTML shell |

## Gate B — Fix + deploy + runtime

| Item | Value |
|------|--------|
| Commit | `5b7d35d16844f241e508ecd3926b8e725f558593` |
| Deploy (success) | https://github.com/jlcormier612/wevenu-website/actions/runs/38473146376 |
| Prior failed deploy | `38472516131` — marketing ECR `toomanyrequests` |
| Serving image | `htc-sandbox-venue-app:5b7d35d16844f241e508ecd3926b8e725f558593` (ECS PRIMARY COMPLETED, TD `:727`) |
| Change | Venue notify uses `buildVenueNotificationEmail` (logo + Heritage Sage CTA) → `/leads/{leadId}` |

### Runtime evidence (delivered Resend HTML)

Synthetic Meadowbrook website inquire → venue `jlcormier612@gmail.com`:

| Check | Result |
|-------|--------|
| Subject | `New inquiry from Brand Probe1791928827685` |
| Resend id | `01a13748-0529-7747-9925-9c2e423d656d` |
| Lead | `3924e887-d0bb-4c83-9365-35658effc96a` |
| Logo asset | PASS |
| CTA `#5D6F5D` | PASS |
| CTA label / deep link | `View Brand…` → `https://app.sandbox.hellotocheers.com/leads/{id}` |
| No visible raw URL in body text | PASS |
| Inquiry details preserved; no internal notes | PASS |

Artifacts: `verify-results.json`, `captured-email.html`, `captured-email-meta.json`.

**Limitation:** Local `.env.local` lacked `RESEND_API_KEY`; HTML was captured via Sandbox Secrets Manager + Resend API read of the delivered message (not Gmail UI). Inquirer confirmation email (`We received your inquiry — …`) remains a **separate plain-text path** — tracked in the email consistency inventory (Gate 2), not this venue-notify fix.

Production untouched.
