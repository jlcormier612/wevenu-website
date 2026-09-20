-- Lock Standard pipeline defaults to the saved Sandbox configuration
-- (names, order, reporting categories, probabilities, palette swatches).
-- Pre-launch: reset every venue to this exact Standard once.
-- Ongoing ensure only seeds empty / prior-product baselines — never destroys
-- a venue's intentional Customize Pipeline edits.

create or replace function public._standard_pipeline_insert_stages(
  p_venue_id uuid,
  p_template_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pipeline_stages (
    venue_id, pipeline_template_id, name, color, sort_order, canonical_stage, probability
  ) values
    (p_venue_id, p_template_id, 'New Inquiry',      '#B9D1C2', 0, 'inquiry',  10),
    (p_venue_id, p_template_id, 'In Workflow',      '#4F5F4F', 1, 'inquiry',  20),
    (p_venue_id, p_template_id, 'Tour Scheduled',   '#B9D1C2', 2, 'tour',     50),
    (p_venue_id, p_template_id, 'Custom Proposal',  '#DED6CA', 3, 'proposal', 60),
    (p_venue_id, p_template_id, 'Contract Sent',    '#B8AEA1', 4, 'proposal', 85),
    (p_venue_id, p_template_id, 'Follow-Up',        '#4F5F4F', 5, 'decision', 70),
    (p_venue_id, p_template_id, 'Booked',           '#5D6F5D', 6, 'booked',   95),
    (p_venue_id, p_template_id, 'Lost',             '#D8A7AA', 7, 'lost',      0);
end;
$$;

create or replace function public._standard_pipeline_is_canonical(p_template_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.pipeline_stages where pipeline_template_id = p_template_id) = 8
    and exists (
      select 1 from public.pipeline_stages
      where pipeline_template_id = p_template_id
        and sort_order = 0 and name = 'New Inquiry' and canonical_stage = 'inquiry'
        and probability = 10 and color = '#B9D1C2'
    )
    and exists (
      select 1 from public.pipeline_stages
      where pipeline_template_id = p_template_id
        and sort_order = 1 and name = 'In Workflow' and canonical_stage = 'inquiry'
        and probability = 20 and color = '#4F5F4F'
    )
    and exists (
      select 1 from public.pipeline_stages
      where pipeline_template_id = p_template_id
        and sort_order = 2 and name = 'Tour Scheduled' and canonical_stage = 'tour'
        and probability = 50 and color = '#B9D1C2'
    )
    and exists (
      select 1 from public.pipeline_stages
      where pipeline_template_id = p_template_id
        and sort_order = 3 and name = 'Custom Proposal' and canonical_stage = 'proposal'
        and probability = 60 and color = '#DED6CA'
    )
    and exists (
      select 1 from public.pipeline_stages
      where pipeline_template_id = p_template_id
        and sort_order = 4 and name = 'Contract Sent' and canonical_stage = 'proposal'
        and probability = 85 and color = '#B8AEA1'
    )
    and exists (
      select 1 from public.pipeline_stages
      where pipeline_template_id = p_template_id
        and sort_order = 5 and name = 'Follow-Up' and canonical_stage = 'decision'
        and probability = 70 and color = '#4F5F4F'
    )
    and exists (
      select 1 from public.pipeline_stages
      where pipeline_template_id = p_template_id
        and sort_order = 6 and name = 'Booked' and canonical_stage = 'booked'
        and probability = 95 and color = '#5D6F5D'
    )
    and exists (
      select 1 from public.pipeline_stages
      where pipeline_template_id = p_template_id
        and sort_order = 7 and name = 'Lost' and canonical_stage = 'lost'
        and probability = 0 and color = '#D8A7AA'
    );
$$;

-- Prior product Standard seeds (wrong probs) — safe to auto-upgrade.
-- Fingerprint A: 034 baseline (In Workflow 25 / Proposal 70 / Follow-Up 90 / Booked 100).
-- Fingerprint B: earlier incorrect defaults (Inquiry 20 / Tour 40 / Proposal 50 /
-- Contract 75 / Follow-Up 60 / Booked 90). Intentional Customize Pipeline edits
-- that do not match either fingerprint are left alone.
create or replace function public._standard_pipeline_is_prior_product_seed(p_template_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.pipeline_stages where pipeline_template_id = p_template_id) = 8
    and (
      (
        exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'In Workflow' and probability = 25
        )
        and exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'Custom Proposal' and probability = 70
        )
        and exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'Follow-Up' and probability = 90
        )
        and exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'Booked' and probability = 100
        )
      )
      or (
        exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'New Inquiry' and probability = 20
        )
        and exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'Tour Scheduled' and probability = 40
        )
        and exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'Custom Proposal' and probability = 50
        )
        and exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'Contract Sent' and probability = 75
        )
        and exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'Follow-Up' and probability = 60
        )
        and exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'Booked' and probability = 90
        )
      )
    );
$$;

