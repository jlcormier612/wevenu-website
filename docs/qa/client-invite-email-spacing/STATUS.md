# Client Invitation Email Spacing Correction

**Status: GREEN**  
**Sandbox only. Production untouched.**  
**No external invitation email sent.**  
**Unrelated dirty paths preserved.**

## Product commit (serving)

`2ffbca9edfb99d68f32c73635a4e51f4e5a7e8b2`

Harness measurement harden (post-deploy, verification only): subsequent commit on same branch.

## Root cause

1. **Invite body** (`lib/client-auth/client-invite-email.ts`) used bare `<p>` tags with no inline margins. In the in-app preview, Tailwind preflight zeros paragraph margins, so greeting / body / CTA / legal stacked tightly. Email clients would apply defaults inconsistently.
2. **Shared branded shell** (`renderBrandedEmailHtml`) used `padding:40px` on the card and `padding-top:20px` on the signature row, leaving excess empty space under the content and a loose footer relationship.

Preview and send already share `buildClientInviteEmail` → same HTML. Defect was in the HTML, not a preview-only wrapper.

## Files changed (product)

| File | Why |
| --- | --- |
| `lib/client-auth/client-invite-email.ts` | Explicit email-safe margins / line-height on greeting, body, CTA, legal |
| `lib/email/venue-brand.ts` | Slightly tighter card/body/footer padding in shared shell |
| `lib/client-auth/client-invite-preview.test.ts` | Spacing regression assertions; copy/CTA unchanged |
| `lib/email/venue-brand.test.ts` | Shell padding contract |
| `lib/email/customer-facing-branding.closeout.test.ts` | Point invite seam at shared builder |
| `lib/email/signature-path-audit.test.ts` | Same seam accuracy |

## Before → after

| | Before | After (measured) |
| --- | --- | --- |
| Greeting → invite copy | Collapsed (~0 under Tailwind) | **16px** |
| CTA intro → button | Collapsed | **12px** |
| Button → legal | Crowded | **20px** |
| Card → signature text | Loose (~20px+40px feel) | **12px** (+ card pad 28px) |
| Copy / CTA / token path | — | Unchanged |

## Tests

**61 / 61 pass** — client-invite preview/seams, venue-brand, footer prefs, branding closeout, signature audit, invite-send intercept.

## Deploy + serving

- Run: https://github.com/jlcormier612/wevenu-website/actions/runs/39820453633 (`success`)
- Serving `data-dpl-id`: **`2ffbca9edfb99d68f32c73635a4e51f4e5a7e8b2`** (exact match)

## Browser acceptance

`scripts/qa/client-invite-email-spacing-acceptance.mts` → **15 / 15 PASS → GREEN**

- Desktop 1280 + mobile 390 screenshots of the **same** `buildClientInviteEmail` HTML
- No invitation rows created; notification_log unchanged
- In-app preview control not found on the sampled client page this run; preview/send identity is covered by unit seams + identical HTML render

## Evidence paths

- `docs/qa/client-invite-email-spacing/STATUS.md`
- `docs/qa/client-invite-email-spacing/browser-results.json`
- `docs/qa/client-invite-email-spacing/acceptance.log`
- `docs/qa/client-invite-email-spacing/rendered-invite.html`
- `docs/qa/client-invite-email-spacing/shots/before-user-screenshot.png`
- `docs/qa/client-invite-email-spacing/shots/invite-desktop-1280.png`
- `docs/qa/client-invite-email-spacing/shots/invite-mobile-390.png`

## Limitations

- Cross-client rendering (Gmail/Outlook native) was **not** exercised; verification is Chromium render of the email HTML + markup contracts. Inline styles / table shell match the existing email-safe architecture.
- Shared shell padding change applies to all `renderBrandedEmailHtml` customers (intentional, spacing-only).
- Full-page screenshots include empty gray below a short email; that is viewport chrome, not card padding.
