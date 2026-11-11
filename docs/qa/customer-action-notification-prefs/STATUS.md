# Customer-action notification preferences — STATUS

**Status: GREEN**  
**Production:** untouched  
**Code SHA (venue-app image):** `500279e5`  
**Migration:** https://github.com/jlcormier612/wevenu-website/actions/runs/35918338483 (success)  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/35918341201

## What shipped

Three Email notifications prefs under **Leads & clients**:

| Pref | Type | Trigger |
|---|---|---|
| Tour scheduled | `tour_scheduled` | `AFTER INSERT` on `tour_appointments` (canonical book path) |
| Tour confirmed | `tour_confirmed` | `scheduled → confirmed` status transition (prospect_link + manual) |
| Proposal accepted | `proposal_accepted` | `accept_commercial_selection` / `approve_commercial_proposal` after accept |

Defaults ON. Preference OFF blocks `create_venue_notification` (existing gate). No second framework. Workflow state unchanged.

## Sandbox RCJ

| Check | Result |
|---|---|
| Unit tests | pass |
| Prefs columns persist | pass |
| Settings UI shows locked labels/descriptions | pass (live `/settings/communications`) |
| UI toggle persists | pass (`pref_tour_scheduled` false after toggle, then restored) |
| Tour scheduled ON/OFF | pass |
| Tour confirmed ON + replay no duplicate | pass (`prospect_link`, `confirmed_at` set) |
| Confirmation request alone | no notification |
| Proposal accepted ON/OFF + replay | pass |
| Email delivery | delivered via Resend (3 subjects) |

Evidence: `results.json`, `email-delivery.json`, `mailbox-preview.json`, `AUDIT.md`.
