-- Finalize Vendor Terms for production wording.
-- Source of truth for public marketing pages: marketing/lib/marketing/legal.ts
-- Effective date unchanged: 2026-07-15. New version row preserves prior acceptances.
-- Does not rewrite historical migrations or mutate legal_acceptances rows.

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
    '2026-07-15.4',
    '2026-07-15',
    $vt$
# Vendor Terms

Effective date: July 15, 2026

## 1. Welcome

Hello to Cheers (“HTC,” “we,” “us,” or “our”) is operated by QuickCloud LLC, a Massachusetts limited liability company. HTC is event-management software that helps venues, clients, and vendors coordinate celebrations.

You are accessing Hello to Cheers as a vendor participant—typically because a participating venue has invited you, created or linked a vendor profile for your business, or otherwise established a relationship with you in the platform. You may claim a profile, manage information about your business, and (where supported) participate across more than one venue.

By claiming a vendor profile, accepting an invitation, creating a vendor account, or otherwise using the vendor features of Hello to Cheers, you agree to these Vendor Terms, along with our Privacy Policy, Cookie Policy, and Acceptable Use Policy. Claiming a vendor profile is free.

If you do not agree, please do not claim a profile or use the vendor features.

## 2. Our Role

Hello to Cheers provides software tools for coordination and communication. We are not a venue, vendor, employer, agent, event coordinator, or event-services provider.

We are not a party to contracts for event services between venues, clients, and vendors. Those agreements are between the people and businesses who make them.

Vendor contracts and payments are handled independently between you and the applicable venue or client. Hello to Cheers does not create, manage, execute, process, or track vendor contracts or vendor payments, and does not process vendor fees, deposits, refunds, or payouts.

## 3. Your Relationships

You decide the services you offer, your pricing, your availability, and the commitments you make to venues and clients. You are responsible for your own contracts, insurance, licenses, taxes, cancellations, refunds, disputes, and delivery of services, subject to applicable law.

Venues and clients remain responsible for their own agreements and decisions. Selecting you for an event, marking a preference level (such as Preferred or Recommended), or featuring your profile in a venue’s network reflects that venue’s choices—not an endorsement, certification, or guarantee by Hello to Cheers.

We do not guarantee your availability, performance, qualifications, insurance, pricing, or fulfillment. We do not guarantee that venues or clients will hire you, respond to you, or complete any transaction.

Fee amounts or payment-status notes that a venue may enter for coordination on an event assignment are for visibility and planning within the software. They are not invoices, payment processing, or confirmation that money moved through Hello to Cheers. Hello to Cheers may display that coordination information but does not conduct vendor financial transactions.

## 4. Your Information and Account

Profiles and relationships. Vendor information in Hello to Cheers may include a global business profile (such as name, categories, contact details, bio, and media) and separate relationship details with each participating venue (such as preference level, notes, and venue-specific settings).

You are responsible for the accuracy of information you provide or control. Venues may create or maintain relationship records that involve your business; some fields may be controlled by the venue.

Claiming and access. When you claim a profile and create credentials, you are responsible for keeping your login secure and for activity under your account. Notify us promptly if you believe your account has been compromised.

Visibility and sharing. Information you share, and information venues share about you, may be visible to venue staff and, where the product allows, to clients or other participants connected to relevant events. Availability, packages or service listings, inquiries, messages, tasks, schedules, and documents related to an assignment may be shared as needed for coordination.

Packages or listed prices in the platform are informational catalogs for discovery and planning. They are not contracts and do not process charges.

After a relationship ends. If a venue relationship ends, some historical event or relationship information may remain accessible to the venue or other authorized users as needed for their records and ongoing operations, consistent with our Privacy Policy and the venue’s account settings. We do not promise automatic deletion of every reference to your business on a fixed calendar day.

If you need a correction or have a concern about information associated with your profile, contact the relevant venue and/or us using the contact details below. We will review requests consistent with our Privacy Policy and applicable law.

## 5. Appropriate Use

Please use Hello to Cheers honestly and respectfully.

You agree that you will:

- Provide accurate business and contact information.
- Access only event and client information you are authorized to see.
- Keep private event, client, and venue information confidential and use it only for coordinating the services you are engaged to provide.
- Not spam, harass, or send unauthorized marketing through the platform.
- Not impersonate another person or business, or misrepresent your services, credentials, or relationship to a venue or client.
- Not upload content you do not have the right to use, or use the platform to infringe others’ intellectual-property or privacy rights.
- Not attempt to disrupt, reverse engineer, or misuse the service.

We may suspend or terminate access if we reasonably believe these terms or our Acceptable Use Policy have been violated, or if needed to protect venues, clients, other vendors, or the platform.

## 6. Privacy

How we collect, use, and share information—including vendor profile and contact details, event and client information shared with you for coordination, venue-controlled customer data, optional AI-assisted features where your information may appear, and communications such as email or portal notifications—is described in our Privacy Policy. Please read it.

You may receive service-related messages about invitations, assignments, inquiries, and account activity. Marketing preferences, where offered, are handled as described in the Privacy Policy.

## 7. Availability and Our Promise

We work to keep Hello to Cheers reliable and useful, and we care about the people who use it. Our approach is described on our Our Promise page.

We do not promise uninterrupted access, specific response times, or financial credits for downtime. Features may change as we improve the product. Scheduled maintenance or unexpected issues may temporarily affect availability.

## 8. Changes

We may update these Vendor Terms from time to time. When we do, we will post the revised terms with an updated effective date. Continued use of the vendor features after changes take effect means you accept the updated terms. If you do not agree, stop using the vendor features and contact us if you need help with your account.

## 9. Contact

Questions about these Vendor Terms:

legal@hellotocheers.com

For privacy-related requests, see our Privacy Policy or contact privacy@hellotocheers.com.
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
  and version is distinct from '2026-07-15.4'
  and is_active = true;

update public.legal_documents
set
  is_active = true,
  updated_at = now()
where document_type = 'vendor_end_user_terms'
  and version = '2026-07-15.4'
  and is_active = false;

notify pgrst, 'reload schema';
