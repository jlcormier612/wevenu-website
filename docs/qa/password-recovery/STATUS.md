# HTC password recovery — Venue · Vendor · Client

**Sandbox only.** Production / public marketing untouched.  
**Overall:** GREEN (all three portals + branded Resend delivery)

| Layer | Status |
|---|---|
| Venue portal recovery | **GREEN** |
| Vendor portal recovery | **GREEN** |
| Client portal recovery | **GREEN** |
| Shared branded-email delivery (Resend) | **GREEN** |
| Auth / isolation safeguards | **GREEN** (replay + unauth reset + portal-scoped cookie jars) |

---

## Deployed revision (observed)

| Item | Value |
|---|---|
| Tip SHA | `f901efce4696ba82e41e9b31be0c16c0e3ef8f7c` |
| Live `dpl` | `f901efce4696ba82e41e9b31be0c16c0e3ef8f7c` |
| Deploy run | [38178248583](https://github.com/jlcormier612/wevenu-website/actions/runs/38178248583) success |
| Prior branded-email tip | `aaf3c3a8` via [38177637410](https://github.com/jlcormier612/wevenu-website/actions/runs/38177637410) success |
| Health | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |

---

## Architecture (audit)

| Portal | Login route | Forgot entry | Recovery audience | Post-reset login |
|---|---|---|---|---|
| Venue | `/login` | `Forgot password?` → `/forgot-password` | `venue` (default jar) | `/login?reset=1` |
| Vendor | `/vendor/login` | `Forgot password?` → `/forgot-password?audience=vendor` | `vendor` cookie jar | `/vendor/login?reset=1` |
| Client | `/client/login` | `Forgot password?` → `/forgot-password?audience=client` | `client` cookie jar | `/client/login?reset=1` |

Shared pieces: `requestPasswordReset` → `sendBrandedPasswordRecoveryEmail` (`admin.generateLink` + Resend) → `/auth/confirm` (client hash/`code` exchange into the scoped jar) → `/reset-password` → `updatePasswordAfterRecovery` → portal login.

**Gap closed on tip `f901efce`:** client/vendor Forgot links were missing from `aaf3c3a8` (venue-only). Live HTML before fix: client/vendor `forgot_count=0`.

---

## Branded email delivery

| Check | Result |
|---|---|
| Mechanism | Supabase `generateLink({ type: "recovery" })` + Resend HTML/text |
| From | `Hello to Cheers <jennifer@hellotocheers.com>` |
| Subject | `Reset your Hello to Cheers password` |
| Fallback to Supabase mailer | **No** — app path does not call `resetPasswordForEmail` |
| Click/open tracking | Off (auth links not rewritten) |
| Enumeration-safe UI | Same success copy whether or not the user exists |

---

## Three-portal browser E2E (tip `f901efce`)

Command: `EXPECT_SHA=f901efce npx tsx scripts/qa/password-recovery-three-portals-browser.mts`  
Evidence: `docs/qa/password-recovery/three-portals-results.json`

For **each** of venue / vendor / client (disposable Auth user + internal `jennifer+pw.{portal}.{stamp}@hellotocheers.com`):

| Check | Venue | Vendor | Client |
|---|---|---|---|
| Forgot visible on portal login | PASS | PASS | PASS |
| Correct forgot route / audience | PASS | PASS | PASS |
| Enumeration-safe form response | PASS | PASS | PASS |
| Recovery `redirect_to` → `/auth/confirm` | PASS | PASS | PASS |
| Resend accept + HTC From/subject/body | PASS | PASS | PASS |
| Land `/reset-password` (scoped) | PASS | PASS | PASS |
| Mismatch validation | PASS | PASS | PASS |
| Return to portal login `?reset=1` | PASS | PASS | PASS |
| Old password rejected | PASS | PASS | PASS |
| New password signs in (correct portal) | PASS → welcome/dashboard path | PASS → `/vendor/dashboard` | PASS → `/p/{token}` |
| Replay link safe | PASS | PASS | PASS |
| Unauth `/reset-password` blocked | PASS | PASS | PASS |

**Final answers**

1. Does Forgot Password appear in all three portals? **Yes** (on tip `f901efce`).  
2. Does each portal send the HTC-branded Resend email? **Yes** (From/subject/body verified per portal).  
3. Does each portal complete recovery and accept the new password? **Yes**.  
4. Is the old password rejected? **Yes** (all three).

---

## Safety

- Disposable Sandbox users/venues/vendors/clients only; cleaned up after each portal run.  
- No Jennifer / Meadowbrook / customer password rotation.  
- No secrets or full recovery URLs in commits.  
- Production / marketing untouched.
