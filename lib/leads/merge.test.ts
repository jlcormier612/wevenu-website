import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  KEEP_BOTH_INQUIRY_CHOICE,
  resolveInquiryMessageChoice,
} from "@/lib/leads/merge-inquiry-choice";
import { mergeTestHelpers, type MergeFieldKey } from "@/lib/leads/merge";

const { buildFieldDiffs, pickDefaultPrimary, norm } = mergeTestHelpers;

function snap(partial: Record<string, unknown>) {
  return {
    id: "a",
    venue_id: "v",
    first_name: "Ann",
    last_name: "Early",
    email: null,
    phone: null,
    partner_first_name: null,
    partner_last_name: null,
    partner_email: null,
    event_type: null,
    event_date: null,
    end_date: null,
    guest_count: null,
    estimated_budget: null,
    inquiry_message: null,
    next_action_text: null,
    next_action_due: null,
    follow_up_date: null,
    planned_event_space_id: null,
    assigned_staff_id: null,
    source: null,
    preferred_communication_channels: null,
    sales_stage: "new_inquiry",
    created_at: "2026-01-01T10:00:00.000Z",
    updated_at: "2026-01-01T10:00:00.000Z",
    merged_into_lead_id: null,
    ...partial,
  } as Parameters<typeof buildFieldDiffs>[0];
}

describe("lead merge field reconciliation", () => {
  it("fills empty primary from populated secondary", () => {
    const diffs = buildFieldDiffs(
      snap({ email: null, phone: null }),
      snap({ id: "b", email: "b@example.com", phone: "555-0100" }),
    );
    const email = diffs.find((d) => d.key === "email");
    const phone = diffs.find((d) => d.key === "phone");
    assert.equal(email?.kind, "fill");
    assert.equal(phone?.kind, "fill");
    if (email?.kind === "fill") assert.equal(email.secondaryValue, "b@example.com");
  });

  it("treats identical values as one value", () => {
    const diffs = buildFieldDiffs(
      snap({ email: "same@example.com" }),
      snap({ id: "b", email: "same@example.com" }),
    );
    const email = diffs.find((d) => d.key === "email");
    assert.equal(email?.kind, "same");
  });

  it("flags conflicting populated values without choosing", () => {
    const diffs = buildFieldDiffs(
      snap({ email: "a@example.com", guest_count: 50 }),
      snap({ id: "b", email: "b@example.com", guest_count: 100 }),
    );
    const email = diffs.find((d) => d.key === "email");
    const guests = diffs.find((d) => d.key === "guest_count");
    assert.equal(email?.kind, "conflict");
    assert.equal(guests?.kind, "conflict");
  });

  it("defaults primary to earliest created_at", () => {
    const early = snap({ id: "early", created_at: "2026-01-01T09:00:00.000Z" });
    const late = snap({ id: "late", created_at: "2026-01-01T11:00:00.000Z" });
    const picked = pickDefaultPrimary(late, early);
    assert.equal(picked.primary.id, "early");
    assert.equal(picked.secondary.id, "late");
    assert.equal(picked.tied, false);
  });

  it("marks identical created_at as needing explicit choice", () => {
    const a = snap({ id: "a", created_at: "2026-01-01T10:00:00.000Z" });
    const b = snap({ id: "b", created_at: "2026-01-01T10:00:00.000Z" });
    const picked = pickDefaultPrimary(a, b);
    assert.equal(picked.tied, true);
  });

  it("norm collapses channel arrays for comparison", () => {
    assert.equal(norm(["sms", "email"]), norm(["email", "sms"]));
    assert.equal(norm("  "), null);
  });
});

