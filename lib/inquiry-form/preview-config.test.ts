import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { DEFAULT_INQUIRY_FORM_FIELDS } from "@/lib/inquiry-form/constants";
import {
  INQUIRY_FORM_PREVIEW_BANNER,
  applyInquiryFormDraftToPublicConfig,
  type InquiryFormBuilderDraft,
} from "@/lib/inquiry-form/preview-config";
import type { PublicInquiryFormConfig } from "@/lib/inquiry-form/types";

const baseConfig: PublicInquiryFormConfig = {
  venue: {
    id: "venue-1",
    name: "Test Venue",
    logoUrl: null,
    primaryColor: "#5D6F5D",
    secondaryColor: "#4F5F4F",
    accentColor: "#B8AEA1",
    neutralColor: "#F7F5F1",
    email: "hello@test.invalid",
    phone: null,
    addressLine1: null,
    city: null,
    stateRegion: null,
    timezone: "America/New_York",
  },
  tourSchedulingEnabled: true,
  tourEmbedKey: "tour-key",
  tourProtectionRequired: false,
  tourProtectionKind: null,
  tourProtectionFeeCents: null,
  inquiryEventDateMode: "request_preferred",
  inquiryFormFields: { ...DEFAULT_INQUIRY_FORM_FIELDS, guest_count: "optional" },
  acceptedEventTypes: ["wedding", "corporate"],
  customQuestions: [],
  ga4MeasurementId: "G-SAVED123",
  inquiryCommunicationSettings: {
    askPreferences: true,
    offerEmail: true,
    offerSms: true,
    offerPhoneCall: true,
    requestSmsPermission: true,
    showPreferences: true,
    showSmsPermission: true,
    offeredChannels: ["email", "sms", "phone_call"],
  },
};

function draft(overrides: Partial<InquiryFormBuilderDraft> = {}): InquiryFormBuilderDraft {
  return {
    inquiryEventDateMode: "request_preferred",
    inquiryFormFields: { ...DEFAULT_INQUIRY_FORM_FIELDS },
    acceptedEventTypes: ["wedding"],
    customQuestions: [],
    inquiryCommunicationSettings: {
      askPreferences: true,
      offerEmail: true,
      offerSms: false,
      offerPhoneCall: false,
      requestSmsPermission: false,
    },
    ...overrides,
  };
}

