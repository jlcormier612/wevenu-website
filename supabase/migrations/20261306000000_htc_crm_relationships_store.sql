-- ============================================================================
-- HTC Relationships CRM — durable Postgres source of truth
--
-- Replaces the task-local JSONL store (RELATIONSHIPS_DATA_PATH) used by
-- marketing + workspace. Service-role only (HTC ops data, not venue RLS).
--
-- Collections mirror shared/relationships STORE_FILES. Documents are stored
-- as jsonb; indexed columns support boards, lifecycle, and dedupe lookups.
-- Load/replace RPCs preserve the existing load-all / mutate / save-all API
-- under a transactional advisory lock.
-- ============================================================================

create table public.htc_crm_relationships (
  id text primary key,
  owner_email text,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  status text,
  sales_stage text,
  customer_success_stage text,
  plan_id text,
  onboarding_type text,
  founding_member boolean not null default false,
  document jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index htc_crm_relationships_owner_email
  on public.htc_crm_relationships (lower(owner_email))
  where owner_email is not null;

create index htc_crm_relationships_stripe_customer
  on public.htc_crm_relationships (stripe_customer_id)
  where stripe_customer_id is not null;

create index htc_crm_relationships_stripe_subscription
  on public.htc_crm_relationships (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index htc_crm_relationships_stripe_checkout
  on public.htc_crm_relationships (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index htc_crm_relationships_status
  on public.htc_crm_relationships (status);

create index htc_crm_relationships_sales_stage
  on public.htc_crm_relationships (sales_stage);

create index htc_crm_relationships_cs_stage
  on public.htc_crm_relationships (customer_success_stage);

create table public.htc_crm_timeline_events (
  id text primary key,
  relationship_id text not null,
  occurred_at timestamptz,
  event_type text,
  document jsonb not null,
  created_at timestamptz not null default now()
);

create index htc_crm_timeline_events_relationship
  on public.htc_crm_timeline_events (relationship_id, occurred_at desc);

create table public.htc_crm_communications (
  id text primary key,
  relationship_id text not null,
  occurred_at timestamptz,
  document jsonb not null,
  created_at timestamptz not null default now()
);

create index htc_crm_communications_relationship
  on public.htc_crm_communications (relationship_id, occurred_at desc);

create table public.htc_crm_walkthroughs (
  id text primary key,
  relationship_id text not null,
  document jsonb not null,
  created_at timestamptz not null default now()
);

create index htc_crm_walkthroughs_relationship
  on public.htc_crm_walkthroughs (relationship_id);

create table public.htc_crm_subscriptions (
  id text primary key,
  relationship_id text not null,
  stripe_subscription_id text,
  document jsonb not null,
  created_at timestamptz not null default now()
);

create index htc_crm_subscriptions_relationship
  on public.htc_crm_subscriptions (relationship_id);

create index htc_crm_subscriptions_stripe
  on public.htc_crm_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create table public.htc_crm_notifications (
  id text primary key,
  relationship_id text,
  document jsonb not null,
  created_at timestamptz not null default now()
);

create index htc_crm_notifications_relationship
  on public.htc_crm_notifications (relationship_id);

create table public.htc_crm_tasks (
  id text primary key,
  relationship_id text not null,
  status text,
  document jsonb not null,
  created_at timestamptz not null default now()
);

create index htc_crm_tasks_relationship
  on public.htc_crm_tasks (relationship_id);

create index htc_crm_tasks_status
  on public.htc_crm_tasks (status);

create table public.htc_crm_support_inbox_items (
  id text primary key,
  status text,
  document jsonb not null,
  created_at timestamptz not null default now()
);

create index htc_crm_support_inbox_status
  on public.htc_crm_support_inbox_items (status);

-- Singleton version for optimistic concurrency across marketing + workspace tasks.
create table public.htc_crm_store_meta (
  id int primary key default 1 check (id = 1),
  version bigint not null default 0
);

insert into public.htc_crm_store_meta (id, version) values (1, 0)
on conflict (id) do nothing;

alter table public.htc_crm_store_meta enable row level security;
revoke all on table public.htc_crm_store_meta from authenticated, anon;
grant select, update on table public.htc_crm_store_meta to service_role;

-- ----------------------------------------------------------------------------
-- Atomic replace (service_role via RPC) with optimistic version check.
-- Returns the new version. Raises SQLSTATE 40001 on version conflict so
-- callers can retry load → mutate → save across ECS tasks.
-- ----------------------------------------------------------------------------
create or replace function public.htc_crm_replace_store(
  p_store jsonb,
  p_expected_version bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current bigint;
  v_next bigint;
begin
  perform pg_advisory_xact_lock(87201401);

  select version into v_current
    from public.htc_crm_store_meta
   where id = 1
   for update;

  if v_current is null then
    insert into public.htc_crm_store_meta (id, version) values (1, 0);
    v_current := 0;
  end if;

  if p_expected_version is not null and v_current is distinct from p_expected_version then
    raise exception 'htc_crm_version_conflict (expected %, actual %)',
      p_expected_version, v_current
      using errcode = '40001';
  end if;

  delete from public.htc_crm_support_inbox_items where true;
  delete from public.htc_crm_tasks where true;
  delete from public.htc_crm_notifications where true;
  delete from public.htc_crm_subscriptions where true;
  delete from public.htc_crm_walkthroughs where true;
  delete from public.htc_crm_communications where true;
  delete from public.htc_crm_timeline_events where true;
  delete from public.htc_crm_relationships where true;

  insert into public.htc_crm_relationships (
    id, owner_email, stripe_customer_id, stripe_subscription_id,
    stripe_checkout_session_id, status, sales_stage, customer_success_stage,
    plan_id, onboarding_type, founding_member, document, created_at, updated_at
  )
  select
    coalesce(elem->>'id', gen_random_uuid()::text),
    nullif(elem->'owner'->>'email', ''),
    nullif(elem->>'stripeCustomerId', ''),
    nullif(elem->>'stripeSubscriptionId', ''),
    nullif(elem->>'stripeCheckoutSessionId', ''),
    nullif(elem->>'status', ''),
    nullif(elem->>'salesStage', ''),
    nullif(elem->>'customerSuccessStage', ''),
    nullif(elem->>'planId', ''),
    nullif(elem->>'onboardingType', ''),
    coalesce((elem->>'foundingMember')::boolean, false),
    elem,
    coalesce((elem->>'createdAt')::timestamptz, now()),
    coalesce((elem->>'updatedAt')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_store->'relationships', '[]'::jsonb)) as elem;

  insert into public.htc_crm_timeline_events (id, relationship_id, occurred_at, event_type, document)
  select
    coalesce(elem->>'id', gen_random_uuid()::text),
    coalesce(elem->>'relationshipId', ''),
    nullif(elem->>'occurredAt', '')::timestamptz,
    nullif(elem->>'type', ''),
    elem
  from jsonb_array_elements(coalesce(p_store->'timelineEvents', '[]'::jsonb)) as elem;

  insert into public.htc_crm_communications (id, relationship_id, occurred_at, document)
  select
    coalesce(elem->>'id', gen_random_uuid()::text),
    coalesce(elem->>'relationshipId', ''),
    nullif(elem->>'occurredAt', '')::timestamptz,
    elem
  from jsonb_array_elements(coalesce(p_store->'communications', '[]'::jsonb)) as elem;

  insert into public.htc_crm_walkthroughs (id, relationship_id, document)
  select
    coalesce(elem->>'id', gen_random_uuid()::text),
    coalesce(elem->>'relationshipId', ''),
    elem
  from jsonb_array_elements(coalesce(p_store->'walkthroughs', '[]'::jsonb)) as elem;

  insert into public.htc_crm_subscriptions (id, relationship_id, stripe_subscription_id, document)
  select
    coalesce(elem->>'id', gen_random_uuid()::text),
    coalesce(elem->>'relationshipId', ''),
    nullif(elem->>'stripeSubscriptionId', ''),
    elem
  from jsonb_array_elements(coalesce(p_store->'subscriptions', '[]'::jsonb)) as elem;

  insert into public.htc_crm_notifications (id, relationship_id, document)
  select
    coalesce(elem->>'id', gen_random_uuid()::text),
    nullif(elem->>'relationshipId', ''),
    elem
  from jsonb_array_elements(coalesce(p_store->'notifications', '[]'::jsonb)) as elem;

  insert into public.htc_crm_tasks (id, relationship_id, status, document)
  select
    coalesce(elem->>'id', gen_random_uuid()::text),
    coalesce(elem->>'relationshipId', ''),
    nullif(elem->>'status', ''),
    elem
  from jsonb_array_elements(coalesce(p_store->'tasks', '[]'::jsonb)) as elem;

  insert into public.htc_crm_support_inbox_items (id, status, document)
  select
    coalesce(elem->>'id', gen_random_uuid()::text),
    nullif(elem->>'status', ''),
    elem
  from jsonb_array_elements(coalesce(p_store->'supportInboxItems', '[]'::jsonb)) as elem;

  update public.htc_crm_store_meta
     set version = v_current + 1
   where id = 1
   returning version into v_next;

  return v_next;
end;
$$;

-- Returns { "version": n, "store": { relationships, ... } }
create or replace function public.htc_crm_load_store()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version bigint;
  v_store jsonb;
begin
  perform pg_advisory_xact_lock(87201401);

  select coalesce(version, 0) into v_version
    from public.htc_crm_store_meta
   where id = 1;

  if v_version is null then
    insert into public.htc_crm_store_meta (id, version) values (1, 0)
    on conflict (id) do nothing;
    v_version := 0;
  end if;

  select jsonb_build_object(
    'relationships', coalesce((
      select jsonb_agg(document order by updated_at, id)
      from public.htc_crm_relationships
    ), '[]'::jsonb),
    'timelineEvents', coalesce((
      select jsonb_agg(document order by occurred_at nulls last, id)
      from public.htc_crm_timeline_events
    ), '[]'::jsonb),
    'communications', coalesce((
      select jsonb_agg(document order by occurred_at nulls last, id)
      from public.htc_crm_communications
    ), '[]'::jsonb),
    'walkthroughs', coalesce((
      select jsonb_agg(document order by id)
      from public.htc_crm_walkthroughs
    ), '[]'::jsonb),
    'subscriptions', coalesce((
      select jsonb_agg(document order by id)
      from public.htc_crm_subscriptions
    ), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(document order by id)
      from public.htc_crm_notifications
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(document order by id)
      from public.htc_crm_tasks
    ), '[]'::jsonb),
    'supportInboxItems', coalesce((
      select jsonb_agg(document order by id)
      from public.htc_crm_support_inbox_items
    ), '[]'::jsonb)
  ) into v_store;

  return jsonb_build_object('version', v_version, 'store', v_store);
end;
$$;

revoke all on table public.htc_crm_relationships from authenticated, anon;
revoke all on table public.htc_crm_timeline_events from authenticated, anon;
revoke all on table public.htc_crm_communications from authenticated, anon;
revoke all on table public.htc_crm_walkthroughs from authenticated, anon;
revoke all on table public.htc_crm_subscriptions from authenticated, anon;
revoke all on table public.htc_crm_notifications from authenticated, anon;
revoke all on table public.htc_crm_tasks from authenticated, anon;
revoke all on table public.htc_crm_support_inbox_items from authenticated, anon;

grant select, insert, update, delete on table public.htc_crm_relationships to service_role;
grant select, insert, update, delete on table public.htc_crm_timeline_events to service_role;
grant select, insert, update, delete on table public.htc_crm_communications to service_role;
grant select, insert, update, delete on table public.htc_crm_walkthroughs to service_role;
grant select, insert, update, delete on table public.htc_crm_subscriptions to service_role;
grant select, insert, update, delete on table public.htc_crm_notifications to service_role;
grant select, insert, update, delete on table public.htc_crm_tasks to service_role;
grant select, insert, update, delete on table public.htc_crm_support_inbox_items to service_role;

grant execute on function public.htc_crm_replace_store(jsonb, bigint) to service_role;
grant execute on function public.htc_crm_load_store() to service_role;

alter table public.htc_crm_relationships enable row level security;
alter table public.htc_crm_timeline_events enable row level security;
alter table public.htc_crm_communications enable row level security;
alter table public.htc_crm_walkthroughs enable row level security;
alter table public.htc_crm_subscriptions enable row level security;
alter table public.htc_crm_notifications enable row level security;
alter table public.htc_crm_tasks enable row level security;
alter table public.htc_crm_support_inbox_items enable row level security;
