# QR Lead Capture — Design

**Sprint 3, Item 4. Design only — no implementation. Waiting for approval.**

**Date:** 2026-07-21

This feature does not exist today. This document designs it by reusing this codebase's own established patterns: the "unique public token resolved by a `SECURITY DEFINER` RPC" pattern already proven three different ways (`embed_key`, `tour_embed_key`, `lead_email_key`), the "many tokens per venue, one dedicated child table" shape already proven by `vendor_invitations` and `couple_websites`, the "public RPC that logs a non-critical event as a side effect of resolving" pattern already proven by `get_wedding_website`/`couple_website_views`, the already-installed `qrcode` npm package (already used once, for the couple portal's wedding-website QR), and the Pipeline Templates "venue creates unlimited freely-named things" CRUD/UI shape.

---

## 1. What this feature needs to do

A venue creates unlimited named QR campaigns (e.g. "Bridal Show," "Open House," "Front Gate," "Brochure," "Magazine"), each with its own destination (the public inquiry form, the tour booking page, the wedding website, or an arbitrary external URL) and its own attribution. Scanning a QR code records a scan event, redirects the visitor to the configured destination, and — if that destination results in a lead being submitted — attributes the resulting Lead back to that specific campaign through the existing Lead Intake pipeline. A venue can see, per campaign: scans, conversions (a lead actually created), and the leads themselves.

---

## 2. Data model

### 2.1 `qr_campaigns` — the venue-created entity

Modeled directly on `vendor_invitations`' shape (dedicated child table, `venue_id` FK, DB-default unique token) rather than the one-token-per-venue pattern (`embed_key`), since a venue needs many of these:

```sql
create table public.qr_campaigns (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references public.venues(id) on delete cascade,
  name             text not null,                     -- "Bridal Show," "Front Gate," etc. — freely chosen by the venue
  code             text not null unique default encode(gen_random_bytes(8), 'hex'),  -- short, URL-safe public token
  destination_type text not null check (destination_type in ('inquiry_form', 'tour_booking', 'wedding_website', 'external_url')),
  destination_url  text,                                -- only populated/used when destination_type = 'external_url'
  status           text not null default 'active' check (status in ('active', 'archived')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index qr_campaigns_venue on public.qr_campaigns (venue_id);
create index qr_campaigns_code on public.qr_campaigns (code);
```

RLS: `venue_id = current_user_venue_id()`, standard `authenticated` grant for full CRUD. No `anon`/`service_role` grant needed on this table directly — same reasoning as `vendor_invitations`/`embed_key`-family tables: the public path only ever touches it indirectly, through a `SECURITY DEFINER` resolver RPC (§3).

**`destination_type` choices and why these four:** the inquiry form and tour booking page are this codebase's two existing genuine lead-capture surfaces (both already produce Leads through the pipeline on their own); the wedding website is included because a QR code pointed at a couple's own wedding website is a real, common physical-collateral use case (e.g. a printed program at a related event) even though it doesn't itself create a lead for the venue — it's a legitimate destination, just one where "conversion" naturally stays at zero, which is fine and expected, not a bug; `external_url` is an escape hatch for anything not modeled here (a venue's own separate landing page, a social profile, etc.) — those scans still get counted, but obviously can't be attributed to a created Lead since Wevenu never sees what happens after the redirect.

### 2.2 `qr_scans` — the event log

Modeled on `couple_website_views`'s exact shape (append-only, non-critical, written as a side effect inside the resolve RPC itself):

```sql
create table public.qr_scans (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues(id) on delete cascade,
  campaign_id  uuid not null references public.qr_campaigns(id) on delete cascade,
  scanned_at   timestamptz not null default now(),
  user_agent   text,
  referrer     text
);
create index qr_scans_campaign on public.qr_scans (campaign_id, scanned_at desc);
```
No `session_id`/`guest_token` columns (unlike `couple_website_views`) — a QR scan is anonymous foot traffic, there's no authenticated party to correlate across multiple scans the way a couple's own guests might be tracked. RLS: `venue_id = current_user_venue_id()` for `select` (a venue reads its own analytics); no `authenticated`-role `insert` grant needed since inserts only happen inside the `SECURITY DEFINER` resolver RPC, same as `couple_website_views`.

### 2.3 Conversion attribution — no new column needed on `leads`

`leads.source_data` (jsonb) already exists and already documents an expected shape including `form_key` for the existing public-form flow (`supabase/migrations/20260627220000_lead_capture.sql:33-45`). A QR-attributed lead simply carries `source_data->>'qr_campaign_id'` alongside whatever else its actual destination's source adapter already populates. "Conversions" and "created leads" for a campaign are then a straightforward `leads where source_data->>'qr_campaign_id' = ...` query — no schema change to `leads` itself.

### 2.4 `lead_sources` — one new row, not a schema change

Per that table's own designed extensibility (a migration `insert`, not a constraint change): `('qr_code', 'QR Code', 'direct', 'form', false)`. This is used specifically when a QR scan lands on the inquiry-form destination and that form submission becomes a Lead — the *display* source is "QR Code," while *which* campaign is still carried in `source_data` as above. (When a QR's destination is `tour_booking`, the resulting Lead's `source` stays whatever tour-booking already uses today — `source_data->>'qr_campaign_id'` is what ties it back to the campaign either way, `source` itself doesn't need to change per-destination.)

