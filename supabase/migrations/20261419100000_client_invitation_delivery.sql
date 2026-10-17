-- Client portal invitation delivery is separate from invitation status
-- (pending / accepted / revoked). delivery_status follows the outbound
-- email lifecycle. provider_message_id is the Resend id the messaging
-- webhook matches. This migration is not applied by the change that adds it.

alter table public.client_invitations
  add column if not exists provider_message_id text,
  add column if not exists delivery_status text,
  add column if not exists delivery_error text,
  add column if not exists delivered_at timestamptz;

alter table public.client_invitations
  drop constraint if exists client_invitations_delivery_status_check;

alter table public.client_invitations
  add constraint client_invitations_delivery_status_check
  check (
    delivery_status is null
    or delivery_status in (
      'sending',
      'accepted',
      'delivered',
      'opened',
      'clicked',
      'failed'
    )
  );

create unique index if not exists client_invitations_provider_message_id
  on public.client_invitations (provider_message_id)
  where provider_message_id is not null;

grant select, update on public.client_invitations to service_role;
