import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("Phase B1 Milestone 02 guided copy and routes", () => {
  it("keeps the four approved sections and CTAs on the overview", () => {
    const src = read("app/(app)/setup-hub/make-htc-yours/page.tsx");
    assert.match(src, /Your venue & brand/);
    assert.match(src, /Make it yours\./);
    assert.match(src, /Your venue details/);
    assert.match(src, /Your look &amp; feel/);
    assert.match(src, /Personalize your brand/);
    assert.match(src, /Your booking process/);
    assert.match(src, /Prepare your offerings, contracts, and payment arrangements\./);
    assert.match(src, /Set up your booking process/);
    assert.match(src, /Your event experiences/);
    assert.match(src, /Choose the events you host and prepare the experience for each one\./);
    assert.match(src, /Set up your event experiences/);
    assert.match(src, /Your communications/);
    assert.match(src, /Review your messages and choose how you'd like to stay in touch\./);
    assert.match(src, /Review your communications/);
    assert.doesNotMatch(src, /Your operational resources/);
    assert.doesNotMatch(src, /Explore your planning tools/);
    assert.doesNotMatch(src, /Prepare once\. Make every event easier\./);
    assert.doesNotMatch(src, /MilestoneGuidancePanel/);
    assert.doesNotMatch(src, /Customize versus Edit/);
  });

  it("uses the approved guided routes under Milestone 02", () => {
    const src = read("lib/setup-hub/phase-b1-routes.ts");
    assert.match(src, /\/setup-hub\/make-htc-yours\/booking-process/);
    assert.match(src, /\/setup-hub\/make-htc-yours\/event-experiences/);
    assert.match(src, /\/setup-hub\/make-htc-yours\/communications/);
    assert.match(src, /\/setup-hub\/make-htc-yours\/operational-resources/);
    assert.match(src, /setupSection/);
  });

  it("keeps venue & brand on the existing business editor", () => {
    const src = read("lib/setup-hub/phase-b1-routes.ts");
    const editor = read("components/settings/venue-settings.tsx");
    assert.match(src, /\/settings\/business\?from=setup-hub/);
    assert.match(src, /#venue-details/);
    assert.match(src, /#look-and-feel/);
    assert.match(editor, /id="venue-details"/);
    assert.match(editor, /id="look-and-feel"/);
    assert.match(editor, /Your venue details/);
    assert.match(editor, /Your look &amp; feel/);
  });

  it("booking process uses guided entries for packages, contracts, payments, Stripe, and QuickBooks", () => {
    const src = read("app/(app)/setup-hub/make-htc-yours/booking-process/page.tsx");
    assert.match(src, /Packages and offerings/);
    assert.match(src, /Choose what you offer, set your prices, and decide which packages you'd like to use\./);
    assert.match(src, /Review packages/);
    assert.match(src, /Unpriced packages aren't ready to offer/);
    assert.match(src, /Review contracts/);
    assert.match(src, /Payment arrangements/);
    assert.match(src, /\/settings\/leads#booking/);
    assert.match(src, /Online payment collection — Stripe Connect/);
    assert.match(src, /Connect your Stripe account to accept deposits and invoice payments from clients\./);
    assert.match(src, /\/settings\/integrations#stripe/);
    assert.match(src, /QuickBooks Online/);
    assert.match(src, /\/settings\/integrations#quickbooks/);
    assert.doesNotMatch(src, /href=\{withSetupHubReturn\("\/payments"/);
    assert.match(src, /Review booking rules/);
    assert.match(src, /\/settings\/availability\?focus=rules#rules/);
    assert.match(src, /Ready to use your booking process\?/);
    assert.doesNotMatch(src, /Customize versus Edit/);
    assert.doesNotMatch(src, /Packages use Customize/);
    assert.doesNotMatch(src, /StarterActionHelp/);
    assert.doesNotMatch(src, /Contact support to get this connected/);
  });

  it("shows the approved social celebrations checkbox label without renaming the type", () => {
    const types = read("lib/setup-hub/phase-b1-event-types.ts");
    const form = read("components/setup-hub/phase-b1/hosted-event-types-form.tsx");
    assert.match(types, /value: "social_event"/);
    assert.match(types, /label: "Social celebrations"/);
    assert.match(
      types,
      /checkboxLabel: "Social celebrations \(birthdays, showers, quinceañeras & more\)"/,
    );
    assert.match(form, /checkboxLabel/);
    assert.match(form, /whitespace-normal/);
    assert.match(form, /break-words/);
    assert.doesNotMatch(types, /value: "social_celebration"/);
  });

  it("event experiences uses the approved preparation cards and guided prep route", () => {
    const src = read("app/(app)/setup-hub/make-htc-yours/event-experiences/page.tsx");
    const copy = read("lib/setup-hub/phase-b1-experience-copy.ts");
    assert.match(src, /Let&apos;s prepare your event experiences\./);
    assert.match(src, /We&apos;ll help you get the planning essentials ready/);
    assert.match(copy, /Prepare weddings/);
    assert.match(copy, /Prepare corporate events/);
    assert.match(copy, /Prepare social celebrations/);
    assert.match(copy, /Review experience/);
    assert.match(src, /experiencePrepareHref/);
    assert.match(src, /copy\.prepareAction/);
    assert.doesNotMatch(src, /Before importing booked events of a particular type/);
    assert.doesNotMatch(src, /you'll need to finish preparing that event experience/);
    assert.match(src, /You can bring existing booked events over while you continue preparing/);
    assert.match(src, /isn&apos;t required before importing/);
    assert.doesNotMatch(src, /snapshot/);
    assert.doesNotMatch(src, /inheritance/);
    assert.doesNotMatch(src, /Customize versus Edit/);
    assert.doesNotMatch(src, /ConfirmSectionButton/);
  });

  it("event-family preparation view uses the approved four steps and readiness confirmation", () => {
    const src = read("app/(app)/setup-hub/make-htc-yours/event-experiences/[eventType]/page.tsx");
    assert.match(src, /Your starting point/);
    assert.match(src, /A Setup Profile brings together the resources you want available/);
    assert.match(src, /Choose your planning tools/);
    assert.match(src, /Prepare your resources/);
    assert.match(src, /Review your experience/);
    assert.match(src, /MarkExperienceReady/);
    assert.match(src, /Back to Your event experiences/);
    assert.match(src, /Changes\s+you make here update this reusable starting experience/);
    assert.match(src, /Changes you make on an individual\s+event stay with that event/);
    assert.doesNotMatch(src, /Mark experience ready/);
  });

  it("self-service connect copy does not send owners to support for ordinary unconfigured state", () => {
    for (const path of [
      "components/settings/stripe-connect-section.tsx",
      "components/settings/quickbooks-connect-section.tsx",
      "components/settings/facebook-connect-section.tsx",
    ]) {
      const src = read(path);
      assert.doesNotMatch(src, /Contact support to get this connected/);
      assert.doesNotMatch(src, /Not available for your account yet/);
      assert.doesNotMatch(src, /Preparing Facebook Connect/);
    }
    const stripe = read("components/settings/stripe-connect-section.tsx");
    assert.match(stripe, /Online Payment Collection/);
    assert.match(stripe, /Connect Stripe/);
    const qb = read("components/settings/quickbooks-connect-section.tsx");
    assert.match(qb, /Connect QuickBooks/);
    const fb = read("components/settings/facebook-connect-section.tsx");
    assert.match(fb, /Connect Facebook/);
    assert.match(fb, /Checking your Facebook connection/);
  });

  it("communications uses guided entries for templates, texting, lead capture, tours, and Facebook", () => {
    const src = read("app/(app)/setup-hub/make-htc-yours/communications/page.tsx");
    assert.match(src, /Nothing will be sent automatically until/);
    assert.match(src, /Review message templates/);
    assert.match(src, /Review automations/);
    assert.match(src, /Review email settings/);
    assert.match(src, /Set up text messaging so your team can communicate with leads and clients/);
    assert.match(src, /Set up text messaging/);
    assert.match(src, /\/settings\/communications#texting/);
    assert.match(src, /Set up lead capture/);
    assert.match(src, /\/settings\/leads#inquiry/);
    assert.match(src, /Tour scheduling/);
    assert.match(src, /\/settings\/leads#tours/);
    assert.match(src, /Facebook \/ Instagram Lead Ads/);
    assert.match(src, /\/settings\/integrations#facebook/);
    assert.match(src, /Happy with your communication setup\?/);
    assert.doesNotMatch(src, /Explore text messaging/);
    assert.doesNotMatch(src, /Customize versus Edit/);
  });

  it("maps missing B1 schema to customer-facing save messaging", () => {
    const src = read("lib/setup-hub/repository.ts");
    assert.match(src, /export const PHASE_B1_SCHEMA_MISSING =\s*"We couldn't save that yet\. Please try again in a moment\."/);
    assert.doesNotMatch(src, /hosted event-type columns missing/);
  });

  it("does not treat Setup Profile readiness as a booked-event import prerequisite", () => {
    const experienceList = read("app/(app)/setup-hub/make-htc-yours/event-experiences/page.tsx");
    const readiness = read("lib/setup-hub/phase-b1-readiness.ts");
    const importBatches = read("lib/import/batches.ts");
    assert.doesNotMatch(experienceList, /Before importing booked events of a particular type/);
    assert.doesNotMatch(readiness, /hostedEventTypeMigrationReadiness/);
    assert.doesNotMatch(readiness, /import finalization/);
    assert.doesNotMatch(importBatches, /eventExperienceReviews/);
    assert.doesNotMatch(importBatches, /hostedEventTypes/);
  });

  it("operational resources uses eight numbered tasks", () => {
    const src = read("components/setup-hub/phase-b1/operational-resources-form.tsx");
    assert.match(src, /Review playbooks/);
    assert.match(src, /Review timelines/);
    assert.match(src, /Review questionnaires/);
    assert.match(src, /Review Event Orders/);
    assert.match(src, /Review inventory/);
    assert.match(src, /Review floor plans/);
    assert.match(src, /Review Client Guide/);
    assert.match(src, /Review documents/);
    assert.match(src, /Your planning tools, your way\./);
    assert.doesNotMatch(src, /Customize versus Edit/);
  });

  it("keeps mainline Packages & Pricing copy and adds the setup-hub return link", () => {
    const src = read("app/(app)/packages/page.tsx");
    assert.match(src, /title="Packages & Pricing"/);
    assert.match(src, /Priced offers you sell before booking/);
    assert.match(src, /SetupHubReturnLink/);
    assert.match(src, /Back to your booking process/);
    assert.doesNotMatch(src, /Selected Package snapshots/);
  });

  it("uses the approved Contract Templates library copy", () => {
    const src = read("app/(app)/library/contracts/page.tsx");
    assert.match(src, /title="Contract Templates"/);
    assert.match(
      src,
      /Prepare reusable agreements for your venue\. Event details can be filled in when you use a template\./,
    );
    assert.match(
      src,
      /Review your agreement before using it with clients\. You can create your own version while keeping the original starter available\./,
    );
    assert.doesNotMatch(src, /Signed agreements live under Contracts/);
    assert.doesNotMatch(src, /there is no separate catalog to manage for contract content/);
  });

  it("uses the approved Message Templates library copy", () => {
    const src = read("app/(app)/communication/templates/page.tsx");
    assert.match(src, /title="Message Templates"/);
    assert.match(
      src,
      /Prepare reusable emails and text messages for inquiries, bookings, and planning\./,
    );
    assert.match(
      src,
      /Review a starter message or customize it to create your own editable copy\. Nothing is sent/,
    );
    assert.doesNotMatch(src, /including Hello to Cheers starters you can Customize/);
    assert.doesNotMatch(src, /there is no separate catalog/);
  });
});
