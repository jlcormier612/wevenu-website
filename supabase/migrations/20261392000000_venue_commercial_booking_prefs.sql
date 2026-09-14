-- Venue commercial booking preferences (Hello to Cheers Commercial Booking Spine).
-- Sensible venue-level defaults for agreement method, process order, initial payment,
-- and payment collection — not a workflow builder.

alter table public.venues
  add column if not exists commercial_booking_prefs jsonb not null default '{
    "agreementMethod": "either",
    "processOrder": "agreement_first",
    "initialPaymentRequired": true,
    "paymentCollection": "either",
    "defaultDepositPercent": 25,
    "remainingBalanceMode": "varies",
    "defaultSchedulePresetId": null
  }'::jsonb;

comment on column public.venues.commercial_booking_prefs is
  'Venue defaults for the commercial booking spine: agreement method, process order, initial payment, collection mode, deposit %, remaining balance mode.';
