import type { RelatedFeatureLink } from "@/lib/success-library/types";

export type SetupGuideStep = {
  number: number;
  title: string;
  doThis: string;
  lookFor: string;
  dontDo?: string;
  tip?: string;
};

export type SetupGuide = {
  slug: string;
  title: string;
  shortTitle: string;
  category: "Your Venue" | "Getting Started";
  intro: string;
  time: string;
  prerequisites: string[];
  whyItMatters: string;
  steps: SetupGuideStep[];
  completion: string;
  troubleshooting: string[];
  relatedFeatures: RelatedFeatureLink[];
  returnHref: string;
  returnLabel: string;
};

const guide = (
  data: Omit<SetupGuide, "category"> & { category?: SetupGuide["category"] },
): SetupGuide => ({ category: "Your Venue", ...data });

export const SETUP_GUIDES: readonly SetupGuide[] = [
  guide({
    slug: "setup-your-venue",
    title: "Set up your venue basics",
    shortTitle: "Your Venue",
    intro: "Start with the information that makes Hello to Cheers look and sound like your venue. You do not need to get every detail perfect before moving on.",
    time: "About 10–15 minutes",
    prerequisites: ["Your venue's public name", "Your business address and contact information", "Your preferred business hours", "Your venue logo and brand colors, if you have them ready"],
    whyItMatters: "Your venue details are reused across communications, documents, pages, and other places where couples need to recognize who they are working with.",
    steps: [
      { number: 1, title: "Open your venue settings", doThis: "Go to Settings → Business. Start at the top and work downward rather than trying to find every field at once.", lookFor: "You should see your venue name and the basic business information Hello to Cheers has for you." },
      { number: 2, title: "Confirm the venue name", doThis: "Enter the name you actually use with couples. Use your public-facing venue name, not an internal shorthand.", lookFor: "The name should look exactly the way you want it to appear on emails, documents, and client-facing pages.", dontDo: "Do not use an abbreviation just because it is shorter. If couples know you as 'Sweet Daisy Barn & Farm,' use that name." },
      { number: 3, title: "Add your contact information", doThis: "Enter the venue phone number, email address, website, and mailing/business address where those fields are provided.", lookFor: "Read the information back as if you were a couple trying to contact you for the first time." },
      { number: 4, title: "Set your normal business hours", doThis: "Enter the hours you normally want customers to associate with your venue. If you have different hours for tours or events, use the more specific scheduling settings later rather than trying to make these hours do everything.", lookFor: "Your normal business hours are saved and readable without explanation.", tip: "You can change these later. The goal now is a useful starting point, not perfection." },
      { number: 5, title: "Add your brand details", doThis: "Add your logo and choose your venue's brand colors where the settings allow it.", lookFor: "The preview or saved values look like your venue rather than a generic business.", dontDo: "Do not spend an hour trying to find the perfect shade. You can refine your branding later." },
      { number: 6, title: "Save and do a quick read-through", doThis: "Save your changes, then read the page from top to bottom once.", lookFor: "There are no obvious typos, missing phone numbers, or incorrect addresses.", tip: "If something is wrong later, you can come back here. Nothing in this setup step is permanent." },
    ],
    completion: "Your venue basics are in place. You can keep refining them later without affecting the rest of your setup.",
    troubleshooting: ["If a field will not save, check whether a required field above it is still empty.", "If your address or phone number is different from what couples should see, correct it here rather than changing individual documents one by one."],
    relatedFeatures: [{ label: "Open Venue Settings", href: "/settings/business" }],
    returnHref: "/settings/business",
    returnLabel: "Open Venue Settings",
  }),
  guide({
    slug: "setup-bring-your-business",
    title: "Bring your existing business into Hello to Cheers",
    shortTitle: "Bring Your Business",
    category: "Getting Started",
    intro: "If you already have leads, clients, vendors, spreadsheets, or files somewhere else, you do not have to rebuild everything by hand. This guide helps you choose the safest starting point.",
    time: "15 minutes to plan; longer if you are importing data",
    prerequisites: ["A list of what you currently keep in another system, spreadsheet, or files", "Access to the source data if you plan to import it", "A little time to decide what is worth bringing over"],
    whyItMatters: "The goal is to move your real business forward, not create a second data-entry project. Bring over the information that is useful and leave behind what is obsolete.",
    steps: [
      { number: 1, title: "Start in Setup → Bring Your Business", doThis: "Open Setup and choose Bring Your Business. Read the two choices before clicking anything: bring existing information over, or start fresh.", lookFor: "You should see a choice that fits your situation rather than a requirement to import everything." },
      { number: 2, title: "Decide what you actually need", doThis: "Make three quick lists: active leads/clients, active vendors, and old information you probably do not need anymore.", lookFor: "You have a short list of information that would save you work if it appeared in Hello to Cheers.", dontDo: "Do not import years of old clutter simply because you can. If you would never use it again, it may not belong in your new system." },
      { number: 3, title: "Choose your path", doThis: "If you have clean data you want to bring over, use the import path. If your current information is messy or you would rather start clean, choose the fresh-start option and add active information as you go.", lookFor: "Setup records the path you chose so you are not repeatedly asked the same question.", tip: "Starting fresh is a legitimate setup choice. It does not mean you made a mistake." },
      { number: 4, title: "Prepare imported data", doThis: "If you are importing a spreadsheet, make sure names, email addresses, phone numbers, event dates, and statuses are in separate, understandable columns. Keep a backup of the original file.", lookFor: "You can explain what each column means without guessing." },
      { number: 5, title: "Review the import before relying on it", doThis: "After an import, review a few records from the beginning, middle, and end of the imported set. Look for names, contact information, dates, and status values that look wrong.", lookFor: "The imported records resemble the source information and are attached to the right relationships.", dontDo: "Do not delete your original spreadsheet immediately. Keep it until you are satisfied that the import is correct." },
      { number: 6, title: "Move only what is still useful", doThis: "If you uploaded old documents or files, use the Library later to turn the important ones into real contracts, message templates, questionnaires, or planning guides.", lookFor: "You know which files are reference material and which ones should become reusable Hello to Cheers templates." },
    ],
    completion: "Your existing business has a deliberate starting point in Hello to Cheers — either brought over carefully or intentionally started fresh.",
    troubleshooting: ["If an import looks wrong, stop before doing another import. Keep the original file and ask for help so the source and result can be compared.", "If you are unsure whether a file should become a template, keep it as reference material until you know how you will use it."],
    relatedFeatures: [{ label: "Open Setup", href: "/setup-hub" }],
    returnHref: "/setup-hub",
    returnLabel: "Back to Setup",
  }),
  guide({
    slug: "setup-calendar-availability",
    title: "Set up your calendar and availability",
    shortTitle: "Calendar & Availability",
    intro: "Tell Hello to Cheers what spaces you have, how many events you can host, and whether couples should be able to book tours online.",
    time: "About 10–20 minutes",
    prerequisites: ["The names of your event spaces", "A simple idea of how many events you can host at the same time", "Your tour availability, if you want online tour booking"],
    whyItMatters: "These settings help prevent double-booking and make availability and tour scheduling reflect how your venue actually operates.",
    steps: [
      { number: 1, title: "Open Calendar & Availability", doThis: "Go to Setup → Calendar & Availability or Settings → Availability.", lookFor: "You should see your spaces and the controls that determine scheduling capacity and tours." },
      { number: 2, title: "Add each event space", doThis: "Add every space that should be treated as a distinct venue space. Use the name your team actually uses.", lookFor: "Each space has a clear name and you can tell the spaces apart.", dontDo: "Do not create five copies of one room just because it can be configured five ways. Use the space structure that reflects how you actually book it." },
      { number: 3, title: "Set your capacity rules", doThis: "Tell Hello to Cheers how many events you can host at once and any meaningful capacity restrictions.", lookFor: "The setting reflects your real operating limit rather than a theoretical maximum.", tip: "If you only host one wedding at a time, say one. Simple is better than complicated rules you do not maintain." },
      { number: 4, title: "Decide whether to offer online tours", doThis: "If you want couples to book tours online, turn on tour scheduling and set the hours/availability you actually offer. If you do not want online booking, leave it off.", lookFor: "The setting clearly matches your business decision.", dontDo: "Do not turn online tour booking on just to make setup look complete. Off is a valid choice." },
      { number: 5, title: "Test the result", doThis: "Read your space and availability settings as if you were trying to schedule an event or book a tour.", lookFor: "Nothing would allow a booking you would reject in real life." },
    ],
    completion: "Your spaces and availability now reflect how your venue actually operates.",
    troubleshooting: ["If a space should not appear as bookable, check its availability rather than deleting it if you still need it for existing events.", "If tour times look wrong, review the tour-specific schedule rather than changing your overall business hours."],
    relatedFeatures: [{ label: "Open Availability Settings", href: "/settings/availability" }],
    returnHref: "/settings/availability",
    returnLabel: "Open Availability",
  }),
  guide({
    slug: "setup-your-offerings",
    title: "Set up your packages and inventory",
    shortTitle: "Your Offerings",
    intro: "Build the things couples can actually choose and the physical items your team needs to deliver events.",
    time: "20–45 minutes",
    prerequisites: ["Your current package/pricing sheet, if you have one", "A list of common included items", "Your current package names and descriptions"],
    whyItMatters: "Packages are what a couple says yes to. Inventory helps you deliver what was promised and keeps event orders grounded in what your venue actually has.",
    steps: [
      { number: 1, title: "Open the Library", doThis: "Go to Library → Packages. Start with the package examples already available rather than building a complicated system from scratch.", lookFor: "You should see package cards with names, descriptions, pricing, and included items where applicable." },
      { number: 2, title: "Decide what you actually sell", doThis: "Write down your real package choices exactly as you explain them to couples today.", lookFor: "You have a small, understandable list of packages.", dontDo: "Do not create a package for every tiny variation. If something is an optional add-on, it may belong in inventory or another offering structure instead." },
      { number: 3, title: "Customize or create your packages", doThis: "Edit the starting examples or create your own. Use plain language a couple would understand without you standing beside them.", lookFor: "A couple could read the package and understand what is included, what it costs, and what is not included." },
      { number: 4, title: "Add your inventory", doThis: "Add the physical items that matter to event planning — tables, chairs, linens, equipment, or other tracked items.", lookFor: "The inventory list reflects things your team actually needs to know about when building an event." },
      { number: 5, title: "Check one package end to end", doThis: "Open one package and review its price, description, included items, and any inventory relationships.", lookFor: "Nothing important is missing and there is no placeholder copy that a couple could accidentally see." },
    ],
    completion: "Your core offerings are ready enough for real conversations. You can keep adding or refining them as your business changes.",
    troubleshooting: ["If you have many package variations, start with the packages you sell most often. You can add edge cases later.", "If an item is not something your team needs to track, do not add it as inventory just for completeness."],
    relatedFeatures: [{ label: "Open Packages", href: "/library/packages" }],
    returnHref: "/library/packages",
    returnLabel: "Open Packages",
  }),
  guide({
    slug: "setup-client-experience",
    title: "Set up your client experience",
    shortTitle: "Your Client Experience",
    intro: "Prepare the contracts, questionnaires, messages, and planning guides you will use with couples so you do not have to recreate the same work for every event.",
    time: "30–60 minutes to start",
    prerequisites: ["Your current contract or agreement", "Your common client emails/messages", "Your questionnaires or planning checklists", "Your current planning timeline or checklist, if you have one"],
    whyItMatters: "This is the part of Hello to Cheers your couples actually experience. Good templates make your process consistent without making it feel robotic.",
    steps: [
      { number: 1, title: "Open your Library", doThis: "Go to Library. Look across Contracts, Questionnaires, Message Templates, and Planning/Playbook content rather than trying to perfect everything in one sitting.", lookFor: "You should see the starter examples and the places where your own reusable content belongs." },
      { number: 2, title: "Start with your most-used contract", doThis: "Open the contract example and compare it with the agreement you actually use. Replace placeholder language with your real wording.", lookFor: "The contract reflects your actual business terms and does not contain generic sample text.", dontDo: "Do not assume a starter contract is legally appropriate for your venue. Use your own approved language and have legal counsel review it when appropriate." },
      { number: 3, title: "Build the questions you actually ask", doThis: "Create or customize your questionnaire templates using the questions you repeatedly ask couples.", lookFor: "The questions are useful, understandable, and do not ask for information you already collect somewhere else." },
      { number: 4, title: "Create your common messages", doThis: "Turn your most repetitive client messages into templates: inquiry follow-up, tour follow-up, booking confirmation, payment reminders, planning reminders, and other messages you send repeatedly.", lookFor: "A team member could select the template and still make the message feel personal." },
      { number: 5, title: "Build your planning guide", doThis: "Use your existing checklist/timeline to create the planning guide or playbook you want couples to follow.", lookFor: "The sequence reflects how you actually take a couple from booking to event day." },
      { number: 6, title: "Keep source files until you're confident", doThis: "If you uploaded old contracts, checklists, or wording during setup, keep the originals until the Hello to Cheers versions are reviewed and ready.", lookFor: "You know which version is the official reusable version." },
    ],
    completion: "Your client experience has a usable starting set of templates and planning content. You can improve individual pieces without rebuilding the whole system.",
    troubleshooting: ["If you have too many old versions, choose one current source of truth before creating more templates.", "If a template feels stiff, write it as you would speak to a real couple and then add the operational details."],
    relatedFeatures: [{ label: "Open Library", href: "/library" }],
    returnHref: "/library",
    returnLabel: "Open Library",
  }),
  guide({
    slug: "setup-lead-capture",
    title: "Set up how your leads come into Hello to Cheers",
    shortTitle: "Get Your Leads Coming In",
    intro: "Choose how new inquiries reach Hello to Cheers and make sure the path works before you rely on it.",
    time: "10–30 minutes per channel",
    prerequisites: ["Access to the website or inbox where inquiries currently arrive", "Admin access to any connected lead source", "One test inquiry you can use to confirm the setup"],
    whyItMatters: "A lead that never reaches your workspace is a couple you may never follow up with. The goal is not just to configure a form — it is to prove the lead arrives.",
    steps: [
      { number: 1, title: "Open Lead Capture", doThis: "Go to Setup → Get Your Leads Coming In. Review the available ways inquiries can reach you.", lookFor: "You should see the channels supported by your current Hello to Cheers setup." },
      { number: 2, title: "Choose your primary inquiry source", doThis: "Start with the source that produces the most important inquiries for your venue — usually your website or your main lead channel.", lookFor: "You have one clear primary path rather than several half-configured paths.", dontDo: "Do not configure every possible channel tonight. Get one important path working first." },
      { number: 3, title: "Connect or configure the source", doThis: "Follow the setup instructions for the selected channel. If the channel requires access to another service, make sure you are using the venue's account rather than a personal account.", lookFor: "Hello to Cheers shows the channel as configured and gives you a clear next step if anything is missing." },
      { number: 4, title: "Send a real test inquiry", doThis: "Use the actual source to submit a test inquiry with a name and email you can recognize. Do not just look for a green configuration badge.", lookFor: "The test inquiry appears as a Lead in Hello to Cheers with the expected source and contact information.", tip: "This is the real finish line. Configuration without a test is not proof that the lead path works." },
      { number: 5, title: "Add the other channels", doThis: "Once the primary path works, return and configure other important sources such as additional website forms, forwarding paths, or supported lead platforms.", lookFor: "Each source has a clear status and, where possible, a tested lead path." },
      { number: 6, title: "Know your fallback", doThis: "If you have a source that cannot be automated, use the manual-entry option and decide who will add those inquiries and how quickly.", lookFor: "No inquiry source is left in a vague 'we'll figure it out' state." },
    ],
    completion: "You have at least one tested path for new inquiries to reach Hello to Cheers, plus a clear plan for any sources you have not automated yet.",
    troubleshooting: ["If a test inquiry does not arrive, do not keep submitting duplicates. Check the source configuration and then inspect the lead-capture status.", "If the lead arrives without the expected source or fields, capture that example before changing configuration so the problem can be diagnosed accurately."],
    relatedFeatures: [{ label: "Open Lead Capture Setup", href: "/setup-hub/lead-capture" }],
    returnHref: "/setup-hub/lead-capture",
    returnLabel: "Open Lead Capture",
  }),
  guide({
    slug: "setup-your-team",
    title: "Set up your team and permissions",
    shortTitle: "Your People",
    intro: "Give the people who work with you their own access so you do not have to share your login.",
    time: "5–15 minutes per team member",
    prerequisites: ["The names and email addresses of the people who need access", "A simple idea of what each person should be able to do"],
    whyItMatters: "Separate logins make it easier to know who did what and let you give people access without handing over your owner account.",
    steps: [
      { number: 1, title: "Open Team Settings", doThis: "Go to Settings → Team.", lookFor: "You should see yourself as the owner and any existing team members." },
      { number: 2, title: "Invite one person at a time", doThis: "Choose Invite Team Member and enter the person's name and email address.", lookFor: "The invitation shows the correct email address before you send it.", dontDo: "Do not use a shared inbox as a team member's personal login if you need to know which person performed an action." },
      { number: 3, title: "Choose the right role", doThis: "Select the role that matches what the person actually needs to do. Give the least access necessary for their job.", lookFor: "The role description makes sense for the person's responsibilities.", tip: "You can change permissions later. When in doubt, start narrower and expand access when there is a real need." },
      { number: 4, title: "Send the invitation", doThis: "Send the invitation and tell the person to use their own email to accept it.", lookFor: "The member appears as invited/pending until they accept." },
      { number: 5, title: "Have them complete their own login", doThis: "Ask the team member to accept the invitation and finish their account setup.", lookFor: "Their status changes from invited/pending to active/accepted." },
      { number: 6, title: "If you're working solo", doThis: "If no one else needs access right now, choose the 'It's just me for now' option in Setup rather than inviting a fake team member.", lookFor: "Setup records that you are intentionally running the venue solo for now." },
    ],
    completion: "Everyone who needs access has their own appropriate login — or you have deliberately confirmed that you are working solo.",
    troubleshooting: ["If an invitation never arrives, verify the email address and have the person check spam/junk before sending repeated invitations.", "If someone needs more or less access later, update their role rather than sharing another person's login."],
    relatedFeatures: [{ label: "Open Team Settings", href: "/settings/team" }],
    returnHref: "/settings/team",
    returnLabel: "Open Team Settings",
  }),
  guide({
    slug: "setup-financials",
    title: "Connect payments and accounting",
    shortTitle: "Financials",
    intro: "Connect Stripe for online payments and QuickBooks for accounting when you are ready. These are helpful, but you do not need them before you begin using Hello to Cheers.",
    time: "About 5–10 minutes per integration",
    prerequisites: ["For Stripe: access to the venue's Stripe account", "For QuickBooks: access to the venue's QuickBooks Online company", "The ability to authorize each connection when the provider opens"],
    whyItMatters: "Connected financial tools reduce duplicate entry and let payment/accounting activity stay connected to the event work happening in Hello to Cheers.",
    steps: [
      { number: 1, title: "Open Financials & Integrations", doThis: "Go to Settings → Financials & Integrations. Start with the integration you want to connect first.", lookFor: "You should see separate cards for Stripe and QuickBooks Online." },
      { number: 2, title: "Connect Stripe", doThis: "Choose Connect Stripe and follow the Stripe authorization flow. Sign in to the venue's Stripe account and approve the connection.", lookFor: "You return to Hello to Cheers and Stripe shows Connected.", dontDo: "Do not paste Stripe secret keys into the venue connection flow. You should authorize the account through Stripe." },
      { number: 3, title: "Connect QuickBooks", doThis: "Choose Connect QuickBooks and sign in to Intuit. If Intuit asks which company to connect, choose the venue's correct QuickBooks Online company and authorize it.", lookFor: "You return to Hello to Cheers and see Connected plus the correct QuickBooks company name.", dontDo: "Do not choose an unrelated company just because it is the first one shown. The selected company becomes the accounting connection for this venue." },
      { number: 4, title: "Verify, don't just authorize", doThis: "Read the integration cards after returning from each provider. If the provider says connected but Hello to Cheers does not, stop and check the integration status before trying again.", lookFor: "Both systems you chose show a clear Connected state in Hello to Cheers." },
      { number: 5, title: "Leave optional connections for later if you prefer", doThis: "If you are not ready for online payments or accounting sync, leave them disconnected and continue setup. Return here whenever you are ready.", lookFor: "There is no setup blocker just because Stripe or QuickBooks is not connected." },
    ],
    completion: "Your chosen financial connections are authorized and visibly connected in Hello to Cheers — or you have deliberately left them for later.",
    troubleshooting: ["If Stripe or QuickBooks sends you to an error page, return to Hello to Cheers first and check whether the connection actually completed before reconnecting.", "If QuickBooks shows the wrong company name, disconnect and reconnect using the correct Intuit account/company."],
    relatedFeatures: [{ label: "Open Financials & Integrations", href: "/settings/integrations" }, { label: "Stripe setup guide", href: "/help/connect-stripe" }, { label: "QuickBooks setup guide", href: "/help/connect-quickbooks" }],
    returnHref: "/setup-hub/financials",
    returnLabel: "Open Financials",
  }),
  guide({
    slug: "connect-stripe",
    title: "Connect Stripe for online payments",
    shortTitle: "Connect Stripe",
    intro: "Connect your venue's Stripe account so couples can pay deposits and invoices through your connected payment account.",
    time: "About 5 minutes",
    prerequisites: ["A Stripe account for your venue", "Permission to connect that Stripe account", "Your Stripe login"],
    whyItMatters: "A connected Stripe account lets Hello to Cheers direct online payment activity to the venue's payment account without asking you to manually copy payment details.",
    steps: [
      { number: 1, title: "Start in Hello to Cheers", doThis: "Go to Settings → Financials & Integrations and click Connect Stripe.", lookFor: "Stripe opens an authorization screen for the Hello to Cheers connection.", dontDo: "Do not paste a Stripe secret key into Hello to Cheers. This connection uses authorization, not a developer-key form." },
      { number: 2, title: "Sign in to the venue's Stripe account", doThis: "Sign in with the Stripe account that belongs to your venue.", lookFor: "Stripe shows the business/account you are about to connect.", dontDo: "Do not connect a personal or unrelated Stripe account." },
      { number: 3, title: "Review and authorize", doThis: "Review the connection and approve it.", lookFor: "Stripe sends you back to Hello to Cheers after authorization." },
      { number: 4, title: "Confirm Connected", doThis: "Return to Settings → Financials & Integrations and look at the Stripe card.", lookFor: "The card says Connected. That is your finish line.", tip: "If the card says Connected, there is nothing else for you to copy or configure." },
    ],
    completion: "Stripe is connected to your venue and ready for the online payment features that use it.",
    troubleshooting: ["If you land on an error page, return to Hello to Cheers and check the card before reconnecting.", "If the wrong account was connected, disconnect and repeat the flow with the correct Stripe login."],
    relatedFeatures: [{ label: "Open Financials & Integrations", href: "/settings/integrations#stripe" }],
    returnHref: "/settings/integrations#stripe",
    returnLabel: "Open Stripe Settings",
  }),
  guide({
    slug: "connect-quickbooks",
    title: "Connect QuickBooks Online",
    shortTitle: "Connect QuickBooks",
    intro: "Connect your venue's QuickBooks Online company so accounting activity can stay connected to the financial work in Hello to Cheers.",
    time: "About 5 minutes",
    prerequisites: ["A QuickBooks Online company for your venue", "Permission to connect that company", "Your Intuit/QuickBooks login"],
    whyItMatters: "Connecting the correct QuickBooks company reduces duplicate data entry and keeps accounting activity tied to the right venue.",
    steps: [
      { number: 1, title: "Start in Hello to Cheers", doThis: "Go to Settings → Financials & Integrations and click Connect QuickBooks.", lookFor: "An Intuit/QuickBooks authorization page opens." },
      { number: 2, title: "Sign in to Intuit", doThis: "Sign in with the Intuit account that has access to the venue's QuickBooks company.", lookFor: "Intuit shows the company/account you can authorize." },
      { number: 3, title: "Choose the correct company", doThis: "If Intuit asks which company to connect, choose the venue's actual QuickBooks Online company.", lookFor: "The company name matches the venue you are setting up.", dontDo: "Do not choose an old, unrelated, or test company unless you are intentionally testing." },
      { number: 4, title: "Approve the connection", doThis: "Review the requested access and authorize the connection.", lookFor: "You return to Hello to Cheers." },
      { number: 5, title: "Confirm the company name", doThis: "Look at the QuickBooks card in Settings → Financials & Integrations.", lookFor: "It says Connected and displays the QuickBooks company you selected.", tip: "Seeing the correct company name is the best confirmation that you connected the right company." },
    ],
    completion: "QuickBooks Online is connected to the correct company for your venue.",
    troubleshooting: ["If Intuit reports a permissions problem, have the person who manages the QuickBooks company complete the connection.", "If the wrong company appears after connecting, disconnect and repeat the authorization with the correct Intuit account."],
    relatedFeatures: [{ label: "Open Financials & Integrations", href: "/settings/integrations#quickbooks" }],
    returnHref: "/settings/integrations#quickbooks",
    returnLabel: "Open QuickBooks Settings",
  }),
  guide({
    slug: "connect-facebook-instagram-lead-ads",
    title: "Connect Facebook & Instagram Lead Ads",
    shortTitle: "Connect Facebook & Instagram",
    intro: "Connect the Meta/Facebook Page that manages your Lead Ads, then choose at least one Lead Ads form so new submissions can become Leads in Hello to Cheers.",
    time: "About 10 minutes",
    prerequisites: ["A Facebook account that manages your venue's Facebook Page", "The venue's Facebook Page", "Access to the Meta business assets associated with that Page", "If you advertise on Instagram, an Instagram account associated with the same Meta/Page setup"],
    whyItMatters: "This connection can bring advertising inquiries into your lead workflow automatically. A Page connection alone is not enough — at least one Lead Ads form must be enabled.",
    steps: [
      { number: 1, title: "Start in Hello to Cheers", doThis: "Go to Settings → Financials & Integrations and choose Connect with Facebook in the Facebook / Instagram Lead Ads card.", lookFor: "Meta opens a connection flow asking which business assets Hello to Cheers can access." },
      { number: 2, title: "Choose your existing Business Portfolio", doThis: "When Meta asks for a Business Portfolio, choose the existing business that owns or manages your venue's Page.", lookFor: "Your existing business appears as an option.", dontDo: "Do not create a new Business Portfolio just because Meta offers that option. Use the venue's existing business assets whenever possible." },
      { number: 3, title: "Select your venue's Facebook Page", doThis: "Select the Facebook Page that represents your venue.", lookFor: "The Page name matches your venue.", dontDo: "Do not select a personal profile, an old Page, or a different business's Page." },
      { number: 4, title: "Review and approve Meta permissions", doThis: "Review what Hello to Cheers is being allowed to access, then continue with the connection.", lookFor: "The permissions include the Page/lead-related access needed for the Lead Ads connection." },
      { number: 5, title: "Return to Hello to Cheers and select the Page", doThis: "When Meta returns you to Hello to Cheers, select your venue's Page in the Page picker.", lookFor: "The selected Page appears in the connection card and the app completes the Page-level leadgen subscription.", tip: "You do not need to manually configure a webhook in Meta. Hello to Cheers establishes the Page-level Lead Ads subscription as part of this step." },
      { number: 6, title: "Choose your Lead Ads forms — this step is required", doThis: "Move to Step 2 of 2 and select the Lead Ads forms you want to send into Hello to Cheers. Then choose Connect selected forms.", lookFor: "Your chosen forms appear under Connected forms and are enabled.", dontDo: "Do not stop after selecting the Page. A Page can be connected while zero forms are enabled. In that state, Lead Ads submissions will not arrive in Hello to Cheers." },
      { number: 7, title: "If no forms are available, stop and create one in Meta", doThis: "If Hello to Cheers says no Lead Ads forms were found, create a real Lead Ads form for the selected Page in Meta Ads Manager, then return here and refresh/reconnect as instructed.", lookFor: "The new form appears in the form picker.", dontDo: "Do not assume a normal Facebook contact form or a post is a Lead Ads form. Hello to Cheers needs a Meta Lead Ads form." },
      { number: 8, title: "Instagram does not need a separate Hello to Cheers connection", doThis: "If your Lead Ad uses Instagram placements, keep the venue's Instagram account associated with the same Meta business/Page setup. You do not connect Instagram separately inside Hello to Cheers.", lookFor: "Hello to Cheers continues to show one Facebook / Instagram Lead Ads connection with your Page and enabled forms.", dontDo: "Do not look for a separate Instagram API key or a second Instagram Connect button." },
      { number: 9, title: "Confirm the connection is actually ready", doThis: "Return to the integration card and check both the Page and Connected forms sections.", lookFor: "You should see Connected, your Page, and at least one enabled form. That combination means the integration is ready for new leads.", dontDo: "Do not treat a green Connected badge by itself as proof of Lead Ads readiness if no connected forms are shown." },
      { number: 10, title: "Test a real lead", doThis: "Submit a test Lead Ad and confirm the resulting lead appears in Hello to Cheers. If you advertise on Instagram, include an Instagram-placement test in your acceptance testing.", lookFor: "The new lead appears with the expected source and contact information.", tip: "The real finish line is a lead arriving — not merely a successful Meta authorization." },
    ],
    completion: "Facebook / Instagram Lead Ads are ready when your Page is connected AND at least one Lead Ads form is enabled. New submissions from those forms can then flow into Hello to Cheers.",
    troubleshooting: ["If your Page is missing, confirm that the Facebook account you used actually manages that Page and that you selected the correct Business Portfolio.", "If the Page is connected but no forms are shown, the setup is incomplete. Create a Meta Lead Ads form and return to the form-selection step.", "If a form exists in Meta but does not appear, confirm it belongs to the selected Page and then refresh/reconnect according to the on-screen instructions.", "If an Instagram-placement lead does not arrive, first confirm the Instagram account and Lead Ad are using the same Meta business/Page/form setup. Do not assume the problem is the Hello to Cheers connection until that is checked."],
    relatedFeatures: [{ label: "Open Facebook / Instagram Settings", href: "/settings/integrations#facebook" }],
    returnHref: "/settings/integrations#facebook",
    returnLabel: "Open Facebook / Instagram Settings",
  }),
] as const;

export const INTEGRATION_SETUP_GUIDES = SETUP_GUIDES.filter((g) => g.slug.startsWith("connect-"));

export function getSetupGuide(slug: string): SetupGuide | null {
  return SETUP_GUIDES.find((g) => g.slug === slug) ?? null;
}

export function getIntegrationSetupGuide(slug: string): SetupGuide | null {
  return INTEGRATION_SETUP_GUIDES.find((g) => g.slug === slug) ?? null;
}
