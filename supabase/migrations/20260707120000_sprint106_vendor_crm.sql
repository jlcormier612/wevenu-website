-- Sprint 106 — VendorOS CRM
-- Adds inquiry pipeline, personal tasks, health score, message thread vendor support,
-- and couple-sharing granularity to the vendor portal.

-- ── STEP 1: vendor_inquiries ──────────────────────────────────────────────────
-- Vendor's private CRM pipeline. Not visible to venues.

create table if not exists public.vendor_inquiries (
  id                         uuid primary key default gen_random_uuid(),
  vendor_id                  uuid not null references public.vendors(id) on delete cascade,
  venue_id                   uuid references public.venues(id) on delete set null,
  event_vendor_assignment_id uuid references public.event_vendor_assignments(id) on delete set null,
  source        text not null default 'manual',
  -- 'direct' | 'marketplace' | 'referral' | 'manual'
  status        text not null default 'new',
  -- 'new' | 'contacted' | 'consultation_scheduled' | 'proposal_sent' | 'booked' | 'declined' | 'lost'
  contact_name  text,
  contact_email text,
  event_date    date,
  event_type    text,
  notes         text,
  follow_up_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.vendor_inquiries enable row level security;

create policy "vendor_inquiries_vendor_access" on public.vendor_inquiries
  using (
    vendor_id in (
      select vendor_id from public.vendor_users
      where user_id = auth.uid() and is_active = true
    )
  );

-- ── STEP 2: vendor_tasks ──────────────────────────────────────────────────────
-- Personal tasks for vendors (not event-scoped event_tasks).
-- Can optionally link to an inquiry or event for context.

create table if not exists public.vendor_tasks (
  id                uuid primary key default gen_random_uuid(),
  vendor_id         uuid not null references public.vendors(id) on delete cascade,
  vendor_inquiry_id uuid references public.vendor_inquiries(id) on delete set null,
  event_id          uuid references public.events(id) on delete set null,
  title             text not null,
  due_date          date,
  status            text not null default 'pending',
  -- 'pending' | 'complete'
  source            text not null default 'manual',
  -- 'manual' | 'venue' | 'luv' | 'automation'
  notes             text,
  completed_at      timestamptz,
  created_at        timestamptz not null default now()
);

alter table public.vendor_tasks enable row level security;

create policy "vendor_tasks_vendor_access" on public.vendor_tasks
  using (
    vendor_id in (
      select vendor_id from public.vendor_users
      where user_id = auth.uid() and is_active = true
    )
  );

-- ── STEP 3: vendor_health_scores ─────────────────────────────────────────────
-- Cached computed health score. Mirrors venue_health_scores pattern.
-- Only visible to the vendor themselves.

create table if not exists public.vendor_health_scores (
  vendor_id   uuid primary key references public.vendors(id) on delete cascade,
  score       integer     not null default 0,
  tier        text        not null default 'needs_attention',
  -- 'thriving' | 'growing' | 'needs_attention'
  dimensions  jsonb       not null default '{}',
  strengths   jsonb       not null default '[]',
  gaps        jsonb       not null default '[]',
  luv_tip     text,
  computed_at timestamptz not null default now()
);

-- ── STEP 4: Extend message_threads with vendor_id ─────────────────────────────
-- Option B: venue remains the owning context; vendor_id is a participant FK.
-- Allows vendor to query "my threads" without changing existing venue-side logic.

alter table public.message_threads
  add column if not exists vendor_id uuid references public.vendors(id) on delete set null;

create index if not exists idx_message_threads_vendor_id
  on public.message_threads (vendor_id)
  where vendor_id is not null;

-- ── STEP 5: Extend event_vendor_assignments ───────────────────────────────────
-- Granular couple contact sharing (venue controls, vendor reads).
-- internal_notes: vendor-private note visible only to the vendor.

alter table public.event_vendor_assignments
  add column if not exists share_couple_email   boolean not null default false,
  add column if not exists share_couple_phone   boolean not null default false,
  add column if not exists share_couple_address boolean not null default false,
  add column if not exists internal_notes       text;
