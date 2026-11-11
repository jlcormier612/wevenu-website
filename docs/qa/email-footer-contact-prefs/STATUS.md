# Venue email footer contact preferences — Sandbox

## Verdict

**GREEN** on Sandbox tip `a09b3b50` (feature commit `4aaa0692` and verified descendant). Deployed UI, persistence, preview, and Resend-delivered HTML all pass. Production untouched.

## Product (locked)

Per-venue display flags for customer-facing email footers via shared `emailBrandFromVenue`:

| Preference | Column | Default |
|---|---|---|
| Show venue/team sign-off | `email_footer_show_signature` | `true` |
| Show venue email address | `email_footer_show_email` | `true` |
| Show venue phone number | `email_footer_show_phone` | **`false` (opt-in)** |

Stored `venues.email` / `venues.phone` / `venues.email_signature` are never cleared when prefs change.

## Root architecture

- Preview and production share `lib/email/venue-brand.ts` (`emailBrandFromVenue` → `renderBrandedEmailHtml` / `renderEmailBrandPreviewHtml`).
- Settings UI: Communications → How clients see you (`CommunicationIdentitySection`).
- Send paths load `VENUE_EMAIL_BRAND_SELECT` (includes the three flags) then call `emailBrandFromVenue`.
- Migration: `supabase/migrations/20261414900000_venue_email_footer_contact_prefs.sql`.

## Deployments

| Run | SHA | Result |
|---|---|---|
| [Apply Sandbox Migration 38182039446](https://github.com/jlcormier612/wevenu-website/actions/runs/38182039446) | `4aaa0692` | success |
| [Deploy Sandbox 38182045089](https://github.com/jlcormier612/wevenu-website/actions/runs/38182045089) | `4aaa0692` | success |
| [Deploy Sandbox 38182587645](https://github.com/jlcormier612/wevenu-website/actions/runs/38182587645) | `a09b3b50` (descendant of `4aaa0692`) | success — **current verified tip** |

Health: `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}`. Runtime `data-dpl` / `?dpl=` = `a09b3b50ca018ff12c80d9c1acf5591e93734f9a`.

## Browser + persistence (disposable venues)

`EXPECT_SHA=a09b3b50 npx tsx scripts/qa/email-footer-contact-prefs-browser.mts` → **GREEN** (`results.json`).

| Check | Result |
|---|---|
| New venue defaults (phone off, email+signature on) | PASS |
| Settings controls visible / understandable | PASS |
| Enable phone → save → DB + reload | PASS |
| Independent email/signature toggles persist | PASS |
| Preview reflects phone when enabled | PASS |
| Venue switch loads each venue’s own prefs | PASS |
| Contact email/phone/signature rows intact after pref changes | PASS |

## Delivered email matrix (Resend, internal inbox)

| Case | Resend id | Result |
|---|---|---|
| Phone hidden | `01a12d3b-3ae1-79a2-b1bc-e2010a18c7c0` | email+signature present; phone absent |
| Phone enabled | `01a12d3b-4068-7282-a7e7-ed840e570310` | phone present |
| Venue email hidden | `01a12d3b-45d6-7a1e-8b32-5ef51efd3714` | email absent; phone present |
| Signature hidden | `01a12d3b-4b52-77a4-a468-11bd6c2852e5` | signature absent; email present |
| All optional footer fields hidden | `01a12d3b-50cc-7a9c-8722-1198568bb79d` | clean footer; no blank rows / stray `·` |

Evidence: `delivered-sample.json`.

## Automated tests

`lib/email/venue-brand*.test.ts` — 7/7 pass (defaults, phone formatting, omitted separators).

## Authorization / isolation

Prefs are per-venue columns; disposable dual-membership run confirmed venue B’s phone-on preference loads after active-venue switch without mutating venue A contact fields.

## Remaining limitations

None for the locked Sandbox scope. Production / marketing not deployed.

## Files

- `supabase/migrations/20261414900000_venue_email_footer_contact_prefs.sql`
- `lib/email/venue-brand.ts` (+ tests)
- `lib/venue/{types,repository,service}.ts`
- `components/settings/communication-identity-section.tsx`
- `app/(app)/settings/communication-identity-actions.ts`
- Brand select sites → `VENUE_EMAIL_BRAND_SELECT`
- `scripts/qa/email-footer-contact-prefs-browser.mts`
