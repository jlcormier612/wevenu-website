/**
 * Legal document drafts for Hello to Cheers.
 * Ready for counsel review before launch — not final legal advice.
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
  effectiveDate: "July 15, 2026",
  notice:
    "This Privacy Policy explains how Hello to Cheers collects, uses, shares, and protects information when you use our websites, products, and related services. Please review it carefully. We will update this page when our practices change.",
  sections: [
    {
      heading: "1. Who We Are",
      paragraphs: [
        "Hello to Cheers provides software and related services for independent venues and hospitality businesses (the “Services”). In this Privacy Policy, “Hello to Cheers,” “we,” “us,” and “our” refer to the Hello to Cheers operating entity that provides the Services.",
        "If you have privacy questions, contact us at privacy@hellotocheers.com (or the support address listed on our website).",
      ],
    },
    {
      heading: "2. Scope",
      paragraphs: [
        "This Privacy Policy applies to our marketing website, product applications, customer accounts, support communications, and related online experiences.",
        "Hello to Cheers is used by venue owners, venue staff, couples, clients, guests, vendors, and other invited collaborators.",
        "Depending on your role, Hello to Cheers may act either as the direct provider of services to you or as a service provider processing information on behalf of a participating venue.",
        "Where Hello to Cheers processes information on behalf of a venue, the venue's instructions and privacy practices also apply.",
      ],
    },
    {
      heading: "3. Information We Collect",
      paragraphs: ["Depending on how you interact with Hello to Cheers, we may collect:"],
      bullets: [
        "Account and profile information (name, email, phone, role, venue details).",
        "Business and operational data you enter into Hello to Cheers (events, clients, planning details, messages, documents, financial records related to venue operations).",
        "Billing and transaction metadata associated with your subscription (processed with our payment providers).",
        "Communications you send us (support requests, walkthrough requests, feedback).",
        "Usage and device information (IP address, browser type, approximate location derived from IP, pages viewed, feature usage, diagnostic logs).",
        "Cookies and similar technologies as described in our Cookie Policy.",
      ],
    },
    {
      heading: "4. How We Use Information",
      paragraphs: ["We use information to:"],
      bullets: [
        "Provide, operate, maintain, and improve the Services.",
        "Authenticate users, manage accounts, and enforce permissions.",
        "Process subscriptions and send billing-related notices.",
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
        "Service providers who help us host, secure, support, analyze, or process payments (under contractual obligations to protect data).",
        "Payment processors such as Stripe for subscription billing and related payment operations.",
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
      ],
    },
    {
      heading: "8. Data Retention",
      paragraphs: [
        "We retain information for as long as needed to provide the Services, comply with legal obligations, resolve disputes, and enforce agreements.",
        "When accounts are canceled, we provide export pathways and retain limited records as required for billing, security, and legal compliance before deletion or anonymization according to our retention practices.",
      ],
    },
    {
      heading: "9. Security",
      paragraphs: [
        "We implement administrative, technical, and organizational safeguards designed to protect personal information. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.",
        "If we become aware of a breach affecting your personal information, we will notify affected customers and regulators as required by applicable law.",
      ],
    },
    {
      heading: "10. Your Choices and Rights",
      paragraphs: [
        "Depending on your location, you may have rights to access, correct, delete, export, or restrict certain personal information, or to object to certain processing.",
        "You may also manage cookie preferences where available, and unsubscribe from promotional emails using the link in those messages. Service and billing messages may still be sent as needed to operate your account.",
        "To exercise privacy rights, contact privacy@hellotocheers.com. We may need to verify your request before responding.",
      ],
    },
    {
      heading: "11. International Transfers",
      paragraphs: [
        "Hello to Cheers may process information in the United States and other countries where we or our service providers operate. Where required, we use appropriate safeguards for cross-border transfers.",
      ],
    },
    {
      heading: "12. Children’s Privacy",
      paragraphs: [
        "Hello to Cheers is built for business use by venues and related professionals. The Services are not directed to children under 16, and we do not knowingly collect personal information from children for marketing purposes.",
      ],
    },
    {
      heading: "13. Changes to This Policy",
      paragraphs: [
        "We may update this Privacy Policy from time to time. We will post the updated version with a revised effective date and, when changes are material, provide additional notice as appropriate.",
      ],
    },
    {
      heading: "14. Contact",
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
  effectiveDate: "July 15, 2026",
  notice:
    "These Terms of Service govern your access to and use of Hello to Cheers. By creating an account or using the Services, you agree to these Terms. If you are accepting on behalf of a venue or organization, you represent that you have authority to bind that entity.",
  sections: [
    {
      heading: "1. Overview",
      paragraphs: [
        "Hello to Cheers provides cloud software and related services to help venues manage sales, planning, operations, communication, financial workflows, and guest experiences (the “Services”).",
        "These Terms form a binding agreement between you and Hello to Cheers. Additional product-specific terms, order forms, or policies (including our Privacy Policy, Cookie Policy, and Acceptable Use Policy) are incorporated by reference.",
      ],
    },
    {
      heading: "2. Accounts and Eligibility",
      paragraphs: [
        "You must provide accurate account information and keep it updated. You are responsible for safeguarding credentials and for activity under your account.",
        "You must be able to form a binding contract and use the Services only for lawful business purposes related to venue or hospitality operations.",
      ],
    },
    {
      heading: "3. Subscriptions and Billing",
      paragraphs: [
        "Paid plans are offered on a month-to-month basis unless otherwise stated in writing. Fees are charged in advance for each billing period through our payment processor.",
        "Except where required by law or stated in our 30-Day Happiness Promise, fees are generally non-refundable once a billing period begins.",
        "We may change prices with notice before the change takes effect for subsequent billing periods. Continued use after the effective date constitutes acceptance of the updated pricing.",
        "You authorize us and our payment processor to charge the payment method on file for recurring fees and applicable taxes.",
      ],
    },
    {
      heading: "4. 30-Day Happiness Promise",
      paragraphs: [
        "If you are a new paying subscriber and Hello to Cheers is not the right fit during your first 30 days, you may request a refund of your first month’s subscription fee.",
        "After the first 30 days, your subscription continues month-to-month until canceled. This Promise does not apply to third-party fees, custom professional services, or amounts charged by venues to their own clients.",
      ],
    },
    {
      heading: "5. Cancellation",
      paragraphs: [
        "You may cancel your subscription at any time through account billing settings (or another method we provide).",
        "Cancellation stops future renewals. You generally retain access through the end of the then-current paid period unless otherwise stated.",
        "We do not charge cancellation fees for standard monthly subscriptions.",
      ],
    },
    {
      heading: "6. Your Data and Ownership",
      paragraphs: [
        "You retain ownership of the content and data you submit to the Services (“Customer Data”).",
        "You grant Hello to Cheers a limited license to host, process, transmit, display, and otherwise use Customer Data solely to provide and improve the Services and as otherwise permitted in these Terms and our Privacy Policy.",
        "You are responsible for the accuracy of Customer Data and for obtaining any consents needed to collect and process information about your clients, guests, vendors, and staff through Hello to Cheers.",
      ],
    },
    {
      heading: "7. Data Export and Departure",
      paragraphs: [
        "We intend for you to be able to export Customer Data through product export tools before cancellation, without requiring a support ticket for ordinary export needs.",
        "After cancellation or account closure, we may delete or de-identify Customer Data according to our retention practices, except where we must retain records for legal, security, or billing reasons.",
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
      heading: "9. Third-Party Services",
      paragraphs: [
        "The Services may integrate with third parties (including Stripe and communications providers). Your use of those services may be subject to their terms. Hello to Cheers is not responsible for third-party services we do not control.",
      ],
    },
    {
      heading: "10. Intellectual Property",
      paragraphs: [
        "Hello to Cheers and its licensors own the Services, software, branding, and related intellectual property. Except for the limited rights expressly granted, no rights are transferred to you.",
        "Feedback you provide may be used by Hello to Cheers to improve the Services without obligation to you.",
      ],
    },
    {
      heading: "11. Confidentiality",
      paragraphs: [
        "Each party may receive confidential information from the other. The receiving party will protect that information with reasonable care and use it only as needed to perform under these Terms, except where disclosure is required by law.",
      ],
    },
    {
      heading: "12. Disclaimers",
      paragraphs: [
        "THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW, HELLO TO CHEERS DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.",
        "We do not warrant that the Services will be uninterrupted, error-free, or free of harmful components, or that all content will be secure or not lost.",
      ],
    },
    {
      heading: "13. Limitation of Liability",
      paragraphs: [
        "TO THE MAXIMUM EXTENT PERMITTED BY LAW, HELLO TO CHEERS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL.",
        "TO THE MAXIMUM EXTENT PERMITTED BY LAW, HELLO TO CHEERS’ TOTAL LIABILITY ARISING OUT OF OR RELATED TO THE SERVICES WILL NOT EXCEED THE AMOUNTS PAID BY YOU TO HELLO TO CHEERS FOR THE SERVICES IN THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING RISE TO LIABILITY.",
        "Some jurisdictions do not allow certain limitations; in those cases, our liability is limited to the fullest extent permitted.",
      ],
    },
    {
      heading: "14. Indemnification",
      paragraphs: [
        "You will defend and indemnify Hello to Cheers against claims arising from your Customer Data, your use of the Services in violation of these Terms, or your violation of law or third-party rights.",
      ],
    },
    {
      heading: "15. Suspension and Termination",
      paragraphs: [
        "We may suspend or terminate access if you breach these Terms, create risk or possible legal exposure, fail to pay fees, or if required by law. We will provide notice when reasonable and practical.",
      ],
    },
    {
      heading: "16. Changes to the Services or Terms",
      paragraphs: [
        "We may improve or modify the Services. We may also update these Terms. Material changes will be posted with an updated effective date. Continued use after changes become effective constitutes acceptance.",
      ],
    },
    {
      heading: "17. Governing Law",
      paragraphs: [
        "These Terms are governed by the laws of the State of Delaware, excluding conflict-of-law rules, unless mandatory local law provides otherwise for consumers where applicable. Venue and jurisdiction will lie in courts located in Delaware, except where prohibited.",
      ],
    },
    {
      heading: "18. Contact",
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
    "This Cookie Policy explains how Hello to Cheers uses cookies and similar technologies on our websites and applications.",
  sections: [
    {
      heading: "1. What Are Cookies?",
      paragraphs: [
        "Cookies are small text files stored on your device. Similar technologies include local storage, pixels, and session identifiers. They help sites remember preferences, keep you signed in, and understand how experiences are used.",
      ],
    },
    {
      heading: "2. How We Use Cookies",
      paragraphs: ["We may use cookies and similar technologies to:"],
      bullets: [
        "Operate essential site and product functionality.",
        "Authenticate users and maintain secure sessions.",
        "Remember preferences, including cookie consent choices.",
        "Understand aggregate traffic and improve our marketing site and product.",
        "Support security, fraud prevention, and troubleshooting.",
      ],
    },
    {
      heading: "3. Types of Cookies",
      bullets: [
        "Strictly necessary — required for core features, security, and network management.",
        "Preferences — remember choices such as consent settings.",
        "Analytics — help us understand usage in aggregate so we can improve Hello to Cheers.",
        "Marketing — if used, help us measure campaign effectiveness; we aim to keep these limited and respectful.",
      ],
    },
    {
      heading: "4. Your Choices",
      paragraphs: [
        "You can manage non-essential cookies through our Cookie Preferences controls where available, and through your browser settings.",
        "Blocking some cookies may affect site functionality.",
      ],
    },
    {
      heading: "5. Updates",
      paragraphs: [
        "We may update this Cookie Policy as our practices evolve. The effective date above will change when we do.",
      ],
    },
    {
      heading: "6. Contact",
      paragraphs: ["privacy@hellotocheers.com"],
    },
  ],
};

export const END_USER_TERMS: LegalDocument = {
  title: "End User Terms",
  slug: "end-user-terms",
  effectiveDate: "July 15, 2026",
  notice:
    "These End User Terms govern your access to and use of Hello to Cheers as a couple, client, guest, or other invited participant. By accessing a planning portal, wedding website tools, or related features, you agree to these Terms.",
  sections: [
    {
      heading: "1. Who These Terms Cover",
      paragraphs: [
        "These Terms apply to couples, clients, guests, and other people invited to use Hello to Cheers in connection with an event hosted or managed by a participating venue (together, “you” or “End Users”).",
        "They do not replace any separate agreement you may have with a venue. Venue subscribers are also subject to the Venue Subscription Agreement.",
      ],
    },
    {
      heading: "2. The Platform We Provide",
      paragraphs: [
        "Hello to Cheers provides the software platform and related online tools that venues use to plan, communicate, and coordinate events (the “Services”).",
        "We make the technology available; we do not operate your venue or run your event.",
      ],
    },
    {
      heading: "3. Your Venue Manages the Event",
      paragraphs: [
        "The venue (or other hospitality business) that invited you manages the event relationship—including planning decisions, communications, vendors, and guest experience configuration within Hello to Cheers.",
        "Hello to Cheers is not a party to contracts between you and the venue, and is not a party to contracts between you and any vendors engaged for the event.",
      ],
    },
    {
      heading: "4. What We Are Not Responsible For",
      paragraphs: [
        "Hello to Cheers is not responsible for venue pricing, planning decisions, vendor selection, event execution, or disputes arising from the event or your relationship with the venue or vendors.",
        "Questions about your booking, timeline, vendors, payments owed to the venue, or day-of logistics should be directed to your venue.",
      ],
    },
    {
      heading: "5. Accounts and Credentials",
      paragraphs: [
        "If you create or receive login credentials, you are responsible for protecting them and for activity that occurs under your account.",
        "Notify your venue or Hello to Cheers promptly if you believe your access has been compromised.",
      ],
    },
    {
      heading: "6. Lawful Use",
      paragraphs: [
        "You may use the Services only for lawful purposes and in accordance with these Terms and our Acceptable Use Policy.",
        "You agree not to misuse the platform, interfere with its security or integrity, or use it to harm others.",
      ],
    },
    {
      heading: "7. Privacy",
      paragraphs: [
        "Customer and End User information is protected according to our Privacy Policy, which explains how we collect, use, share, and safeguard information.",
        "Where Hello to Cheers processes information on behalf of a venue, the venue’s instructions and privacy practices may also apply.",
      ],
    },
    {
      heading: "8. Suspension",
      paragraphs: [
        "Hello to Cheers may suspend or limit accounts for abuse, security risk, or violations of these Terms or the Acceptable Use Policy. We will provide notice when reasonable and practical.",
      ],
    },
    {
      heading: "9. Related Policies",
      paragraphs: [
        "Our Privacy Policy and Acceptable Use Policy are incorporated into these Terms by reference. Please review them together with this page.",
      ],
    },
    {
      heading: "10. Contact",
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
        "These Vendor Terms govern your access to and use of Hello to Cheers as an invited vendor.",
        "You are accessing Hello to Cheers because a participating venue has invited you to collaborate on one or more events through the platform.",
        "By accepting that invitation or using Hello to Cheers, you agree to these Vendor Terms, along with our Privacy Policy, Cookie Policy, and Acceptable Use Policy.",
      ],
    },
    {
      heading: "2. Our Role",
      paragraphs: [
        "Hello to Cheers provides software that helps venues, clients, vendors, and venue teams collaborate around shared events.",
        "Hello to Cheers is not:",
      ],
      bullets: [
        "the venue",
        "your client",
        "your employer",
        "your agent",
        "your event coordinator",
      ],
      afterBullets: [
        "We provide the technology platform that enables collaboration.",
      ],
    },
    {
      heading: "3. Your Relationship With the Venue",
      paragraphs: [
        "Your business relationship remains directly with the venue and, where applicable, the couple or client.",
        "Hello to Cheers is not a party to agreements involving:",
      ],
      bullets: [
        "services",
        "pricing",
        "proposals",
        "contracts",
        "insurance",
        "scheduling",
        "payments between vendors and venues",
        "event execution",
        "disputes",
      ],
      afterBullets: [
        "Questions regarding those matters should be directed to the venue or the appropriate contracting party.",
      ],
    },
    {
      heading: "4. Your Information",
      paragraphs: [
        "You remain responsible for the accuracy of the information you provide.",
        "You should keep your contact information, availability, pricing (where applicable), uploaded documents, and other business information current.",
        "You are responsible for maintaining the security of your login credentials.",
      ],
    },
    {
      heading: "5. Appropriate Use",
      paragraphs: [
        "You agree to use Hello to Cheers only for legitimate business purposes connected with events and hospitality.",
        "You may not:",
      ],
      bullets: [
        "interfere with the platform",
        "attempt unauthorized access",
        "upload malicious software",
        "impersonate another person or business",
        "misuse communication tools",
        "violate applicable laws",
      ],
      afterBullets: [
        "Additional requirements appear in our Acceptable Use Policy.",
      ],
    },
    {
      heading: "6. Privacy",
      paragraphs: [
        "Our Privacy Policy explains how Hello to Cheers collects, uses, and protects information.",
        "The venue may also maintain its own privacy practices relating to information shared through its workspace.",
      ],
    },
    {
      heading: "7. Availability",
      paragraphs: [
        "We work hard to provide a reliable platform.",
        "Like all software services, Hello to Cheers may occasionally experience maintenance, updates, or unexpected interruptions.",
        "Current operational status is available through our System Status page.",
      ],
    },
    {
      heading: "8. Changes",
      paragraphs: [
        "We may update these Vendor Terms from time to time.",
        "Material changes will include an updated effective date and, where appropriate, additional notice.",
        "Continued use after the effective date constitutes acceptance of the updated terms.",
      ],
    },
    {
      heading: "9. Contact",
      paragraphs: [
        "Questions regarding these Vendor Terms may be sent to:",
        "legal@hellotocheers.com",
        "General support is available through the contact methods listed on hellotocheers.com.",
      ],
    },
  ],
};

export const ACCEPTABLE_USE_POLICY: LegalDocument = {
  title: "Acceptable Use Policy",
  slug: "acceptable-use",
  effectiveDate: "July 15, 2026",
  notice:
    "This Acceptable Use Policy (“AUP”) describes prohibited uses of Hello to Cheers. It helps protect venues, their clients and guests, and the integrity of the platform.",
  sections: [
    {
      heading: "1. Purpose",
      paragraphs: [
        "Hello to Cheers is built for hospitality professionals. This AUP sets boundaries so the platform remains safe, lawful, and trustworthy.",
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
        "Send spam, phishing, or unsolicited bulk communications unrelated to legitimate venue operations.",
        "Harass, threaten, or exploit individuals.",
        "Store or transmit unlawful content.",
        "Misrepresent your identity or affiliation in a deceptive manner.",
        "Resell or provide the Services to third parties except as expressly permitted.",
        "Use automated means to scrape or overload the Services beyond ordinary product use.",
      ],
    },
    {
      heading: "3. Customer Communications",
      paragraphs: [
        "Venues remain responsible for the content of messages and documents they send through Hello to Cheers to clients, guests, vendors, and staff, and for complying with applicable messaging and privacy laws.",
      ],
    },
    {
      heading: "4. Enforcement",
      paragraphs: [
        "We may investigate violations and suspend or terminate access, remove content, or report activity to authorities when appropriate.",
      ],
    },
    {
      heading: "5. Reporting",
      paragraphs: [
        "Report suspected abuse to abuse@hellotocheers.com or through in-product support channels.",
      ],
    },
    {
      heading: "6. Changes",
      paragraphs: [
        "We may update this AUP. Continued use of Hello to Cheers after updates constitutes acceptance.",
      ],
    },
  ],
};
