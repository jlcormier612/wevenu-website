/**
 * Lead Workspace tour outcome actions — confirmation + correction UX.
 * Preserves PR #68 compact button chrome; asserts dialog/outcome behavior only.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const panel = readFileSync(new URL("../../components/leads/tour-panel.tsx", import.meta.url), "utf8");
const service = readFileSync(new URL("./service.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

describe("tour outcome confirmations", () => {
  it("requires confirmation before no-show / completed / cancel", () => {
    assert.match(panel, /Mark this tour as a no-show\?/);
    assert.match(panel, /Mark this tour as completed\?/);
    assert.match(panel, /Cancel this tour\?/);
    assert.match(panel, /Keep Scheduled/);
    assert.match(panel, /Keep Tour/);
    assert.match(panel, /setNoShowOpen\(true\)/);
    assert.doesNotMatch(panel, /onClick=\{\(\) => void setStatus\("no_show"\)\}/);
  });

  it("uses exact optional-note labels and placeholders", () => {
    assert.match(panel, /Add a note \(optional\)/);
    assert.match(panel, /couldn't reach the couple, or they called to reschedule/);
    assert.match(panel, /loved the garden ceremony space; follow up with pricing/);
    assert.match(panel, /Reason or note \(optional\)/);
    assert.match(panel, /requested a different date/);
  });

  it("restores optional Actually occurred fields on the Completed dialog", () => {
    assert.match(panel, /Actually occurred \(optional\)/);
    assert.match(panel, /prefillActualFromScheduled/);
    assert.match(panel, /confirmComplete/);
    assert.match(panel, /hasDate !== hasTime/);
    assert.match(panel, /actualOccurrence=\{\{/);
    assert.match(panel, /data-testid="tour-outcome-actual-date"/);
    assert.match(panel, /data-testid="tour-outcome-actual-time"/);
    // After the optional note, before Keep Scheduled / Mark Completed.
    const completeDialog = panel.slice(
      panel.indexOf('title="Mark this tour as completed?"'),
      panel.indexOf('title="Cancel this tour?"'),
    );
    const noteIdx = completeDialog.indexOf('noteLabel="Add a note (optional)"');
    const actualIdx = completeDialog.indexOf("actualOccurrence={{");
    const primaryIdx = completeDialog.indexOf('primaryLabel="Mark Completed"');
    assert.ok(noteIdx > 0 && actualIdx > noteIdx && primaryIdx > 0);
  });

  it("exposes Edit outcome and Schedule another tour for terminal states", () => {
    assert.match(panel, /Update tour outcome/);
    assert.match(panel, /Schedule another tour/);
    assert.match(panel, /Edit outcome/);
    assert.match(panel, /staffCorrection: true/);
  });

  it("offers Undo for no-show via staffCorrection restore", () => {
    assert.match(panel, /Tour marked as a no-show/);
    assert.match(panel, /label: "Undo"/);
    assert.match(panel, /staffCorrection: true/);
  });
});

describe("updateTourStatus correction path", () => {
  it("supports notes and quiet staffCorrection without customer email side effects", () => {
    assert.match(service, /staffCorrection\?: boolean/);
    assert.match(service, /notes\?: string \| null/);
    assert.match(service, /if \(becameConfirmed && !staffCorrection\)/);
    assert.match(service, /if \(!staffCorrection && POST_TOUR_STATUSES\.has\(status\)/);
    assert.match(service, /tour_outcome_corrected/);
  });

  it("clears stale completion and cancellation metadata when correcting away", () => {
    const fn = service.slice(service.indexOf("export async function updateTourStatus"));
    const body = fn.slice(0, fn.indexOf("export async function requestTourConfirmation"));
    assert.match(body, /appt\.status === "completed" && status !== "completed"/);
    assert.match(body, /patch\.completed_at = null/);
    assert.match(body, /patch\.actual_occurred_at = null/);
    assert.match(body, /appt\.status === "cancelled" && status !== "cancelled"/);
    assert.match(body, /patch\.cancellation_reason = null/);
    // Never invent actual or rewrite the booked slot.
    assert.doesNotMatch(body, /patch\.scheduled_at/);
    const completed = body.slice(body.indexOf('if (status === "completed")'), body.indexOf("const becameConfirmed"));
    assert.match(completed, /actualDate && actualTime/);
    assert.match(completed, /patch\.actual_occurred_at = actualOccurredAt/);
  });
});

describe("tour action chrome preserved", () => {
  it("keeps approved 36px desktop action heights", () => {
    assert.match(css, /\.htc-lead-tour-action-secondary \{[\s\S]*?height: 2\.25rem; \/\* 36px desktop \*\//);
    assert.match(css, /min-height: 2\.25rem; \/\* 36px desktop \*\//);
  });

  it("adds hover/focus without changing padding or height tokens", () => {
    assert.match(css, /\.htc-lead-tour-action-secondary:hover:not\(:disabled\)/);
    assert.match(css, /\.htc-lead-tour-action-secondary:focus-visible/);
    assert.match(css, /padding-inline: 0\.9375rem; \/\* 15px \*\//);
  });
});
