-- Align couple-photo-share notification body with locked product copy.
-- Deep link remains Client edit (Photo section). Does not change share
-- guards, display-source resolution, or notification idempotency.

create or replace function public.set_portal_relationship_photo_sharing(
  p_token  text,
  p_shared boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_rel_id uuid;
  v_row public.venue_customer_relationships%rowtype;
  v_was_shared boolean;
  v_notify boolean := false;
  v_name text;
  v_link text;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select relationship_id into v_rel_id
  from public.clients
  where id = v_session.client_id and venue_id = v_session.venue_id;
  if v_rel_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_relationship');
  end if;

  select * into v_row from public.venue_customer_relationships where id = v_rel_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_relationship');
  end if;

  v_was_shared := v_row.client_photo_shared;

  if p_shared and v_row.client_photo_url is null then
    return jsonb_build_object('ok', false, 'error', 'no_photo');
  end if;

  update public.venue_customer_relationships
  set
    client_photo_shared = p_shared,
    venue_display_source = case
      when p_shared
        and v_row.venue_photo_url is null
        and v_row.client_photo_url is not null
        then 'client'
      when not p_shared and v_row.venue_display_source = 'client' then
        case when v_row.venue_photo_url is not null then 'venue' else 'none' end
      else venue_display_source
    end,
    client_photo_share_notified_at = case
      when p_shared and not v_was_shared and v_row.client_photo_url is not null
        then now()
      when not p_shared then null
      else client_photo_share_notified_at
    end,
    updated_at = now()
  where id = v_rel_id;

  v_notify := p_shared and not v_was_shared and v_row.client_photo_url is not null;

  if v_notify then
    select trim(both ' ' from concat_ws(' ',
      nullif(trim(c.first_name), ''),
      nullif(trim(c.last_name), ''),
      case
        when nullif(trim(c.partner_first_name), '') is not null
          then concat('& ', trim(c.partner_first_name),
            case when nullif(trim(c.partner_last_name), '') is not null
              then concat(' ', trim(c.partner_last_name)) else '' end)
        else null
      end
    ))
    into v_name
    from public.clients c
    where c.id = v_session.client_id;

    if v_name is null or v_name = '' then
      v_name := 'A couple';
    end if;

    v_link := '/clients/' || v_session.client_id::text || '/edit';

    perform public.create_venue_notification(
      v_session.venue_id,
      null,
      'client_photo_shared',
      v_name || ' shared a photo with you.',
      'You can use it on their internal client record.',
      v_link,
      '📷'
    );
  end if;

  return jsonb_build_object('ok', true, 'shared', p_shared, 'notified', v_notify);
end;
$$;

revoke all on function public.set_portal_relationship_photo_sharing(text, boolean) from public;
grant execute on function public.set_portal_relationship_photo_sharing(text, boolean)
  to anon, authenticated;

notify pgrst, 'reload schema';
