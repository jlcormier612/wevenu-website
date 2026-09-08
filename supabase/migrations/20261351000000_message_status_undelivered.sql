-- Messaging Trust: distinguish SMS undelivered from failed in the shared status model.
-- Venue UI: "Not delivered" vs "Couldn't deliver".

alter table public.conversation_messages
  drop constraint if exists conversation_messages_status_check;

alter table public.conversation_messages
  add constraint conversation_messages_status_check
  check (
    status is null
    or status in (
      'draft',
      'sending',
      'accepted',
      'delivered',
      'opened',
      'clicked',
      'replied',
      'failed',
      'undelivered',
      'received'
    )
  );

-- Legacy messages table (if still present) — keep in sync where the same check exists.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'messages'
  ) then
    alter table public.messages drop constraint if exists messages_status_check;
    begin
      alter table public.messages
        add constraint messages_status_check
        check (
          status is null
          or status in (
            'draft', 'sending', 'accepted', 'delivered', 'opened', 'clicked',
            'replied', 'failed', 'undelivered', 'received'
          )
        );
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

notify pgrst, 'reload schema';
