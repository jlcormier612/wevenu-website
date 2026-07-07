-- ============================================================================
-- Sprint 104.5 — Vendor Foundation
-- "Vendors become first-class global entities"
--
-- ARCHITECTURAL DECISIONS:
--   1. vendors is now a global entity — not scoped to any venue
--   2. venue_vendor_relationships is the many-to-many join (replaces vendors.venue_id)
--   3. vendor_id is the parent entity for all vendor-owned data
--   4. vendor_users maps auth.users to vendor entities with explicit roles
--   5. venue-specific fields (preference_level, display_order, is_active, notes)
--      migrate from vendors → venue_vendor_relationships
--   6. claim_vendor_profile() handles the venue-invites → vendor-claims flow
--      with a flag for when a user already has a vendor account (merge prompt)
--
-- MIGRATION STRATEGY:
--   All existing vendors data seeds venue_vendor_relationships before columns drop.
--   No data loss. All FKs from event_vendor_assignments remain valid (vendors.id unchanged).
-- ============================================================================

-- ── STEP 1: venue_vendor_relationships ────────────────────────────────────────
-- Created BEFORE we drop vendors.venue_id so the migration INSERT below works.

create table public.venue_vendor_relationships (
  id               uuid        primary key default gen_random_uuid(),
  venue_id         uuid        not null references public.venues(id)   on delete cascade,
  vendor_id        uuid        not null references public.vendors(id)  on delete cascade,
  status           text        not null default 'active'
                               check (status in ('invited', 'active', 'preferred', 'removed')),
  is_preferred     boolean     not null default false,
  -- Venue's subjective categorisation of this vendor
  preference_level text        not null default 'recommended'
                               check (preference_level in ('featured', 'preferred', 'recommended')),
  -- Venue-specific ordering, notes, active flag
  display_order    integer     not null default 0,
  is_active        boolean     not null default true,
  notes            text,
  added_by_user_id uuid        references auth.users(id) on delete set null,
  added_at         timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (venue_id, vendor_id)
);

create index vvr_venue             on public.venue_vendor_relationships (venue_id);
create index vvr_vendor            on public.venue_vendor_relationships (vendor_id);
create index vvr_venue_active_pref on public.venue_vendor_relationships (venue_id, is_active, preference_level, display_order)
  where is_active = true;

create trigger vvr_updated_at
  before update on public.venue_vendor_relationships
  for each row execute function public.set_updated_at();

-- ── STEP 1b: vendor_users (table only — moved ahead of its original STEP 10
-- position). STEP 8's RLS on `vendors` and STEP 9's RLS on
-- `venue_vendor_relationships` both reference `vendor_users` in their USING
-- clauses; CREATE POLICY resolves those references at creation time, so the
-- table has to exist before STEP 8, not just before vendor_users' own RLS is
-- enabled. Its RLS enablement + policies stay at the original STEP 10 spot
-- below — only the table definition needed to move.
-- Maps Supabase auth.users to vendor entities.
-- vendor_id (not user_id) is the parent entity for all vendor-owned data.
-- Roles: owner > manager > staff > contractor (controls edit permissions).

create table public.vendor_users (
  id          uuid        primary key default gen_random_uuid(),
  vendor_id   uuid        not null references public.vendors(id) on delete cascade,
  user_id     uuid        not null references auth.users(id)     on delete cascade,
  role        text        not null default 'staff'
                          check (role in ('owner', 'manager', 'staff', 'contractor')),
  invited_by  uuid        references auth.users(id) on delete set null,
  invited_at  timestamptz not null default now(),
  accepted_at timestamptz,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  unique (vendor_id, user_id)
);

create index vendor_users_vendor on public.vendor_users (vendor_id);
create index vendor_users_user   on public.vendor_users (user_id);

-- ── STEP 2: Migrate existing venue-scoped vendor data ────────────────────────
-- Seed one relationship row per existing vendor. Captures all venue-specific
-- fields before they are dropped from vendors in Step 6.

insert into public.venue_vendor_relationships
  (venue_id, vendor_id, status, is_preferred, preference_level, display_order, is_active, notes, added_at)
select
  venue_id,
  id,
  'active',
  coalesce(is_preferred, false),
  coalesce(preference_level, 'recommended'),
  coalesce(display_order, 0),
  coalesce(is_active, true),
  notes,
  created_at
