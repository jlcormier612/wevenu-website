/**
 * Disabled appointment types cannot block event bookings.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  applyAppointmentBlocksInvariant,
  mergeAppointmentBlocksPatch,
} from "@/lib/calendar/appointment-blocks-invariant";

const section = readFileSync(
  resolve("components/settings/scheduled-appointment-types-section.tsx"),
  "utf8",
);
const service = readFileSync(
  resolve("lib/calendar/schedule-item-catalog-service.ts"),
  "utf8",
);

describe("appointment blocks invariant", () => {
  it("allows enabled + blocks ON", () => {
    assert.deepEqual(
      applyAppointmentBlocksInvariant({ enabled: true, blocksAvailability: true }),
      { enabled: true, blocksAvailability: true },
    );
  });

  it("allows enabled + blocks OFF", () => {
    assert.deepEqual(
      applyAppointmentBlocksInvariant({ enabled: true, blocksAvailability: false }),
      { enabled: true, blocksAvailability: false },
    );
  });

  it("allows disabled + blocks OFF", () => {
    assert.deepEqual(
      applyAppointmentBlocksInvariant({ enabled: false, blocksAvailability: false }),
      { enabled: false, blocksAvailability: false },
    );
  });

  it("cannot persist disabled + blocks ON", () => {
    assert.deepEqual(
      applyAppointmentBlocksInvariant({ enabled: false, blocksAvailability: true }),
      { enabled: false, blocksAvailability: false },
    );
    assert.deepEqual(
      mergeAppointmentBlocksPatch(
        { enabled: true, blocksAvailability: true },
        { enabled: false },
      ),
      { enabled: false, blocksAvailability: false },
    );
    assert.deepEqual(
      mergeAppointmentBlocksPatch(
        { enabled: false, blocksAvailability: false },
        { blocksAvailability: true },
      ),
      { enabled: false, blocksAvailability: false },
    );
  });

  it("turning appointment OFF clears blocking", () => {
    const next = mergeAppointmentBlocksPatch(
      { enabled: true, blocksAvailability: true },
      { enabled: false },
    );
    assert.equal(next.enabled, false);
    assert.equal(next.blocksAvailability, false);
  });

  it("re-enabling does not automatically turn blocking ON", () => {
    const next = mergeAppointmentBlocksPatch(
      { enabled: false, blocksAvailability: false },
      { enabled: true },
    );
    assert.equal(next.enabled, true);
    assert.equal(next.blocksAvailability, false);
  });

  it("UI disables Blocks control while appointment is OFF", () => {
    assert.match(section, /disabled=\{!canEdit \|\| locked \|\| busy \|\| !row\.enabled\}/);
    assert.match(section, /disabled=\{!canEdit \|\| busy \|\| !row\.enabled\}/);
    assert.match(section, /Unavailable while this appointment is off/);
    assert.match(section, /checked=\{row\.enabled \? row\.blocksAvailability : false\}/);
    assert.match(section, /mergeAppointmentBlocksPatch/);
  });

  it("server settings writes apply the invariant", () => {
    assert.match(service, /mergeAppointmentBlocksPatch/);
    assert.match(service, /blocksAvailability: next\.blocksAvailability/);
    assert.match(service, /blocksAvailability: created\.blocksAvailability/);
  });
});
