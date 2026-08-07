-- Surgical Vendor Terms wording: "couples" → "clients" in §2 Our Role.
-- Immutable new active version; effective date unchanged: 2026-07-15.

update public.legal_documents
set
  is_active = false,
  updated_at = now()
where document_type = 'vendor_end_user_terms'
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
    'vendor_end_user_terms',
    'Vendor Terms',
    '2026-07-15.3',
    '2026-07-15',
    $vt$
# Vendor Terms

Effective date: July 15, 2026

## 1. Welcome

These Vendor Terms govern your access to and use of Hello to Cheers as an invited vendor.

You are accessing Hello to Cheers because a participating venue has invited you to collaborate on one or more events through the platform.

By accepting that invitation or using Hello to Cheers, you agree to these Vendor Terms, along with our Privacy Policy, Cookie Policy, and Acceptable Use Policy.

## 2. Our Role

Hello to Cheers provides software that helps venues, clients, vendors, and venue teams collaborate around shared events.

Hello to Cheers is not:

- the venue
- your client
- your employer
- your agent
- your event coordinator

We provide the technology platform that enables collaboration.

## 3. Your Relationship With the Venue

Your business relationship remains directly with the venue and, where applicable, the couple or client.

Hello to Cheers is not a party to agreements involving:

- services
- pricing
- proposals
- contracts
- insurance
- scheduling
- payments between vendors and venues
- event execution
- disputes

Questions regarding those matters should be directed to the venue or the appropriate contracting party.

## 4. Your Information

You remain responsible for the accuracy of the information you provide.

You should keep your contact information, availability, pricing (where applicable), uploaded documents, and other business information current.

You are responsible for maintaining the security of your login credentials.

## 5. Appropriate Use

You agree to use Hello to Cheers only for legitimate business purposes connected with events and hospitality.

You may not:

- interfere with the platform
- attempt unauthorized access
- upload malicious software
- impersonate another person or business
- misuse communication tools
- violate applicable laws

Additional requirements appear in our Acceptable Use Policy.

## 6. Privacy

Our Privacy Policy explains how Hello to Cheers collects, uses, and protects information.

The venue may also maintain its own privacy practices relating to information shared through its workspace.

## 7. Availability

We work hard to provide a reliable platform.

Like all software services, Hello to Cheers may occasionally experience maintenance, updates, or unexpected interruptions.

Current operational status is available through our System Status page.

## 8. Changes

We may update these Vendor Terms from time to time.

Material changes will include an updated effective date and, where appropriate, additional notice.

Continued use after the effective date constitutes acceptance of the updated terms.

## 9. Contact

Questions regarding these Vendor Terms may be sent to:

legal@hellotocheers.com

General support is available through the contact methods listed on hellotocheers.com.
$vt$,
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

-- Ensure only this version is active if upsert re-ran against a prior active row.
update public.legal_documents
set
  is_active = false,
  updated_at = now()
where document_type = 'vendor_end_user_terms'
  and version is distinct from '2026-07-15.3'
  and is_active = true;

update public.legal_documents
set
  is_active = true,
  updated_at = now()
where document_type = 'vendor_end_user_terms'
  and version = '2026-07-15.3'
  and is_active = false;

notify pgrst, 'reload schema';
