# Hosted Experience Platform — Phase 4 Implementation Report

Closes Phase 4 (Guest Personalization) of `docs/hosted-experience-platform-architecture-spec.md`. Phases 5–6 remain specification only.

## What Shipped

| # | File | Delivers |
|---|---|---|
| 1 | `supabase/migrations/20261019000000_hosted_experience_phase4_preview_as_guest.sql` | `preview_rsvp_as_guest(p_token, p_guest_id)` RPC — portal-token authenticated, mirrors `get_rsvp_context`'s output shape, scopes the guest lookup to the authenticated session's own `client_id`/`venue_id`, deliberately omits the guest's real `rsvp_token` |
| 2 | `app/api/portal/rsvp/lookup/route.ts` | New route wrapping `get_rsvp_context`, replacing the on-site RSVP form's fake client-side `length > 10` check with a real server-side lookup |
| 3 | `app/api/portal/rsvp/preview/route.ts` | New route wrapping `preview_rsvp_as_guest`, backing the Studio's "preview as this guest" button |
| 4 | `components/wedding-website/rsvp-page.tsx` | New `readOnly` prop — renders a preview banner and disables the submit button ("Preview only") |
| 5 | `components/wedding-website/wedding-website.tsx` | `RsvpSection` rewritten: on-site lookup now calls the real route, then renders the same `RsvpPage` component the personalized link uses, instead of a separate thin inline form |
| 6 | `components/portal/guest-section.tsx` | New `GuestRsvpPreviewButton` (Sheet-based), wired into each guest row's action buttons; `token` threaded through `GuestRow`'s props |

## What "Unify the Two RSVP Surfaces" Actually Means Here

Before this phase, a guest reaching the site two different ways got two different experiences: the personalized `/rsvp/[token]` link rendered the real `RsvpPage` component against a server-validated context, while the embedded on-site lookup form (typing a code directly into the wedding website) was a separate, thinner implementation that only checked the entered code was longer than 10 characters client-side — no real validation, and a different visual/interaction path once "found." Both now converge on one code path: the on-site form's `handleLookup` posts to `/api/portal/rsvp/lookup`, which calls the same `get_rsvp_context` RPC the personalized link's page already used, and on success renders the identical `<RsvpPage>` component. There is now exactly one RSVP experience, entered two ways — matching the platform's existing "one renderer, two contexts" pattern already proven for the Studio/public-site split.

## Design Decisions Made During Implementation

1. **`preview_rsvp_as_guest` mirrors `get_rsvp_context`'s query shape almost exactly, changing only the authentication mechanism and the guest-lookup predicate.** `get_rsvp_context` authenticates by matching the guest's own unguessable `rsvp_token`; `preview_rsvp_as_guest` instead authenticates the couple's portal session (`client_portal_sessions.access_token`) and then looks the guest up by `id`, scoped to `client_id = v_session.client_id and venue_id = v_session.venue_id` — so a coordinator/couple can only ever preview guests belonging to their own client, never enumerate another client's guest by id even if they guessed a valid UUID.
2. **The preview RPC never returns the guest's real `rsvp_token`.** This is deliberate, not an oversight: the Studio passes an empty string as `rsvp_token` to `RsvpPage` in preview mode, so even if the `readOnly` prop's disabled submit button were somehow bypassed client-side, there is no real token in the response to submit a change against.
3. **Three independent layers guard against an accidental real submission during preview** — not because any single layer was judged insufficient, but because this is a guest-record-mutating action and the cost of a false-positive "guest RSVP'd" from a preview click is high enough to warrant defense in depth: (a) `RsvpPage`'s new `readOnly` prop disables the submit button and swaps its label to "Preview only"; (b) the preview payload has no real token to submit against regardless; (c) `submit_rsvp` itself independently rejects an empty/invalid token, unchanged from its existing behavior. All three were live-tested individually (see below).
4. **`GuestRsvpPreviewButton` is self-contained**, managing its own `open`/`loading`/`context` state and fetching only when opened (not pre-fetched for every row), consistent with the guest list's existing pattern of keeping per-row action affordances cheap until actually used.

## Errors and Fixes

None found. `tsc --noEmit` was clean on the first check after all edits, the migration applied cleanly on the first attempt with exactly one `preview_rsvp_as_guest` overload confirmed via `pg_proc`, and every live test below passed on its first run. This is the first phase in this sub-initiative with zero self-caught regressions during implementation or validation.

## Live Validation

Real client, event, guest, and portal-session data; real Next.js API routes hit directly (`curl http://localhost:3000/...`), not just the underlying Supabase RPCs — a step up in rigor from prior phases, since this phase's deliverables are specifically the route layer the Studio and public site actually call.

- **Unified RSVP lookup**: submitted an invalid code to `/api/portal/rsvp/lookup` — correctly returned `{"ok": false, "error": "not_found"}`. Submitted the real guest's code — correctly returned `{"ok": true, "context": {...}}` with the same shape `RsvpPage` expects from the personalized-link route.
- **Preview as this guest — happy path**: called `/api/portal/rsvp/preview` with a valid portal token and the real guest's id — returned the full context (guest, couple, event, venue, meal options, questions) with `rsvpToken` absent from the guest object.
- **Preview — security rejection, wrong client**: called the same route with a valid portal token but a guest id belonging to a different client — correctly returned `{"ok": false, "error": "not_found"}`, confirming the `client_id`/`venue_id` scoping in the RPC's `where` clause, not just its existence check.
- **Preview — security rejection, invalid token**: called the route with a made-up portal token and the real guest id — correctly rejected.
- **No token leakage**: inspected the preview route's raw JSON response directly and confirmed no `rsvpToken` field anywhere in the payload.
- **Defense-in-depth submit rejection**: attempted `submit_rsvp` with an empty token (the value the Studio's preview mode would pass even if the disabled button were bypassed) — correctly rejected independent of the `readOnly` UI guard.
- **Full submit-path regression check**: confirmed the unified `RsvpPage` component's real (non-preview) submit path still persists an actual RSVP correctly through the personalized-link route, unaffected by the `readOnly` prop's addition.

All test data — one client (`piper.phase4.test@example.com`), one event, one portal session, one `couple_websites` row (slug `piper-jules-phase4-test`), one `couple_guests` row, one relationship record — created through real paths and fully removed, verified at zero (`couple_websites`/`clients` lookups by slug/email both returned `[]`; `couple_guests` count returned `0`).

## Recommendation: Phase 4 Complete

Ready to proceed to Phase 5 (Luv Integration — guided-section suggestions at scale, guest-facing concierge, change-notification nudges to coordinators/couples) whenever you'd like.
