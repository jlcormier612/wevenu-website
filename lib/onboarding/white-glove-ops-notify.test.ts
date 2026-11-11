import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  isFirstWhiteGloveIntakeSubmit,
  whiteGloveIntakeOpsSummary,
} from "./white-glove-ops-notify";
import type { OnboardingIntakeInput } from "./types";

const sampleIntake: OnboardingIntakeInput = {
  venueName: "The Willow Grove",
  spaceMode: "one",
  spaces: [{ name: "Main", maxCapacity: 100 }],
  offersTours: true,
  offersTastingsOrAppointments: false,
  appointmentTypeKeys: [],
  inquirySources: ["website"],
  bringBusinessChoice: "honeybook",
  acceptStarters: false,
};

describe("white glove ops intake notify", () => {
  it("treats awaiting_intake as first submit and waiting as retry", () => {
    assert.equal(isFirstWhiteGloveIntakeSubmit("awaiting_intake"), true);
    assert.equal(isFirstWhiteGloveIntakeSubmit(null), true);
    assert.equal(isFirstWhiteGloveIntakeSubmit("waiting"), false);
    assert.equal(isFirstWhiteGloveIntakeSubmit("in_progress"), false);
  });

  it("builds ops copy without attaching materials or leaking storage paths", () => {
    const payload = whiteGloveIntakeOpsSummary({
      venueName: "The Willow Grove",
      ownerEmail: "owner@example.com",
      enrollmentId: "enroll-1",
      venueId: "venue-1",
      intake: sampleIntake,
      materialsCount: 2,
    });
    assert.match(payload.subject, /White Glove intake submitted/);
    assert.match(payload.text, /HoneyBook/);
    assert.match(payload.text, /2 file\(s\) uploaded/);
    assert.match(payload.text, /admin\/onboarding\/venue-1/);
    assert.match(payload.text, /Next action:/);
    assert.equal(payload.idempotencyKey, "htc-ops-wg-intake:enroll-1");
    assert.doesNotMatch(payload.text, /storage_path|documents\/|attachment/i);
    assert.doesNotMatch(payload.text, /password|activation_token|intake_/i);
  });

  it("wires intake route to notify only after successful persist", () => {
    const route = readFileSync(
      resolve("app/api/onboarding/white-glove/intake/route.ts"),
      "utf8",
    );
    assert.match(route, /submitOnboardingIntake/);
    assert.match(route, /notifyWhiteGloveIntakeSubmitted/);
    assert.match(route, /previousWhiteGloveStatus/);
    const persistIdx = route.indexOf("submitOnboardingIntake");
    const notifyIdx = route.indexOf("notifyWhiteGloveIntakeSubmitted");
    assert.ok(persistIdx >= 0 && notifyIdx > persistIdx);
    assert.match(route, /if \(!result\.ok\)/);
  });
});
