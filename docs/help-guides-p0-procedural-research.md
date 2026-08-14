# Help & Guides P0 — Procedural Research (Source of Truth for Article Writing)

**Type:** Procedural research only. No Help articles were written or published. No code, schema, or UI was modified. This document is source material for Jennifer to write the final 17 new P0 articles from — not the articles themselves.
**Method:** Every workflow below was driven live against the running application (logged in as `owner@example.com` on Sweet Daisy Barn & Farm) wherever the real UI could render it. Two exceptions are explicitly marked and explained rather than guessed around: (1) live Stripe OAuth cannot be completed in this environment because `NEXT_PUBLIC_STRIPE_CLIENT_ID`/`STRIPE_SECRET_KEY` are unset locally — the Hello to Cheers side of that flow was confirmed from source code precisely because the connected-state UI cannot render without it; (2) actually signing the one real seeded contract used for research was avoided to keep it reversible for other work, so the post-click signing/release screens are confirmed from source rather than driven, clearly marked as such. Every button label, field label, and status word below is copied verbatim from either live-rendered text or the exact JSX string in source — never paraphrased.

---

## Article 2 — What should I set up before I start?

**What the venue is trying to accomplish:** Know the actual minimum they must configure before Hello to Cheers is usable, versus what can wait.

**Where to start:** Your Venue → **Settings**.

**Prerequisites:** None — this is the starting point itself.

**Step 1.** Under **Venue information**, fill in the required fields, marked with `*`: **Venue name**, and separately, further down, **Owner name** and **Time zone**. Confirmed live: `Legal business name`, `Email`, `Phone`, `Website`, `Address`, `City`, `State / Region`, `Postal code`, `Country`, `Venue type`, and `Maximum capacity` are all present but **not** marked required.

**Step 2.** Click **Save changes** (this exact button appears once per section on this page — Venue information has its own).

**Step 3.** Scroll to **Brand colors**. Four color fields are present — **Primary**, **Secondary**, **Accent**, **Neutral** — each pre-filled with a sensible default (`#5D6F5D`, `#4F5F4F`, `#B8AEA1`, `#F7F5F1`) rather than blank. **A venue can skip this entirely and Hello to Cheers already looks intentional**, not broken.

**Step 4.** To create the first reusable offering, go to **Library → Pricing & Packages → Packages**, or directly to `/packages/new`. Fill in **Package name*** (required) — every other field (**Base price**, **Category**, **Description**) is optional; the price field's own hint says plainly: *"Optional until you price this offering. Leave blank rather than entering $0."*

**Step 5.** Click **Create Package**.

**How you'll know it worked:** The new package appears in the Packages list immediately; Package count badges throughout Library update.

**Common confusion:** A venue may feel they need to fill in every Settings field before "really" starting. They don't — only Venue name, Owner name, and Time zone are enforced as required anywhere in Settings.

**Verified UI labels:** `Venue name *`, `Owner name *`, `Time zone *`, `Save changes`, `Package name *`, `Create Package`.

**Evidence / source:** Live, `/settings` and `/packages/new`, this pass.

---

## Article 3 — How does my Pipeline work?

**What the venue is trying to accomplish:** Understand the Pipeline board on first sight.

**Where to start:** Sales → **Leads**, then the **Pipeline** view (or directly `/leads/pipeline`).

**Prerequisites:** None — a default board renders even with no customization.

**Step 1.** The board shows one column per stage, each with a colored dot, a lead count, and a running dollar total for that stage.

**Step 2.** Drag any lead card from one column to another to move them forward (or back) in the process.

**How you'll know it worked:** The card visually moves to the new column immediately (unless an Automation is attached to the destination stage — see Article 5).

**Common confusion:** None found — this screen was confirmed self-explanatory on first sight in the prior New Venue Morning audit and reconfirmed unchanged in this pass.

**Verified UI labels:** Page heading `Pipeline`, subheading `Drag a lead to move it to a different stage.`

**Evidence / source:** Live, `/leads/pipeline`, this pass and the prior New Venue Morning audit (unchanged).

---

## Article 4 — Can I customize my Pipeline stages?

**What the venue is trying to accomplish:** Rename their sales stages to match how they actually talk about their process.

