import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assignmentCoversDate,
  coupleAvailabilityLabel,
  resolveVendorDateAvailability,
} from "@/lib/vendor-availability/query";

describe("vendor date availability query", () => {
  it("block one date is Unavailable / blocked", () => {
    const row = resolveVendorDateAvailability({
      eventDate: "2026-09-29",
      eventBooked: false,
      manuallyBlocked: true,
      vendorHasManualHistory: true,
    });
    assert.equal(row.status, "unavailable");
    assert.equal(row.kind, "blocked");
    assert.equal(coupleAvailabilityLabel(row.status), "Unavailable");
  });

  it("unblocked date with manual history is Available", () => {
    const row = resolveVendorDateAvailability({
      eventDate: "2026-09-29",
      eventBooked: false,
      manuallyBlocked: false,
      vendorHasManualHistory: true,
    });
    assert.equal(row.status, "available");
    assert.equal(row.kind, "available");
  });

  it("month-boundary dates resolve independently", () => {
    const sep = resolveVendorDateAvailability({
      eventDate: "2026-09-30",
      eventBooked: false,
      manuallyBlocked: true,
      vendorHasManualHistory: true,
    });
    const oct = resolveVendorDateAvailability({
      eventDate: "2026-10-01",
      eventBooked: false,
      manuallyBlocked: true,
      vendorHasManualHistory: true,
    });
    assert.equal(sep.status, "unavailable");
    assert.equal(oct.status, "unavailable");
  });

  it("assigned HTC event makes the vendor unavailable and never available", () => {
    const row = resolveVendorDateAvailability({
      eventDate: "2026-10-17",
      eventBooked: true,
      manuallyBlocked: false,
      vendorHasManualHistory: true,
    });
    assert.equal(row.status, "unavailable");
    assert.equal(row.kind, "booked");
    assert.notEqual(row.status, "available");
  });

  it("booked wins over a manual block on the same date", () => {
    const row = resolveVendorDateAvailability({
      eventDate: "2026-10-17",
      eventBooked: true,
      manuallyBlocked: true,
      vendorHasManualHistory: true,
    });
    assert.equal(row.kind, "booked");
    assert.equal(row.status, "unavailable");
  });

  it("removing the assignment restores available when the vendor has history and no block", () => {
    const booked = resolveVendorDateAvailability({
      eventDate: "2026-10-17",
      eventBooked: true,
      manuallyBlocked: false,
      vendorHasManualHistory: true,
    });
    const restored = resolveVendorDateAvailability({
      eventDate: "2026-10-17",
      eventBooked: false,
      manuallyBlocked: false,
      vendorHasManualHistory: true,
    });
    assert.equal(booked.kind, "booked");
    assert.equal(restored.status, "available");
    assert.equal(restored.kind, "available");
  });

  it("no availability record is Not confirmed, not Unavailable", () => {
    const row = resolveVendorDateAvailability({
      eventDate: "2026-10-17",
      eventBooked: false,
      manuallyBlocked: false,
      vendorHasManualHistory: false,
    });
    assert.equal(row.status, "not_confirmed");
    assert.equal(row.kind, "not_confirmed");
    assert.notEqual(row.status, "unavailable");
    assert.equal(coupleAvailabilityLabel(row.status), "Availability not confirmed");
  });

  it("client-facing mapping for an event date", () => {
    const available = resolveVendorDateAvailability({
      eventDate: "2026-10-17",
      eventBooked: false,
      manuallyBlocked: false,
      vendorHasManualHistory: true,
    });
    const blocked = resolveVendorDateAvailability({
      eventDate: "2026-10-17",
      eventBooked: false,
      manuallyBlocked: true,
      vendorHasManualHistory: true,
    });
    const htcBooked = resolveVendorDateAvailability({
      eventDate: "2026-10-17",
      eventBooked: true,
      manuallyBlocked: false,
      vendorHasManualHistory: false,
    });
    const unknown = resolveVendorDateAvailability({
      eventDate: "2026-10-17",
      eventBooked: false,
      manuallyBlocked: false,
      vendorHasManualHistory: false,
    });
    assert.equal(coupleAvailabilityLabel(available.status), "Available");
    assert.equal(coupleAvailabilityLabel(blocked.status), "Unavailable");
    assert.equal(coupleAvailabilityLabel(htcBooked.status), "Unavailable");
    assert.equal(coupleAvailabilityLabel(unknown.status), "Availability not confirmed");
  });

  it("assignment coverage is inclusive of start and end", () => {
    assert.equal(assignmentCoversDate("2026-10-17", null, "2026-10-17"), true);
    assert.equal(assignmentCoversDate("2026-10-16", "2026-10-18", "2026-10-17"), true);
    assert.equal(assignmentCoversDate("2026-10-16", "2026-10-18", "2026-10-15"), false);
    assert.equal(assignmentCoversDate("2026-10-16", "2026-10-18", "2026-10-19"), false);
  });
});
