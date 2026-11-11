-- Wave 1: Purpose-specific Public Forms (additive; inquiry form unchanged).
-- PublicForm → public URL → QR / other distribution.

-- ---- 1. public_forms --------------------------------------------------------

create table public.public_forms (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references public.venues(id) on delete cascade,
  internal_name    text not null check (char_length(trim(internal_name)) > 0),
  public_title     text not null check (char_length(trim(public_title)) > 0),
  description      text not null default '',
  status           text not null default 'draft'
                     check (status in ('draft', 'published', 'archived')),
  public_key       text not null unique
                     default encode(gen_random_bytes(16), 'hex'),
  -- Standard field visibility for identity-adjacent fields (not full inquiry config).
  -- Values: required | optional | hidden. event_type hidden → submit uses 'other'.
  field_config     jsonb not null default '{
    "phone": "optional",
    "event_type": "hidden",
    "preferred_event_date": "optional",
    "guest_count": "optional"
  }'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index public_forms_venue on public.public_forms (venue_id, created_at desc);
create index public_forms_venue_status on public.public_forms (venue_id, status);

create trigger public_forms_updated_at
  before update on public.public_forms
  for each row execute function public.set_updated_at();

alter table public.public_forms enable row level security;

create policy public_forms_all on public.public_forms
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.public_forms to authenticated;

comment on table public.public_forms is
  'Venue-authored purpose-specific lead-capture forms. Distinct from the single venue inquiry form (venues.embed_key).';

-- ---- 2. public_form_questions -----------------------------------------------

create table public.public_form_questions (
  id             uuid primary key default gen_random_uuid(),
  public_form_id uuid not null references public.public_forms(id) on delete cascade,
  venue_id       uuid not null references public.venues(id) on delete cascade,
  question_text  text not null check (char_length(trim(question_text)) > 0),
  question_type  text not null
                   check (question_type in ('short_answer', 'long_answer', 'single_select', 'multiple_select')),
  required       boolean not null default false,
  options        jsonb,
  sort_order     smallint not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index public_form_questions_form_sort
  on public.public_form_questions (public_form_id, sort_order, created_at);

create trigger public_form_questions_updated_at
  before update on public.public_form_questions
  for each row execute function public.set_updated_at();

alter table public.public_form_questions enable row level security;

create policy public_form_questions_all on public.public_form_questions
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.public_form_questions to authenticated;

-- ---- 3. QR campaigns: public_form destination -------------------------------

alter table public.qr_campaigns
  add column if not exists public_form_id uuid references public.public_forms(id) on delete set null;

create index if not exists qr_campaigns_public_form
  on public.qr_campaigns (public_form_id)
  where public_form_id is not null;

-- Widen destination_type check to include public_form.
alter table public.qr_campaigns drop constraint if exists qr_campaigns_destination_type_check;
alter table public.qr_campaigns
  add constraint qr_campaigns_destination_type_check
  check (destination_type in (
    'inquiry_form', 'tour_booking', 'wedding_website', 'external_url', 'public_form'
  ));

alter table public.qr_campaigns drop constraint if exists qr_campaigns_public_form_destination_ck;
alter table public.qr_campaigns
  add constraint qr_campaigns_public_form_destination_ck
  check (
    (destination_type = 'public_form' and public_form_id is not null)
    or (destination_type <> 'public_form' and public_form_id is null)
  );

-- ---- 4. resolve_qr_scan — return public_form_id -----------------------------

create or replace function public.resolve_qr_scan(
  p_code       text,
  p_user_agent text default null,
  p_referrer   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.qr_campaigns%rowtype;
begin
  select * into v_campaign from public.qr_campaigns where code = p_code and status = 'active';
  if not found then
    return jsonb_build_object('ok', false);
  end if;

  begin
    insert into public.qr_scans (venue_id, campaign_id, user_agent, referrer)
    values (v_campaign.venue_id, v_campaign.id, p_user_agent, p_referrer);
  exception when others then null;
  end;

  return jsonb_build_object(
    'ok', true,
    'campaignId', v_campaign.id,
    'venueId', v_campaign.venue_id,
    'destinationType', v_campaign.destination_type,
    'destinationUrl', v_campaign.destination_url,
    'publicFormId', v_campaign.public_form_id
  );
end;
$$;

grant execute on function public.resolve_qr_scan(text, text, text) to anon, authenticated;

-- ---- 5. Public read: get_public_form ----------------------------------------

create or replace function public.get_public_form(p_public_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form  public.public_forms%rowtype;
  v_venue public.venues%rowtype;
  v_questions jsonb;
begin
  select * into v_form
  from public.public_forms
  where public_key = p_public_key
    and status = 'published';

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  select * into v_venue from public.venues where id = v_form.venue_id;
  if not found then
    return jsonb_build_object('ok', false);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'question_text', q.question_text,
      'question_type', q.question_type,
      'required', q.required,
      'options', coalesce(q.options, '[]'::jsonb),
      'sort_order', q.sort_order
    ) order by q.sort_order, q.created_at
  ), '[]'::jsonb)
  into v_questions
  from public.public_form_questions q
  where q.public_form_id = v_form.id;

  return jsonb_build_object(
    'ok', true,
    'form', jsonb_build_object(
      'id', v_form.id,
      'internalName', v_form.internal_name,
      'publicTitle', v_form.public_title,
      'description', v_form.description,
      'fieldConfig', v_form.field_config,
      'publicKey', v_form.public_key
    ),
    'venue', jsonb_build_object(
      'id', v_venue.id,
      'name', v_venue.name,
      'logoUrl', v_venue.logo_url,
      'primaryColor', coalesce(v_venue.primary_color, '#5D6F5D'),
      'secondaryColor', coalesce(v_venue.secondary_color, '#4F5F4F'),
      'accentColor', coalesce(v_venue.accent_color, '#B8AEA1'),
      'neutralColor', coalesce(v_venue.neutral_color, '#F7F5F1'),
      'email', v_venue.email,
      'phone', v_venue.phone,
      'addressLine1', v_venue.address_line1,
      'city', v_venue.city,
      'stateRegion', v_venue.state_region
    ),
    'customQuestions', v_questions
  );
