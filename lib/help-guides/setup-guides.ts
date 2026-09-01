import type { RelatedFeatureLink } from "@/lib/success-library/types";

export type SetupGuideStep = {
  number: number;
  title: string;
  doThis: string;
  lookFor: string;
  dontDo?: string;
  tip?: string;
  /** Optional DOM anchor id (e.g. "stripe") so another page can deep-link straight to this step. */
  anchor?: string;
};

export type SetupGuide = {
  slug: string;
  title: string;
  shortTitle: string;
  category: "Your Venue" | "Getting Started";
  intro: string;
  time: string;
  prerequisites: string[];
  /** Heading shown above prerequisites. Defaults to "What you should have to begin" when omitted. */
  prerequisitesHeading?: string;
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
    prerequisitesHeading: "Things you'll need to know to begin",
    whyItMatters: "These settings help prevent double-booking and make availability and tour scheduling reflect how your venue actually operates.",
    steps: [
      { number: 1, title: "Open Calendar & Availability", doThis: "Go to Setup → Calendar & Availability or Settings → Availability.", lookFor: "You should see three sections, in this order: Weekly Availability & Blocked Dates, Scheduling Capacity, and Event Spaces." },
      { number: 2, title: "Decide whether to offer online tours", doThis: "Under Weekly Availability & Blocked Dates, turn on tour scheduling if you want couples to book tours themselves, then set the days and hours you actually offer tours. Block off any specific dates you know you'll be unavailable. If you do not want online booking, leave tour scheduling off.", lookFor: "The setting clearly matches your business decision, and — if tours are on — your available hours reflect when you can actually host one.", dontDo: "Do not turn online tour booking on just to make setup look complete. Off is a valid choice." },
      { number: 3, title: "Set your capacity rules", doThis: "Under Scheduling Capacity, tell Hello to Cheers how many events you can host at once and any meaningful capacity restrictions.", lookFor: "The setting reflects your real operating limit rather than a theoretical maximum.", tip: "If you only host one wedding at a time, say one. Simple is better than complicated rules you do not maintain." },
      { number: 4, title: "Add each event space", doThis: "Under Event Spaces, add every space that should be treated as a distinct venue space. Use the name your team actually uses.", lookFor: "Each space has a clear name and you can tell the spaces apart.", dontDo: "Do not create five copies of one room just because it can be configured five ways. Use the space structure that reflects how you actually book it." },
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
    intro: "Set up every way a new inquiry can reach you — your website form, online tour booking, and other sources like Facebook/Instagram and QR codes — one at a time, in the order they appear on your Lead Capture page. Skip any section that doesn't apply to your venue.",
    time: "10–30 minutes per channel",
    prerequisites: ["Access to the website or page editor where your inquiry form will go", "Admin access to any connected lead source, such as your venue's Facebook account", "One test inquiry per channel you can use to confirm the setup"],
    whyItMatters: "A lead that never reaches your workspace is a couple you may never follow up with. The goal for every channel below is not just to configure it — it is to prove a real inquiry arrives.",
    steps: [
      { number: 1, title: "Open Lead Capture", doThis: "Go to Setup → Get Your Leads Coming In. This guide walks through each section on that page in the same order it appears — Website Form, Tour Booking, Other Sources, and Verify It Works. You do not need to set up every channel today.", lookFor: "You should see those four sections on the page." },

      { number: 2, title: "Website Form: copy your embed code", doThis: "Under Website Form, copy the embed code Hello to Cheers gives you. This is a short snippet of code — you don't need to understand it, only copy it exactly and paste it where instructed below.", lookFor: "You have the embed code copied and ready to paste into your website." },
      { number: 3, title: "Website Form: add it in Squarespace", doThis: "Open the page in Squarespace where you want the form to appear, click Edit, then click the + where the form should go. Choose Code from the block options, paste the embed code you copied, then click Save.", lookFor: "The inquiry form appears on the live page when you view it.", dontDo: "Do not choose a block type other than Code — a text block will show the raw code as text instead of displaying your form." },
      { number: 4, title: "Website Form: add it in Wix", doThis: "Edit your site, choose Add, then Embed, then Custom Embed. Paste the embed code into the box provided, then click Publish.", lookFor: "The inquiry form appears on the live page after publishing.", dontDo: "Do not skip publishing — a saved-but-unpublished change won't appear on your live site." },
      { number: 5, title: "Website Form: add it in WordPress", doThis: "Edit the page where you want the form, add a Custom HTML block, paste the embed code into it, then click Update or Publish.", lookFor: "The inquiry form appears on the live page after updating/publishing.", dontDo: "Do not paste the code into a regular paragraph block — it needs to be a Custom HTML block or the code will display as text." },
      { number: 6, title: "Website Form: using a different website builder", doThis: "If your builder isn't listed above, look in your page editor for a block or option often called Embed, Custom HTML, or Code Block. Open your page, add that block, paste the embed code, then save or publish the page.", lookFor: "The inquiry form appears on the live page.", dontDo: "Do not paste the code into a plain text or paragraph block — it needs a block specifically meant for code or embeds.", tip: "If you can't find the right option, search your builder's name plus \"embed code\" or \"custom HTML\" — nearly every builder supports this in some form." },
      { number: 7, title: "Website Form: send a real test inquiry", doThis: "Open the live page with your embedded form and submit a real test inquiry using a name and email you'll recognize. Don't stop at confirming the form displays — confirm it actually delivers.", lookFor: "The test inquiry appears as a new Lead in Hello to Cheers with the expected name and source.", tip: "This is the real finish line for this channel. A form that displays but doesn't deliver a lead is not done." },

      { number: 8, title: "Tour Booking: turn on and configure", doThis: "Under Tour Booking, turn on online tour scheduling if you want couples to book tours themselves. Your available hours come from what you set up in Calendar & Availability — set that up first if you haven't already.", lookFor: "Tour booking shows as on, backed by your real, current availability.", dontDo: "Do not turn this on before your tour availability is set up correctly — otherwise couples may be able to book a time you can't actually host." },
      { number: 9, title: "Tour Booking: send a real test booking", doThis: "Use your own public tour booking link to book a real test tour, using a name and email you'll recognize.", lookFor: "The test tour appears in Hello to Cheers as a scheduled tour, and a matching Lead is created with the expected information." },

      { number: 10, title: "Other Sources: QR code campaigns", doThis: "Under Other Sources, create a QR code campaign if you want a scannable code for print materials, bridal shows, or signage. Give each campaign a name that tells you exactly where it will be used.", lookFor: "You have a downloadable QR code linked to a named campaign.", tip: "Create a separate campaign for each place you'll use a code — a brochure and a bridal-show sign, for example — so you can see afterward which one actually produced leads." },
      { number: 11, title: "Other Sources: connect Facebook & Instagram Lead Ads", doThis: "If you run Facebook or Instagram Lead Ads, click Connect with Facebook in the Facebook / Instagram Lead Ads card. Meta will open a connection flow asking which business assets Hello to Cheers can access.", lookFor: "Meta opens a connection flow asking which business assets Hello to Cheers can access.", anchor: "facebook" },
      { number: 12, title: "Other Sources: choose your Business Portfolio and Page", doThis: "When Meta asks for a Business Portfolio, choose the existing business that owns or manages your venue's Facebook Page — then select the Facebook Page that represents your venue.", lookFor: "Your existing business appears as an option, and the Page name you select matches your venue.", dontDo: "Do not create a new Business Portfolio just because Meta offers that option, and do not select a personal profile, an old Page, or a different business's Page." },
      { number: 13, title: "Other Sources: review permissions, then select the Page in Hello to Cheers", doThis: "Review what Hello to Cheers is being allowed to access and continue. When Meta returns you to Hello to Cheers, select your venue's Page in the Page picker.", lookFor: "The selected Page appears in the connection card.", tip: "You do not need to manually configure a webhook in Meta. Hello to Cheers sets up the Page-level subscription as part of this step." },
      { number: 14, title: "Other Sources: choose your Lead Ads forms — this step is required", doThis: "Move to Step 2 of 2 and select the Lead Ads forms you want to send into Hello to Cheers, then choose Connect selected forms. If Hello to Cheers says no Lead Ads forms were found, create a real Lead Ads form for the selected Page in Meta Ads Manager, then return here and refresh/reconnect.", lookFor: "Your chosen forms appear under Connected forms and are enabled.", dontDo: "Do not stop after selecting the Page. A Page can show as connected while zero forms are enabled — in that state, Lead Ads submissions will not arrive in Hello to Cheers, even though the connection looks complete. Do not assume a normal Facebook contact form or a post is a Lead Ads form — Hello to Cheers needs a real Meta Lead Ads form." },
      { number: 15, title: "Other Sources: Instagram uses the same connection", doThis: "If your Lead Ad uses Instagram placements, keep the venue's Instagram account associated with the same Meta business/Page setup. Do not connect Instagram separately — Hello to Cheers continues to show one Facebook / Instagram Lead Ads connection with your Page and enabled forms.", lookFor: "Hello to Cheers shows one Facebook / Instagram Lead Ads connection with your Page and enabled forms.", dontDo: "Do not look for a separate Instagram API key or a second Instagram Connect button — it doesn't exist." },
      { number: 16, title: "Other Sources: test a real Facebook/Instagram lead", doThis: "Submit a test Lead Ad and confirm the resulting lead appears in Hello to Cheers. If you advertise on Instagram, include an Instagram-placement test too.", lookFor: "Both the Page and Connected forms sections show as ready, and the new lead appears with the expected source and contact information.", dontDo: "Do not treat a green Connected badge by itself as proof this is working — if the Page is connected but no forms are shown, the setup is incomplete." },
      { number: 17, title: "Other Sources: know your fallback for anything you can't automate", doThis: "If you have a lead source that can't be connected automatically — a phone inquiry, a referral, a walk-in — use manual entry and decide who's responsible for adding those and how quickly.", lookFor: "No inquiry source is left in a vague 'we'll figure it out' state." },

      { number: 18, title: "Verify It Works: confirm every channel is actually healthy", doThis: "Open Verify It Works and review the status of every channel you configured — this checks that each one has been receiving leads recently, not just that it was set up correctly once.", lookFor: "Every channel you're relying on shows a healthy status, with a real, recent test or real lead behind it.", tip: "The real finish line for this whole guide is a lead arriving through every channel you turned on — not a page full of green checkmarks you configured once and never tested." },
    ],
    completion: "You have at least one tested path for new inquiries to reach Hello to Cheers for every channel you turned on, plus a clear plan for any sources you're handling manually.",
    troubleshooting: ["If a test inquiry does not arrive, do not keep submitting duplicates. Check the source configuration first, then inspect the channel's status in Verify It Works.", "If the lead arrives without the expected source or fields, capture that example before changing configuration so the problem can be diagnosed accurately.", "If your Facebook Page is missing from the picker, confirm the Facebook account you used actually manages that Page and that you selected the correct Business Portfolio.", "If a Facebook/Instagram lead doesn't arrive, first confirm the Page shows Connected AND at least one form shows Connected — a Page-only connection will never deliver leads."],
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
    prerequisitesHeading: "Things you'll need to know to begin",
    whyItMatters: "Separate logins make it easier to know who did what and let you give people access without handing over your owner account.",
    steps: [
      { number: 1, title: "Open Team Settings", doThis: "Go to Settings → Team.", lookFor: "You should see yourself as the owner and any existing team members." },
      { number: 2, title: "Invite one person at a time", doThis: "Choose Invite Team Member and enter the person's name and email address.", lookFor: "The invitation shows the correct email address before you send it.", dontDo: "Do not use a shared inbox as a team member's personal login if you need to know which person performed an action." },
      { number: 3, title: "Understand what each role can do", doThis: "There are four roles. Owner has full access to everything, including refunds, billing, integrations, deleting the venue, and managing Manager-level accounts — there's only one Owner, and it isn't assigned through this invite flow. Manager has full day-to-day access plus financial edit rights, but cannot issue refunds and cannot touch billing, subscriptions, or integrations. Coordinator can create and edit events, tasks, timelines, and vendor assignments, and can see full financial status and create contracts/invoices, but cannot delete or refund anything. Staff can view assigned work and mark it complete — checking off tasks, checking in vendors — but cannot see financial information or create, edit, or delete core records.", lookFor: "You can describe, in one sentence, what the person you're inviting actually needs to do — and which of the four roles matches that.", tip: "When in doubt, Coordinator is the right choice for anyone doing day-to-day event work. Staff is right for someone who only needs to complete assigned tasks. Manager is for someone who needs to run the business alongside you." },
      { number: 4, title: "Choose the right role", doThis: "Select the role from Step 3 that matches what the person actually needs to do. Give the least access necessary for their job.", lookFor: "The role you selected matches the person's real responsibilities, not just their job title.", tip: "You can change a person's role later. When in doubt, start narrower and expand access when there is a real need." },
      { number: 5, title: "Send the invitation", doThis: "Send the invitation and tell the person to use their own email to accept it.", lookFor: "The member appears as invited/pending until they accept." },
      { number: 6, title: "Have them complete their own login", doThis: "Ask the team member to accept the invitation and finish their account setup.", lookFor: "Their status changes from invited/pending to active/accepted." },
      { number: 7, title: "If you're working solo", doThis: "If no one else needs access right now, choose the 'It's just me for now' option in Setup rather than inviting a fake team member.", lookFor: "Setup records that you are intentionally running the venue solo for now." },
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
    time: "About 10–15 minutes per integration",
    prerequisites: ["For Stripe: access to the venue's Stripe account, or the ability to create one", "For QuickBooks: access to the venue's QuickBooks Online company", "The ability to authorize each connection when the provider opens"],
    whyItMatters: "Connected financial tools reduce duplicate entry and let payment/accounting activity stay connected to the event work happening in Hello to Cheers.",
    steps: [
      { number: 1, title: "Open Financials & Integrations", doThis: "Go to Settings → Financials & Integrations. You'll see separate cards for Stripe and QuickBooks Online — you can connect one, both, or neither today.", lookFor: "You should see a Stripe card and a QuickBooks Online card, each showing Not Connected." },
      { number: 2, title: "Connect Stripe: start the connection", doThis: "In the Stripe card, click Connect Stripe. This opens Stripe's own authorization screen — you are leaving Hello to Cheers briefly, then returning after you approve the connection.", lookFor: "Stripe opens an authorization screen for the Hello to Cheers connection.", dontDo: "Do not paste a Stripe secret key or API key anywhere in Hello to Cheers. This connection works entirely through Stripe's own authorization screen — you never need to copy a key.", anchor: "stripe" },
      { number: 3, title: "Connect Stripe: sign in to the venue's account", doThis: "If you already have a Stripe account for your venue, sign in to it. If you don't have one yet, Stripe will walk you through creating one — use the venue's real legal business name and address, not a personal one.", lookFor: "Stripe shows the business/account you are about to connect, and the name matches your venue.", dontDo: "Do not sign in to or create a personal Stripe account. This needs to be the venue's own business account." },
      { number: 4, title: "Connect Stripe: choose the correct business type — read this carefully", doThis: "Stripe will ask you to describe your business and select a business type or industry category. Describe your business as an event venue or event space rental business. If Stripe shows you a list of industries or categories, search for terms like \"event,\" \"venue,\" or \"wedding\" rather than browsing — and do not select anything with \"bar,\" \"lounge,\" \"nightclub,\" or \"tavern\" in the name, even though you may serve alcohol at events.", lookFor: "The category or description you selected reflects that your business rents out event space — not that it operates a bar or nightclub.", dontDo: "Do not select a bar, nightclub, lounge, or drinking-establishment category just because alcohol is served at your events. That classification is meant for businesses whose primary business is selling alcohol, and it comes with materially more scrutiny and higher dispute/chargeback risk — selecting it for a venue can create exactly the kind of processing headaches and account reviews some venues have run into with other platforms.", tip: "If nothing listed matches exactly, choose the closest match to \"event planning\" or \"event venue\" (or \"Other\" with an accurate written description) rather than guessing at something alcohol-related. If you're ever unsure what's currently on screen, stop and ask before selecting — this is the one Stripe screen worth double-checking." },
      { number: 5, title: "Connect Stripe: review and authorize", doThis: "Review the connection details Stripe shows you and approve it.", lookFor: "Stripe sends you back to Hello to Cheers after authorization." },
      { number: 6, title: "Connect Stripe: confirm Connected", doThis: "Back in Settings → Financials & Integrations, look at the Stripe card.", lookFor: "The card says Connected. That is your finish line for Stripe — there is nothing else to copy or configure.", tip: "If the card still says Not Connected after you return from Stripe, don't reconnect immediately — refresh the page first. Sometimes the status just needs a moment to update." },
      { number: 7, title: "Connect QuickBooks: start the connection", doThis: "In the QuickBooks card, click Connect QuickBooks. This opens an Intuit sign-in page.", lookFor: "An Intuit/QuickBooks authorization page opens.", anchor: "quickbooks" },
      { number: 8, title: "Connect QuickBooks: sign in and choose the correct company", doThis: "Sign in with the Intuit account that has access to the venue's QuickBooks company. If Intuit asks which company to connect — this happens if your Intuit login has access to more than one — choose the venue's actual QuickBooks Online company.", lookFor: "The company name Intuit shows matches your venue, not an old, personal, or unrelated business.", dontDo: "Do not pick the first company shown just because it's first. The company you select becomes the one accounting connection for this venue, and every synced payment/invoice goes there." },
      { number: 9, title: "Connect QuickBooks: approve the connection", doThis: "Review the access QuickBooks is requesting and authorize it.", lookFor: "You return to Hello to Cheers after approving." },
      { number: 10, title: "Connect QuickBooks: confirm the company name", doThis: "Look at the QuickBooks card in Settings → Financials & Integrations.", lookFor: "It says Connected and displays the exact QuickBooks company name you selected.", tip: "Seeing the correct company name — not just the word \"Connected\" — is the real confirmation you connected the right company." },
      { number: 11, title: "Verify both, don't just authorize", doThis: "Read each card you connected one more time. If a provider told you the connection succeeded but Hello to Cheers still shows Not Connected, stop and check the card before trying to reconnect — reconnecting on top of a stuck connection can create a duplicate.", lookFor: "Every integration you chose to connect shows a clear Connected state, with the right account/company name, inside Hello to Cheers itself — not just on Stripe's or Intuit's own site." },
      { number: 12, title: "Leave optional connections for later if you prefer", doThis: "If you are not ready for online payments or accounting sync, leave them disconnected and continue setup. Return here whenever you are ready — nothing else in Hello to Cheers requires these to be connected.", lookFor: "There is no setup blocker just because Stripe or QuickBooks is not connected." },
    ],
    completion: "Your chosen financial connections are authorized and visibly connected in Hello to Cheers, with the correct business type and company selected — or you have deliberately left them for later.",
    troubleshooting: ["If Stripe or QuickBooks sends you to an error page, return to Hello to Cheers first and check whether the connection actually completed before reconnecting.", "If QuickBooks shows the wrong company name, disconnect and reconnect using the correct Intuit account/company.", "If you already connected Stripe under the wrong business type or category, don't just leave it — disconnect, reconnect, and correct it during the business-type step. It's worth fixing early rather than discovering it later as a processing issue."],
    relatedFeatures: [{ label: "Open Financials & Integrations", href: "/settings/integrations" }],
    returnHref: "/setup-hub/financials",
    returnLabel: "Open Financials",
  }),
] as const;

export const INTEGRATION_SETUP_GUIDES = SETUP_GUIDES.filter((g) => g.slug.startsWith("connect-"));

export function getSetupGuide(slug: string): SetupGuide | null {
  return SETUP_GUIDES.find((g) => g.slug === slug) ?? null;
}

export function getIntegrationSetupGuide(slug: string): SetupGuide | null {
  return INTEGRATION_SETUP_GUIDES.find((g) => g.slug === slug) ?? null;
}
