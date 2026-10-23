/**
 * Lead detail header compact restoration — Sales owner | Date hold row,
 * two action rows, inline no-active-hold status (not a full-width banner).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
const holds = readFileSync(resolve("components/availability/date-holds-section.tsx"), "utf8");

describe("lead header compact layout", () => {
  it("keeps Sales owner and Date hold on one compact row with a divider at sm+", () => {
    const row = detail.slice(
      detail.indexOf('data-testid="lead-owner-hold-row"'),
      detail.indexOf('data-testid="lead-owner-hold-row"') + 900,
    );
    assert.match(row, /StaffAssignmentField/);
    assert.match(row, /density="compact"/);
    assert.match(row, /lead-owner-hold-divider/);
    assert.match(row, /flex-wrap items-center/);
    assert.doesNotMatch(row, /basis-full sm:basis-auto/);
  });

  it("organizes lead management and next actions into two testable rows", () => {
    const mgmt = detail.slice(
      detail.indexOf('data-testid="lead-management-actions"'),
      detail.indexOf('data-testid="lead-booking-tour-actions"'),
    );
    assert.match(mgmt, /Change stage/);
    assert.match(mgmt, /MergeLeadButton/);
    assert.match(mgmt, /DeleteRecordButton/);
    assert.match(mgmt, /Archive/);
    const editIdx = mgmt.indexOf("Edit");
    const mergeIdx = mgmt.indexOf("MergeLeadButton");
    const deleteIdx = mgmt.indexOf("DeleteRecordButton");
    const archiveIdx = mgmt.indexOf(">Archive<") >= 0 ? mgmt.indexOf(">Archive<") : mgmt.indexOf("Archive");
    assert.ok(editIdx > 0 && mergeIdx > editIdx && deleteIdx > mergeIdx && archiveIdx > deleteIdx);

    const next = detail.slice(
      detail.indexOf('data-testid="lead-booking-tour-actions"'),
      detail.indexOf('data-testid="lead-sales-availability"'),
    );
    assert.match(next, /TourScheduleActions includeCopyLink=\{false\}/);
    assert.match(next, /data-testid="start-booking-action"/);
  });

  it("compact Date hold keeps protection status inline (not a full-width banner above the band)", () => {
    const bandIdx = holds.indexOf('data-testid="date-hold-compact-band"');
    // className sits on the opening tag just before the test id
    const compactBand = holds.slice(Math.max(0, bandIdx - 220), holds.indexOf("Regular (non-compact) active holds"));
    assert.match(compactBand, /Not protected/);
    assert.match(compactBand, /No active hold is protecting this event date/);
    assert.match(compactBand, /date-hold-protection-banner/);
    assert.match(compactBand, /date-hold-place/);
    // Share the Sales owner row at sm+ (flex-1 + basis-0) instead of wrapping as a full-width block.
    assert.match(compactBand, /flex-1/);
    assert.match(compactBand, /sm:basis-0/);
    assert.match(compactBand, /truncate/);
    // Full-width basis-full banner must not precede the compact control band.
    const contentsIdx = holds.indexOf('className={compact ? "contents"');
    const fullWidthBannerBeforeBand = holds.slice(contentsIdx, bandIdx);
    assert.doesNotMatch(fullWidthBannerBeforeBand, /basis-full w-full rounded-md border/);
  });

  it("past holds stay history-only and collapse under disclosure in compact density", () => {
    assert.match(holds, /Hold history \(\{pastHolds\.length\}\) — not current protection/);
    assert.match(holds, /date-hold-history-row/);
    assert.match(holds, /not current protection/);
  });
});
