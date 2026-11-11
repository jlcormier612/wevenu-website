/**
 * Hello to Cheers marketing legal documents.
 */

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Rendered after bullets when counsel prose continues past a list. */
  afterBullets?: string[];
};

export type LegalDocument = {
  title: string;
  slug: string;
  effectiveDate: string;
  notice: string;
  sections: LegalSection[];
};

export const PRIVACY_POLICY: LegalDocument = {
  title: "Privacy Policy",
  slug: "privacy",
  effectiveDate: "September 23, 2026",
  notice:
    "This Privacy Policy explains how Hello to Cheers collects, uses, shares, and protects information when you use our websites, products, and related services. Please review it carefully. We will update this page when our practices change.",
  sections: [
    {
      heading: "1. Who We Are",
      paragraphs: [
        "Hello to Cheers provides software and related services for independent venues and hospitality businesses (the “Services”). In this Privacy Policy, “Hello to Cheers,” “we,” “us,” and “our” refer to Hello to Cheers, operated by QuickCloud LLC, a Massachusetts limited liability company.",
        "If you have privacy questions, contact us at privacy@hellotocheers.com (or the support address listed on our website).",
      ],
    },
    {
      heading: "2. Scope",
      paragraphs: [
        "This Privacy Policy applies to our marketing website, product applications, customer accounts, support communications, and related online experiences.",
        "Hello to Cheers is used by venue owners, venue staff, couples, clients, guests, vendors, and other invited collaborators.",
        "Depending on your role, Hello to Cheers may act either as the direct provider of services to you or as a service provider processing information on behalf of a participating venue.",
        "Where Hello to Cheers processes information on behalf of a venue, the venue’s instructions and privacy practices also apply.",
      ],
    },
    {
      heading: "3. Information We Collect",
      paragraphs: ["Depending on how you interact with Hello to Cheers, we may collect:"],
      bullets: [
        "Account and profile information (name, email, phone, role, venue details).",
        "Business and operational data you enter into Hello to Cheers (events, clients, vendors, planning details, guest lists, messages, documents, and financial or payment records related to venue operations).",
        "Communication-related information where applicable (phone numbers, email addresses, communication preferences, text-messaging permission and opt-out status, consent timestamps and source or method, message history, delivery or status information, and related communication metadata).",
        "Billing and payment-related information associated with (a) Hello to Cheers subscription billing and (b), when a venue enables Stripe-connected payment workflows in the software, payment and invoice records the venue maintains about amounts its clients pay the venue (processed by Stripe on the venue’s connected account).",
        "Communications you send us (support requests, walkthrough requests, feedback).",
        "Usage and device information (IP address, browser type, approximate location derived from IP, pages viewed, feature usage, diagnostic logs).",
        "Cookies and similar technologies as described in our Cookie Policy (see also Cookie Preferences at /cookies).",
      ],
    },
    {
      heading: "4. How We Use Information",
      paragraphs: ["We use information to:"],
      bullets: [
        "Provide, operate, maintain, and improve the Services.",
        "Authenticate users, manage accounts, and enforce permissions.",
        "Process Hello to Cheers subscription billing and related notices, and provide software features that help venues organize invoices, payment schedules, and Stripe payment-workflow information.",
        "Provide optional assistive features (including Luv) that generate suggestions or answers for users to review.",
        "Provide customer support and respond to requests.",
        "Communicate product updates, security notices, and service messages.",
        "Detect, prevent, and investigate fraud, abuse, and security incidents.",
        "Comply with law and enforce our terms.",
        "Analyze aggregated or de-identified trends to improve hospitality workflows—not to sell personal profiles.",
      ],
    },
    {
      heading: "5. What We Do Not Do",
      paragraphs: [
        "We do not sell your personal information.",
        "We do not rent customer databases to third parties for their independent marketing.",
        "We do not use venue customer operational data to build advertising profiles for unrelated products.",
      ],
    },
    {
      heading: "6. Sharing Information",
      paragraphs: [
        "We share information only as needed to run Hello to Cheers responsibly:",
      ],
      bullets: [
        "Service providers who help us host, secure, support, analyze, or operate the Services (under contractual obligations to protect data).",
        "Payment processors such as Stripe for (a) Hello to Cheers subscription billing and (b), when a venue connects its Stripe account, processing of venue-client event payments by Stripe on that venue’s connected account. Hello to Cheers does not process those event payments. Stripe’s use of payment information is also described in Stripe’s privacy notices.",
        "Artificial-intelligence providers (currently OpenAI) when a venue or invited user uses optional assistive features, as described in Section 7A.",
        "Messaging and communications service providers that help us provide, deliver, monitor, or support email, text messaging, and related communications on behalf of Hello to Cheers and its customers.",
        "Integrations a venue chooses to connect (for example accounting or advertising lead-intake tools), in which case information is shared as needed to operate that integration.",
        "Professional advisors (legal, accounting) when reasonably necessary.",
        "Authorities when required by law or to protect rights, safety, and security.",
        "A successor entity in connection with a merger, acquisition, or asset transfer, subject to appropriate protections.",
      ],
    },
    {
      heading: "7. Customer Content and Venue Relationships",
      paragraphs: [
        "Venues control much of the content they store in Hello to Cheers. Clients, guests, and vendors interacting through a venue’s workspace are generally engaging with that venue’s configuration of the Services.",
        "Hello to Cheers may process that content to deliver the product features the venue enables (portals, messaging, planning, payments records, and related tools).",
        "When a venue uses Hello to Cheers to communicate with its leads, clients, guests, or other recipients, Hello to Cheers may process communication-related information on behalf of that venue as described in this Privacy Policy. The venue remains responsible for the communications it sends or initiates and for obtaining and maintaining any permission required to contact those recipients.",
        "Clients, guests, vendors, and venue staff may need to contact the venue for many requests about Customer Data the venue controls. Hello to Cheers will assist with privacy requests as required by law and our agreements.",
      ],
    },
    {
      heading: "7A. Assistive AI (Luv and related features)",
      paragraphs: [
        "Optional Hello to Cheers features—including Luv drafting, Ask Luv, guest concierge answers, weekly roll-ups, and import or extraction assistance—may send limited information to a third-party artificial-intelligence provider (currently OpenAI) so the feature can generate a suggestion or answer.",
        "Depending on the feature, that information can include venue names, staff names, client or couple names, event details, message or document content the venue already stores, published wedding-website or venue-guide content, analytics summaries (which may include engagement or payment-status indicators), and text a staff member pastes for import. These transmissions can include personal information.",
        "These features are typically initiated by a user action (for example, generating a draft, asking a question, running an import assist, or generating a roll-up). Some features may also run when a venue enables them or requests them through product workflows. Some outputs (such as drafts or roll-ups) may be saved in the venue’s Hello to Cheers workspace for review. Luv drafting can be disabled in venue settings where provided. Features that require an AI provider are unavailable when that provider is not configured.",
      ],
    },
    {
      heading: "8. Data Retention",
      paragraphs: [
        "We retain information for as long as needed to provide the Services, comply with legal obligations, resolve disputes, and enforce agreements.",
        "When a venue’s subscription ends—meaning the effective end of paid access to the Services, not merely the date cancellation is scheduled—Hello to Cheers ordinarily retains the venue’s account data for a 90-day recovery period. During that period, recovery or export may be available through supported product mechanisms, subject to account status and applicable restrictions. Clients may export certain planning information from their portal where available.",
        "After that 90-day recovery period, you should not expect account data to remain accessible, recoverable, or available for export. Hello to Cheers may delete or de-identify data after the recovery period in accordance with its retention practices. This Policy does not promise that every record is automatically deleted on day 90.",
        "Some records may be retained longer for legitimate legal, financial, security, operational, backup, or third-party processing purposes—including billing and payment records, security logs, and information held by payment or communications providers.",
      ],
    },
    {
      heading: "9. Security",
      paragraphs: [
        "We implement administrative, technical, and organizational safeguards designed to protect personal information—including access controls, encrypted connections in transit, and careful permissioning within venue workspaces. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.",
        "If we become aware of a breach affecting your personal information, we will notify affected customers and regulators as required by applicable law.",
      ],
    },
    {
      heading: "10. Your Choices and Rights",
      paragraphs: [
        "Depending on your location, you may have rights to access, correct, delete, export, or restrict certain personal information, or to object to certain processing.",
        "You may manage cookie preferences at /cookies where available, and unsubscribe from promotional emails using the link in those messages. Service and billing messages may still be sent as needed to operate your account.",
        "To exercise privacy rights, contact privacy@hellotocheers.com. We may need to verify your request before responding.",
      ],
    },
    {
      heading: "11. Text Messaging and Communication Information",
      paragraphs: [
        "When a venue uses Hello to Cheers to communicate with you by text message, your phone number and related messaging information may be processed by Hello to Cheers and our messaging service providers to deliver those messages.",
        "Hello to Cheers may maintain communication preference and consent records, including whether text messaging permission has been recorded, when that permission was recorded, how it was obtained, and whether it was subsequently withdrawn.",
        "Text messaging is only enabled through Hello to Cheers where the required recipient permission has been recorded. Recording permission in Hello to Cheers means Hello to Cheers has a product record used to enforce its own text-messaging requirements; it does not mean Hello to Cheers has determined that a venue was legally entitled to obtain that permission or that a particular message is lawful.",
        "Communication information may be processed by service providers that help us provide, deliver, monitor, or support communications on behalf of Hello to Cheers and its customers.",
        "Venues that use Hello to Cheers may communicate with leads and clients by text message about their inquiry, tour or appointment, event planning, and related booking logistics.",
        "How we collect mobile numbers: A mobile number may be collected when you submit a venue’s Hello to Cheers inquiry or tour-booking form, or when you otherwise provide it to the venue in connection with your event.",
        "Phone number is not SMS consent: Entering or providing a mobile number is not, by itself, permission to send SMS.",
        "Communication preference is not SMS consent: Selecting “Text message” as a preferred way to be contacted is a preference only and is not SMS permission.",
        "Explicit SMS permission: When the venue enables the text-message permission request on its form, you may separately check an optional box (unchecked by default) authorizing texts. Checking that box is voluntary. You can submit an inquiry or book a tour without agreeing to text messages. SMS consent is not required to use Hello to Cheers or to complete the underlying inquiry or tour transaction. The permission language presented on that form is the consent language we record when you opt in.",
        "Message frequency: Message frequency varies with your inquiry, tour, and event planning. You may receive occasional texts when the venue team needs to reach you about your visit or celebration; you will not receive a fixed daily message volume.",
        "Message and data rates may apply.",
        "Opt out / opt in: Reply STOP to opt out of further texts from that venue messaging program. Reply START to opt back in. Ordinary inbound replies, other than STOP/START and related carrier keywords, are not treated as ongoing SMS permission.",
        "No sale/share of SMS consent for marketing: We do not sell, rent, or share mobile numbers or SMS consent/opt-in information with third parties or affiliates for their marketing or promotional purposes. Mobile numbers and related messaging records are used to operate venue relationship communications through Hello to Cheers and as otherwise described in this Privacy Policy, including service providers that process messages on our behalf.",
      ],
    },
    {
      heading: "12. International Transfers",
      paragraphs: [
        "Hello to Cheers is operated from the United States. If you access the Services from another country, your information may be processed in the United States and in other locations where our service providers process data. Where applicable law requires a specific transfer mechanism, we will use an appropriate mechanism available under that law.",
      ],
    },
    {
      heading: "13. Children’s Privacy",
      paragraphs: [
        "Hello to Cheers is built for business use by venues and related professionals. The Services are not directed to children, and we do not knowingly collect personal information from children for Hello to Cheers’ own marketing.",
        "Venues and their clients may include information about children in event-planning records—for example, guest-list entries that note a child guest, age, seating or high-chair needs, meal notes, or similar details. That information is Customer Data controlled by the venue (and entered by venue staff or by clients through tools the venue enables). Hello to Cheers processes it to provide the Services.",
        "Parents or guardians with questions about guest-list or event information should contact the venue. If you believe a child has provided personal information to Hello to Cheers outside a venue’s event records, contact privacy@hellotocheers.com and we will take appropriate steps.",
      ],
    },
    {
      heading: "14. Changes to This Policy",
      paragraphs: [
        "We may update this Privacy Policy from time to time. We will post the updated version with a revised effective date and, when changes are material, provide additional notice as appropriate.",
      ],
    },
    {
      heading: "15. Contact",
      paragraphs: [
        "For privacy questions or requests: privacy@hellotocheers.com",
        "For general support: the contact methods listed on hellotocheers.com",
      ],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDocument = {
  title: "Venue Subscription Agreement",
  slug: "terms",
  effectiveDate: "September 23, 2026",
  notice:
    "These Terms of Service (the “Terms” or this “Venue Subscription Agreement”) govern your access to and use of Hello to Cheers. By creating an account, completing checkout, or using the Services, you agree to these Terms. If you are accepting on behalf of a venue or organization, you represent that you have authority to bind that entity.",
  sections: [
    {
      heading: "1. Overview",
      paragraphs: [
        "Hello to Cheers provides cloud software and related services to help venues manage sales, planning, operations, communication, financial workflows, and guest experiences (the “Services”).",
        "In these Terms, “Hello to Cheers,” “we,” “us,” and “our” refer to Hello to Cheers, operated by QuickCloud LLC, a Massachusetts limited liability company.",
        "These Terms form a binding agreement between the subscribing venue or organization (“you,” “Venue,” or “Customer”) and Hello to Cheers. Additional product-specific terms, order forms, or policies (including our Privacy Policy, Cookie Policy, and Acceptable Use Policy) are incorporated by reference.",
        "Hello to Cheers is a three-sided platform used by venues, their clients and guests, and invited vendors. These Terms apply to the Venue’s subscription and workspace. Couples, clients, guests, and other invited participants are also subject to our End User Terms. Invited vendors are also subject to our Vendor Terms. Venue staff and collaborators use the Services under the Venue’s account and authority.",
      ],
    },
    {
      heading: "2. Accounts and Eligibility",
      paragraphs: [
        "You must provide accurate account information and keep it updated. You are responsible for safeguarding credentials and for activity under your account, including activity by staff and collaborators you invite.",
        "You must be able to form a binding contract and use the Services only for lawful business purposes related to venue or hospitality operations.",
      ],
    },
    {
      heading: "3. Subscriptions and Billing",
      paragraphs: [
        "Paid plans are offered on a month-to-month basis unless otherwise stated in writing. Fees are charged in advance for each billing period through our payment processor (currently Stripe).",
        "Plan eligibility and pricing are described on our Pricing page (or another offer we present in writing), including event-volume tiers (currently Gather, Celebrate, and Flourish), founding or promotional percentage discounts when available, and optional one-time setup fees such as White Glove Setup when you purchase them. All current subscription plans include the core feature set; tiers differ by qualifying event volume as described on Pricing.",
        "Except where required by applicable law, subscription fees are generally non-refundable once a billing period begins. Unused days in a paid period are not refunded if you cancel mid-period.",
        "We may change prices with notice before the change takes effect for subsequent billing periods. Continued use after the effective date constitutes acceptance of the updated pricing for those later periods.",
        "You authorize us and our payment processor to charge the payment method on file for recurring fees, applicable taxes, and any optional one-time fees you select at checkout or in-product.",
        "If a payment fails, we (and our payment processor) may retry charges. Access may continue for a limited grace period and then be suspended if fees remain unpaid, as described in our product entitlement practices and Stripe’s payment retry behavior.",
      ],
    },
    {
      heading: "4. Cancellation",
      paragraphs: [
        "You may cancel your subscription at any time through account billing settings (Stripe Customer Billing Portal) or another method we provide.",
        "Cancellation stops future renewals. You generally retain access through the end of the then-current paid period unless otherwise stated.",
        "We do not charge cancellation fees for standard monthly subscriptions. Canceling does not, by itself, entitle you to a refund of fees already paid for the current period, except where required by law.",
      ],
    },
    {
      heading: "5. Venue-Client Contracts and Event Payments",
      paragraphs: [
        "Hello to Cheers provides software that helps Venues create and manage contracts, invoices, payment schedules, and related records, and that can open Stripe payment flows for amounts clients owe the Venue.",
        "Contracts for venue or event services are between you (the Venue) and your client. Hello to Cheers is not a party to those contracts and is not the provider of your event or hospitality services.",
        "When a client pays an amount related to your event through a payment flow opened from Hello to Cheers, Stripe processes that payment on your connected Stripe account. Hello to Cheers does not process event payments, does not collect event funds, and is not the merchant of record for those venue-client transactions. Stripe’s terms and privacy notices also apply.",
        "You remain responsible for your prices, contracts, cancellations, refunds, taxes, chargebacks, and service delivery to your clients. Disputes, refunds, and chargebacks relating to amounts your clients pay you are between you, your client, and Stripe, as applicable. Hello to Cheers may provide software access to related records without becoming a party to the underlying transaction.",
        "Subscription fees you pay Hello to Cheers for the Services are a separate relationship and are processed by Stripe for Hello to Cheers subscription billing.",
      ],
    },
    {
      heading: "6. Your Data and Ownership",
      paragraphs: [
        "You retain ownership of the content and data you and your authorized users submit to the Services (“Customer Data”), including operational records about your clients, guests, vendors, and events.",
        "You grant Hello to Cheers a limited license to host, process, transmit, display, and otherwise use Customer Data solely to provide, maintain, secure, and support the Services (including optional assistive features that may use third-party artificial-intelligence providers as described in our Privacy Policy) and as otherwise permitted in these Terms and our Privacy Policy.",
        "You are responsible for the accuracy of Customer Data and for obtaining any consents needed to collect and process information about your clients, guests, vendors, and staff through Hello to Cheers.",
        "Clients, guests, and vendors may also submit information through portals or tools you enable. That information is processed to provide the Services and, where it is your Customer Data, remains subject to your instructions and responsibilities as described in these Terms and the Privacy Policy.",
      ],
    },
    {
      heading: "7. Data Export and Departure",
      paragraphs: [
        "You may export Customer Data through in-product export tools before cancellation. A recovery export path may remain available for a limited period after access ends, where provided in the product.",
        "When a venue’s subscription ends—meaning the effective end of paid access to the Services, not merely the date cancellation is scheduled—Hello to Cheers ordinarily retains the venue’s account data for a 90-day recovery period. During that period, recovery or export may be available through supported product mechanisms, subject to account status and applicable restrictions.",
        "After that 90-day recovery period, you should not expect account data to remain accessible, recoverable, or available for export. Hello to Cheers may delete or de-identify data after the recovery period in accordance with its retention practices. These Terms do not promise that every record is automatically deleted on day 90.",
        "Some records may be retained longer for legitimate legal, financial, security, operational, backup, or third-party processing purposes—including billing records and information held by payment or communications providers.",
      ],
    },
    {
      heading: "8. Acceptable Use",
      paragraphs: [
        "You agree not to misuse the Services. Prohibited conduct includes unauthorized access, interference with system integrity, unlawful content, harassment, spam, infringement of others’ rights, or attempts to reverse engineer the Services except where prohibited by law from restricting that activity.",
        "Additional details appear in our Acceptable Use Policy.",
      ],
    },
    {
      heading: "9. Customer Communications and Messaging",
      paragraphs: [
        "Customers are responsible for the communications they send or initiate through the Service, including ensuring that they have any permissions, consents, authorizations, and other legal bases required to contact their recipients.",
        "Hello to Cheers provides communication tools and does not determine whether a customer's particular communication is lawful or whether a recipient has provided legally sufficient consent.",
        "Customers are solely responsible for the content, timing, recipients, frequency, and legal compliance of communications sent through the Service and for obtaining and maintaining any consent required for those communications.",
        "If you use text messaging features, you are responsible for obtaining and maintaining all consent required to send text messages to your recipients. You must not use the Service to send text messages to recipients who have not provided the required permission.",
        "Hello to Cheers will not send text messages through the Service where the required SMS permission has not been recorded. A permission record in Hello to Cheers is a product control for Hello to Cheers’ own messaging requirements; it is not a determination by Hello to Cheers that you were legally entitled to obtain that permission or that any particular message complies with applicable law.",
        "You are responsible for maintaining appropriate records of consent and complying with applicable telecommunications, messaging, privacy, marketing, and consumer-protection laws and regulations.",
        "Hello to Cheers may require evidence of consent, restrict messaging, suspend messaging functionality, or take other action where required by our messaging providers, carriers, applicable law, or our agreements with messaging providers.",
      ],
    },
    {
      heading: "10. Third-Party Services",
      paragraphs: [
        "The Services may integrate with third parties (including Stripe, communications providers, and artificial-intelligence providers used for optional assistive features). Your use of those services may be subject to their terms. Hello to Cheers is not responsible for third-party services we do not control.",
      ],
    },
    {
      heading: "11. Intellectual Property",
      paragraphs: [
        "Hello to Cheers and its licensors own the Services, software, branding, and related intellectual property. Except for the limited rights expressly granted, no rights are transferred to you.",
        "Feedback you provide may be used by Hello to Cheers to improve the Services without obligation to you.",
      ],
    },
    {
      heading: "12. Confidentiality",
      paragraphs: [
        "Each party may receive confidential information from the other. The receiving party will protect that information with reasonable care and use it only as needed to perform under these Terms, except where disclosure is required by law.",
      ],
    },
    {
      heading: "13. Disclaimers",
      paragraphs: [
        "The Services are provided “as is” and “as available.” To the maximum extent permitted by law, Hello to Cheers disclaims all warranties, whether express, implied, or statutory, including merchantability, fitness for a particular purpose, and non-infringement.",
        "We do not warrant that the Services will be uninterrupted, error-free, or free of harmful components, or that all content will be secure or not lost.",
      ],
    },
    {
      heading: "14. Limitation of Liability",
      paragraphs: [
        "To the maximum extent permitted by law, Hello to Cheers will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or any loss of profits, revenue, data, or goodwill.",
        "To the maximum extent permitted by law, Hello to Cheers’ total liability arising out of or related to the Services will not exceed the amounts paid by you to Hello to Cheers for the Services in the twelve (12) months before the event giving rise to liability.",
        "Some jurisdictions do not allow certain limitations; in those cases, our liability is limited to the fullest extent permitted.",
      ],
    },
    {
      heading: "15. Indemnification",
      paragraphs: [
        "You will defend and indemnify Hello to Cheers against claims arising from your Customer Data, your use of the Services in violation of these Terms, your communications, your event services or venue-client payment practices, or your violation of law or third-party rights.",
      ],
    },
    {
      heading: "16. Suspension and Termination",
      paragraphs: [
        "We may suspend or terminate access if you breach these Terms, create risk or possible legal exposure, fail to pay fees, or if required by law. We will provide notice when reasonable and practical.",
      ],
    },
    {
      heading: "17. Changes to the Services or Terms",
      paragraphs: [
        "We may improve or modify the Services. We may also update these Terms. Material changes will be posted with an updated effective date. Continued use after changes become effective constitutes acceptance.",
      ],
    },
    {
      heading: "18. Governing Law",
      paragraphs: [
        "These Terms are governed by the laws of the Commonwealth of Massachusetts, excluding conflict-of-law rules, unless mandatory local law provides otherwise. Venue and jurisdiction will lie in state or federal courts located in Massachusetts, except where prohibited.",
      ],
    },
    {
      heading: "19. Contact",
      paragraphs: [
        "Questions about these Terms: legal@hellotocheers.com",
        "Billing and account questions: through in-product support or the contact methods on our website.",
      ],
    },
  ],
};

export const COOKIE_POLICY: LegalDocument = {
  title: "Cookie Policy",
  slug: "cookie-policy",
  effectiveDate: "July 15, 2026",
  notice:
    "This Cookie Policy explains how Hello to Cheers (“HTC,” “we,” “us,” or “our”), operated by QuickCloud LLC, a Massachusetts limited liability company, uses cookies and similar technologies on our marketing website and product applications. For how we handle personal information more broadly, see our Privacy Policy. You can manage nonessential cookie preferences at any time at /cookies.",
  sections: [
    {
      heading: "1. What Are Cookies?",
      paragraphs: [
        "Cookies are small text files stored on your device when you visit a website. Similar technologies include local storage, session storage, and scripts that help a site remember preferences, keep you signed in, or understand how pages are used.",
        "We use the word “cookies” in this Policy to include those similar technologies where helpful.",
      ],
    },
    {
      heading: "2. How We Use Cookies",
      paragraphs: ["We use cookies and similar technologies to:"],
      bullets: [
        "Operate essential website and product functionality.",
        "Authenticate users and maintain secure sessions in our venue, client, and vendor experiences.",
        "Remember preferences, including your cookie-consent choices.",
        "Support security, integrity, and troubleshooting.",
        "Optionally measure aggregate use of our marketing website (and, where a venue enables it, certain public venue forms) so we can improve Hello to Cheers—only when analytics is enabled as described below.",
      ],
    },
    {
      heading: "3. Types of Cookies and Similar Technologies",
      paragraphs: [
        "Strictly necessary. Required for core features, security, and network operation. These include authentication and session cookies used to keep you signed in to the appropriate Hello to Cheers experience, and limited functional cookies that remember context such as which venue you are working in. They cannot be turned off through our preference controls without breaking sign-in or basic product use.",
        "Preferences. Help us remember choices you make—most importantly, your cookie preferences stored in your browser (for example in local storage on our marketing site). Preference storage itself is used to honor your selections.",
        "Analytics. Help us understand aggregate traffic and feature use so we can improve Hello to Cheers. On our marketing website, analytics is provided through Google Analytics (GA4) when (1) a Measurement ID is configured for that environment and (2) you have turned Analytics on in Cookie Preferences. Analytics is off by default. If analytics is off, or if no Measurement ID is configured, we do not load the Google Analytics script for that surface.",
        "Some venues may optionally configure analytics on their own public inquiry or tour forms. That consent is collected separately on the form and is not controlled by the marketing-site preferences at /cookies.",
        "We design analytics events to avoid sending names, email addresses, or phone numbers as analytics parameters.",
        "Marketing. We do not currently use advertising pixels, remarketing tags, or similar third-party advertising identifiers on the Hello to Cheers marketing website.",
        "Meta Lead Ads and similar tools that a venue may connect inside the product are venue integrations for receiving leads. They are not advertising cookies placed by the Hello to Cheers marketing site, and they are described further in our Privacy Policy.",
      ],
    },
    {
      heading: "4. Your Choices",
      paragraphs: [
        "You can manage nonessential cookies for our marketing website at /cookies.",
        "On that page you can keep Analytics off (the default), turn it on, or change your choices later at any time. You can also review links to this Cookie Policy and our Privacy Policy.",
        "Your marketing-site preferences are stored in your browser so they can persist across visits on that device. Clearing site data or using another browser or device may reset them.",
        "You can also control cookies through your browser settings. Blocking some cookies may affect sign-in or other site functionality.",
      ],
    },
    {
      heading: "5. Updates",
      paragraphs: [
        "We may update this Cookie Policy as our practices evolve. When we do, we will post the revised policy with an updated effective date.",
      ],
    },
    {
      heading: "6. Contact",
      paragraphs: [
        "Questions about this Cookie Policy:",
        "privacy@hellotocheers.com",
      ],
    },
  ],
};

export const END_USER_TERMS: LegalDocument = {
  title: "End User Terms",
  slug: "end-user-terms",
  effectiveDate: "September 11, 2026",
  notice:
    "These End User Terms govern your access to and use of Hello to Cheers (“HTC,” “we,” “us,” or “our”), operated by QuickCloud LLC, a Massachusetts limited liability company, as a couple, client, guest, or other invited participant. By accessing a planning portal, wedding website tools, or related features, you agree to these Terms.",
  sections: [
    {
      heading: "1. Who These Terms Cover",
      paragraphs: [
        "These Terms apply to couples, clients, guests, and other people invited to use Hello to Cheers in connection with an event hosted or managed by a participating venue (together, “you” or “End Users”).",
        "They do not replace any separate agreement you may have with a venue or with any vendor. Venue subscribers are also subject to the Venue Subscription Agreement. Invited vendors are subject to the Vendor Terms.",
      ],
    },
    {
      heading: "2. The Software We Provide",
      paragraphs: [
        "Hello to Cheers provides software and related online tools that venues use to plan, communicate, and coordinate events (the “Services”).",
        "We make the software available. We do not operate your venue, run your event, or provide event services.",
      ],
    },
    {
      heading: "3. Your Venue Manages the Event",
      paragraphs: [
        "The venue (or other hospitality business) that invited you manages the event relationship—including planning decisions, communications, vendors, and guest experience configuration within Hello to Cheers.",
        "Hello to Cheers is not a party to contracts between you and the venue, and is not a party to contracts between you and any vendors engaged for the event. Venues and vendors are responsible for their own contracted services, pricing, cancellations, refunds, and delivery, subject to applicable law.",
      ],
    },
    {
      heading: "4. Contracts, Invoices, and Event Payments",
      paragraphs: [
        "Your venue may use Hello to Cheers to prepare, send, and manage event-service contracts, including collecting your signature and the venue’s countersignature. These contracts are between you and your venue. Hello to Cheers provides the software used to facilitate the process but is not a party to those agreements.",
        "Your venue may also use Hello to Cheers to issue invoices, establish payment schedules, and display balances and payment-status information for your event.",
        "When you make an event payment through Hello to Cheers, Stripe processes the payment on your venue’s connected Stripe account. Hello to Cheers does not process event payments or collect event funds.",
        "Your venue is responsible for its event pricing, contractual obligations, cancellation policies, refunds, and delivery of services, subject to applicable law. Questions or disputes about event-service charges, refunds, or cancellations should be directed to your venue and, where appropriate, Stripe.",
        "Vendor contracts and payments are handled independently of Hello to Cheers. The platform does not create, execute, manage, or process vendor contracts or vendor payments.",
      ],
    },
    {
      heading: "5. What We Are Not Responsible For",
      paragraphs: [
        "Hello to Cheers is not responsible for the venue’s or a vendor’s independent services, pricing, planning decisions, or event execution, or for disputes arising from the event or your relationship with the venue or vendors, subject to applicable law.",
        "Questions about your booking, timeline, vendors, amounts you owe the venue or a vendor, or day-of logistics should be directed to your venue (or the relevant vendor).",
      ],
    },
    {
      heading: "6. Accounts and Credentials",
      paragraphs: [
        "If you create or receive login credentials, you are responsible for protecting them and for activity that occurs under your account.",
        "Notify your venue or Hello to Cheers promptly if you believe your access has been compromised.",
      ],
    },
    {
      heading: "7. Lawful Use",
      paragraphs: [
        "You may use the Services only for lawful purposes and in accordance with these Terms and our Acceptable Use Policy.",
        "You agree not to misuse the platform, interfere with its security or integrity, or use it to harm others.",
      ],
    },
    {
      heading: "8. Privacy",
      paragraphs: [
        "Customer and End User information is protected according to our Privacy Policy, which explains how we collect, use, share, and safeguard information.",
        "Where Hello to Cheers processes information on behalf of a venue, the venue’s instructions and privacy practices may also apply.",
        "Text messaging for venues using Hello to Cheers is described in the “Text Messaging and Communication Information” section of our Privacy Policy, including opt-out via STOP. Accepting these Terms is not SMS consent.",
      ],
    },
    {
      heading: "9. Suspension",
      paragraphs: [
        "Hello to Cheers may suspend or limit accounts for abuse, security risk, or violations of these Terms or the Acceptable Use Policy.",
      ],
    },
    {
      heading: "10. Related Policies",
      paragraphs: [
        "Our Privacy Policy and Acceptable Use Policy are incorporated into these Terms by reference. Please review them together with this page.",
      ],
    },
    {
      heading: "11. Contact",
      paragraphs: [
        "Questions about these Terms: legal@hellotocheers.com",
        "Privacy questions: privacy@hellotocheers.com",
        "General support: the contact methods listed on hellotocheers.com",
      ],
    },
  ],
};

export const VENDOR_TERMS: LegalDocument = {
  title: "Vendor Terms",
  slug: "vendor-terms",
  effectiveDate: "July 15, 2026",
  notice: "",
  sections: [
    {
      heading: "1. Welcome",
      paragraphs: [
        "Hello to Cheers (“HTC,” “we,” “us,” or “our”) is operated by QuickCloud LLC, a Massachusetts limited liability company. HTC is event-management software that helps venues, clients, and vendors coordinate celebrations.",
        "You are accessing Hello to Cheers as a vendor participant—typically because a participating venue has invited you, created or linked a vendor profile for your business, or otherwise established a relationship with you in the platform. You may claim a profile, manage information about your business, and (where supported) participate across more than one venue.",
        "By claiming a vendor profile, accepting an invitation, creating a vendor account, or otherwise using the vendor features of Hello to Cheers, you agree to these Vendor Terms, along with our Privacy Policy, Cookie Policy, and Acceptable Use Policy. Claiming a vendor profile is free.",
        "If you do not agree, please do not claim a profile or use the vendor features.",
      ],
    },
    {
      heading: "2. Our Role",
      paragraphs: [
        "Hello to Cheers provides software tools for coordination and communication. We are not a venue, vendor, employer, agent, event coordinator, or event-services provider.",
        "We are not a party to contracts for event services between venues, clients, and vendors. Those agreements are between the people and businesses who make them.",
        "Vendor contracts and payments are handled independently between you and the applicable venue or client. Hello to Cheers does not create, manage, execute, process, or track vendor contracts or vendor payments, and does not process vendor fees, deposits, refunds, or payouts.",
      ],
    },
    {
      heading: "3. Your Relationships",
      paragraphs: [
        "You decide the services you offer, your pricing, your availability, and the commitments you make to venues and clients. You are responsible for your own contracts, insurance, licenses, taxes, cancellations, refunds, disputes, and delivery of services, subject to applicable law.",
        "Venues and clients remain responsible for their own agreements and decisions. Selecting you for an event, marking a preference level (such as Preferred or Recommended), or featuring your profile in a venue’s network reflects that venue’s choices—not an endorsement, certification, or guarantee by Hello to Cheers.",
        "We do not guarantee your availability, performance, qualifications, insurance, pricing, or fulfillment. We do not guarantee that venues or clients will hire you, respond to you, or complete any transaction.",
        "Fee amounts or payment-status notes that a venue may enter for coordination on an event assignment are for visibility and planning within the software. They are not invoices, payment processing, or confirmation that money moved through Hello to Cheers. Hello to Cheers may display that coordination information but does not conduct vendor financial transactions.",
      ],
    },
    {
      heading: "4. Your Information and Account",
      paragraphs: [
        "Profiles and relationships. Vendor information in Hello to Cheers may include a global business profile (such as name, categories, contact details, bio, and media) and separate relationship details with each participating venue (such as preference level, notes, and venue-specific settings).",
        "You are responsible for the accuracy of information you provide or control. Venues may create or maintain relationship records that involve your business; some fields may be controlled by the venue.",
        "Claiming and access. When you claim a profile and create credentials, you are responsible for keeping your login secure and for activity under your account. Notify us promptly if you believe your account has been compromised.",
        "Visibility and sharing. Information you share, and information venues share about you, may be visible to venue staff and, where the product allows, to clients or other participants connected to relevant events. Availability, packages or service listings, inquiries, messages, tasks, schedules, and documents related to an assignment may be shared as needed for coordination.",
        "Packages or listed prices in the platform are informational catalogs for discovery and planning. They are not contracts and do not process charges.",
        "After a relationship ends. If a venue relationship ends, some historical event or relationship information may remain accessible to the venue or other authorized users as needed for their records and ongoing operations, consistent with our Privacy Policy and the venue’s account settings. We do not promise automatic deletion of every reference to your business on a fixed calendar day.",
        "If you need a correction or have a concern about information associated with your profile, contact the relevant venue and/or us using the contact details below. We will review requests consistent with our Privacy Policy and applicable law.",
      ],
    },
    {
      heading: "5. Appropriate Use",
      paragraphs: [
        "Please use Hello to Cheers honestly and respectfully.",
        "You agree that you will:",
      ],
      bullets: [
        "Provide accurate business and contact information.",
        "Access only event and client information you are authorized to see.",
        "Keep private event, client, and venue information confidential and use it only for coordinating the services you are engaged to provide.",
        "Not spam, harass, or send unauthorized marketing through the platform.",
        "Not impersonate another person or business, or misrepresent your services, credentials, or relationship to a venue or client.",
        "Not upload content you do not have the right to use, or use the platform to infringe others’ intellectual-property or privacy rights.",
        "Not attempt to disrupt, reverse engineer, or misuse the service.",
      ],
      afterBullets: [
        "We may suspend or terminate access if we reasonably believe these terms or our Acceptable Use Policy have been violated, or if needed to protect venues, clients, other vendors, or the platform.",
      ],
    },
    {
      heading: "6. Privacy",
      paragraphs: [
        "How we collect, use, and share information—including vendor profile and contact details, event and client information shared with you for coordination, venue-controlled customer data, optional AI-assisted features where your information may appear, and communications such as email or portal notifications—is described in our Privacy Policy. Please read it.",
        "You may receive service-related messages about invitations, assignments, inquiries, and account activity. Marketing preferences, where offered, are handled as described in the Privacy Policy.",
      ],
    },
    {
      heading: "7. Availability and Our Promise",
      paragraphs: [
        "We work to keep Hello to Cheers reliable and useful, and we care about the people who use it. Our approach is described on our Our Promise page.",
        "We do not promise uninterrupted access, specific response times, or financial credits for downtime. Features may change as we improve the product. Scheduled maintenance or unexpected issues may temporarily affect availability.",
      ],
    },
    {
      heading: "8. Changes",
      paragraphs: [
        "We may update these Vendor Terms from time to time. When we do, we will post the revised terms with an updated effective date. Continued use of the vendor features after changes take effect means you accept the updated terms. If you do not agree, stop using the vendor features and contact us if you need help with your account.",
      ],
    },
    {
      heading: "9. Contact",
      paragraphs: [
        "Questions about these Vendor Terms:",
        "legal@hellotocheers.com",
        "For privacy-related requests, see our Privacy Policy or contact privacy@hellotocheers.com.",
      ],
    },
  ],
};

export const ACCEPTABLE_USE_POLICY: LegalDocument = {
  title: "Acceptable Use Policy",
  slug: "acceptable-use",
  effectiveDate: "July 15, 2026",
  notice:
    "This Acceptable Use Policy (“AUP”) describes prohibited uses of Hello to Cheers (“HTC,” “we,” “us,” or “our”), operated by QuickCloud LLC, a Massachusetts limited liability company. It helps protect venues, clients, guests, vendors, and the integrity of the platform.",
  sections: [
    {
      heading: "1. Purpose",
      paragraphs: [
        "This AUP applies to anyone who uses Hello to Cheers—including venue owners and staff, clients and couples, vendors, and other invited participants—together with the Venue Subscription Agreement, End User Terms, Vendor Terms, Privacy Policy, and Cookie Policy, as applicable. Public visitors who use limited features (such as inquiry forms, tour requests, RSVPs, or wedding websites) must still use those features lawfully and must not abuse or disrupt the Services.",
        "Hello to Cheers is event-management software for hospitality businesses and the people who plan and deliver celebrations with them. This AUP sets clear boundaries so the platform remains safe, lawful, and trustworthy.",
      ],
    },
    {
      heading: "2. Prohibited Activities",
      paragraphs: ["You may not use Hello to Cheers to:"],
      bullets: [
        "Violate applicable laws or regulations.",
        "Infringe intellectual property, privacy, or publicity rights.",
        "Upload malware, attempt unauthorized access, or disrupt the Services.",
        "Probe, scan, or test system vulnerability without authorization.",
        "Send spam, phishing, or unsolicited bulk communications unrelated to legitimate venue, event, or hospitality operations you are authorized to conduct.",
        "Harass, threaten, or exploit individuals.",
        "Store or transmit unlawful content.",
        "Misrepresent your identity or affiliation in a deceptive manner, including deceptive vendor profiles or false invitation or account-claiming activity.",
        "Access, share, or misuse private event, guest, RSVP, or client information beyond what you are authorized to use for legitimate planning or service coordination.",
        "Share login credentials in a way that enables unauthorized access, or attempt to circumvent permissions or security controls.",
        "Resell or provide the Services to third parties except as expressly permitted.",
        "Use automated means to scrape or overload the Services beyond ordinary product use, including automated abuse of public forms.",
        "Use optional AI-assisted features for unlawful or harmful activity, to bypass safeguards, to submit information you are not authorized to share, or to generate content used to impersonate, deceive, or harass.",
      ],
      afterBullets: [
        "Authorized hospitality communications—such as inquiry responses, tour reminders, planning updates, guest information, and related event coordination—are permitted when they comply with this AUP, your applicable agreement, and applicable law. Accepting this AUP is not consent to receive marketing text messages.",
      ],
    },
    {
      heading: "3. Customer Communications",
      paragraphs: [
        "Venues remain responsible for the content of messages and documents they send through Hello to Cheers to clients, guests, vendors, and staff, and for complying with applicable messaging and privacy laws. Additional customer-communications and text-messaging responsibilities—including permission requirements and STOP/START handling—are set out in the Venue Subscription Agreement and Privacy Policy.",
        "Vendors and clients are responsible for communications they initiate through Hello to Cheers and for using event or contact information only as authorized.",
      ],
    },
    {
      heading: "4. Enforcement",
      paragraphs: [
        "We may investigate suspected violations and may suspend or terminate access, remove content, or report activity to authorities when appropriate.",
      ],
    },
    {
      heading: "5. Reporting",
      paragraphs: [
        "Report suspected abuse to abuse@hellotocheers.com.",
        "Where available, you may also contact Hello to Cheers through product support or feedback channels for general help. Those channels are not a substitute for emailing abuse@hellotocheers.com when you need to report abuse or security concerns.",
      ],
    },
    {
      heading: "6. Changes",
      paragraphs: [
        "We may update this AUP from time to time. When we do, we will post the revised policy with an updated effective date. Continued use of Hello to Cheers after updates take effect constitutes acceptance of the updated AUP.",
      ],
    },
  ],
};