create or replace function public.ensure_standard_sales_pipeline(p_venue_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_id uuid;
  v_stage_count int;
  v_needs_seed boolean;
  v_has_active boolean;
begin
  select id into v_template_id
  from public.pipeline_templates
  where venue_id = p_venue_id
    and name in ('Standard', 'Standard Sales Pipeline')
  order by case when name = 'Standard' then 0 else 1 end
  limit 1;

  if v_template_id is null then
    select exists(
      select 1 from public.pipeline_templates
      where venue_id = p_venue_id and is_active = true
    ) into v_has_active;

    insert into public.pipeline_templates (venue_id, name, description, is_active)
    values (
      p_venue_id,
      'Standard',
      'Default sales pipeline. Active for every new venue — no setup required.',
      not coalesce(v_has_active, false)
    )
    returning id into v_template_id;
  else
    update public.pipeline_templates
    set
      name = 'Standard',
      description = 'Default sales pipeline. Active for every new venue — no setup required.',
      updated_at = now()
    where id = v_template_id
      and venue_id = p_venue_id
      and (name is distinct from 'Standard'
        or description is distinct from 'Default sales pipeline. Active for every new venue — no setup required.');
  end if;

  select exists(
    select 1 from public.pipeline_templates
    where venue_id = p_venue_id and is_active = true
  ) into v_has_active;

  if not v_has_active then
    update public.pipeline_templates
    set is_active = true, updated_at = now()
    where id = v_template_id
      and venue_id = p_venue_id;
  end if;

  if public._standard_pipeline_is_canonical(v_template_id) then
    return v_template_id;
  end if;

  select count(*) into v_stage_count
  from public.pipeline_stages
  where pipeline_template_id = v_template_id
    and venue_id = p_venue_id;

  select
    v_stage_count = 0
    or exists (
      select 1 from public.pipeline_stages
      where pipeline_template_id = v_template_id
        and venue_id = p_venue_id
        and name in (
          'Outreach Sent',
          'Enrolled in Sequence/Workflow',
          'Proposal Sent'
        )
    )
    or public._standard_pipeline_is_prior_product_seed(v_template_id)
  into v_needs_seed;

  if not coalesce(v_needs_seed, false) then
    -- Venue customized Standard (or another shape) — leave stages alone.
    return v_template_id;
  end if;

  update public.leads
  set pipeline_stage_id = null
  where venue_id = p_venue_id
    and pipeline_stage_id in (
      select id from public.pipeline_stages
      where pipeline_template_id = v_template_id
    );

  delete from public.pipeline_stages
  where pipeline_template_id = v_template_id
    and venue_id = p_venue_id;

  perform public._standard_pipeline_insert_stages(p_venue_id, v_template_id);

  update public.leads l
  set pipeline_stage_id = s.id
  from public.pipeline_stages s
  where l.venue_id = p_venue_id
    and s.venue_id = p_venue_id
    and s.pipeline_template_id = v_template_id
    and l.sales_stage is not null
    and l.sales_stage <> 'cancelled'
    and s.sort_order = case l.sales_stage
      when 'new_inquiry' then 0
      when 'outreach_sent' then 1
      when 'enrolled_in_sequence' then 5
      when 'tour_scheduled' then 2
      when 'proposal_sent' then 3
      when 'booked' then 6
      when 'lost' then 7
      else 0
    end;

  return v_template_id;
end;
$$;

create or replace function public.reset_venue_to_standard_pipeline(p_venue_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_id uuid;
  v_other record;
begin
  v_template_id := public.ensure_standard_sales_pipeline(p_venue_id);

  update public.pipeline_templates
  set is_active = false, updated_at = now()
  where venue_id = p_venue_id
    and id <> v_template_id
    and is_active = true;

  update public.pipeline_templates
  set is_active = true, updated_at = now()
  where id = v_template_id
    and venue_id = p_venue_id
    and is_active is distinct from true;

  for v_other in
    select id
    from public.pipeline_templates
    where venue_id = p_venue_id
      and id <> v_template_id
  loop
    update public.leads
    set pipeline_stage_id = null
    where venue_id = p_venue_id
      and pipeline_stage_id in (
        select id from public.pipeline_stages
        where pipeline_template_id = v_other.id
      );
    delete from public.pipeline_stages
    where pipeline_template_id = v_other.id
      and venue_id = p_venue_id;
    delete from public.pipeline_templates
    where id = v_other.id
      and venue_id = p_venue_id;
  end loop;

  update public.leads
  set pipeline_stage_id = null
  where venue_id = p_venue_id
    and pipeline_stage_id in (
      select id from public.pipeline_stages
      where pipeline_template_id = v_template_id
    );

  delete from public.pipeline_stages
  where pipeline_template_id = v_template_id
    and venue_id = p_venue_id;

  perform public._standard_pipeline_insert_stages(p_venue_id, v_template_id);

  update public.leads l
  set pipeline_stage_id = s.id
  from public.pipeline_stages s
  where l.venue_id = p_venue_id
    and s.venue_id = p_venue_id
    and s.pipeline_template_id = v_template_id
    and l.sales_stage is not null
    and l.sales_stage <> 'cancelled'
    and s.sort_order = case l.sales_stage
      when 'new_inquiry' then 0
      when 'outreach_sent' then 1
      when 'enrolled_in_sequence' then 5
      when 'tour_scheduled' then 2
      when 'proposal_sent' then 3
      when 'booked' then 6
      when 'lost' then 7
      else 0
    end;

  return v_template_id;
end;
$$;

revoke all on function public.ensure_standard_sales_pipeline(uuid) from public;
grant execute on function public.ensure_standard_sales_pipeline(uuid)
  to authenticated, service_role;

revoke all on function public.reset_venue_to_standard_pipeline(uuid) from public;
grant execute on function public.reset_venue_to_standard_pipeline(uuid)
  to service_role;

revoke all on function public._standard_pipeline_insert_stages(uuid, uuid) from public;
revoke all on function public._standard_pipeline_is_canonical(uuid) from public;
revoke all on function public._standard_pipeline_is_prior_product_seed(uuid) from public;

-- Pre-launch / Sandbox: force every venue onto the locked Standard.
do $$
declare
  v_id uuid;
begin
  for v_id in select id from public.venues loop
    perform public.reset_venue_to_standard_pipeline(v_id);
  end loop;
end $$;

notify pgrst, 'reload schema';
