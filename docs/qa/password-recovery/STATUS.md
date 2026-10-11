# HTC password recovery — logic, branding, and delivery

**Sandbox only.** Production / public marketing untouched.

| Layer | Status |
|---|---|
| Recovery logic + browser E2E (tip `456c958c` and later) | **GREEN** (prior closeout) |
| Sender identity + branded template (Resend) | **GREEN** (see branded-email evidence) |
| App tip serving branded send path | Pending deploy of this commit |
| Supabase Auth Dashboard SMTP (optional alternate) | **OPEN / owner-optional** — not required once app sends via Resend |
| Gmail UI “From” screenshot / full Authentication-Results headers | **Owner confirm recommended** — Resend retrieve shows HTC From + `delivered` |

---

## 1. Forensic audit (delivery)

| Fact | Evidence |
|---|---|
| Prior recovery emails used Supabase default mailer | Customer report: `Supabase Auth <noreply@mail.app.supabase.io>` |
| HTC transactional provider | **Resend** (`htc/sandbox/resend-api-key`, ECS secret `RESEND_API_KEY`) |
| Sandbox From identity (venue app) | `Hello to Cheers <jennifer@hellotocheers.com>` (`FROM_EMAIL` on ECS) |
| Domain auth | `hellotocheers.com` DKIM/SPF verified in Resend (see `docs/resend-production-setup-findings.md`) |
| Supabase Management API token | **Absent** — cannot PATCH Auth SMTP from this environment |
| Auth SMTP / email templates | Dashboard / Management API only (not in repo migrations) |

Architecture chosen (explicit): keep **Supabase Auth recovery tokens** via `admin.generateLink({ type: "recovery" })`, deliver the `action_link` with **HTC Resend** + branded HTML. This is not a custom token scheme; it avoids Supabase’s default mailer branding without owner Dashboard SMTP.

Optional later: configure Sandbox Auth SMTP → Resend (`smtp.resend.com:465`, user `resend`, pass = Resend API key) and paste Dashboard templates — Production must stay untouched.

---

## 2. Branded email requirements

| Requirement | Implementation |
|---|---|
| Subject | `Reset your Hello to Cheers password` |
| From | ECS `FROM_EMAIL` (Sandbox: Hello to Cheers \<jennifer@hellotocheers.com\>) |
| Body | HTC logo + clear CTA + ignore-if-unrequested copy |
| No Supabase customer-facing sender | Resend path; `click_tracking`/`open_tracking` **off** (auth links must not be rewritten) |
| Recovery URL | Supabase `action_link` → allowlisted `/auth/confirm` → `/reset-password` |

---

## 3. Delivery evidence (observed)

Script: `npx tsx scripts/qa/password-recovery-branded-email.mts`  
Results: `docs/qa/password-recovery/branded-email-results.json`

| Check | Result |
|---|---|
| Resend accept | PASS |
| From | `Hello to Cheers <jennifer@hellotocheers.com>` |
| Subject | `Reset your Hello to Cheers password` |
| Body | HTC branded; no Supabase Auth wording |
| last_event | `delivered` |
| Link → reset → new password sign-in | PASS |
| Old password rejected | PASS |
| Tip at probe | `dpl=456c958c…` |

Recipient: disposable `jennifer+pwrecovery.{stamp}@hellotocheers.com` (internal +alias; not a customer; not Jennifer’s primary Auth user).

---

## 4. Owner-optional Supabase SMTP (if reverting to GoTrue mailer)

Sandbox project only (`wvpsldwwjqdannqasrdf`):

1. Authentication → Email → SMTP Settings → Enable custom SMTP  
2. Host `smtp.resend.com` · Port `465` · User `resend` · Pass = Sandbox Resend API key (from Secrets Manager `htc/sandbox/resend-api-key`, never commit)  
3. Sender email `jennifer@hellotocheers.com` · Sender name `Hello to Cheers`  
4. Templates → Reset password → subject/body from `lib/auth/password-recovery-email.ts` (keep `{{ .ConfirmationURL }}`)  
5. Do **not** change Production project settings  

Not required while the app uses Resend delivery.

---

## 5. Commands

```bash
npx tsx --test lib/auth/password-recovery.test.ts
npx tsx scripts/qa/password-recovery-branded-email.mts
EXPECT_SHA=<tip> npx tsx scripts/qa/password-recovery-browser.mts
```

---

## Safety

- Disposable Sandbox Auth users + internal +alias only.  
- No Production / marketing deploy.  
- No secrets, tokens, or full recovery URLs in commits.  
- Dirty unrelated work preserved.
