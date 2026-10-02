-- ============================================================================
-- CTR-01 Additional Event Spaces — safe refresh only.
-- 1) Exact known prior platform CTR-01 bodies → full current master
--    (Venue / Ceremony / Reception / Additional Event Spaces; no {{event_spaces}}
--    duplication in the starter schedule section).
-- 2) Customized CTR-01 that still contain the exact stock Ceremony/Reception
--    placeholder block → surgical replace of that block only (includes Additional).
-- 3) Customized CTR-01 that contain the exact ceremony/reception-only Smart Field
--    block and do NOT yet advertise {{additional_event_spaces}} → surgical insert
--    of the Additional Event Spaces section.
-- Never refreshes by source_master_key alone or by missing tokens.
-- Customer-authored templates (source_master_key IS NULL) are untouched.
-- Does not rewrite contracts, drafts, sent, or executed bodies.
-- Idempotent.
-- Classification mirrors lib/contracts/ctr01-refresh.ts.
-- ============================================================================

-- Full refresh: byte-equal prior untouched platform masters only.
UPDATE public.contract_templates
SET
  content = $ctr01_new$Wedding Venue Agreement

This Agreement is between {{venue_name}} and {{client_name}} for the celebration described below.

The purpose of this Agreement is to document the services, spaces, event details, payment arrangements, and responsibilities agreed upon by the parties.

────────────────────────────────
CLIENT & EVENT DETAILS
────────────────────────────────
Venue
{{venue_name}}
{{venue_address}}
{{venue_phone}}
{{venue_email}}

Client
{{client_name}}
{{client_email}}
{{client_phone}}

Event
{{event_name}}
Event Date: {{event_date}}
Event Type: {{event_type}}
Guest Count: {{guest_count}}

────────────────────────────────
EVENT SCHEDULE
────────────────────────────────
Event Date
{{event_date}}

Venue Access / Event Hours
Add your venue's approved access hours and event-day timing language here.

Venue
{{venue_name}}

Ceremony
{{ceremony_space}}

Reception
{{reception_space}}

Additional Event Spaces
{{additional_event_spaces}}

────────────────────────────────
SERVICES & PACKAGE
────────────────────────────────
{{package_section}}

Total contracted amount
{{contract_total}}

────────────────────────────────
INCLUDED ITEMS & SERVICES
────────────────────────────────
Included
{{included_items_summary}}

Additional / Optional
{{additional_items_summary}}

────────────────────────────────
PAYMENT
────────────────────────────────
{{payment_schedule_summary}}

Total contracted amount
{{contract_total}}

Balance remaining
{{balance_remaining}}

────────────────────────────────
VENUE POLICIES
────────────────────────────────
Cancellation & Rescheduling
Venue policy
Add your venue's approved cancellation and rescheduling policy here.

Payment & Late Payment
Venue policy
Add your venue's approved payment and late-payment terms here.

Guest Count & Final Details
Venue policy
Add your venue's approved guest-count and final-details requirements here.

Event Changes
Venue policy
Add your venue's approved policy for changes to event details, services, spaces, or package selections here.

────────────────────────────────
CLIENT RESPONSIBILITIES
────────────────────────────────
Add your venue's approved client responsibilities and requirements here.

────────────────────────────────
VENUE RESPONSIBILITIES
────────────────────────────────
Add your venue's approved description of venue responsibilities and included services here.

────────────────────────────────
VENDORS & OUTSIDE SERVICES
────────────────────────────────
Add your venue's approved vendor and outside-service policy here.

────────────────────────────────
FOOD & BEVERAGE
────────────────────────────────
Add your venue's approved food and beverage requirements, catering policy, and related terms here.

────────────────────────────────
ALCOHOL
────────────────────────────────
Add your venue's approved alcohol policy and requirements here.

────────────────────────────────
DECOR, SETUP & PROPERTY
────────────────────────────────
Add your venue's approved decor, setup, cleanup, property-care, and damage terms here.

────────────────────────────────
INSURANCE
────────────────────────────────
Add your venue's approved insurance requirements here.

────────────────────────────────
EVENT-DAY REQUIREMENTS
────────────────────────────────
Add your venue's approved event-day requirements and procedures here.

────────────────────────────────
CANCELLATION & TERMINATION
────────────────────────────────
Add your venue's approved cancellation and termination language here.

────────────────────────────────
FORCE MAJEURE / UNFORESEEN CIRCUMSTANCES
────────────────────────────────
Add your venue's approved force majeure or unforeseen-circumstances language here.

────────────────────────────────
DISPUTE RESOLUTION
────────────────────────────────
Add your venue's approved dispute-resolution language here.

────────────────────────────────
GOVERNING LAW
────────────────────────────────
Add your venue's approved governing-law language here.

────────────────────────────────
ADDITIONAL TERMS
────────────────────────────────
Add any additional venue-approved terms that apply to this agreement here.

────────────────────────────────
ACKNOWLEDGMENT
────────────────────────────────
By signing this Agreement, the parties acknowledge that they have reviewed the information and terms presented in this Agreement and intend to enter into the agreement represented by this document.