from public.vendors;

-- ── STEP 3: Rename columns on vendors ────────────────────────────────────────

alter table public.vendors rename column name      to business_name;
alter table public.vendors rename column website   to website_url;
alter table public.vendors rename column photo_url to logo_url;

-- ── STEP 4: Add all new global fields ────────────────────────────────────────

alter table public.vendors
  add column if not exists hero_image_url        text,
  add column if not exists cover_image_url       text,
  add column if not exists service_area          text,
  add column if not exists insurance_expiry      date,
  -- Marketplace
  add column if not exists profile_slug          text unique,
  add column if not exists is_marketplace_listed boolean not null default false,
  -- Reputation (denormalized; kept current by trigger on vendor_reviews)
  add column if not exists average_rating        numeric(3,2),
  add column if not exists review_count          integer not null default 0,
  -- Subscription hooks (null = not yet assigned; billing is a future sprint)
  add column if not exists subscription_tier     text
                           check (subscription_tier in ('free', 'starter', 'pro', 'marketplace')),
  add column if not exists subscription_status   text
                           check (subscription_status in ('active', 'trialing', 'past_due', 'canceled', 'none')),
  add column if not exists trial_ends_at         timestamptz,
  -- Claiming (is_claimed=false means created by a venue, not yet owned by a vendor user)
  add column if not exists is_claimed            boolean not null default false,
  add column if not exists claim_token           text    unique default encode(gen_random_bytes(24), 'hex');

-- ── STEP 5: Migrate pricing_tier values and update check constraint ───────────
-- Existing: budget | moderate | luxury
-- New:      budget | mid_range | premium | luxury  ('moderate' → 'mid_range')

update public.vendors set pricing_tier = 'mid_range' where pricing_tier = 'moderate';

do $$
declare v_cname text;
begin
  select conname into v_cname
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public' and t.relname = 'vendors' and c.contype = 'c'
    and c.conname like '%pricing_tier%';
  if v_cname is not null then
    execute 'alter table public.vendors drop constraint ' || quote_ident(v_cname);
  end if;
end $$;

alter table public.vendors
  add constraint vendors_pricing_tier_check
  check (pricing_tier in ('budget', 'mid_range', 'premium', 'luxury'));

-- ── STEP 6: Drop venue-scoped columns from vendors ───────────────────────────
-- Drop old indexes first, then constraints, then columns.

drop index if exists public.vendors_venue;
drop index if exists public.vendors_pref_name;

do $$
declare v_cname text;
begin
  -- Drop the preference_level check constraint
  select conname into v_cname
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public' and t.relname = 'vendors' and c.contype = 'c'
    and c.conname like '%preference_level%';
  if v_cname is not null then
    execute 'alter table public.vendors drop constraint ' || quote_ident(v_cname);
  end if;
end $$;

-- Drop the old RLS policy before we remove venue_id (policy references venue_id)
drop policy if exists vendors_all on public.vendors;

alter table public.vendors
  drop column if exists venue_id,
  drop column if exists is_preferred,
  drop column if exists notes,
  drop column if exists preference_level,
  drop column if exists display_order,
  drop column if exists is_active;

-- ── STEP 7: New indexes on vendors ───────────────────────────────────────────

create index vendors_category    on public.vendors (category) where category is not null;
create index vendors_marketplace on public.vendors (is_marketplace_listed, category)
  where is_marketplace_listed = true;
create index vendors_slug        on public.vendors (profile_slug) where profile_slug is not null;
create index vendors_unclaimed   on public.vendors (is_claimed)   where is_claimed = false;

-- ── STEP 8: New RLS on vendors ────────────────────────────────────────────────
-- Venues see vendors they have an active (non-removed) relationship with.
-- Vendor users (all roles) see and update their own profile.
-- Anyone can create an unclaimed vendor (server-side operation from venue dashboard).

create policy "venues_select_related_vendors" on public.vendors
  for select using (
    exists (
      select 1 from public.venue_vendor_relationships vvr
      join public.venues v on v.id = vvr.venue_id
      where vvr.vendor_id = vendors.id
        and vvr.status != 'removed'
        and v.owner_user_id = auth.uid()
    )
    or
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendors.id
        and vu.user_id = auth.uid()
        and vu.is_active = true
    )
  );

