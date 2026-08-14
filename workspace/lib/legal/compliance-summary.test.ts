/**
 * Unit tests for Relationship Workspace Legal Summary helpers (WP6).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LEGAL_COMPLIANCE_DOCUMENT_TITLES,
  LEGAL_COMPLIANCE_DOCUMENT_TYPES,
  buildLegalAcceptanceHistoryUrl,
  resolveLegalComplianceStatus,
  resolveLegalComplianceSubject,
} from "./compliance-summary";

describe("LEGAL_COMPLIANCE_DOCUMENT_TYPES", () => {
  it("maps venue to WP2 venue_owner document set", () => {
    assert.deepEqual(LEGAL_COMPLIANCE_DOCUMENT_TYPES.venue, [
      "terms_of_service",
      "privacy_policy",
      "cookie_policy",
      "acceptable_use_policy",
    ]);
    assert.equal(
      LEGAL_COMPLIANCE_DOCUMENT_TITLES.terms_of_service,
      "Venue Subscription Agreement",
    );
  });

  it("maps couple to End User Terms + Privacy", () => {
    assert.deepEqual(LEGAL_COMPLIANCE_DOCUMENT_TYPES.couple, [
      "couple_end_user_terms",
      "privacy_policy",
    ]);
  });

  it("maps vendor to Vendor Terms + Privacy", () => {
    assert.deepEqual(LEGAL_COMPLIANCE_DOCUMENT_TYPES.vendor, [
      "vendor_end_user_terms",
      "privacy_policy",
    ]);
  });
});

describe("resolveLegalComplianceSubject", () => {
  it("defaults to venue when unset or unknown", () => {
    assert.equal(resolveLegalComplianceSubject(undefined), "venue");
    assert.equal(resolveLegalComplianceSubject(null), "venue");
    assert.equal(resolveLegalComplianceSubject(""), "venue");
    assert.equal(resolveLegalComplianceSubject("lead"), "venue");
  });

  it("resolves couple and vendor when entity type exists", () => {
    assert.equal(resolveLegalComplianceSubject("couple"), "couple");
    assert.equal(resolveLegalComplianceSubject("Vendor"), "vendor");
    assert.equal(resolveLegalComplianceSubject("venue_owner"), "venue");
  });
});

describe("resolveLegalComplianceStatus", () => {
  it("returns Not Accepted when nothing accepted", () => {
    assert.equal(
      resolveLegalComplianceStatus({
        acceptedVersion: null,
        activeVersion: "2.0",
      }),
      "not_accepted",
    );
    assert.equal(
      resolveLegalComplianceStatus({
        acceptedVersion: "",
        activeVersion: "2.0",
      }),
      "not_accepted",
    );
  });

  it("returns Current when accepted matches active", () => {
    assert.equal(
      resolveLegalComplianceStatus({
        acceptedVersion: "1.2",
        activeVersion: "1.2",
      }),
      "current",
    );
  });

  it("returns Outdated when accepted differs or active missing", () => {
    assert.equal(
      resolveLegalComplianceStatus({
        acceptedVersion: "1.0",
        activeVersion: "2.0",
      }),
      "outdated",
    );
    assert.equal(
      resolveLegalComplianceStatus({
        acceptedVersion: "1.0",
        activeVersion: null,
      }),
      "outdated",
    );
  });
});

describe("buildLegalAcceptanceHistoryUrl", () => {
  it("prefers relationship filter for View History", () => {
    assert.equal(
      buildLegalAcceptanceHistoryUrl({
        productAppBaseUrl: "https://app.example.com/",
        relationshipId: "rel-123",
        user: "owner@example.com",
      }),
      "https://app.example.com/admin/legal/history?relationship=rel-123",
    );
  });

  it("falls back to search query for user/email", () => {
    assert.equal(
      buildLegalAcceptanceHistoryUrl({
        productAppBaseUrl: "http://localhost:3000",
        user: "owner@example.com",
      }),
      "http://localhost:3000/admin/legal/history?q=owner%40example.com",
    );
  });

  it("returns unfiltered history when no identity", () => {
    assert.equal(
      buildLegalAcceptanceHistoryUrl({
        productAppBaseUrl: "http://localhost:3000",
      }),
      "http://localhost:3000/admin/legal/history",
    );
  });
});
