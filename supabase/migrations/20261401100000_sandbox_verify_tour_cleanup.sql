-- Read-only verification of Sandbox tour cleanup (no data changes).
do $$
declare
  v_venue uuid := 'a415ac52-cd74-42a6-8df7-7a8f6e71d080';
  r record;
  n int;
begin
  select count(*) into n from public.tour_appointments where venue_id = v_venue;
  raise notice 'TOUR_COUNT=%', n;
  for r in
    select id, contact_name, contact_email, scheduled_at
    from public.tour_appointments
    where venue_id = v_venue
    order by scheduled_at
  loop
    raise notice 'TOUR id=% name=% email=% at=%',
      r.id, coalesce(r.contact_name, '<null>'), coalesce(r.contact_email, '<null>'), r.scheduled_at;
  end loop;

  if exists (
    select 1 from public.tour_appointments
    where venue_id = v_venue
      and id in (
        'f8477dfb-3374-4327-b13d-8993ed5d0671',
        'dc177996-86b7-4f37-8b97-323e03eadf00',
        '85b60faa-3255-4428-9671-5f4ae21ec23d',
        '319dece4-0f73-4333-a055-143a390961aa'
      )
  ) then
    raise exception 'Synthetic tour fixtures still present';
  end if;

  if exists (
    select 1 from public.venue_customer_relationships
    where id in (
      '6bf4ef6c-ff8e-4016-a0a5-8a7450f2fd86',
      '83c06630-81c2-467b-8cc2-5a42e8064c91',
      '0e3b606e-fbdb-48b4-ab8d-e4b93f496d1b'
    )
  ) then
    raise exception 'Synthetic E2E relationships still present';
  end if;

  raise notice 'CLEANUP_OK';
end $$;