create policy "venues_insert_vendors" on public.vendors
  for insert with check (
    exists (select 1 from public.venues where owner_user_id = auth.uid())
  );

create policy "vendor_users_update_profile" on public.vendors
  for update using (
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendors.id
        and vu.user_id = auth.uid()
        and vu.role in ('owner', 'manager')
        and vu.is_active = true
    )
  );

-- ── STEP 9: RLS on venue_vendor_relationships ─────────────────────────────────

alter table public.venue_vendor_relationships enable row level security;

create policy "venues_manage_relationships" on public.venue_vendor_relationships
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy "vendors_see_own_relationships" on public.venue_vendor_relationships
  for select using (
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = venue_vendor_relationships.vendor_id
        and vu.user_id = auth.uid()
        and vu.is_active = true
    )
  );

grant select, insert, update, delete on public.venue_vendor_relationships to authenticated;

-- ── STEP 10: vendor_users RLS ─────────────────────────────────────────────────
-- Table itself now created in STEP 1b, above — see that step's comment for why.

alter table public.vendor_users enable row level security;

-- Team members see each other
create policy "vendor_users_see_own_team" on public.vendor_users
  for select using (
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_users.vendor_id
        and vu.user_id = auth.uid()
        and vu.is_active = true
    )
  );

-- Owners and managers manage team membership
create policy "vendor_owners_manage_team" on public.vendor_users
  for all using (
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_users.vendor_id
        and vu.user_id = auth.uid()
        and vu.role in ('owner', 'manager')
        and vu.is_active = true
    )
  );

-- Venues can see the team for vendors they work with (for event coordination)
create policy "venues_see_vendor_team" on public.vendor_users
  for select using (
    exists (
      select 1 from public.venue_vendor_relationships vvr
      join public.venues v on v.id = vvr.venue_id
      where vvr.vendor_id = vendor_users.vendor_id
        and vvr.status != 'removed'
        and v.owner_user_id = auth.uid()
    )
  );

grant select, insert, update on public.vendor_users to authenticated;

-- ── STEP 11: vendor_portal_sessions — add vendor_user_id ──────────────────────
-- Null for token-only sessions (unauthenticated portal), populated for
-- vendor users who have claimed their profile and log in with credentials.

alter table public.vendor_portal_sessions
  add column if not exists vendor_user_id uuid references auth.users(id) on delete set null;

-- ── STEP 12: vendor_invitations ──────────────────────────────────────────────
-- The venue-invites-vendor flow. vendor_id is null when the vendor doesn't
-- yet have a profile; once the vendor clicks the link and creates one, it's set.

create table public.vendor_invitations (
  id          uuid        primary key default gen_random_uuid(),
  venue_id    uuid        not null references public.venues(id)   on delete cascade,
  vendor_id   uuid                 references public.vendors(id)  on delete set null,
  email       text        not null,
  token       text        not null unique default encode(gen_random_bytes(32), 'hex'),
  status      text        not null default 'pending'
                          check (status in ('pending', 'accepted', 'expired', 'revoked')),
  message     text,
  expires_at  timestamptz not null default now() + interval '7 days',
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);

create index vendor_invitations_token  on public.vendor_invitations (token);
create index vendor_invitations_venue  on public.vendor_invitations (venue_id);
create index vendor_invitations_vendor on public.vendor_invitations (vendor_id) where vendor_id is not null;
create index vendor_invitations_status on public.vendor_invitations (status)    where status = 'pending';

alter table public.vendor_invitations enable row level security;

create policy "venues_manage_invitations" on public.vendor_invitations
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.vendor_invitations to authenticated;

-- ── STEP 13: vendor_packages ─────────────────────────────────────────────────
-- Vendor's reusable service offerings. Parent entity: vendor_id.

