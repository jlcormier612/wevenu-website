-- Lost transition: persist why the opportunity was marked Lost.
alter table public.leads
  add column if not exists lost_reason text,
  add column if not exists lost_reason_detail text,
  add column if not exists lost_at timestamptz;

comment on column public.leads.lost_reason is
  'Structured lost reason (chose_another_venue, date_unavailable, budget, no_response, cancelled, other).';
comment on column public.leads.lost_reason_detail is
  'Optional free-text detail; required when lost_reason = other.';
comment on column public.leads.lost_at is
  'When the lead was marked Lost (venue-local transition time, stored as timestamptz).';
