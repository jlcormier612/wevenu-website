-- ============================================================================
-- Replace before-due reminder cadence presets with explicit day-offset arrays.
-- Venues may independently select any combination of 21 / 14 / 7 / 0 days
-- before the payment due date or contract expiration (empty = don't send).
-- After-due / overdue recurrence presets are unchanged.
-- ============================================================================

-- 1. Add offset columns (nullable briefly for backfill)
alter table public.venue_reminder_cadence
  add column if not exists payment_before_due_offsets  int[] ,
  add column if not exists contract_before_due_offsets int[];

-- 2. Migrate existing named presets → equivalent offset selections
update public.venue_reminder_cadence
set payment_before_due_offsets = case payment_before_due_cadence
  when 'weekly'         then array[-21, -14, -7]
  when 'once_two_weeks' then array[-14]
  when 'once_week'      then array[-7]
  when 'on_due'         then array[0]
  when 'none'           then array[]::int[]
  else array[-21, -14, -7]
end
where payment_before_due_offsets is null;

update public.venue_reminder_cadence
set contract_before_due_offsets = case contract_before_due_cadence
  when 'weekly'         then array[-21, -14, -7]
  when 'once_two_weeks' then array[-14]
  when 'once_week'      then array[-7]
  when 'on_due'         then array[0]
  when 'none'           then array[]::int[]
  else array[-21, -14, -7]
end
where contract_before_due_offsets is null;

-- 3. Enforce allowed offsets (subset of {21,14,7,0}, no duplicates)
alter table public.venue_reminder_cadence
  alter column payment_before_due_offsets set default array[-21, -14, -7],
  alter column contract_before_due_offsets set default array[-21, -14, -7],
  alter column payment_before_due_offsets set not null,
  alter column contract_before_due_offsets set not null;

alter table public.venue_reminder_cadence
  drop constraint if exists venue_reminder_cadence_payment_before_due_offsets_check;
alter table public.venue_reminder_cadence
  add constraint venue_reminder_cadence_payment_before_due_offsets_check
  check (
    payment_before_due_offsets <@ array[-21, -14, -7, 0]
    and cardinality(payment_before_due_offsets)
      = cardinality(array(select distinct unnest(payment_before_due_offsets)))
  );

alter table public.venue_reminder_cadence
  drop constraint if exists venue_reminder_cadence_contract_before_due_offsets_check;
alter table public.venue_reminder_cadence
  add constraint venue_reminder_cadence_contract_before_due_offsets_check
  check (
    contract_before_due_offsets <@ array[-21, -14, -7, 0]
    and cardinality(contract_before_due_offsets)
      = cardinality(array(select distinct unnest(contract_before_due_offsets)))
  );

-- 4. Drop legacy preset columns + constraints
alter table public.venue_reminder_cadence
  drop constraint if exists venue_reminder_cadence_payment_before_due_cadence_check;
alter table public.venue_reminder_cadence
  drop constraint if exists venue_reminder_cadence_contract_before_due_cadence_check;

alter table public.venue_reminder_cadence
  drop column if exists payment_before_due_cadence,
  drop column if exists contract_before_due_cadence;

comment on table public.venue_reminder_cadence is
  'Venue reminder cadence. Before-due: explicit day offsets relative to '
  'payment due / contract expiration (allowed: 21,14,7,0; empty = don''t send). '
  'After-due: named recurrence presets (daily / every_3_days / weekly / none).';

-- 5. Replace RPCs — argument types change, so drop then recreate
drop function if exists public.get_reminder_cadence();
drop function if exists public.update_reminder_cadence(text, text, text, text);

create or replace function public.get_reminder_cadence()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_row      public.venue_reminder_cadence%rowtype;
begin
  select id into v_venue_id from public.venues where owner_user_id = auth.uid();
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  select * into v_row from public.venue_reminder_cadence where venue_id = v_venue_id;
  if not found then
    return jsonb_build_object(
      'paymentBeforeDueOffsets',  to_jsonb(array[-21, -14, -7]),
      'paymentAfterDueCadence',   'daily',
      'contractBeforeDueOffsets', to_jsonb(array[-21, -14, -7]),
      'taskAfterDueCadence',      'every_3_days'
    );
  end if;

  return jsonb_build_object(
    'paymentBeforeDueOffsets',  to_jsonb(v_row.payment_before_due_offsets),
    'paymentAfterDueCadence',   v_row.payment_after_due_cadence,
    'contractBeforeDueOffsets', to_jsonb(v_row.contract_before_due_offsets),
    'taskAfterDueCadence',      v_row.task_after_due_cadence
  );
end;
$$;

grant execute on function public.get_reminder_cadence() to authenticated;

create or replace function public.update_reminder_cadence(
  p_payment_before_due_offsets  int[] default null,
  p_payment_after_due_cadence   text  default null,
  p_contract_before_due_offsets int[] default null,
  p_task_after_due_cadence      text  default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_payment_offsets  int[];
  v_contract_offsets int[];
begin
  select id into v_venue_id from public.venues where owner_user_id = auth.uid();
  if not found then return jsonb_build_object('ok', false); end if;

  -- Normalize: keep only allowed unique offsets, descending (21→0)
  if p_payment_before_due_offsets is not null then
    select coalesce(array_agg(d order by d), array[]::int[])
      into v_payment_offsets
    from (select distinct unnest(p_payment_before_due_offsets) as d) s
    where d = any (array[-21, -14, -7, 0]);
  end if;

  if p_contract_before_due_offsets is not null then
    select coalesce(array_agg(d order by d), array[]::int[])
      into v_contract_offsets
    from (select distinct unnest(p_contract_before_due_offsets) as d) s
    where d = any (array[-21, -14, -7, 0]);
  end if;

  insert into public.venue_reminder_cadence (
    venue_id,
    payment_before_due_offsets,
    payment_after_due_cadence,
    contract_before_due_offsets,
    task_after_due_cadence,
    updated_at
  ) values (
    v_venue_id,
    coalesce(v_payment_offsets, array[-21, -14, -7]),
    coalesce(p_payment_after_due_cadence, 'daily'),
    coalesce(v_contract_offsets, array[-21, -14, -7]),
    coalesce(p_task_after_due_cadence, 'every_3_days'),
    now()
  )
  on conflict (venue_id) do update set
    payment_before_due_offsets  = coalesce(v_payment_offsets,  venue_reminder_cadence.payment_before_due_offsets),
    payment_after_due_cadence   = coalesce(p_payment_after_due_cadence,   venue_reminder_cadence.payment_after_due_cadence),
    contract_before_due_offsets = coalesce(v_contract_offsets, venue_reminder_cadence.contract_before_due_offsets),
    task_after_due_cadence      = coalesce(p_task_after_due_cadence,      venue_reminder_cadence.task_after_due_cadence),
    updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.update_reminder_cadence(int[], text, int[], text) to authenticated;
