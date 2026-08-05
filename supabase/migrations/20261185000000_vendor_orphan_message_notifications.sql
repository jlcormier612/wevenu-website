-- Dismiss orphan vendor new_message notifications when their conversation
-- (or assignment) is CASCADE-deleted. Conversations FK assignment ON DELETE
-- CASCADE, but vendor_notifications.assignment_id is ON DELETE SET NULL —
-- without this, unread "New message" rows keep dead /vendor/messages/{id}
-- links after assignment recreate.

-- ── 1. One-shot cleanup of ghost new_message alerts ──────────────────────────
-- Missing conversation OR linked conversation has zero messages (typical after
-- assignment recreate: live twin exists, history CASCADE-deleted).

update public.vendor_notifications vn
set read_at = coalesce(vn.read_at, now())
where vn.type = 'new_message'
  and vn.read_at is null
  and (
    vn.link is null
    or not exists (
      select 1
      from public.conversations c
      where vn.link = '/vendor/messages/' || c.id::text
         or vn.link like '/vendor/messages/' || c.id::text || '/%'
    )
    or exists (
      select 1
      from public.conversations c
      where (vn.link = '/vendor/messages/' || c.id::text
              or vn.link like '/vendor/messages/' || c.id::text || '/%')
        and not exists (
          select 1 from public.conversation_messages m where m.conversation_id = c.id
        )
    )
  );

-- Point truly missing-conversation rows at the inbox so deep links do not 404.
update public.vendor_notifications vn
set link = '/vendor/messages'
where vn.type = 'new_message'
  and vn.link is not null
  and vn.link like '/vendor/messages/%'
  and not exists (
    select 1
    from public.conversations c
    where vn.link = '/vendor/messages/' || c.id::text
       or vn.link like '/vendor/messages/' || c.id::text || '/%'
  );

-- ── 2. Before assignment delete: clear message alerts for that assignment ────

create or replace function public._dismiss_vendor_message_notifications_on_assignment_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.vendor_notifications
  set read_at = coalesce(read_at, now()),
      link = coalesce(nullif(link, ''), '/vendor/messages')
  where assignment_id = OLD.id
    and type = 'new_message'
    and read_at is null;

  -- Also clear any unread new_message rows whose deep link targets a
  -- conversation about to CASCADE with this assignment.
  update public.vendor_notifications vn
  set read_at = coalesce(vn.read_at, now()),
      link = '/vendor/messages'
  where vn.type = 'new_message'
    and vn.read_at is null
    and exists (
      select 1
      from public.conversations c
      where c.event_vendor_assignment_id = OLD.id
        and (
          vn.link = '/vendor/messages/' || c.id::text
          or vn.link like '/vendor/messages/' || c.id::text || '/%'
        )
    );

  return OLD;
exception when others then
  raise warning '_dismiss_vendor_message_notifications_on_assignment_delete failed for %: %',
    OLD.id, sqlerrm;
  return OLD;
end;
$$;

drop trigger if exists dismiss_vendor_message_notifications_on_assignment_delete
  on public.event_vendor_assignments;

create trigger dismiss_vendor_message_notifications_on_assignment_delete
  before delete on public.event_vendor_assignments
  for each row
  execute function public._dismiss_vendor_message_notifications_on_assignment_delete();

-- ── 3. get_vendor_notifications — exclude dead-conversation unread messages
--     from unreadCount (history rows may still appear as read after cleanup).

create or replace function public.get_vendor_notifications(p_limit int default 40)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id     uuid;
  v_notifications jsonb;
  v_unread_count  int;
begin
  v_vendor_id := public.current_user_vendor_id();
  if v_vendor_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- Opportunistic cleanup: unread new_message whose linked conversation is
  -- missing, not owned by this vendor, or has no messages left.
  update public.vendor_notifications vn
  set read_at = now(),
      link = case
        when exists (
          select 1
          from public.conversations c
          join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
          where eva.vendor_id = v_vendor_id
            and (
              vn.link = '/vendor/messages/' || c.id::text
              or vn.link like '/vendor/messages/' || c.id::text || '/%'
            )
        ) then vn.link
        else '/vendor/messages'
      end
  where vn.vendor_id = v_vendor_id
    and vn.type = 'new_message'
    and vn.read_at is null
    and (
      vn.link is null
      or not exists (
        select 1
        from public.conversations c
        join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
        where eva.vendor_id = v_vendor_id
          and (
            vn.link = '/vendor/messages/' || c.id::text
            or vn.link like '/vendor/messages/' || c.id::text || '/%'
          )
          and exists (
            select 1 from public.conversation_messages m where m.conversation_id = c.id
          )
      )
    );

  select count(*) into v_unread_count
  from public.vendor_notifications
  where vendor_id = v_vendor_id
    and read_at is null;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',           n.id,
      'type',         n.type,
      'title',        n.title,
      'body',         n.body,
      'link',         n.link,
      'emoji',        n.emoji,
      'eventId',      n.event_id,
      'assignmentId', n.assignment_id,
      'readAt',       n.read_at,
      'createdAt',    n.created_at
    ) order by n.created_at desc
  ), '[]'::jsonb)
  into v_notifications
  from (
    select *
    from public.vendor_notifications
    where vendor_id = v_vendor_id
    order by created_at desc
    limit greatest(coalesce(p_limit, 40), 1)
  ) n;

  return jsonb_build_object(
    'notifications', v_notifications,
    'unreadCount',   v_unread_count
  );
end;
$$;

grant execute on function public.get_vendor_notifications(int) to authenticated;