describe("inquiry message keep-both resolution", () => {
  it("Keep both uses primary field and flags secondary history", () => {
    const r = resolveInquiryMessageChoice({
      choice: KEEP_BOTH_INQUIRY_CHOICE,
      primaryValue: "First submission",
      secondaryValue: "Second submission",
    });
    assert.equal(r.primaryFieldValue, "First submission");
    assert.equal(r.preserveSecondaryAsHistory, true);
  });

  it("Keep primary does not archive secondary", () => {
    const r = resolveInquiryMessageChoice({
      choice: "First submission",
      primaryValue: "First submission",
      secondaryValue: "Second submission",
    });
    assert.equal(r.primaryFieldValue, "First submission");
    assert.equal(r.preserveSecondaryAsHistory, false);
  });

  it("Use secondary sets primary field to secondary text", () => {
    const r = resolveInquiryMessageChoice({
      choice: "Second submission",
      primaryValue: "First submission",
      secondaryValue: "Second submission",
    });
    assert.equal(r.primaryFieldValue, "Second submission");
    assert.equal(r.preserveSecondaryAsHistory, false);
  });

  it("identical text with keep-both does not create redundant history", () => {
    const r = resolveInquiryMessageChoice({
      choice: KEEP_BOTH_INQUIRY_CHOICE,
      primaryValue: "Same text",
      secondaryValue: "Same text",
    });
    assert.equal(r.preserveSecondaryAsHistory, false);
  });

  it("empty secondary with keep-both does not create history", () => {
    const r = resolveInquiryMessageChoice({
      choice: KEEP_BOTH_INQUIRY_CHOICE,
      primaryValue: "Only primary",
      secondaryValue: "  ",
    });
    assert.equal(r.preserveSecondaryAsHistory, false);
  });

  it("inquiry conflict is detected when both differ", () => {
    const diffs = buildFieldDiffs(
      snap({ inquiry_message: "A June wedding." }),
      snap({ id: "b", inquiry_message: "An October wedding." }),
    );
    const inquiry = diffs.find((d) => d.key === "inquiry_message");
    assert.equal(inquiry?.kind, "conflict");
  });

  it("identical inquiry messages are same, not conflict", () => {
    const diffs = buildFieldDiffs(
      snap({ inquiry_message: "We would like to visit." }),
      snap({ id: "b", inquiry_message: "We would like to visit." }),
    );
    const inquiry = diffs.find((d) => d.key === "inquiry_message");
    assert.equal(inquiry?.kind, "same");
  });

  it("empty primary + populated secondary is fill, not keep-both", () => {
    const diffs = buildFieldDiffs(
      snap({ inquiry_message: null }),
      snap({ id: "b", inquiry_message: "Tour request details" }),
    );
    const inquiry = diffs.find((d) => d.key === "inquiry_message");
    assert.equal(inquiry?.kind, "fill");
  });
});