end;
$$;

grant execute on function public.get_public_form(text) to anon, authenticated;

-- ---- 6. create_public_form_lead — intake via ingest_lead --------------------

create or replace function public.create_public_form_lead(
  p_public_key       text,
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_phone            text,
  p_event_type       text,
  p_event_date       date,
  p_guest_count      integer,
  p_message          text,
  p_source_data      jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form     public.public_forms%rowtype;
  v_fields   jsonb;
  v_type     text;
  v_result   jsonb;
  v_merged   jsonb;
  v_phone_vis text;
  v_type_vis  text;
  v_date_vis  text;
  v_guest_vis text;
begin
  select * into v_form
  from public.public_forms
  where public_key = p_public_key
    and status = 'published';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Form is not available.');
  end if;

  v_fields := coalesce(v_form.field_config, '{}'::jsonb);
  v_phone_vis := coalesce(v_fields->>'phone', 'optional');
  v_type_vis := coalesce(v_fields->>'event_type', 'hidden');
  v_date_vis := coalesce(v_fields->>'preferred_event_date', 'optional');
  v_guest_vis := coalesce(v_fields->>'guest_count', 'optional');

  if nullif(trim(p_first_name), '') is null or nullif(trim(p_last_name), '') is null then
    return jsonb_build_object('ok', false, 'error', 'name_required');
  end if;
  if nullif(trim(p_email), '') is null then
    return jsonb_build_object('ok', false, 'error', 'email_required');
  end if;

  if v_phone_vis = 'required' and nullif(trim(p_phone), '') is null then
    return jsonb_build_object('ok', false, 'error', 'phone_required');
  end if;
  if v_date_vis = 'required' and p_event_date is null then
    return jsonb_build_object('ok', false, 'error', 'event_date_required');
  end if;
  if v_guest_vis = 'required' and p_guest_count is null then
    return jsonb_build_object('ok', false, 'error', 'guest_count_required');
  end if;

  if v_type_vis = 'hidden' then
    v_type := 'other';
  else
    v_type := public.normalize_event_type(p_event_type);
    if v_type is null then
      if v_type_vis = 'required' then
        return jsonb_build_object('ok', false, 'error', 'event_type_required');
      end if;
      v_type := 'other';
    end if;
  end if;

  v_merged := coalesce(p_source_data, '{}'::jsonb)
    || jsonb_build_object(
      'submitted_at', now(),
      'source', 'public_form',
      'public_form_id', v_form.id::text,
      'public_form_internal_name', v_form.internal_name,
      'public_form_public_title', v_form.public_title,
      'form_key', v_form.public_key
    );

  v_result := public.ingest_lead(
    v_form.venue_id,
    'website',
    jsonb_build_object(
      'firstName', p_first_name, 'lastName', p_last_name,
      'email', p_email, 'phone', p_phone,
      'partnerFirstName', null, 'partnerLastName', null, 'partnerEmail', null,
      'eventType', v_type, 'eventDate', p_event_date,
      'guestCount', p_guest_count,
      'estimatedBudget', null,
      'inquiryMessage', p_message,
      'sourceData', v_merged
    )
  );

  if not (v_result ->> 'ok')::boolean then
    return v_result;
  end if;

  return jsonb_build_object(
    'ok', true,
    'lead_id', v_result ->> 'leadId',
    'relationshipId', v_result ->> 'relationshipId',
    'isReturningRelationship', coalesce((v_result ->> 'isReturningRelationship')::boolean, false)
  );
end;
$$;

grant execute on function public.create_public_form_lead(
  text, text, text, text, text, text, date, integer, text, jsonb
) to anon, authenticated;

notify pgrst, 'reload schema';
