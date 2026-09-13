/**
 * Help & Guides — final published article set (editorial source of truth).
 * Bodies are exact customer-facing copy. Blocked articles must not publish
 * until Jennifer resolves the UI path mismatch.
 */

export type FinalHelpArticle = {
  slug: string;
  title: string;
  category: string;
  body: string;
  /** When set, article must not be published until product/content resolves it. */
  blocked?: {
    referencedCopy: string;
    existsInstead: string;
    where: string;
    appearsToBe: "content_mismatch" | "product_change";
  };
};

export const FINAL_HELP_CATEGORY_ORDER = [
  "Getting Started",
  "Your Venue",
  "Finding & Booking Clients",
  "Working With Clients",
  "Contracts & Payments",
  "Building the Event",
  "Planning the Event",
  "Vendors",
  "Event Day",
  "Reports",
  "After the Event",
] as const;

export const HELP_GUIDES_LANDING_TAGLINE =
  "Quick answers for using Hello to Cheers. Find a guide for what you're working on, or start with Getting Started if you're new here.";

export const FINAL_HELP_ARTICLES: readonly FinalHelpArticle[] = [
  {
    slug: "getting-started-your-first-morning",
    title: "Getting Started: Your First Morning",
    category: "Getting Started",
    body: `Welcome to Hello to Cheers.

You don't need to set up everything before you can start working.

Start with two things: your venue information and your Leads. Hello to Cheers already gives you sensible starting points for many of the things you'll build later. Once you're comfortable, you can customize the pieces that matter most to the way your venue works.

Start with:

**Your Venue → Settings**

Make sure your basic venue information is correct.

Then go to:

**Sales → Leads**

This is where you'll start working with inquiries and moving them through your sales process.

As you go, you can build out the things that make Hello to Cheers work more like your venue, including Packages, message templates, questionnaires, and planning templates.

The goal isn't to finish setup.

It's to get your venue ready to work. You can refine the rest as you go.`,
  },
  {
    slug: "what-should-i-set-up-before-i-start",
    title: "What Should I Set Up Before I Start?",
    category: "Getting Started",
    body: `You don't need a perfect setup before you start working in Hello to Cheers.

For most venues, start with three things:

**1. Your venue information**

Go to **Your Venue → Settings** and make sure your basic venue information is correct.

**2. Your basic offerings**

If you're ready to start creating bookings and invoices, make sure you have at least one Package set up.

**3. Your inquiry process**

Take a look at **Sales → Leads** and make sure your Pipeline makes sense for the way your venue handles new inquiries.

You can build message templates, questionnaires, planning templates, inventory, and other reusable pieces as you need them.

You don't need to finish everything on day one.

Hello to Cheers is designed so you can build on it as your venue works.`,
  },
  {
    slug: "where-do-my-venue-colors-actually-show-up",
    title: "Where Do My Venue Colors Actually Show Up?",
    category: "Your Venue",
    body: `Your venue colors are primarily used where your clients see your venue's brand.

That includes client-facing areas such as the Couple Portal, contracts, and certain client-facing or printable materials.

They are not intended to completely re-skin the venue-side Hello to Cheers workspace. Your team continues to work in the Hello to Cheers interface.

Your Hosted Wedding Website is also separate. Its visual style is controlled by the website's own design choices.

So if you save your venue colors and the dashboard doesn't suddenly change colors, that's expected.

Think of your venue branding as **the way Hello to Cheers presents your venue to your clients**, rather than a replacement for the Hello to Cheers workspace your team uses every day.`,
  },
  {
    slug: "how-do-i-set-my-tour-availability",
    title: "How Do I Set My Tour Availability?",
    category: "Your Venue",
    body: `Your venue's **Business Hours** and **Tour Availability** are two different things.

Business Hours tell Hello to Cheers when your venue generally operates.

Tour Availability tells Hello to Cheers when you are actually willing to offer tours.

Go to:

**Your Venue → Settings → Availability & Capacity**

There you can set the availability you want to offer for tours.

If your venue doesn't offer tours, you don't need to configure a tour schedule just because the setting exists.

Different venues handle tours differently. Your schedule should reflect the way your venue actually works.`,
  },
  {
    slug: "how-does-my-pipeline-work",
    title: "How Does My Pipeline Work?",
    category: "Finding & Booking Clients",
    body: `Your Pipeline shows where each Lead is in your sales process.

Go to:

**Sales → Leads → Pipeline**

Each Lead appears in the stage that represents where they are in the process.

Move a Lead from one stage to another as the relationship progresses.

Your Pipeline is about the **sales process** — where the relationship stands.

It isn't a task list.

If you need to remember to call someone, send a proposal, or follow up, that work belongs in **Task Center**.

If you're waiting for someone to respond or complete something, that's what **Requests** are for.

Your Pipeline answers one simple question:

**Where is this relationship in the sales process?**`,
  },
  {
    slug: "can-i-customize-my-pipeline-stages",
    title: "Can I Customize My Pipeline Stages?",
    category: "Finding & Booking Clients",
    body: `Yes.

Go to:

**Sales → Leads → Pipeline Templates**

You can customize the names and order of your Pipeline stages so they make sense for the way your venue sells.

There is an important distinction, though.

The name you show your team can be customized, but each stage still has an underlying meaning that Hello to Cheers uses for things such as reporting and Automations.

For example, you might call a stage something personal to your venue, but Hello to Cheers still needs to understand whether that stage represents something like a new inquiry, a qualified Lead, a tour, a proposal, a booking, or a Lost relationship.

Keep your stage names simple enough that your team can understand them at a glance.

Your Pipeline should feel like **your sales process**, while still giving Hello to Cheers the information it needs to work correctly.`,
  },
  {
    slug: "what-happens-when-i-move-a-lead-into-a-stage-with-an-automation",
    title: "What Happens When I Move a Lead Into a Stage With an Automation?",
    category: "Finding & Booking Clients",
    body: `If an active Automation is connected to the stage you're moving a Lead into, Hello to Cheers will show you a confirmation before enrolling that person.

You'll be able to review the message before anything is sent.

Nothing is enrolled until you choose **Continue**.

If you cancel the confirmation, the Lead remains where they are and the Automation does not enroll them.

This is intentional.

Automations should save you work without taking control away from you.`,
  },
  {
    slug: "whats-the-difference-between-a-lead-and-a-client",
    title: "What's the Difference Between a Lead and a Client?",
    category: "Finding & Booking Clients",
    body: `A **Lead** is someone you're working with as a potential booking.

A **Client** is the relationship once it has moved into the client/event workspace.

When a Lead is booked, Hello to Cheers carries that relationship into the client experience so you can continue working with the same person and event.

One important distinction:

**Booked does not automatically mean the contract is signed or the invoice is paid.**

Booking is part of the sales lifecycle.

Contracts and payments are separate parts of the relationship, and Hello to Cheers keeps those records distinct so you can see what has actually happened.`,
  },
  {
    slug: "what-is-the-difference-between-task-center-and-requests",
    title: "What Is the Difference Between Task Center and Requests?",
    category: "Working With Clients",
    body: `The easiest way to remember the difference is:

**Task Center is what you owe.**

**Requests are what you're waiting on.**

If your team needs to call a client, prepare something, review something, or complete a piece of work, that's a task.

If you've asked a client or vendor for something and you're waiting for them to respond or complete it, that's a Request.

Don't turn every deadline into a calendar entry.

The Calendar is for scheduled things.

Task Center is for work that needs to happen.

Requests are for things you're waiting on.

That separation keeps each part of Hello to Cheers useful instead of making one giant list of everything happening in your venue.`,
  },
  {
    slug: "what-does-event-readiness-mean",
    title: "What Does Event Readiness Mean?",
    category: "Working With Clients",
    body: `Event Readiness gives you a quick way to see whether an event has something that needs your attention.

It isn't another task list.

If something needs actual work, you'll find that work in places such as **Task Center**, **Requests**, **Financials**, or the relevant planning area of the event.

Think of Event Readiness as a quick question:

**Is there anything about this event that needs my attention right now?**

Use the underlying workspace to do the actual work.`,
  },
  {
    slug: "who-signs-a-contract-first-and-what-happens-after",
    title: "Who Signs a Contract First, and What Happens After?",
    category: "Contracts & Payments",
    body: `Hello to Cheers uses a venue-first signing process.

When you create a contract, the venue signs it first.

After the venue has signed, you explicitly **Release** the contract to the client.

The client cannot see or sign the contract until you release it.

The sequence is:

**Create → Venue signs → Release → Client signs**

Releasing the contract is a separate step from signing it. This gives your venue a chance to make sure the agreement is ready before the client sees it.

Signing a contract also does not automatically create an invoice or payment plan.

Contracts and payments are related, but they are separate records in Hello to Cheers.`,
  },
  {
    slug: "can-more-than-one-person-sign-a-contract",
    title: "Can More Than One Person Sign a Contract?",
    category: "Contracts & Payments",
    body: `Yes.

A contract can require more than one client signature.

Hello to Cheers tracks each required signer separately, so you can see whether all required signatures have been completed.

For example, if two people need to sign, the contract can show that one of two signatures has been completed while the second is still outstanding.

Each signer completes their own signature rather than sharing one signature between them.`,
  },
  {
    slug: "can-couples-pay-online",
    title: "Can Couples Pay Online?",
    category: "Contracts & Payments",
    body: `Yes, if your venue has connected Stripe for online payments.

Go to:

**Your Venue → Settings → Financials & Integrations**

Once Online Payment Collection is configured with Stripe, clients can pay through the payment experience provided by Hello to Cheers.

Stripe handles the payment processing.

Your venue's payment settings determine whether online payment is available to your clients.`,
  },
  {
    slug: "what-do-draft-sent-paid-and-void-mean-on-an-invoice",
    title: "What Do Draft, Sent, Paid, and Void Mean on an Invoice?",
    category: "Contracts & Payments",
    body: `These statuses describe where an invoice is in its life.

**Draft** means the invoice has been created but isn't finalized for the client yet.

**Sent** means the invoice has been sent to the client.

**Paid** means the amount due has been collected.

**Void** means the invoice is no longer an active amount due.

The important distinction is:

**Sent does not mean Paid.**

If you want to understand the financial picture for your business, use Reports.

If you need to understand what happened with a particular client's invoice or payment, look at that client's Financials.`,
  },
  {
    slug: "whats-the-difference-between-a-package-payment-schedule-and-payment",
    title: "What's the Difference Between a Package, Payment Schedule, and Payment?",
    category: "Contracts & Payments",
    body: `These three things answer three different questions.

**Package:** What are you selling?

A Package defines the offering your venue provides to the client.

**Payment Schedule:** How is the client expected to pay?

A Payment Schedule defines when payments are due and how the total is divided over time.

**Payment:** What money was actually requested or collected?

Payments are the actual financial activity associated with a booking.

The Library holds reusable definitions such as Packages and payment-plan structures.

The event/client record holds what was actually used for that relationship.

That distinction matters because changing a reusable Library definition should not silently rewrite something your venue has already committed to a client.`,
  },
  {
    slug: "whats-the-difference-between-a-package-inventory-and-an-inventory-template",
    title: "What's the Difference Between a Package, Inventory, and an Inventory Template?",
    category: "Building the Event",
    body: `A **Package** is what you're selling.

**Inventory** is what your venue owns or provides.

An **Inventory Template** is a reusable group of inventory items that gives you a starting point.

For example, your venue might have tables, chairs, linens, and other physical items in its inventory.

You can organize those items into reusable templates so you don't have to build the same collection from scratch every time.

The important mental model is:

**Library = reusable definitions.**

**Event = what is actually being used for this event.**

That distinction keeps your reusable catalog separate from the specific commitments and choices for a particular client.`,
  },
  {
    slug: "what-do-the-floor-plan-studio-icons-mean",
    title: "What Do the Floor Plan Studio Icons Mean?",
    category: "Building the Event",
    body: `Floor Plan Studio includes tools that help you arrange and organize the objects on your floor plan.

Depending on the object or view, you'll see controls for things such as:

* locking and unlocking objects
* snapping objects into position
* showing the grid
* duplicating objects
* changing object layering
* zooming the floor plan

If you're unsure about an icon, use its tooltip rather than trying to memorize every symbol.

You don't need to learn every tool before you can build a floor plan.

Start with the objects you need, place them where they belong, and use the additional controls when you need more precision.`,
  },
  {
    slug: "how-do-i-move-an-object-thats-behind-another-one",
    title: "How Do I Move an Object That's Behind Another One?",
    category: "Building the Event",
    body: `If an object is difficult to select because another object is in front of it, use the layering controls in Floor Plan Studio.

First check whether the object is locked.

If it is, unlock it before trying to move it.

Then use the layering controls to bring the object forward or move the object in front of it backward.

For complicated floor plans, it can also help to work with smaller groups of objects instead of trying to select everything at once.`,
  },
  {
    slug: "what-are-the-three-planning-questionnaires",
    title: "What Are the Three Planning Questionnaires?",
    category: "Planning the Event",
    body: `Hello to Cheers supports three main questionnaire types for planning and follow-up:

**Client Planning Questionnaire**

Used to collect planning information from the client during the planning process.

**Final Details**

Used to gather the information your team needs as the event gets closer, such as final event details.

**Post-Event Feedback**

Used after the event to collect feedback from the client.

You can create reusable questionnaire and feedback templates in the Library.

The important distinction is between the **template** and the **questionnaire for a specific event**.

The template is your reusable starting point.

The event has its own working version and its own answers.`,
  },
  {
    slug: "what-is-a-questionnaire-template",
    title: "What Is a Questionnaire Template?",
    category: "Planning the Event",
    body: `A Questionnaire Template is a reusable set of questions.

You create the template once, then use it as a starting point for future events.

The Library version is your reusable definition.

The questionnaire attached to an event is the working version for that client.

This means you can improve your template over time without changing the answers that already belong to previous events.

Use templates for consistency.

Use the event's questionnaire for the actual client's answers.`,
  },
  {
    slug: "where-do-questionnaire-answers-go",
    title: "Where Do Questionnaire Answers Go?",
    category: "Planning the Event",
    body: `Questionnaire answers belong to the questionnaire for that event.

Not every answer becomes a separate field somewhere else in the event.

Some information may also become part of the event's important facts when Hello to Cheers uses that information elsewhere.

For example, a questionnaire can collect concrete details such as a confirmed guest count, meal notes, or emergency contact information.

The questionnaire is the place to collect the information.

The event workspace is where you find the information that Hello to Cheers needs to use elsewhere.

If you're looking for the client's complete response, go back to the questionnaire rather than assuming every answer has been copied into another part of the event.`,
  },
  {
    slug: "how-do-i-create-a-timeline-from-a-template",
    title: "How Do I Create a Timeline From a Template?",
    category: "Planning the Event",
    body: `Open the event and go to the **Timeline** tab.

Choose:

**Use Template**

Select the Timeline Template you want to use.

After you select it, Hello to Cheers asks you to confirm the application. The confirmation uses:

**Apply [template name]**

The important distinction is that the template is the reusable schedule shape.

The event's Timeline is the actual schedule for this event.

Once the template is applied, work with the event's Timeline as the real schedule for that client.`,
  },
  {
    slug: "client-planning-vs-venue-planning-whats-the-difference",
    title: "Client Planning vs. Venue Planning: What's the Difference?",
    category: "Planning the Event",
    body: `**Client Planning** is the planning work you share with the client.

**Venue Planning** is the planning work your team manages internally.

Your team can prepare Venue Planning work without making it part of the client's experience.

Client Planning can also be prepared as a draft before you release it to the client.

This distinction lets your team do the behind-the-scenes work needed to prepare an event without exposing unfinished internal work to the client.

Think of it this way:

**Venue Planning = what your team needs to manage.**

**Client Planning = what you want the client to participate in.**`,
  },
  {
    slug: "what-is-a-planning-template",
    title: "What Is a Planning Template?",
    category: "Planning the Event",
    body: `A Planning Template is a reusable starting point for the work involved in an event.

Depending on how the template is configured, it can contain things such as:

* milestones
* tasks
* event-relative or fixed due dates
* ownership
* visibility
* dependencies
* reminders
* attachments
* links
* event-day work

The template is reusable.

The event gets its own working version.

That distinction is important because your template describes the way your venue normally works, while the event contains the actual work and dates for this particular client.`,
  },
  {
    slug: "how-does-task-center-work",
    title: "How Does Task Center Work?",
    category: "Planning the Event",
    body: `Task Center is where your venue team manages the work that needs to happen across your events.

Use the task views to see the work that belongs to you, your team, or the broader venue task list.

The exact views may be labeled according to the current Task Center interface, but the underlying idea is simple:

**Task Center = work that needs to happen.**

Tasks can be organized around urgency, such as:

* overdue work
* blocked work
* work due today
* work due soon
* upcoming work

A task deadline does not automatically belong on the Calendar.

Keep the distinction clear:

**Calendar = what is scheduled.**

**Task Center = what needs to be done.**

**Requests = what you're waiting on.**

This keeps the Calendar from becoming a second task list full of noise.`,
  },
  {
    slug: "how-do-vendors-work-in-hello-to-cheers",
    title: "How Do Vendors Work in Hello to Cheers?",
    category: "Vendors",
    body: `Hello to Cheers keeps the vendor relationship separate from a specific event.

A vendor can have a relationship with your venue and then be assigned to individual events.

That means the same photographer, florist, caterer, DJ, or other vendor can work with your venue across multiple events without creating a completely new vendor identity every time.

Think of the relationship in three layers:

**Vendor**

The vendor's overall identity.

**Venue relationship**

Your venue's relationship with that vendor.

**Event assignment**

The vendor's role on a particular event.

Once a vendor is assigned to an event, the event workspace can show the information that matters for that event without exposing unrelated information from other events.`,
  },
  {
    slug: "what-is-the-day-of-sheet-and-how-do-i-get-one",
    title: "What Is the Day-of Sheet, and How Do I Get One?",
    category: "Event Day",
    body: `The **Day-of Sheet** is a printable summary you can use as a handoff for your team on event day.

Open the event and choose:

**Day-of Sheet**

A preview opens with options to:

**Print / Save as PDF**

The Day-of Sheet brings together important event information such as:

* venue and event details
* the event schedule
* vendors and vendor contact information
* final event details
* ceremony and reception times
* guest count
* meal notes
* relevant notes

It is designed to give your team one practical document they can use on the day without having to move through the entire event workspace.`,
  },
  {
    slug: "what-is-the-wedding-day-dashboard",
    title: "What Is the Wedding Day Dashboard?",
    category: "Event Day",
    body: `The **Wedding Day Dashboard** is the live working view for the event day.

Use it when your team is actively managing the event.

The Day-of Sheet and Wedding Day Dashboard serve different purposes:

**Day-of Sheet = printable handoff.**

**Wedding Day Dashboard = live event-day workspace.**

The dashboard is designed for the information and actions your team needs while the event is actually happening.`,
  },
  {
    slug: "how-should-i-read-my-reports",
    title: "How Should I Read My Reports?",
    category: "Reports",
    body: `Reports help you understand what is happening across your venue's business.

Start with **Overview** for the broad picture, then use the more specific areas such as:

* Sales
* Bookings
* Revenue
* Events
* Saved Reports

One of the most important distinctions is between **sales activity** and **money**.

A Booking is part of the sales lifecycle.

**Contracted, Collected, and Outstanding** are financial measures.

They answer different questions and should not be treated as interchangeable.

Reports also distinguish between activity that belongs inside a selected period and cohort performance over time.

If historical information doesn't have a trustworthy date, Hello to Cheers does not invent one just to make a report look complete.

Use Reports to understand the business.

Then click into the underlying records when you need to understand a specific client or event.`,
  },
  {
    slug: "whats-the-difference-between-reports-and-saved-reports",
    title: "What's the Difference Between Reports and Saved Reports?",
    category: "Reports",
    body: `**Reports** are where you explore your business information.

Use them when you want to ask a question, change the date range, compare periods, or look at a different part of the business.

**Saved Reports** are for report views you want to come back to.

Think of it this way:

**Reports = explore.**

**Saved Reports = revisit.**

If you find a report configuration you use regularly, save it so you don't have to rebuild the same view each time.`,
  },
  {
    slug: "what-happens-after-an-event",
    title: "What Happens After an Event?",
    category: "After the Event",
    body: `Completing an event does not erase the relationship or the history you built with the client.

The event's information remains part of the client's record, including the work completed during planning, event information, communications, documents, and financial history.

Post-event feedback can be collected after the event using the appropriate feedback questionnaire.

The goal is to preserve the history of the relationship so your team can understand what happened even after the event itself is over.

Do not treat completion as deletion.

The event has moved into its next stage; its history still matters.`,
  },
];

export const PUBLISHABLE_HELP_ARTICLES = FINAL_HELP_ARTICLES.filter((a) => !a.blocked);
export const BLOCKED_HELP_ARTICLES = FINAL_HELP_ARTICLES.filter((a) => a.blocked);
