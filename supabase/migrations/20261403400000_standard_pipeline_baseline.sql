-- Standard sales pipeline as the product baseline for every venue.
-- Pre-launch migration resets existing venues once. Ongoing ensure is
-- idempotent: it never destroys a venue's customized active pipeline.

create or replace function public.ensure_standard_sales_pipeline(p_venue_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_id uuid;
  v_stage_count int;
  v_matches boolean;
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

  -- Activate Standard when the venue has no active pipeline.
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

  select count(*) into v_stage_count
  from public.pipeline_stages
  where pipeline_template_id = v_template_id
    and venue_id = p_venue_id;

  -- Seed or upgrade only when empty, or still on the prior product baseline.
  -- Do not rewrite a venue that customized Standard via Customize Pipeline.
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
  into v_matches;

  if not coalesce(v_matches, false) then
    return v_template_id;
  end if;

  -- Repair Standard stages only (does not delete other venue templates).
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

  insert into public.pipeline_stages (
    venue_id, pipeline_template_id, name, color, sort_order, canonical_stage, probability
  ) values
    (p_venue_id, v_template_id, 'New Inquiry',      '#5D6F5D', 0, 'inquiry',  10),
    (p_venue_id, v_template_id, 'In Workflow',      '#4F5F4F', 1, 'inquiry',  25),
    (p_venue_id, v_template_id, 'Tour Scheduled',   '#B9D1C2', 2, 'tour',     50),
    (p_venue_id, v_template_id, 'Custom Proposal',  '#B8AEA1', 3, 'proposal', 70),
    (p_venue_id, v_template_id, 'Contract Sent',    '#DED6CA', 4, 'proposal', 85),
    (p_venue_id, v_template_id, 'Follow-Up',        '#D8A7AA', 5, 'decision', 90),
    (p_venue_id, v_template_id, 'Booked',           '#6F6A61', 6, 'booked',  100),
    (p_venue_id, v_template_id, 'Lost',             '#5D6F5D', 7, 'lost',      0);

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

-- One-time pre-launch reset: sole active Standard, drop other templates.
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

  -- Force Standard stages even if ensure short-circuited on a prior match
  -- that was still the old seven-stage baseline under a different name.
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

  insert into public.pipeline_stages (
    venue_id, pipeline_template_id, name, color, sort_order, canonical_stage, probability
  ) values
    (p_venue_id, v_template_id, 'New Inquiry',      '#5D6F5D', 0, 'inquiry',  10),
    (p_venue_id, v_template_id, 'In Workflow',      '#4F5F4F', 1, 'inquiry',  25),
    (p_venue_id, v_template_id, 'Tour Scheduled',   '#B9D1C2', 2, 'tour',     50),
    (p_venue_id, v_template_id, 'Custom Proposal',  '#B8AEA1', 3, 'proposal', 70),
    (p_venue_id, v_template_id, 'Contract Sent',    '#DED6CA', 4, 'proposal', 85),
    (p_venue_id, v_template_id, 'Follow-Up',        '#D8A7AA', 5, 'decision', 90),
    (p_venue_id, v_template_id, 'Booked',           '#6F6A61', 6, 'booked',  100),
    (p_venue_id, v_template_id, 'Lost',             '#5D6F5D', 7, 'lost',      0);

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

-- Auto-provision Standard on every new venue (active when no other pipeline exists).
create or replace function public.venues_seed_standard_sales_pipeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_standard_sales_pipeline(NEW.id);
  return NEW;
end;
$$;

drop trigger if exists venues_seed_standard_sales_pipeline on public.venues;
create trigger venues_seed_standard_sales_pipeline
  after insert on public.venues
  for each row
  execute function public.venues_seed_standard_sales_pipeline();

-- Pre-launch / Sandbox: reset every venue to the exact Standard baseline.
do $$
declare
  v_id uuid;
begin
  for v_id in select id from public.venues loop
    perform public.reset_venue_to_standard_pipeline(v_id);
  end loop;
end $$;

-- Leads screen entry point is "Customize Pipeline".
update public.success_library_articles
   set why_it_matters = replace(
     replace(
       replace(why_it_matters,
         'Your Relationships → Leads → Pipeline Templates',
         'Your Relationships → Leads → Customize Pipeline'),
       'From Pipeline Templates, you can create a pipeline',
       'From Customize Pipeline, you can create a pipeline'),
     'Your Pipeline Templates are about shaping',
     'Customize Pipeline is about shaping'),
       updated_at = now()
 where slug = 'how-does-my-pipeline-work'
   and why_it_matters like '%Pipeline Templates%';

update public.success_library_articles
   set why_it_matters = replace(
     why_it_matters,
     '**Your Relationships → Leads → Pipeline Templates**',
     '**Your Relationships → Leads → Customize Pipeline**'),
       updated_at = now()
 where slug = 'can-i-customize-my-pipeline-stages'
   and why_it_matters like '%Pipeline Templates%';

notify pgrst, 'reload schema';