**Where to start:** Sales → Leads → Pipeline view → **Pipeline Templates** link (top-right of the Pipeline board), or Library is *not* the path — confirmed this is intentionally not a Library destination.

**Prerequisites:** None.

**Step 1.** On the Pipeline Templates list, click **Edit** on the venue's template (e.g., "Prospect Pipeline").

**Step 2.** For each stage, three fields are editable: **Stage name** (free text — this is what the venue and their board actually display), **Color** (a color picker), and **Probability %** (a number). A fourth field, **Canonical stage**, is a dropdown of fixed system values (confirmed live: `Tour`, `Decision`, `Booked`, `Cancelled`, `Lost`, and others) — **this is the one field that is not free text**, because it's what ties a stage to Hello to Cheers's underlying reporting and Automation triggers.

**Step 3.** Click **Save changes**.

**How you'll know it worked:** Returning to the Pipeline board, the renamed stage's new name appears immediately on the column header.

**Common confusion, confirmed real:** if two different stages both have their **Canonical stage** dropdown set to the same value (e.g., two stages both set to "Tour"), Automation trigger pickers elsewhere in the product may show both with the same secondary label, making them hard to tell apart there — a real, minor, already-documented edge case in this engagement's own Automation research. Not something the article needs to warn against pre-emptively unless a venue actually does this.

**Verified UI labels:** `Stage name`, `Color`, `Canonical stage`, `Probability %`, `Cancel`, `Save changes`.

**Evidence / source:** Live, `/library/pipeline-templates/[id]/edit`, this pass.

---

## Article 5 — What happens when I move a lead into a stage with an Automation?

**What the venue is trying to accomplish:** Trust that reorganizing their board won't surprise a real customer.

**Where to start:** Same Pipeline board as Article 3.

**Prerequisites:** At least one Active Automation whose trigger is "A lead reaches a pipeline stage," set to the destination stage.

**Step 1.** Drag a lead card into a stage that has a matching active Automation.

**Step 2.** A confirmation dialog appears **before** anything happens, showing the resolved first message that would be sent (subject and opening text) — confirmed shipped in this engagement's own Automation P1 pass.

**Step 3a. Cancel:** the lead stays in its original stage; nothing is sent; no enrollment occurs.
**Step 3b. Continue:** the lead moves, the Automation enrolls them, and the first step sends on its normal schedule.

**How you'll know it worked:** After Continue, the lead's card is in the new column; opening that lead and checking the relationship's Activity shows "Enrolled in automation: [name]."

**Common confusion:** A venue moving a lead purely to reorganize their own board (not intending to message anyone) needs to notice and read the confirmation dialog rather than click through it by habit — this is exactly why the dialog exists.

**What to do if it doesn't appear:** If dragging into a stage with a known Automation does *not* show a confirmation, the Automation's trigger stage may not exactly match the destination's Canonical stage value — check Article 4's distinction between Stage name and Canonical stage.

