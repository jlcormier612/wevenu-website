-- LEGAL-FINAL: Privacy Policy publication (2026-11-21.1).
-- Source of truth for marketing pages: marketing/lib/marketing/legal.ts
-- Adds OpenAI/Luv provider-handling paragraph and corrects promotional-email choices language.
-- Effective date = publication date (November 21, 2026).
-- Preserves prior privacy_policy rows (historical); does not mutate legal_acceptances.
-- Does not change Venue Subscription Agreement, Vendor Terms, Cookie Policy, or other types.

update public.legal_documents
set
  is_active = false,
  updated_at = now()
where document_type = 'privacy_policy'
  and is_active = true;

insert into public.legal_documents (
  document_type,
  title,
  version,
  effective_date,
  content,
  is_published,
  is_active,
  published_at
) values (
  'privacy_policy',
  'Privacy Policy',
  '2026-11-21.1',
  '2026-11-21',
  $privacy_20261121$

# Privacy Policy

Effective date: November 21, 2026

This Privacy Policy explains how Hello to Cheers collects, uses, shares, and protects information when you use our websites, products, and related services. Please review it carefully. We will update this page when our practices change.

## 1. Who We Are

Hello to Cheers provides software and related services for independent venues and hospitality businesses (the “Services”). In this Privacy Policy, “Hello to Cheers,” “we,” “us,” and “our” refer to Hello to Cheers, operated by QuickCloud LLC, a Massachusetts limited liability company.

If you have privacy questions, contact us at privacy@hellotocheers.com (or the support address listed on our website).

## 2. Scope

This Privacy Policy applies to our marketing website, product applications, customer accounts, support communications, and related online experiences.

Hello to Cheers is used by venue owners, venue staff, couples, clients, guests, vendors, and other invited collaborators.

Depending on your role, Hello to Cheers may act either as the direct provider of services to you or as a service provider processing information on behalf of a participating venue.

Where Hello to Cheers processes information on behalf of a venue, the venue’s instructions and privacy practices also apply.

## 3. Information We Collect

Depending on how you interact with Hello to Cheers, we may collect:

- Account and profile information (name, email, phone, role, venue details).
- Business and operational data you enter into Hello to Cheers (events, clients, vendors, planning details, guest lists, messages, documents, and financial or payment records related to venue operations).
- Communication-related information where applicable (phone numbers, email addresses, communication preferences, text-messaging permission and opt-out status, consent timestamps and source or method, message history, delivery or status information, and related communication metadata).
- Billing and payment-related information associated with (a) Hello to Cheers subscription billing and (b), when a venue enables Stripe-connected payment workflows in the software, payment and invoice records the venue maintains about amounts its clients pay the venue (processed by Stripe on the venue’s connected account).
- Communications you send us (support requests, walkthrough requests, feedback).
- Usage and device information (IP address, browser type, approximate location derived from IP, pages viewed, feature usage, diagnostic logs).
- Cookies and similar technologies as described in our Cookie Policy (see also Cookie Preferences at /cookies).

## 4. How We Use Information

We use information to:

- Provide, operate, maintain, and improve the Services.
- Authenticate users, manage accounts, and enforce permissions.
- Process Hello to Cheers subscription billing and related notices, and provide software features that help venues organize invoices, payment schedules, and Stripe payment-workflow information.
- Provide optional assistive features (including Luv) that generate suggestions or answers for users to review.
- Provide customer support and respond to requests.
- Communicate product updates, security notices, and service messages.
- Detect, prevent, and investigate fraud, abuse, and security incidents.
- Comply with law and enforce our terms.
- Analyze aggregated or de-identified trends to improve hospitality workflows—not to sell personal profiles.

## 5. What We Do Not Do

We do not sell your personal information.

We do not rent customer databases to third parties for their independent marketing.

We do not use venue customer operational data to build advertising profiles for unrelated products.

## 6. Sharing Information

We share information only as needed to run Hello to Cheers responsibly:

- Service providers who help us host, secure, support, analyze, or operate the Services (under contractual obligations to protect data).
- Payment processors such as Stripe for (a) Hello to Cheers subscription billing and (b), when a venue connects its Stripe account, processing of venue-client event payments by Stripe on that venue’s connected account. Hello to Cheers does not process those event payments. Stripe’s use of payment information is also described in Stripe’s privacy notices.
- Artificial-intelligence providers (currently OpenAI) when a venue or invited user uses optional assistive features, as described in Section 7A.
- Messaging and communications service providers that help us provide, deliver, monitor, or support email, text messaging, and related communications on behalf of Hello to Cheers and its customers.
- Integrations a venue chooses to connect (for example accounting or advertising lead-intake tools), in which case information is shared as needed to operate that integration.
- Professional advisors (legal, accounting) when reasonably necessary.
- Authorities when required by law or to protect rights, safety, and security.
- A successor entity in connection with a merger, acquisition, or asset transfer, subject to appropriate protections.

## 7. Customer Content and Venue Relationships

Venues control much of the content they store in Hello to Cheers. Clients, guests, and vendors interacting through a venue’s workspace are generally engaging with that venue’s configuration of the Services.

Hello to Cheers may process that content to deliver the product features the venue enables (portals, messaging, planning, payments records, and related tools).

When a venue uses Hello to Cheers to communicate with its leads, clients, guests, or other recipients, Hello to Cheers may process communication-related information on behalf of that venue as described in this Privacy Policy. The venue remains responsible for the communications it sends or initiates and for obtaining and maintaining any permission required to contact those recipients.

Clients, guests, vendors, and venue staff may need to contact the venue for many requests about Customer Data the venue controls. Hello to Cheers will assist with privacy requests as required by law and our agreements.

## 7A. Assistive AI (Luv and related features)

Optional Hello to Cheers features—including Luv drafting, Ask Luv, guest concierge answers, weekly roll-ups, and import or extraction assistance—may send limited information to a third-party artificial-intelligence provider (currently OpenAI) so the feature can generate a suggestion or answer.

Depending on the feature, that information can include venue names, staff names, client or couple names, event details, message or document content the venue already stores, published wedding-website or venue-guide content, analytics summaries (which may include engagement or payment-status indicators), and text a staff member pastes for import. These transmissions can include personal information.

These features are typically initiated by a user action (for example, generating a draft, asking a question, running an import assist, or generating a roll-up). Some features may also run when a venue enables them or requests them through product workflows. Some outputs (such as drafts or roll-ups) may be saved in the venue’s Hello to Cheers workspace for review. Luv drafting can be disabled in venue settings where provided. Features that require an AI provider are unavailable when that provider is not configured.

## How our AI provider handles information

Hello to Cheers uses OpenAI's API to support certain Luv features. Information submitted to these features may be processed by OpenAI to generate responses. Under OpenAI's published API data policies, information submitted through the API is not used to train OpenAI's models by default unless the API customer opts in. OpenAI may retain certain information for abuse monitoring and security purposes, subject to its applicable policies and data controls. Hello to Cheers does not use information submitted to Luv for advertising.

## 8. Data Retention

We retain information for as long as needed to provide the Services, comply with legal obligations, resolve disputes, and enforce agreements.

When a venue’s subscription ends—meaning the effective end of paid access to the Services, not merely the date cancellation is scheduled—Hello to Cheers ordinarily retains the venue’s account data for a 90-day recovery period. During that period, recovery or export may be available through supported product mechanisms, subject to account status and applicable restrictions. Clients may export certain planning information from their portal where available.

After that 90-day recovery period, you should not expect account data to remain accessible, recoverable, or available for export. Hello to Cheers may delete or de-identify data after the recovery period in accordance with its retention practices. This Policy does not promise that every record is automatically deleted on day 90.

Some records may be retained longer for legitimate legal, financial, security, operational, backup, or third-party processing purposes—including billing and payment records, security logs, and information held by payment or communications providers.

## 9. Security

We implement administrative, technical, and organizational safeguards designed to protect personal information—including access controls, encrypted connections in transit, and careful permissioning within venue workspaces. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.

If we become aware of a breach affecting your personal information, we will notify affected customers and regulators as required by applicable law.

## 10. Your Choices and Rights

Depending on your location, you may have rights to access, correct, delete, export, or restrict certain personal information, or to object to certain processing.

You may manage your cookie preferences at /cookies where available. If Hello to Cheers sends you promotional emails, those messages will provide a way to opt out of future promotional communications from us. Service, billing, security, and other transactional or relationship messages may still be sent as necessary to operate your account or respond to your requests.

To exercise privacy rights, contact privacy@hellotocheers.com. We may need to verify your request before responding.

## 11. Text Messaging and Communication Information

When a venue uses Hello to Cheers to communicate with you by text message, your phone number and related messaging information may be processed by Hello to Cheers and our messaging service providers to deliver those messages.

Hello to Cheers may maintain communication preference and consent records, including whether text messaging permission has been recorded, when that permission was recorded, how it was obtained, and whether it was subsequently withdrawn.

Text messaging is only enabled through Hello to Cheers where the required recipient permission has been recorded. Recording permission in Hello to Cheers means Hello to Cheers has a product record used to enforce its own text-messaging requirements; it does not mean Hello to Cheers has determined that a venue was legally entitled to obtain that permission or that a particular message is lawful.

Communication information may be processed by service providers that help us provide, deliver, monitor, or support communications on behalf of Hello to Cheers and its customers.

Venues that use Hello to Cheers may communicate with leads and clients by text message about their inquiry, tour or appointment, event planning, and related booking logistics.

How we collect mobile numbers: A mobile number may be collected when you submit a venue’s Hello to Cheers inquiry or tour-booking form, or when you otherwise provide it to the venue in connection with your event.

Phone number is not SMS consent: Entering or providing a mobile number is not, by itself, permission to send SMS.

Communication preference is not SMS consent: Selecting “Text message” as a preferred way to be contacted is a preference only and is not SMS permission.

Explicit SMS permission: When the venue enables the text-message permission request on its form, you may separately check an optional box (unchecked by default) authorizing texts. Checking that box is voluntary. You can submit an inquiry or book a tour without agreeing to text messages. SMS consent is not required to use Hello to Cheers or to complete the underlying inquiry or tour transaction. The permission language presented on that form is the consent language we record when you opt in.

Message frequency: Message frequency varies with your inquiry, tour, and event planning. You may receive occasional texts when the venue team needs to reach you about your visit or celebration; you will not receive a fixed daily message volume.

Message and data rates may apply.

Opt out / opt in: Reply STOP to opt out of further texts from that venue messaging program. Reply START to opt back in. Ordinary inbound replies, other than STOP/START and related carrier keywords, are not treated as ongoing SMS permission.

No sale/share of SMS consent for marketing: We do not sell, rent, or share mobile numbers or SMS consent/opt-in information with third parties or affiliates for their marketing or promotional purposes. Mobile numbers and related messaging records are used to operate venue relationship communications through Hello to Cheers and as otherwise described in this Privacy Policy, including service providers that process messages on our behalf.

## 12. International Transfers

Hello to Cheers is operated from the United States. If you access the Services from another country, your information may be processed in the United States and in other locations where our service providers process data. Where applicable law requires a specific transfer mechanism, we will use an appropriate mechanism available under that law.

## 13. Children’s Privacy

Hello to Cheers is built for business use by venues and related professionals. The Services are not directed to children, and we do not knowingly collect personal information from children for Hello to Cheers’ own marketing.

Venues and their clients may include information about children in event-planning records—for example, guest-list entries that note a child guest, age, seating or high-chair needs, meal notes, or similar details. That information is Customer Data controlled by the venue (and entered by venue staff or by clients through tools the venue enables). Hello to Cheers processes it to provide the Services.

Parents or guardians with questions about guest-list or event information should contact the venue. If you believe a child has provided personal information to Hello to Cheers outside a venue’s event records, contact privacy@hellotocheers.com and we will take appropriate steps.

## 14. Changes to This Policy

We may update this Privacy Policy from time to time. We will post the updated version with a revised effective date and, when changes are material, provide additional notice as appropriate.

## 15. Contact

For privacy questions or requests: privacy@hellotocheers.com

For general support: the contact methods listed on hellotocheers.com

$privacy_20261121$,
  true,
  true,
  now()
);
