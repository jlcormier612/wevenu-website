# Event Order Enable Control — Pattern Recommendation

**Type:** Research only. No code, database, migrations, UI, or settings were modified to produce this document. `venues.event_order_enabled` was not changed for any venue.
**Method:** Direct inspection of every existing per-venue boolean flag on `venues` (`\d venues`), every place each one is read and written (grep, then the actual write path read in full), the real HQ admin gate (`app/admin/layout.tsx`, `lib/hq/service.ts`), and the existing HQ per-venue action pattern (`app/admin/actions.ts`, `components/hq/venue-detail/*`).

---

## What Already Exists — Every Per-Venue Boolean Flag, Traced

| Flag | Who controls it | Where | How it's actually set |
|---|---|---|---|
| `tour_scheduling_enabled` | **The venue itself** | Settings → Tour Scheduling, a real "Enable public tour scheduling" checkbox | A genuine self-service capability toggle — the venue decides, for their own business, whether to turn on a fully-shipped feature |
| `conversation_experience_enabled` | **Nobody, via any UI** | Not found anywhere as a clickable control | Confirmed by exhaustive grep: only *read*, in messaging pages — never written by any action, form, or admin control anywhere in the codebase. This is the exact flag `event_order_enabled` was modeled on, and its own real history is telling: it now defaults `true` for every venue, meaning it was rolled out by **migration/backfill once the team was confident**, not by anyone ever clicking a toggle |
| `access_disabled` | **An external system**, not a human in this app | `app/api/internal/product-access/lock/route.ts` | A service-to-service API route, authenticated by a static `PRODUCT_SYNC_API_KEY` bearer token — Hello to Cheers's internal CRM calls this, no person clicks a button in the product itself |
| `event_order_enabled` | **Nobody today** | Nowhere | Confirmed, again, in the prior readiness audit: only a direct database write |

**None of the four is an exact, ready-made "a human HQ administrator clicks a button to turn this on for one specific venue" pattern.** The closest and most honest answer is that this exact shape of control has never been built in this codebase before — but the *infrastructure* to build it safely, in the smallest possible way, already exists and is used constantly for other per-venue HQ operations.

---

## The Real, Reusable Pattern: HQ Per-Venue Admin Actions

Confirmed in `app/admin/actions.ts` and `components/hq/venue-detail/*`: every existing per-venue HQ operation (adding a note, adding a task, marking a venue contacted, starting "View As") follows one identical, simple shape:

1. A server action in `app/admin/actions.ts`, taking `venueId` as its first argument, calling a corresponding function in `lib/hq/crm-service.ts`, then `revalidatePath` on the relevant admin page.
2. A plain `<form action={someAction.bind(null, venueId)}>` with a `<Button type="submit">` in the corresponding `components/hq/venue-detail/*-section.tsx` component.
3. No client-side state, no new component library, no new architecture — just one more action and one more button, in files that already exist for exactly this purpose.

**This is the pattern to extend.** It is already scoped to one venue at a time, already permissioned (see below), and already proven for exactly the shape of problem this is: an internal operator doing one small, deliberate thing to one specific venue's account.

---

## Security / Permission Pattern to Reuse

Confirmed, and this is not optional — it's already doubly enforced: `/admin/*` is gated both at the Next.js layout level (`app/admin/layout.tsx` calls `getHqAdmin()`, redirects to `/dashboard` if null) and, per that file's own comment, mirrored at the middleware/proxy level. `getHqAdmin()` itself is a real, database-backed check — it calls the `current_hq_admin_role()` RPC, not an env var or a hardcoded email list. **Any new action added to `app/admin/actions.ts` inherits this protection automatically**, simply by virtue of only ever being reachable from a page inside `/admin/*`. Every existing admin write in this file already runs through the admin (service-role) client, consistent with `event_order_enabled` needing an UPDATE that bypasses ordinary venue-scoped RLS — the same, already-established pattern, not a new one.

---

## Answers

**1. What existing Hello to Cheers pattern should Event Orders follow?**
The HQ per-venue admin-action pattern (`app/admin/actions.ts` + `components/hq/venue-detail/*`) — not `tour_scheduling_enabled`'s venue-self-service pattern, not `access_disabled`'s external-API pattern, and not a repeat of `conversation_experience_enabled`'s own history of never getting a UI at all.

**2. Where should the control live?**
HQ/admin — specifically the venue's own detail page, `/admin/venues/[venueId]`, alongside the other real, existing per-venue operational controls already there (notes, tasks, contact tracking).

**3. Who should be allowed to change it?**
HQ admin only, via the existing `getHqAdmin()` gate. Never the venue owner, manager, staff, or coordinator — no venue-side role should see or control this at all.

**4. Should the venue owner see the control, or should it remain internal?**
Internal only. This mirrors `access_disabled`'s precedent (a lever Hello to Cheers pulls, not the venue) and is consistent with the flag's own documented origin: a staged-rollout decision belongs to Hello to Cheers during this phase, not to the venue's own business judgment, unlike `tour_scheduling_enabled`, which is a mature, fully-shipped capability a venue reasonably decides for itself.

**5. Smallest implementation needed:**
One new server action (e.g., `setEventOrderEnabledAction(venueId, enabled)`) in `app/admin/actions.ts`, calling a corresponding small function added to `lib/hq/crm-service.ts` that updates `venues.event_order_enabled` via the admin client, plus one small toggle/button added to the venue's existing HQ detail section, plus a `revalidatePath` call. No new table, no new column, no new page, no new permission model — every piece already exists except the one action and the one button.

**6. What should happen to existing Event Order data if the flag is turned off again?**
Nothing — already directly confirmed in the prior readiness audit's own live test: toggling the flag off again does not delete, hide-with-side-effects, or corrupt any `event_orders`/section/line data. The tab simply becomes unreachable again; the data persists untouched and would reappear exactly as it was if re-enabled. No new behavior is needed here — the existing on/off mechanics are already confirmed safe in both directions.

**7. Existing security/RLS/permission patterns that must be reused:**
`getHqAdmin()` / `current_hq_admin_role()` (the real, database-backed admin gate already protecting all of `/admin/*`, layout- and proxy-enforced), and the admin (service-role) client already used for every other admin-side venue mutation in this codebase. No new RLS policy and no new permission concept are needed — the venue-scoped RLS on `venues` already correctly does not need to allow this write from the venue side, since it will never originate there.

**8. Exact acceptance behavior:**
An HQ admin, on one specific venue's `/admin/venues/[venueId]` page, clicks the control; `venues.event_order_enabled` flips for that venue only; the Event Order tab appears (or disappears) the next time that venue's Event workspace loads; no other venue is affected; no Event Order data is created, deleted, or altered by the toggle itself; the action is immediately reversible by clicking again.

---

## Recommendation

**Implement the Event Order enable control as a new HQ-admin-only per-venue action on the venue's existing HQ detail page (`/admin/venues/[venueId]`), following the exact same server-action-bound-to-`venueId` pattern already used for every other per-venue HQ operation in `app/admin/actions.ts`, because it is the only pattern already in this codebase that is scoped to one venue at a time, already permissioned by the real `getHqAdmin()` gate, and already proven safe for exactly this shape of problem — an internal operator deliberately changing one thing for one venue — while every other existing per-venue flag in this product is either venue-self-service (wrong audience for a rollout decision), an external service-to-service integration (wrong surface for a human HQ operator), or, in the case of the very flag this one was modeled on, never actually given a control at all.**

This document ends here. No code, database, migrations, UI, or settings were changed in producing it.