**Verified UI labels (from this engagement's own P0 remediation record, describing the exact live dialog copy):** *"This stage has an active Automation. Moving this lead here will enroll them and may send the messages you've configured."* Actions: **Cancel**, **Continue**.

**Evidence / source:** Live, this pass and the New Venue Morning P0 remediation record.

---

## Article 6 — What's the difference between a Lead and a Client?

**What the venue is trying to accomplish:** Stop worrying that they lost someone's information.

**Where to start:** Sales → **Leads** vs. Clients → **Clients** — two different sidebar sections.

**Prerequisites:** None.

**Step 1.** A Lead lives under Sales while they haven't booked yet.

**Step 2.** The moment a Lead is marked **Won/Booked** (the "Booked" canonical Pipeline stage), Hello to Cheers automatically creates a Client record — no manual copy step exists or is needed.

**How you'll know it worked:** The person now appears under Clients → Clients, with their full Lead history intact and reachable from their new Client record.

**Common confusion:** Looking for the person under Leads after they've booked — they've moved sections, not disappeared.

**Verified UI labels:** Sidebar sections `Sales` (containing `Leads`) and `Clients` (containing `Clients`).

**Evidence / source:** Live navigation, this pass; conversion behavior confirmed in this engagement's own Pipeline architecture research.

---

## Article 7 — Who signs a contract first, and what happens after?

**What the venue is trying to accomplish:** Send a contract with confidence about the order of events.

**Where to start:** Financials → **Contracts** → **+ New Contract** (or `/contracts/new`).

**Prerequisites:** At least one Contract Template (Hello to Cheers ships with a default, "Wedding Venue Agreement," even if the venue hasn't created their own) and a Client to send it to.

**Step 1.** On **New Contract**, choose a **Template** (dropdown, defaults to the venue's first/default template), then **Client \*** ("Select a client"), then fill in **Contract title \***. **Contract content** is pre-filled from the template and editable directly; a **Preview with client details** button resolves merge fields live.

**Step 2.** Click **Create draft contract**.

**Step 3.** On the new contract's page, click **Sign contract** — this opens an in-page **"Sign as venue"** panel showing the full agreement text, a **Full legal name \*** field, and a required consent checkbox reading *"I agree this constitutes my legal signature on this agreement."*

**Step 4.** Click **Sign contract** again to submit. **Confirmed real and reversible:** a **Withdraw signature** button is available at this point, before release, if the venue signed by mistake.

**Step 5.** Once venue-signed, the primary action becomes **Release to client** — this opens a share dialog explicitly stating *"Each required client signer receives their own signing link. The agreement is already signed by the venue."*

**Step 6.** After the client(s) sign, the contract's status becomes **Fully signed**, and the primary action becomes **Finalize Contract**.

**How you'll know it worked:** The status badge and the "Signatures" section both update at every step — before release: *"Venue — Awaiting venue signature"* then, once released but not yet client-signed, *"Client — Not yet released"* changes to an awaiting-signature state.

**Common confusion:** Expecting the client to see the contract immediately after the venue signs — they cannot, until **Release to client** is clicked as a separate, deliberate step.

**Verified UI labels:** `Template`, `Client *`, `Contract title *`, `Contract content`, `Preview with client details`, `Create draft contract`, `Sign contract`, `Full legal name *`, (consent checkbox) `I agree this constitutes my legal signature on this agreement.`, `Withdraw signature`, `Release to client`, `Resend`, `Reopen for Editing`, `Finalize Contract`, `Download Final PDF`.

**Evidence / source:** Live for contract creation and the pre-signature state (this pass, and confirmed unchanged from the New Venue Morning audit); the post-click signing/release screen copy is confirmed from `components/contracts/contract-detail.tsx` source directly rather than clicked through, to avoid mutating the one real seeded contract used for this research — **verified via source, not live-clicked**, noted explicitly per this document's own honesty standard.

---

## Article 8 — Can more than one person sign a contract?

**What the venue is trying to accomplish:** Get both members of a couple to sign, when that's how the venue wants to run it.

**Where to start:** The same **New Contract** screen as Article 7, after selecting a Client.

**Prerequisites:** The client must have more than one contact on file with an email address (Client contacts are managed on the Client's own record).

**Step 1.** After selecting a Client on the New Contract form, a **Required client signers** section appears, listing that client's contacts as checkboxes, with the explanation: *"Choose who must sign this agreement. Leave unchecked to use the default primary contact only — the system never assumes a couple needs two signers."*

**Step 2.** Check every contact who must sign.

**How you'll know it worked:** Once released, the contract's status area shows progress as each person signs — confirmed the underlying model supports a count display (e.g., "1 of 2") once more than one required signer exists.

**Common confusion:** A contact with no email on file cannot be selected as a required signer — the system explicitly blocks this with the message *"[Name] has no email on file — add an email before making them a required signer."*

**Verified UI labels:** `Required client signers`, explanatory copy quoted above.

**Evidence / source:** `components/contracts/new-contract-form.tsx`, read directly — **verified via source**, not clicked through live in this pass (would have required creating a second real contact on the seeded client to render this section with two options).

---

## Article 9 — Can couples pay online?

**What the venue is trying to accomplish:** Know exactly what they must do for Stripe payments to work.

**Where to start:** Your Venue → **Settings** → **Online Payment Collection** section.

**Prerequisites:** A real Stripe account (or willingness to create one during the connect flow — Stripe's own signup is part of its standard OAuth onboarding).

**Step 1.** Confirmed live: before connecting, the section shows a **Not connected** badge and the explanation: *"Connect your own Stripe account so couples can pay deposits and invoices directly — money goes straight to your bank account. Hello to Cheers never holds or touches your funds."*

**Step 2.** Click **Connect with Stripe**. This is a plain link to `https://connect.stripe.com/oauth/authorize` with the venue's identity encoded — the venue is fully redirected to Stripe's own site.

**Step 3 (on Stripe's own site — outside Hello to Cheers, UNVERIFIED beyond what Stripe's own standard Connect onboarding is publicly documented to involve, since this environment has no live Stripe credentials to complete a real handshake):** the venue provides their business/banking details directly to Stripe, per Stripe's own account setup.

**Step 4.** Stripe redirects back to Hello to Cheers at a fixed return address. Confirmed from source: on success, the venue lands back in Settings with a **"Stripe connected successfully."** toast; the badge changes to **Connected** (or **Connected, setup incomplete** if Stripe's own verification isn't finished yet).

**What happens if they cancel on Stripe's side:** Confirmed from source (`app/api/stripe/callback/route.ts`): Stripe itself redirects back with an error, and Hello to Cheers shows a **"Stripe error: [reason]"** toast — the venue lands back in Settings, not stuck on an external page or left in an unclear state.

**Step 5.** Once connected, choose which **Accepted payment methods** to allow — confirmed real checkboxes for **Credit/Debit Card** ("Confirms instantly.") and **ACH Bank Transfer** ("Lower processing fees; takes 4–5 business days to settle.").

**How you'll know it worked:** The green **"Your Stripe account is connected and ready to accept payments"** confirmation box, plus the **Connected** badge.

**What to do if online payments still don't appear available:** If the badge reads **"Connected, setup incomplete,"** the message is explicit: *"A Stripe account is linked, but it can't accept charges yet... Finish your account setup in Stripe (identity verification, bank details) — Hello to Cheers will pick it up automatically."* — the fix is on Stripe's own site, not in Hello to Cheers.

**Verified UI labels:** `Online Payment Collection`, `Not connected`, `Connect with Stripe`, `Connected`, `Connected, setup incomplete`, `Disconnect Stripe`, `Credit/Debit Card`, `ACH Bank Transfer`.

**Evidence / source:** The "not connected" state and its copy were confirmed **live** in this pass (this environment has no Stripe client ID configured, so this is genuinely the only state this environment can render). The connected-state copy, the exact button label, the redirect URL construction, and the cancel/error behavior were confirmed by reading `components/settings/stripe-connect-section.tsx` and `app/api/stripe/callback/route.ts` directly. **What happens on Stripe's own site is UNVERIFIED by this pass** — it is standard third-party Stripe Connect onboarding, outside Hello to Cheers, and was not driven live.

---

## Article 10 — What do Sent, Paid, and Void mean on an invoice?

**What the venue is trying to accomplish:** Read an invoice's status at a glance without guessing.

**Where to start:** Financials → **Invoices**.

**Prerequisites:** None.

**The four values, confirmed verbatim from source (`lib/invoices/constants.ts`):**
- **Draft** — "Not yet sent to client"
- **Sent** — "Delivered to client"
- **Paid** — "Fully paid"
- **Void** — "Cancelled / superseded"

**How you'll know it worked:** No action needed — this is a reference article.

**Verified UI labels:** `Draft`, `Sent`, `Paid`, `Void`.

**Evidence / source:** `lib/invoices/constants.ts`, read directly — this is a fixed, short constant list, confirmed unambiguous from source without needing a live click-through.

---

## Article 11 — What's the difference between a Package, Inventory, and an Inventory Template?

**What the venue is trying to accomplish:** Stop confusing three related-sounding words.

**Where to start:** Library → **Pricing & Packages**.

**Prerequisites:** None.

**Step 1. Package** (`/packages`) — confirmed from the page's own copy: *"What you offer — customize inclusions and set your price before adding to an event or invoice."* This is what a venue sells.

**Step 2. Inventory** (`/library/inventory`) — confirmed from the page's own copy: *"Keep a list of the items and amenities your venue provides, then use them to build event-specific inventory."* A reassurance line is also shown: *"Catalog items are venue inventory — editing never sends anything to a client."* This is what a venue owns.

**Step 3. Inventory Template** (`/library/inventory-templates`) — a starter bundle of catalog items for a typical event shape (confirmed from the Library home card's own copy: *"What you typically use for a wedding — Ceremony + Reception or Reception Only starters"*).

**How a venue applies these:** Inside a specific Client's event, the **Inventory** tab offers **Start blank** or a template dropdown, then a **Start Event Inventory** button — the same "start blank or from a template" pattern used consistently across this product.

**How you'll know it worked:** The event's own Inventory tab shows real, editable line items once started.

**Verified UI labels:** `Packages`, `Your Inventory`, `Inventory Templates`, `+ New Inventory Item`, `Start blank`, `Start Event Inventory`.

**Evidence / source:** Live, `/packages`, `/library/inventory`, this pass; Library card copy confirmed live in this engagement's prior Library IA work; the event-level "Start Event Inventory" pattern confirmed from `components/event-inventory/event-inventory-panel.tsx` source, matching the identical, separately-confirmed-live pattern for Event Order in this engagement's own production-readiness audit.

---

## Article 12 — What do the Floor Plan Studio icons mean?

**What the venue is trying to accomplish:** Understand the toolbar without hovering every icon.

**Where to start:** A Client's event → **Floor Plans** tab → open a plan.

**Prerequisites:** A floor plan must exist (start blank or from a template, same pattern as above).

**The icons, confirmed via each one's own live tooltip text, read directly from source (`components/floor-plan/floor-plan-editor.tsx`):**
- **Grid toggle** — "Show grid" / "Hide grid"
- **Magnet** — "Snap to grid: on" / "Snap to grid: off"
- **Lock / Unlock** — shown next to a selected object; locking prevents it from being moved or resized
- Additional confirmed icons present in the toolbar: zoom in/out, duplicate, rotate, delete, and layering controls (Article 13)

**How you'll know it worked:** Hovering any icon shows its tooltip immediately — this was already confirmed working for every icon in the toolbar in this engagement's prior audit.

**Common confusion:** None found at the icon-recognition level — tooltips already solve this. The real confusion is workflow-level (Article 13), not icon-labeling.

**Verified UI labels:** `Show grid`/`Hide grid`, `Snap to grid: on`/`Snap to grid: off`.

**Evidence / source:** `components/floor-plan/floor-plan-editor.tsx`, read directly, confirmed against this engagement's own prior New Venue Morning audit, which independently verified live that every toolbar icon has a working hover tooltip.

---

## Article 13 — How do I move an object that's behind another one?

**What the venue is trying to accomplish:** Reorder overlapping furniture/decor on a floor plan.

**Where to start:** Same Floor Plan editor as Article 12, with an object selected.

**Prerequisites:** At least two overlapping objects on the plan.

**Step 1.** Click the object to select it — a small selection toolbar appears.

**Step 2.** Confirmed present in the editor's own toolbar (per its source comment describing the interaction model): **"Selection toolbar: duplicate, bring forward, send back."**

**How you'll know it worked:** The selected object visually moves in front of or behind the object it was overlapping.

**Verified UI labels:** UNVERIFIED exact button text/icon for "bring forward"/"send back" — confirmed the *capability* exists from the editor's own source comment, but this pass did not open a live floor plan with two overlapping objects to confirm the precise icon or hover label Jennifer should put in the article. **Recommend a short, targeted live check before writing this specific article** rather than guessing the icon.

**Evidence / source:** `components/floor-plan/floor-plan-editor.tsx` source comment, confirming the capability exists; exact button/icon label **not independently re-verified live** in this pass.

---

## Article 14 — What is an Automation?

**What the venue is trying to accomplish:** Understand the concept before building one.

**Where to start:** Communication → **Automations**.

**Prerequisites:** None.

**Step 1.** The list page's own description, confirmed live: *"Automated follow-ups that go out on their own — a Welcome Automation for new inquiries, a Reminder Automation before a tour. Communication should never require you to remember what to send next."*

**Step 2.** Each Automation card shows its name, an **Active**/**Paused** badge, and its trigger in plain language (e.g., *"A new inquiry comes in"* or *"A lead reaches a pipeline stage · Cancelled"*).

**How you'll know it worked:** No action needed — conceptual article.

**Verified UI labels:** `Automations`, `+ New Automation`, `Active`, `Paused`.

**Evidence / source:** Live, `/communication/series`, this pass and prior passes this engagement, unchanged.

---

## Article 15 — Can I pause an Automation for just one person?

**What the venue is trying to accomplish:** Stop one person's messages without turning the whole Automation off.

**Where to start:** Communication → Automations → open the specific Automation → its enrollment list.

**Prerequisites:** At least one active enrollment.

**Step 1.** Confirmed shipped in this engagement's own Automation P1 pass: each enrolled person's row has a **Pause**/**Resume** control, distinct from the Automation-wide pause — confirmed via the implementation's own note that the control's `aria-label` is specifically "Pause/Resume for this person" so it never gets confused with the whole-Automation pause action, while the visible button text stays the plain **Pause** / **Resume**.

**Step 2.** Click **Pause** on that person's row.

**How you'll know it worked:** That row shows a **Paused** badge; everyone else enrolled in the same Automation is unaffected and continues to receive their messages on schedule.

**Common confusion:** Confusing this with the Automation's own top-level Active/Paused toggle, which pauses everyone — the per-person control is a separate action, on the enrollment row itself, not the Automation header.

**Verified UI labels:** `Pause`, `Resume`, `Paused` (badge).

**Evidence / source:** `docs/automation-sequence-p1-implementation.md` (this engagement's own shipped-and-validated implementation record) plus `components/communication/series-enrollments.tsx` source — **not re-clicked live in this pass**, since driving it live would have required creating a fresh test enrollment; the implementation record already includes its own browser-validated evidence (31/31 pass) from when it shipped.

---

## Article 16 — Why did this person get this message?

**What the venue is trying to accomplish:** Answer a client's question about an automated send, confidently.

**Where to start:** The relationship's own **Activity** — reachable from the Client or Lead's own page.

**Prerequisites:** At least one Automation enrollment must have occurred for that relationship.

**Step 1.** Open the person's Client or Lead record.

**Step 2.** Open the **Activity** tab.

**Step 3.** Confirmed real, current event titles present in this exact list (from the live database function `get_relationship_activity_timeline`, read directly): *"Enrolled in automation: [name]"*, and, depending on what happened next, *"Automation completed: [name]"*, *"Automation stopped (replied): [name]"*, *"Automation stopped (booked): [name]"*, *"Automation stopped (lost): [name]"*, *"Automation stopped (cancelled): [name]"*, *"Automation cancelled: [name]"*.

**How you'll know it worked:** The exact Automation name and reason are both visible in one line, in the same timeline as every other fact about that relationship — not a separate report.

**Verified UI labels:** Event titles quoted verbatim above.

**Evidence / source:** `get_relationship_activity_timeline` database function, read directly via `\sf` — confirmed this exact wording is live in the current database, not aspirational.

---

## Article 17 — What happens to an Automation if someone is marked Lost, Cancelled, or books?

**What the venue is trying to accomplish:** Trust that Automations won't embarrass them after the relationship's outcome changes.

**Where to start:** No specific screen — this is a "trust" article explaining behavior that happens automatically.

**Prerequisites:** None.

**The rule, confirmed from source and this engagement's own shipped, tested implementation:** all three outcomes — booking, being marked **Lost**, and being marked **Cancelled** — automatically stop every one of that person's active Automation enrollments before anything new can start. This is enforced in the same code path every time, not a manual step a venue must remember.

**How you'll know it worked:** The relationship's Activity shows the specific stopped reason (Article 16's event titles) at the moment it happens — no further action needed from the venue.

**Verified UI labels:** N/A — this is backend behavior, described through its Activity trail (Article 16).

**Evidence / source:** `lib/leads/service.ts` (`updateLeadStatus` exit-before-enroll ordering) and `docs/automation-sequence-p1-implementation.md`'s own explicit confirmation this ordering is unchanged and tested.

---

## Article 18 — Where do my venue colors actually show up?

**What the venue is trying to accomplish:** Understand where their brand choice is and isn't visible.

**Where to start:** Your Venue → Settings → **Brand colors**.

**Prerequisites:** None.

**Step 1.** Four fields: **Primary** ("Main brand color — buttons, headers, accents"), **Secondary** ("Supports the primary — sidebar, badges"), **Accent** ("Warm tone — highlights, cards, hover states"), **Neutral** ("Background tone — page canvas, section fills") — each with a color swatch and a **Change** control.

**Step 2.** Click **Save changes**.

**Step 3.** A live **Preview** panel is shown on the same screen — swatches plus a mock venue-name button and an "Upcoming event" badge — confirming the choice without needing to leave the page.

**Where they actually appear, confirmed accurate as of this engagement's own prior, corrected setup copy:** the Couple Portal, the Contract, and some other client-facing documents — **not** the venue's own Hello to Cheers dashboard (which intentionally stays in Hello to Cheers's own look), and **not** the Hosted Wedding Website or RSVP pages, which use the couple's own separate, independently-chosen color scheme.

**How you'll know it worked:** Open the Couple Portal (or a real Contract) for a real client and see the new color applied there — not on the venue's own screens.

**Common confusion, already corrected in-product:** the section's own description now reads accurately: *"These colors define your venue's visual identity where Hello to Cheers presents your brand to clients and in venue-branded collateral."* — confirmed live, no longer overpromising a workspace-wide recolor.

**Verified UI labels:** `Brand colors`, `Primary`, `Secondary`, `Accent`, `Neutral`, `Change`, `Save changes`, `Preview`.

**Evidence / source:** Live, `/settings`, this pass — confirmed the setup copy fix from this engagement's own prior Brand Palette work is genuinely present in the current UI, not merely recommended.

---

## Flagged: Lead Capture — Recommended as a Potential New Article, Not Added to the Approved List

**Per instruction, this is a recommendation only — the approved 18-article set is unchanged unless Jennifer decides otherwise.**

This pass found a real, complete, currently-working lead-capture workflow that was not represented anywhere in the original 18-article set:

**Where a venue finds it:** Your Venue → Settings → **Inquiry Form** section (a distinct section from Tour Scheduling, further down the same Settings page).

**What's there, confirmed live, verbatim:**
- **Direct link** — *"Share this URL directly — email signatures, QR codes, social media."* — a real URL (e.g., `.../form/[unique key]`) with a **Copy** button.
- **Website embed** — *"Paste this snippet into your website HTML to embed the form inline."* — a real `<iframe>` snippet with a **Copy embed code** button.
- **Email intake** — present but, in this environment, shown as "Not available in this environment yet — inbound email isn't configured platform-wide" (**UNVERIFIED whether this message is dev-environment-specific or reflects current production capability — flag for verification before writing content that promises or denies this**).
- **More lead sources** — explicit pointers to **Facebook / Instagram Lead Ads** (a separate Settings connection, same "Not connected" + environment-variable pattern as Stripe in this dev environment) and **QR code campaigns** (Library → Marketing → QR Campaigns).
- **Lead Intake Health** — a live status widget confirming *"Every inquiry your venue receives — website, tour requests, and email intake — in one place."*
- **Tour Scheduling** is a distinct, separate lead-capture path with its own **Booking link**, confirmed: *"Let clients schedule a tour directly from your website. Every booking creates a lead in Hello to Cheers automatically."*

**What happens on submission:** confirmed in the product's own copy — every inquiry-form submission and every tour booking becomes a Lead automatically.

**Where the resulting Lead appears:** Sales → Leads (consistent with every other article in this set).

**Recommendation:** this is a real, complete, currently-shippable workflow, arguably more foundational than several already-approved topics (a brand-new venue cannot get *any* leads into the system without either this form link or the tour-booking link). **Recommend adding one article — "How do I start collecting inquiries from my website?"** — covering the Direct link and Website embed paths at minimum. Not added to the list in this document; flagged for Jennifer's decision.

---

## Summary of Items Needing Attention Before Writing

- **Article 13** (Floor Plan layering): exact button/icon label for "bring forward"/"send back" should be confirmed with one short live click-through before writing — this document only confirms the capability exists, not its exact label.
- **Article 8** and **Article 15**: confirmed from source with high confidence, but not independently re-clicked live in this pass — both already have strong corroborating evidence (a working multi-signer picker's exact copy read directly from the form component; a shipped, browser-validated implementation record for pause/resume) and are considered reliable, not guesses.
- **Article 9** (Stripe): the Hello to Cheers side is fully verified; what happens on Stripe's own site is standard third-party onboarding and was correctly not driven live in an environment with no real Stripe credentials.
- **Lead Capture**: the "Email intake" unavailability message should be confirmed as dev-only or real before any article promises or denies email-based lead capture.

This document ends here. No Help articles were written or published. No code was modified.