────────────────────────────────
SIGNATURES
────────────────────────────────
Client
{{client_name}}

Signature: ________________________________
Date: ____________________________________

Venue
{{venue_name}}

Authorized Representative: ________________
Signature: ________________________________
Date: {{today_date}}
$ctr01_new$,
  updated_at = now()
WHERE source_master_key = 'CTR-01'
  AND content IN (
    $ctr01_prior1$
Wedding Venue Agreement

This Agreement is between {{venue_name}} and {{client_name}} for the celebration described below.

The purpose of this Agreement is to document the services, spaces, event details, payment arrangements, and responsibilities agreed upon by the parties.

────────────────────────────────
CLIENT & EVENT DETAILS
────────────────────────────────
Venue
{{venue_name}}
{{venue_address}}
{{venue_phone}}
{{venue_email}}

Client
{{client_name}}
{{client_email}}
{{client_phone}}

Event
{{event_name}}
Event Date: {{event_date}}
Event Type: {{event_type}}
Guest Count: {{guest_count}}

────────────────────────────────
EVENT SCHEDULE
────────────────────────────────
Event Date
{{event_date}}

Venue Access / Event Hours
Add your venue's approved access hours and event-day timing language here.

Ceremony
Add your venue's approved ceremony timing and location language here, or leave blank until those details are confirmed.

Reception
Add your venue's approved reception timing and location language here, or leave blank until those details are confirmed.

────────────────────────────────
VENUE & EVENT SPACES
────────────────────────────────
The event will take place at {{venue_name}} using the spaces included in the booking.

Add your venue's approved description of the event spaces and any space-use terms here.

────────────────────────────────
SERVICES & PACKAGE
────────────────────────────────
Add your venue's approved description of the selected package, included services, and any package-specific terms here.

────────────────────────────────
INCLUDED ITEMS & SERVICES
────────────────────────────────
Add your venue's approved list of included items and services here, or reference the booking package on file.

────────────────────────────────
PAYMENT
────────────────────────────────
Add your venue's approved payment schedule, deposit, balance due, and late-payment terms here.

────────────────────────────────
VENUE POLICIES
────────────────────────────────
Cancellation & Rescheduling
Venue policy
Add your venue's approved cancellation and rescheduling policy here.

Payment & Late Payment
Venue policy
Add your venue's approved payment and late-payment terms here.

Guest Count & Final Details
Venue policy
Add your venue's approved guest-count and final-details requirements here.

Event Changes
Venue policy
Add your venue's approved policy for changes to event details, services, spaces, or package selections here.

────────────────────────────────
CLIENT RESPONSIBILITIES
────────────────────────────────
Add your venue's approved client responsibilities and requirements here.

────────────────────────────────
VENUE RESPONSIBILITIES
────────────────────────────────
Add your venue's approved description of venue responsibilities and included services here.

────────────────────────────────
VENDORS & OUTSIDE SERVICES
────────────────────────────────
Add your venue's approved vendor and outside-service policy here.

────────────────────────────────
FOOD & BEVERAGE
────────────────────────────────
Add your venue's approved food and beverage requirements, catering policy, and related terms here.

────────────────────────────────
ALCOHOL
────────────────────────────────
Add your venue's approved alcohol policy and requirements here.

────────────────────────────────
DECOR, SETUP & PROPERTY
────────────────────────────────
Add your venue's approved decor, setup, cleanup, property-care, and damage terms here.

────────────────────────────────
INSURANCE
────────────────────────────────
Add your venue's approved insurance requirements here.

────────────────────────────────
EVENT-DAY REQUIREMENTS
────────────────────────────────
Add your venue's approved event-day requirements and procedures here.

────────────────────────────────
CANCELLATION & TERMINATION
────────────────────────────────
Add your venue's approved cancellation and termination language here.

────────────────────────────────
FORCE MAJEURE / UNFORESEEN CIRCUMSTANCES
────────────────────────────────
Add your venue's approved force majeure or unforeseen-circumstances language here.

────────────────────────────────
DISPUTE RESOLUTION
────────────────────────────────
Add your venue's approved dispute-resolution language here.

────────────────────────────────
GOVERNING LAW
────────────────────────────────
Add your venue's approved governing-law language here.

────────────────────────────────
ADDITIONAL TERMS
────────────────────────────────
Add any additional venue-approved terms that apply to this agreement here.

────────────────────────────────
ACKNOWLEDGMENT
────────────────────────────────
By signing this Agreement, the parties acknowledge that they have reviewed the information and terms presented in this Agreement and intend to enter into the agreement represented by this document.

────────────────────────────────
SIGNATURES
────────────────────────────────
Client
{{client_name}}

Signature: ________________________________
Date: ____________________________________

Venue
{{venue_name}}

Authorized Representative: ________________
Signature: ________________________________
Date: {{today_date}}

$ctr01_prior1$,
    $ctr01_prior2$
Wedding Venue Agreement

This Agreement is between {{venue_name}} and {{client_name}} for the celebration described below.

The purpose of this Agreement is to document the services, spaces, event details, payment arrangements, and responsibilities agreed upon by the parties.

────────────────────────────────
CLIENT & EVENT DETAILS
────────────────────────────────
Venue
{{venue_name}}
{{venue_address}}
{{venue_phone}}
{{venue_email}}

Client
{{client_name}}
{{client_email}}
{{client_phone}}

Event
{{event_name}}
Event Date: {{event_date}}
Event Type: {{event_type}}
Guest Count: {{guest_count}}
Event Spaces: {{event_spaces}}

────────────────────────────────
EVENT SCHEDULE
────────────────────────────────
Event Date
{{event_date}}

Venue Access / Event Hours
Add your venue's approved access hours and event-day timing language here.

Ceremony
Add your venue's approved ceremony timing and location language here, or leave blank until those details are confirmed.

Reception
Add your venue's approved reception timing and location language here, or leave blank until those details are confirmed.

────────────────────────────────
VENUE & EVENT SPACES
────────────────────────────────
The event will take place at {{venue_name}} using the spaces included in the booking.

{{event_spaces}}

────────────────────────────────
SERVICES & PACKAGE
────────────────────────────────
{{package_section}}

Total contracted amount
{{contract_total}}

────────────────────────────────
INCLUDED ITEMS & SERVICES
────────────────────────────────
Included
{{included_items_summary}}

Additional / Optional
{{additional_items_summary}}

────────────────────────────────
PAYMENT
────────────────────────────────
{{payment_schedule_summary}}

Total contracted amount
{{contract_total}}

Balance remaining
{{balance_remaining}}


────────────────────────────────
VENUE POLICIES
────────────────────────────────
Cancellation & Rescheduling
Venue policy
Add your venue's approved cancellation and rescheduling policy here.

Payment & Late Payment
Venue policy
Add your venue's approved payment and late-payment terms here.

Guest Count & Final Details
Venue policy
Add your venue's approved guest-count and final-details requirements here.

Event Changes
Venue policy
Add your venue's approved policy for changes to event details, services, spaces, or package selections here.

────────────────────────────────
CLIENT RESPONSIBILITIES
────────────────────────────────
Add your venue's approved client responsibilities and requirements here.

────────────────────────────────
VENUE RESPONSIBILITIES
────────────────────────────────
Add your venue's approved description of venue responsibilities and included services here.

────────────────────────────────
VENDORS & OUTSIDE SERVICES
────────────────────────────────
Add your venue's approved vendor and outside-service policy here.

────────────────────────────────
FOOD & BEVERAGE
────────────────────────────────
Add your venue's approved food and beverage requirements, catering policy, and related terms here.

────────────────────────────────
ALCOHOL
────────────────────────────────
Add your venue's approved alcohol policy and requirements here.

────────────────────────────────
DECOR, SETUP & PROPERTY
────────────────────────────────
Add your venue's approved decor, setup, cleanup, property-care, and damage terms here.

────────────────────────────────
INSURANCE
────────────────────────────────
Add your venue's approved insurance requirements here.

────────────────────────────────
EVENT-DAY REQUIREMENTS
────────────────────────────────
Add your venue's approved event-day requirements and procedures here.

────────────────────────────────
CANCELLATION & TERMINATION
────────────────────────────────
Add your venue's approved cancellation and termination language here.

────────────────────────────────
FORCE MAJEURE / UNFORESEEN CIRCUMSTANCES
────────────────────────────────
Add your venue's approved force majeure or unforeseen-circumstances language here.

────────────────────────────────
DISPUTE RESOLUTION
────────────────────────────────
Add your venue's approved dispute-resolution language here.

────────────────────────────────
GOVERNING LAW
────────────────────────────────
Add your venue's approved governing-law language here.

────────────────────────────────
ADDITIONAL TERMS
────────────────────────────────
Add any additional venue-approved terms that apply to this agreement here.

────────────────────────────────
ACKNOWLEDGMENT
────────────────────────────────
By signing this Agreement, the parties acknowledge that they have reviewed the information and terms presented in this Agreement and intend to enter into the agreement represented by this document.

────────────────────────────────
SIGNATURES
────────────────────────────────
Client
{{client_name}}

Signature: ________________________________
Date: ____________________________________

Venue
{{venue_name}}

Authorized Representative: ________________
Signature: ________________________________
Date: {{today_date}}

$ctr01_prior2$,
    $ctr01_prior3$Wedding Venue Agreement

This Agreement is between {{venue_name}} and {{client_name}} for the celebration described below.

The purpose of this Agreement is to document the services, spaces, event details, payment arrangements, and responsibilities agreed upon by the parties.

────────────────────────────────
CLIENT & EVENT DETAILS
────────────────────────────────
Venue
{{venue_name}}
{{venue_address}}
{{venue_phone}}
{{venue_email}}

Client
{{client_name}}
{{client_email}}
{{client_phone}}

Event
{{event_name}}
Event Date: {{event_date}}
Event Type: {{event_type}}
Guest Count: {{guest_count}}
Event Spaces: {{event_spaces}}

────────────────────────────────
EVENT SCHEDULE
────────────────────────────────
Event Date
{{event_date}}

Venue Access / Event Hours
Add your venue's approved access hours and event-day timing language here.

Ceremony
Add your venue's approved ceremony timing and location language here, or leave blank until those details are confirmed.

Reception
Add your venue's approved reception timing and location language here, or leave blank until those details are confirmed.

────────────────────────────────
VENUE & EVENT SPACES
────────────────────────────────
The event will take place at {{venue_name}} using the spaces included in the booking.

{{event_spaces}}

────────────────────────────────
SERVICES & PACKAGE
────────────────────────────────
{{package_section}}

Total contracted amount
{{contract_total}}

────────────────────────────────
INCLUDED ITEMS & SERVICES
────────────────────────────────
Included
{{included_items_summary}}

Additional / Optional
{{additional_items_summary}}

────────────────────────────────
PAYMENT
────────────────────────────────
{{payment_schedule_summary}}

Total contracted amount
{{contract_total}}

Balance remaining
{{balance_remaining}}

Balance remaining (confirmation)
{{balance_remaining}}

────────────────────────────────
VENUE POLICIES
────────────────────────────────
Cancellation & Rescheduling
Venue policy
Add your venue's approved cancellation and rescheduling policy here.

Payment & Late Payment
Venue policy
Add your venue's approved payment and late-payment terms here.

Guest Count & Final Details
Venue policy
Add your venue's approved guest-count and final-details requirements here.

Event Changes
Venue policy
Add your venue's approved policy for changes to event details, services, spaces, or package selections here.

────────────────────────────────
CLIENT RESPONSIBILITIES
────────────────────────────────
Add your venue's approved client responsibilities and requirements here.

────────────────────────────────
VENUE RESPONSIBILITIES
────────────────────────────────
Add your venue's approved description of venue responsibilities and included services here.

────────────────────────────────
VENDORS & OUTSIDE SERVICES
────────────────────────────────
Add your venue's approved vendor and outside-service policy here.

────────────────────────────────
FOOD & BEVERAGE
────────────────────────────────
Add your venue's approved food and beverage requirements, catering policy, and related terms here.

────────────────────────────────
ALCOHOL
────────────────────────────────
Add your venue's approved alcohol policy and requirements here.

────────────────────────────────
DECOR, SETUP & PROPERTY
────────────────────────────────
Add your venue's approved decor, setup, cleanup, property-care, and damage terms here.

────────────────────────────────
INSURANCE
────────────────────────────────
Add your venue's approved insurance requirements here.

────────────────────────────────
EVENT-DAY REQUIREMENTS
────────────────────────────────
Add your venue's approved event-day requirements and procedures here.

────────────────────────────────
CANCELLATION & TERMINATION
────────────────────────────────
Add your venue's approved cancellation and termination language here.

────────────────────────────────
FORCE MAJEURE / UNFORESEEN CIRCUMSTANCES
────────────────────────────────
Add your venue's approved force majeure or unforeseen-circumstances language here.

────────────────────────────────
DISPUTE RESOLUTION
────────────────────────────────
Add your venue's approved dispute-resolution language here.

────────────────────────────────
GOVERNING LAW
────────────────────────────────
Add your venue's approved governing-law language here.

────────────────────────────────
ADDITIONAL TERMS
────────────────────────────────
Add any additional venue-approved terms that apply to this agreement here.

────────────────────────────────
ACKNOWLEDGMENT
────────────────────────────────
By signing this Agreement, the parties acknowledge that they have reviewed the information and terms presented in this Agreement and intend to enter into the agreement represented by this document.

────────────────────────────────
SIGNATURES
────────────────────────────────
Client
{{client_name}}

Signature: ________________________________
Date: ____________________________________

Venue
{{venue_name}}

Authorized Representative: ________________
Signature: ________________________________
Date: {{today_date}}

$ctr01_prior3$,
    $ctr01_prior4$
Wedding Venue Agreement

This Agreement is between {{venue_name}} and {{client_name}} for the celebration described below.

The purpose of this Agreement is to document the services, spaces, event details, payment arrangements, and responsibilities agreed upon by the parties.

────────────────────────────────
CLIENT & EVENT DETAILS
────────────────────────────────
Venue
{{venue_name}}
{{venue_address}}
{{venue_phone}}
{{venue_email}}

Client
{{client_name}}
{{client_email}}
{{client_phone}}

Event
{{event_name}}
Event Date: {{event_date}}
Event Type: {{event_type}}
Guest Count: {{guest_count}}
Event Spaces: {{event_spaces}}

────────────────────────────────
EVENT SCHEDULE
────────────────────────────────
Event Date
{{event_date}}

Venue Access / Event Hours
Add your venue's approved access hours and event-day timing language here.

Ceremony
Add your venue's approved ceremony timing and location language here, or leave blank until those details are confirmed.

Reception
Add your venue's approved reception timing and location language here, or leave blank until those details are confirmed.

────────────────────────────────
VENUE & EVENT SPACES
────────────────────────────────
The event will take place at {{venue_name}} using the spaces included in the booking.

{{event_spaces}}

────────────────────────────────
SERVICES & PACKAGE
────────────────────────────────
{{package_section}}

Total contracted amount
{{contract_total}}

────────────────────────────────
INCLUDED ITEMS & SERVICES
────────────────────────────────
Included
{{included_items_summary}}

Additional / Optional
{{additional_items_summary}}

────────────────────────────────
PAYMENT
────────────────────────────────
{{payment_schedule_summary}}

Total contracted amount
{{contract_total}}

Balance remaining
{{balance_remaining}}

Balance remaining (confirmation)
{{balance_remaining}}

────────────────────────────────
VENUE POLICIES
────────────────────────────────
Cancellation & Rescheduling
Venue policy
Add your venue's approved cancellation and rescheduling policy here.

Payment & Late Payment
Venue policy
Add your venue's approved payment and late-payment terms here.

Guest Count & Final Details
Venue policy
Add your venue's approved guest-count and final-details requirements here.

Event Changes
Venue policy
Add your venue's approved policy for changes to event details, services, spaces, or package selections here.

────────────────────────────────
CLIENT RESPONSIBILITIES
────────────────────────────────
Add your venue's approved client responsibilities and requirements here.

────────────────────────────────
VENUE RESPONSIBILITIES
────────────────────────────────
Add your venue's approved description of venue responsibilities and included services here.

────────────────────────────────
VENDORS & OUTSIDE SERVICES
────────────────────────────────
Add your venue's approved vendor and outside-service policy here.

────────────────────────────────
FOOD & BEVERAGE
────────────────────────────────
Add your venue's approved food and beverage requirements, catering policy, and related terms here.

────────────────────────────────
ALCOHOL
────────────────────────────────
Add your venue's approved alcohol policy and requirements here.

────────────────────────────────
DECOR, SETUP & PROPERTY
────────────────────────────────
Add your venue's approved decor, setup, cleanup, property-care, and damage terms here.

────────────────────────────────
INSURANCE
────────────────────────────────
Add your venue's approved insurance requirements here.

────────────────────────────────
EVENT-DAY REQUIREMENTS
────────────────────────────────
Add your venue's approved event-day requirements and procedures here.

────────────────────────────────
CANCELLATION & TERMINATION
────────────────────────────────
Add your venue's approved cancellation and termination language here.

────────────────────────────────
FORCE MAJEURE / UNFORESEEN CIRCUMSTANCES
────────────────────────────────
Add your venue's approved force majeure or unforeseen-circumstances language here.

────────────────────────────────
DISPUTE RESOLUTION
────────────────────────────────
Add your venue's approved dispute-resolution language here.

────────────────────────────────
GOVERNING LAW
────────────────────────────────
Add your venue's approved governing-law language here.

────────────────────────────────
ADDITIONAL TERMS
────────────────────────────────
Add any additional venue-approved terms that apply to this agreement here.

────────────────────────────────
ACKNOWLEDGMENT
────────────────────────────────
By signing this Agreement, the parties acknowledge that they have reviewed the information and terms presented in this Agreement and intend to enter into the agreement represented by this document.

────────────────────────────────
SIGNATURES
────────────────────────────────
Client
{{client_name}}

Signature: ________________________________
Date: ____________________________________

Venue
{{venue_name}}

Authorized Representative: ________________
Signature: ________________________________
Date: {{today_date}}

$ctr01_prior4$,
    $ctr01_prior5$Wedding Venue Agreement

This Agreement is between {{venue_name}} and {{client_name}} for the celebration described below.

The purpose of this Agreement is to document the services, spaces, event details, payment arrangements, and responsibilities agreed upon by the parties.

────────────────────────────────
CLIENT & EVENT DETAILS
────────────────────────────────
Venue
{{venue_name}}
{{venue_address}}
{{venue_phone}}
{{venue_email}}

Client
{{client_name}}
{{client_email}}
{{client_phone}}

Event
{{event_name}}
Event Date: {{event_date}}
Event Type: {{event_type}}
Guest Count: {{guest_count}}
Event Spaces: {{event_spaces}}

────────────────────────────────
EVENT SCHEDULE
────────────────────────────────
Event Date
{{event_date}}

Venue Access / Event Hours
Add your venue's approved access hours and event-day timing language here.

Ceremony
{{ceremony_space}}

Reception
{{reception_space}}

────────────────────────────────
VENUE & EVENT SPACES
────────────────────────────────
The event will take place at {{venue_name}} using the spaces included in the booking.

{{event_spaces}}

────────────────────────────────
SERVICES & PACKAGE
────────────────────────────────
{{package_section}}

Total contracted amount
{{contract_total}}

────────────────────────────────
INCLUDED ITEMS & SERVICES
────────────────────────────────
Included
{{included_items_summary}}

Additional / Optional
{{additional_items_summary}}

────────────────────────────────
PAYMENT
────────────────────────────────
{{payment_schedule_summary}}

Total contracted amount
{{contract_total}}

Balance remaining
{{balance_remaining}}

────────────────────────────────
VENUE POLICIES
────────────────────────────────
Cancellation & Rescheduling
Venue policy
Add your venue's approved cancellation and rescheduling policy here.

Payment & Late Payment
Venue policy
Add your venue's approved payment and late-payment terms here.

Guest Count & Final Details
Venue policy
Add your venue's approved guest-count and final-details requirements here.

Event Changes
Venue policy
Add your venue's approved policy for changes to event details, services, spaces, or package selections here.

────────────────────────────────
CLIENT RESPONSIBILITIES
────────────────────────────────
Add your venue's approved client responsibilities and requirements here.

────────────────────────────────
VENUE RESPONSIBILITIES
────────────────────────────────
Add your venue's approved description of venue responsibilities and included services here.

────────────────────────────────
VENDORS & OUTSIDE SERVICES
────────────────────────────────
Add your venue's approved vendor and outside-service policy here.

────────────────────────────────
FOOD & BEVERAGE
────────────────────────────────
Add your venue's approved food and beverage requirements, catering policy, and related terms here.

────────────────────────────────
ALCOHOL
────────────────────────────────
Add your venue's approved alcohol policy and requirements here.

────────────────────────────────
DECOR, SETUP & PROPERTY
────────────────────────────────
Add your venue's approved decor, setup, cleanup, property-care, and damage terms here.

────────────────────────────────
INSURANCE
────────────────────────────────
Add your venue's approved insurance requirements here.

────────────────────────────────
EVENT-DAY REQUIREMENTS
────────────────────────────────
Add your venue's approved event-day requirements and procedures here.

────────────────────────────────
CANCELLATION & TERMINATION
────────────────────────────────
Add your venue's approved cancellation and termination language here.

────────────────────────────────
FORCE MAJEURE / UNFORESEEN CIRCUMSTANCES
────────────────────────────────
Add your venue's approved force majeure or unforeseen-circumstances language here.

────────────────────────────────
DISPUTE RESOLUTION
────────────────────────────────
Add your venue's approved dispute-resolution language here.

────────────────────────────────
GOVERNING LAW
────────────────────────────────
Add your venue's approved governing-law language here.

────────────────────────────────
ADDITIONAL TERMS
────────────────────────────────
Add any additional venue-approved terms that apply to this agreement here.

────────────────────────────────
ACKNOWLEDGMENT
────────────────────────────────
By signing this Agreement, the parties acknowledge that they have reviewed the information and terms presented in this Agreement and intend to enter into the agreement represented by this document.

────────────────────────────────
SIGNATURES
────────────────────────────────
Client
{{client_name}}

Signature: ________________________________
Date: ____________________________________

Venue
{{venue_name}}

Authorized Representative: ________________
Signature: ________________________________
Date: {{today_date}}
$ctr01_prior5$,
    $ctr01_prior6$
Wedding Venue Agreement

This Agreement is between {{venue_name}} and {{client_name}} for the celebration described below.

The purpose of this Agreement is to document the services, spaces, event details, payment arrangements, and responsibilities agreed upon by the parties.

────────────────────────────────
CLIENT & EVENT DETAILS
────────────────────────────────
Venue
{{venue_name}}
{{venue_address}}
{{venue_phone}}
{{venue_email}}

Client
{{client_name}}
{{client_email}}
{{client_phone}}

Event
{{event_name}}
Event Date: {{event_date}}
Event Type: {{event_type}}
Guest Count: {{guest_count}}
Event Spaces: {{event_spaces}}

────────────────────────────────
EVENT SCHEDULE
────────────────────────────────
Event Date
{{event_date}}

Venue Access / Event Hours
Add your venue's approved access hours and event-day timing language here.

Ceremony
Add your venue's approved ceremony timing and location language here, or leave blank until those details are confirmed.

Reception
Add your venue's approved reception timing and location language here, or leave blank until those details are confirmed.

────────────────────────────────
VENUE & EVENT SPACES
────────────────────────────────
The event will take place at {{venue_name}} using the spaces included in the booking.

{{event_spaces}}

────────────────────────────────
SERVICES & PACKAGE
────────────────────────────────
{{package_section}}

Total contracted amount
{{contract_total}}

────────────────────────────────
INCLUDED ITEMS & SERVICES
────────────────────────────────
Included
{{included_items_summary}}

Additional / Optional
{{additional_items_summary}}

────────────────────────────────
PAYMENT
────────────────────────────────
{{payment_schedule_summary}}

Total contracted amount
{{contract_total}}

Balance remaining
{{balance_remaining}}

────────────────────────────────
VENUE POLICIES
────────────────────────────────
Cancellation & Rescheduling
Venue policy
Add your venue's approved cancellation and rescheduling policy here.

Payment & Late Payment
Venue policy
Add your venue's approved payment and late-payment terms here.

Guest Count & Final Details
Venue policy
Add your venue's approved guest-count and final-details requirements here.

Event Changes
Venue policy
Add your venue's approved policy for changes to event details, services, spaces, or package selections here.

────────────────────────────────
CLIENT RESPONSIBILITIES
────────────────────────────────
Add your venue's approved client responsibilities and requirements here.

────────────────────────────────
VENUE RESPONSIBILITIES
────────────────────────────────
Add your venue's approved description of venue responsibilities and included services here.

────────────────────────────────
VENDORS & OUTSIDE SERVICES
────────────────────────────────
Add your venue's approved vendor and outside-service policy here.

────────────────────────────────
FOOD & BEVERAGE
────────────────────────────────
Add your venue's approved food and beverage requirements, catering policy, and related terms here.

────────────────────────────────
ALCOHOL
────────────────────────────────
Add your venue's approved alcohol policy and requirements here.

────────────────────────────────
DECOR, SETUP & PROPERTY
────────────────────────────────
Add your venue's approved decor, setup, cleanup, property-care, and damage terms here.

────────────────────────────────
INSURANCE
────────────────────────────────
Add your venue's approved insurance requirements here.

────────────────────────────────
EVENT-DAY REQUIREMENTS
────────────────────────────────
Add your venue's approved event-day requirements and procedures here.

────────────────────────────────
CANCELLATION & TERMINATION
────────────────────────────────
Add your venue's approved cancellation and termination language here.

────────────────────────────────
FORCE MAJEURE / UNFORESEEN CIRCUMSTANCES
────────────────────────────────
Add your venue's approved force majeure or unforeseen-circumstances language here.

────────────────────────────────
DISPUTE RESOLUTION
────────────────────────────────
Add your venue's approved dispute-resolution language here.

────────────────────────────────
GOVERNING LAW
────────────────────────────────
Add your venue's approved governing-law language here.

────────────────────────────────
ADDITIONAL TERMS
────────────────────────────────
Add any additional venue-approved terms that apply to this agreement here.

────────────────────────────────
ACKNOWLEDGMENT
────────────────────────────────
By signing this Agreement, the parties acknowledge that they have reviewed the information and terms presented in this Agreement and intend to enter into the agreement represented by this document.

────────────────────────────────
SIGNATURES
────────────────────────────────
Client
{{client_name}}

Signature: ________________________________
Date: ____________________________________

Venue
{{venue_name}}

Authorized Representative: ________________
Signature: ________________________________
Date: {{today_date}}
$ctr01_prior6$,
    $ctr01_prior7$Wedding Venue Agreement

This Agreement is between {{venue_name}} and {{client_name}} for the celebration described below.

The purpose of this Agreement is to document the services, spaces, event details, payment arrangements, and responsibilities agreed upon by the parties.

────────────────────────────────
CLIENT & EVENT DETAILS
────────────────────────────────
Venue
{{venue_name}}
{{venue_address}}
{{venue_phone}}
{{venue_email}}

Client
{{client_name}}
{{client_email}}
{{client_phone}}

Event
{{event_name}}
Event Date: {{event_date}}
Event Type: {{event_type}}
Guest Count: {{guest_count}}
Event Spaces: {{event_spaces}}

────────────────────────────────
EVENT SCHEDULE
────────────────────────────────
Event Date
{{event_date}}

Venue Access / Event Hours
Add your venue's approved access hours and event-day timing language here.

Ceremony
Add your venue's approved ceremony timing and location language here, or leave blank until those details are confirmed.

Reception
Add your venue's approved reception timing and location language here, or leave blank until those details are confirmed.

────────────────────────────────
VENUE & EVENT SPACES
────────────────────────────────
The event will take place at {{venue_name}} using the spaces included in the booking.

{{event_spaces}}

────────────────────────────────
SERVICES & PACKAGE
────────────────────────────────
{{package_section}}

Total contracted amount
{{contract_total}}

────────────────────────────────
INCLUDED ITEMS & SERVICES
────────────────────────────────
Included
{{included_items_summary}}

Additional / Optional
{{additional_items_summary}}

────────────────────────────────
PAYMENT
────────────────────────────────
{{payment_schedule_summary}}

Total contracted amount
{{contract_total}}

Balance remaining
{{balance_remaining}}

────────────────────────────────
VENUE POLICIES
────────────────────────────────
Cancellation & Rescheduling
Venue policy
Add your venue's approved cancellation and rescheduling policy here.

Payment & Late Payment
Venue policy
Add your venue's approved payment and late-payment terms here.

Guest Count & Final Details
Venue policy
Add your venue's approved guest-count and final-details requirements here.

Event Changes
Venue policy
Add your venue's approved policy for changes to event details, services, spaces, or package selections here.

────────────────────────────────
CLIENT RESPONSIBILITIES
────────────────────────────────
Add your venue's approved client responsibilities and requirements here.

────────────────────────────────
VENUE RESPONSIBILITIES
────────────────────────────────
Add your venue's approved description of venue responsibilities and included services here.

────────────────────────────────
VENDORS & OUTSIDE SERVICES
────────────────────────────────
Add your venue's approved vendor and outside-service policy here.

────────────────────────────────
FOOD & BEVERAGE
────────────────────────────────
Add your venue's approved food and beverage requirements, catering policy, and related terms here.

────────────────────────────────
ALCOHOL
────────────────────────────────
Add your venue's approved alcohol policy and requirements here.

────────────────────────────────
DECOR, SETUP & PROPERTY
────────────────────────────────
Add your venue's approved decor, setup, cleanup, property-care, and damage terms here.

────────────────────────────────
INSURANCE
────────────────────────────────
Add your venue's approved insurance requirements here.

────────────────────────────────
EVENT-DAY REQUIREMENTS
────────────────────────────────
Add your venue's approved event-day requirements and procedures here.

────────────────────────────────
CANCELLATION & TERMINATION
────────────────────────────────
Add your venue's approved cancellation and termination language here.

────────────────────────────────
FORCE MAJEURE / UNFORESEEN CIRCUMSTANCES
────────────────────────────────
Add your venue's approved force majeure or unforeseen-circumstances language here.

────────────────────────────────
DISPUTE RESOLUTION
────────────────────────────────
Add your venue's approved dispute-resolution language here.

────────────────────────────────
GOVERNING LAW
────────────────────────────────
Add your venue's approved governing-law language here.

────────────────────────────────
ADDITIONAL TERMS
────────────────────────────────
Add any additional venue-approved terms that apply to this agreement here.

────────────────────────────────
ACKNOWLEDGMENT
────────────────────────────────
By signing this Agreement, the parties acknowledge that they have reviewed the information and terms presented in this Agreement and intend to enter into the agreement represented by this document.

────────────────────────────────
SIGNATURES
────────────────────────────────
Client
{{client_name}}

Signature: ________________________________
Date: ____________________________________

Venue
{{venue_name}}

Authorized Representative: ________________
Signature: ________________________________
Date: {{today_date}}
$ctr01_prior7$
  );

