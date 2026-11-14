import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  seatingArrangementCanvasSize,
  seatingObjectLabel,
  seatingObjectShape,
  seatingOccupancyText,
  seatingSummaryLine,
  shouldShowOccupancyOnObject,
} from "@/lib/seating/canvas-presentation";

describe("seating canvas presentation", () => {
  it("keeps ceremony rows rectangular with compact labels", () => {
    assert.equal(
      seatingObjectShape({
        displayShape: null,
        objectType: "table_rect",
        width: 100,
        height: 28,
        label: "Ceremony Row 1",
      }),
      "rectangular",
    );
    assert.equal(
      seatingObjectLabel({ label: "Ceremony Row 1", objectType: "table_rect", width: 100, height: 28 }),
      "Row 1",
    );
  });

  it("formats occupancy and summary copy", () => {
    assert.equal(seatingOccupancyText(3, 8), "3 of 8 seated");
    assert.equal(
      seatingSummaryLine({ totalAssigned: 6, totalAttending: 6, tableCount: 25, totalCapacity: 170 }),
      "6 of 6 seated · 25 tables · 170 seats",
    );
  });

  it("hides occupancy text on tiny zoomed-out objects", () => {
    assert.equal(shouldShowOccupancyOnObject(28, 28, 0.5), false);
    assert.equal(shouldShowOccupancyOnObject(72, 72, 1), true);
  });

  it("expands Fit-plan canvas to include objects past the room boundary", () => {
    const size = seatingArrangementCanvasSize({
      roomWidthFt: 60,
      roomDepthFt: 40,
      objects: [
        { x: 360, y: 240, width: 72, height: 72 },
        { x: 900, y: 320, width: 100, height: 44 },
        { x: 860, y: 520, width: 90, height: 50 },
      ],
    });
    assert.equal(size.roomW, 720);
    assert.equal(size.roomH, 480);
    assert.equal(size.canvasW, 950);
    assert.equal(size.canvasH, 545);
  });
});
