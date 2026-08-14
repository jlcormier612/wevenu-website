/**
 * Unit tests for HQ Legal Administration helpers (WP5).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isHqLegalAdminRole } from "@/lib/hq/legal-access";
import {
  buildOutstandingRowsForUser,
  canDeactivateLegalVersion,
  classifyOutstandingStatus,
  computeLegalAdminDashboardSummary,
  filterHistoryRows,
  filterOutstandingRows,
  pickCurrentLegalVersion,
  type LegalAdminHistoryRow,
  type LegalAdminOutstandingRow,
} from "@/lib/legal/admin-helpers";
import type { LegalDocument } from "@/lib/legal/types";

function doc(
  partial: Partial<LegalDocument> &
    Pick<LegalDocument, "id" | "documentType" | "version">,
): LegalDocument {
  return {
    title: partial.title ?? partial.documentType,
    effectiveDate: partial.effectiveDate ?? "2026-01-01",
    content: "body",
    isPublished: partial.isPublished ?? true,
    isActive: partial.isActive ?? false,
    publishedBy: null,
    publishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...partial,
  };
}

describe("pickCurrentLegalVersion", () => {
  it("prefers the active version", () => {
    const versions = [
      doc({ id: "1", documentType: "privacy_policy", version: "1", isActive: false }),
      doc({ id: "2", documentType: "privacy_policy", version: "2", isActive: true }),
    ];
    assert.equal(pickCurrentLegalVersion(versions)?.id, "2");
  });

  it("falls back to first entry when none active", () => {
    const versions = [
      doc({ id: "a", documentType: "privacy_policy", version: "3" }),
      doc({ id: "b", documentType: "privacy_policy", version: "2" }),
    ];
    assert.equal(pickCurrentLegalVersion(versions)?.id, "a");
  });
});

describe("canDeactivateLegalVersion", () => {
  it("disables deactivate when this is the only active version", () => {
    assert.equal(
      canDeactivateLegalVersion({ isActive: true, activeCountForType: 1 }),
      false,
    );
  });

  it("allows deactivate when another active version exists", () => {
    assert.equal(
      canDeactivateLegalVersion({ isActive: true, activeCountForType: 2 }),
      true,
    );
  });

  it("never allows deactivate on inactive rows", () => {
    assert.equal(
      canDeactivateLegalVersion({ isActive: false, activeCountForType: 2 }),
      false,
    );
  });
});

describe("computeLegalAdminDashboardSummary", () => {
  it("computes summary cards including acceptance rate", () => {
    const summary = computeLegalAdminDashboardSummary({
      documentTypesWithActive: 5,
      totalVersions: 12,
      outstandingCount: 3,
      currentAcceptances: 7,
      totalTrackedAcceptances: 10,
    });
    assert.deepEqual(summary, {
      currentLegalDocuments: 5,
      totalDocumentVersions: 12,
      outstandingAcceptances: 3,
      acceptanceRatePercent: 70,
    });
  });

  it("returns null acceptance rate when nothing tracked", () => {
    const summary = computeLegalAdminDashboardSummary({
      documentTypesWithActive: 0,
      totalVersions: 0,
      outstandingCount: 0,
      currentAcceptances: 0,
      totalTrackedAcceptances: 0,
    });
    assert.equal(summary.acceptanceRatePercent, null);
  });
});

describe("outstanding detection helpers", () => {
  it("classifies current / outdated / not_accepted", () => {
    assert.equal(
      classifyOutstandingStatus({
        acceptedVersion: "2",
        currentVersion: "2",
      }),
      "current",
    );
    assert.equal(
      classifyOutstandingStatus({
        acceptedVersion: "1",
        currentVersion: "2",
      }),
      "outdated",
    );
    assert.equal(
      classifyOutstandingStatus({
        acceptedVersion: null,
        currentVersion: "2",
      }),
      "not_accepted",
    );
  });

  it("builds outstanding rows for outdated vendor docs only", () => {
    const rows = buildOutstandingRowsForUser({
      userId: "u1",
      userLabel: "Acme Photo",
      role: "vendor",
      activeByType: {
        vendor_end_user_terms: { version: "2.0" },
        privacy_policy: { version: "1.0" },
      },
      acceptedByType: {
        vendor_end_user_terms: "1.0",
        privacy_policy: "1.0",
      },
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.documentType, "vendor_end_user_terms");
    assert.equal(rows[0]?.status, "outdated");
    assert.equal(rows[0]?.acceptedVersion, "1.0");
    assert.equal(rows[0]?.currentVersion, "2.0");
  });
});

describe("search and filter helpers", () => {
  const outstanding: LegalAdminOutstandingRow[] = [
    {
      userId: "u1",
      userLabel: "Jen Owner",
      role: "venue_owner",
      roleLabel: "Venue Owner",
      relationshipId: "rel-1",
      relationshipLabel: "A & B",
      venueId: "v1",
      venueLabel: "Rose Hall",
      documentType: "privacy_policy",
      documentTitle: "Privacy Policy",
      currentVersion: "2",
      acceptedVersion: "1",
      lastLoginAt: null,
      status: "outdated",
    },
    {
      userId: "u2",
      userLabel: "Sam Vendor",
      role: "vendor",
      roleLabel: "Vendor",
      relationshipId: null,
      relationshipLabel: "—",
      venueId: null,
      venueLabel: "—",
      documentType: "vendor_end_user_terms",
      documentTitle: "Vendor Terms",
      currentVersion: "1",
      acceptedVersion: null,
      lastLoginAt: null,
      status: "not_accepted",
    },
  ];

  it("filters outstanding by role and document", () => {
    const filtered = filterOutstandingRows(outstanding, {
      role: "vendor",
      documentType: "vendor_end_user_terms",
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.userId, "u2");
  });

  it("searches outstanding by venue / user / version", () => {
    const byVenue = filterOutstandingRows(outstanding, { search: "rose" });
    assert.equal(byVenue.length, 1);
    assert.equal(byVenue[0]?.userId, "u1");

    const byVersion = filterOutstandingRows(outstanding, { search: "2" });
    assert.ok(byVersion.some((r) => r.userId === "u1"));
  });

  it("filters history by search across user and document", () => {
    const history: LegalAdminHistoryRow[] = [
      {
        id: "h1",
        acceptedAt: "2026-08-01T00:00:00.000Z",
        userId: "u1",
        userLabel: "Jen Owner",
        roleLabel: "Venue Owner",
        relationshipId: "rel-1",
        relationshipLabel: "A & B",
        documentType: "privacy_policy",
        documentTitle: "Privacy Policy",
        acceptedVersion: "1.4",
        acceptanceMethod: "Venue Signup",
        ipAddress: "1.2.3.4",
      },
    ];
    assert.equal(
      filterHistoryRows(history, { search: "privacy" }).length,
      1,
    );
    assert.equal(
      filterHistoryRows(history, { search: "1.4" }).length,
      1,
    );
    assert.equal(
      filterHistoryRows(history, { search: "missing" }).length,
      0,
    );
  });
});

describe("permissions gate", () => {
  it("allows owner and super_admin only", () => {
    assert.equal(isHqLegalAdminRole("owner"), true);
    assert.equal(isHqLegalAdminRole("super_admin"), true);
    assert.equal(isHqLegalAdminRole("team"), false);
    assert.equal(isHqLegalAdminRole(null), false);
    assert.equal(isHqLegalAdminRole(""), false);
  });
});