-- Surgical: exact stock Ceremony/Reception placeholder → current Smart Field block.
UPDATE public.contract_templates
SET
  content = replace(
    content,
    $ctr01_stock_block$Ceremony
Add your venue's approved ceremony timing and location language here, or leave blank until those details are confirmed.

Reception
Add your venue's approved reception timing and location language here, or leave blank until those details are confirmed.$ctr01_stock_block$,
    $ctr01_new_block$Ceremony
{{ceremony_space}}

Reception
{{reception_space}}

Additional Event Spaces
{{additional_event_spaces}}$ctr01_new_block$
  ),
  updated_at = now()
WHERE source_master_key = 'CTR-01'
  AND content IS NOT NULL
  AND position($ctr01_stock_block2$Ceremony
Add your venue's approved ceremony timing and location language here, or leave blank until those details are confirmed.

Reception
Add your venue's approved reception timing and location language here, or leave blank until those details are confirmed.$ctr01_stock_block2$ in content) > 0
  AND (
    length(content)
    - length(replace(content, $ctr01_stock_block3$Ceremony
Add your venue's approved ceremony timing and location language here, or leave blank until those details are confirmed.

Reception
Add your venue's approved reception timing and location language here, or leave blank until those details are confirmed.$ctr01_stock_block3$, ''))
  ) = length($ctr01_stock_block4$Ceremony
Add your venue's approved ceremony timing and location language here, or leave blank until those details are confirmed.

Reception
Add your venue's approved reception timing and location language here, or leave blank until those details are confirmed.$ctr01_stock_block4$);

-- Surgical: ceremony/reception-only Smart Fields → add Additional Event Spaces.
-- Guard: skip rows that already advertise {{additional_event_spaces}}.
UPDATE public.contract_templates
SET
  content = replace(
    content,
    $ctr01_cr_only$Ceremony
{{ceremony_space}}

Reception
{{reception_space}}$ctr01_cr_only$,
    $ctr01_new_block2$Ceremony
{{ceremony_space}}

Reception
{{reception_space}}

Additional Event Spaces
{{additional_event_spaces}}$ctr01_new_block2$
  ),
  updated_at = now()
WHERE source_master_key = 'CTR-01'
  AND content IS NOT NULL
  AND position('{{additional_event_spaces}}' in content) = 0
  AND position($ctr01_cr_only2$Ceremony
{{ceremony_space}}

Reception
{{reception_space}}$ctr01_cr_only2$ in content) > 0
  AND (
    length(content)
    - length(replace(content, $ctr01_cr_only3$Ceremony
{{ceremony_space}}

Reception
{{reception_space}}$ctr01_cr_only3$, ''))
  ) = length($ctr01_cr_only4$Ceremony
{{ceremony_space}}

Reception
{{reception_space}}$ctr01_cr_only4$);

-- Safety note (comment only): Customer-authored templates (source_master_key IS NULL) are untouched.
-- Does not rewrite contracts.
