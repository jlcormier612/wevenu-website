/**
 * Settings Availability custom-type display labels — gate/test probe names
 * must not appear as customer-facing copy. Stored labels stay unchanged.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { scheduleItemTypeSettingsDisplayLabel } from "@/lib/calendar/schedule-item-catalog";

describe("scheduleItemTypeSettingsDisplayLabel", () => {
  it("maps Gate Appt 032692 and Gate Reserved 032692 to Custom Type", () => {
    assert.equal(scheduleItemTypeSettingsDisplayLabel("Gate Appt 032692"), "Custom Type");
    assert.equal(scheduleItemTypeSettingsDisplayLabel("Gate Reserved 032692"), "Custom Type");
    assert.equal(scheduleItemTypeSettingsDisplayLabel("  Gate Appt 032692  "), "Custom Type");
  });

  it("leaves real custom and builtin labels unchanged", () => {
    assert.equal(scheduleItemTypeSettingsDisplayLabel("Wedding Planning Meeting"), "Wedding Planning Meeting");
    assert.equal(scheduleItemTypeSettingsDisplayLabel("Personal Appointment"), "Personal Appointment");
    assert.equal(scheduleItemTypeSettingsDisplayLabel("Blocked Time"), "Blocked Time");
  });

  it("Settings section uses the display helper for custom rows; Rename seeds stored label", () => {
    const section = readFileSync(
      resolve("components/settings/scheduled-appointment-types-section.tsx"),
      "utf8",
    );
    assert.match(section, /scheduleItemTypeSettingsDisplayLabel\(row\.label\)/);
    // Visible custom name uses helper; rename input still seeds the stored label.
    assert.match(section, /setRenameValue\(row\.label\)/);
    assert.doesNotMatch(section, /setRenameValue\(scheduleItemTypeSettingsDisplayLabel/);
  });
});
