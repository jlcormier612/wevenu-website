/**
 * Booking detail header actions — mobile overflow without clipping Day-of Sheet.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");

describe("booking detail mobile header actions", () => {
  it("exposes a dedicated header actions region", () => {
    assert.match(detail, /data-testid="event-header-actions"/);
  });

  it("keeps Edit event and Day-of Sheet as always-visible primary actions", () => {
    assert.match(detail, /data-testid="event-action-edit"/);
    assert.match(detail, /data-testid="event-action-day-sheet"/);
    assert.match(detail, /Edit event/);
    assert.match(detail, /Day-of Sheet/);
  });

  it("moves Cancel / Return into a mobile More actions menu", () => {
    assert.match(detail, /data-testid="event-action-more"/);
    assert.match(detail, /More actions/);
    assert.match(detail, /data-testid="event-action-cancel-menu"/);
    assert.match(detail, /data-testid="event-action-return-booked-menu"/);
    assert.match(detail, /className="hidden h-8 sm:inline-flex"/);
    assert.match(detail, /sm:hidden/);
  });

  it("keeps Cancel confirm copy and does not add a horizontal scroll action strip", () => {
    assert.match(
      detail,
      /Cancel this event\? It leaves the active client list\. History, contracts, and payments stay\./,
    );
    const actions = detail.slice(
      detail.indexOf('data-testid="event-header-actions"'),
      detail.indexOf("{/* ── Wedding Day banner"),
    );
    assert.doesNotMatch(actions, /overflow-x-auto/);
  });

  it("uses taller mobile touch targets on primary actions", () => {
    assert.match(detail, /h-11 min-h-11 sm:h-8/);
  });
});
