-- Event Order couple document link — /order/{review_token}.
-- Same secret-link model as /offer/{accept_token} and /sign/{token}: works for
-- every client whether or not they have been invited to the portal. The page
-- only renders after the venue shares (shared_at), and only the shared copy.

alter table public.event_orders
  add column if not exists review_token text;

update public.event_orders
set review_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where review_token is null;

alter table public.event_orders
  alter column review_token set default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  alter column review_token set not null;

create unique index if not exists event_orders_review_token_key
  on public.event_orders (review_token);

comment on column public.event_orders.review_token is
  'Secret couple link token for /order/{token}. Opens only the shared Event Order document with inline choices and one Approve.';

notify pgrst, 'reload schema';