create table public.vendor_packages (
  id          uuid        primary key default gen_random_uuid(),
  vendor_id   uuid        not null references public.vendors(id) on delete cascade,
  name        text        not null,
  description text,
  price       numeric(10,2),
  price_type  text        not null default 'contact'
                          check (price_type in ('fixed', 'starting_at', 'custom', 'contact')),
  is_active   boolean     not null default true,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index vendor_packages_vendor on public.vendor_packages (vendor_id, sort_order);

alter table public.vendor_packages enable row level security;

create policy "venues_see_vendor_packages" on public.vendor_packages
  for select using (
    exists (
      select 1 from public.venue_vendor_relationships vvr
      join public.venues v on v.id = vvr.venue_id
      where vvr.vendor_id = vendor_packages.vendor_id
        and vvr.status != 'removed'
        and v.owner_user_id = auth.uid()
    )
    or
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_packages.vendor_id
        and vu.user_id = auth.uid()
        and vu.is_active = true
    )
  );

create policy "vendor_users_manage_packages" on public.vendor_packages
  for all using (
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_packages.vendor_id
        and vu.user_id = auth.uid()
        and vu.role in ('owner', 'manager')
        and vu.is_active = true
    )
  );

grant select, insert, update, delete on public.vendor_packages to authenticated;

create trigger vendor_packages_updated_at
  before update on public.vendor_packages
  for each row execute function public.set_updated_at();

-- ── STEP 14: vendor_availability ─────────────────────────────────────────────
-- Vendor's blocked dates. One row per date per vendor.
-- Venues read this when booking to check conflicts.

create table public.vendor_availability (
  id         uuid        primary key default gen_random_uuid(),
  vendor_id  uuid        not null references public.vendors(id) on delete cascade,
  date       date        not null,
  is_blocked boolean     not null default true,
  note       text,
  created_at timestamptz not null default now(),
  unique (vendor_id, date)
);

create index vendor_availability_vendor_date on public.vendor_availability (vendor_id, date);

alter table public.vendor_availability enable row level security;

create policy "venues_see_vendor_availability" on public.vendor_availability
  for select using (
    exists (
      select 1 from public.venue_vendor_relationships vvr
      join public.venues v on v.id = vvr.venue_id
      where vvr.vendor_id = vendor_availability.vendor_id
        and vvr.status != 'removed'
        and v.owner_user_id = auth.uid()
    )
    or
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_availability.vendor_id
        and vu.user_id = auth.uid()
        and vu.is_active = true
    )
  );

create policy "vendor_users_manage_availability" on public.vendor_availability
  for all using (
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_availability.vendor_id
        and vu.user_id = auth.uid()
        and vu.is_active = true
    )
  );

grant select, insert, update, delete on public.vendor_availability to authenticated;

-- ── STEP 15: vendor_reviews ───────────────────────────────────────────────────
-- Stub table ready for Sprint 108. reviewer_type supports both venue and couple
-- reviewers. average_rating / review_count on vendors are kept current by trigger.

create table public.vendor_reviews (
  id            uuid        primary key default gen_random_uuid(),
  vendor_id     uuid        not null references public.vendors(id)  on delete cascade,
  reviewer_type text        not null default 'venue'
                            check (reviewer_type in ('venue', 'couple')),
  -- Venue reviewer
  venue_id      uuid                 references public.venues(id)   on delete set null,
  event_id      uuid                 references public.events(id)   on delete set null,
  -- Couple reviewer (Sprint 108+)
  client_id     uuid                 references public.clients(id)  on delete set null,
  -- Content
  rating        integer     not null check (rating between 1 and 5),
  body          text,
  is_public     boolean     not null default false,
  created_at    timestamptz not null default now()
);

create index vendor_reviews_vendor on public.vendor_reviews (vendor_id);
create index vendor_reviews_venue  on public.vendor_reviews (venue_id) where venue_id is not null;

alter table public.vendor_reviews enable row level security;

create policy "venues_manage_reviews" on public.vendor_reviews
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy "vendors_see_own_reviews" on public.vendor_reviews
  for select using (
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_reviews.vendor_id
        and vu.user_id = auth.uid()
        and vu.is_active = true
    )
  );

grant select, insert, update, delete on public.vendor_reviews to authenticated;

-- Trigger: keep vendors.average_rating + review_count current
create or replace function public.update_vendor_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_vendor_id uuid := coalesce(new.vendor_id, old.vendor_id);
begin
  update public.vendors set
    review_count   = (select count(*)          from public.vendor_reviews where vendor_id = v_vendor_id),
    average_rating = (select round(avg(rating)::numeric, 2) from public.vendor_reviews where vendor_id = v_vendor_id)
  where id = v_vendor_id;
  return coalesce(new, old);
