-- ============================================================================
-- Platform Event Framework — Phase 1
--
-- Infrastructure only, per docs/platform-orchestration-architecture.md and
-- docs/platform-event-adoption-plan.md. Platform Events publish that
-- something meaningful happened — they do not perform work, do not notify
-- anyone, do not run automations, and no consumer reads them yet in this
-- phase. If this migration were rolled back, every wrapped feature below
-- would keep working exactly as it does today, because every change here
-- is additive: an existing insert or existing trigger condition is never
-- altered, only followed by one more `perform emit_platform_event(...)`.
--
-- Changes:
--   1. platform_events table + indexes + RLS (read-only to authenticated;
--      writes only through the SECURITY DEFINER function below, same
--      pattern venue_notifications already established)
--   2. emit_platform_event() — the framework's one publishing mechanism,
--      callable from both SQL triggers and application code. Never throws.
--   3. log_event_status_changed() — re-defined to additionally publish
--      Booking.Confirmed / Event.Completed alongside its existing,
--      unchanged event_activities insert.
--   4. grant select on requests to service_role — the Request-lifecycle
--      wrap's "client_submitted" case runs outside any staff session (it
--      originates from a portal RPC, see lib/requests/portal.ts) and needs
--      to resolve venue_id for a request_id it doesn't otherwise have; this
--      is the one narrowly-scoped read that needs it. Everything else in
--      this migration writes only through emit_platform_event(), unaffected
--      by this grant.
-- ============================================================================


-- ── 1. platform_events ────────────────────────────────────────────────────────

create table public.platform_events (
  id             uuid primary key default gen_random_uuid(),

  event_type     text not null,        -- "Feature.Verb", e.g. "Booking.Confirmed"
  source_feature text not null,        -- the owning feature, e.g. "events", "requests"
  entity_type    text not null,        -- e.g. "event", "request"
  entity_id      uuid not null,

  venue_id       uuid not null references public.venues(id) on delete cascade,
  client_id      uuid references public.clients(id) on delete set null,

  actor_type     text,                 -- 'staff' | 'client' | 'vendor' | 'system'
  actor_id       uuid,
  actor_name     text,

  payload        jsonb not null default '{}'::jsonb,   -- minimal — ids/enums to route on, never a denormalized entity snapshot (adoption plan §2)

  occurred_at    timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

alter table public.platform_events enable row level security;

create policy "venue reads own platform events"
  on public.platform_events for select
  using (venue_id = current_user_venue_id());

-- Writes only through emit_platform_event() (SECURITY DEFINER, below) — no
-- insert policy and no insert grant, same posture venue_notifications
-- already uses ("Service role inserts via triggers; no direct-insert RLS
-- policy needed").
grant select on public.platform_events to authenticated;

create index platform_events_venue_time on public.platform_events (venue_id, occurred_at desc);
create index platform_events_entity on public.platform_events (entity_type, entity_id);


-- ── 2. emit_platform_event ────────────────────────────────────────────────────
-- The framework's one publishing mechanism. Callable from a SQL trigger
-- (`perform public.emit_platform_event(...)`) or from application code (via
-- `supabase.rpc("emit_platform_event", {...})`, wrapped by
-- lib/platform-events/service.ts) — both paths write through this same
-- function, so there is exactly one thing that actually performs the
-- write. Never throws: a Platform Event failing to publish must never
-- break the caller's own transaction, the same guarantee
-- create_venue_notification already makes for notifications.
--
-- actor_type/actor_id default to the calling session's own identity
-- (auth.uid(), typed 'staff' since only an authenticated staff session or
-- a portal-side SECURITY DEFINER RPC call this) when not explicitly
-- passed — callers with a different actor (e.g. a couple acting through a
-- portal RPC) pass p_actor_type/p_actor_id explicitly to override this.

create or replace function public.emit_platform_event(
  p_event_type     text,
  p_source_feature text,
  p_entity_type    text,
  p_entity_id      uuid,
  p_venue_id       uuid,
  p_client_id      uuid default null,
  p_actor_type     text default null,
  p_actor_id       uuid default null,
  p_actor_name     text default null,
  p_payload        jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.platform_events (
    event_type, source_feature, entity_type, entity_id, venue_id, client_id,
    actor_type, actor_id, actor_name, payload
  )
  values (
    p_event_type, p_source_feature, p_entity_type, p_entity_id, p_venue_id, p_client_id,
    coalesce(p_actor_type, case when auth.uid() is not null then 'staff' else 'system' end),
    coalesce(p_actor_id, auth.uid()),
    p_actor_name,
    coalesce(p_payload, '{}'::jsonb)
  );
exception when others then
  null; -- never break the caller
end;
$$;

grant execute on function public.emit_platform_event(text, text, text, uuid, uuid, uuid, text, uuid, text, jsonb)
  to anon, authenticated;


-- ── 3. Wrap Booking confirmation / Event completion ───────────────────────────
-- log_event_status_changed() already writes one event_activities row on
-- every status change (unchanged below, same condition, same columns,
-- same values). This adds exactly one more thing: when the new status is
-- specifically 'confirmed' or 'complete', also publish the corresponding
-- Platform Event — the two transitions docs/platform-event-adoption-plan.md
-- §4 names for this phase. Every other status transition (draft,
-- in_progress, cancelled) is deliberately left unwrapped in this phase,
-- matching the adoption plan's own narrow scope.

create or replace function public.log_event_status_changed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if old.status is distinct from new.status then
    insert into public.event_activities (venue_id, event_id, type, title)
    values (
      new.venue_id, new.id, 'status_changed',
      'Status changed to ' || initcap(replace(new.status, '_', ' '))
    );

    if new.status = 'confirmed' then
      perform public.emit_platform_event(
        'Booking.Confirmed', 'events', 'event', new.id, new.venue_id, new.client_id,
        null, null, null,
        jsonb_build_object('eventDate', new.event_date)
      );
    elsif new.status = 'complete' then
      perform public.emit_platform_event(
        'Event.Completed', 'events', 'event', new.id, new.venue_id, new.client_id,
        null, null, null,
        jsonb_build_object('eventDate', new.event_date)
      );
    end if;
  end if;
  return new;
end;
$$;


-- ── 4. Grant for the client_submitted lookup ──────────────────────────────────

grant select on public.requests to service_role;

notify pgrst, 'reload schema';
