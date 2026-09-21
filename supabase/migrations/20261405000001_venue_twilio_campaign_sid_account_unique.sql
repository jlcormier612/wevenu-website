-- Twilio Mock A2P recycles Campaign SID strings across subaccounts (observed:
-- disposable venue Usa2p rows receive the same QE… as QuickCloud). Global
-- uniqueness on a2p_campaign_sid alone blocks legitimate disposable rows.
-- Scope uniqueness to the owning Twilio account instead.

drop index if exists public.venue_twilio_accounts_a2p_campaign_sid_uidx;

create unique index if not exists venue_twilio_accounts_account_campaign_uidx
  on public.venue_twilio_accounts (twilio_account_sid, a2p_campaign_sid)
  where a2p_campaign_sid is not null;
