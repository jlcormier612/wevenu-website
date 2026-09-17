-- Normalize lead/event event_type case variants to canonical keys.
-- Sandbox had both "Wedding" and "wedding", which produced duplicate Leads filters
-- with the same human label. Canonical vocabulary is lowercase snake_case
-- (see lib/event-types/canonical.ts). Label-matching aliases stay as before.

-- Known title-case / alias → canonical
update public.leads
set event_type = 'wedding'
where event_type is not null
  and lower(trim(event_type)) = 'wedding'
  and event_type <> 'wedding';

update public.leads
set event_type = 'corporate'
where event_type is not null
  and lower(trim(event_type)) in ('corporate', 'corporate_event', 'corporate event')
  and event_type <> 'corporate';

update public.leads
set event_type = 'birthday'
where event_type is not null
  and lower(trim(event_type)) in ('birthday', 'birthday_milestone', 'birthday party')
  and event_type <> 'birthday';

update public.leads
set event_type = 'rehearsal_dinner'
where event_type is not null
  and lower(replace(trim(event_type), ' ', '_')) = 'rehearsal_dinner'
  and event_type <> 'rehearsal_dinner';

update public.leads
set event_type = 'social_event'
where event_type is not null
  and lower(replace(trim(event_type), ' ', '_')) = 'social_event'
  and event_type <> 'social_event';

-- Events table (same vocabulary)
update public.events
set event_type = 'wedding'
where event_type is not null
  and lower(trim(event_type)) = 'wedding'
  and event_type <> 'wedding';

update public.events
set event_type = 'corporate'
where event_type is not null
  and lower(trim(event_type)) in ('corporate', 'corporate_event', 'corporate event')
  and event_type <> 'corporate';

update public.events
set event_type = 'birthday'
where event_type is not null
  and lower(trim(event_type)) in ('birthday', 'birthday_milestone', 'birthday party')
  and event_type <> 'birthday';

update public.events
set event_type = 'rehearsal_dinner'
where event_type is not null
  and lower(replace(trim(event_type), ' ', '_')) = 'rehearsal_dinner'
  and event_type <> 'rehearsal_dinner';

update public.events
set event_type = 'social_event'
where event_type is not null
  and lower(replace(trim(event_type), ' ', '_')) = 'social_event'
  and event_type <> 'social_event';
