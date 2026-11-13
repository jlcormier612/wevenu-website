import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SETUP_CHAPTERS,
  chapterProgressFromStages,
  recommendNextAction,
} from "@/lib/setup-hub/chapters";
import { isYourVenueBasicsReady } from "@/lib/setup-hub/stage-completion";

describe("Setup Hub four chapters", () => {
  it("defines exactly four chapters in approved order", () => {
    assert.deepEqual(
      SETUP_CHAPTERS.map((c) => c.id),
      ["venue-ready", "sales-process", "client-experience", "make-it-yours"],
    );
    assert.deepEqual(
      SETUP_CHAPTERS.map((c) => c.title),
      [
        "Get your venue ready",
        "Explore your sales process",
        "Prepare your client experience",
        "Make it yours",
      ],
    );
  });

  it("keeps Bring Your Business out of early chapters", () => {
    assert.ok(!SETUP_CHAPTERS[0].stageKeys.includes("bring-your-business"));
    assert.ok(!SETUP_CHAPTERS[1].stageKeys.includes("bring-your-business"));
    assert.ok(SETUP_CHAPTERS[3].stageKeys.includes("bring-your-business"));
  });

  it("computes chapter progress without fabricating completion", () => {
    const progress = chapterProgressFromStages([
      { key: "your-venue", status: "complete", required: true },
      { key: "calendar-availability", status: "not_started", required: true },
      { key: "lead-capture", status: null, required: true },
      { key: "your-offerings", status: null, required: true },
      { key: "client-experience", status: null, required: true },
      { key: "your-team", status: null, required: false },
      { key: "financials", status: null, required: false },
      { key: "bring-your-business", status: "not_started", required: false },
    ]);
    assert.equal(progress[0].status, "in_progress");
    assert.equal(progress[0].requiredDone, 1);
    assert.equal(progress[0].requiredTotal, 2);
    assert.equal(progress[1].status, "not_started");
  });

  it("recommends the first incomplete required stage in chapter order", () => {
    const next = recommendNextAction({
      stages: [
        {
          key: "your-venue",
          status: "complete",
          required: true,
          title: "Your Venue",
          href: "/settings/business",
          hrefLabel: "Open",
        },
        {
          key: "calendar-availability",
          status: "not_started",
          required: true,
          title: "Spaces",
          href: "/settings/availability",
          hrefLabel: "Open Availability",
        },
        {
          key: "lead-capture",
          status: "not_started",
          required: true,
          title: "Leads",
          href: "/setup-hub/lead-capture",
          hrefLabel: "Set up",
        },
      ],
    });
    assert.ok(next);
    assert.equal(next?.stageKey, "calendar-availability");
    assert.equal(next?.chapterId, "venue-ready");
  });
});

describe("Your Venue basics vs complete", () => {
  it("basics ready with name/email/phone only", () => {
    assert.equal(
      isYourVenueBasicsReady({
        name: "Hall",
        email: "a@b.co",
        phone: "555",
        businessHours: [],
        logoUrl: null,
        heroImageUrl: null,
        primaryColor: null,
      }),
      true,
    );
    assert.equal(
      isYourVenueBasicsReady({
        name: "Hall",
        email: null,
        phone: "555",
        businessHours: [],
        logoUrl: null,
        heroImageUrl: null,
        primaryColor: null,
      }),
      false,
    );
  });
});