---

## 3. Scan → redirect flow

No existing route in this codebase does "public URL that records something then redirects" (the closest analog, `get_wedding_website`, records-then-renders-in-place, it doesn't redirect elsewhere) — this is genuinely new, but a straightforward composition of two proven pieces.

**`public.resolve_qr_scan(p_code text)`** — `SECURITY DEFINER`, granted to `anon, authenticated`, mirrors `get_wedding_website`'s insert-then-return body:
```sql
create or replace function public.resolve_qr_scan(p_code text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_campaign qr_campaigns%rowtype;
begin
  select * into v_campaign from qr_campaigns where code = p_code and status = 'active';
  if not found then
    return jsonb_build_object('ok', false);
  end if;

  begin
    insert into qr_scans (venue_id, campaign_id) values (v_campaign.venue_id, v_campaign.id);
  exception when others then null;  -- non-critical, same swallow-and-continue as couple_website_views
  end;

  return jsonb_build_object(
    'ok', true,
    'destinationType', v_campaign.destination_type,
    'destinationUrl', v_campaign.destination_url,
    'venueId', v_campaign.venue_id,
    'campaignId', v_campaign.id
  );
end;
$$;
```

**`app/qr/[code]/route.ts`** — a Route Handler (not a page component, since its only job is to redirect, never render):
```
GET /qr/{code}
  → resolve_qr_scan(code)
  → not found or archived: redirect to a generic "this code is no longer active" page (or the venue's own site — TBD, open decision)
  → found: build the real destination URL from destinationType (+ the venue's own embed_key/tour_embed_key/website slug, fetched in the same call or a follow-up lookup) and 302-redirect
```
The `campaign_id` needs to travel with the redirect so the *eventual* Lead submission (which happens on a *separate* page load, after the redirect) can still attribute back to this campaign — carried as a query parameter on the destination URL (e.g. `?qr={campaign_id}`), read by whichever destination page/form ultimately creates the Lead and stashed into that submission's `source_data`. This is the one piece of real design risk in this whole feature and needs explicit confirmation (see Open Decisions) — it means every existing lead-capture destination (`app/form/[key]`, `app/book/[key]`) needs a small, additive change to read an optional `?qr=` param and thread it through to `source_data`, rather than QR capture being fully self-contained.

Proxy allowlist: `/qr` needs to be added to `integrations/supabase/proxy.ts`'s `PUBLIC_PATHS` (same class of fix needed elsewhere this sprint) since a scan has no session.

---

## 4. QR image generation

Already solved — the `qrcode` npm package is already installed and already used once (`app/api/portal/website/qr/route.ts`, SVG output). A near-identical route, `app/api/qr-campaigns/[id]/image/route.ts` (or a query-param variant), generates the actual scannable image for `https://{app-url}/qr/{code}`, reusing the exact same `QRCode.toString(url, { type: "svg", ... })` call. No new dependency needed.

---

## 5. Analytics

Per-campaign, straightforward aggregate queries — no new infrastructure beyond the two tables above:

- **Scans**: `count(*) from qr_scans where campaign_id = ...` (with a date-range filter for a "last 30 days" view).
- **Conversions / created leads**: `count(*) from leads where source_data->>'qr_campaign_id' = ...` — "conversions" and "created leads" are the same number for this feature (a QR scan either results in a Lead or it doesn't; there's no separate intermediate "conversion" event distinct from lead creation the way, say, a tour funnel has "toured" as a stage between "contacted" and "booked"). If a richer funnel is wanted later (scan → landed on form → started filling it out → submitted), that would need new client-side event tracking not covered by this design — flagging as a possible future extension, not assumed as in-scope now.
- **Scan-to-conversion rate**: `conversions / scans`, computed at read time, same pattern as `LeadFunnel.conversionRate` (`lib/analytics/types.ts`) already does elsewhere.
- A per-venue rollup view (all campaigns, sortable by scans/conversions) extends naturally from the same two tables — this is the kind of aggregate `get_venue_analytics()`-style RPC this codebase already has a template for (`supabase/migrations/20260711000002_sprint87_venue_analytics.sql`).

---

## 6. UI

Modeled directly on Pipeline Templates' CRUD shape (`lib/pipeline-templates/`, `app/(app)/library/pipeline-templates/`) — the simplest existing "venue creates unlimited freely-named things" pattern in this codebase, closer to what QR campaigns need than Playbooks' heavier milestone/task structure:

- New library section, e.g. `app/(app)/library/qr-campaigns/page.tsx` — list view, empty state with a "+ New Campaign" CTA, mirroring `app/(app)/library/pipeline-templates/page.tsx`'s exact shape.
- Create/edit form: name, destination type (a select), destination-specific fields (external URL text input, shown only when `destination_type = 'external_url'`), and — on save — the generated code/QR image shown immediately, with a download/print-ready option.
- List rows show name, destination, scans, conversions, and an archive action — following Playbooks' `is_archived`/`includeArchived` convention (a more literal match for "archive a QR campaign that's done" than Pipeline Templates' `isActive`).
- A campaign detail view (or an expandable row) shows the scan/conversion numbers over time and a link to the actual created Leads (filtered by `source_data->>'qr_campaign_id'`).

---

## 7. Verification plan

1. Real fixture: create a campaign, resolve its code via the RPC directly (SQL), confirm a `qr_scans` row is written and the correct destination payload comes back.
2. `curl` the actual `/qr/{code}` route with no session, confirm the 302 redirect fires to the correct destination with `?qr=` correctly appended.
3. Submit a real inquiry-form/tour-booking lead through a QR-tagged destination URL, confirm the resulting Lead's `source_data->>'qr_campaign_id'` matches the campaign, and that it shows up correctly in that campaign's analytics.
4. Confirm an archived campaign's code returns "not found" from the resolver (no scan recorded, no redirect) rather than continuing to route traffic to an intentionally-retired code.
5. Confirm the generated QR image actually scans (via a real phone camera) to the correct short URL — the one piece of this that benefits from an actual physical device test, not just a curl/database check.
6. Standard `tsc --noEmit` / `next build` clean, fixtures cleaned to zero residue.

---

## 8. Open decisions needing approval before coding starts

1. **Threading `?qr=` through existing destination pages (§3)** — this is the one place this feature reaches outside its own new tables into `app/form/[key]` and `app/book/[key]`. Confirm this small additive change to those two existing routes is in scope for this feature's implementation.
2. **"Code no longer active" destination** — what should an archived/invalid code redirect to? A generic Wevenu-hosted "this code is no longer active" page, or fail more silently (404)? Recommend a simple generic page rather than a bare 404, since a printed QR code (e.g. on a brochure) can't be un-printed — a dead link should say something, not just error.
3. **Conversion definition (§5)** — confirmed as "scan resulted in a created Lead," with no intermediate funnel stage. Confirm this matches intent, or specify if a richer multi-stage funnel (requiring new client-side tracking) is actually wanted now rather than later.
4. **`wedding_website` as a destination type with structurally-guaranteed zero conversions** — confirm this is still worth supporting as a destination choice (a legitimate physical-collateral use case) even though it can never show a non-zero conversion number in this design.
