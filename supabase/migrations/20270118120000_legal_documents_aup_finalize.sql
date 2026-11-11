-- Finalize Acceptable Use Policy for production wording.
-- Source of truth for public marketing pages: marketing/lib/marketing/legal.ts
-- Effective date unchanged: 2026-07-15. New version row preserves prior acceptances.
-- Does not rewrite historical migrations or mutate legal_acceptances rows.

update public.legal_documents
set
  is_active = false,
  updated_at = now()
where document_type = 'acceptable_use_policy'
  and is_active = true;

insert into public.legal_documents (
  document_type,
  title,
  version,
  effective_date,
  content,
  is_published,
  is_active
) values
  (
    'acceptable_use_policy',
    'Acceptable Use Policy',
    '2026-07-15.2',
    '2026-07-15',
    $aup$
# Acceptable Use Policy

Effective date: July 15, 2026

This Acceptable Use Policy (“AUP”) describes prohibited uses of Hello to Cheers (“HTC,” “we,” “us,” or “our”), operated by QuickCloud LLC, a Massachusetts limited liability company. It helps protect venues, clients, guests, vendors, and the integrity of the platform.

## 1. Purpose

This AUP applies to anyone who uses Hello to Cheers—including venue owners and staff, clients and couples, vendors, and other invited participants—together with the Venue Subscription Agreement, End User Terms, Vendor Terms, Privacy Policy, and Cookie Policy, as applicable. Public visitors who use limited features (such as inquiry forms, tour requests, RSVPs, or wedding websites) must still use those features lawfully and must not abuse or disrupt the Services.

Hello to Cheers is event-management software for hospitality businesses and the people who plan and deliver celebrations with them. This AUP sets clear boundaries so the platform remains safe, lawful, and trustworthy.

## 2. Prohibited Activities

You may not use Hello to Cheers to:

- Violate applicable laws or regulations.
- Infringe intellectual property, privacy, or publicity rights.
- Upload malware, attempt unauthorized access, or disrupt the Services.
- Probe, scan, or test system vulnerability without authorization.
- Send spam, phishing, or unsolicited bulk communications unrelated to legitimate venue, event, or hospitality operations you are authorized to conduct.
- Harass, threaten, or exploit individuals.
- Store or transmit unlawful content.
- Misrepresent your identity or affiliation in a deceptive manner, including deceptive vendor profiles or false invitation or account-claiming activity.
- Access, share, or misuse private event, guest, RSVP, or client information beyond what you are authorized to use for legitimate planning or service coordination.
- Share login credentials in a way that enables unauthorized access, or attempt to circumvent permissions or security controls.
- Resell or provide the Services to third parties except as expressly permitted.
- Use automated means to scrape or overload the Services beyond ordinary product use, including automated abuse of public forms.
- Use optional AI-assisted features for unlawful or harmful activity, to bypass safeguards, to submit information you are not authorized to share, or to generate content used to impersonate, deceive, or harass.

Authorized hospitality communications—such as inquiry responses, tour reminders, planning updates, guest information, and related event coordination—are permitted when they comply with this AUP, your applicable agreement, and applicable law. Accepting this AUP is not consent to receive marketing text messages.

## 3. Customer Communications

Venues remain responsible for the content of messages and documents they send through Hello to Cheers to clients, guests, vendors, and staff, and for complying with applicable messaging and privacy laws. Additional customer-communications and text-messaging responsibilities—including permission requirements and STOP/START handling—are set out in the Venue Subscription Agreement and Privacy Policy.

Vendors and clients are responsible for communications they initiate through Hello to Cheers and for using event or contact information only as authorized.

## 4. Enforcement

We may investigate suspected violations and may suspend or terminate access, remove content, or report activity to authorities when appropriate.

## 5. Reporting

Report suspected abuse to abuse@hellotocheers.com.

Where available, you may also contact Hello to Cheers through product support or feedback channels for general help. Those channels are not a substitute for emailing abuse@hellotocheers.com when you need to report abuse or security concerns.

## 6. Changes

We may update this AUP from time to time. When we do, we will post the revised policy with an updated effective date. Continued use of Hello to Cheers after updates take effect constitutes acceptance of the updated AUP.
$aup$,
    true,
    true
  )
on conflict (document_type, version) do update
  set
    title = excluded.title,
    effective_date = excluded.effective_date,
    content = excluded.content,
    is_published = excluded.is_published,
    is_active = excluded.is_active,
    updated_at = now();

update public.legal_documents
set
  is_active = false,
  updated_at = now()
where document_type = 'acceptable_use_policy'
  and version is distinct from '2026-07-15.2'
  and is_active = true;

update public.legal_documents
set
  is_active = true,
  updated_at = now()
where document_type = 'acceptable_use_policy'
  and version = '2026-07-15.2'
  and is_active = false;

notify pgrst, 'reload schema';