describe("lead merge safety contracts (source)", () => {
  const mergeTs = readFileSync(resolve("lib/leads/merge.ts"), "utf8");
  const migration = readFileSync(resolve("supabase/migrations/20261420100000_lead_merge.sql"), "utf8");
  const preserveMig = readFileSync(
    resolve("supabase/migrations/20261420400000_merge_preserve_inquiry.sql"),
    "utf8",
  );
  const dialog = readFileSync(resolve("components/leads/merge-lead-dialog.tsx"), "utf8");
  const page = readFileSync(resolve("app/(app)/leads/[id]/page.tsx"), "utf8");
  const repo = readFileSync(resolve("lib/leads/repository.ts"), "utf8");
  const actions = readFileSync(resolve("app/(app)/leads/[id]/actions.ts"), "utf8");

  it("confirm uses atomic RPC and revalidates stale timestamps", () => {
    assert.match(mergeTs, /merge_leads_v1/);
    assert.match(mergeTs, /stale/);
    assert.match(mergeTs, /fieldChoices/);
    assert.match(mergeTs, /tourCancelIds/);
  });

  it("merge discovery searches name/email/phone and excludes current lead", () => {
    assert.match(mergeTs, /searchMergeLeadCandidates/);
    assert.match(mergeTs, /phone\.ilike/);
    assert.match(mergeTs, /partner_email\.ilike/);
    assert.match(mergeTs, /neq\("id", currentLeadId\)/);
    assert.match(mergeTs, /merged_into_lead_id/);
    assert.match(actions, /searchMergeLeadCandidatesAction/);
    const searchFn = mergeTs.slice(
      mergeTs.indexOf("export async function searchMergeLeadCandidates"),
      mergeTs.indexOf("export type ConfirmMergeInput"),
    );
    assert.ok(searchFn.length > 200);
    assert.doesNotMatch(searchFn, /merge_leads_v1|confirmMergeLeads|\.rpc\(/);
    assert.match(searchFn, /\.from\("leads"\)/);
  });

  it("dialog is search-first and requires selection before preview", () => {
    assert.match(dialog, /Find the duplicate lead/);
    assert.match(dialog, /merge-find-duplicate/);
    assert.match(dialog, /merge-candidate-row/);
    assert.match(dialog, /Select a duplicate lead before previewing/);
    assert.match(dialog, /Paste lead ID \(troubleshooting\)/);
    assert.doesNotMatch(dialog, /Paste the duplicate lead’s ID/);
    assert.match(dialog, /cannot merge a lead into itself/);
    assert.match(dialog, /merge-survivor-reason/);
    assert.match(dialog, /earliest submission/);
  });

  it("RPC soft-marks secondary and reparents tours without drop", () => {
    assert.match(migration, /merged_into_lead_id/);
    assert.match(migration, /update public\.tour_appointments[\s\S]*lead_id = p_primary_id/);
    assert.match(migration, /status = 'cancelled'/);
    assert.doesNotMatch(migration, /delete from public\.leads/);
  });

  it("RPC does not send messages or enroll sequences", () => {
    assert.doesNotMatch(migration, /sequence_enrollment|send_email|enqueue.*message/i);
    assert.doesNotMatch(mergeTs, /enrollSequence|sendTour|sendEmail/);
  });

  it("blocks tour_protection and unauthorized callers", () => {
    assert.match(migration, /tour_protection_requests/);
    assert.match(migration, /unauthorized/);
    assert.match(migration, /venue_staff/);
  });

  it("UI requires confirmation and surfaces conflicts/tours", () => {
    assert.match(dialog, /Confirm merge/);
    assert.match(dialog, /conflict/);
    assert.match(dialog, /Tour appointments/);
    assert.match(dialog, /Cancel this tour/);
  });

  it("secondary lead detail redirects to primary", () => {
    assert.match(page, /mergedIntoLeadId/);
    assert.match(page, /redirect\(`\/leads\/\$\{lead\.mergedIntoLeadId\}/);
  });

  it("list queries exclude merged secondaries", () => {
    assert.match(repo, /merged_into_lead_id.*null/);
  });

  it("lead-received reporting also excludes soft-merged secondaries", () => {
    const reporting = readFileSync(resolve("lib/reporting/service.ts"), "utf8");
    assert.match(reporting, /getLeadsTrend/);
    assert.match(reporting, /merged_into_lead_id.*null/);
  });

  it("duplicate banner no longer instructs manual copy/delete", () => {
    const banner = readFileSync(resolve("components/leads/possible-duplicate-banner.tsx"), "utf8");
    assert.doesNotMatch(banner, /delete this duplicate|copy any useful|paste the other lead/i);
    assert.match(banner, /Nothing merges until you confirm/);
  });

  it("idempotent already-merged path exists", () => {
    assert.match(migration, /alreadyMerged/);
  });

  it("preserve-inquiry migration archives secondary as activity, not a note or message send", () => {
    assert.match(preserveMig, /additional_inquiry_message/);
    assert.match(preserveMig, /preserveSecondaryInquiry/);
    assert.match(preserveMig, /Additional inquiry from merged lead/);
    assert.doesNotMatch(preserveMig, /insert into public\.lead_notes/);
    assert.doesNotMatch(preserveMig, /sequence_enrollment|send_email/i);
    assert.match(preserveMig, /alreadyMerged/);
  });

  it("confirm maps keep-both sentinel before RPC field patch", () => {
    assert.match(mergeTs, /KEEP_BOTH_INQUIRY_CHOICE/);
    assert.match(mergeTs, /preserveSecondaryInquiry/);
    assert.match(mergeTs, /resolveInquiryMessageChoice/);
  });

  it("dialog offers keep-both as default for inquiry conflicts", () => {
    assert.match(dialog, /KEEP_BOTH_INQUIRY_CHOICE/);
    assert.match(dialog, /Keep both messages/);
    assert.match(dialog, /merge-inquiry-keep-both/);
    assert.match(dialog, /does not combine them into one/);
  });
});

describe("regression: duplicate detection still warn-only", () => {
  it("duplicate-review still does not call merge on create", () => {
    const review = readFileSync(resolve("lib/leads/duplicate-review.ts"), "utf8");
    assert.doesNotMatch(review, /confirmMergeLeads|merge_leads_v1/);
    assert.match(review, /kept_separate/);
  });
});

// Silence unused type import when helpers change
void (null as unknown as MergeFieldKey);