end $$;

create trigger vendor_reviews_update_rating
  after insert or update or delete on public.vendor_reviews
  for each row execute function public.update_vendor_rating();

-- ── STEP 16: vendor_notification_preferences ─────────────────────────────────
-- One row per vendor. Channels + event types + digest mode.
-- All columns are nullable-free with defaults so there's no "half-configured" state.

create table public.vendor_notification_preferences (
  id                  uuid        primary key default gen_random_uuid(),
  vendor_id           uuid        not null references public.vendors(id) on delete cascade,
  -- Channel toggles
  email_enabled       boolean     not null default true,
  sms_enabled         boolean     not null default false,
  push_enabled        boolean     not null default false,
  in_app_enabled      boolean     not null default true,
  -- Digest
  digest_mode         text        not null default 'instant'
                                  check (digest_mode in ('instant', 'daily', 'weekly', 'none')),
  digest_hour         smallint    not null default 8 check (digest_hour between 0 and 23),
  -- Event type toggles
  notify_new_inquiry  boolean     not null default true,
  notify_new_message  boolean     not null default true,
  notify_task_due     boolean     not null default true,
  notify_event_update boolean     not null default true,
  notify_review       boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (vendor_id)
);

alter table public.vendor_notification_preferences enable row level security;

create policy "vendor_users_manage_prefs" on public.vendor_notification_preferences
  for all using (
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_notification_preferences.vendor_id
        and vu.user_id = auth.uid()
        and vu.is_active = true
    )
  );

grant select, insert, update, delete on public.vendor_notification_preferences to authenticated;

create trigger vendor_notification_preferences_updated_at
  before update on public.vendor_notification_preferences
  for each row execute function public.set_updated_at();

-- ── STEP 17: Actor resolver ───────────────────────────────────────────────────
-- Returns the actor type and primary entity for the current session.
-- Drives routing in middleware: venue dashboard vs. vendor dashboard vs. portal.
-- Priority: venue_owner > vendor (a user can only be one primary actor type).

create or replace function public.get_actor_context()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_venue_id  uuid;
  v_vendor_id uuid;
  v_role      text;
begin
  -- Venue owner takes priority
  select id into v_venue_id from public.venues
  where owner_user_id = auth.uid() limit 1;

  if v_venue_id is not null then
    return jsonb_build_object(
      'actor_type', 'venue_owner',
      'entity_id',  v_venue_id,
      'role',       'owner'
    );
  end if;

  -- Vendor user (highest role wins when user belongs to multiple vendors)
  select vendor_id, role into v_vendor_id, v_role
  from public.vendor_users
  where user_id = auth.uid() and is_active = true
  order by case role when 'owner' then 1 when 'manager' then 2 when 'staff' then 3 else 4 end
  limit 1;

  if v_vendor_id is not null then
    return jsonb_build_object(
      'actor_type', 'vendor',
      'entity_id',  v_vendor_id,
      'role',       v_role
    );
  end if;

  return jsonb_build_object('actor_type', 'unknown');
end $$;

grant execute on function public.get_actor_context() to authenticated;

-- ── STEP 18: claim_vendor_profile() ──────────────────────────────────────────
-- Called during the vendor onboarding flow when a vendor clicks an invitation
-- link. Atomically marks the profile as claimed and creates a vendor_users row.
--
-- Returns already_vendor=true when the user already has another vendor account
-- so the UI can offer a "link to existing account" merge prompt.

