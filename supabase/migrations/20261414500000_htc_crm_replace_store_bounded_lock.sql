-- Bound CRM store replace lock waits so stale / concurrent callers cannot
-- sit on a blocking advisory lock until the PostgREST ~125s upstream timeout.
--
-- Evidence (Sandbox 2026-10-11): intentional stale p_expected_version waited
-- ~125093 ms then "upstream request timeout" while a replace held advisory
-- lock 87201401. Version conflict is raised only AFTER the blocking lock,
-- so waiters never reached the intentional 40001 path in time.
--
-- Changes (semantics preserved for successful writers):
-- 1) Fast pre-check: if p_expected_version is set and already stale vs
--    committed meta.version, raise htc_crm_version_conflict immediately
--    without acquiring the advisory lock.
-- 2) Use pg_try_advisory_xact_lock — if the store is busy, raise
--    htc_crm_store_busy (55P03) immediately instead of blocking.
-- 3) After lock, re-read version FOR UPDATE and re-check expected version
--    (TOCTOU-safe) before the full-store rewrite.

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
  -- Fast path: clearly stale writers must not wait on the exclusive lock.
  if p_expected_version is not null then
    select version into v_current
      from public.htc_crm_store_meta
     where id = 1;

    if v_current is not null and v_current is distinct from p_expected_version then
      raise exception 'htc_crm_version_conflict (expected %, actual %)',
        p_expected_version, v_current
        using errcode = '40001';
    end if;
  end if;

  if not pg_try_advisory_xact_lock(87201401) then
    raise exception 'htc_crm_store_busy'
      using errcode = '55P03';
  end if;

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

  -- WHERE true satisfies pg-safeupdate while clearing all rows.
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

grant execute on function public.htc_crm_replace_store(jsonb, bigint) to service_role;