describe("inquiry form builder preview", () => {
  it("Preview control is present on the inquiry form builder", () => {
    const website = readFileSync(resolve("components/settings/website-forms-section.tsx"), "utf8");
    const config = readFileSync(resolve("components/settings/inquiry-form-config-section.tsx"), "utf8");
    assert.match(website, /Preview form/);
    assert.match(website, /data-testid="inquiry-form-preview-open"/);
    assert.match(config, /Preview form/);
    assert.match(config, /registerDraftGetter/);
  });

  it("Preview uses the current builder configuration (unsaved overlay)", () => {
    const preview = applyInquiryFormDraftToPublicConfig(
      baseConfig,
      draft({
        inquiryFormFields: { ...DEFAULT_INQUIRY_FORM_FIELDS, guest_count: "required" },
        acceptedEventTypes: ["corporate", "social_event"],
        inquiryEventDateMode: "choose_available",
      }),
    );
    assert.equal(preview.inquiryFormFields.guest_count, "required");
    assert.deepEqual(preview.acceptedEventTypes, ["corporate", "social_event"]);
    assert.equal(preview.inquiryEventDateMode, "choose_available");
    // Venue shell from saved public config is reused.
    assert.equal(preview.venue.name, "Test Venue");
    assert.equal(preview.tourSchedulingEnabled, true);
  });

  it("An unsaved required/optional change appears in Preview", () => {
    const preview = applyInquiryFormDraftToPublicConfig(
      baseConfig,
      draft({
        inquiryFormFields: { ...DEFAULT_INQUIRY_FORM_FIELDS, guest_count: "required", estimated_budget: "hidden" },
      }),
    );
    assert.equal(preview.inquiryFormFields.guest_count, "required");
    assert.equal(preview.inquiryFormFields.estimated_budget, "hidden");
    assert.notEqual(preview.inquiryFormFields.guest_count, baseConfig.inquiryFormFields.guest_count);
  });

  it("A newly added unsaved custom question appears in Preview", () => {
    const preview = applyInquiryFormDraftToPublicConfig(
      baseConfig,
      draft({
        customQuestions: [{
          id: "draft-preview-0",
          questionText: "Do you need overnight lodging?",
          questionType: "short_answer",
          required: true,
          options: [],
          sortOrder: 0,
        }],
      }),
    );
    assert.equal(preview.customQuestions.length, 1);
    assert.equal(preview.customQuestions[0]?.questionText, "Do you need overnight lodging?");
    assert.equal(preview.customQuestions[0]?.required, true);
  });

  it("Changed event type selection appears in Preview", () => {
    const preview = applyInquiryFormDraftToPublicConfig(
      baseConfig,
      draft({ acceptedEventTypes: ["birthday", "other"] }),
    );
    assert.deepEqual(preview.acceptedEventTypes, ["birthday", "other"]);
  });

  it("Changed preferred-date mode appears in Preview", () => {
    const preview = applyInquiryFormDraftToPublicConfig(
      baseConfig,
      draft({ inquiryEventDateMode: "choose_available" }),
    );
    assert.equal(preview.inquiryEventDateMode, "choose_available");
    assert.notEqual(preview.inquiryEventDateMode, baseConfig.inquiryEventDateMode);
  });

  it("Communication preferences and texting permission appear correctly", () => {
    const preview = applyInquiryFormDraftToPublicConfig(
      baseConfig,
      draft({
        inquiryCommunicationSettings: {
          askPreferences: true,
          offerEmail: true,
          offerSms: true,
          offerPhoneCall: false,
          requestSmsPermission: true,
        },
      }),
    );
    assert.equal(preview.inquiryCommunicationSettings.showPreferences, true);
    assert.equal(preview.inquiryCommunicationSettings.showSmsPermission, true);
    assert.deepEqual(preview.inquiryCommunicationSettings.offeredChannels, ["email", "sms"]);

    const off = applyInquiryFormDraftToPublicConfig(
      baseConfig,
      draft({
        inquiryCommunicationSettings: {
          askPreferences: false,
          offerEmail: true,
          offerSms: true,
          offerPhoneCall: true,
          requestSmsPermission: false,
        },
      }),
    );
    assert.equal(off.inquiryCommunicationSettings.showPreferences, false);
    assert.equal(off.inquiryCommunicationSettings.showSmsPermission, false);
  });

  it("Preview cannot create a real lead or send notifications", () => {
    const form = readFileSync(resolve("components/form/inquiry-form.tsx"), "utf8");
    assert.match(form, /preview\?: boolean/);
    assert.match(form, /setError\(INQUIRY_FORM_PREVIEW_BANNER\)/);
    assert.match(form, /disabled=\{preview \|\| state === "submitting"\}/);
    assert.match(form, /Preview only — submissions disabled/);
    // Submit path to inquire/book remains gated behind preview early-return.
    const submitIdx = form.indexOf("async function handleSubmit");
    const inquireIdx = form.indexOf('fetch("/api/public/inquire"');
    const submitSlice = form.slice(submitIdx, inquireIdx);
    assert.ok(submitIdx > 0 && inquireIdx > submitIdx);
    assert.match(submitSlice, /if \(preview\)/);
    assert.match(submitSlice, /setError\(INQUIRY_FORM_PREVIEW_BANNER\)/);
    assert.match(submitSlice, /return;/);
    // Analytics consent and turnstile are omitted in preview.
    assert.match(form, /\{!preview && \(/);
    assert.match(form, /TurnstileWidget/);
    assert.match(form, /VenueFormAnalyticsConsent/);
    assert.ok(form.indexOf("{!preview && (") < form.indexOf("<TurnstileWidget"));
    assert.ok(form.lastIndexOf("{!preview && (") < form.lastIndexOf("<VenueFormAnalyticsConsent"));
    assert.equal(applyInquiryFormDraftToPublicConfig(baseConfig, draft()).ga4MeasurementId, null);
  });

  it("Existing saved public Direct Link and public form path remain unchanged", () => {
    const website = readFileSync(resolve("components/settings/website-forms-section.tsx"), "utf8");
    const publicPage = readFileSync(resolve("app/form/[key]/page.tsx"), "utf8");
    assert.match(website, /Direct link/);
    assert.match(website, /\$\{appUrl\}\/form\/\$\{embedKey\}/);
    assert.match(publicPage, /getPublicInquiryFormConfig\(key\)/);
    assert.match(publicPage, /<InquiryForm/);
    assert.doesNotMatch(publicPage, /preview/);
    // Live Direct Link still opens /form/{key}, not a preview route.
    assert.match(website, /href=\{formUrl\}/);
  });

  it("Preview reuses the same customer-facing InquiryForm renderer", () => {
    const website = readFileSync(resolve("components/settings/website-forms-section.tsx"), "utf8");
    const publicPage = readFileSync(resolve("app/form/[key]/page.tsx"), "utf8");
    const form = readFileSync(resolve("components/form/inquiry-form.tsx"), "utf8");
    const previewConfig = readFileSync(resolve("lib/inquiry-form/preview-config.ts"), "utf8");
    assert.match(website, /import \{ InquiryForm \} from "@\/components\/form\/inquiry-form"/);
    assert.match(website, /<InquiryForm[\s\S]*preview/);
    assert.match(website, /INQUIRY_FORM_PREVIEW_BANNER/);
    assert.match(publicPage, /import \{ InquiryForm \} from "@\/components\/form\/inquiry-form"/);
    assert.match(form, /INQUIRY_FORM_PREVIEW_BANNER/);
    assert.match(form, /data-testid=\{preview \? "inquiry-form-preview" : "inquiry-form-public"\}/);
    assert.match(previewConfig, /This is a preview\. Form submissions are disabled\./);
    assert.equal(INQUIRY_FORM_PREVIEW_BANNER, "This is a preview. Form submissions are disabled.");
  });
});