create or replace function public.claim_vendor_profile(
  p_claim_token text,
  p_role        text default 'owner'
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_vendor  public.vendors%rowtype;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_role not in ('owner', 'manager', 'staff', 'contractor') then
    return jsonb_build_object('ok', false, 'error', 'invalid_role');
  end if;

  select * into v_vendor from public.vendors
  where claim_token = p_claim_token and is_claimed = false;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_already_claimed');
  end if;

  insert into public.vendor_users (vendor_id, user_id, role, accepted_at)
  values (v_vendor.id, v_user_id, p_role, now())
  on conflict (vendor_id, user_id) do update set is_active = true, role = excluded.role, accepted_at = now();

  update public.vendors set is_claimed = true, claim_token = null where id = v_vendor.id;

  -- Create default notification preferences for the newly claimed vendor
  insert into public.vendor_notification_preferences (vendor_id) values (v_vendor.id)
  on conflict (vendor_id) do nothing;

  return jsonb_build_object(
    'ok',            true,
    'vendor_id',     v_vendor.id,
    -- True when this user already manages another vendor — surface a merge/link prompt
    'already_vendor', exists (
      select 1 from public.vendor_users
      where user_id = v_user_id and vendor_id != v_vendor.id and is_active = true
    )
  );
end $$;

grant execute on function public.claim_vendor_profile(text, text) to authenticated, anon;

-- ── STEP 19: Update get_vendor_portal_context to use business_name ────────────

create or replace function public.get_vendor_portal_context(p_token text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_session public.vendor_portal_sessions%rowtype;
  v_vendor  public.vendors%rowtype;
  v_venue   public.venues%rowtype;
  v_events  jsonb;
begin
  select * into v_session from public.vendor_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  update public.vendor_portal_sessions set last_accessed_at = now() where id = v_session.id;

  select * into v_vendor from public.vendors where id = v_session.vendor_id;
  select * into v_venue  from public.venues  where id = v_session.venue_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'eventId',         e.id,
      'eventName',       e.name,
      'eventDate',       e.event_date,
      'eventType',       e.event_type,
      'status',          e.status,
      'coupleNames',     c.first_name || coalesce(' & ' || c.partner_first_name, ''),
      'assignmentId',    eva.id,
      'arrivalTime',     eva.arrival_time::text,
      'setupLocation',   eva.setup_location,
      'loadInNotes',     eva.load_in_notes,
      'checkedInAt',     eva.checked_in_at,
      'setupCompleteAt', eva.setup_complete_at,
      'role',            null
    ) order by e.event_date asc
  ), '[]'::jsonb) into v_events
  from public.event_vendor_assignments eva
  join public.events e   on e.id = eva.event_id
  left join public.clients c on c.id = e.client_id
  where eva.vendor_id = v_session.vendor_id
    and eva.venue_id  = v_session.venue_id
    and e.status not in ('cancelled')
    and e.event_date >= current_date - 30;

  return jsonb_build_object(
    'sessionId',   v_session.id,
    'accessLevel', v_session.access_level,
    'vendor', jsonb_build_object(
      'id',           v_vendor.id,
      'businessName', v_vendor.business_name,
      'category',     v_vendor.category,
      'email',        v_vendor.email,
      'phone',        v_vendor.phone
    ),
    'venue', jsonb_build_object(
      'id',   v_venue.id,
      'name', v_venue.name
    ),
    'events', v_events
  );
end $$;

-- ── STEP 20: Update portal vendor recommendations RPC (Sprint 71) ────────────
-- get_portal_vendors uses vendors.name — update to business_name.
-- Also joins venue_vendor_relationships for preference/display ordering
-- since those fields are no longer on vendors.

create or replace function public.get_portal_vendors(p_client_id uuid, p_access_token text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_session_venue_id uuid;
  v_vendors jsonb;
begin
  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());

  if v_session_venue_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.venue_id = v_session_venue_id
  ) then
    return jsonb_build_object('error', 'unauthorized');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',              vnd.id,
      'name',            vnd.business_name,
      'category',        vnd.category,
      'preferenceLevel', vvr.preference_level,
      'description',     vnd.description,
      'photoUrl',        vnd.logo_url,
      'websiteUrl',      vnd.website_url,
      'instagramUrl',    vnd.instagram_url,
      'pricingTier',     vnd.pricing_tier,
      'email',           vnd.email
    ) order by
      case vvr.preference_level when 'featured' then 1 when 'preferred' then 2 else 3 end,
      vvr.display_order,
      vnd.business_name
  ), '[]'::jsonb) into v_vendors
  from public.vendors vnd
  join public.venue_vendor_relationships vvr
    on vvr.vendor_id = vnd.id and vvr.venue_id = v_session_venue_id
  where vvr.is_active = true
    and vvr.status != 'removed';

  return jsonb_build_object('vendors', coalesce(v_vendors, '[]'::jsonb));
end $$;

notify pgrst, 'reload schema';
